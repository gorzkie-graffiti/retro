import { readJson, STORAGE_KEYS, writeJson } from "../lib/storage";

export const MODULE_IDS = [
  "chat",
  "history",
  "featured",
  "connection",
  "help",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export interface ModulePosition {
  x: number;
  y: number;
}

export interface ModulePlacement {
  width: number;
  height: number;
}

export type ModuleLayout = Record<ModuleId, ModulePosition>;

export const CANVAS_WIDTH = 1024;
export const MAX_Y = 2400;

export const MODULE_PLACEMENTS: Record<ModuleId, ModulePlacement> = {
  chat: { width: 624, height: 684 },
  history: { width: 384, height: 392 },
  featured: { width: 384, height: 312 },
  connection: { width: 384, height: 336 },
  help: { width: 624, height: 348 },
};

export const DEFAULT_LAYOUT: ModuleLayout = {
  chat: { x: 0, y: 0 },
  history: { x: 640, y: 0 },
  featured: { x: 640, y: 408 },
  connection: { x: 640, y: 736 },
  help: { x: 0, y: 700 },
};

export function clampPosition(
  id: ModuleId,
  position: ModulePosition,
): ModulePosition {
  const placement = MODULE_PLACEMENTS[id];
  const maxX = Math.max(0, CANVAS_WIDTH - placement.width);
  const maxY = Math.max(0, MAX_Y - placement.height);
  const x = Number.isFinite(position.x) ? position.x : 0;
  const y = Number.isFinite(position.y) ? position.y : 0;
  return {
    x: Math.min(Math.max(0, Math.round(x)), maxX),
    y: Math.min(Math.max(0, Math.round(y)), maxY),
  };
}

export function normalizeLayout(value: unknown): ModuleLayout {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const result = {} as ModuleLayout;

  for (const id of MODULE_IDS) {
    const candidate = record[id];
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      typeof (candidate as Record<string, unknown>).x === "number" &&
      typeof (candidate as Record<string, unknown>).y === "number"
    ) {
      const position = candidate as Record<string, number>;
      result[id] = clampPosition(id, { x: position.x, y: position.y });
    } else {
      result[id] = { ...DEFAULT_LAYOUT[id] };
    }
  }

  return result;
}

export function loadLayout(): ModuleLayout {
  return normalizeLayout(readJson<unknown>(STORAGE_KEYS.layout, null));
}

export function saveLayout(layout: ModuleLayout): boolean {
  return writeJson(STORAGE_KEYS.layout, layout);
}

export function canvasHeightFor(layout: ModuleLayout): number {
  let bottom = 0;
  for (const id of MODULE_IDS) {
    bottom = Math.max(bottom, layout[id].y + MODULE_PLACEMENTS[id].height);
  }
  return Math.max(1088, bottom + 16);
}
