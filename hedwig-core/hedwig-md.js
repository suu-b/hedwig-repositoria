/**
 * hedwig-md.js
 * Lightweight Markdown parser for Hedwig.
 * Handles: headings, bold, italic, code, blockquote, lists, hr, tables, links, images.
 * No dependencies. Inline only for bundle simplicity.
 */

const HedwigMD = (function () {

  function escape(html) {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseInline(text) {
    // Bold+italic
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_\n]+?)_/g, '<em>$1</em>');
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Link
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Image
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;">');
    // Strikethrough
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    return text;
  }

  function parseTable(lines) {
    if (lines.length < 2) return null;
    const headerLine = lines[0];
    const sepLine = lines[1];
    if (!sepLine.match(/^\|?[\s\-|:]+\|?$/)) return null;

    const parseRow = (line) => {
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|');
      return cells.map(c => c.trim());
    };

    const headers = parseRow(headerLine);
    const rows = lines.slice(2).map(parseRow);

    let html = '<table><thead><tr>';
    html += headers.map(h => `<th>${parseInline(h)}</th>`).join('');
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>' + row.map(c => `<td>${parseInline(c)}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function parse(markdown) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const output = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Blank line
      if (line.trim() === '') { i++; continue; }

      // Fenced code block
      if (line.match(/^```/)) {
        const lang = line.slice(3).trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].match(/^```/)) {
          codeLines.push(escape(lines[i]));
          i++;
        }
        i++;
        output.push(`<pre><code class="language-${lang}">${codeLines.join('\n')}</code></pre>`);
        continue;
      }

      // Headings
      const hm = line.match(/^(#{1,6})\s+(.+)/);
      if (hm) {
        const level = hm[1].length;
        const id = hm[2].toLowerCase().replace(/[^a-z0-9]+/g, '-');
        output.push(`<h${level} id="${id}">${parseInline(hm[2])}</h${level}>`);
        i++; continue;
      }

      // HR
      if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
        output.push('<hr>');
        i++; continue;
      }

      // Blockquote
      if (line.startsWith('>')) {
        const bqLines = [];
        while (i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === '')) {
          bqLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        const inner = parse(bqLines.join('\n'));
        output.push(`<blockquote>${inner}</blockquote>`);
        continue;
      }

      // Unordered list
      if (line.match(/^(\s*[-*+]\s)/)) {
        const listLines = [];
        const baseIndent = line.match(/^(\s*)/)[1].length;
        while (i < lines.length && (lines[i].match(/^\s*[-*+]\s/) || (lines[i].trim() === '' && i + 1 < lines.length && lines[i+1].match(/^\s*[-*+]\s/)))) {
          if (lines[i].trim() !== '') listLines.push(lines[i]);
          i++;
        }
        let html = '<ul>';
        listLines.forEach(l => {
          const content = l.replace(/^\s*[-*+]\s/, '');
          html += `<li>${parseInline(content)}</li>`;
        });
        html += '</ul>';
        output.push(html);
        continue;
      }

      // Ordered list
      if (line.match(/^\s*\d+\.\s/)) {
        const listLines = [];
        while (i < lines.length && lines[i].match(/^\s*\d+\.\s/)) {
          listLines.push(lines[i]);
          i++;
        }
        let html = '<ol>';
        listLines.forEach(l => {
          const content = l.replace(/^\s*\d+\.\s/, '');
          html += `<li>${parseInline(content)}</li>`;
        });
        html += '</ol>';
        output.push(html);
        continue;
      }

      // Table
      if (line.startsWith('|') || (lines[i+1] && lines[i+1].match(/^\|?[\s\-|:]+\|?$/))) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim() !== '') {
          tableLines.push(lines[i]);
          i++;
        }
        const tableHtml = parseTable(tableLines);
        if (tableHtml) { output.push(tableHtml); continue; }
        // Not a table, fall through to paragraph
        output.push(`<p>${parseInline(tableLines.join(' '))}</p>`);
        continue;
      }

      // Paragraph (collect until blank line)
      const paraLines = [];
      while (i < lines.length && lines[i].trim() !== '' &&
             !lines[i].match(/^#{1,6}\s/) &&
             !lines[i].startsWith('>') &&
             !lines[i].match(/^(-{3,}|\*{3,}|_{3,})$/) &&
             !lines[i].match(/^\s*[-*+]\s/) &&
             !lines[i].match(/^\s*\d+\.\s/) &&
             !lines[i].match(/^```/)) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length) {
        output.push(`<p>${parseInline(paraLines.join(' '))}</p>`);
      }
    }

    return output.join('\n');
  }

  return { parse };
})();

window.HedwigMD = HedwigMD;
