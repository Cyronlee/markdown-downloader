import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

import type { DownloadAsset, ExtractedArticle } from './types';
import { escapeYaml } from './utils';

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    headingStyle: 'atx',
    hr: '---',
  });

  service.use(gfm);

  service.addRule('section', {
    filter: ['section', 'div', 'article'],
    replacement(content) {
      const trimmed = content.trim();
      return trimmed ? `\n\n${trimmed}\n\n` : '';
    },
  });

  service.addRule('span', {
    filter(node) {
      return node.nodeName === 'SPAN' || node.nodeName === 'FONT';
    },
    replacement(content) {
      return content;
    },
  });

  service.addRule('emptyLinks', {
    filter(node) {
      return node.nodeName === 'A' &&
        !(node as HTMLAnchorElement).getAttribute('href');
    },
    replacement(content) {
      return content;
    },
  });

  return service;
}

function buildFrontmatter(article: ExtractedArticle): string {
  return [
    '---',
    `title: ${escapeYaml(article.title)}`,
    `author: ${escapeYaml(article.authorName)}`,
    `account: ${escapeYaml(article.accountName)}`,
    `date: ${escapeYaml(article.publishTimeISO)}`,
    `source: ${escapeYaml(article.url)}`,
    '---',
  ].join('\n');
}

export function buildMarkdown(
  article: ExtractedArticle,
): { markdown: string; assets: DownloadAsset[] } {
  const parser = new DOMParser();
  const document = parser.parseFromString(
    `<body>${article.html}</body>`,
    'text/html',
  );
  const body = document.body;
  const turndownService = createTurndownService();
  const bodyMarkdown = turndownService.turndown(body.innerHTML).trim();
  const frontmatter = buildFrontmatter(article);
  const markdown = `${frontmatter}\n\n${bodyMarkdown}\n`;

  return {
    markdown,
    assets: article.assets.map((asset) => ({ ...asset })),
  };
}
