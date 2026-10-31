import { createSpotifyMediaClass } from "./spotifyMedia";
import type {
  SpotampMedia,
  WebampAdapterHooks,
  WebampConstructor,
  WebampControllerHooks,
  WebampInstance,
  WebampPlaylistTrack,
  WebampTrack,
} from "./webampTypes";
import { SPOTAMP_MATCH_SCHEME, SPOTAMP_TRACK_SCHEME } from "../types";
import type { PlaybackSnapshot, TrackInfo } from "../types";

const WINDOW_LAYOUT = {
  main: { position: { left: 0, top: 0 } },
  equalizer: { position: { left: 0, top: 118 } },
  playlist: {
    position: { left: 292, top: 0 },
    size: { extraHeight: 4, extraWidth: 0 },
  },
};

const Z_INDEX = 2147482000;

function trackKeyOf(track: TrackInfo | null): string {
  if (!track) return "";
  return `${track.id ?? ""}::${track.title}::${track.artist}`;
}

function webampTrackFor(track: TrackInfo, fallbackDuration = 0): WebampTrack {
  const url =
    track.url ||
    `${SPOTAMP_MATCH_SCHEME}${encodeURIComponent(
      `${track.title.toLowerCase()}::${track.artist.toLowerCase()}`,
    )}`;
  // Webamp probes the URL with an <audio> element whenever a track has no
  // duration. Spotamp URLs are not media files, so always give Webamp a
  // numeric duration (0 means "unknown") to avoid a doomed network request.
  const knownDuration = track.durationSec ?? 0;
  const duration = knownDuration > 0 ? knownDuration : fallbackDuration;
  return {
    url,
    metaData: {
      artist: track.artist || "Unknown artist",
      title: track.title || "Unknown track",
      album: track.album || undefined,
      albumArtUrl: track.artUrl || undefined,
    },
    duration: duration > 0 ? duration : 0,
  };
}

export class SpotampWebamp {
  private readonly adapterHooks: WebampAdapterHooks;
  private readonly webampCtor: WebampConstructor;
  private readonly doc: Document;
  private readonly win: Window;
  private readonly mediaHooks: WebampControllerHooks;

  private webamp: WebampInstance | null = null;
  private media: SpotampMedia | null = null;
  private container: HTMLDivElement | null = null;
  private unsubscribeAdapter: (() => void) | null = null;
  private unsubscribeClose: (() => void) | null = null;
  private clickBridge: ((event: MouseEvent) => void) | null = null;
  private readonly timers = new Set<number>();

  private pageTracks: TrackInfo[] = [];
  private trackByUrl = new Map<string, TrackInfo>();
  private playlistSignature: string | null = null;
  private lastTrackKey = "";
  private selectedUrl = "";
  private volumeInitialized = false;
  private suppressToggleSyncUntil = 0;
  private mounted = false;

  constructor(options: {
    adapterHooks: WebampAdapterHooks;
    webampCtor: WebampConstructor;
    doc: Document;
    win: Window;
  }) {
    this.adapterHooks = options.adapterHooks;
    this.webampCtor = options.webampCtor;
    this.doc = options.doc;
    this.win = options.win;
    this.mediaHooks = {
      ...options.adapterHooks,
      resolveTrack: (url) => this.resolveTrack(url),
    };
  }

  async mount(): Promise<void> {
    if (this.mounted) return;
    this.mounted = true;

    const container = this.doc.createElement("div");
    container.id = "spotamp-webamp";
    container.className = "spotamp-webamp";
    container.setAttribute("data-spotamp-webamp", "");
    container.setAttribute("aria-label", "Spotamp Winamp player");
    this.doc.body.appendChild(container);
    this.container = container;

    const Media = createSpotifyMediaClass(this.mediaHooks);
    const webamp = new this.webampCtor({
      initialTracks: [],
      windowLayout: WINDOW_LAYOUT,
      zIndex: Z_INDEX,
      enableHotkeys: false,
      enableMediaSession: false,
      __customMediaClass: Media,
    });
    this.webamp = webamp;

    await webamp.renderInto(container);

    // Webamp constructs its own media instance from __customMediaClass. Use
    // that instance so Webamp's middleware and this controller share state.
    this.media = (webamp as unknown as { media: SpotampMedia }).media;

    this.installClickBridge();
    this.unsubscribeClose = webamp.onClose(() => {
      this.adapterHooks.onOpenChange?.(false);
    });
    this.unsubscribeAdapter = this.adapterHooks.subscribe((snapshot) => {
      this.syncSnapshot(snapshot);
    });

    if (this.pageTracks.length > 0) {
      this.applyPage(this.pageTracks);
    }
    this.syncSnapshot(this.adapterHooks.getSnapshot());
    this.adapterHooks.onOpenChange?.(true);
  }

  applyPage(tracks: TrackInfo[]): void {
    this.pageTracks = tracks;
    if (!this.webamp || !this.media) return;

    const signature = tracks.map((track) => track.url).join("|");
    if (signature !== this.playlistSignature) {
      this.playlistSignature = signature;
      this.trackByUrl = new Map(tracks.map((track) => [track.url, track]));

      this.media.suppressStop = true;
      this.webamp.setTracks(tracks.map(webampTrackFor));
      this.media.suppressStop = false;
      this.lastTrackKey = "";
      this.selectedUrl = "";
    }

    this.ensureCurrent(this.adapterHooks.getSnapshot().track);
  }

  syncSnapshot(snapshot: PlaybackSnapshot): void {
    if (!this.webamp || !this.media) return;

    this.media.emitTimeUpdate();

    const key = trackKeyOf(snapshot.track);
    if (key && key !== this.lastTrackKey) {
      this.lastTrackKey = key;
      this.ensureCurrent(snapshot.track);
    }
    if (!key) this.lastTrackKey = "";

    this.syncPlaybackState(snapshot);
    this.syncToggles(snapshot);

    if (!this.volumeInitialized && snapshot.available) {
      this.volumeInitialized = true;
      this.webamp.setVolume(snapshot.volume);
    }
  }

  reopen(): void {
    if (!this.webamp) return;
    this.webamp.reopen();
    this.adapterHooks.onOpenChange?.(true);
  }

  isOpen(): boolean {
    if (!this.webamp) return false;
    return this.webamp.getPlayerMediaStatus() !== "CLOSED";
  }

  destroy(): void {
    this.mounted = false;
    for (const timer of this.timers) this.win.clearTimeout(timer);
    this.timers.clear();

    this.unsubscribeAdapter?.();
    this.unsubscribeAdapter = null;
    this.unsubscribeClose?.();
    this.unsubscribeClose = null;

    if (this.clickBridge) {
      this.doc.removeEventListener("click", this.clickBridge, true);
      this.clickBridge = null;
    }

    try {
      this.webamp?.dispose();
    } catch (error) {
      this.adapterHooks.logger?.warn("[Spotamp] Webamp dispose failed", error);
    }
    this.webamp = null;
    this.media = null;
    this.container?.remove();
    this.container = null;
    this.playlistSignature = null;
    this.lastTrackKey = "";
    this.selectedUrl = "";
    this.trackByUrl.clear();
  }

  private resolveTrack(url: string): TrackInfo | null {
    const direct = this.trackByUrl.get(url);
    if (direct) return direct;

    if (url.startsWith(SPOTAMP_MATCH_SCHEME)) {
      const key = decodeURIComponent(url.slice(SPOTAMP_MATCH_SCHEME.length));
      for (const track of this.trackByUrl.values()) {
        if (
          `${track.title.toLowerCase()}::${track.artist.toLowerCase()}` === key
        ) {
          return track;
        }
      }
    }

    if (url.startsWith(SPOTAMP_TRACK_SCHEME)) {
      const id = url.slice(SPOTAMP_TRACK_SCHEME.length);
      for (const track of this.trackByUrl.values()) {
        if (track.id === id) return track;
      }
    }

    return null;
  }

  private ensureCurrent(track: TrackInfo | null): void {
    if (!track || !this.webamp || !this.media) return;

    const snapshot = this.adapterHooks.getSnapshot();
    const webampTrack = webampTrackFor(track, snapshot.durationSec);
    this.trackByUrl.set(webampTrack.url, track);
    if (this.selectedUrl === webampTrack.url) return;

    let playlistTrack = this.findPlaylistTrack(webampTrack.url);
    if (!playlistTrack) {
      this.webamp.appendTracks([webampTrack]);
      playlistTrack = this.findPlaylistTrack(webampTrack.url);
    }
    if (!playlistTrack) return;

    // Setting the current Webamp track without asking Spotify to play it.
    // Webamp's media middleware will call loadFromUrl; the suppress flag makes
    // that call a no-op.
    this.media.suppressNextLoad = true;
    this.webamp.store.dispatch({
      type: "PLAY_TRACK",
      id: playlistTrack.id,
    });

    this.webamp.store.dispatch({
      type: "SET_MEDIA",
      id: playlistTrack.id,
      kbps: "128",
      khz: "44",
      channels: 2,
      length: track.durationSec || snapshot.durationSec || 0,
    });
    this.webamp.store.dispatch({
      type: "UPDATE_TIME_ELAPSED",
      elapsed: snapshot.positionSec,
    });
    this.selectedUrl = webampTrack.url;
  }

  private findPlaylistTrack(url: string): WebampPlaylistTrack | null {
    if (!this.webamp) return null;
    return this.webamp.getPlaylistTracks().find((track) => track.url === url) ?? null;
  }

  private syncPlaybackState(snapshot: PlaybackSnapshot): void {
    if (!this.webamp) return;
    const status = this.webamp.store.getState().media.status;
    if (snapshot.playing && status !== "PLAYING") {
      this.webamp.store.dispatch({ type: "IS_PLAYING" });
    } else if (!snapshot.playing && status === "PLAYING") {
      this.webamp.store.dispatch({ type: "PAUSE" });
    }
  }

  private syncToggles(snapshot: PlaybackSnapshot): void {
    this.syncShuffleLabel(snapshot.shuffle);
    if (!this.webamp || Date.now() < this.suppressToggleSyncUntil) return;

    const shuffleOn = snapshot.shuffle !== "off";
    if (this.webamp.isShuffleEnabled() !== shuffleOn) {
      this.webamp.toggleShuffle();
    }
    const repeatOn = snapshot.repeat !== "off";
    if (this.webamp.isRepeatEnabled() !== repeatOn) {
      this.webamp.toggleRepeat();
    }
  }

  private syncShuffleLabel(mode: PlaybackSnapshot["shuffle"]): void {
    const button = this.container?.querySelector<HTMLElement>("#shuffle");
    if (!button) return;
    const label =
      mode === "smart" ? "SMART" : mode === "on" ? "ON" : "OFF";
    button.dataset.spotampShuffle = mode;
    button.setAttribute("aria-label", `Shuffle: ${label}`);
    button.title = `Shuffle: ${label} (click to cycle OFF / ON / SMART)`;
  }

  private installClickBridge(): void {
    this.clickBridge = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              "#previous, #next, #shuffle, #repeat, #play",
            )
          : null;
      if (!target || !this.container?.contains(target)) return;

      const intercept = (action: () => void) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        action();
      };

      switch (target.id) {
        case "previous":
          intercept(() => this.adapterHooks.previous());
          break;
        case "next":
          intercept(() => this.adapterHooks.next());
          break;
        case "shuffle":
          intercept(() => {
            this.suppressToggleSyncUntil = Date.now() + 1600;
            this.adapterHooks.toggleShuffle();
            this.scheduleToggleRefresh();
            this.scheduleShuffleNotice();
          });
          break;
        case "repeat":
          intercept(() => {
            this.suppressToggleSyncUntil = Date.now() + 1200;
            this.adapterHooks.toggleRepeat();
            this.scheduleToggleRefresh();
          });
          break;
        case "play":
          if (this.webamp?.getPlaylistTracks().length === 0) {
            intercept(() => {
              void this.adapterHooks.play();
              this.scheduleStateRefresh();
            });
          }
          break;
      }
    };
    this.doc.addEventListener("click", this.clickBridge, true);
  }

  private scheduleToggleRefresh(): void {
    const timer = this.win.setTimeout(() => {
      this.timers.delete(timer);
      this.syncSnapshot(this.adapterHooks.getSnapshot());
    }, 1000);
    this.timers.add(timer);
  }

  private scheduleShuffleNotice(): void {
    const timer = this.win.setTimeout(() => {
      this.timers.delete(timer);
      const mode = this.adapterHooks.getSnapshot().shuffle;
      const label =
        mode === "smart" ? "SMART" : mode === "on" ? "ON" : "OFF";
      this.adapterHooks.onNotice(`SHUFFLE: ${label}`);
    }, 900);
    this.timers.add(timer);
  }

  private scheduleStateRefresh(): void {
    const timer = this.win.setTimeout(() => {
      this.timers.delete(timer);
      this.syncSnapshot(this.adapterHooks.getSnapshot());
    }, 1600);
    this.timers.add(timer);
  }
}
