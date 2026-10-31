import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canvasHeightFor,
  clampPosition,
  DEFAULT_LAYOUT,
  loadLayout,
  MODULE_IDS,
  MODULE_PLACEMENTS,
  normalizeLayout,
  saveLayout,
} from "./moduleLayout";
import { STORAGE_KEYS, type StorageLike } from "../lib/storage";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

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

describe("module layout", () => {
  it("keeps every default module inside the 1024px canvas", () => {
    for (const id of MODULE_IDS) {
      const { x, y } = DEFAULT_LAYOUT[id];
      const { width, height } = MODULE_PLACEMENTS[id];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(1024);
      expect(height).toBeGreaterThan(0);
    }
  });

  it("clamps positions to the canvas and rounds fractional pixels", () => {
    expect(clampPosition("chat", { x: 99999, y: -50 })).toEqual({
      x: 400,
      y: 0,
    });
    expect(clampPosition("history", { x: 12.6, y: 30.4 })).toEqual({
      x: 13,
      y: 30,
    });
    expect(clampPosition("help", { x: Number.NaN, y: Number.NaN })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("falls back to defaults for malformed saved layouts", () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(
      normalizeLayout({ chat: { x: 5, y: 6 }, history: "bad", help: {} }),
    ).toEqual({
      ...DEFAULT_LAYOUT,
      chat: { x: 5, y: 6 },
    });
  });

  it("grows the canvas when a module is dragged lower", () => {
    const layout = normalizeLayout({
      ...DEFAULT_LAYOUT,
      chat: { x: 0, y: 1600 },
    });
    expect(canvasHeightFor(layout)).toBeGreaterThan(1088);
  });

  it("persists and restores positions in local storage", () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage });

    const moved = normalizeLayout({
      ...DEFAULT_LAYOUT,
      history: { x: 100, y: 120 },
    });
    expect(saveLayout(moved)).toBe(true);
    expect(loadLayout()).toEqual(moved);
    expect(localStorage.getItem(STORAGE_KEYS.layout)).toContain('"history"');
  });

  it("tolerates corrupted storage", () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem(STORAGE_KEYS.layout, "{not json");
    vi.stubGlobal("window", { localStorage });

    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
  });
});
