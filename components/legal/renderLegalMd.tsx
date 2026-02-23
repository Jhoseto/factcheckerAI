import React from 'react';

/**
 * Minimal markdown-like render for legal docs: ## h2, ### h3, **bold**, paragraphs.
 */
export function renderLegalMd(md: string): React.ReactNode[] {
  const lines = md.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    i++;

    if (trimmed.startsWith('### ')) {
      out.push(
        <h3 key={i} className="text-sm font-black text-[#968B74] mt-6 mb-2 uppercase tracking-wide">
          {trimmed.slice(4)}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      out.push(
        <h2 key={i} className="text-base font-black text-[#C4B091] mt-8 mb-3 uppercase tracking-wide border-b border-[#968B74]/30 pb-2">
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      out.push(
        <h1 key={i} className="text-xl font-black text-bronze-gradient mb-6 uppercase tracking-wide">
          {trimmed.slice(2)}
        </h1>
      );
      continue;
    }
    if (!trimmed || trimmed === '---') {
      continue;
    }
    // Paragraph: collect until empty line or next heading
    const paraLines: string[] = [trimmed];
    while (i < lines.length) {
      const next = lines[i];
      if (next.trim().startsWith('#') || next.trim() === '') break;
      paraLines.push(next.trim());
      i++;
    }
    const text = paraLines.map((l) => l.replace(/^- /, '• ')).join(' ');
    const withBold = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out.push(
      <p
        key={i}
        className="text-[#ddd] text-sm leading-relaxed mb-4"
        dangerouslySetInnerHTML={{ __html: withBold }}
      />
    );
  }
  return out;
}
