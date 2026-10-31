import { buildFolderTree, folderLevel } from "../adapters/folders";
import { queryAll } from "../selectors";

export interface LibraryWindowOptions {
  doc: Document;
  win: Window;
  onSearch: (query: string) => void;
  logger?: Pick<Console, "warn">;
}

interface Item {
  label: string;
  href?: string;
  kind: "playlist" | "album" | "artist" | "track" | "collection";
  activate?: () => void;
}

const ITEM_ROUTES =
  /^\/(playlist|album|artist|track|show|collection)(\/|$)/;

function firstLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function labelOf(anchor: HTMLAnchorElement): string {
  const aria = anchor.getAttribute("aria-label") ?? "";
  if (aria.trim()) return firstLine(aria);
  const title = anchor.querySelector(
    "p[data-encore-id='listRowTitle'], [data-testid='entityTitle'], [data-encore-id='cardTitle']",
  );
  if (title?.textContent?.trim()) return firstLine(title.textContent);
  return firstLine(anchor.textContent ?? "").slice(0, 90);
}

function rowLabel(row: Element): string {
  const labelled = row
    .querySelector("[aria-labelledby]")
    ?.getAttribute("aria-labelledby")
    ?.split(" ")[0];
  const byId = labelled ? row.ownerDocument.getElementById(labelled) : null;
  if (byId?.textContent?.trim()) return firstLine(byId.textContent);
  const title = row.querySelector(
    "p[data-encore-id='listRowTitle'], [data-encore-id='cardTitle']",
  );
  if (title?.textContent?.trim()) return firstLine(title.textContent);
  return firstLine(row.textContent ?? "").slice(0, 90);
}

function rowByLabel(doc: Document, label: string): HTMLElement | null {
  const nav = doc.querySelector('nav[aria-label="Main"]');
  if (!nav) return null;
  const wanted = label.toLowerCase();
  for (const row of queryAll<HTMLElement>(
    nav,
    '[role="row"][data-spotamp-sidebar-row]',
  )) {
    if (rowLabel(row).toLowerCase() === wanted) return row;
  }
  return null;
}

/**
 * Spotify's library rows are JS-driven divs with no anchor in recent builds.
 * Activation re-queries the live row so a Spotify re-render cannot leave the
 * Winamp library pointing at a detached node.
 */
function libraryRows(doc: Document): Item[] {
  const nav = doc.querySelector('nav[aria-label="Main"]');
  if (!nav) return [];
  const viaLinks = collect(nav, /^\/(playlist|collection)\//);
  if (viaLinks.length > 0) return viaLinks;

  const seen = new Set<string>();
  const items: Item[] = [];
  for (const row of queryAll<HTMLElement>(
    nav,
    '[role="row"][data-spotamp-sidebar-row]',
  )) {
    const label = rowLabel(row);
    if (!label || label.length > 90) continue;
    if (!/playlist/i.test(row.textContent ?? "")) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      label,
      kind: "playlist",
      activate: () => {
        const live = rowByLabel(doc, label) ?? row;
        const control = live.querySelector<HTMLElement>("[role=\"button\"]");
        (control ?? live).click();
      },
    });
  }
  return items;
}

function kindOf(href: string): Item["kind"] {
  if (href.includes("/playlist/")) return "playlist";
  if (href.includes("/album/")) return "album";
  if (href.includes("/artist/")) return "artist";
  if (href.includes("/track/")) return "track";
  return "collection";
}

function collect(scope: ParentNode, hrefs: RegExp): Item[] {
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const anchor of queryAll<HTMLAnchorElement>(scope, "a[href]")) {
    const href = anchor.getAttribute("href") ?? "";
    if (!hrefs.test(href)) continue;
    const label = labelOf(anchor);
    if (!label || label.length > 90) continue;
    const key = `${href}::${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ label, href, kind: kindOf(href) });
  }
  return items;
}

function browseItems(doc: Document, path: string): Item[] {
  const main = doc.querySelector("main");
  if (!main) return [];
  return collect(main, ITEM_ROUTES)
    .filter((item) => item.href !== path && item.kind !== "track")
    .slice(0, 60);
}

export class LibraryWindow {
  readonly element: HTMLDivElement;
  private readonly doc: Document;
  private readonly win: Window;
  private readonly options: LibraryWindowOptions;
  private readonly treeHost: HTMLDivElement;
  private readonly libraryList: HTMLDivElement;
  private readonly browseList: HTMLDivElement;
  private readonly libraryCount: HTMLSpanElement;
  private readonly browseCount: HTMLSpanElement;
  private readonly searchForm: HTMLFormElement;
  private readonly searchInput: HTMLInputElement;
  private readonly titlebar: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;
  private signature = "";
  private dragging = false;
  private dragX = 0;
  private dragY = 0;

  constructor(options: LibraryWindowOptions) {
    this.doc = options.doc;
    this.win = options.win;
    this.options = options;
    const doc = options.doc;

    this.element = doc.createElement("div");
    this.element.id = "spotamp-library";
    this.element.className = "spotamp-library";
    this.element.setAttribute("role", "region");
    this.element.setAttribute("aria-label", "Spotamp library");

    // Authentic Winamp generic-window chrome. The structure and the skin
    // sprites mirror Webamp's own GenWindow component so the library is made
    // from the bundled base-2.91 skin rather than a hand-drawn imitation.
    const skinWindow = doc.createElement("div");
    skinWindow.className = "gen-window selected";
    skinWindow.setAttribute("data-spotamp-window", "library");

    this.titlebar = doc.createElement("div");
    this.titlebar.className = "gen-top draggable";

    const topLeft = doc.createElement("div");
    topLeft.className = "gen-top-left draggable";
    const topLeftFill = doc.createElement("div");
    topLeftFill.className = "gen-top-left-fill draggable";
    const topLeftEnd = doc.createElement("div");
    topLeftEnd.className = "gen-top-left-end draggable";

    const title = doc.createElement("div");
    title.className = "gen-top-title draggable";
    title.setAttribute("aria-hidden", "true");
    title.append(this.pixelText("WINAMP LIBRARY"));

    const topRightEnd = doc.createElement("div");
    topRightEnd.className = "gen-top-right-end draggable";
    const topRightFill = doc.createElement("div");
    topRightFill.className = "gen-top-right-fill draggable";
    const topRight = doc.createElement("div");
    topRight.className = "gen-top-right draggable";

    this.closeButton = doc.createElement("button");
    this.closeButton.type = "button";
    this.closeButton.className = "gen-close winamp-active";
    this.closeButton.setAttribute("aria-label", "Close Spotamp library window");
    this.closeButton.title = "Close library (reopen from the status strip)";
    topRight.append(this.closeButton);

    this.titlebar.append(
      topLeft,
      topLeftFill,
      topLeftEnd,
      title,
      topRightEnd,
      topRightFill,
      topRight,
    );

    this.treeHost = doc.createElement("div");
    this.treeHost.className = "spotamp-library__tree";

    this.searchForm = doc.createElement("form");
    this.searchForm.className = "spotamp-library__search";
    this.searchForm.setAttribute("role", "search");

    const searchLabel = doc.createElement("label");
    searchLabel.className = "spotamp-library__search-label";
    searchLabel.htmlFor = "spotamp-library-search";
    searchLabel.textContent = "FIND:";

    this.searchInput = doc.createElement("input");
    this.searchInput.id = "spotamp-library-search";
    this.searchInput.type = "search";
    this.searchInput.autocomplete = "off";
    this.searchInput.placeholder = "artist, track, playlist...";
    this.searchInput.setAttribute("aria-label", "Search Spotify");

    const go = doc.createElement("button");
    go.type = "submit";
    go.className = "spotamp-library__go";
    go.textContent = "GO";

    this.searchForm.append(searchLabel, this.searchInput, go);

    const body = doc.createElement("div");
    body.className = "spotamp-library__body";

    const libraryHeader = doc.createElement("div");
    libraryHeader.className = "spotamp-library__section";
    libraryHeader.append(doc.createTextNode("SAVED FOLDERS"));
    this.libraryCount = doc.createElement("span");
    this.libraryCount.className = "spotamp-library__count";
    libraryHeader.append(this.libraryCount);

    this.libraryList = doc.createElement("div");
    this.libraryList.className = "spotamp-library__items";
    this.libraryList.setAttribute("role", "list");
    this.libraryList.setAttribute("data-list", "library");

    const browseHeader = doc.createElement("div");
    browseHeader.className = "spotamp-library__section";
    browseHeader.append(doc.createTextNode("BROWSE WINDOW"));
    this.browseCount = doc.createElement("span");
    this.browseCount.className = "spotamp-library__count";
    browseHeader.append(this.browseCount);

    this.browseList = doc.createElement("div");
    this.browseList.className = "spotamp-library__items";
    this.browseList.setAttribute("role", "list");
    this.browseList.setAttribute("data-list", "browse");

    body.append(libraryHeader, this.libraryList, browseHeader, this.browseList);

    const status = doc.createElement("div");
    status.className = "spotamp-library__status";
    status.textContent = "SELECT A FOLDER OR FILE";

    const content = doc.createElement("div");
    content.className = "spotamp-library__content";
    content.append(this.treeHost, this.searchForm, body, status);

    const middle = doc.createElement("div");
    middle.className = "gen-middle";
    const middleLeft = doc.createElement("div");
    middleLeft.className = "gen-middle-left draggable";
    const middleLeftBottom = doc.createElement("div");
    middleLeftBottom.className = "gen-middle-left-bottom draggable";
    middleLeft.append(middleLeftBottom);
    const middleCenter = doc.createElement("div");
    middleCenter.className = "gen-middle-center";
    middleCenter.append(content);
    const middleRight = doc.createElement("div");
    middleRight.className = "gen-middle-right draggable";
    const middleRightBottom = doc.createElement("div");
    middleRightBottom.className = "gen-middle-right-bottom draggable";
    middleRight.append(middleRightBottom);
    middle.append(middleLeft, middleCenter, middleRight);

    const bottom = doc.createElement("div");
    bottom.className = "gen-bottom draggable";
    const bottomLeft = doc.createElement("div");
    bottomLeft.className = "gen-bottom-left draggable";
    const bottomRight = doc.createElement("div");
    bottomRight.className = "gen-bottom-right draggable";
    bottom.append(bottomLeft, bottomRight);

    skinWindow.append(this.titlebar, middle, bottom);
    this.element.append(skinWindow);
    doc.body.append(this.element);

    this.closeButton.addEventListener("click", this.hide);
    this.searchForm.addEventListener("submit", this.onSubmit);
    this.titlebar.addEventListener("pointerdown", this.onPointerDown);
    this.element.addEventListener("click", this.onClick);
  }

  update(path: string, label: string): void {
    const library = libraryRows(this.doc);
    const browse = browseItems(this.doc, path);
    const signature = JSON.stringify({
      path,
      label,
      library: library.map((item) => `${item.href}|${item.label}`),
      browse: browse.map((item) => `${item.href}|${item.label}`),
    });
    if (signature === this.signature) return;
    this.signature = signature;

    this.treeHost.replaceChildren(buildFolderTree(this.doc, path));
    this.libraryCount.textContent = String(library.length);
    this.browseCount.textContent = String(browse.length);
    this.libraryList.replaceChildren(...this.rows(library, "No saved playlists"));
    this.browseList.replaceChildren(
      ...this.rows(browse, "Open a playlist, album or search"),
    );

    const current = this.element.querySelector<HTMLElement>(
      ".spotamp-tree__title",
    );
    const level = folderLevel(path);
    const isEntity =
      path.startsWith("/playlist/") ||
      path.startsWith("/album/") ||
      path.startsWith("/artist/");
    if (current && label && isEntity) {
      current.textContent = `${current.textContent} \\ ${label.toUpperCase().slice(0, 28)}`;
      current.title = `${level} / ${label}`;
    }
  }

  show(): void {
    this.element.hidden = false;
    this.searchInput.focus();
  }

  /** Drop a dragged position so the 1x/2x layout rules can place the window. */
  resetPosition(): void {
    this.element.style.left = "";
    this.element.style.top = "";
    this.element.style.right = "";
    this.element.style.bottom = "";
  }

  private pixelText(text: string): DocumentFragment {
    const fragment = this.doc.createDocumentFragment();
    for (const letter of text.split("")) {
      const span = this.doc.createElement("span");
      span.className = `gen-text-letter gen-text-${
        letter === " " ? "space" : letter.toLowerCase()
      }`;
      span.setAttribute("aria-hidden", "true");
      fragment.append(span);
    }
    return fragment;
  }

  hide = (): void => {
    this.element.hidden = true;
  };

  isOpen(): boolean {
    return !this.element.hidden;
  }

  destroy(): void {
    this.win.removeEventListener("pointermove", this.onPointerMove);
    this.win.removeEventListener("pointerup", this.onPointerUp);
    this.closeButton.removeEventListener("click", this.hide);
    this.searchForm.removeEventListener("submit", this.onSubmit);
    this.titlebar.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("click", this.onClick);
    this.element.remove();
  }

  /**
   * Spotamp's window lives outside Spotify's React tree. A plain anchor click
   * would reload the whole player and lose Webamp's state, so route through a
   * matching link inside Spotify's own application whenever one exists.
   */
  private onClick = (event: MouseEvent): void => {
    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>(
      "a[href]",
    );
    if (!anchor || !this.element.contains(anchor)) return;
    const href = anchor.getAttribute("href");
    if (!href || anchor.target === "_blank") return;
    const target = this.spotifyLink(href);
    if (!target) return;
    event.preventDefault();
    target.click();
  };

  private spotifyLink(href: string): HTMLAnchorElement | null {
    const wanted = new URL(href, this.win.location.href);
    let fallback: HTMLAnchorElement | null = null;
    for (const anchor of queryAll<HTMLAnchorElement>(this.doc, "a[href]")) {
      if (this.element.contains(anchor)) continue;
      if (anchor.closest("#spotamp-status, .spotamp-webamp")) continue;
      const candidate = new URL(anchor.href, this.win.location.href);
      if (
        candidate.pathname !== wanted.pathname ||
        candidate.search !== wanted.search
      ) {
        continue;
      }
      if (anchor.getClientRects().length > 0) return anchor;
      fallback ??= anchor;
    }
    return fallback;
  }

  private rows(items: Item[], emptyText: string): HTMLElement[] {
    if (items.length === 0) {
      const empty = this.doc.createElement("div");
      empty.className = "spotamp-library__empty";
      empty.textContent = emptyText;
      return [empty];
    }
    return items.map((item) => {
      const row = item.href
        ? this.doc.createElement("a")
        : this.doc.createElement("button");
      row.className = "spotamp-library__item";
      row.setAttribute("data-kind", item.kind);
      row.setAttribute("role", "listitem");
      if (item.href) {
        (row as HTMLAnchorElement).href = item.href;
      } else if (item.activate) {
        (row as HTMLButtonElement).type = "button";
        row.addEventListener("click", item.activate);
      }

      const icon = this.doc.createElement("span");
      icon.className = "spotamp-library__icon";
      icon.setAttribute("aria-hidden", "true");

      const text = this.doc.createElement("span");
      text.className = "spotamp-library__label";
      text.textContent = item.label;

      const type = this.doc.createElement("span");
      type.className = "spotamp-library__type";
      type.textContent =
        item.kind === "playlist"
          ? "M3U"
          : item.kind === "album"
            ? "ALB"
            : item.kind === "artist"
              ? "ART"
              : item.kind === "track"
                ? "TRK"
                : "DIR";

      row.append(icon, text, type);
      return row;
    });
  }

  private onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const query = this.searchInput.value.trim();
    if (!query) {
      this.searchInput.focus();
      return;
    }
    this.options.onSearch(query);
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    const rect = this.element.getBoundingClientRect();
    this.dragging = true;
    this.dragX = event.clientX - rect.left;
    this.dragY = event.clientY - rect.top;
    this.element.style.left = `${rect.left}px`;
    this.element.style.top = `${rect.top}px`;
    this.element.style.right = "auto";
    this.element.style.bottom = "auto";
    this.win.addEventListener("pointermove", this.onPointerMove);
    this.win.addEventListener("pointerup", this.onPointerUp);
    event.preventDefault();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const maxLeft = Math.max(0, this.win.innerWidth - 120);
    const maxTop = Math.max(0, this.win.innerHeight - 40);
    this.element.style.left = `${Math.min(maxLeft, Math.max(0, event.clientX - this.dragX))}px`;
    this.element.style.top = `${Math.min(maxTop, Math.max(0, event.clientY - this.dragY))}px`;
  };

  private onPointerUp = (): void => {
    this.dragging = false;
    this.win.removeEventListener("pointermove", this.onPointerMove);
    this.win.removeEventListener("pointerup", this.onPointerUp);
  };
}
