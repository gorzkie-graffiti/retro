import { detectRoute } from "./pageDetector";
import type { RouteInfo } from "./types";

export interface NavigationWatcherOptions {
  doc: Document;
  win: Window;
  onRoute(route: RouteInfo): void;
  /** Called after route checks so consumers can pick up late-rendered DOM. */
  onPulse?: () => void;
  getHref?: () => string;
  observeSelector?: string;
  intervalMs?: number;
  debounceMs?: number;
}

export class NavigationWatcher {
  private readonly doc: Document;
  private readonly win: Window;
  private readonly onRoute: (route: RouteInfo) => void;
  private readonly onPulse: (() => void) | undefined;
  private readonly getHref: () => string;
  private readonly observeSelector: string;
  private readonly intervalMs: number;
  private readonly debounceMs: number;

  private observer: MutationObserver | null = null;
  private interval: number | null = null;
  private debounceTimer: number | null = null;
  private lastSignature = "";
  private started = false;
  private readonly handlePopState = () => this.scheduleCheck(0);

  constructor(options: NavigationWatcherOptions) {
    this.doc = options.doc;
    this.win = options.win;
    this.onRoute = options.onRoute;
    this.onPulse = options.onPulse;
    this.getHref =
      options.getHref ??
      (() => this.win.location?.href ?? this.doc.location?.href ?? "/");
    this.observeSelector = options.observeSelector ?? "#main";
    this.intervalMs = options.intervalMs ?? 1200;
    this.debounceMs = options.debounceMs ?? 220;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.checkNow();

    const target =
      this.doc.querySelector(this.observeSelector) ??
      this.doc.body ??
      this.doc.documentElement;
    if (target && typeof MutationObserver !== "undefined") {
      this.observer = new MutationObserver(() => this.scheduleCheck());
      this.observer.observe(target, { childList: true, subtree: true });
    }

    this.interval = this.win.setInterval(
      () => this.checkNow(),
      this.intervalMs,
    );
    this.win.addEventListener("popstate", this.handlePopState);
    this.win.addEventListener("hashchange", this.handlePopState);
  }

  stop(): void {
    this.started = false;
    this.observer?.disconnect();
    this.observer = null;
    if (this.interval != null) {
      this.win.clearInterval(this.interval);
      this.interval = null;
    }
    if (this.debounceTimer != null) {
      this.win.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.win.removeEventListener("popstate", this.handlePopState);
    this.win.removeEventListener("hashchange", this.handlePopState);
    this.lastSignature = "";
  }

  /** Exposed for tests; also used as the interval fallback. */
  checkNow(): RouteInfo {
    const route = detectRoute(this.doc, this.getHref());
    const signature = `${route.kind}|${route.url}|${route.label}`;
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.onRoute(route);
    }
    this.onPulse?.();
    return route;
  }

  private scheduleCheck(delay = this.debounceMs): void {
    if (!this.started) return;
    if (this.debounceTimer != null) this.win.clearTimeout(this.debounceTimer);
    this.debounceTimer = this.win.setTimeout(() => {
      this.debounceTimer = null;
      this.checkNow();
    }, delay);
  }
}
