import { SELECTORS, query, queryAll } from "../selectors";

export const SIDEBAR_ATTR = "data-spotamp-sidebar";
export const SIDEBAR_ROW_ATTR = "data-spotamp-sidebar-row";
export const SIDEBAR_LINK_ATTR = "data-spotamp-sidebar-link";

export function applySidebar(doc: Document): void {
  const nav = query<HTMLElement>(doc, SELECTORS.sidebar);
  if (!nav) return;
  nav.setAttribute(SIDEBAR_ATTR, "nav");

  const container = doc.querySelector(SELECTORS.sidebarContainer);
  container?.setAttribute(SIDEBAR_ATTR, "container");

  for (const row of queryAll<HTMLElement>(
    nav,
    '[role="row"], [role="treeitem"], [role="listitem"]',
  )) {
    row.setAttribute(SIDEBAR_ROW_ATTR, "row");
  }

  for (const link of queryAll<HTMLAnchorElement>(
    nav,
    'a[href^="/playlist/"], a[href^="/collection/"], a[href^="/artist/"], a[href^="/album/"]',
  )) {
    link.setAttribute(SIDEBAR_LINK_ATTR, "link");
    link.closest<HTMLElement>(`[${SIDEBAR_ROW_ATTR}]`)?.setAttribute(
      SIDEBAR_ROW_ATTR,
      "link-row",
    );
  }
}

export function clearSidebar(doc: Document): void {
  for (const element of queryAll(
    doc,
    `[${SIDEBAR_ATTR}], [${SIDEBAR_ROW_ATTR}], [${SIDEBAR_LINK_ATTR}]`,
  )) {
    element.removeAttribute(SIDEBAR_ATTR);
    element.removeAttribute(SIDEBAR_ROW_ATTR);
    element.removeAttribute(SIDEBAR_LINK_ATTR);
  }
}
