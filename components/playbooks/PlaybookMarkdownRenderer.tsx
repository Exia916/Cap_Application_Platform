"use client";

import type { ElementType, ReactNode } from "react";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" };

type Props = {
  content: string;
};

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseMarkdown(content: string): Block[] {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const rows: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        rows.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: "code", text: rows.join("\n") });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (/^([-*_])\1\1+$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(tableCells(lines[i]));
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      const current = lines[i].trim();
      const next = lines[i + 1] || "";
      const startsNewBlock =
        current.startsWith("```") ||
        /^#{1,6}\s+/.test(current) ||
        /^([-*_])\1\1+$/.test(current) ||
        /^>\s?/.test(current) ||
        /^[-*+]\s+/.test(current) ||
        /^\d+\.\s+/.test(current) ||
        (current.includes("|") && isTableSeparator(next));

      if (startsNewBlock && paragraph.length > 0) break;
      if (startsNewBlock) break;

      paragraph.push(current);
      i += 1;
    }

    if (paragraph.length > 0) {
      blocks.push({ type: "p", text: paragraph.join(" ") });
    } else {
      i += 1;
    }
  }

  return blocks;
}

function isSafeHref(href: string) {
  const clean = href.trim().toLowerCase();
  return (
    clean.startsWith("/") ||
    clean.startsWith("#") ||
    clean.startsWith("https://") ||
    clean.startsWith("http://") ||
    clean.startsWith("mailto:")
  );
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));

    const [full, , linkText, href, codeText, boldText, italicText] = match;

    if (linkText && href) {
      const safeHref = isSafeHref(href) ? href.trim() : "#";
      const external = /^https?:\/\//i.test(safeHref);
      out.push(
        <a
          key={`${keyPrefix}-a-${index}`}
          href={safeHref}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
        >
          {linkText}
        </a>
      );
    } else if (codeText) {
      out.push(<code key={`${keyPrefix}-code-${index}`}>{codeText}</code>);
    } else if (boldText) {
      out.push(<strong key={`${keyPrefix}-strong-${index}`}>{boldText}</strong>);
    } else if (italicText) {
      out.push(<em key={`${keyPrefix}-em-${index}`}>{italicText}</em>);
    } else {
      out.push(full);
    }

    last = match.index + full.length;
    index += 1;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

function nextHeadingId(text: string, seen: Map<string, number>) {
  const base = slugify(text) || "section";
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count > 0 ? `${base}-${count + 1}` : base;
}

export default function PlaybookMarkdownRenderer({ content }: Props) {
  const blocks = parseMarkdown(content);
  const headingIds = new Map<string, number>();

  if (!blocks.length) {
    return <div className="text-soft">No article content has been entered yet.</div>;
  }

  return (
    <div className="playbook-markdown">
      <style>{`
        .playbook-markdown {
          color: var(--text);
          font-size: 15px;
          line-height: 1.72;
        }

        .playbook-markdown > *:first-child {
          margin-top: 0;
        }

        .playbook-markdown h1,
        .playbook-markdown h2,
        .playbook-markdown h3,
        .playbook-markdown h4,
        .playbook-markdown h5,
        .playbook-markdown h6 {
          color: var(--text);
          line-height: 1.25;
          margin: 1.35em 0 0.55em;
          scroll-margin-top: 90px;
        }

        .playbook-markdown h1 {
          font-size: 28px;
          letter-spacing: -0.02em;
        }

        .playbook-markdown h2 {
          font-size: 21px;
          padding-top: 4px;
          border-top: 1px solid var(--border);
        }

        .playbook-markdown h3 {
          font-size: 17px;
        }

        .playbook-markdown h4,
        .playbook-markdown h5,
        .playbook-markdown h6 {
          font-size: 15px;
        }

        .playbook-markdown p {
          margin: 0 0 1em;
        }

        .playbook-markdown ul,
        .playbook-markdown ol {
          margin: 0 0 1.1em 1.35em;
          padding: 0;
        }

        .playbook-markdown li {
          margin: 0.32em 0;
          padding-left: 0.15em;
        }

        .playbook-markdown a {
          color: var(--brand-blue);
          font-weight: 700;
          text-decoration: none;
        }

        .playbook-markdown a:hover {
          text-decoration: underline;
        }

        .playbook-markdown code {
          display: inline-block;
          padding: 1px 6px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--accent-soft);
          color: var(--text);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 0.92em;
          line-height: 1.5;
        }

        .playbook-markdown pre {
          overflow-x: auto;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: #111827;
          color: #f9fafb;
          font-size: 13px;
          line-height: 1.6;
          margin: 0 0 1.25em;
        }

        .playbook-markdown pre code {
          display: block;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: inherit;
          font-size: inherit;
          line-height: inherit;
        }

        .playbook-markdown blockquote {
          margin: 0 0 1.1em;
          padding: 10px 14px;
          border-left: 4px solid var(--brand-blue);
          border-radius: 8px;
          background: var(--accent-soft);
          color: var(--text);
        }

        .playbook-markdown hr {
          border: 0;
          border-top: 1px solid var(--border);
          margin: 1.5em 0;
        }

        .playbook-markdown-table-wrap {
          overflow-x: auto;
          margin: 0 0 1.25em;
          border: 1px solid var(--border);
          border-radius: 12px;
        }

        .playbook-markdown table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          background: var(--surface);
        }

        .playbook-markdown th,
        .playbook-markdown td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          text-align: left;
          vertical-align: top;
        }

        .playbook-markdown th {
          font-weight: 800;
          background: var(--accent-soft);
        }

        .playbook-markdown tr:last-child td {
          border-bottom: 0;
        }
      `}</style>

      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const id = nextHeadingId(block.text, headingIds);
          const Heading = `h${block.level}` as ElementType;
          return (
            <Heading key={`h-${index}`} id={id}>
              {inline(block.text, `h-${index}`)}
            </Heading>
          );
        }

        if (block.type === "p") {
          return <p key={`p-${index}`}>{inline(block.text, `p-${index}`)}</p>;
        }

        if (block.type === "ul") {
          return (
            <ul key={`ul-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`ul-${index}-${itemIndex}`}>
                  {inline(item, `ul-${index}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={`ol-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`ol-${index}-${itemIndex}`}>
                  {inline(item, `ol-${index}-${itemIndex}`)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "quote") {
          return <blockquote key={`q-${index}`}>{inline(block.text, `q-${index}`)}</blockquote>;
        }

        if (block.type === "code") {
          return (
            <pre key={`code-${index}`}>
              <code>{block.text}</code>
            </pre>
          );
        }

        if (block.type === "table") {
          return (
            <div key={`table-${index}`} className="playbook-markdown-table-wrap">
              <table>
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th key={`table-${index}-h-${headerIndex}`}>
                        {inline(header, `table-${index}-h-${headerIndex}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`table-${index}-r-${rowIndex}`}>
                      {block.headers.map((_, cellIndex) => (
                        <td key={`table-${index}-r-${rowIndex}-c-${cellIndex}`}>
                          {inline(row[cellIndex] || "", `table-${index}-r-${rowIndex}-c-${cellIndex}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "hr") {
          return <hr key={`hr-${index}`} />;
        }

        return null;
      })}
    </div>
  );
}
