import { SELECTORS } from "../selectors";

export function updateLayoutMetrics(doc: Document): void {
  const root = doc.documentElement;
  const bar = doc.querySelector<HTMLElement>(SELECTORS.playerBar);
  const height = bar ? Math.round(bar.getBoundingClientRect().height) : 0;
  root.style.setProperty("--spotamp-bar-h", `${Math.max(0, height)}px`);
}

export function watchLayoutMetrics(doc: Document): () => void {
  updateLayoutMetrics(doc);
  if (typeof ResizeObserver === "undefined") {
    const onResize = () => updateLayoutMetrics(doc);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }

  const observer = new ResizeObserver(() => updateLayoutMetrics(doc));
  const bar = doc.querySelector<HTMLElement>(SELECTORS.playerBar);
  if (bar) observer.observe(bar);
  const onResize = () => {
    updateLayoutMetrics(doc);
    const nextBar = doc.querySelector<HTMLElement>(SELECTORS.playerBar);
    if (nextBar && nextBar !== bar) observer.observe(nextBar);
  };
  window.addEventListener("resize", onResize);
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", onResize);
  };
}
