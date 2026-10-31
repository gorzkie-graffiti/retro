import { SELECTORS } from "../selectors";
import type { PageAdapter } from "./types";
import { markAll, markRoot } from "./common";

export const homeAdapter: PageAdapter = {
  kind: "home",
  rootSelector: SELECTORS.homePage,
  apply(doc) {
    markRoot(doc, this.rootSelector, this.kind);
    markAll(doc, SELECTORS.shelf, "shelf");
    markAll(doc, `[data-testid="shortcut-image"]`, "shortcut");
  },
};
