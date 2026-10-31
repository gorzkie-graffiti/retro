import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SCALE,
  MemorySettings,
  normalizeScale,
} from "../src/content/settings";

describe("Winamp UI scale setting", () => {
  it("clamps and rounds values to 0.05 steps between 0.5 and 2", () => {
    expect(normalizeScale(1.234)).toBe(1.25);
    expect(normalizeScale(0.1)).toBe(0.5);
    expect(normalizeScale(9)).toBe(2);
    expect(normalizeScale("1.5")).toBe(1.5);
    expect(normalizeScale("not-a-number")).toBe(DEFAULT_SCALE);
    expect(normalizeScale(undefined)).toBe(DEFAULT_SCALE);
  });

  it("notifies scale subscribers and persists the normalized value", async () => {
    const settings = new MemorySettings(true);
    expect(await settings.getScale()).toBeNull();
    const listener = vi.fn();
    const unsubscribe = settings.subscribeScale(listener);

    await settings.setScale(1.5);
    expect(listener).toHaveBeenCalledWith(1.5);
    expect(await settings.getScale()).toBe(1.5);

    await settings.setScale(3);
    expect(listener).toHaveBeenLastCalledWith(2);
    expect(await settings.getScale()).toBe(2);

    unsubscribe();
    await settings.setScale(1);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
