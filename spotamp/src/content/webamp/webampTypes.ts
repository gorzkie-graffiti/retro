import type { PlaybackSnapshot, TrackInfo } from "../types";

export interface WebampTrack {
  url: string;
  metaData: {
    artist: string;
    title: string;
    album?: string;
    albumArtUrl?: string;
  };
  duration?: number;
}

export interface WebampPlaylistTrack {
  id: number;
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  duration: number | null;
}

export interface WebampStoreState {
  media: { status: string; timeElapsed: number };
  playlist: { currentTrack: number | null; trackOrder: number[] };
}

export interface WebampWindowLayout {
  main: { position: { left: number; top: number } };
  equalizer: { position: { left: number; top: number } };
  playlist: {
    position: { left: number; top: number };
    size?: { extraHeight: number; extraWidth: number };
  };
}

export interface WebampOptions {
  initialTracks?: WebampTrack[];
  availableSkins?: { url: string; name: string }[];
  windowLayout?: WebampWindowLayout;
  enableHotkeys?: boolean;
  enableMediaSession?: boolean;
  enableDoubleSizeMode?: boolean;
  zIndex?: number;
  __customMediaClass?: new () => SpotampMedia;
}

export interface WebampInstance {
  renderInto(node: HTMLElement): Promise<void>;
  dispose(): void;
  close(): void;
  reopen(): void;
  setTracks(tracks: WebampTrack[]): void;
  appendTracks(tracks: WebampTrack[]): void;
  getPlaylistTracks(): WebampPlaylistTrack[];
  setVolume(volume: number): void;
  isShuffleEnabled(): boolean;
  toggleShuffle(): void;
  isRepeatEnabled(): boolean;
  toggleRepeat(): void;
  getPlayerMediaStatus(): string;
  onClose(cb: () => void): () => void;
  store: {
    dispatch(action: any): any;
    getState(): WebampStoreState;
  };
}

export interface WebampConstructor {
  new (options: WebampOptions): WebampInstance;
  browserIsSupported?(): boolean;
}

export interface SpotampMedia {
  suppressStop: boolean;
  suppressNextLoad: boolean;
  setVolume(volume: number): void;
  setBalance(balance: number): void;
  setPreamp(value: number): void;
  on(event: string, callback: (...args: any[]) => void): void;
  timeElapsed(): number;
  duration(): number;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seekToPercentComplete(percent: number): void;
  loadFromUrl(url: string, autoPlay: boolean): Promise<void>;
  setEqBand(band: string | number, value: number): void;
  disableEq(): void;
  enableEq(): void;
  getAnalyser(): AnalyserNode;
  dispose(): void;
  emitTimeUpdate(): void;
}

export interface WebampAdapterHooks {
  getSnapshot(): PlaybackSnapshot;
  subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void;
  playTrack(track: TrackInfo): Promise<boolean>;
  play(): Promise<boolean>;
  pause(): Promise<boolean>;
  next(): boolean;
  previous(): boolean;
  toggleShuffle(): boolean;
  toggleRepeat(): boolean;
  seekToPercent(percent: number): boolean;
  seekToSeconds(seconds: number): boolean;
  setVolume(percent: number): boolean;
  onNotice(message: string): void;
  onOpenChange?(open: boolean): void;
  logger?: Pick<Console, "info" | "warn">;
}

export interface WebampControllerHooks extends WebampAdapterHooks {
  resolveTrack(url: string): TrackInfo | null;
}
