import { afterEach, describe, expect, it } from "vitest";
import { applyPageAdapter } from "../src/content/adapters";
import { applyPlayerDom, clearPlayerDom } from "../src/content/adapters/player";
import {
  applySidebar,
  clearSidebar,
} from "../src/content/adapters/sidebar";
import { pageFixture } from "./fixtures";
import type { PageKind } from "../src/content/types";

const KINDS: PageKind[] = [
  "home",
  "search",
  "playlist",
  "album",
  "artist",
  "daily-mix",
  "liked-songs",
  "unknown",
];

describe("page adapters", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it.each(KINDS)("marks the %s page surface without throwing", (kind) => {
    document.body.innerHTML = pageFixture(kind);
    applyPageAdapter(document, kind);
    const surface = document.querySelector("[data-spotamp-surface]");
    if (kind === "unknown") {
      expect(surface).toBeNull();
    } else {
      expect(surface?.getAttribute("data-spotamp-surface")).toBe(kind);
    }
  });

  it("replaces annotations instead of accumulating them", () => {
    document.body.innerHTML = pageFixture("playlist");
    document.querySelector("main")!.insertAdjacentHTML(
      "afterbegin",
      '<section data-testid="album-page"></section>',
    );
    applyPageAdapter(document, "playlist");
    applyPageAdapter(document, "album");
    const surfaces = document.querySelectorAll("[data-spotamp-surface]");
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]?.getAttribute("data-spotamp-surface")).toBe("album");
  });
});

describe("sidebar and player adapters", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("tags real sidebar links and rows", () => {
    document.body.innerHTML = pageFixture("playlist");
    applySidebar(document);
    expect(document.querySelectorAll("[data-spotamp-sidebar-row]").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-spotamp-sidebar-link]").length).toBe(2);
    clearSidebar(document);
    expect(document.querySelector("[data-spotamp-sidebar-row]")).toBeNull();
  });

  it("hides duplicate transport but preserves utility buttons", () => {
    document.body.innerHTML = pageFixture("playlist");
    const bar = applyPlayerDom(document);
    expect(bar).toBeTruthy();
    expect(
      document.querySelector('[data-testid="player-controls"]')?.getAttribute("data-spotamp-hide"),
    ).toBe("transport");
    expect(
      document.querySelector('[data-testid="volume-bar"]')?.getAttribute("data-spotamp-hide"),
    ).toBe("volume");
    expect(
      document.querySelector('[data-testid="control-button-queue"]')?.getAttribute("data-spotamp-utility"),
    ).toBe("utility");
    expect(
      document.querySelector('[data-spotamp-player="rail"]'),
    ).toBeTruthy();

    clearPlayerDom(document);
    expect(document.querySelector("[data-spotamp-hide]")).toBeNull();
    expect(document.querySelector("[data-spotamp-utility]")).toBeNull();
    expect(document.querySelector("[data-spotamp-player]")).toBeNull();
  });
});
