import { useEffect, useState, type FormEvent } from "react";
import { validateBaseUrl } from "../api/geminiClient";
import { formatClock } from "../lib/format";
import {
  AI_STUDIO_PROXY_BASE_URL,
  defaultBaseUrl,
  defaultModel,
  isProvider,
  PROVIDER_LABELS,
  proxyEnabled,
} from "../lib/settings";
import type {
  ConnectionState,
  GeminiProvider,
  GeminiSettings,
  ModelInfo,
} from "../types";
import { Spinner } from "./Spinner";

interface ConnectionModuleProps {
  settings: GeminiSettings;
  models: ModelInfo[];
  connection: ConnectionState;
  onApplySettings: (settings: GeminiSettings) => void;
  onModelChange: (model: string) => void;
  onOpenHelp: () => void;
}

export function ConnectionModule({
  settings,
  models,
  connection,
  onApplySettings,
  onModelChange,
  onOpenHelp,
}: ConnectionModuleProps) {
  const [providerDraft, setProviderDraft] = useState<GeminiProvider>(
    settings.provider,
  );
  const [baseUrlDraft, setBaseUrlDraft] = useState(settings.baseUrl);
  const [keyDraft, setKeyDraft] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setProviderDraft(settings.provider);
    setBaseUrlDraft(settings.baseUrl);
  }, [settings.provider, settings.baseUrl]);

  const optionList = models.some((option) => option.id === settings.model)
    ? models
    : [
        { id: settings.model, description: "Current selection" },
        ...models,
      ];

  const isAiStudio = providerDraft === "ai-studio";

  function handleProviderChange(value: string) {
    if (!isProvider(value) || value === providerDraft) {
      return;
    }
    setProviderDraft(value);
    setBaseUrlDraft(defaultBaseUrl(value));
    // Bridge-only and Gemini-API-only model IDs differ, so start from the new
    // backend's default instead of carrying over a model it cannot serve.
    onModelChange(defaultModel(value));
    setFormError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    let normalizedBase: string;
    try {
      normalizedBase = validateBaseUrl(baseUrlDraft);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Enter a valid base URL.",
      );
      return;
    }

    const typedKey = keyDraft.trim();
    onApplySettings({
      ...settings,
      provider: providerDraft,
      baseUrl: normalizedBase,
      apiKey: typedKey || settings.apiKey,
    });
    setKeyDraft("");
  }

  function clearSavedKey() {
    setFormError("");
    setKeyDraft("");
    onApplySettings({ ...settings, apiKey: "" });
  }

  const statusLabel =
    connection.status === "online"
      ? "Connected"
      : connection.status === "checking"
        ? "Checking…"
        : "Disconnected";

  const endpointLabel = isAiStudio
    ? `${settings.baseUrl}/models/${settings.model}:generateContent`
    : `${settings.baseUrl}/chat/completions`;

  return (
    <form className="connection-shell" noValidate onSubmit={handleSubmit}>
      <div
        aria-live="polite"
        className={`connection-status connection-status--${connection.status}`}
        role="status"
      >
        <span className="connection-status-icon" aria-hidden="true">
          {connection.status === "checking" ? (
            <Spinner small />
          ) : (
            <span className={`led led--${connection.status}`} />
          )}
        </span>
        <div className="connection-status-copy">
          <strong>{statusLabel}</strong>
          <span className="connection-message" title={connection.message}>
            {connection.message}
          </span>
        </div>
      </div>

      <div className="connection-meta">
        <span>
          Last check: <strong>{formatClock(connection.checkedAt)}</strong>
        </span>
        {connection.latencyMs !== undefined ? (
          <span>
            Latency: <strong>{connection.latencyMs} ms</strong>
          </span>
        ) : null}
        {connection.modelCount !== undefined ? (
          <span>
            Models: <strong>{connection.modelCount}</strong>
          </span>
        ) : null}
      </div>

      <div className="field-row field-row--inline">
        <label htmlFor="api-provider">Backend</label>
        <select
          id="api-provider"
          onChange={(event) => handleProviderChange(event.target.value)}
          value={providerDraft}
        >
          {(Object.keys(PROVIDER_LABELS) as GeminiProvider[]).map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABELS[provider]}
            </option>
          ))}
        </select>
      </div>
      <div className="field-help" id="provider-help">
        {isAiStudio ? (
          <>
            Answers come straight from the Google Gemini API. Run{" "}
            <code>.\start.cmd -Use api</code> to load the key from{" "}
            <code>.env</code>; no key is stored in the browser that way.
          </>
        ) : (
          <>
            Answers come through the local <code>gemini-web2api</code> service.
            Start it with <code>.\start.cmd -Use bridge</code>.
          </>
        )}
      </div>

      <div className="field-row">
        <label htmlFor="api-base-url">
          Base URL{" "}
          <span className="field-note">
            {isAiStudio ? "Gemini API endpoint" : "OpenAI-compatible endpoint"}
          </span>
        </label>
        <input
          aria-describedby="base-url-help"
          autoComplete="off"
          id="api-base-url"
          onChange={(event) => setBaseUrlDraft(event.target.value)}
          spellCheck={false}
          type="text"
          value={baseUrlDraft}
        />
        <div className="field-help" id="base-url-help">
          {isAiStudio ? (
            proxyEnabled() ? (
              <>
                Default: <code>{AI_STUDIO_PROXY_BASE_URL}</code> — the proxy adds
                your key server-side.
              </>
            ) : (
              <>
                Default: https://generativelanguage.googleapis.com/v1beta —
                paste a key below, or use the start script.
              </>
            )
          ) : (
            <>Default: http://127.0.0.1:8081/v1</>
          )}
        </div>
      </div>

      <div className="field-row">
        <label htmlFor="api-key">
          API key{" "}
          <span className="field-note">
            {settings.apiKey ? "a key is saved" : "optional"}
          </span>
        </label>
        <div className="key-row">
          <input
            autoComplete="new-password"
            id="api-key"
            onChange={(event) => setKeyDraft(event.target.value)}
            placeholder={
              settings.apiKey
                ? "Saved key is hidden — type to replace"
                : isAiStudio
                  ? "Leave empty when using .\\start.cmd -Use api"
                  : "Not required unless api_keys is set"
            }
            spellCheck={false}
            type="password"
            value={keyDraft}
          />
          <button
            className="btn btn-small"
            data-tip="Remove the saved key from this browser"
            disabled={!settings.apiKey}
            onClick={clearSavedKey}
            title="Remove the saved key from this browser"
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="field-row field-row--inline">
        <label htmlFor="settings-model">Preferred model</label>
        <select
          id="settings-model"
          onChange={(event) => onModelChange(event.target.value)}
          value={settings.model}
        >
          {optionList.map((option) => (
            <option key={option.id} value={option.id}>
              {option.id}
            </option>
          ))}
        </select>
      </div>

      {formError ? (
        <div className="inline-error" role="alert">
          {formError}
        </div>
      ) : null}

      <div className="connection-actions">
        <button className="btn btn-primary" type="submit">
          Save &amp; test connection
        </button>
        <button
          className="link-button"
          onClick={onOpenHelp}
          title="How to start the backend"
          type="button"
        >
          Start-up help
        </button>
      </div>

      <div className="connection-endpoint" title={endpointLabel}>
        POST <code>{endpointLabel}</code>
      </div>
    </form>
  );
}
