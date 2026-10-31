import { SPOTAMP_MATCH_SCHEME, SPOTAMP_TRACK_SCHEME } from "../types";
import type { TrackInfo } from "../types";
import type { SpotampMedia, WebampControllerHooks } from "./webampTypes";

type MediaListener = (...args: any[]) => void;

/**
 * Webamp's UI dispatches play/pause/seek/volume/load commands to this class.
 * We translate those commands into Spotify's own DOM controls. No audio is
 * ever decoded, proxied or captured by the extension.
 */
export function createSpotifyMediaClass(
  hooks: WebampControllerHooks,
): new () => SpotampMedia {
  return class SpotifyMedia implements SpotampMedia {
    suppressStop = false;
    suppressNextLoad = false;

    private listeners = new Map<string, Set<MediaListener>>();
    private analyser: AnalyserNode | null = null;

    setVolume(volume: number): void {
      hooks.setVolume(Math.max(0, Math.min(100, volume)));
    }

    setBalance(_balance: number): void {
      // Spotify's web player has no stereo balance control. Webamp's balance
      // slider remains an internal display; it is not applied to the stream.
    }

    setPreamp(_value: number): void {
      // See the EQ limitation documented in the status strip and README.
    }

    on(event: string, callback: MediaListener): void {
      let callbacks = this.listeners.get(event);
      if (!callbacks) {
        callbacks = new Set();
        this.listeners.set(event, callbacks);
      }
      callbacks.add(callback);
    }

    timeElapsed(): number {
      return hooks.getSnapshot().positionSec;
    }

    duration(): number {
      return hooks.getSnapshot().durationSec;
    }

    async play(): Promise<void> {
      await hooks.play();
    }

    pause(): void {
      void hooks.pause();
    }

    stop(): void {
      if (this.suppressStop) {
        this.suppressStop = false;
        return;
      }
      void hooks.pause();
      hooks.seekToSeconds(0);
    }

    seekToPercentComplete(percent: number): void {
      hooks.seekToPercent(percent);
    }

    async loadFromUrl(url: string, autoPlay: boolean): Promise<void> {
      if (this.suppressNextLoad) {
        this.suppressNextLoad = false;
        return;
      }
      // Webamp buffers the first item with autoPlay=false. In Spotamp that is
      // only a playlist metadata load, not a playback request.
      if (!autoPlay) return;

      if (!url.startsWith(SPOTAMP_TRACK_SCHEME) && !url.startsWith(SPOTAMP_MATCH_SCHEME)) {
        hooks.onNotice(
          "Local files and arbitrary URLs cannot be played in Spotamp. Spotify is the only audio source.",
        );
        return;
      }

      const track: TrackInfo | null = hooks.resolveTrack(url);
      if (!track) {
        hooks.onNotice(
          "That Webamp playlist entry is not on the current Spotify page. Navigate to its album or playlist in Spotify and try again.",
        );
        return;
      }
      await hooks.playTrack(track);
    }

    setEqBand(_band: string | number, _value: number): void {
      // EQ is display-only; see the README limitation.
    }

    disableEq(): void {
      // EQ is display-only; see the README limitation.
    }

    enableEq(): void {
      // EQ is display-only; see the README limitation.
    }

    getAnalyser(): AnalyserNode {
      if (!this.analyser) {
        this.analyser = createSilentAnalyser();
      }
      return this.analyser;
    }

    dispose(): void {
      this.listeners.clear();
      this.analyser = null;
    }

    emitTimeUpdate(): void {
      this.emit("timeupdate");
    }

    emit(event: string, ...args: any[]): void {
      const callbacks = this.listeners.get(event);
      if (!callbacks) return;
      for (const callback of callbacks) {
        try {
          callback(...args);
        } catch (error) {
          hooks.logger?.warn("[Spotamp] Webamp media event failed", error);
        }
      }
    }
  };
}

/**
 * Webamp's analyser expects an AnalyserNode. Spotify audio is not routed
 * through the extension, so the honest visualization is silence rather than a
 * fabricated spectrum.
 */
function createSilentAnalyser(): AnalyserNode {
  const stub = {
    fftSize: 2048,
    frequencyBinCount: 1024,
    minDecibels: -100,
    maxDecibels: -30,
    smoothingTimeConstant: 0.8,
    getByteFrequencyData(data: Uint8Array) {
      data.fill(0);
    },
    getByteTimeDomainData(data: Uint8Array) {
      data.fill(128);
    },
    getFloatFrequencyData(data: Float32Array) {
      data.fill(-Infinity);
    },
    getFloatTimeDomainData(data: Float32Array) {
      data.fill(0);
    },
    connect() {},
    disconnect() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
    context: null,
    numberOfInputs: 0,
    numberOfOutputs: 0,
    channelCount: 2,
    channelCountMode: "max",
    channelInterpretation: "speakers",
  };
  return stub as unknown as AnalyserNode;
}
