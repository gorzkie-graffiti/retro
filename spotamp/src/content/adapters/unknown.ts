import type { PageAdapter } from "./types";

export const unknownAdapter: PageAdapter = {
  kind: "unknown",
  rootSelector: null,
  apply() {
    // The base Spotamp theme is URL-independent. Unknown routes keep it and
    // simply do not mark a specialized content surface.
  },
};
