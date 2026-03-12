import {
  MESSAGE_TYPES,
  type ActiveArticleState,
  type ExtractedArticle,
  type RuntimeMessage,
  type RuntimeResponse,
} from '../shared/types';
import { getErrorMessage } from '../shared/utils';
import {
  extractActiveArticle,
  getActiveArticleState,
} from './adapters';

function respondWith<T>(
  sendResponse: (response: RuntimeResponse<T>) => void,
  handler: () => T,
): void {
  try {
    sendResponse({
      ok: true,
      data: handler(),
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error: getErrorMessage(error),
    });
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeMessage,
    _sender,
    sendResponse: (
      response:
        | RuntimeResponse<ActiveArticleState>
        | RuntimeResponse<ExtractedArticle>,
    ) => void,
  ) => {
    switch (message.type) {
      case MESSAGE_TYPES.getActiveArticleState:
        respondWith(sendResponse, () =>
          getActiveArticleState(document, window.location),
        );
        return false;
      case MESSAGE_TYPES.extractActiveArticle:
        respondWith(sendResponse, () =>
          extractActiveArticle(document, window.location),
        );
        return false;
      default:
        return false;
    }
  },
);
