import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import createDOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

function sanitize(markdown) {
  const dirty = marked.parse(markdown, { async: false });
  const { window } = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const purify = createDOMPurify(window);
  return purify.sanitize(String(dirty), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
    ALLOW_DATA_ATTR: false,
  });
}

describe('release markdown', () => {
  it('renders GFM tables', () => {
    const html = sanitize(`
| A | B |
| - | - |
| 1 | 2 |
`);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>');
    expect(html).toContain('<td>');
  });

  it('renders images and links', () => {
    const html = sanitize(
      '![shot](https://example.com/a.png)\n\n[docs](https://example.com/docs)',
    );
    expect(html).toMatch(/<img[^>]+src="https:\/\/example\.com\/a\.png"/);
    expect(html).toMatch(/<a[^>]+href="https:\/\/example\.com\/docs"/);
  });

  it('strips script payloads', () => {
    const html = sanitize('hi <script>alert(1)</script>\n\n**ok**');
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html).toContain('<strong>ok</strong>');
  });
});
