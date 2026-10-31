import {
  SELECTORS,
  parseClock,
  queryAll,
  textOf,
} from "./selectors";
import { SPOTAMP_MATCH_SCHEME, SPOTAMP_TRACK_SCHEME } from "./types";
import type { TrackInfo } from "./types";

const TRACK_HREF = /\/track\/([A-Za-z0-9]+)/;

export function trackKey(title: string, artist: string): string {
  return `${normalize(title)}::${normalize(artist)}`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function trackUrl(id: string | null, title: string, artist: string): string {
  if (id) return `${SPOTAMP_TRACK_SCHEME}${id}`;
  return `${SPOTAMP_MATCH_SCHEME}${encodeURIComponent(trackKey(title, artist))}`;
}

export function readTrackFromRow(row: HTMLElement): TrackInfo | null {
  const link = row.querySelector<HTMLAnchorElement>(SELECTORS.trackLink);
  const title = textOf(link) || textOf(row.querySelector('[role="gridcell"] a'));
  if (!title) return null;

  const href = link?.getAttribute("href") ?? "";
  const id = TRACK_HREF.exec(href)?.[1] ?? null;

  const artists = unique(
    queryAll<HTMLAnchorElement>(row, 'a[href^="/artist/"]').map(textOf),
  );
  if (artists.length === 0) {
    const byline = row.querySelector('[role="gridcell"]');
    const artistText = textOf(byline)
      .split("•")[0]
      ?.replace(title, "")
      .trim();
    if (artistText) artists.push(artistText);
  }

  const albumLink = queryAll<HTMLAnchorElement>(row, 'a[href^="/album/"]').find(
    (anchor) => !anchor.matches(SELECTORS.trackLink),
  );
  const album = textOf(albumLink ?? null);

  const timeTexts = queryAll<HTMLElement>(row, "span, div")
    .map((element) => textOf(element))
    .filter((text) => /^\d{1,2}:\d{2}$/.test(text));
  const durationSec = timeTexts.length
    ? parseClock(timeTexts[timeTexts.length - 1])
    : null;

  const art = row.querySelector<HTMLImageElement>("img")?.src || null;
  const artist = artists.join(", ");

  return {
    id,
    title,
    artist,
    album,
    durationSec,
    artUrl: art,
    url: trackUrl(id, title, artist),
  };
}

export function collectPageTracks(doc: Document, limit = 100): TrackInfo[] {
  const rows = queryAll<HTMLElement>(doc, SELECTORS.trackRow);
  const seen = new Set<string>();
  const tracks: TrackInfo[] = [];

  for (const row of rows) {
    if (tracks.length >= limit) break;
    const track = readTrackFromRow(row);
    if (!track) continue;
    const key = trackKey(track.title, track.artist);
    if (seen.has(key)) continue;
    seen.add(key);
    tracks.push(track);
  }

  return tracks;
}

export function findTrackRow(doc: Document, track: TrackInfo): HTMLElement | null {
  if (track.id) {
    const links = queryAll<HTMLAnchorElement>(doc, SELECTORS.trackLink);
    const linked = links.find((link) => {
      const href = link.getAttribute("href") ?? "";
      return TRACK_HREF.exec(href)?.[1] === track.id;
    });
    if (linked) return linked.closest<HTMLElement>(SELECTORS.trackRow);
  }

  const wanted = trackKey(track.title, track.artist);
  for (const row of queryAll<HTMLElement>(doc, SELECTORS.trackRow)) {
    const candidate = readTrackFromRow(row);
    if (!candidate) continue;
    if (trackKey(candidate.title, candidate.artist) === wanted) return row;
  }

  return null;
}

export function findPageTrack(
  tracks: TrackInfo[],
  title: string,
  artist: string,
): TrackInfo | null {
  const wanted = trackKey(title, artist);
  return (
    tracks.find((track) => trackKey(track.title, track.artist) === wanted) ??
    tracks.find(
      (track) =>
        normalize(track.title) === normalize(title) &&
        normalize(track.artist).includes(normalize(artist)),
    ) ??
    null
  );
}

export function rowPlayButton(row: HTMLElement): HTMLElement | null {
  return (
    row.querySelector<HTMLElement>(SELECTORS.playButton) ??
    row.querySelector<HTMLElement>('button[aria-label^="Play "]') ??
    row.querySelector<HTMLElement>('button[aria-label^="Pause "]')
  );
}

export function trackFromWebampUrl(
  url: string,
  tracks: TrackInfo[],
): TrackInfo | null {
  if (url.startsWith(SPOTAMP_TRACK_SCHEME)) {
    const id = url.slice(SPOTAMP_TRACK_SCHEME.length);
    return tracks.find((track) => track.id === id) ?? null;
  }
  if (url.startsWith(SPOTAMP_MATCH_SCHEME)) {
    const key = decodeURIComponent(url.slice(SPOTAMP_MATCH_SCHEME.length));
    return (
      tracks.find((track) => trackKey(track.title, track.artist) === key) ??
      null
    );
  }
  return null;
}
