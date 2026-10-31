export const SETTINGS_KEY = "spotamp.enabled";
export const SCALE_KEY = "spotamp.scale";

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2;
export const DEFAULT_SCALE = 1;

export interface SettingsBackend {
  getEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  subscribe(listener: (enabled: boolean) => void): () => void;
  /** null means the user has not chosen a scale on this profile yet. */
  getScale(): Promise<number | null>;
  setScale(scale: number): Promise<void>;
  subscribeScale(listener: (scale: number) => void): () => void;
}

/**
 * Scale is stored as a 0.05 step between 0.5 and 2.0. Normalizing on both
 * sides of storage keeps a hand-edited sync value from stretching the UI.
 */
export function normalizeScale(value: unknown, fallback = DEFAULT_SCALE): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  const stepped = Math.round(parsed / 0.05) * 0.05;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(stepped * 100) / 100));
}

function hasChromeStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    Boolean(chrome.storage?.sync) &&
    Boolean(chrome.storage?.onChanged)
  );
}

export class ChromeSettings implements SettingsBackend {
  async getEnabled(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ [SETTINGS_KEY]: true }, (values) => {
          resolve(values[SETTINGS_KEY] !== false);
        });
      } catch {
        resolve(true);
      }
    });
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await new Promise<void>((resolve) => {
      try {
        chrome.storage.sync.set({ [SETTINGS_KEY]: enabled }, () => resolve());
      } catch {
        resolve();
      }
    });
  }

  subscribe(listener: (enabled: boolean) => void): () => void {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "sync" || !changes[SETTINGS_KEY]) return;
      listener(changes[SETTINGS_KEY]?.newValue !== false);
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }

  async getScale(): Promise<number | null> {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ [SCALE_KEY]: null }, (values) => {
          const value = values[SCALE_KEY];
          resolve(value == null ? null : normalizeScale(value));
        });
      } catch {
        resolve(null);
      }
    });
  }

  async setScale(scale: number): Promise<void> {
    const value = normalizeScale(scale);
    await new Promise<void>((resolve) => {
      try {
        chrome.storage.sync.set({ [SCALE_KEY]: value }, () => resolve());
      } catch {
        resolve();
      }
    });
  }

  subscribeScale(listener: (scale: number) => void): () => void {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "sync" || !changes[SCALE_KEY]) return;
      listener(normalizeScale(changes[SCALE_KEY]?.newValue));
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }
}

export class MemorySettings implements SettingsBackend {
  private enabled: boolean;
  private scale: number | null;
  private listeners = new Set<(enabled: boolean) => void>();
  private scaleListeners = new Set<(scale: number) => void>();

  constructor(enabled = true, scale: number | null = null) {
    this.enabled = enabled;
    this.scale = scale == null ? null : normalizeScale(scale);
  }

  async getEnabled(): Promise<boolean> {
    return this.enabled;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    for (const listener of this.listeners) listener(enabled);
  }

  subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async getScale(): Promise<number | null> {
    return this.scale;
  }

  async setScale(scale: number): Promise<void> {
    const value = normalizeScale(scale);
    if (this.scale === value) return;
    this.scale = value;
    for (const listener of this.scaleListeners) listener(value);
  }

  subscribeScale(listener: (scale: number) => void): () => void {
    this.scaleListeners.add(listener);
    return () => this.scaleListeners.delete(listener);
  }
}

export function createSettings(): SettingsBackend {
  return hasChromeStorage() ? new ChromeSettings() : new MemorySettings(true);
}
