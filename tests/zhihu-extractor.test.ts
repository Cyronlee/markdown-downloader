import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
  extractZhihuArticle,
  sanitizeZhihuBody,
} from '../src/content/adapters/zhihu';
import { buildMarkdown } from '../src/shared/markdown';

const FIXTURE_PATH = resolve(
  process.cwd(),
  'tests/fixtures/zhihu-article.html',
);
const FIXTURE_URL = 'https://zhuanlan.zhihu.com/p/123456';

function createDocument(html: string): Document {
  return new JSDOM(html, { url: FIXTURE_URL }).window.document;
}

describe('zhihu extractor', () => {
  it('extracts article metadata and assets from fixture', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const article = extractZhihuArticle(document, document.location);

    expect(article.title).toBe('如何高效写技术文档');
    expect(article.accountName).toBe('文档小队');
    expect(article.publishTimeISO).toBe('2024-06-01T01:30:00.000Z');
    expect(article.assets.length).toBe(1);
  });

  it('sanitizes unsupported nodes and preserves absolute links', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const body = document.querySelector('.Post-RichTextContainer .RichText.ztext');
    if (!(body instanceof document.defaultView!.HTMLElement)) {
      throw new Error('missing body');
    }

    const { html: sanitizedHtml } = sanitizeZhihuBody(body, FIXTURE_URL);

    expect(sanitizedHtml).not.toContain('<script');
    expect(sanitizedHtml).toContain('href="https://zhuanlan.zhihu.com/p/123456"');
  });

  it('builds markdown with frontmatter and local image paths', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const article = extractZhihuArticle(document, document.location);
    const { markdown } = buildMarkdown(article);

    expect(markdown).toContain('title: "如何高效写技术文档"');
    expect(markdown).toContain('account: "文档小队"');
    expect(markdown).toMatch(/!\[[^\]]*\]\(assets\/[0-9a-f]{8}\.[a-z0-9]+\)/);
  });
});
