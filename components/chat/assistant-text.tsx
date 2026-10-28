"use client";

import type { ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    nodes.push(
      <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-zinc-900 dark:text-zinc-50">
        {match[1]}
      </strong>,
    );
    last = match.index + match[0].length;
    i += 1;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

export function AssistantText({ text }: { text: string }) {
  const blocks = text
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trimEnd());
        const isList = lines.every((line) => !line || /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line));
        if (isList && lines.some((line) => line.length > 0)) {
          return (
            <ul key={`b-${blockIndex}`} className="space-y-1.5 pl-1">
              {lines
                .filter(Boolean)
                .map((line, lineIndex) => {
                  const content = line.replace(/^([-—*•]|\d+\.)\s+/, "");
                  return (
                    <li key={`b-${blockIndex}-l-${lineIndex}`} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <span>{renderInline(content, `b-${blockIndex}-l-${lineIndex}`)}</span>
                    </li>
                  );
                })}
            </ul>
          );
        }

        return (
          <p key={`b-${blockIndex}`} className="whitespace-pre-wrap">
            {lines.map((line, lineIndex) => (
              <span key={`b-${blockIndex}-p-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line, `b-${blockIndex}-p-${lineIndex}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
