import { SELECTORS } from "../selectors";
import type { PageAdapter } from "./types";
import { markAll, markRoot } from "./common";

export const searchAdapter: PageAdapter = {
  kind: "search",
  rootSelector: null,
  apply(doc) {
    markRoot(doc, null, this.kind);
    markAll(doc, SELECTORS.searchInput, "search-input");
    markAll(doc, SELECTORS.searchDropdown, "search-dropdown");
    markAll(doc, SELECTORS.tabs, "tabs");
    markAll(doc, SELECTORS.tab, "tab");
  },
};
