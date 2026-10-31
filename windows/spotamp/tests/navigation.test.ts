import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationWatcher } from "../src/content/navigation";
import type { RouteInfo } from "../src/content/types";

describe("NavigationWatcher", () => {
  let href = "https://open.spotify.com/";
  let routes: RouteInfo[] = [];
  let pulses = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    href = "https://open.spotify.com/";
    routes = [];
    pulses = 0;
    document.body.innerHTML = '<div id="main"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  function createWatcher(): NavigationWatcher {
    return new NavigationWatcher({
      doc: document,
      win: window,
      getHref: () => href,
      onRoute: (route) => routes.push(route),
      onPulse: () => {
        pulses += 1;
      },
      intervalMs: 1000,
      debounceMs: 10,
    });
  }

  it("emits once per route signature, not on every check", () => {
    const watcher = createWatcher();
    watcher.start();
    expect(routes.map((route) => route.kind)).toEqual(["home"]);

    watcher.checkNow();
    watcher.checkNow();
    expect(routes).toHaveLength(1);

    href = "https://open.spotify.com/search";
    watcher.checkNow();
    expect(routes.map((route) => route.kind)).toEqual(["home", "search"]);

    watcher.stop();
  });

  it("picks up late-rendered entity titles as a route update", () => {
    href = "https://open.spotify.com/playlist/abc";
    document.querySelector("#main")!.innerHTML =
      '<section data-testid="playlist-page"><span data-testid="entityTitle"><h1>Chill</h1></span></section>';
    const watcher = createWatcher();
    watcher.start();
    expect(routes[0]?.label).toBe("Chill");

    document.querySelector('[data-testid="entityTitle"] h1')!.textContent =
      "Night Drive";
    watcher.checkNow();
    expect(routes).toHaveLength(2);
    expect(routes[1]?.label).toBe("Night Drive");
    watcher.stop();
  });

  it("calls the pulse hook and stops all timers and listeners", () => {
    const watcher = createWatcher();
    watcher.start();
    expect(pulses).toBeGreaterThanOrEqual(1);

    watcher.stop();
    const pulsesAtStop = pulses;
    const routesAtStop = routes.length;
    vi.advanceTimersByTime(5000);
    expect(pulses).toBe(pulsesAtStop);
    expect(routes).toHaveLength(routesAtStop);
  });
});
