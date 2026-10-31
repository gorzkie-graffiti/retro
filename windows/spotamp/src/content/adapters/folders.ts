import { queryAll } from "../selectors";

export const FOLDER_TREE_ATTR = "data-spotamp-folder-tree";
export const FOLDER_ATTR = "data-spotamp-folder";

interface FolderSpec {
  id: string;
  label: string;
  href?: string;
}

const FOLDERS: FolderSpec[] = [
  { id: "home", label: "home\\", href: "/" },
  { id: "search", label: "search\\", href: "/search" },
  { id: "liked-songs", label: "liked-songs\\", href: "/collection/tracks" },
  { id: "playlists", label: "playlists\\" },
];

export function folderLevel(path: string): string {
  if (path.startsWith("/search")) return "SEARCH";
  if (path.startsWith("/collection/tracks")) return "LIKED-SONGS";
  if (path.startsWith("/playlist/")) return "PLAYLISTS";
  if (path.startsWith("/album/")) return "ALBUMS";
  if (path.startsWith("/artist/")) return "ARTISTS";
  return "HOME";
}

export function folderPath(path: string): string {
  return `C:\\SPOTAMP\\${folderLevel(path)}`;
}

function isActive(id: string, path: string): boolean {
  switch (id) {
    case "home":
      return path === "/" || path === "";
    case "search":
      return path.startsWith("/search");
    case "liked-songs":
      return path.startsWith("/collection/tracks");
    case "playlists":
      return path.startsWith("/playlist/");
    default:
      return false;
  }
}

/**
 * Builds the Winamp folder tree used by the Spotamp Library window. Each link
 * is a real Spotify route; the playlists row labels the live library list.
 */
export function buildFolderTree(doc: Document, path: string): HTMLElement {
  const tree = doc.createElement("div");
  tree.className = "spotamp-tree";
  tree.setAttribute(FOLDER_TREE_ATTR, "folders");
  tree.setAttribute("role", "navigation");
  tree.setAttribute("aria-label", "Spotamp folders");

  const title = doc.createElement("div");
  title.className = "spotamp-tree__title";
  title.textContent = folderPath(path);
  tree.append(title);

  for (const folder of FOLDERS) {
    const row = folder.href ? doc.createElement("a") : doc.createElement("div");
    row.className = "spotamp-tree__folder";
    row.setAttribute(FOLDER_ATTR, folder.id);
    row.setAttribute("data-active", isActive(folder.id, path) ? "true" : "false");

    if (row instanceof HTMLAnchorElement && folder.href) {
      row.href = folder.href;
      row.setAttribute("aria-label", `Open ${folder.id}`);
      if (isActive(folder.id, path)) row.setAttribute("aria-current", "page");
    } else {
      row.classList.add("spotamp-tree__folder--group");
      row.title = "Playlists saved in your Spotify library";
    }

    const icon = doc.createElement("span");
    icon.className = "spotamp-tree__icon";
    icon.setAttribute("aria-hidden", "true");

    const label = doc.createElement("span");
    label.className = "spotamp-tree__label";
    label.textContent = folder.label;

    row.append(icon, label);
    tree.append(row);
  }

  return tree;
}

export function clearFolderTrees(doc: Document): void {
  for (const tree of queryAll(doc, `[${FOLDER_TREE_ATTR}]`)) tree.remove();
}
