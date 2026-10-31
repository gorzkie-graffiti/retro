import {
  clickDevices,
  clickLyrics,
  clickNext,
  clickPlayPause,
  clickPrevious,
  clickQueue,
  clickRepeat,
  clickShuffle,
  EMPTY_SNAPSHOT,
  readPlaybackSnapshot,
  seekToPercent,
  seekToSeconds,
  setVolumePercent,
} from "./spotifyDom";
import { findTrackRow, rowPlayButton } from "../tracks";
import { isDisabled } from "../selectors";
import type { PlaybackSnapshot, TrackInfo } from "../types";

type Listener = (snapshot: PlaybackSnapshot) => void;
type ErrorListener = (message: string) => void;

export interface PlaybackAdapterOptions {
  doc: Document;
  win: Window;
  intervalMs?: number;
  logger?: Pick<Console, "warn" | "info">;
}

const PLAY_VERIFY_MS = 1400;
const TRACK_VERIFY_MS = 2200;

function snapshotEquals(
  a: PlaybackSnapshot,
  b: PlaybackSnapshot,
): boolean {
  return (
    a.available === b.available &&
    a.playing === b.playing &&
    Math.abs(a.positionSec - b.positionSec) < 0.2 &&
    Math.abs(a.durationSec - b.durationSec) < 0.2 &&
    Math.abs(a.volume - b.volume) < 0.5 &&
    a.shuffle === b.shuffle &&
    a.repeat === b.repeat &&
    a.canSkipNext === b.canSkipNext &&
    a.canSkipPrevious === b.canSkipPrevious &&
    a.canSeek === b.canSeek &&
    a.track?.id === b.track?.id &&
    a.track?.title === b.track?.title &&
    a.track?.artist === b.track?.artist &&
    a.track?.album === b.track?.album &&
    a.track?.artUrl === b.track?.artUrl
  );
}

function trackMatches(
  snapshotTrack: TrackInfo | null,
  wanted: TrackInfo,
): boolean {
  if (!snapshotTrack) return false;
  if (wanted.id && snapshotTrack.id) return wanted.id === snapshotTrack.id;
  return (
    snapshotTrack.title.toLowerCase() === wanted.title.toLowerCase() &&
    snapshotTrack.artist.toLowerCase() === wanted.artist.toLowerCase()
  );
}

export class SpotifyPlaybackAdapter {
  readonly doc: Document;
  private readonly win: Window;
  private readonly intervalMs: number;
  private readonly logger: Pick<Console, "warn" | "info">;
  private readonly listeners = new Set<Listener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private readonly timers = new Set<number>();

  private snapshot: PlaybackSnapshot = { ...EMPTY_SNAPSHOT };
  private pageTracks: TrackInfo[] = [];
  private timer: number | null = null;
  private started = false;
  private lastError = "";
  private lastErrorAt = 0;

  constructor(options: PlaybackAdapterOptions) {
    this.doc = options.doc;
    this.win = options.win;
    this.intervalMs = options.intervalMs ?? 550;
    this.logger = options.logger ?? console;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.refresh();
    this.timer = this.win.setInterval(() => {
      if (this.doc.hidden) return;
      this.refresh();
    }, this.intervalMs);
  }

  stop(): void {
    this.started = false;
    if (this.timer != null) {
      this.win.clearInterval(this.timer);
      this.timer = null;
    }
    for (const timer of this.timers) this.win.clearTimeout(timer);
    this.timers.clear();
    this.listeners.clear();
    this.errorListeners.clear();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  getSnapshot(): PlaybackSnapshot {
    return this.snapshot;
  }

  setPageTracks(tracks: TrackInfo[]): void {
    this.pageTracks = tracks;
    this.refresh(true);
  }

  refresh(force = false): PlaybackSnapshot {
    const next = readPlaybackSnapshot(this.doc, this.pageTracks);
    if (force || !snapshotEquals(next, this.snapshot)) {
      const trackChanged =
        next.track?.title !== this.snapshot.track?.title ||
        next.track?.artist !== this.snapshot.track?.artist;
      this.snapshot = next;
      for (const listener of this.listeners) {
        try {
          listener(next);
        } catch (error) {
          this.logger.warn("[Spotamp] playback listener failed", error);
        }
      }
      if (!next.available && force) {
        this.reportError(
          "Spotify player controls not found. The extension keeps the theme and will reconnect when they appear.",
        );
      }
      if (trackChanged) {
        this.logger.info?.(
          `[Spotamp] Spotify track: ${next.track?.title ?? "nothing playing"}`,
        );
      }
    }
    return this.snapshot;
  }

  async play(): Promise<boolean> {
    this.refresh();
    if (!this.snapshot.available) {
      this.reportError("Play failed: Spotify's player is not ready.");
      return false;
    }
    if (this.snapshot.playing) return true;
    if (!clickPlayPause(this.doc)) {
      this.reportError("Play failed: Spotify's play button is disabled.");
      return false;
    }
    this.verifyLater(
      () => this.refresh().playing,
      "Spotify did not start playback after the play command.",
      PLAY_VERIFY_MS,
    );
    return true;
  }

  async pause(): Promise<boolean> {
    this.refresh();
    if (!this.snapshot.available) return false;
    if (!this.snapshot.playing) return true;
    if (!clickPlayPause(this.doc)) {
      this.reportError("Pause failed: Spotify's pause button is disabled.");
      return false;
    }
    this.verifyLater(
      () => !this.refresh().playing,
      "Spotify did not pause after the pause command.",
      PLAY_VERIFY_MS,
    );
    return true;
  }

  next(): boolean {
    if (!clickNext(this.doc)) {
      this.reportError("Next track is unavailable in Spotify right now.");
      return false;
    }
    return true;
  }

  previous(): boolean {
    if (!clickPrevious(this.doc)) {
      this.reportError("Previous track is unavailable in Spotify right now.");
      return false;
    }
    return true;
  }

  toggleShuffle(): boolean {
    const before = this.snapshot.shuffle;
    if (!clickShuffle(this.doc)) {
      this.reportError("Shuffle is unavailable in Spotify right now.");
      return false;
    }
    this.verifyLater(
      () => this.refresh(true).shuffle !== before,
      "Spotify did not change shuffle mode after the command.",
      1400,
    );
    return true;
  }

  toggleRepeat(): boolean {
    if (!clickRepeat(this.doc)) {
      this.reportError("Repeat is unavailable in Spotify right now.");
      return false;
    }
    return true;
  }

  async playTrack(track: TrackInfo): Promise<boolean> {
    const row = findTrackRow(this.doc, track);
    if (!row) {
      this.reportError(
        `Cannot play “${track.title}”: it is not present on this Spotify page.`,
      );
      return false;
    }
    const button = rowPlayButton(row);
    if (!button) {
      this.reportError(
        `Cannot play “${track.title}”: Spotify's row play button is unavailable.`,
      );
      return false;
    }
    const label = button.getAttribute("aria-label") ?? "";
    if (label.toLowerCase().startsWith("pause")) return true;
    if (isDisabled(button)) {
      this.reportError(`Cannot play “${track.title}”: the row is disabled.`);
      return false;
    }
    button.click();
    this.verifyLater(
      () => trackMatches(this.refresh().track, track),
      `Spotify did not start “${track.title}” after the row command.`,
      TRACK_VERIFY_MS,
    );
    return true;
  }

  seekToPercent(percent: number): boolean {
    if (!seekToPercent(this.doc, percent)) {
      this.reportError("Seeking failed: Spotify's progress control is unavailable.");
      return false;
    }
    this.refresh(true);
    return true;
  }

  seekToSeconds(seconds: number): boolean {
    if (!seekToSeconds(this.doc, seconds)) {
      this.reportError("Seeking failed: Spotify's progress control is unavailable.");
      return false;
    }
    this.refresh(true);
    return true;
  }

  setVolume(percent: number): boolean {
    if (!setVolumePercent(this.doc, percent)) {
      this.reportError("Volume failed: Spotify's volume control is unavailable.");
      return false;
    }
    this.refresh(true);
    return true;
  }

  openQueue(): boolean {
    return clickQueue(this.doc) || this.reportError("Queue is unavailable.");
  }

  openLyrics(): boolean {
    return clickLyrics(this.doc) || this.reportError("Lyrics are unavailable.");
  }

  openDevices(): boolean {
    return clickDevices(this.doc) || this.reportError("Device picker is unavailable.");
  }

  private verifyLater(
    predicate: () => boolean,
    message: string,
    delay: number,
  ): void {
    const timer = this.win.setTimeout(() => {
      this.timers.delete(timer);
      if (!predicate()) this.reportError(message);
    }, delay);
    this.timers.add(timer);
  }

  private reportError(message: string): false {
    const now = Date.now();
    if (message === this.lastError && now - this.lastErrorAt < 5000) return false;
    this.lastError = message;
    this.lastErrorAt = now;
    this.logger.warn(`[Spotamp] ${message}`);
    for (const listener of this.errorListeners) listener(message);
    return false;
  }

}
