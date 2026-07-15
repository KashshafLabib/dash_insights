import { Fragment, type ReactNode } from "react";

/** Tiny renderer for the chat's **bold** / *italic* markdown. No HTML pass-through. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={`${keyBase}-${i}`}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split(/\n+/).map((line, i) => (
        <p key={i} className="leading-relaxed">
          {renderInline(line, `l${i}`)}
        </p>
      ))}
    </div>
  );
}
