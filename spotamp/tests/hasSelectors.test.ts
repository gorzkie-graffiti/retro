import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HAS_MARKER_ATTRIBUTE,
  HasSelectorRuntime,
  supportsNativeHas,
  transformHasSelectors,
} from "../src/content/compat/hasSelectors";

function markers(element: Element | null): string {
  return element?.getAttribute(HAS_MARKER_ATTRIBUTE) ?? "";
}

describe("supportsNativeHas", () => {
  it("returns false when CSS.supports is unavailable", () => {
    const win = { CSS: undefined } as unknown as Window;
    expect(supportsNativeHas(win)).toBe(false);
  });

  it("asks CSS.supports about :has()", () => {
    const supports = vi.fn(() => true);
    const win = { CSS: { supports } } as unknown as Window;
    expect(supportsNativeHas(win)).toBe(true);
    expect(supports).toHaveBeenCalledWith("selector(:has(*))");
  });

  it("reports false when CSS.supports throws", () => {
    const win = {
      CSS: {
        supports: () => {
          throw new Error("unsupported");
        },
      },
    } as unknown as Window;
    expect(supportsNativeHas(win)).toBe(false);
  });
});

describe("transformHasSelectors", () => {
  it("returns the input untouched when there is no :has()", () => {
    const css = ".a { color: red; }";
    expect(transformHasSelectors(css)).toEqual({
      cssText: css,
      rules: [],
      changed: false,
    });
  });

  it("rewrites every :has() with a marker attribute", () => {
    const css = [
      ".card:has(> img) { color: red; }",
      '.row:not(:has(a[aria-current="true"])) { display: none; }',
      ".grid:has([data-a], [data-b]) { padding: 0; }",
    ].join("\n");

    const result = transformHasSelectors(css);

    expect(result.changed).toBe(true);
    expect(result.cssText).not.toMatch(/:has\(/i);
    expect(result.cssText).toContain('.card[data-spotamp-has~="h0"]');
    expect(result.cssText).toContain('.row:not([data-spotamp-has~="h1"])');
    expect(result.cssText).toContain('.grid[data-spotamp-has~="h2"]');
    expect(result.rules).toEqual([
      { id: "h0", relatives: ["> img"] },
      { id: "h1", relatives: ['a[aria-current="true"]'] },
      { id: "h2", relatives: ["[data-a]", "[data-b]"] },
    ]);
  });

  it("reuses one id for identical :has() arguments", () => {
    const result = transformHasSelectors(
      ".a:has(img) .b:has(img) .c:has(> img)",
    );
    expect(result.rules).toHaveLength(2);
    expect(result.cssText).toBe(
      '.a[data-spotamp-has~="h0"] .b[data-spotamp-has~="h0"] .c[data-spotamp-has~="h1"]',
    );
  });

  it("ignores :has() inside comments and strings", () => {
    const css = [
      "/* .a:has(img) is unsupported */",
      '.b::before { content: ":has(img)"; }',
      ".c:has(img) { color: red; }",
    ].join("\n");
    const result = transformHasSelectors(css);
    expect(result.cssText).toContain("/* .a:has(img) is unsupported */");
    expect(result.cssText).toContain('content: ":has(img)"');
    expect(result.cssText).toContain('.c[data-spotamp-has~="h0"]');
    expect(result.rules).toHaveLength(1);
  });
});

describe("HasSelectorRuntime", () => {
  beforeEach(() => {
    document.documentElement.innerHTML =
      "<head></head><body></body>";
  });

  it("marks ancestors for descendant, child and sibling relations", async () => {
    document.body.innerHTML = `
      <div id="nav"><a aria-current="true">Home</a></div>
      <div id="shortcut"><a href="#"><img data-testid="shortcut-image" /></a></div>
      <div id="direct"><img /></div>
      <div id="row"><span></span><b data-testid="play"></b></div>
    `;

    const transform = transformHasSelectors(
      [
        '#nav:has(a[aria-current="true"])',
        '#shortcut:has(> a [data-testid="shortcut-image"])',
        "#direct:has(> img)",
        '#row:has([data-testid="play"])',
      ].join(","),
    );

    const runtime = new HasSelectorRuntime(
      document,
      window,
      transform.rules,
    );
    runtime.start();

    expect(markers(document.getElementById("nav"))).toBe("h0");
    expect(markers(document.getElementById("shortcut"))).toBe("h1");
    expect(markers(document.getElementById("direct"))).toBe("h2");
    expect(markers(document.getElementById("row"))).toBe("h3");

    runtime.stop();
    for (const id of ["nav", "shortcut", "direct", "row"]) {
      expect(document.getElementById(id)?.hasAttribute(HAS_MARKER_ATTRIBUTE)).toBe(
        false,
      );
    }
    expect(markers(document.body)).toBe("");
  });

  it("refreshes markers when the DOM changes", async () => {
    document.body.innerHTML =
      '<div id="wrap"><div id="target"><img /></div></div>';
    const transform = transformHasSelectors("#wrap:has(> div > img)");
    const runtime = new HasSelectorRuntime(document, window, transform.rules);

    runtime.start();
    expect(markers(document.getElementById("wrap"))).toBe("h0");

    document.querySelector("img")?.remove();
    runtime.refresh();
    expect(markers(document.getElementById("wrap"))).toBe("");

    const image = document.createElement("img");
    document.getElementById("target")?.appendChild(image);
    runtime.refresh();
    expect(markers(document.getElementById("wrap"))).toBe("h0");

    runtime.stop();
  });

  it("does nothing when there are no transformed rules", () => {
    const runtime = new HasSelectorRuntime(document, window, []);
    runtime.start();
    expect(document.documentElement.hasAttribute(HAS_MARKER_ATTRIBUTE)).toBe(
      false,
    );
    runtime.stop();
  });
});
