import type {
  ActiveArticleState,
  ExtractedArticle,
} from '../../shared/types';
import { isWeixinArticleUrl } from '../../shared/utils';
import { getWeixinArticleState, weixinAdapter } from './weixin';
import type { WebsiteAdapter } from './types';

const adapters: WebsiteAdapter[] = [weixinAdapter];

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
