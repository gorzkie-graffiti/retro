export type InlineNode =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong" | "emphasis" | "delete"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

export type MarkdownBlock =
  | { type: "paragraph"; children: InlineNode[] }
  | {
      type: "heading";
      level: 1 | 2 | 3 | 4 | 5 | 6;
      children: InlineNode[];
    }
  | { type: "list"; ordered: boolean; start: number; items: InlineNode[][] }
  | { type: "blockquote"; blocks: MarkdownBlock[] }
  | { type: "rule" };

const INLINE_SOURCE =
  /`([^`\n]+)`|\*\*([^\n]+?)\*\*|__([^\n]+?)__|~~([^\n]+?)~~|\*([^*\n]+)\*|(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

const HEADING = /^ {0,3}(#{1,6})\s+(.*\S)\s*$/;
const RULE = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const LIST = /^( {0,3})([-+*]|(\d{1,9})[.)])\s+(.*)$/;

interface ListMarker {
  ordered: boolean;
  start: number;
  text: string;
}

/** Only normal web and mail links become anchors; everything else stays text. */
export function safeMarkdownHref(raw: string): string | null {
  const href = raw.trim();
  return /^(?:https?:\/\/|mailto:)/i.test(href) ? href : null;
}

function textNode(value: string): InlineNode {
  return { type: "text", value };
}

/**
 * Parse the inline subset Gemini commonly emits. It produces React nodes only:
 * raw HTML never becomes markup, and unsafe link protocols stay literal text.
 */
export function parseInline(text: string, depth = 0): InlineNode[] {
  if (!text) {
    return [];
  }
  if (depth > 5) {
    return [textNode(text)];
  }

  const nodes: InlineNode[] = [];
  const pattern = new RegExp(INLINE_SOURCE.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(textNode(text.slice(cursor, match.index)));
    }

    const full = match[0];

    if (match[1] !== undefined) {
      nodes.push({ type: "code", value: match[1] });
    } else if (match[2] !== undefined || match[3] !== undefined) {
      const child = match[2] ?? match[3];
      nodes.push({ type: "strong", children: parseInline(child, depth + 1) });
    } else if (match[4] !== undefined) {
      nodes.push({ type: "delete", children: parseInline(match[4], depth + 1) });
    } else if (match[5] !== undefined || match[6] !== undefined) {
      const child = match[5] ?? match[6];
      nodes.push({
        type: "emphasis",
        children: parseInline(child, depth + 1),
      });
    } else if (match[7] !== undefined && match[8] !== undefined) {
      const href = safeMarkdownHref(match[8]);
      if (href) {
        nodes.push({
          type: "link",
          href,
          children: parseInline(match[7], depth + 1),
        });
      } else {
        nodes.push(textNode(full));
      }
    } else {
      nodes.push(textNode(full));
    }

    cursor = match.index + full.length;
  }

  if (cursor < text.length) {
    nodes.push(textNode(text.slice(cursor)));
  }

  return nodes;
}

function listMarker(line: string): ListMarker | null {
  const match = LIST.exec(line);
  if (!match) {
    return null;
  }
  const number = match[3];
  return {
    ordered: number !== undefined,
    start: number !== undefined ? Number.parseInt(number, 10) : 1,
    text: match[4].trim(),
  };
}

function isBlockStart(line: string): boolean {
  return (
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    LIST.test(line)
  );
}

/**
 * Parse the block subset used in normal chat answers. Fenced code is handled
 * separately by splitCodeSegments so it stays literal and can use the existing
 * period-style code panel.
 */
export function parseMarkdown(input: string): MarkdownBlock[] {
  if (!input) {
    return [];
  }

  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: Math.min(6, heading[1].length) as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(heading[2].replace(/\s+#+\s*$/, "")),
      });
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const quote = QUOTE.exec(lines[index]);
        if (!quote) {
          break;
        }
        quoteLines.push(quote[1]);
        index += 1;
      }
      const quoteBlocks = parseMarkdown(quoteLines.join("\n"));
      if (quoteBlocks.length > 0) {
        blocks.push({ type: "blockquote", blocks: quoteBlocks });
      }
      continue;
    }

    const firstMarker = listMarker(line);
    if (firstMarker) {
      const items: InlineNode[][] = [];
      const ordered = firstMarker.ordered;
      const start = firstMarker.start;

      while (index < lines.length) {
        const marker = listMarker(lines[index]);
        if (!marker || marker.ordered !== ordered) {
          break;
        }
        items.push(parseInline(marker.text));
        index += 1;

        // Permit blank lines between items in the same list.
        let lookahead = index;
        while (lookahead < lines.length && !lines[lookahead].trim()) {
          lookahead += 1;
        }
        if (lookahead > index && lookahead < lines.length) {
          const next = listMarker(lines[lookahead]);
          if (next && next.ordered === ordered) {
            index = lookahead;
          }
        }
      }

      blocks.push({ type: "list", ordered, start, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index];
      if (
        !candidate.trim() ||
        (paragraphLines.length > 0 && isBlockStart(candidate))
      ) {
        break;
      }
      paragraphLines.push(candidate.trim());
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: "paragraph",
        children: parseInline(paragraphLines.join("\n")),
      });
    } else {
      // Defensive progress for unexpected input.
      index += 1;
    }
  }

  return blocks;
}
