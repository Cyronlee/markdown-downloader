import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
  extractCsdnArticle,
  sanitizeCsdnBody,
} from '../src/content/adapters/csdn';
import { buildMarkdown } from '../src/shared/markdown';

const FIXTURE_PATH = resolve(
  process.cwd(),
  'tests/fixtures/csdn-article.html',
);
const FIXTURE_URL = 'https://blog.csdn.net/coder/article/details/123456789';

function createDocument(html: string): Document {
  return new JSDOM(html, { url: FIXTURE_URL }).window.document;
}

describe('csdn extractor', () => {
  it('extracts article metadata and assets from fixture', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const article = extractCsdnArticle(document, document.location);

    expect(article.title).toBe('CSDN 实战：Markdown 导出');
    expect(article.accountName).toBe('程序员小明');
    expect(article.publishTimeISO).toBe('2024-10-01T10:20:30.000Z');
    expect(article.assets.length).toBe(1);
  });

  it('sanitizes unsupported nodes and preserves absolute links', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const body = document.querySelector('#content_views');
    if (!(body instanceof document.defaultView!.HTMLElement)) {
      throw new Error('missing body');
    }

    const { html: sanitizedHtml } = sanitizeCsdnBody(body, FIXTURE_URL);

    expect(sanitizedHtml).not.toContain('<script');
    expect(sanitizedHtml).not.toContain('recommend-box');
    expect(sanitizedHtml).toContain('href="https://blog.csdn.net/coder/article/details/123456789"');
    expect(sanitizedHtml).not.toContain('javascript:void(0)');
  });

  it('builds markdown with frontmatter and local image paths', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const article = extractCsdnArticle(document, document.location);
    const { markdown } = buildMarkdown(article);

    expect(markdown).toContain('title: "CSDN 实战：Markdown 导出"');
    expect(markdown).toContain('account: "程序员小明"');
    expect(markdown).toMatch(/!\[[^\]]*\]\(assets\/[0-9a-f]{8}\.[a-z0-9]+\)/);
  });
});
