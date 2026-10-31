/**
 * Selectors discovered from Spotify's live Web Player DOM (October 2026).
 * Page captures are intentionally not stored in the repo.
 *
 * Prefer data-testid and accessible labels. Generated class names are
 * intentionally avoided. Every lookup is nullable so a Spotify redesign
 * degrades to the base theme instead of breaking the extension.
 */
export const SELECTORS = {
  appRoot: '[data-testid="root"]',
  globalNav: '[data-testid="global-nav-bar"]',
  main: "main",
  sidebar: 'nav[aria-label="Main"]',
  sidebarContainer: "#Desktop_LeftSidebar_Id",
  nowPlayingRail: 'aside[aria-label="Now playing view"], #Desktop_PanelContainer_Id',

  playerBar: '[data-testid="now-playing-bar"]',
  nowPlaying: '[data-testid="now-playing-widget-v2"]',
  nowPlayingByline: '[data-testid="now-playing-widget-v2-byline"]',
  coverArt: '[data-testid="cover-art-image"]',
  coverArtButton: '[data-testid="cover-art-button"]',
  playPause: '[data-testid="control-button-playpause"]',
  playerControls: '[data-testid="player-controls"]',
  generalControls: '[data-testid="general-controls"]',
  skipBack: '[data-testid="control-button-skip-back"]',
  skipForward: '[data-testid="control-button-skip-forward"]',
  repeat: '[data-testid="control-button-repeat"]',
  progressBar: '[data-testid="playback-progressbar"]',
  progressInput: '[data-testid="playback-progressbar"] input[type="range"]',
  playbackPosition: '[data-testid="playback-position"]',
  playbackDuration: '[data-testid="playback-duration"]',
  volumeBar: '[data-testid="volume-bar"]',
  volumeInput: '[data-testid="volume-bar"] input[type="range"]',
  volumeMute: '[data-testid="volume-bar-toggle-mute-button"]',
  queueButton: '[data-testid="control-button-queue"]',
  lyricsButton: '[data-testid="lyrics-button"]',
  addToPlaylist: '[aria-label="Add to playlist"]',
  connectDevice: '[aria-label="Connect to a device"]',
  miniplayer: '[data-testid="pip-toggle-button"]',
  fullscreen: '[data-testid="fullscreen-mode-button"]',

  searchInput: '[data-testid="search-input"], input[type="search"]',
  searchDropdown: '[data-testid="search-dropdown"]',

  homePage: '[data-testid="home-page"]',
  playlistPage: '[data-testid="playlist-page"]',
  albumPage: '[data-testid="album-page"]',
  artistPage: '[data-testid="artist-page"]',
  entityHeader: '[data-testid="entity-header"]',
  entityTitle: '[data-testid="entityTitle"]',
  entityImage: '[data-testid="playlist-image"], [data-testid="album-image"]',
  actionBar: '[data-testid="action-bar"]',
  actionBarRow: '[data-testid="action-bar-row"]',
  trackList: '[data-testid="track-list"], [data-testid="playlist-tracklist"]',
  trackRow: '[data-testid="tracklist-row"]',
  trackLink: '[data-testid="internal-track-link"]',
  playButton: '[data-testid="play-button"]',
  shelf: '[data-testid="component-shelf"]',
  card: '[data-encore-id="card"]',
  cardImage: '[data-testid="card-image"]',
  shortcut: '[data-testid="shortcut-image"]',
  tabs: '[role="tablist"]',
  tab: '[role="tab"]',
} as const;

export const PAGE_CLASSES = [
  "spotamp-page-home",
  "spotamp-page-search",
  "spotamp-page-playlist",
  "spotamp-page-album",
  "spotamp-page-artist",
  "spotamp-page-daily-mix",
  "spotamp-page-liked-songs",
  "spotamp-page-unknown",
] as const;

export function pageClass(kind: string): string {
  return `spotamp-page-${kind}`;
}

export function query<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): T | null {
  return root.querySelector<T>(selector);
}

export function queryAll<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function textOf(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function isDisabled(node: HTMLElement | null): boolean {
  if (!node) return true;
  return (
    node.hasAttribute("disabled") ||
    node.getAttribute("aria-disabled") === "true" ||
    node.classList.contains("disabled")
  );
}

export function clickWhenEnabled(node: HTMLElement | null): boolean {
  if (!node || isDisabled(node)) return false;
  node.click();
  return true;
}

export function parseClock(value: string | null | undefined): number {
  if (!value) return 0;
  const cleaned = value.trim();
  const parts = cleaned.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  if (parts.length === 2) {
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }
  return parts[0] ?? 0;
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
