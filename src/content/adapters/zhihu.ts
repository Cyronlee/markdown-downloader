import type {
  ActiveArticleState,
  ArticleAsset,
  ExtractedArticle,
} from '../../shared/types';
import {
  fnv1a,
  inferImageExtension,
  isZhihuArticleUrl,
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
  '.ContentItem-time',
  '.KfeCollection-AnswerTopCard',
].join(',');

const PRESERVED_EMPTY_TAGS = new Set(['IMG', 'BR', 'HR', 'TH', 'TD']);

function getElementText(document: Document, selector: string): string {
  return normalizeText(document.querySelector(selector)?.textContent);
}

function parsePublishTimeISO(document: Document): string {
  const timeElement = document.querySelector('meta[itemprop="datePublished"]');
  const content = normalizeText(timeElement?.getAttribute('content'));
  if (content) {
    const parsed = new Date(content);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }

  const updatedElement = document.querySelector('meta[itemprop="dateModified"]');
  const updatedContent = normalizeText(updatedElement?.getAttribute('content'));
  if (updatedContent) {
    const parsed = new Date(updatedContent);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
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

export function sanitizeZhihuBody(
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
      image.getAttribute('data-original') ??
      image.getAttribute('data-actualsrc') ??
      image.getAttribute('src') ??
      '';
    const sourceUrl = resolveAbsoluteUrl(rawSource, articleUrl);

    if (!sourceUrl) {
      image.remove();
      continue;
    }

    const localPath = `assets/${fnv1a(sourceUrl)}.${inferImageExtension(sourceUrl)}`;
    const alt = normalizeText(image.getAttribute('alt') ?? image.getAttribute('title'));

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

export function extractZhihuArticle(
  document: Document,
  location: Location,
): ExtractedArticle {
  const body = document.querySelector('.Post-RichTextContainer .RichText.ztext');
  if (!body) {
    throw new Error('当前页面未找到文章正文');
  }

  const title =
    getElementText(document, '.Post-Title') ||
    normalizeText(document.querySelector('meta[property="og:title"]')?.getAttribute('content'));
  const accountName =
    getElementText(document, '.AuthorInfo-name') ||
    normalizeText(document.querySelector('meta[property="article:author"]')?.getAttribute('content'));
  const authorName = accountName;
  const publishTimeISO = parsePublishTimeISO(document);
  const { html, assets } = sanitizeZhihuBody(body, location.href);

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

export function getZhihuArticleState(document: Document, url: string): ActiveArticleState {
  if (!isZhihuArticleUrl(url)) {
    return {
      supported: false,
      url,
      reason: '当前页面不支持',
    };
  }

  const title =
    getElementText(document, '.Post-Title') ||
    normalizeText(document.querySelector('meta[property="og:title"]')?.getAttribute('content'));
  const body = document.querySelector('.Post-RichTextContainer .RichText.ztext');

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
    adapter: 'zhihu',
  };
}

export const zhihuAdapter: WebsiteAdapter = {
  name: 'zhihu',
  matches: isZhihuArticleUrl,
  extract: extractZhihuArticle,
};
