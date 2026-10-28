import Link from "next/link";

// Draws the data from lib/docs/markdown.js as React elements. Text goes in as plain text children, never as HTML, so a docs page cannot run a script.
function Inline({ pieces }) {
  return pieces.map((piece, index) => {
    switch (piece.type) {
      case "code": return <code key={index} className="rounded bg-sunken px-1 py-0.5 font-mono text-[0.85em] text-ink">{piece.text}</code>;
      case "bold": return <b key={index} className="font-semibold text-ink">{piece.text}</b>;
      case "italic": return <i key={index}>{piece.text}</i>;
      case "link": {
        const look = "font-medium text-accent-text underline-offset-2 hover:underline";
        if (piece.href.startsWith("/") || piece.href.startsWith("#")) return <Link key={index} href={piece.href} className={look}>{piece.text}</Link>;
        return <a key={index} href={piece.href} target="_blank" rel="noopener noreferrer" className={look}>{piece.text}</a>;
      }
      default: return piece.text;
    }
  });
}

const body = "text-[15px] leading-relaxed text-mute";

export default function Markdown({ blocks }) {
  return blocks.map((block, index) => {
    switch (block.type) {
      case "heading": {
        const Tag = block.level === 2 ? "h2" : "h3";
        const size = block.level === 2 ? "mt-10 text-xl" : "mt-6 text-base";
        return <Tag key={index} id={block.id} className={`${size} scroll-mt-20 font-semibold tracking-tight text-ink`}><Inline pieces={block.inline} /></Tag>;
      }
      case "paragraph": return <p key={index} className={`mt-3 max-w-[68ch] ${body}`}><Inline pieces={block.inline} /></p>;
      case "ul": return <ul key={index} className={`mt-3 max-w-[68ch] list-disc space-y-1.5 pl-5 ${body}`}>{block.items.map((item, i) => <li key={i}><Inline pieces={item} /></li>)}</ul>;
      case "ol": return <ol key={index} className={`mt-3 max-w-[68ch] list-decimal space-y-1.5 pl-5 ${body}`}>{block.items.map((item, i) => <li key={i}><Inline pieces={item} /></li>)}</ol>;
      case "quote": return <blockquote key={index} className={`mt-4 max-w-[68ch] rounded-xl border border-line border-l-4 border-l-accent bg-surface px-4 py-3 ${body}`}><Inline pieces={block.inline} /></blockquote>;
      case "code": return <pre key={index} className="mt-4 max-w-full overflow-x-auto rounded-xl border border-line bg-sunken p-4 font-mono text-[13px] leading-relaxed text-ink"><code>{block.text}</code></pre>;
      case "rule": return <hr key={index} className="mt-8 border-line" />;
      case "table": return (
        <div key={index} className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead className="bg-raised"><tr>{block.head.map((cell, i) => <th key={i} scope="col" className="px-3 py-2 font-semibold text-ink"><Inline pieces={cell} /></th>)}</tr></thead>
            <tbody>{block.rows.map((row, r) => <tr key={r} className="border-t border-line">{row.map((cell, c) => <td key={c} className="px-3 py-2 align-top text-mute"><Inline pieces={cell} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      default: return null;
    }
  });
}
