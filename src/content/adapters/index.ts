import type {
  ActiveArticleState,
  ExtractedArticle,
} from '../../shared/types';
import {
  isCsdnArticleUrl,
  isJuejinArticleUrl,
  isWeixinArticleUrl,
  isZhihuArticleUrl,
} from '../../shared/utils';
import { getCsdnArticleState, csdnAdapter } from './csdn';
import { getJuejinArticleState, juejinAdapter } from './juejin';
import { getWeixinArticleState, weixinAdapter } from './weixin';
import { getZhihuArticleState, zhihuAdapter } from './zhihu';
import type { WebsiteAdapter } from './types';

const adapters: WebsiteAdapter[] = [weixinAdapter, zhihuAdapter, juejinAdapter, csdnAdapter];

export function findAdapter(url: string): WebsiteAdapter | undefined {
  return adapters.find((adapter) => adapter.matches(url));
}

export function getActiveArticleState(
  document: Document,
  location: Location,
): ActiveArticleState {
  if (isWeixinArticleUrl(location.href)) {
    return getWeixinArticleState(document, location.href);
  }

  if (isZhihuArticleUrl(location.href)) {
    return getZhihuArticleState(document, location.href);
  }

  if (isJuejinArticleUrl(location.href)) {
    return getJuejinArticleState(document, location.href);
  }

  if (isCsdnArticleUrl(location.href)) {
    return getCsdnArticleState(document, location.href);
  }

  return {
    supported: false,
    url: location.href,
    reason: '当前页面不支持',
  };
}

export function extractActiveArticle(
  document: Document,
  location: Location,
): ExtractedArticle {
  const adapter = findAdapter(location.href);
  if (!adapter) {
    throw new Error('当前页面不支持');
  }

  return adapter.extract(document, location);
}
