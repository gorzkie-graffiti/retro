import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type {
  ConnectionState,
  GeminiSettings,
  ModelInfo,
} from "../types";
import { GEMINI } from "../data";
import { ConnectionModule } from "./ConnectionModule";

export type SettingsDialogView = "connection" | "help";

interface SettingsDialogProps {
  variant: "messenger" | "assistant";
  initialView?: SettingsDialogView;
  settings: GeminiSettings;
  models: ModelInfo[];
  connection: ConnectionState;
  onApplySettings: (settings: GeminiSettings) => void;
  onModelChange: (model: string) => void;
  onClose: () => void;
}

const START_COMMAND = ".\\start.cmd -Use bridge";

function BackendHelp({
  settings,
  connection,
}: {
  settings: GeminiSettings;
  connection: ConnectionState;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const commandRef = useRef<HTMLInputElement>(null);
  const command =
    settings.provider === "ai-studio" ? ".\\start.cmd -Use api" : START_COMMAND;

  async function copyCommand() {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(command);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      commandRef.current?.focus();
      commandRef.current?.select();
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2400);
    }
  }

  return (
    <div className="retro-help">
      <h3>Backend setup</h3>
      <p>
        {settings.provider === "ai-studio" ? (
          <>
            These themes talk to the <strong>Google Gemini API</strong>{" "}
            directly. Current endpoint: <code>{settings.baseUrl}</code>.
          </>
        ) : (
          <>
            These themes use the local <strong>gemini-web2api</strong> service
            as the Web 2.0 homepage. Current endpoint:{" "}
            <code>{settings.baseUrl}</code>.
          </>
        )}
      </p>
      <div className={`retro-help-status retro-help-status--${connection.status}`}>
        <span className={`led led--${connection.status}`} aria-hidden="true" />
        <span>{connection.message}</span>
      </div>
      <p>
        {settings.provider === "ai-studio"
          ? "With the key in .env, start everything from the repo root:"
          : "If the bridge is stopped, start everything from the repo root:"}
      </p>
      <div className="retro-command-row">
        <input
          aria-label="Bridge start command"
          readOnly
          ref={commandRef}
          spellCheck={false}
          type="text"
          value={command}
        />
        <button className="retro-button" onClick={() => void copyCommand()} type="button">
          {copyState === "copied"
            ? "Copied"
            : copyState === "failed"
              ? "Select + copy"
              : "Copy"}
        </button>
      </div>
      <p className="retro-help-fine">
        {settings.provider === "ai-studio" ? (
          <>
            Put <code>GEMINI_API_KEY</code> in <code>.env</code> first. The key
            stays on the server; chats stay in this browser.
          </>
        ) : (
          <>
            The documented default is <code>http://127.0.0.1:8081/v1</code>. A
            cookie is only needed for real Pro routing. API keys and chats stay
            in this browser.
          </>
        )}
      </p>
      <a
        className="retro-help-link"
        href={GEMINI.bridgeRepository}
        rel="noreferrer"
        target="_blank"
      >
        Open the bridge README ↗
      </a>
    </div>
  );
}

/**
 * A period-style modal used by both alternate skins. The API form itself is
 * the existing ConnectionModule, so there is only one connection implementation.
 */
export function SettingsDialog({
  variant,
  initialView = "connection",
  settings,
  models,
  connection,
  onApplySettings,
  onModelChange,
  onClose,
}: SettingsDialogProps) {
  const [view, setView] = useState<SettingsDialogView>(initialView);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tabId = useId();

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
    );
    if (!focusable || focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const title =
    view === "help" ? "Gemini Backend Help" : "Gemini Connection Properties";

  return (
    <div
      className={`retro-dialog-layer retro-dialog-layer--${variant}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby={`${tabId}-title`}
        aria-modal="true"
        className={`retro-dialog retro-dialog--${variant}`}
        onKeyDown={trapFocus}
        ref={dialogRef}
        role="dialog"
      >
        <div className="retro-dialog-titlebar">
          <span aria-hidden="true" className="retro-dialog-icon">
            ⚙
          </span>
          <span className="retro-dialog-title" id={`${tabId}-title`}>
            {title}
          </span>
          <button
            aria-label="Close dialog"
            className="retro-window-close"
            onClick={onClose}
            ref={closeRef}
            title="Close"
            type="button"
          >
            ×
          </button>
        </div>

        <div aria-label="Settings sections" className="retro-dialog-tabs" role="tablist">
          <button
            aria-selected={view === "connection"}
            className="retro-tab"
            onClick={() => setView("connection")}
            role="tab"
            type="button"
          >
            Connection
          </button>
          <button
            aria-selected={view === "help"}
            className="retro-tab"
            onClick={() => setView("help")}
            role="tab"
            type="button"
          >
            Backend help
          </button>
        </div>

        <div className="retro-dialog-body">
          {view === "connection" ? (
            <ConnectionModule
              connection={connection}
              models={models}
              onApplySettings={onApplySettings}
              onModelChange={onModelChange}
              onOpenHelp={() => setView("help")}
              settings={settings}
            />
          ) : (
            <BackendHelp connection={connection} settings={settings} />
          )}
        </div>

        <div className="retro-dialog-footer">
          <span className="retro-dialog-note">
            Settings apply to every theme.
          </span>
          <button className="retro-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
