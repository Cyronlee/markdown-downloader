import type {
  ActiveArticleState,
  ArticleAsset,
  ExtractedArticle,
} from '../../shared/types';
import {
  fnv1a,
  inferImageExtension,
  isWeixinArticleUrl,
  normalizeText,
  resolveAbsoluteUrl,
} from '../../shared/utils';
import type { WebsiteAdapter } from './types';

const REMOVAL_SELECTORS = [
  'script',
  'style',
  'iframe',
  'noscript',
  'template',
  'span[data-lark-record-data]',
  'span[data-lark-record-format="docx/record"]',
  '#js_pc_qr_code',
  '#js_pc_qr_code_img',
  '.original_primary_card_tips',
  '.wx_profile_card_inner',
  '.wx_profile_msg_inner',
  '.weapp_display_element',
  '.weapp_card',
  '.appmsg_card_context',
  '.js_product_container',
  '.js_product_loop_content',
  '.js_banner_container',
  '.js_list_container',
  '.js_cover',
  '.js_editor_audio',
  '.js_editor_qqmusic',
  '.js_editor_mpcpslink',
  '.qqmusic_iframe',
  '.vote_area',
  '.vote_iframe',
  '.mp_vote_iframe_wrp',
  '.mp_vote_iframe',
  '.mp_profile_iframe_wrp',
  '.mp_profile_iframe',
  '.mp_search_iframe_wrp',
  '.appmsg_search_iframe_wrp',
  '.appmsg_search_iframe',
  '.mp-cpslink-iframe-wrp',
  '.mp_common_sticker_iframe',
  '.mp_common_sticker_iframe_wrp',
  '.mp_common_product_iframe',
  '.mp_common_product_iframe_wrp',
  '.mp_lottery_iframe_wrp',
  '.mp_shopprofile_wrp',
  '.new_cps_iframe',
  '.redpackage_iframe',
  '.mp_redpacket_iframe_wrp',
  '.clmusic_iframe',
  '.clalbum_iframe',
  '.mp_common_custom_iframe_wrp',
  '.mp_common_custom_iframe',
].join(',');

const PRESERVED_EMPTY_TAGS = new Set([
  'IMG',
  'BR',
  'HR',
  'TH',
  'TD',
]);

function getElementText(
  document: Document,
  selector: string,
): string {
  return normalizeText(document.querySelector(selector)?.textContent);
}

function parseChinaDateText(text: string): string | null {
  const match = text.match(
    /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})(?:日)?(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
  );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? '0');
  const minute = Number(match[5] ?? '0');
  const second = Number(match[6] ?? '0');
  const date = new Date(
    Date.UTC(year, month - 1, day, hour - 8, minute, second),
  );

  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function extractPublishTimeISO(document: Document): string {
  const publishedText = getElementText(document, '#publish_time');
  const parsedPublishedText = parseChinaDateText(publishedText);
  if (parsedPublishedText) {
    return parsedPublishedText;
  }

  for (const script of Array.from(document.scripts)) {
    const match = script.textContent?.match(/var ct = "(\d+)"/);
    if (!match) {
      continue;
    }

    const timestamp = Number(match[1]);
    if (Number.isNaN(timestamp)) {
      continue;
    }

    return new Date(timestamp * 1000).toISOString();
  }

  return '';
}

function unwrapNode(node: Element): void {
  const parent = node.parentNode;
  if (!parent) {
    return;
  }

  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node);
  }

  parent.removeChild(node);
}

function shouldRemoveEmptyNode(node: Element): boolean {
  if (PRESERVED_EMPTY_TAGS.has(node.tagName)) {
    return false;
  }

  const hasText = normalizeText(node.textContent).length > 0;
  const hasMeaningfulChild = Array.from(node.children).some(
    (child) =>
      PRESERVED_EMPTY_TAGS.has(child.tagName) ||
      normalizeText(child.textContent).length > 0,
  );

  return !hasText && !hasMeaningfulChild;
}

function sanitizeAttributes(node: Element): void {
  const keep = new Set<string>();

  if (node.tagName === 'A') {
    keep.add('href');
    keep.add('title');
  } else if (node.tagName === 'IMG') {
    keep.add('src');
    keep.add('alt');
    keep.add('title');
  } else if (node.tagName === 'TD' || node.tagName === 'TH') {
    keep.add('colspan');
    keep.add('rowspan');
  }

  for (const attribute of Array.from(node.attributes)) {
    if (!keep.has(attribute.name)) {
      node.removeAttribute(attribute.name);
    }
  }
}

export function sanitizeWeixinBody(
  sourceBody: Element,
  articleUrl: string,
): { html: string; assets: ArticleAsset[] } {
  const body = sourceBody.cloneNode(true) as HTMLElement;
  const assetsByPath = new Map<string, ArticleAsset>();

  for (const removable of Array.from(body.querySelectorAll(REMOVAL_SELECTORS))) {
    removable.remove();
  }

  for (const link of Array.from(body.querySelectorAll('a'))) {
    const href = normalizeText(link.getAttribute('href'));
    if (!href || href.startsWith('javascript:')) {
      unwrapNode(link);
      continue;
    }

    link.setAttribute('href', resolveAbsoluteUrl(href, articleUrl));
  }

  for (const image of Array.from(body.querySelectorAll('img'))) {
    const rawSource =
      image.getAttribute('data-src') ??
      image.getAttribute('src') ??
      '';
    const sourceUrl = resolveAbsoluteUrl(rawSource, articleUrl);

    if (!sourceUrl) {
      image.remove();
      continue;
    }

    const localPath = `assets/${fnv1a(sourceUrl)}.${inferImageExtension(
      sourceUrl,
      image.getAttribute('data-type'),
    )}`;
    const alt = normalizeText(
      image.getAttribute('alt') ??
        image.getAttribute('data-alt') ??
        image.getAttribute('title'),
    );

    image.setAttribute('src', localPath);
    if (alt) {
      image.setAttribute('alt', alt);
    }

    assetsByPath.set(localPath, {
      sourceUrl,
      localPath,
      alt,
    });
  }

  const elements = Array.from(body.querySelectorAll('*'));
  for (const node of elements) {
    sanitizeAttributes(node);
  }

  for (const node of elements.reverse()) {
    if (shouldRemoveEmptyNode(node)) {
      node.remove();
    }
  }

  return {
    html: body.innerHTML.trim(),
    assets: Array.from(assetsByPath.values()),
  };
}

export function extractWeixinArticle(
  document: Document,
  location: Location,
): ExtractedArticle {
  const body = document.querySelector('#js_content');
  if (!body) {
    throw new Error('当前页面未找到文章正文');
  }

  const title = getElementText(document, '#activity-name');
  const accountName = getElementText(document, '#js_name');
  const authorName =
    getElementText(document, '#js_author_name') || accountName;
  const publishTimeISO = extractPublishTimeISO(document);
  const { html, assets } = sanitizeWeixinBody(body, location.href);

  if (!title) {
    throw new Error('当前页面未找到文章标题');
  }

  return {
    title,
    accountName,
    authorName,
    publishTimeISO,
    url: location.href,
    html,
    assets,
  };
}

export function getWeixinArticleState(
  document: Document,
  url: string,
): ActiveArticleState {
  if (!isWeixinArticleUrl(url)) {
    return {
      supported: false,
      url,
      reason: '当前页面不支持',
    };
  }

  const title = getElementText(document, '#activity-name');
  const body = document.querySelector('#js_content');

  if (!body) {
    return {
      supported: false,
      url,
      reason: '当前页面未找到文章正文',
      title,
    };
  }

  return {
    supported: true,
    url,
    title,
    adapter: 'weixin',
  };
}

export const weixinAdapter: WebsiteAdapter = {
  name: 'weixin',
  matches: isWeixinArticleUrl,
  extract: extractWeixinArticle,
};
