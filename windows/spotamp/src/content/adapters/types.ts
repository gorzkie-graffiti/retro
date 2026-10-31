import type { PageKind } from "../types";

export interface PageAdapter {
  kind: PageKind;
  rootSelector: string | null;
  apply(doc: Document): void;
}
