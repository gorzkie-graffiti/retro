import { SELECTORS } from "../selectors";
import type { PageAdapter } from "./types";
import { markAll, markRoot } from "./common";

export const likedSongsAdapter: PageAdapter = {
  kind: "liked-songs",
  rootSelector: SELECTORS.playlistPage,
  apply(doc) {
    markRoot(doc, this.rootSelector, this.kind);
    markAll(doc, SELECTORS.entityHeader, "entity-header");
    markAll(doc, SELECTORS.actionBar, "action-bar");
    markAll(doc, SELECTORS.trackList, "track-list");
    markAll(doc, SELECTORS.trackRow, "track-row");
  },
};
