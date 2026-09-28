import type { Note } from '@/hooks/useNotes';

function htmlToMarkdown(html: string): string {
  let md = html;
  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  // Bold / italic / underline / strike
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<u>(.*?)<\/u>/gi, '$1');
  md = md.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
  md = md.replace(/<del>(.*?)<\/del>/gi, '~~$1~~');
  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  // Lists - process ordered lists first
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let i = 0;
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, content: string) => {
      i++;
      return `${i}. ${content.trim()}\n`;
    }) + '\n';
  });
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, content: string) => {
      return `- ${content.trim()}\n`;
    }) + '\n';
  });
  // Paragraphs and breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  // Remove remaining tags
  md = md.replace(/<[^>]+>/g, '');
  // Decode entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&nbsp;/g, ' ');
  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

export function exportNoteAsMarkdown(note: Note): void {
  const md = `# ${note.title}\n\n${htmlToMarkdown(note.content || '')}`;
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title.replace(/[^a-zA-Z0-9а-яА-Я\s-]/g, '').trim() || 'note'}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportNoteAsPDF(note: Note): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Please allow popups to export PDF');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${note.title}</title>
      <style>
        * { box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          color: #1a1a1a;
          line-height: 1.6;
        }
        h1 { 
          color: #6366f1; 
          border-bottom: 3px solid #6366f1;
          padding-bottom: 10px;
          margin-bottom: 24px;
        }
        h2 { color: #4f46e5; margin-top: 24px; }
        h3 { color: #6b7280; }
        ul, ol { padding-left: 24px; }
        li { margin: 4px 0; }
        p { margin: 8px 0; }
        mark { background: #fef08a; padding: 0 2px; border-radius: 2px; }
        a { color: #6366f1; }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <h1>${note.title}</h1>
      ${note.content || '<p><em>Празна бележка</em></p>'}
      <script>
        window.onload = () => {
          window.print();
          window.onafterprint = () => window.close();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
