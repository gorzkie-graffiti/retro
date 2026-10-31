import { describe, expect, it, vi } from "vitest";
import { createSpotifyMediaClass } from "../src/content/webamp/spotifyMedia";
import type { WebampAdapterHooks } from "../src/content/webamp/webampTypes";
import type { PlaybackSnapshot, TrackInfo } from "../src/content/types";

const track: TrackInfo = {
  id: "abc",
  title: "Song",
  artist: "Artist",
  album: "Album",
  durationSec: 200,
  artUrl: null,
  url: "spotamp:track:abc",
};

const snapshot: PlaybackSnapshot = {
  available: true,
  playing: true,
  positionSec: 12,
  durationSec: 200,
  volume: 80,
  shuffle: "off",
  repeat: "off",
  track,
  canSkipNext: true,
  canSkipPrevious: true,
  canSeek: true,
};

function makeHooks() {
  const hooks: WebampAdapterHooks & {
    resolveTrack: (url: string) => TrackInfo | null;
  } = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    playTrack: vi.fn(async () => true),
    play: vi.fn(async () => true),
    pause: vi.fn(async () => true),
    next: vi.fn(() => true),
    previous: vi.fn(() => true),
    toggleShuffle: vi.fn(() => true),
    toggleRepeat: vi.fn(() => true),
    seekToPercent: vi.fn(() => true),
    seekToSeconds: vi.fn(() => true),
    setVolume: vi.fn(() => true),
    onNotice: vi.fn(),
    resolveTrack: (url) => (url === track.url ? track : null),
  };
  return hooks;
}

describe("SpotifyMedia (Webamp custom media)", () => {
  it("delegates transport, seek and volume commands to Spotify", async () => {
    const hooks = makeHooks();
    const Media = createSpotifyMediaClass(hooks);
    const media = new Media();

    await media.play();
    media.pause();
    media.seekToPercentComplete(42);
    media.setVolume(55);

    expect(hooks.play).toHaveBeenCalledTimes(1);
    expect(hooks.pause).toHaveBeenCalledTimes(1);
    expect(hooks.seekToPercent).toHaveBeenCalledWith(42);
    expect(hooks.setVolume).toHaveBeenCalledWith(55);
    expect(media.timeElapsed()).toBe(12);
    expect(media.duration()).toBe(200);
    media.dispose();
  });

  it("loads Spotamp playlist entries as real Spotify row plays", async () => {
    const hooks = makeHooks();
    const Media = createSpotifyMediaClass(hooks);
    const media = new Media();

    await media.loadFromUrl("spotamp:track:abc", true);
    expect(hooks.playTrack).toHaveBeenCalledWith(track);

    await media.loadFromUrl("spotamp:track:abc", false);
    expect(hooks.playTrack).toHaveBeenCalledTimes(1);

    media.suppressNextLoad = true;
    await media.loadFromUrl("spotamp:track:abc", true);
    expect(hooks.playTrack).toHaveBeenCalledTimes(1);
    media.dispose();
  });

  it("rejects local files and unknown entries honestly", async () => {
    const hooks = makeHooks();
    const Media = createSpotifyMediaClass(hooks);
    const media = new Media();

    await media.loadFromUrl("file:///music.mp3", true);
    expect(hooks.onNotice).toHaveBeenCalledWith(
      expect.stringContaining("Spotify is the only audio source"),
    );

    await media.loadFromUrl("spotamp:match:unknown", true);
    expect(hooks.onNotice).toHaveBeenCalledWith(
      expect.stringContaining("not on the current Spotify page"),
    );
    expect(hooks.playTrack).not.toHaveBeenCalled();
    media.dispose();
  });

  it("does not pause Spotify when Webamp rebuilds its playlist", () => {
    const hooks = makeHooks();
    const Media = createSpotifyMediaClass(hooks);
    const media = new Media();
    media.suppressStop = true;
    media.stop();
    expect(hooks.pause).not.toHaveBeenCalled();
    media.dispose();
  });

  it("emits time updates and provides a silent analyser", () => {
    const hooks = makeHooks();
    const Media = createSpotifyMediaClass(hooks);
    const media = new Media();
    const listener = vi.fn();
    media.on("timeupdate", listener);
    media.emitTimeUpdate();
    expect(listener).toHaveBeenCalledTimes(1);

    const analyser = media.getAnalyser();
    const data = new Uint8Array(8);
    data.fill(255);
    analyser.getByteFrequencyData(data);
    expect(Array.from(data)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    media.dispose();
  });
});
