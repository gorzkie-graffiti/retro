import contentCss from "./styles/content.css";
import winampChromeCss from "./styles/winamp-gen.css";
import { SpotampApp } from "./app";
import {
  supportsNativeHas,
  transformHasSelectors,
} from "./compat/hasSelectors";
import { createSettings } from "./settings";
import { SpotampWebamp } from "./webamp/spotampWebamp";
import { loadWebamp } from "./webamp/loader";

declare global {
  interface Window {
    __spotampApp?: SpotampApp;
  }
}

async function bootstrap(): Promise<void> {
  if (!document.body) {
    await new Promise<void>((resolve) => {
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });
  }

  const existing = window.__spotampApp;
  if (existing) {
    await existing.stop();
  }

  const cssText = `${contentCss}\n${winampChromeCss}`;
  // Firefox < 121 has no native `:has()`; rewrite those selectors to marker
  // attributes and maintain the markers from the content script.
  const hasCompat = supportsNativeHas(window)
    ? null
    : transformHasSelectors(cssText);

  const app = new SpotampApp({
    doc: document,
    win: window,
    cssText: hasCompat?.cssText ?? cssText,
    hasRules: hasCompat?.rules,
    settings: createSettings(),
    createWebamp: (hooks, doc, win) => {
      const ctor = loadWebamp();
      if (!ctor) return null;
      return new SpotampWebamp({
        adapterHooks: hooks,
        webampCtor: ctor,
        doc,
        win,
      });
    },
  });

  window.__spotampApp = app;
  await app.start();
}

void bootstrap().catch((error) => {
  console.error("[Spotamp] bootstrap failed", error);
});
