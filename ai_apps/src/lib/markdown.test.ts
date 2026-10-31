import { describe, expect, it } from "vitest";
import {
  parseInline,
  parseMarkdown,
  safeMarkdownHref,
  type InlineNode,
} from "./markdown";

function flattenText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text" || node.type === "code") {
        return node.value;
      }
      return flattenText(node.children);
    })
    .join("");
}

describe("parseInline", () => {
  it("returns plain text with newlines intact", () => {
    expect(parseInline("First line\nSecond line")).toEqual([
      { type: "text", value: "First line\nSecond line" },
    ]);
  });

  it("parses bold, italics, code, and strikethrough", () => {
    const nodes = parseInline(
      "Use **bold**, *italic*, `inlineCode`, and ~~old~~.",
    );
    expect(nodes).toContainEqual({
      type: "strong",
      children: [{ type: "text", value: "bold" }],
    });
    expect(nodes).toContainEqual({
      type: "emphasis",
      children: [{ type: "text", value: "italic" }],
    });
    expect(nodes).toContainEqual({ type: "code", value: "inlineCode" });
    expect(nodes).toContainEqual({
      type: "delete",
      children: [{ type: "text", value: "old" }],
    });
    expect(flattenText(nodes)).toBe(
      "Use bold, italic, inlineCode, and old.",
    );
  });

  it("parses nested emphasis without leaving asterisks", () => {
    const nodes = parseInline("**bold with *inner* text**");
    expect(flattenText(nodes)).toBe("bold with inner text");
    expect(nodes[0]).toMatchObject({ type: "strong" });
  });

  it("turns safe links into link nodes", () => {
    const nodes = parseInline("See [the docs](https://example.com/guide).");
    expect(nodes).toContainEqual({
      type: "link",
      href: "https://example.com/guide",
      children: [{ type: "text", value: "the docs" }],
    });
    expect(flattenText(nodes)).toBe("See the docs.");
  });

  it("does not make unsafe protocols into links", () => {
    const nodes = parseInline("[click](javascript:alert(1))");
    expect(nodes.some((node) => node.type === "link")).toBe(false);
    expect(flattenText(nodes)).toBe("[click](javascript:alert(1))");
  });

  it("leaves raw HTML and snake_case text alone", () => {
    const nodes = parseInline("<script>alert(1)</script> snake_case_name");
    expect(nodes).toEqual([
      { type: "text", value: "<script>alert(1)</script> snake_case_name" },
    ]);
  });
});

describe("safeMarkdownHref", () => {
  it("accepts http, https, and mailto", () => {
    expect(safeMarkdownHref("https://example.com")).toBe("https://example.com");
    expect(safeMarkdownHref("http://example.com")).toBe("http://example.com");
    expect(safeMarkdownHref("mailto:hi@example.com")).toBe(
      "mailto:hi@example.com",
    );
  });

  it("rejects script and data URLs", () => {
    expect(safeMarkdownHref("javascript:alert(1)")).toBeNull();
    expect(safeMarkdownHref("data:text/html,<script>alert(1)</script>")).toBeNull();
  });
});

describe("parseMarkdown", () => {
  it("parses headings, paragraphs, lists, quotes, and rules", () => {
    const blocks = parseMarkdown(
      [
        "## A heading",
        "",
        "A paragraph with **bold**.",
        "",
        "- first",
        "- second",
        "",
        "1. one",
        "2. two",
        "",
        "> quoted text",
        "",
        "---",
      ].join("\n"),
    );

    expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
    expect(blocks[2]).toMatchObject({
      type: "list",
      ordered: false,
      items: [
        [{ type: "text", value: "first" }],
        [{ type: "text", value: "second" }],
      ],
    });
    expect(blocks[3]).toMatchObject({ type: "list", ordered: true, start: 1 });
    expect(blocks[4]).toMatchObject({ type: "blockquote" });
    expect(blocks[5]).toEqual({ type: "rule" });
  });

  it("allows blank lines between items in one list", () => {
    const blocks = parseMarkdown("- first\n\n- second\n\n- third");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "list" });
    if (blocks[0].type === "list") {
      expect(blocks[0].items).toHaveLength(3);
    }
  });

  it("preserves paragraph line breaks", () => {
    const blocks = parseMarkdown("First line\nSecond line");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", value: "First line\nSecond line" }],
      },
    ]);
  });

  it("returns no blocks for empty content", () => {
    expect(parseMarkdown("")).toEqual([]);
  });
});
