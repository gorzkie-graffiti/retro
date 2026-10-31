import { SELECTORS } from "../selectors";
import type { PageAdapter } from "./types";
import { markAll, markRoot } from "./common";

export const artistAdapter: PageAdapter = {
  kind: "artist",
  rootSelector: SELECTORS.artistPage,
  apply(doc) {
    markRoot(doc, this.rootSelector, this.kind);
    markAll(doc, SELECTORS.entityHeader, "entity-header");
    markAll(doc, SELECTORS.actionBar, "action-bar");
    markAll(doc, SELECTORS.shelf, "shelf");
    markAll(doc, SELECTORS.trackRow, "track-row");
    markAll(doc, '[data-testid="grid-container"]', "artist-grid");
  },
};
