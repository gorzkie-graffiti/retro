import { applyPageAdapter } from "./adapters";
import { applyPlayerDom, clearPlayerDom } from "./adapters/player";
import { applySidebar, clearSidebar } from "./adapters/sidebar";
import { NavigationWatcher } from "./navigation";
import { detectRoute } from "./pageDetector";
import {
  SpotifyPlaybackAdapter,
  type PlaybackAdapterOptions,
} from "./playback/spotifyPlaybackAdapter";
import { PAGE_CLASSES, SELECTORS, pageClass } from "./selectors";
import {
  DEFAULT_SCALE,
  normalizeScale,
  type SettingsBackend,
} from "./settings";
import { collectPageTracks } from "./tracks";
import type {
  PlaybackSnapshot,
  RouteInfo,
  TrackInfo,
} from "./types";
import { LibraryWindow } from "./ui/libraryWindow";
import { StatusStrip } from "./ui/statusStrip";
import {
  updateLayoutMetrics,
  watchLayoutMetrics,
} from "./ui/metrics";
import type {
  WebampAdapterHooks,
} from "./webamp/webampTypes";

export interface WebampController {
  mount(): Promise<void>;
  destroy(): void;
  applyPage(tracks: TrackInfo[]): void;
  reopen(): void;
  isOpen(): boolean;
}

export interface SpotampAppOptions {
  doc?: Document;
  win?: Window;
  cssText: string;
  settings: SettingsBackend;
  createWebamp: (
    hooks: WebampAdapterHooks,
    doc: Document,
    win: Window,
    playback: PlaybackAdapterOptions,
  ) => WebampController | null;
  logger?: Pick<Console, "info" | "warn" | "error">;
}

const STYLE_ID = "spotamp-style";
const LOGIN_PATH = /^\/(login|signup|download|premium)(\/|$)/;

/** Preserve the original roomy default where both windows comfortably fit. */
function defaultScale(win: Window): number {
  return win.innerWidth >= 1600 && win.innerHeight >= 800 ? 2 : 1;
}

export class SpotampApp {
  readonly doc: Document;
  private readonly win: Window;
  private readonly cssText: string;
  private readonly settings: SettingsBackend;
  private readonly createWebamp: SpotampAppOptions["createWebamp"];
  private readonly logger: Pick<Console, "info" | "warn" | "error">;

  private unsubscribeSettings: (() => void) | null = null;
  private unsubscribeScale: (() => void) | null = null;
  private navigation: NavigationWatcher | null = null;
  private adapter: SpotifyPlaybackAdapter | null = null;
  private unsubscribeAdapter: (() => void) | null = null;
  private unsubscribeAdapterError: (() => void) | null = null;
  private unsubscribeMetrics: (() => void) | null = null;
  private webamp: WebampController | null = null;
  private status: StatusStrip | null = null;
  private library: LibraryWindow | null = null;

  private enabled = false;
  private active = false;
  private starting = false;
  private scale = DEFAULT_SCALE;
  private styleEl: HTMLStyleElement | null = null;
  private lastTrackSignature = "";

  constructor(options: SpotampAppOptions) {
    this.doc = options.doc ?? document;
    this.win = options.win ?? window;
    this.cssText = options.cssText;
    this.settings = options.settings;
    this.createWebamp = options.createWebamp;
    this.logger = options.logger ?? console;
  }

  async start(): Promise<void> {
    if (this.starting || this.enabled) return;
    this.starting = true;
    this.unsubscribeSettings = this.settings.subscribe((enabled) => {
      if (enabled) void this.enable();
      else this.disable();
    });
    this.unsubscribeScale = this.settings.subscribeScale((scale) => {
      this.setScale(scale);
    });
    const stored = await this.settings.getScale();
    this.scale = normalizeScale(stored ?? defaultScale(this.win));
    const enabled = await this.settings.getEnabled();
    this.starting = false;
    if (enabled) await this.enable();
  }

  async enable(): Promise<void> {
    if (this.enabled) return;
    this.enabled = true;
    this.navigation = new NavigationWatcher({
      doc: this.doc,
      win: this.win,
      onRoute: (route) => this.onRoute(route),
      onPulse: () => this.onPulse(),
    });
    this.navigation.start();
    if (this.isSpotifyApp()) await this.mountChrome();
  }

  disable(): void {
    if (!this.enabled && !this.active) return;
    this.enabled = false;
    this.navigation?.stop();
    this.navigation = null;
    this.unmountChrome();
    this.removeTheme();
    this.logger.info?.("[Spotamp] disabled; Spotify interface restored");
  }

  async stop(): Promise<void> {
    this.disable();
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
    this.unsubscribeScale?.();
    this.unsubscribeScale = null;
  }

  private async mountChrome(): Promise<void> {
    if (this.active || !this.enabled) return;
    this.active = true;
    const stored = await this.settings.getScale();
    this.scale = normalizeScale(stored ?? defaultScale(this.win));
    if (!this.active) return;

    this.injectTheme();
    this.doc.documentElement.classList.add("spotamp-active");

    const adapter = new SpotifyPlaybackAdapter({
      doc: this.doc,
      win: this.win,
      logger: this.logger,
    });
    this.adapter = adapter;

    const status = new StatusStrip({
      doc: this.doc,
      onDisable: () => {
        void this.settings.setEnabled(false);
      },
      onPlayer: () => this.webamp?.reopen(),
      onShuffle: () => {
        this.adapter?.toggleShuffle();
      },
      onLibrary: () => this.library?.show(),
      onDoubleSize: () => this.toggleDoubleSize(),
    });
    this.status = status;

    this.library = new LibraryWindow({
      doc: this.doc,
      win: this.win,
      onSearch: (query) => this.navigateToSearch(query),
      logger: this.logger,
    });
    this.doc.documentElement.classList.add("spotamp-shell");
    this.applyScale();
    if (stored == null) void this.settings.setScale(this.scale);

    const hooks: WebampAdapterHooks = {
      getSnapshot: () => adapter.getSnapshot(),
      subscribe: (listener) => adapter.subscribe(listener),
      playTrack: (track) => adapter.playTrack(track),
      play: () => adapter.play(),
      pause: () => adapter.pause(),
      next: () => adapter.next(),
      previous: () => adapter.previous(),
      toggleShuffle: () => adapter.toggleShuffle(),
      toggleRepeat: () => adapter.toggleRepeat(),
      seekToPercent: (percent) => adapter.seekToPercent(percent),
      seekToSeconds: (seconds) => adapter.seekToSeconds(seconds),
      setVolume: (volume) => adapter.setVolume(volume),
      onNotice: (message) => this.status?.setNotice(message),
      onOpenChange: (open) => this.status?.setPlayerOpen(open),
      logger: this.logger,
    };

    try {
      const webamp = this.createWebamp(hooks, this.doc, this.win, {
        doc: this.doc,
        win: this.win,
        logger: this.logger,
      });
      if (!webamp) {
        status.setNotice("Winamp could not start in this browser. The Spotamp theme remains active.");
      } else {
        this.webamp = webamp;
        await webamp.mount();
        if (!this.active) {
          webamp.destroy();
          this.webamp = null;
          return;
        }
      }
    } catch (error) {
      this.logger.error("[Spotamp] Webamp failed to mount", error);
      status.setNotice(
        "Winamp failed to render. Spotify controls are untouched; disable Spotamp with OFF.",
      );
      this.webamp = null;
    }

    this.unsubscribeAdapter = adapter.subscribe((snapshot) =>
      this.onPlayback(snapshot),
    );
    this.unsubscribeAdapterError = adapter.onError((message) =>
      this.status?.setNotice(message),
    );
    adapter.start();

    this.unsubscribeMetrics = watchLayoutMetrics(this.doc);
    const initial = detectRoute(this.doc, this.win.location?.href ?? "/");
    this.applyRoute(initial, true);
    this.onPlayback(adapter.getSnapshot());
    this.status?.setPlayerOpen(this.webamp?.isOpen() ?? false);

    if (!this.doc.querySelector(SELECTORS.playerBar)) {
      this.status?.setNotice(
        "Spotify's player bar is not present yet. Styling will reconnect when it appears.",
        "info",
      );
    }
  }

  private unmountChrome(): void {
    if (!this.active) return;
    this.active = false;

    this.unsubscribeMetrics?.();
    this.unsubscribeMetrics = null;
    this.unsubscribeAdapter?.();
    this.unsubscribeAdapter = null;
    this.unsubscribeAdapterError?.();
    this.unsubscribeAdapterError = null;
    this.adapter?.stop();
    this.adapter = null;

    this.webamp?.destroy();
    this.webamp = null;
    this.status?.destroy();
    this.status = null;
    this.library?.destroy();
    this.library = null;
    this.doc.documentElement.classList.remove("spotamp-shell", "spotamp-double");
    this.doc.documentElement.style.removeProperty("--spotamp-ui-scale");
    this.doc.documentElement.style.removeProperty("--spotamp-ui-inv-scale");

    clearPlayerDom(this.doc);
    clearSidebar(this.doc);
    this.clearPageClasses();
    this.lastTrackSignature = "";
  }

  private onRoute(route: RouteInfo): void {
    if (!this.enabled) return;
    const eligible = this.isSpotifyApp();
    if (!eligible) {
      if (this.active) this.unmountChrome();
      this.removeTheme();
      return;
    }
    if (!this.active) {
      void this.mountChrome();
      return;
    }
    this.applyRoute(route, false);
  }

  private onPulse(): void {
    if (!this.enabled) return;
    if (!this.active) {
      // The content script can run before Spotify has mounted its app shell.
      // Mount as soon as the shell appears instead of waiting for a route
      // change that may never come on the current page.
      if (this.isSpotifyApp()) void this.mountChrome();
      return;
    }
    this.refreshDom();
  }

  private applyRoute(route: RouteInfo, initial: boolean): void {
    if (!this.active) return;
    this.clearPageClasses();
    this.doc.documentElement.classList.add("spotamp-active");
    this.doc.documentElement.classList.add(pageClass(route.kind));
    this.doc.documentElement.dataset.spotampPage = route.kind;
    this.doc.documentElement.dataset.spotampPageLabel = route.label;

    applyPageAdapter(this.doc, route.kind);
    applySidebar(this.doc);
    applyPlayerDom(this.doc);
    updateLayoutMetrics(this.doc);
    this.status?.setPage(route.label);
    this.library?.update(route.url, route.label);

    this.refreshDom(true);

    if (initial) {
      this.logger.info?.(`[Spotamp] route ready: ${route.kind} (${route.url})`);
    }
  }

  private refreshDom(force = false): void {
    if (!this.active || !this.adapter) return;

    applySidebar(this.doc);
    applyPlayerDom(this.doc);
    updateLayoutMetrics(this.doc);
    this.library?.update(
      this.win.location?.pathname ?? "/",
      this.doc.documentElement.dataset.spotampPageLabel ?? "",
    );

    const tracks = collectPageTracks(this.doc);
    const signature = tracks.map((track) => track.url).join("|");
    if (force || signature !== this.lastTrackSignature) {
      this.lastTrackSignature = signature;
      this.adapter.setPageTracks(tracks);
      this.webamp?.applyPage(tracks);
    }
  }

  private onPlayback(snapshot: PlaybackSnapshot): void {
    this.status?.setPlayback(snapshot);
    this.status?.setPlayerOpen(this.webamp?.isOpen() ?? false);
  }

  /** The 2X button is a shortcut for the persisted 100%/200% scale toggle. */
  private toggleDoubleSize(): void {
    if (!this.active) return;
    const next = this.scale >= 1.75 ? 1 : 2;
    void this.setScale(next);
    this.status?.setNotice(
      next === 2 ? "WINDOWS: 200%" : "WINDOWS: 100%",
      "info",
    );
  }

  /** Apply a scale locally first so the strip responds even without storage. */
  private setScale(scale: number): void {
    const next = normalizeScale(scale);
    if (this.scale === next && this.doc.documentElement.style.getPropertyValue("--spotamp-ui-scale")) {
      return;
    }
    this.scale = next;
    this.applyScale();
    void this.settings.setScale(next);
  }

  private applyScale(): void {
    const root = this.doc.documentElement;
    root.style.setProperty("--spotamp-ui-scale", String(this.scale));
    root.style.setProperty(
      "--spotamp-ui-inv-scale",
      String(Math.round((1 / this.scale) * 10000) / 10000),
    );
    root.classList.toggle("spotamp-double", this.scale >= 1.75);
    this.status?.setScale(this.scale);
    // A dragged position from another scale would fight the active layout.
    this.library?.resetPosition();
    if (this.webamp) this.win.dispatchEvent(new Event("resize"));
  }

  private navigateToSearch(query: string): void {
    const clean = query.trim();
    if (!clean) return;
    this.win.location.assign(`/search/${encodeURIComponent(clean)}`);
  }

  private isSpotifyApp(): boolean {
    const path = this.win.location?.pathname ?? "/";
    if (LOGIN_PATH.test(path)) return false;
    return Boolean(this.doc.querySelector(SELECTORS.appRoot));
  }

  private injectTheme(): void {
    if (!this.styleEl || !this.styleEl.isConnected) {
      this.styleEl = this.doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    }
    if (!this.styleEl) {
      this.styleEl = this.doc.createElement("style");
      this.styleEl.id = STYLE_ID;
      this.styleEl.textContent = this.cssText;
      (this.doc.head ?? this.doc.documentElement).appendChild(this.styleEl);
    }
    this.doc.documentElement.classList.add("spotamp-active");
  }

  private removeTheme(): void {
    this.doc.documentElement.classList.remove(
      "spotamp-active",
      "spotamp-shell",
      "spotamp-double",
    );
    this.doc.documentElement.style.removeProperty("--spotamp-ui-scale");
    this.doc.documentElement.style.removeProperty("--spotamp-ui-inv-scale");
    this.clearPageClasses();
    delete this.doc.documentElement.dataset.spotampPage;
    delete this.doc.documentElement.dataset.spotampPageLabel;
    this.doc.documentElement.style.removeProperty("--spotamp-bar-h");
    this.styleEl?.remove();
    this.styleEl = null;
  }

  private clearPageClasses(): void {
    this.doc.documentElement.classList.remove(...PAGE_CLASSES);
  }
}
