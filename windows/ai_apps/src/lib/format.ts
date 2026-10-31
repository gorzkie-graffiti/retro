export function formatClock(timestamp: number | null | undefined): string {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return "—";
  }
  try {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatHistoryTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "—";
  }
  const date = new Date(timestamp);
  const now = new Date();
  try {
    if (date.toDateString() === now.toDateString()) {
      return formatClock(timestamp);
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return formatClock(timestamp);
  }
}

export function formatLongDate(date = new Date()): string {
  try {
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return date.toDateString();
  }
}

export function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || !Number.isFinite(durationMs)) {
    return "";
  }
  if (durationMs < 1000) {
    return `${Math.max(1, Math.round(durationMs))} ms`;
  }
  return `${(durationMs / 1000).toFixed(1)} s`;
}
