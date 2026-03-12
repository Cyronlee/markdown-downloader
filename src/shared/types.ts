export interface ArticleAsset {
  sourceUrl: string;
  localPath: string;
  alt: string;
}

export interface ExtractedArticle {
  title: string;
  accountName: string;
  authorName: string;
  publishTimeISO: string;
  url: string;
  html: string;
  assets: ArticleAsset[];
}

export interface DownloadAsset extends ArticleAsset {}

export interface ActiveArticleState {
  supported: boolean;
  url: string;
  title?: string;
  reason?: string;
  adapter?: string;
}

export const MESSAGE_TYPES = {
  getActiveArticleState: 'GET_ACTIVE_ARTICLE_STATE',
  extractActiveArticle: 'EXTRACT_ACTIVE_ARTICLE',
} as const;

export type MessageType =
  (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export interface RuntimeMessage {
  type: MessageType;
}

export interface RuntimeSuccessResponse<T> {
  ok: true;
  data: T;
}

export interface RuntimeErrorResponse {
  ok: false;
  error: string;
}

export type RuntimeResponse<T> =
  | RuntimeSuccessResponse<T>
  | RuntimeErrorResponse;
