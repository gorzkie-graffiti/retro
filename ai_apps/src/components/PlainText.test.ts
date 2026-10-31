import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlainText } from "./PlainText";

function render(content: string): string {
  return renderToStaticMarkup(createElement(PlainText, { content }));
}

describe("PlainText Markdown rendering", () => {
  it("renders headings, emphasis, lists, and inline code as elements", () => {
    const html = render(
      [
        "## Answer",
        "",
        "This is **important** and uses `code`.",
        "",
        "- one",
        "- two",
      ].join("\n"),
    );

    expect(html).toContain('role="heading"');
    expect(html).toContain('aria-level="2"');
    expect(html).toContain('<strong class="md-strong">important</strong>');
    expect(html).toContain('<code class="md-inline-code">code</code>');
    expect(html).toContain('<ul class="md-list">');
    expect(html).toContain("<li>one</li>");
  });

  it("renders safe external links in a new tab", () => {
    const html = render("Read [the guide](https://example.com/guide).");
    expect(html).toContain('href="https://example.com/guide"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain("the guide");
  });

  it("keeps raw HTML inert and never creates executable markup", () => {
    const html = render(
      '<img src="x" onerror="alert(1)"><script>alert(2)</script>',
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
    // The handler name survives only as escaped text, never as an attribute.
    expect(html).toContain("onerror=&quot;alert(1)&quot;");
  });

  it("does not create an anchor for a javascript URL", () => {
    const html = render("[click](javascript:alert(1))");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("javascript:alert(1)");
  });

  it("keeps fenced code literal and rendered in a pre block", () => {
    const html = render("```html\n<script>alert(1)</script>\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("renders an ordered list starting at its source number", () => {
    const html = render("3. third\n4. fourth");
    expect(html).toContain('<ol class="md-list md-list--ordered" start="3">');
    expect(html).toContain("<li>third</li>");
  });
});
