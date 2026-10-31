import type { PageKind, RouteInfo } from "./types";
import { SELECTORS, textOf } from "./selectors";

const DAILY_MIX_ID = /\/playlist\/37i9dQZF1E/i;

export function detectPageKind(pathname: string, doc: Document): PageKind {
  const path = pathname || "/";

  if (/^\/(login|signup|download|premium)(\/|$)/.test(path)) {
    return "unknown";
  }

  if (path === "/" || path === "") {
    return "home";
  }

  if (path.startsWith("/search")) {
    return "search";
  }

  if (path.startsWith("/collection/tracks")) {
    return "liked-songs";
  }

  if (path.startsWith("/playlist/")) {
    if (DAILY_MIX_ID.test(path)) return "daily-mix";
    const playlistPage = doc.querySelector(SELECTORS.playlistPage);
    const uri = playlistPage?.getAttribute("data-test-uri") ?? "";
    const title = textOf(
      playlistPage?.querySelector(SELECTORS.entityTitle) ?? null,
    );
    if (/daily mix/i.test(title) || /spotify:playlist:37i9dQZF1E/i.test(uri)) {
      return "daily-mix";
    }
    return "playlist";
  }

  if (path.startsWith("/album/")) {
    return "album";
  }

  if (path.startsWith("/artist/")) {
    return "artist";
  }

  // Podcasts, episodes, audiobooks, sections and future routes keep the
  // generic Spotamp shell rather than falling back to an unstyled Spotify.
  return "unknown";
}

export function pageLabel(kind: PageKind, doc: Document): string {
  const entityTitle = textOf(
    doc.querySelector(`${SELECTORS.entityTitle} h1, ${SELECTORS.entityTitle}`),
  );

  switch (kind) {
    case "home":
      return "HOME";
    case "search":
      return "SEARCH";
    case "playlist":
      return entityTitle || "PLAYLIST";
    case "daily-mix":
      return entityTitle || "DAILY MIX";
    case "liked-songs":
      return "LIKED SONGS";
    case "album":
      return entityTitle || "ALBUM";
    case "artist":
      return entityTitle || "ARTIST";
    default:
      return "SPOTIFY";
  }
}

export function detectRoute(doc: Document, href: string): RouteInfo {
  let pathname = "/";
  let url = href;
  try {
    const parsed = new URL(href);
    pathname = parsed.pathname;
    url = parsed.href;
  } catch {
    pathname = href;
  }
  const kind = detectPageKind(pathname, doc);
  return { kind, url, label: pageLabel(kind, doc) };
}

export function pageRootSelector(kind: PageKind): string | null {
  switch (kind) {
    case "home":
      return SELECTORS.homePage;
    case "playlist":
    case "daily-mix":
    case "liked-songs":
      return SELECTORS.playlistPage;
    case "album":
      return SELECTORS.albumPage;
    case "artist":
      return SELECTORS.artistPage;
    default:
      return null;
  }
}
