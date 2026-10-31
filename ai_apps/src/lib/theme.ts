import type { AppTheme } from "../types";
import { getDefaultStorage, readString, STORAGE_KEYS, writeString, type StorageLike } from "./storage";

export interface ThemeDefinition {
  id: AppTheme;
  label: string;
  shortLabel: string;
  description: string;
  documentTitle: string;
}

export const DEFAULT_THEME: AppTheme = "web20";

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: "web20",
    label: "Web 2.0 / iGoogle",
    shortLabel: "Web 2.0",
    description: "The original glossy 2008 personalized homepage.",
    documentTitle: "Gemini Web 2.0 — Personalized Answers (BETA)",
  },
  {
    id: "messenger",
    label: "Messenger 2003–2006",
    shortLabel: "Messenger",
    description: "A compact blue messenger window for Gemini chats.",
    documentTitle: "Gemini Messenger — BETA",
  },
  {
    id: "assistant",
    label: "Windows 98 / XP Assistant",
    shortLabel: "Assistant",
    description: "A beige desktop help window with a paperclip companion.",
    documentTitle: "Gemini Reference Assistant — Desktop Help",
  },
] as const;

export function isAppTheme(value: unknown): value is AppTheme {
  return THEMES.some((theme) => theme.id === value);
}

export function normalizeTheme(value: unknown): AppTheme {
  return isAppTheme(value) ? value : DEFAULT_THEME;
}

export function themeDefinition(theme: AppTheme): ThemeDefinition {
  return THEMES.find((entry) => entry.id === theme) ?? THEMES[0];
}

export function loadTheme(
  storage: StorageLike | null = getDefaultStorage(),
): AppTheme {
  return normalizeTheme(readString(STORAGE_KEYS.theme, storage));
}

export function saveTheme(
  theme: AppTheme,
  storage: StorageLike | null = getDefaultStorage(),
): boolean {
  return writeString(STORAGE_KEYS.theme, normalizeTheme(theme), storage);
}

/** Apply the skin and document title without touching app state. */
export function applyThemeToDocument(
  theme: AppTheme,
  documentRef: Document | null = typeof document === "undefined"
    ? null
    : document,
): void {
  if (!documentRef) {
    return;
  }
  documentRef.documentElement.setAttribute("data-theme", theme);
  const definition = themeDefinition(theme);
  documentRef.title = definition.documentTitle;
}
