export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEYS = {
  conversations: "gemini-web20:conversations:v1",
  activeConversation: "gemini-web20:active-conversation:v1",
  settings: "gemini-web20:settings:v1",
  layout: "gemini-web20:module-layout:v1",
  theme: "gemini-web20:theme:v1",
} as const;

export function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readString(
  key: string,
  storage: StorageLike | null = getDefaultStorage(),
): string | null {
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(
  key: string,
  value: string,
  storage: StorageLike | null = getDefaultStorage(),
): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readJson<T>(
  key: string,
  fallback: T,
  storage: StorageLike | null = getDefaultStorage(),
): T {
  const raw = readString(key, storage);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(
  key: string,
  value: unknown,
  storage: StorageLike | null = getDefaultStorage(),
): boolean {
  try {
    return writeString(key, JSON.stringify(value), storage);
  } catch {
    return false;
  }
}
