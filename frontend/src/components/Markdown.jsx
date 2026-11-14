import React from "react";

// Gemini responde con Markdown simple (negritas, cursivas y listas).
// Se convierte a elementos de React sin usar HTML crudo, para no inyectar
// contenido del modelo en el DOM.

function inline(text, keyPrefix) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let match;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith("**")) parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function Markdown({ text }) {
  const blocks = [];
  let list = null;

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`list-${blocks.length}`}>
        {list.items.map((item, i) => <li key={i}>{inline(item, `li-${blocks.length}-${i}`)}</li>)}
      </Tag>
    );
    list = null;
  };

  for (const rawLine of String(text || "").split("\n")) {
    const line = rawLine.trim();
    const bullet = line.match(/^[*-]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);

    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet || numbered)[1]);
      continue;
    }
    flushList();
    if (!line) continue;
    if (heading) blocks.push(<h4 key={`h-${blocks.length}`}>{inline(heading[1], `h-${blocks.length}`)}</h4>);
    else blocks.push(<p key={`p-${blocks.length}`}>{inline(line, `p-${blocks.length}`)}</p>);
  }
  flushList();

  return <div className="markdown">{blocks}</div>;
}
