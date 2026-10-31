import type { PlaybackSnapshot } from "../types";

export interface StatusStripOptions {
  doc: Document;
  onDisable: () => void;
  onPlayer: () => void;
  onShuffle: () => void;
  onLibrary: () => void;
  onDoubleSize: () => void;
}

const DEFAULT_NOTICE = "EQ DISPLAY ONLY";

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export class StatusStrip {
  readonly element: HTMLDivElement;
  private readonly help: HTMLDivElement;
  private readonly doc: Document;
  private readonly led: HTMLSpanElement;
  private readonly linkText: HTMLSpanElement;
  private readonly pageText: HTMLSpanElement;
  private readonly shuffleButton: HTMLButtonElement;
  private readonly doubleButton: HTMLButtonElement;
  private readonly notice: HTMLSpanElement;
  private readonly playerButton: HTMLButtonElement;
  private readonly options: StatusStripOptions;
  private readonly win: Window;
  private noticeTimer: number | null = null;
  private noticeResetTimer: number | null = null;

  constructor(options: StatusStripOptions) {
    this.doc = options.doc;
    this.win = options.doc.defaultView ?? window;
    this.options = options;

    const doc = options.doc;
    this.element = doc.createElement("div");
    this.element.id = "spotamp-status";
    this.element.className = "spotamp-status";
    this.element.setAttribute("data-spotamp", "status-strip");
    this.element.setAttribute("aria-label", "Spotamp status");

    const brand = doc.createElement("span");
    brand.className = "spotamp-status__brand";
    brand.textContent = "SPOTAMP";

    const slot = doc.createElement("span");
    slot.className = "spotamp-status__slot";
    slot.textContent = "WINAMP 2.91";

    const state = doc.createElement("span");
    state.className = "spotamp-status__state";
    this.led = doc.createElement("i");
    this.led.className = "spotamp-status__led";
    this.led.setAttribute("aria-hidden", "true");
    this.linkText = doc.createElement("span");
    this.linkText.textContent = "LINKING";
    state.append(this.led, this.linkText);

    this.pageText = doc.createElement("span");
    this.pageText.className = "spotamp-status__page";
    this.pageText.textContent = "SPOTIFY";

    this.shuffleButton = this.button(
      "SHUF OFF",
      "Shuffle is off. Click to cycle off, on, and Smart Shuffle.",
      "shuffle",
    );
    this.shuffleButton.className = "spotamp-status__shuffle";
    this.shuffleButton.dataset.mode = "off";

    this.notice = doc.createElement("span");
    this.notice.className = "spotamp-status__notice";
    this.notice.textContent = DEFAULT_NOTICE;

    const spacer = doc.createElement("span");
    spacer.className = "spotamp-status__spacer";

    this.playerButton = this.button("PLAYER", "Open the Winamp player", "player");
    this.doubleButton = this.button(
      "2X",
      "Double-size Winamp windows (Ctrl+D)",
      "double-size",
    );
    this.doubleButton.classList.add("spotamp-status__double");
    this.doubleButton.dataset.state = "off";
    this.doubleButton.setAttribute("aria-pressed", "false");
    const libraryButton = this.button("LIB", "Open the Winamp library", "library");
    const helpButton = this.button("?", "Spotamp limitations", "help");
    const offButton = this.button("OFF", "Disable Spotamp and restore Spotify", "off");

    this.element.append(
      brand,
      slot,
      state,
      this.pageText,
      this.shuffleButton,
      this.notice,
      spacer,
      libraryButton,
      this.playerButton,
      this.doubleButton,
      helpButton,
      offButton,
    );

    this.help = this.createHelp();
    doc.body.append(this.element, this.help);

    this.playerButton.addEventListener("click", () => this.options.onPlayer());
    this.doubleButton.addEventListener("click", () => this.options.onDoubleSize());
    libraryButton.addEventListener("click", () => this.options.onLibrary());
    this.shuffleButton.addEventListener("click", () => this.options.onShuffle());
    helpButton.addEventListener("click", () => this.toggleHelp());
    offButton.addEventListener("click", () => this.options.onDisable());
    doc.addEventListener("keydown", this.handleKeydown);
  }

  setPage(label: string): void {
    this.pageText.textContent = label || "SPOTIFY";
    this.pageText.title = label || "Spotify";
  }

  setPlayback(snapshot: PlaybackSnapshot): void {
    const shuffleLabel =
      snapshot.shuffle === "smart"
        ? "SMART"
        : snapshot.shuffle === "on"
          ? "ON"
          : "OFF";
    this.shuffleButton.textContent = `SHUF ${shuffleLabel}`;
    this.shuffleButton.dataset.mode = snapshot.shuffle;
    this.shuffleButton.setAttribute(
      "aria-label",
      `Shuffle is ${shuffleLabel.toLowerCase()}. Click to cycle off, on, and Smart Shuffle.`,
    );
    this.shuffleButton.title = `Shuffle: ${shuffleLabel} — click to cycle`;

    this.led.dataset.state = snapshot.available
      ? snapshot.playing
        ? "playing"
        : "paused"
      : "offline";
    this.linkText.textContent = snapshot.available ? "SPOTIFY LINK" : "NO PLAYER";
    this.linkText.title = snapshot.available
      ? snapshot.playing
        ? "Spotify is playing"
        : "Spotify is paused"
      : "Spotify player controls are not available";
  }

  setScale(scale: number): void {
    const doubled = scale >= 1.75;
    const percent = Math.round(scale * 100);
    this.doubleButton.dataset.state = doubled ? "on" : "off";
    this.doubleButton.setAttribute("aria-pressed", doubled ? "true" : "false");
    this.doubleButton.textContent = doubled ? "1X" : "2X";
    this.doubleButton.title = doubled
      ? "Winamp windows at 200% — click for 100% (Ctrl+D)"
      : `Winamp windows at ${percent}% — click for 200% (Ctrl+D)`;
  }

  setPlayerOpen(open: boolean): void {
    this.playerButton.dataset.state = open ? "open" : "closed";
    this.playerButton.setAttribute(
      "aria-label",
      open ? "Spotamp player is open" : "Open the Winamp player",
    );
    this.playerButton.title = open
      ? "Winamp player is open"
      : "Open the Winamp player";
  }

  setNotice(message: string, tone: "info" | "warn" = "warn"): void {
    if (this.noticeTimer != null) this.win.clearTimeout(this.noticeTimer);
    if (this.noticeResetTimer != null) this.win.clearTimeout(this.noticeResetTimer);
    this.notice.textContent = message;
    this.notice.dataset.tone = tone;
    this.notice.title = message;
    this.noticeTimer = this.win.setTimeout(() => {
      this.noticeTimer = null;
      this.notice.textContent = DEFAULT_NOTICE;
      this.notice.dataset.tone = "muted";
      this.notice.title = "";
    }, 7000);
  }

  destroy(): void {
    if (this.noticeTimer != null) this.win.clearTimeout(this.noticeTimer);
    if (this.noticeResetTimer != null) this.win.clearTimeout(this.noticeResetTimer);
    this.noticeTimer = null;
    this.noticeResetTimer = null;
    this.doc.removeEventListener("keydown", this.handleKeydown);
    this.element.remove();
    this.help.remove();
  }

  private button(label: string, ariaLabel: string, action: string): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = "spotamp-status__button";
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    button.setAttribute("data-spotamp-action", action);
    return button;
  }

  private createHelp(): HTMLDivElement {
    const doc = this.doc;
    const help = doc.createElement("div");
    help.id = "spotamp-help";
    help.className = "spotamp-help";
    help.hidden = true;
    help.setAttribute("role", "dialog");
    help.setAttribute("aria-label", "Spotamp limitations");

    const title = doc.createElement("div");
    title.className = "spotamp-help__title";
    title.textContent = "SPOTAMP // README.TXT";

    const list = doc.createElement("ul");
    for (const text of [
      "Play, pause, previous and next are sent to Spotify's real web player.",
      "Progress, seeking and volume use Spotify's own controls. Spotify must be playing for them to respond.",
      "Webamp's equalizer and visualizer are display-only. Spotify audio is never captured or routed through the extension, so EQ changes do not alter the stream.",
      "Local files and arbitrary URLs cannot be played here. Spotify remains the only audio source.",
      "2X scales every Winamp window and this strip with pixel-crisp rendering. Ctrl+D toggles it. The extension popup sets any scale from 50% to 200%.",
      "Spotify playlist edits, account, login and navigation are left intact.",
      "Use OFF below to restore Spotify's normal interface instantly.",
    ]) {
      const item = doc.createElement("li");
      item.textContent = text;
      list.append(item);
    }

    const close = doc.createElement("button");
    close.type = "button";
    close.className = "spotamp-help__close";
    close.textContent = "CLOSE";
    close.setAttribute("aria-label", "Close Spotamp limitations");
    close.addEventListener("click", () => this.toggleHelp(false));

    help.append(title, list, close);
    return help;
  }

  private toggleHelp(force?: boolean): void {
    const next = force ?? this.help.hidden;
    this.help.hidden = !next;
    if (next) this.help.querySelector<HTMLButtonElement>("button")?.focus();
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && !this.help.hidden) {
      this.toggleHelp(false);
      return;
    }
    if (
      event.ctrlKey &&
      !event.repeat &&
      event.key.toLowerCase() === "d" &&
      !isEditable(event.target)
    ) {
      event.preventDefault();
      this.options.onDoubleSize();
    }
  };
}
