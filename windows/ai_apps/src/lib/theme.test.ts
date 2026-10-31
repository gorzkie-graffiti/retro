import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  isAppTheme,
  loadTheme,
  normalizeTheme,
  saveTheme,
  THEMES,
  themeDefinition,
} from "./theme";
import { STORAGE_KEYS, type StorageLike } from "./storage";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("theme selection", () => {
  it("offers exactly the three documented choices with unique ids", () => {
    expect(THEMES.map((theme) => theme.id)).toEqual([
      "web20",
      "messenger",
      "assistant",
    ]);
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(3);
    expect(THEMES[0].id).toBe(DEFAULT_THEME);
    expect(THEMES.map((theme) => theme.label)).toEqual([
      "Web 2.0 / iGoogle",
      "Messenger 2003–2006",
      "Windows 98 / XP Assistant",
    ]);
  });

  it("accepts all three themes and falls back to Web 2.0 for junk", () => {
    for (const theme of THEMES) {
      expect(isAppTheme(theme.id)).toBe(true);
      expect(normalizeTheme(theme.id)).toBe(theme.id);
      expect(normalizeTheme(theme.id).length).toBeGreaterThan(0);
    }
    expect(normalizeTheme(null)).toBe("web20");
    expect(normalizeTheme("windows-vista")).toBe("web20");
    expect(normalizeTheme(42)).toBe("web20");
    expect(isAppTheme("messenger")).toBe(true);
    expect(isAppTheme("Messenger")).toBe(false);
  });

  it("exposes the matching document title for each theme", () => {
    expect(themeDefinition("web20").documentTitle).toContain("Web 2.0");
    expect(themeDefinition("messenger").documentTitle).toContain("Messenger");
    expect(themeDefinition("assistant").documentTitle).toContain("Assistant");
  });
});

describe("theme persistence", () => {
  it("saves and restores the last selected theme after a reload", () => {
    const storage = new MemoryStorage();
    expect(loadTheme(storage)).toBe("web20");

    expect(saveTheme("messenger", storage)).toBe(true);
    expect(loadTheme(storage)).toBe("messenger");

    expect(saveTheme("assistant", storage)).toBe(true);
    expect(loadTheme(storage)).toBe("assistant");

    expect(saveTheme("web20", storage)).toBe(true);
    expect(loadTheme(storage)).toBe("web20");
  });

  it("does not disturb conversations or API settings when switching", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.settings, '{"model":"gemini-3.7-flash"}');
    storage.setItem(STORAGE_KEYS.conversations, "[]");

    saveTheme("assistant", storage);

    expect(storage.getItem(STORAGE_KEYS.settings)).toBe(
      '{"model":"gemini-3.7-flash"}',
    );
    expect(storage.getItem(STORAGE_KEYS.conversations)).toBe("[]");
    expect(storage.getItem(STORAGE_KEYS.theme)).toBe("assistant");
  });

  it("tolerates missing, throwing, or corrupted storage", () => {
    expect(loadTheme(null)).toBe("web20");
    expect(
      saveTheme("assistant", {
        getItem: () => null,
        setItem: () => {
          throw new Error("storage disabled");
        },
        removeItem: () => undefined,
      }),
    ).toBe(false);

    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.theme, "not-a-theme");
    expect(loadTheme(storage)).toBe("web20");
  });
});

describe("theme application", () => {
  it("sets the data attribute and matching document title", () => {
    const attributes = new Map<string, string>();
    const documentRef = {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attributes.set(name, value);
        },
      },
      title: "",
    } as unknown as Document;

    applyThemeToDocument("assistant", documentRef);

    expect(attributes.get("data-theme")).toBe("assistant");
    expect(documentRef.title).toBe(themeDefinition("assistant").documentTitle);
  });
});
