import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
  extractJuejinArticle,
  sanitizeJuejinBody,
} from '../src/content/adapters/juejin';
import { buildMarkdown } from '../src/shared/markdown';

const FIXTURE_PATH = resolve(
  process.cwd(),
  'tests/fixtures/juejin-article.html',
);
const FIXTURE_URL = 'https://juejin.cn/post/7654321098765432100';

function createDocument(html: string): Document {
  return new JSDOM(html, { url: FIXTURE_URL }).window.document;
}

describe('juejin extractor', () => {
  it('extracts article metadata and assets from fixture', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const article = extractJuejinArticle(document, document.location);

    expect(article.title).toBe('前端性能优化实践');
    expect(article.accountName).toBe('性能工程师');
    expect(article.publishTimeISO).toBe('2024-08-15T02:20:00.000Z');
    expect(article.assets.length).toBe(1);
  });

  it('sanitizes unsupported nodes and preserves absolute links', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const body = document.querySelector('.article-content .markdown-body');
    if (!(body instanceof document.defaultView!.HTMLElement)) {
      throw new Error('missing body');
    }

    const { html: sanitizedHtml } = sanitizeJuejinBody(body, FIXTURE_URL);

    expect(sanitizedHtml).not.toContain('<script');
    expect(sanitizedHtml).not.toContain('code-block-extension-header');
    expect(sanitizedHtml).toContain('href="https://juejin.cn/post/7654321098765432100"');
    expect(sanitizedHtml).not.toContain('javascript:void(0)');
  });

  it('builds markdown with frontmatter and local image paths', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const article = extractJuejinArticle(document, document.location);
    const { markdown } = buildMarkdown(article);

    expect(markdown).toContain('title: "前端性能优化实践"');
    expect(markdown).toContain('account: "性能工程师"');
    expect(markdown).toMatch(/!\[[^\]]*\]\(assets\/[0-9a-f]{8}\.[a-z0-9]+\)/);
  });
});
