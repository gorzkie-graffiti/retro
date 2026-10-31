import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_STUDIO_PROXY_BASE_URL,
  DEFAULT_BRIDGE_BASE_URL,
  GOOGLE_API_BASE_URL,
  defaultBaseUrl,
  defaultModel,
  loadSettings,
  normalizeSettings,
} from "./settings";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeSettings", () => {
  it("migrates a bridge-only save from before providers existed", () => {
    const settings = normalizeSettings({
      baseUrl: DEFAULT_BRIDGE_BASE_URL,
      apiKey: "",
      model: "gemini-3.6-flash",
    });

    expect(settings.provider).toBe("bridge");
    expect(settings.baseUrl).toBe(DEFAULT_BRIDGE_BASE_URL);
    expect(settings.model).toBe("gemini-3.6-flash");
  });

  it("infers AI Studio from a saved Google URL", () => {
    const settings = normalizeSettings({
      baseUrl: GOOGLE_API_BASE_URL,
      model: "gemini-3.8-flash",
    });

    expect(settings.provider).toBe("ai-studio");
    expect(settings.model).toBe("gemini-3.8-flash");
  });

  it("replaces the URL when the provider changes", () => {
    const settings = normalizeSettings({
      provider: "ai-studio",
      baseUrl: DEFAULT_BRIDGE_BASE_URL,
    });

    expect(settings.baseUrl).toBe(GOOGLE_API_BASE_URL);
  });

  it("keeps a custom URL that matches the selected provider", () => {
    const settings = normalizeSettings({
      provider: "bridge",
      baseUrl: "http://192.168.1.9:9000/v1",
    });

    expect(settings.baseUrl).toBe("http://192.168.1.9:9000/v1");
  });

  it("falls back to defaults for unusable input", () => {
    expect(normalizeSettings("not settings")).toEqual({
      provider: "bridge",
      baseUrl: DEFAULT_BRIDGE_BASE_URL,
      apiKey: "",
      model: "gemini-3.6-flash",
    });
  });
});

describe("start.sh environment", () => {
  it("routes AI Studio through the proxy when the key is loaded", () => {
    vi.stubEnv("VITE_GEMINI_PROXY", "1");

    expect(defaultBaseUrl("ai-studio")).toBe(AI_STUDIO_PROXY_BASE_URL);
    expect(
      normalizeSettings({
        provider: "ai-studio",
        baseUrl: GOOGLE_API_BASE_URL,
      }).baseUrl,
    ).toBe(AI_STUDIO_PROXY_BASE_URL);
  });

  it("pins the provider chosen with --use api", () => {
    vi.stubEnv("VITE_DEFAULT_PROVIDER", "api");

    const settings = loadSettings();
    expect(settings.provider).toBe("ai-studio");
    expect(settings.model).toBe(defaultModel("ai-studio"));
  });

  it("pins the provider chosen with --use bridge", () => {
    vi.stubEnv("VITE_DEFAULT_PROVIDER", "bridge");

    const settings = loadSettings();
    expect(settings.provider).toBe("bridge");
    expect(settings.baseUrl).toBe(DEFAULT_BRIDGE_BASE_URL);
  });
});
