import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryWindow } from "../src/content/ui/libraryWindow";
import { pageFixture } from "./fixtures";

describe("Spotamp library window", () => {
  let windowUi: LibraryWindow;
  let onSearch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = pageFixture("playlist");
    onSearch = vi.fn();
    windowUi = new LibraryWindow({
      doc: document,
      win: window,
      onSearch,
    });
    windowUi.update("/playlist/abc", "Playlist");
  });

  afterEach(() => {
    windowUi.destroy();
    document.body.innerHTML = "";
  });

  it("uses Webamp's generic-window chrome and skin title glyphs", () => {
    expect(
      windowUi.element.querySelector(".gen-window.selected"),
    ).toBeTruthy();
    expect(
      windowUi.element.querySelectorAll(".gen-text-letter").length,
    ).toBe("WINAMP LIBRARY".length);
    expect(
      windowUi.element.querySelector(".gen-close")?.getAttribute("aria-label"),
    ).toBe("Close Spotamp library window");
  });

  it("renders the folder tree and real library links", () => {
    const tree = windowUi.element.querySelector("[data-spotamp-folder-tree]");
    expect(tree).toBeTruthy();
    expect(tree?.querySelectorAll("[data-spotamp-folder]")).toHaveLength(4);
    expect(
      tree?.querySelector('[data-spotamp-folder="playlists"]')?.getAttribute("data-active"),
    ).toBe("true");
    expect(
      tree?.querySelector(".spotamp-tree__title")?.textContent,
    ).toContain("C:\\SPOTAMP\\PLAYLISTS");
    expect(
      windowUi.element.querySelectorAll('[data-list="library"] .spotamp-library__item'),
    ).toHaveLength(2);
    expect(
      windowUi.element.querySelectorAll('[data-list="browse"] .spotamp-library__item')
        .length,
    ).toBeGreaterThan(0);
  });

  it("routes folder links through Spotify's own anchor to avoid a reload", () => {
    const host = document.createElement("a");
    host.href = "/";
    document.body.append(host);
    const navigate = vi.fn();
    host.addEventListener("click", navigate);

    const folder = windowUi.element.querySelector(
      '[data-spotamp-folder="home"]',
    )!;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    folder.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("uses Spotify's JS-driven library rows when they have no anchors", () => {
    document.querySelector('nav[aria-label="Main"]')!.outerHTML = `
      <nav aria-label="Main">
        <div role="row" data-spotamp-sidebar-row="row">
          <div role="button" aria-labelledby="row-title-1"></div>
          <span id="row-title-1">Chill</span>
          <span>Playlist \u2022 Test User</span>
        </div>
      </nav>`;
    const activate = vi.fn();
    document
      .querySelector('nav[aria-label="Main"] [role="button"]')!
      .addEventListener("click", activate);

    windowUi.update("/playlist/abc", "Playlist");

    const item = windowUi.element.querySelector<HTMLButtonElement>(
      '[data-list="library"] .spotamp-library__item',
    );
    expect(item?.tagName).toBe("BUTTON");
    expect(item?.textContent).toContain("Chill");
    item?.click();
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it("does not rebuild identical content", () => {
    const first = windowUi.element.querySelector(
      '[data-list="library"] .spotamp-library__item',
    );
    windowUi.update("/playlist/abc", "Playlist");
    expect(
      windowUi.element.querySelector(
        '[data-list="library"] .spotamp-library__item',
      ),
    ).toBe(first);
  });

  it("submits a search query", () => {
    const form = windowUi.element.querySelector("form")!;
    const input = form.querySelector("input")!;
    input.value = "  daft punk  ";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(onSearch).toHaveBeenCalledWith("daft punk");
  });

  it("clears a dragged position when the layout changes", () => {
    windowUi.element.style.left = "300px";
    windowUi.element.style.top = "200px";
    windowUi.resetPosition();
    expect(windowUi.element.style.left).toBe("");
    expect(windowUi.element.style.top).toBe("");
  });

  it("hides, reopens and destroys itself", () => {
    windowUi.hide();
    expect(windowUi.element.hidden).toBe(true);
    windowUi.show();
    expect(windowUi.element.hidden).toBe(false);

    windowUi.destroy();
    expect(document.getElementById("spotamp-library")).toBeNull();
  });
});
