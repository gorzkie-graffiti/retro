import { describe, expect, it } from "vitest";
import { splitCodeSegments } from "./plainText";

describe("splitCodeSegments", () => {
  it("preserves ordinary text and line breaks as text", () => {
    const input = "First line\nSecond line\n\nThird line";
    expect(splitCodeSegments(input)).toEqual([
      { type: "text", content: input },
    ]);
  });

  it("extracts a fenced code block and keeps surrounding text", () => {
    const input = "Intro\n```ts\nconst x = 1;\n```\nDONE";
    expect(splitCodeSegments(input)).toEqual([
      { type: "text", content: "Intro" },
      { type: "code", content: "const x = 1;", language: "ts" },
      { type: "text", content: "DONE" },
    ]);
  });

  it("keeps an unterminated code fence rather than dropping content", () => {
    expect(splitCodeSegments("Look:\n```\nfoo()")).toEqual([
      { type: "text", content: "Look:" },
      { type: "code", content: "foo()", language: "" },
    ]);
  });

  it("leaves HTML and Markdown in the text segment for the safe renderer", () => {
    const input = "<script>alert('xss')</script> **bold**";
    const segments = splitCodeSegments(input);
    expect(segments).toEqual([{ type: "text", content: input }]);
  });

  it("returns no segments for empty content", () => {
    expect(splitCodeSegments("")).toEqual([]);
  });
});
