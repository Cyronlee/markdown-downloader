import JSZip from 'jszip';

import './style.css';
import { buildMarkdown } from '../shared/markdown';
import {
  MESSAGE_TYPES,
  type ActiveArticleState,
  type ExtractedArticle,
  type RuntimeResponse,
} from '../shared/types';
import {
  getErrorMessage,
  isWeixinArticleUrl,
  sanitizeFileName,
} from '../shared/utils';

interface ActiveTab {
  id: number;
  url: string;
}

const appElement = document.querySelector<HTMLDivElement>('#app');

if (!appElement) {
  throw new Error('Popup 容器不存在');
}

const app = appElement;

function renderShell(title: string, body: string): void {
  app.innerHTML = `
    <section class="panel">
      <header class="panel__header">
        <p class="eyebrow">Markdown Downloader</p>
        <h1 class="title">${title}</h1>
      </header>
      <div class="panel__body">
        ${body}
      </div>
    </section>
  `;
}

function renderStatus(
  state: {
    title: string;
    description: string;
    tone?: 'error' | 'success' | 'loading';
    buttonLabel?: string;
    buttonDisabled?: boolean;
    meta?: Array<{ label: string; value: string }>;
  },
  onDownload?: () => void,
): void {
  const metaHtml = (state.meta ?? [])
    .map(
      (item) => `
        <div class="meta__row">
          <span class="meta__label">${item.label}</span>
          <span class="meta__value">${item.value}</span>
        </div>
      `,
    )
    .join('');

  renderShell(
    state.title,
    `
      ${metaHtml ? `<dl class="meta">${metaHtml}</dl>` : ''}
      <div class="status" data-tone="${state.tone ?? ''}">
        ${state.description}
      </div>
      ${
        state.buttonLabel
          ? `
            <div class="actions">
              <button class="button button--primary" id="download-button" ${
                state.buttonDisabled ? 'disabled' : ''
              }>${state.buttonLabel}</button>
            </div>
          `
          : ''
      }
    `,
  );

  const button = document.querySelector<HTMLButtonElement>('#download-button');
  if (button && onDownload) {
    button.addEventListener('click', onDownload);
  }
}

async function getActiveTab(): Promise<ActiveTab> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id || !tab.url) {
    throw new Error('未找到当前标签页');
  }

  return { id: tab.id, url: tab.url };
}

async function sendMessage<T>(
  tabId: number,
  type: typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES],
): Promise<T> {
  let response: RuntimeResponse<T>;

  try {
    response = await chrome.tabs.sendMessage(tabId, { type });
  } catch (error) {
    throw new Error(
      `无法连接到页面内容脚本: ${getErrorMessage(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.data;
}

async function fetchAssets(article: ExtractedArticle): Promise<{
  successfulAssets: Array<{ path: string; blob: Blob }>;
  failedAssets: typeof article.assets;
}> {
  const results = await Promise.all(
    article.assets.map(async (asset) => {
      try {
        const response = await fetch(asset.sourceUrl, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return {
          ok: true as const,
          path: asset.localPath,
          blob: await response.blob(),
        };
      } catch {
        return {
          ok: false as const,
          asset,
        };
      }
    }),
  );

  return {
    successfulAssets: results.filter((item) => item.ok),
    failedAssets: results
      .filter((item) => !item.ok)
      .map((item) => item.asset),
  };
}

function replaceFailedAssetPaths(
  markdown: string,
  article: ExtractedArticle,
  failedAssets: ExtractedArticle['assets'],
): string {
  const sourceByPath = new Map(
    article.assets.map((asset) => [asset.localPath, asset.sourceUrl]),
  );

  return failedAssets.reduce((current, asset) => {
    const remoteUrl = sourceByPath.get(asset.localPath);
    return remoteUrl
      ? current.split(asset.localPath).join(remoteUrl)
      : current;
  }, markdown);
}

async function downloadArticle(article: ExtractedArticle): Promise<void> {
  const safeBaseName = sanitizeFileName(article.title);
  const { markdown, assets } = buildMarkdown(article);
  const { successfulAssets, failedAssets } = await fetchAssets(article);
  const finalMarkdown = replaceFailedAssetPaths(
    markdown,
    article,
    failedAssets,
  );
  const zip = new JSZip();

  zip.file(`${safeBaseName}.md`, finalMarkdown);
  for (const asset of successfulAssets) {
    zip.file(asset.path, asset.blob);
  }

  if (failedAssets.length > 0) {
    const fallbackReport = failedAssets
      .map((asset) => `- ${asset.localPath} -> ${asset.sourceUrl}`)
      .join('\n');
    zip.file(
      'assets/failed-assets.txt',
      `${assets.length} 张图片中有 ${failedAssets.length} 张回退为远程链接：\n${fallbackReport}\n`,
    );
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const blobUrl = URL.createObjectURL(blob);

  await chrome.downloads.download({
    url: blobUrl,
    filename: `${safeBaseName}.zip`,
    saveAs: true,
  });

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

async function initialize(): Promise<void> {
  renderStatus({
    title: '微信公众号 Markdown 下载器',
    description: '正在检测当前页面…',
    tone: 'loading',
  });

  const activeTab = await getActiveTab();
  if (!isWeixinArticleUrl(activeTab.url)) {
    renderStatus({
      title: '当前页面不支持',
      description: '首版只支持 mp.weixin.qq.com 的公众号文章页面。',
      tone: 'error',
    });
    return;
  }

  const articleState = await sendMessage<ActiveArticleState>(
    activeTab.id,
    MESSAGE_TYPES.getActiveArticleState,
  );

  if (!articleState.supported) {
    renderStatus({
      title: articleState.title || '当前页面不支持',
      description: articleState.reason || '当前页面不支持下载。',
      tone: 'error',
    });
    return;
  }

  const onDownload = async () => {
    try {
      renderStatus({
        title: articleState.title || '准备导出',
        description: '正在提取正文、下载图片并打包 ZIP…',
        tone: 'loading',
        buttonLabel: '正在导出',
        buttonDisabled: true,
        meta: [
          {
            label: '适配器',
            value: articleState.adapter || 'weixin',
          },
          {
            label: '页面地址',
            value: activeTab.url,
          },
        ],
      });

      const article = await sendMessage<ExtractedArticle>(
        activeTab.id,
        MESSAGE_TYPES.extractActiveArticle,
      );
      await downloadArticle(article);

      renderStatus(
        {
          title: article.title,
          description: 'ZIP 已生成并交给 Chrome 下载。',
          tone: 'success',
          buttonLabel: '重新下载',
          meta: [
            {
              label: '公众号',
              value: article.accountName,
            },
            {
              label: '图片数量',
              value: String(article.assets.length),
            },
          ],
        },
        onDownload,
      );
    } catch (error) {
      renderStatus(
        {
          title: articleState.title || '导出失败',
          description: getErrorMessage(error),
          tone: 'error',
          buttonLabel: '重试下载',
          meta: [
            {
              label: '页面地址',
              value: activeTab.url,
            },
          ],
        },
        onDownload,
      );
    }
  };

  renderStatus(
    {
      title: articleState.title || '准备导出',
      description: '正文已识别，可以下载为 Markdown + 本地图片 ZIP。',
      buttonLabel: '下载 ZIP',
      meta: [
        {
          label: '适配器',
          value: articleState.adapter || 'weixin',
        },
        {
          label: '页面地址',
          value: activeTab.url,
        },
      ],
    },
    onDownload,
  );
}

void initialize().catch((error) => {
  renderStatus({
    title: '初始化失败',
    description: getErrorMessage(error),
    tone: 'error',
  });
});
