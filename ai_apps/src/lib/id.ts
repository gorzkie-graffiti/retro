let sequence = 0;

export function makeId(prefix: string): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch {
    // fall through to the timestamp/random fallback
  }

  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
