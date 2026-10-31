import { SELECTORS } from "../selectors";
import type { PageAdapter } from "./types";
import { markAll, markRoot } from "./common";

export const albumAdapter: PageAdapter = {
  kind: "album",
  rootSelector: SELECTORS.albumPage,
  apply(doc) {
    markRoot(doc, this.rootSelector, this.kind);
    markAll(doc, SELECTORS.entityHeader, "entity-header");
    markAll(doc, SELECTORS.actionBar, "action-bar");
    markAll(doc, SELECTORS.trackList, "track-list");
    markAll(doc, SELECTORS.trackRow, "track-row");
  },
};
