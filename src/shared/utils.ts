export const WEIXIN_HOST = 'mp.weixin.qq.com';
export const ZHIHU_HOST = 'zhuanlan.zhihu.com';
export const JUEJIN_HOST = 'juejin.cn';

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function sanitizeFileName(name: string): string {
  const sanitized = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return sanitized || 'article';
}

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function isWeixinArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.host === WEIXIN_HOST &&
      (parsed.pathname === '/s' || parsed.pathname.startsWith('/s/'))
    );
  } catch {
    return false;
  }
}

export function isZhihuArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.host === ZHIHU_HOST &&
      /^\/p\/\d+/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}


export function isJuejinArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.host === JUEJIN_HOST &&
      /^\/post\/[a-zA-Z0-9]+/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export function resolveAbsoluteUrl(
  candidate: string,
  baseUrl: string,
): string {
  if (!candidate) {
    return '';
  }

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return '';
  }
}

export function inferImageExtension(
  sourceUrl: string,
  typeHint?: string | null,
): string {
  const normalizedTypeHint = normalizeText(typeHint).toLowerCase();
  if (normalizedTypeHint) {
    return normalizedTypeHint === 'jpeg' ? 'jpg' : normalizedTypeHint;
  }

  try {
    const url = new URL(sourceUrl);
    const wxFormat = url.searchParams.get('wx_fmt');
    if (wxFormat) {
      return wxFormat === 'jpeg' ? 'jpg' : wxFormat;
    }

    const pathname = url.pathname.split('/').pop() ?? '';
    const extensionMatch = pathname.match(/\.([a-zA-Z0-9]+)$/);
    if (extensionMatch) {
      return extensionMatch[1].toLowerCase();
    }
  } catch {
    return 'jpg';
  }

  return 'jpg';
}

export function escapeYaml(value: string): string {
  return JSON.stringify(value ?? '');
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isSupportedArticleUrl(url: string): boolean {
  return isWeixinArticleUrl(url) || isZhihuArticleUrl(url) || isJuejinArticleUrl(url);
}
