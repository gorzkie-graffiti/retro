import { albumAdapter } from "./album";
import { artistAdapter } from "./artist";
import { dailyMixAdapter } from "./dailyMix";
import { homeAdapter } from "./home";
import { likedSongsAdapter } from "./likedSongs";
import { playlistAdapter } from "./playlist";
import { searchAdapter } from "./search";
import type { PageAdapter } from "./types";
import { unknownAdapter } from "./unknown";
import { clearPageAnnotations } from "./common";
import type { PageKind } from "../types";

const ADAPTERS: PageAdapter[] = [
  homeAdapter,
  searchAdapter,
  playlistAdapter,
  albumAdapter,
  artistAdapter,
  dailyMixAdapter,
  likedSongsAdapter,
  unknownAdapter,
];

export function applyPageAdapter(doc: Document, kind: PageKind): PageAdapter {
  clearPageAnnotations(doc);
  const adapter =
    ADAPTERS.find((candidate) => candidate.kind === kind) ?? unknownAdapter;
  adapter.apply(doc);
  return adapter;
}

export type { PageAdapter } from "./types";
