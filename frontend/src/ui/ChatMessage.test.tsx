import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChatMessage } from './ChatMessage';

const render = (content: string): string => renderToStaticMarkup(<ChatMessage content={content} />);

describe('chat message formatting', () => {
  it('renders triple-backtick JSON as a labeled code block with a copy button', () => {
    const html = render('```json\n{\n  "voltage": 240,\n  "running": true\n}\n```');
    expect(html).toContain('chat-code-block');
    expect(html).toContain('Copy json code');
    expect(html).toContain('<pre><code class="language-json">');
    expect(html).toContain('  &quot;voltage&quot;: 240,');
    expect(html).not.toContain('```');
  });

  it('preserves code whitespace and treats an unfinished fence as code', () => {
    const html = render('```\n  first line\n    second line');
    expect(html).toContain('Copy text code');
    expect(html).toContain('<pre><code>  first line\n    second line</code></pre>');
  });

  it('formats headings, paragraphs, nested lists, quotes and inline styling', () => {
    const html = render('## Inspection\n\n**Power** and *controls*: use `L1`.\n\n1. First\n   - Nested\n2. Second\n\n> Check the reading.\n\n---');
    for (const tag of ['<h2>', '<strong>', '<em>', '<code>', '<ol>', '<ul>', '<blockquote>', '<hr/>']) {
      expect(html).toContain(tag);
    }
  });

  it('renders tables, checklists and strikethrough', () => {
    const html = render('| Point | Volts |\n| --- | ---: |\n| L1 | 240 |\n\n- [x] Checked\n- [ ] Pending\n\n~~Old reading~~');
    expect(html).toContain('chat-table-scroll');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Point</th>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<del>Old reading</del>');
  });

  it('escapes code HTML, skips raw HTML and blocks unsafe link protocols', () => {
    const html = render('```html\n<script>alert(1)</script>\n```\n\n<script>alert(2)</script>\n\n[unsafe](javascript:alert%281%29)\n\n[docs](https://example.com)');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
