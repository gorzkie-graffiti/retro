import {
  SELECTORS,
  clickWhenEnabled,
  isDisabled,
  parseClock,
  textOf,
} from "../selectors";
import { findPageTrack } from "../tracks";
import type {
  PlaybackSnapshot,
  RepeatMode,
  ShuffleMode,
  TrackInfo,
} from "../types";

export const EMPTY_SNAPSHOT: PlaybackSnapshot = {
  available: false,
  playing: false,
  positionSec: 0,
  durationSec: 0,
  volume: 100,
  shuffle: "off",
  repeat: "off",
  track: null,
  canSkipNext: false,
  canSkipPrevious: false,
  canSeek: false,
};

function readRangeValue(input: HTMLInputElement | null): {
  value: number;
  max: number;
  min: number;
} | null {
  if (!input) return null;
  const value = Number(input.value);
  const max = Number(input.max || input.getAttribute("max") || 0);
  const min = Number(input.min || input.getAttribute("min") || 0);
  if (!Number.isFinite(value) || !Number.isFinite(max)) return null;
  return { value, max, min };
}

function readPlaying(doc: Document): boolean {
  const button = doc.querySelector<HTMLElement>(SELECTORS.playPause);
  const label = (button?.getAttribute("aria-label") ?? "").toLowerCase().trim();
  return label === "pause";
}

function readNowPlaying(doc: Document, pageTracks: TrackInfo[]): TrackInfo | null {
  const widget = doc.querySelector<HTMLElement>(SELECTORS.nowPlaying);
  if (!widget) return null;

  const aria = widget.getAttribute("aria-label") ?? "";
  const ariaMatch = /^Now playing:\s*(.+?)\s+by\s+(.+)$/i.exec(aria);

  const titleLink = widget.querySelector<HTMLAnchorElement>(
    'a[href^="/album/"], a[href^="/track/"]',
  );
  const title =
    textOf(titleLink) ||
    ariaMatch?.[1]?.trim() ||
    textOf(widget.querySelector('[role="gridcell"], .standalone-ellipsis-one-line')) ||
    "";

  const byline = widget.querySelector(SELECTORS.nowPlayingByline);
  const artistNames = Array.from(
    byline?.querySelectorAll<HTMLAnchorElement>('a[href^="/artist/"]') ?? [],
  )
    .map(textOf)
    .filter(Boolean);
  const artist = artistNames.join(", ") || ariaMatch?.[2]?.trim() || "";

  if (!title) return null;

  const matched = findPageTrack(pageTracks, title, artist);
  const art =
    widget.querySelector<HTMLImageElement>(SELECTORS.coverArt)?.src ||
    matched?.artUrl ||
    null;

  return {
    id: matched?.id ?? null,
    title,
    artist,
    album: matched?.album ?? "",
    durationSec: matched?.durationSec ?? null,
    artUrl: art,
    url: matched?.url ?? "",
  };
}

function readRepeat(doc: Document): RepeatMode {
  const button = doc.querySelector<HTMLElement>(SELECTORS.repeat);
  if (!button) return "off";
  const label = (button.getAttribute("aria-label") ?? "").toLowerCase();
  const checked =
    button.getAttribute("aria-checked") === "true" ||
    button.getAttribute("aria-pressed") === "true";
  if (!checked && !label.includes("disable repeat")) return "off";
  if (label.includes("repeat one")) return "track";
  if (!checked) return "off";
  return "context";
}

function shuffleButton(doc: Document): HTMLElement | null {
  const bar = doc.querySelector<HTMLElement>(SELECTORS.playerBar);
  return (
    bar?.querySelector<HTMLElement>(
      '[data-testid="control-button-shuffle"], button[aria-label*="huffle" i]',
    ) ??
    doc.querySelector<HTMLElement>(
      '[data-testid="control-button-shuffle"], button[aria-label*="huffle" i]',
    )
  );
}

/**
 * Spotify cycles its player shuffle button through three modes:
 * off → normal shuffle → Smart Shuffle → off. The accessible label is the
 * most stable source of truth; aria-checked is the fallback for older builds.
 */
function readShuffle(doc: Document): ShuffleMode {
  const button = shuffleButton(doc);
  if (!button) return "off";

  const label = (button.getAttribute("aria-label") ?? "").toLowerCase();
  const checked =
    button.getAttribute("aria-checked") ??
    button.getAttribute("aria-pressed") ??
    "";

  if (label.includes("smart shuffle")) {
    if (label.startsWith("enable")) return "off";
    if (label.startsWith("disable")) return "smart";
    return checked === "true" ? "on" : "smart";
  }
  if (label.includes("disable shuffle") || label.includes("turn off shuffle")) {
    return "on";
  }
  if (label.includes("enable shuffle") || label.includes("turn on shuffle")) {
    return "off";
  }
  if (checked === "mixed") return "smart";
  if (checked === "true") return "on";
  return "off";
}

export function readPlaybackSnapshot(
  doc: Document,
  pageTracks: TrackInfo[],
): PlaybackSnapshot {
  const playPause = doc.querySelector<HTMLElement>(SELECTORS.playPause);
  const progress = doc.querySelector<HTMLInputElement>(SELECTORS.progressInput);
  const progressRange = readRangeValue(progress);
  const durationText = textOf(doc.querySelector(SELECTORS.playbackDuration));
  const positionText = textOf(doc.querySelector(SELECTORS.playbackPosition));

  const durationSec = progressRange
    ? progressRange.max / 1000
    : parseClock(durationText);
  const positionSec = progressRange
    ? progressRange.value / 1000
    : parseClock(positionText);

  const volumeRange = readRangeValue(
    doc.querySelector<HTMLInputElement>(SELECTORS.volumeInput),
  );
  const volume = volumeRange ? Math.round(volumeRange.value * 100) : 100;

  const skipBack = doc.querySelector<HTMLElement>(SELECTORS.skipBack);
  const skipForward = doc.querySelector<HTMLElement>(SELECTORS.skipForward);
  const track = readNowPlaying(doc, pageTracks);

  return {
    available: Boolean(playPause),
    playing: readPlaying(doc),
    positionSec: Number.isFinite(positionSec) ? positionSec : 0,
    durationSec: Number.isFinite(durationSec) ? durationSec : 0,
    volume,
    shuffle: readShuffle(doc),
    repeat: readRepeat(doc),
    track,
    canSkipNext: Boolean(skipForward) && !isDisabled(skipForward),
    canSkipPrevious: Boolean(skipBack) && !isDisabled(skipBack),
    canSeek: Boolean(progress) && !isDisabled(progress),
  };
}

export function playPauseButton(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(SELECTORS.playPause);
}

export function clickPlayPause(doc: Document): boolean {
  return clickWhenEnabled(playPauseButton(doc));
}

export function clickNext(doc: Document): boolean {
  return clickWhenEnabled(doc.querySelector<HTMLElement>(SELECTORS.skipForward));
}

export function clickPrevious(doc: Document): boolean {
  return clickWhenEnabled(doc.querySelector<HTMLElement>(SELECTORS.skipBack));
}

export function clickShuffle(doc: Document): boolean {
  return clickWhenEnabled(shuffleButton(doc));
}

export function readShuffleMode(doc: Document): ShuffleMode {
  return readShuffle(doc);
}

export function clickRepeat(doc: Document): boolean {
  return clickWhenEnabled(doc.querySelector<HTMLElement>(SELECTORS.repeat));
}

export function clickQueue(doc: Document): boolean {
  return clickWhenEnabled(doc.querySelector<HTMLElement>(SELECTORS.queueButton));
}

export function clickLyrics(doc: Document): boolean {
  return clickWhenEnabled(doc.querySelector<HTMLElement>(SELECTORS.lyricsButton));
}

export function clickDevices(doc: Document): boolean {
  return clickWhenEnabled(
    doc.querySelector<HTMLElement>(SELECTORS.connectDevice),
  );
}

/**
 * React tracks the `value` property with a native setter. Calling the native
 * setter and then dispatching input/change is the reliable way to move
 * Spotify's range-based controls from a content script.
 */
export function setNativeRangeValue(
  input: HTMLInputElement,
  value: number,
): boolean {
  try {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (setter) {
      setter.call(input, String(value));
    } else {
      input.value = String(value);
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

export function seekToPercent(doc: Document, percent: number): boolean {
  const input = doc.querySelector<HTMLInputElement>(SELECTORS.progressInput);
  const range = readRangeValue(input);
  if (!input || !range || range.max <= 0 || isDisabled(input)) return false;
  const clamped = Math.max(0, Math.min(100, percent));
  const value = range.min + (range.max - range.min) * (clamped / 100);
  return setNativeRangeValue(input, Math.round(value));
}

export function seekToSeconds(doc: Document, seconds: number): boolean {
  const input = doc.querySelector<HTMLInputElement>(SELECTORS.progressInput);
  const range = readRangeValue(input);
  if (!input || !range || range.max <= 0 || isDisabled(input)) return false;
  const secondsClamped = Math.max(0, Math.min(range.max / 1000, seconds));
  return setNativeRangeValue(input, Math.round(secondsClamped * 1000));
}

export function setVolumePercent(doc: Document, percent: number): boolean {
  const input = doc.querySelector<HTMLInputElement>(SELECTORS.volumeInput);
  const range = readRangeValue(input);
  if (!input || !range || isDisabled(input)) return false;
  const clamped = Math.max(0, Math.min(100, percent));
  const value = range.min + (range.max - range.min) * (clamped / 100);
  return setNativeRangeValue(input, value);
}
