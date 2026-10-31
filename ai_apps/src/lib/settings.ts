import type { GeminiProvider, GeminiSettings, ModelInfo } from "../types";
import { readJson, STORAGE_KEYS, writeJson } from "./storage";

/** Documented by gemini-web2api's README and config example. */
export const DEFAULT_BRIDGE_BASE_URL = "http://127.0.0.1:8081/v1";

/** Google's REST endpoint; `v1beta` is the documented version for generateContent. */
export const GOOGLE_API_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

/** Same-origin path served by the dev/preview proxy, which adds the key. */
export const AI_STUDIO_PROXY_BASE_URL = "/gemini-api/v1beta";

export const DEFAULT_MODEL = "gemini-3.6-flash";
export const AI_STUDIO_DEFAULT_MODEL = "gemini-3.8-flash";

export const PROVIDER_LABELS: Record<GeminiProvider, string> = {
  bridge: "gemini-web2api bridge",
  "ai-studio": "Google AI Studio (Gemini API)",
};

export const PROVIDER_LABEL: Record<GeminiProvider, string> = {
  bridge: "the gemini-web2api bridge",
  "ai-studio": "the Google Gemini API",
};

export const PROVIDER_SHORT: Record<GeminiProvider, string> = {
  bridge: "bridge",
  "ai-studio": "Gemini API",
};

export function isProvider(value: unknown): value is GeminiProvider {
  return value === "bridge" || value === "ai-studio";
}

/**
 * `start.sh --use api` exposes a same-origin proxy that injects the key from
 * `.env`, so the browser never receives it. Without that flag we call Google
 * directly and the key (if any) comes from the settings dialog.
 */
export function proxyEnabled(): boolean {
  return import.meta.env.VITE_GEMINI_PROXY === "1";
}

export function defaultBaseUrl(provider: GeminiProvider): string {
  if (provider === "ai-studio") {
    return proxyEnabled() ? AI_STUDIO_PROXY_BASE_URL : GOOGLE_API_BASE_URL;
  }
  return DEFAULT_BRIDGE_BASE_URL;
}

export function defaultModel(provider: GeminiProvider): string {
  return provider === "ai-studio" ? AI_STUDIO_DEFAULT_MODEL : DEFAULT_MODEL;
}

export const BRIDGE_FALLBACK_MODELS: ModelInfo[] = [
  { id: "gemini-3.7-flash", description: "Latest all-around model" },
  { id: "gemini-3.6-flash", description: "All-around model" },
  { id: "gemini-3.5-flash", description: "Alias for Gemini 3.6 Flash" },
  {
    id: "gemini-3.5-flash-thinking",
    description: "Deep thinking, longest output",
  },
  {
    id: "gemini-3.1-pro",
    description: "Pro (needs a paid cookie for routing)",
  },
  { id: "gemini-auto", description: "Automatic model selection" },
  {
    id: "gemini-3.5-flash-thinking-lite",
    description: "Adaptive thinking depth",
  },
  { id: "gemini-flash-lite", description: "Fastest, lightweight answers" },
];

export const AI_STUDIO_FALLBACK_MODELS: ModelInfo[] = [
  { id: "gemini-3.8-flash", description: "Current Flash model" },
  { id: "gemini-3.6-flash", description: "All-around model" },
  { id: "gemini-3.5-flash-lite", description: "Fast, lightweight answers" },
  { id: "gemini-3.1-flash-lite", description: "Smallest Flash model" },
  { id: "gemini-4-argon", description: "Gemini 4 model" },
];

export function fallbackModels(provider: GeminiProvider): ModelInfo[] {
  return provider === "ai-studio"
    ? AI_STUDIO_FALLBACK_MODELS
    : BRIDGE_FALLBACK_MODELS;
}

/** Guess the backend from a saved URL, for settings stored before providers existed. */
export function inferProvider(baseUrl: string): GeminiProvider {
  return /generativelanguage\.googleapis\.com|\/gemini-api\//i.test(baseUrl)
    ? "ai-studio"
    : "bridge";
}

export const DEFAULT_SETTINGS: GeminiSettings = {
  provider: "bridge",
  baseUrl: DEFAULT_BRIDGE_BASE_URL,
  apiKey: "",
  model: DEFAULT_MODEL,
};

function baseUrlForProvider(
  provider: GeminiProvider,
  storedBaseUrl: string | null,
): string {
  // A stored URL only wins while it still points at the same backend; switching
  // providers in the dialog or through start.sh replaces it with that default.
  if (storedBaseUrl && inferProvider(storedBaseUrl) === provider) {
    if (provider === "ai-studio") {
      const isGoogleUrl = storedBaseUrl === GOOGLE_API_BASE_URL;
      const isProxyUrl = storedBaseUrl === AI_STUDIO_PROXY_BASE_URL;
      if (isGoogleUrl && proxyEnabled()) {
        return AI_STUDIO_PROXY_BASE_URL;
      }
      if (isProxyUrl && !proxyEnabled()) {
        return GOOGLE_API_BASE_URL;
      }
    }
    return storedBaseUrl;
  }
  return defaultBaseUrl(provider);
}

export function normalizeSettings(value: unknown): GeminiSettings {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_SETTINGS };
  }
  const record = value as Record<string, unknown>;
  const storedBaseUrl =
    typeof record.baseUrl === "string" && record.baseUrl.trim()
      ? record.baseUrl.trim().replace(/\/+$/, "")
      : null;
  const provider = isProvider(record.provider)
    ? record.provider
    : inferProvider(storedBaseUrl ?? "");

  return {
    provider,
    baseUrl: baseUrlForProvider(provider, storedBaseUrl),
    apiKey: typeof record.apiKey === "string" ? record.apiKey : "",
    model:
      typeof record.model === "string" && record.model.trim()
        ? record.model.trim()
        : defaultModel(provider),
  };
}

/**
 * `start.sh --use api|bridge` exports VITE_DEFAULT_PROVIDER, which pins the
 * backend for that run so a stale saved choice cannot point at the wrong one.
 */
function forcedProvider(): GeminiProvider | null {
  const value = import.meta.env.VITE_DEFAULT_PROVIDER;
  if (value === "api" || value === "ai-studio") {
    return "ai-studio";
  }
  if (value === "web2api" || value === "bridge") {
    return "bridge";
  }
  return null;
}

export function loadSettings(): GeminiSettings {
  const stored = normalizeSettings(
    readJson<unknown>(STORAGE_KEYS.settings, null),
  );
  const forced = forcedProvider();
  if (!forced || forced === stored.provider) {
    return stored;
  }
  return {
    ...stored,
    provider: forced,
    baseUrl: defaultBaseUrl(forced),
    model: defaultModel(forced),
  };
}

export function saveSettings(settings: GeminiSettings): boolean {
  return writeJson(STORAGE_KEYS.settings, settings);
}
