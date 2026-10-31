import { query, queryAll } from "../selectors";
import type { PageKind } from "../types";

export const PAGE_ANNOTATION = "data-spotamp-surface";
export const ANNOTATION = "data-spotamp-mark";

export function clearPageAnnotations(doc: Document): void {
  for (const element of queryAll(doc, `[${PAGE_ANNOTATION}]`)) {
    element.removeAttribute(PAGE_ANNOTATION);
  }
  for (const element of queryAll(doc, `[${ANNOTATION}]`)) {
    element.removeAttribute(ANNOTATION);
  }
}

export function markRoot(
  doc: Document,
  rootSelector: string | null,
  kind: PageKind,
): HTMLElement | null {
  if (!rootSelector) {
    const main = query<HTMLElement>(doc, "main");
    main?.setAttribute(PAGE_ANNOTATION, kind);
    return main;
  }
  const root = query<HTMLElement>(doc, rootSelector);
  root?.setAttribute(PAGE_ANNOTATION, kind);
  return root;
}

export function markAll(
  doc: Document,
  selector: string,
  mark: string,
): HTMLElement[] {
  const elements = queryAll<HTMLElement>(doc, selector);
  for (const element of elements) element.setAttribute(ANNOTATION, mark);
  return elements;
}
