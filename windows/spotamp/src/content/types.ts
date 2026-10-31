export type PageKind =
  | "home"
  | "search"
  | "playlist"
  | "album"
  | "artist"
  | "daily-mix"
  | "liked-songs"
  | "unknown";

export interface TrackInfo {
  /** Spotify track id when one can be recovered from the page. */
  id: string | null;
  title: string;
  artist: string;
  album: string;
  durationSec: number | null;
  artUrl: string | null;
  /** Stable URL used as the Webamp playlist key. */
  url: string;
}

export type RepeatMode = "off" | "context" | "track";

export type ShuffleMode = "off" | "on" | "smart";

export interface PlaybackSnapshot {
  available: boolean;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  volume: number;
  shuffle: ShuffleMode;
  repeat: RepeatMode;
  track: TrackInfo | null;
  canSkipNext: boolean;
  canSkipPrevious: boolean;
  canSeek: boolean;
}

export interface RouteInfo {
  kind: PageKind;
  url: string;
  label: string;
}

export const SPOTAMP_TRACK_SCHEME = "spotamp:track:";
export const SPOTAMP_MATCH_SCHEME = "spotamp:match:";
