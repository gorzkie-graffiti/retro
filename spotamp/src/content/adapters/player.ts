import { SELECTORS, query, queryAll } from "../selectors";

export const PLAYER_ATTR = "data-spotamp-player";
export const HIDE_ATTR = "data-spotamp-hide";
export const UTILITY_ATTR = "data-spotamp-utility";

export function applyPlayerDom(doc: Document): HTMLElement | null {
  const rail = query<HTMLElement>(doc, SELECTORS.nowPlayingRail);
  rail?.setAttribute(PLAYER_ATTR, "rail");

  const bar = query<HTMLElement>(doc, SELECTORS.playerBar);
  if (!bar) return null;

  bar.setAttribute(PLAYER_ATTR, "bar");

  const nowPlaying = bar.querySelector<HTMLElement>(SELECTORS.nowPlaying);
  nowPlaying?.setAttribute(PLAYER_ATTR, "track");

  const playerControls = bar.querySelector<HTMLElement>(
    SELECTORS.playerControls,
  );
  playerControls?.setAttribute(HIDE_ATTR, "transport");

  const progress = bar.querySelector<HTMLElement>(SELECTORS.progressBar);
  let progressContainer = progress?.parentElement ?? null;
  while (progressContainer && progressContainer !== bar) {
    if (
      progressContainer.querySelector(SELECTORS.playbackPosition) &&
      progressContainer.querySelector(SELECTORS.playbackDuration)
    ) {
      progressContainer.setAttribute(HIDE_ATTR, "progress");
      break;
    }
    progressContainer = progressContainer.parentElement;
  }
  progress?.setAttribute(HIDE_ATTR, "progress-bar");

  const volume = bar.querySelector<HTMLElement>(SELECTORS.volumeBar);
  volume?.setAttribute(HIDE_ATTR, "volume");

  for (const utility of [
    SELECTORS.queueButton,
    SELECTORS.lyricsButton,
    SELECTORS.addToPlaylist,
    SELECTORS.connectDevice,
    SELECTORS.miniplayer,
    SELECTORS.fullscreen,
  ]) {
    for (const element of queryAll<HTMLElement>(bar, utility)) {
      element.setAttribute(UTILITY_ATTR, "utility");
    }
  }

  return bar;
}

export function clearPlayerDom(doc: Document): void {
  for (const element of queryAll(
    doc,
    `[${PLAYER_ATTR}], [${HIDE_ATTR}], [${UTILITY_ATTR}]`,
  )) {
    element.removeAttribute(PLAYER_ATTR);
    element.removeAttribute(HIDE_ATTR);
    element.removeAttribute(UTILITY_ATTR);
  }
}
