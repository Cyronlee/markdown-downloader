import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
  extractWeixinArticle,
  sanitizeWeixinBody,
} from '../src/content/adapters/weixin';
import { buildMarkdown } from '../src/shared/markdown';

const FIXTURE_PATH = resolve(
  process.cwd(),
  'tests/fixtures/weixin-article.html',
);
const FIXTURE_URL =
  'https://mp.weixin.qq.com/s/vjMG8i7DwQ7R2B1C4AVQdA';

function createDocument(html: string): Document {
  return new JSDOM(html, { url: FIXTURE_URL }).window.document;
}

describe('weixin extractor', () => {
  it('extracts article metadata and assets from the sample fixture', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const article = extractWeixinArticle(document, document.location);

    expect(article.title).toBe(
      'Claude悄悄更新了Skills生成器，这绝对是一次史诗级升级。',
    );
    expect(article.accountName).toBe('数字生命卡兹克');
    expect(article.publishTimeISO).toBe('2026-03-11T02:05:41.000Z');
    expect(article.assets.length).toBeGreaterThan(0);
  });

  it('removes unsupported blocks and noisy attributes during sanitization', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const body = document.querySelector('#js_content');
    if (!(body instanceof document.defaultView!.HTMLElement)) {
      throw new Error('missing body');
    }

    const { html: sanitizedHtml } = sanitizeWeixinBody(
      body,
      FIXTURE_URL,
    );

    expect(sanitizedHtml).not.toContain('data-lark-record-data');
    expect(sanitizedHtml).not.toContain('<script');
    expect(sanitizedHtml).not.toContain('<iframe');
    expect(sanitizedHtml).not.toContain('js_pc_qr_code_img');
  });

  it('builds markdown with frontmatter and local asset paths', () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const document = createDocument(html);
    const article = extractWeixinArticle(document, document.location);
    const { markdown } = buildMarkdown(article);

    expect(markdown).toContain(
      'title: "Claude悄悄更新了Skills生成器，这绝对是一次史诗级升级。"',
    );
    expect(markdown).toContain('account: "数字生命卡兹克"');
    expect(markdown).toMatch(/!\[[^\]]*\]\(assets\/[0-9a-f]{8}\.[a-z0-9]+\)/);
    expect(markdown).not.toContain('<p');
    expect(markdown).not.toContain('<section');
  });
});
