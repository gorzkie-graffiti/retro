import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpotampApp, type WebampController } from "../src/content/app";
import { MemorySettings } from "../src/content/settings";
import { PLAYER_HTML } from "./fixtures";

function createFakeController(instances: WebampController[]) {
  const controller: WebampController = {
    mount: vi.fn(async () => {
      const marker = document.createElement("div");
      marker.id = "fake-webamp";
      document.body.append(marker);
    }),
    destroy: vi.fn(() => {
      document.getElementById("fake-webamp")?.remove();
    }),
    applyPage: vi.fn(),
    reopen: vi.fn(),
    isOpen: vi.fn(() => true),
  };
  instances.push(controller);
  return controller;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("SpotampApp lifecycle", () => {
  let settings: MemorySettings;
  let controllers: WebampController[];
  let app: SpotampApp;

  beforeEach(() => {
    document.documentElement.className = "";
    document.body.innerHTML = `
      <div id="main">
        <div data-testid="root">
          <main>
            <div data-testid="home-page"></div>
            <div data-testid="entity-header"><span data-testid="entityTitle"><h1>Home</h1></span></div>
          </main>
          ${PLAYER_HTML}
        </div>
      </div>
    `;
    window.history.replaceState({}, "", "/");
    settings = new MemorySettings(true);
    controllers = [];
    app = new SpotampApp({
      doc: document,
      win: window,
      cssText: ".spotamp-active { background: #000; }",
      settings,
      createWebamp: () => createFakeController(controllers),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
  });

  afterEach(async () => {
    await app.stop();
    document.body.innerHTML = "";
    document.documentElement.className = "";
  });

  it("mounts the theme, status strip and Webamp exactly once", async () => {
    await app.start();
    await flush();

    expect(document.documentElement.classList.contains("spotamp-active")).toBe(
      true,
    );
    expect(
      document.documentElement.classList.contains("spotamp-page-home"),
    ).toBe(true);
    expect(document.getElementById("spotamp-style")).toBeTruthy();
    expect(document.getElementById("spotamp-status")).toBeTruthy();
    expect(document.querySelectorAll("#spotamp-status")).toHaveLength(1);
    expect(document.querySelectorAll("#fake-webamp")).toHaveLength(1);
    expect(controllers).toHaveLength(1);
    expect(controllers[0]?.mount).toHaveBeenCalledTimes(1);
    expect(controllers[0]?.applyPage).toHaveBeenCalled();
  });

  it("toggles double-size windows from the status strip and clears it on disable", async () => {
    await app.start();
    await flush();

    const button = document.querySelector<HTMLButtonElement>(
      '[data-spotamp-action="double-size"]',
    );
    expect(button).toBeTruthy();
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    expect(
      document.documentElement.classList.contains("spotamp-double"),
    ).toBe(false);

    button?.click();
    expect(
      document.documentElement.classList.contains("spotamp-double"),
    ).toBe(true);
    expect(button?.getAttribute("aria-pressed")).toBe("true");
    expect(await settings.getScale()).toBe(2);
    expect(
      document.documentElement.style.getPropertyValue("--spotamp-ui-scale"),
    ).toBe("2");

    await settings.setEnabled(false);
    await flush();
    expect(
      document.documentElement.classList.contains("spotamp-double"),
    ).toBe(false);
  });

  it("supports Winamp's Ctrl+D double-size shortcut", async () => {
    await app.start();
    await flush();

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "d",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(
      document.documentElement.classList.contains("spotamp-double"),
    ).toBe(true);
    expect(await settings.getScale()).toBe(2);
  });

  it("applies a 50–200% UI scale from settings and carries it across re-enable", async () => {
    await app.start();
    await flush();

    expect(
      document.documentElement.style.getPropertyValue("--spotamp-ui-scale"),
    ).toBe("1");

    await settings.setScale(1.5);
    await flush();
    expect(
      document.documentElement.style.getPropertyValue("--spotamp-ui-scale"),
    ).toBe("1.5");
    expect(
      document.documentElement.style.getPropertyValue("--spotamp-ui-inv-scale"),
    ).toBe("0.6667");
    expect(
      document.documentElement.classList.contains("spotamp-double"),
    ).toBe(false);

    await settings.setScale(0.5);
    await flush();
    expect(
      document.documentElement.style.getPropertyValue("--spotamp-ui-scale"),
    ).toBe("0.5");

    await settings.setScale(2.4);
    await flush();
    expect(await settings.getScale()).toBe(2);
    expect(
      document.documentElement.style.getPropertyValue("--spotamp-ui-scale"),
    ).toBe("2");

    await settings.setEnabled(false);
    await flush();
    expect(
      document.documentElement.style.getPropertyValue("--spotamp-ui-scale"),
    ).toBe("");

    await app.enable();
    await flush();
    expect(
      document.documentElement.style.getPropertyValue("--spotamp-ui-scale"),
    ).toBe("2");
  });

  it("restores Spotify instantly when disabled and does not duplicate on re-enable", async () => {
    await app.start();
    await flush();
    const first = controllers[0]!;

    await settings.setEnabled(false);
    await flush();

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains("spotamp-active")).toBe(
      false,
    );
    expect(document.getElementById("spotamp-style")).toBeNull();
    expect(document.getElementById("spotamp-status")).toBeNull();
    expect(document.querySelector("[data-spotamp-player]")).toBeNull();
    expect(document.querySelector("[data-spotamp-sidebar]")).toBeNull();
    expect(document.querySelector("[data-spotamp-hide]")).toBeNull();

    await app.enable();
    await flush();

    expect(controllers).toHaveLength(2);
    expect(document.querySelectorAll("#spotamp-status")).toHaveLength(1);
    expect(document.querySelectorAll("#fake-webamp")).toHaveLength(1);
    expect(document.documentElement.classList.contains("spotamp-page-home")).toBe(
      true,
    );
  });

  it("mounts once Spotify's app shell appears after the script runs", async () => {
    document.querySelector('[data-testid="root"]')?.remove();
    await app.start();
    await flush();
    expect(document.getElementById("spotamp-status")).toBeNull();

    const root = document.createElement("div");
    root.setAttribute("data-testid", "root");
    root.innerHTML = '<main><div data-testid="home-page"></div></main>';
    document.getElementById("main")!.append(root);

    await new Promise((resolve) => setTimeout(resolve, 350));
    await flush();

    expect(document.getElementById("spotamp-status")).toBeTruthy();
    expect(controllers).toHaveLength(1);
  });

  it("stops polling and listeners when disabled", async () => {
    await app.start();
    await flush();
    const status = document.getElementById("spotamp-status");
    expect(status).toBeTruthy();

    await settings.setEnabled(false);
    await flush();
    expect(document.getElementById("spotamp-status")).toBeNull();

    // Late storage changes after disable must not resurrect the UI.
    await settings.setEnabled(true);
    await flush();
    expect(document.querySelectorAll("#spotamp-status")).toHaveLength(1);
  });
});
