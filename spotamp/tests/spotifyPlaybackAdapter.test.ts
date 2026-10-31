import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpotifyPlaybackAdapter } from "../src/content/playback/spotifyPlaybackAdapter";
import { EMPTY_SNAPSHOT, readPlaybackSnapshot } from "../src/content/playback/spotifyDom";
import { PLAYER_HTML, TRACK_ROW_HTML } from "./fixtures";

function makeAdapter() {
  const logger = { warn: vi.fn(), info: vi.fn() };
  const adapter = new SpotifyPlaybackAdapter({
    doc: document,
    win: window,
    logger,
  });
  return { adapter, logger };
}

describe("readPlaybackSnapshot", () => {
  beforeEach(() => {
    document.body.innerHTML = PLAYER_HTML;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("reads state from accessible labels, test ids and range inputs", () => {
    const snapshot = readPlaybackSnapshot(document, []);
    expect(snapshot.available).toBe(true);
    expect(snapshot.playing).toBe(false);
    expect(snapshot.positionSec).toBe(3);
    expect(snapshot.durationSec).toBe(210);
    expect(snapshot.volume).toBe(70);
    expect(snapshot.canSkipPrevious).toBe(false);
    expect(snapshot.canSkipNext).toBe(true);
    expect(snapshot.canSeek).toBe(true);
    expect(snapshot.track?.title).toBe("Song One");
    expect(snapshot.track?.artist).toBe("Artist A");
  });

  it("follows play/pause and repeat state", () => {
    document.querySelector('[data-testid="control-button-playpause"]')!
      .setAttribute("aria-label", "Pause");
    document
      .querySelector('[data-testid="control-button-repeat"]')!
      .setAttribute("aria-checked", "true");
    document
      .querySelector('[data-testid="control-button-repeat"]')!
      .setAttribute("aria-label", "Disable repeat");

    const snapshot = readPlaybackSnapshot(document, []);
    expect(snapshot.playing).toBe(true);
    expect(snapshot.repeat).toBe("context");
  });

  it("cycles the three Spotify shuffle modes from accessible labels", () => {
    const button = document.querySelector<HTMLElement>(
      '[aria-label="Shuffle"]',
    )!;

    button.setAttribute("aria-label", "Enable Smart Shuffle for Chill");
    expect(readPlaybackSnapshot(document, []).shuffle).toBe("off");

    button.setAttribute("aria-label", "Disable shuffle");
    expect(readPlaybackSnapshot(document, []).shuffle).toBe("on");

    button.setAttribute("aria-label", "Disable Smart Shuffle for Chill");
    expect(readPlaybackSnapshot(document, []).shuffle).toBe("smart");
  });

  it("degrades to an unavailable snapshot on a page without player controls", () => {
    document.body.innerHTML = "<main></main>";
    expect(readPlaybackSnapshot(document, [])).toEqual(EMPTY_SNAPSHOT);
  });
});

describe("SpotifyPlaybackAdapter actions", () => {
  beforeEach(() => {
    document.body.innerHTML = PLAYER_HTML;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("plays and pauses through Spotify's own button", async () => {
    const { adapter, logger } = makeAdapter();
    const click = vi.fn();
    const button = document.querySelector(
      '[data-testid="control-button-playpause"]',
    )!;
    button.addEventListener("click", click);
    adapter.start();

    await adapter.play();
    expect(click).toHaveBeenCalledTimes(1);

    button.setAttribute("aria-label", "Pause");
    await adapter.pause();
    expect(click).toHaveBeenCalledTimes(2);
    expect(logger.warn).not.toHaveBeenCalled();

    adapter.stop();
  });

  it("reports a failed play command instead of faking success", async () => {
    const { adapter, logger } = makeAdapter();
    adapter.start();
    await adapter.play();
    vi.advanceTimersByTime(1500);
    expect(logger.warn).toHaveBeenCalledWith(
      "[Spotamp] Spotify did not start playback after the play command.",
    );
    adapter.stop();
  });

  it("cycles shuffle through Spotify and reports the new mode", () => {
    const { adapter, logger } = makeAdapter();
    const button = document.querySelector<HTMLElement>(
      '[aria-label="Shuffle"]',
    )!;
    button.setAttribute("aria-label", "Enable Smart Shuffle for Chill");
    button.addEventListener("click", () => {
      button.setAttribute("aria-label", "Disable shuffle");
    });

    expect(adapter.getSnapshot().shuffle).toBe("off");
    expect(adapter.toggleShuffle()).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(adapter.getSnapshot().shuffle).toBe("on");
    expect(logger.warn).not.toHaveBeenCalled();
    adapter.stop();
  });

  it("reports a shuffle command that Spotify ignores", () => {
    const { adapter, logger } = makeAdapter();
    const button = document.querySelector<HTMLElement>(
      '[aria-label="Shuffle"]',
    )!;
    button.setAttribute("aria-label", "Enable Smart Shuffle for Chill");

    expect(adapter.toggleShuffle()).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(logger.warn).toHaveBeenCalledWith(
      "[Spotamp] Spotify did not change shuffle mode after the command.",
    );
    adapter.stop();
  });

  it("clicks skip forward and reports disabled previous", () => {
    const { adapter, logger } = makeAdapter();
    const forward = vi.fn();
    document
      .querySelector('[data-testid="control-button-skip-forward"]')!
      .addEventListener("click", forward);

    expect(adapter.next()).toBe(true);
    expect(forward).toHaveBeenCalledTimes(1);
    expect(adapter.previous()).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      "[Spotamp] Previous track is unavailable in Spotify right now.",
    );
    adapter.stop();
  });

  it("seeks through the native range setter and fires input/change", () => {
    const { adapter } = makeAdapter();
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="playback-progressbar"] input',
    )!;
    const inputEvent = vi.fn();
    input.addEventListener("input", inputEvent);

    expect(adapter.seekToPercent(50)).toBe(true);
    expect(input.value).toBe("105000");
    expect(inputEvent).toHaveBeenCalledTimes(1);
    expect(adapter.getSnapshot().positionSec).toBe(105);
    adapter.stop();
  });

  it("changes volume through Spotify's volume range", () => {
    const { adapter } = makeAdapter();
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="volume-bar"] input',
    )!;
    expect(adapter.setVolume(20)).toBe(true);
    expect(input.value).toBe("0.2");
    adapter.stop();
  });

  it("plays a row on the current page and refuses missing rows", async () => {
    document.body.innerHTML = `${PLAYER_HTML}<div id="rows">${TRACK_ROW_HTML}</div>`;
    const { adapter, logger } = makeAdapter();
    const rowButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="tracklist-row"] [data-testid="play-button"]',
    )!;
    const click = vi.fn();
    rowButton.addEventListener("click", click);

    const track = {
      id: "track-bbb",
      title: "Other Song",
      artist: "Artist B",
      album: "Another Album",
      durationSec: 252,
      artUrl: "https://img.example/other.jpg",
      url: "spotamp:track:track-bbb",
    };
    adapter.setPageTracks([track]);
    expect(await adapter.playTrack(track)).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);

    await adapter.playTrack({
      ...track,
      id: "missing",
      title: "Missing Song",
      artist: "Nobody",
      url: "spotamp:track:missing",
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "[Spotamp] Cannot play “Missing Song”: it is not present on this Spotify page.",
    );
    adapter.stop();
  });

  it("reports missing controls and cleans up subscribers", async () => {
    document.body.innerHTML = "<main></main>";
    const { adapter, logger } = makeAdapter();
    const errors: string[] = [];
    const unsubscribe = adapter.onError((message) => errors.push(message));
    expect(await adapter.play()).toBe(false);
    expect(errors[0]).toContain("not ready");
    expect(adapter.getSnapshot().available).toBe(false);
    expect(logger.warn).toHaveBeenCalled();

    unsubscribe();
    adapter.stop();
    expect(errors).toHaveLength(1);
  });
});
