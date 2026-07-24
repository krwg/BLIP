import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import createDOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

function sanitizeRelease(markdown) {
  const dirty = marked.parse(markdown, { async: false });
  const { window } = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const purify = createDOMPurify(window);
  return purify.sanitize(String(dirty), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
    ALLOW_DATA_ATTR: false,
  });
}

function sanitizeChat(markdown) {
  const dirty = marked.parse(markdown, { async: false });
  const { window } = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const purify = createDOMPurify(window);
  return purify.sanitize(String(dirty), {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'del',
      's',
      'code',
      'pre',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'hr',
      'h1',
      'h2',
      'h3',
      'h4',
    ],
    ALLOWED_ATTR: ['href', 'title', 'rel', 'target'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['img', 'style', 'script', 'iframe'],
  });
}

describe('release markdown', () => {
  it('renders GFM tables', () => {
    const html = sanitizeRelease(`
| A | B |
| - | - |
| 1 | 2 |
`);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>');
    expect(html).toContain('<td>');
  });

  it('renders images and links', () => {
    const html = sanitizeRelease(
      '![shot](https://example.com/a.png)\n\n[docs](https://example.com/docs)',
    );
    expect(html).toMatch(/<img[^>]+src="https:\/\/example\.com\/a\.png"/);
    expect(html).toMatch(/<a[^>]+href="https:\/\/example\.com\/docs"/);
  });

  it('strips script payloads', () => {
    const html = sanitizeRelease('hi <script>alert(1)</script>\n\n**ok**');
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html).toContain('<strong>ok</strong>');
  });
});

describe('chat markdown', () => {
  it('keeps basic formatting', () => {
    const html = sanitizeChat('**bold** and `code`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('strips images and scripts', () => {
    const html = sanitizeChat('x ![x](https://example.com/a.png) <script>1</script>');
    expect(html.toLowerCase()).not.toContain('<img');
    expect(html.toLowerCase()).not.toContain('<script');
  });
});
