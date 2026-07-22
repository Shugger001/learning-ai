export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Lightweight markdown → HTML for print/PDF windows. */
export function markdownToSimpleHtml(md: string) {
  return escapeHtml(md)
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, (line) =>
      line.startsWith("<") ? line : `<p>${line}</p>`
    );
}

export function printHtmlDocument(title: string, bodyHtml: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(`
    <html><head><title>${escapeHtml(title)}</title>
    <style>
      body{font-family:Georgia,serif;padding:40px;line-height:1.65;color:#111;max-width:720px;margin:0 auto}
      h1,h2,h3{font-family:system-ui,sans-serif;line-height:1.25}
      h1{font-size:1.75rem} h2{font-size:1.25rem;margin-top:1.5em}
      ul,ol{padding-left:1.25rem} li{margin:0.35em 0}
      p{margin:0.75em 0}
      .meta{color:#666;font-size:0.85rem;margin-bottom:1.5rem}
      .q{margin:1.25rem 0;padding-bottom:1rem;border-bottom:1px solid #e5e5e5}
      .answer-key{margin-top:2.5rem;page-break-before:always}
      @media print{.no-print{display:none}}
    </style>
    </head><body>
    ${bodyHtml}
    <script>window.onload=()=>{window.print()}</script>
    </body></html>
  `);
  printWindow.document.close();
}
