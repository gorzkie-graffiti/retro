import { useState } from "react";
import { GEMINI } from "../data";
import type { GeminiSettings } from "../types";

interface HelpModuleProps {
  settings: GeminiSettings;
  onOpenSettings: () => void;
}

const START_COMMAND = ".\\start.cmd -Use bridge";

export function HelpModule({ settings, onOpenSettings }: HelpModuleProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const isAiStudio = settings.provider === "ai-studio";
  const command = isAiStudio ? ".\\start.cmd -Use api" : START_COMMAND;

  async function copyCommand() {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(command);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2400);
    }
  }

  return (
    <div className="help-shell">
      <div className="help-column">
        <h3>Getting started</h3>
        <ul className="help-list">
          <li>
            Use the chat module to ask Gemini. Press <kbd>Enter</kbd> to send,
            or <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line.
          </li>
          <li>
            Every message resends the earlier turns of this conversation, because
            the bridge simulates multi-turn context.
          </li>
          <li>
            Drag module title bars to rearrange the page. The layout and your
            conversations are saved in this browser.
          </li>
          <li>
            Answers use safe Markdown formatting: headings, emphasis, lists,
            links, and code. Model-generated HTML is shown as text, never
            executed.
          </li>
        </ul>
        <h3>About this beta</h3>
        <p>
          {GEMINI.productName} is a fictional 2008-style shell around the Gemini
          backend you choose: the local gemini-web2api service or Google's Gemini
          API. It is an independent project and is not affiliated with Google.{" "}
          {GEMINI.buildLabel}.
        </p>
      </div>

      <div className="help-column help-column--bridge">
        <h3>Backend setup</h3>
        <p>
          Active backend: <strong>{isAiStudio ? "Google Gemini API" : "gemini-web2api bridge"}</strong>
          {" "}· <code>{settings.baseUrl}</code>
        </p>
        <p>
          {isAiStudio
            ? "With GEMINI_API_KEY set in .env, start everything from the repo root:"
            : "If the status light is red, start everything from the repo root:"}
        </p>
        <div className="command-block">
          <code>{command}</code>
          <button
            className="btn btn-small"
            onClick={() => void copyCommand()}
            title="Copy the start command"
            type="button"
          >
            {copyState === "copied"
              ? "Copied!"
              : copyState === "failed"
                ? "Select it"
                : "Copy"}
          </button>
        </div>
        <p>
          {isAiStudio ? (
            <>
              The start script reads <code>GEMINI_API_KEY</code> from{" "}
              <code>.env</code> and proxies requests, so the key never reaches
              this page. You can also switch backends in API Settings.
            </>
          ) : (
            <>
              It listens on <code>127.0.0.1:8081/v1</code> by default. If{" "}
              <code>api_keys</code> is set in its <code>config.json</code>, paste
              the same key in API Settings. A cookie is only needed for real Pro
              routing.
            </>
          )}
        </p>
        <div className="help-actions">
          <button className="btn btn-small" onClick={onOpenSettings} type="button">
            Open API Settings
          </button>
          <a
            className="external-link"
            href={GEMINI.bridgeRepository}
            rel="noreferrer"
            target="_blank"
          >
            Bridge README ↗
          </a>
        </div>
        <p className="help-privacy">
          <strong>Privacy:</strong> chats stay in this browser's local storage and
          are sent only to the backend above.{isAiStudio
            ? " In API mode the key lives in .env and is added by the local proxy."
            : " A key typed into API Settings is also stored in this browser."}{" "}
          Use the beta on a trusted computer. Clear a conversation to remove it
          locally.
        </p>
      </div>
    </div>
  );
}
