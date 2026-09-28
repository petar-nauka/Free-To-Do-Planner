import React from "react";

import { cn } from "@/lib/utils";
import { URL_REGEX, normalizeHref, stripTrailingPunctuation } from "@/lib/linkify";

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

// Правилата за разпознаване на адреси живеят в `lib/linkify.ts` — същите се
// ползват и от клетките на таблиците, за да не се разминават двете места.

export function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    const cleaned = stripTrailingPunctuation(raw);
    const href = normalizeHref(cleaned);

    // Only allow http(s) links.
    if (/^https?:\/\//i.test(href)) {
      parts.push(
        <a
          key={`url-${index}-${href}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-primary hover:opacity-80"
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {cleaned}
        </a>,
      );
    } else {
      parts.push(cleaned);
    }

    // Preserve any stripped punctuation as plain text
    const trailing = raw.slice(cleaned.length);
    if (trailing) parts.push(trailing);

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={cn(className)}>{parts}</span>;
}
