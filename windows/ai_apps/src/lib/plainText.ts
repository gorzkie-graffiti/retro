export interface TextSegment {
  type: "text";
  content: string;
}

export interface CodeSegment {
  type: "code";
  content: string;
  language: string;
}

export type PlainTextSegment = TextSegment | CodeSegment;

/**
 * Split model output into text and fenced code regions. The text regions are
 * parsed by the safe Markdown renderer; code stays literal, and React renders
 * everything as text/elements without injecting model-generated HTML.
 */
export function splitCodeSegments(input: string): PlainTextSegment[] {
  if (!input) {
    return [];
  }

  const lines = input.split("\n");
  const segments: PlainTextSegment[] = [];
  let textBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCode = false;
  let language = "";

  const flushText = () => {
    if (textBuffer.length > 0) {
      segments.push({ type: "text", content: textBuffer.join("\n") });
      textBuffer = [];
    }
  };

  const flushCode = () => {
    segments.push({
      type: "code",
      content: codeBuffer.join("\n").replace(/\n+$/, ""),
      language,
    });
    codeBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
        language = "";
      } else {
        flushText();
        inCode = true;
        language = trimmed.slice(3).trim().slice(0, 24);
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
    } else {
      textBuffer.push(line);
    }
  }

  if (inCode) {
    // An unterminated fence is still shown as code, never dropped.
    flushCode();
  } else {
    flushText();
  }

  return segments;
}
