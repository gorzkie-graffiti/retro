import type { GeminiProvider, GeminiSettings, ModelInfo } from "../types";

export const DEFAULT_REQUEST_TIMEOUT_MS = 180_000;
export const DEFAULT_CONNECTION_TIMEOUT_MS = 8_000;

export type GeminiErrorKind =
  | "config"
  | "network"
  | "timeout"
  | "auth"
  | "not-found"
  | "rate-limit"
  | "server"
  | "bad-response"
  | "aborted";

export class GeminiApiError extends Error {
  readonly kind: GeminiErrorKind;
  readonly status?: number;

  constructor(message: string, kind: GeminiErrorKind, status?: number) {
    super(message);
    this.name = "GeminiApiError";
    this.kind = kind;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

export interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  model: string;
  durationMs: number;
}

export interface ConnectionResult {
  models: ModelInfo[];
  latencyMs: number;
  checkedAt: number;
}

interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) {
    return fetchImpl;
  }
  if (typeof fetch !== "function") {
    throw new GeminiApiError(
      "This browser does not provide fetch(); use a current browser.",
      "config",
    );
  }
  return fetch;
}

/**
 * Accepts absolute http(s) URLs plus root-relative paths such as
 * `/gemini-api/v1beta`, which the dev/preview proxy serves with the key added
 * server-side.
 */
export function validateBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new GeminiApiError(
      "Enter a base URL, for example http://127.0.0.1:8081/v1 (bridge) or https://generativelanguage.googleapis.com/v1beta (AI Studio).",
      "config",
    );
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.length < 2) {
      throw new GeminiApiError(
        "That base URL is not valid. Use a full http:// URL, or /gemini-api/v1beta with the start script.",
        "config",
      );
    }
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new GeminiApiError(
      "That base URL is not valid. Include the scheme, for example http://127.0.0.1:8081/v1.",
      "config",
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new GeminiApiError(
      "The base URL must use http:// or https://.",
      "config",
    );
  }

  return trimmed;
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function serverErrorMessage(data: unknown, raw: string): string {
  const object = record(data);
  if (object) {
    const error = object.error;
    if (typeof error === "string" && error.trim()) {
      return error.trim();
    }
    const errorObject = record(error);
    if (errorObject && typeof errorObject.message === "string") {
      return errorObject.message.trim();
    }
    if (typeof object.message === "string" && object.message.trim()) {
      return object.message.trim();
    }
    if (typeof object.detail === "string" && object.detail.trim()) {
      return object.detail.trim();
    }
  }
  return raw.trim().slice(0, 300);
}

function httpError(
  status: number,
  detail: string,
  target: string,
  provider: GeminiProvider,
): GeminiApiError {
  const suffix = detail ? ` Server said: ${detail}` : "";

  if (provider === "ai-studio") {
    if (status === 400 || status === 401 || status === 403) {
      return new GeminiApiError(
        `Google rejected the request (HTTP ${status}). Check that GEMINI_API_KEY is valid and allowed to use this model.${suffix}`,
        "auth",
        status,
      );
    }
    if (status === 404) {
      return new GeminiApiError(
        `The Gemini API could not find that model or endpoint (HTTP 404). Check the model name and the base URL (${target}).${suffix}`,
        "not-found",
        status,
      );
    }
    if (status === 429) {
      return new GeminiApiError(
        `The Gemini API rate limit or quota was reached (HTTP 429). Wait a moment, or check the limits for this project, then retry.${suffix}`,
        "rate-limit",
        status,
      );
    }
    if (status >= 500) {
      return new GeminiApiError(
        `The Gemini API reported HTTP ${status}. This is usually temporary; retry in a moment.${suffix}`,
        "server",
        status,
      );
    }
    return new GeminiApiError(
      `The Gemini API rejected the request (HTTP ${status}).${suffix}`,
      "bad-response",
      status,
    );
  }

  if (status === 401 || status === 403) {
    return new GeminiApiError(
      `Authentication failed (HTTP ${status}). If config.json in gemini-web2api has api_keys, add a matching key in API Settings.`,
      "auth",
      status,
    );
  }
  if (status === 404) {
    return new GeminiApiError(
      `The bridge answered HTTP 404. Check that the base URL points to the /v1 endpoint (${target}).${suffix}`,
      "not-found",
      status,
    );
  }
  if (status === 429) {
    return new GeminiApiError(
      `Gemini is rate-limiting requests (HTTP 429). Wait a moment and retry.${suffix}`,
      "rate-limit",
      status,
    );
  }
  if (status >= 500) {
    return new GeminiApiError(
      `The Gemini bridge reported HTTP ${status}. It may not be able to reach gemini.google.com.${suffix}`,
      "server",
      status,
    );
  }
  return new GeminiApiError(
    `The Gemini bridge rejected the request (HTTP ${status}).${suffix}`,
    "bad-response",
    status,
  );
}

function describeNetworkError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "network request failed";
}

function unreachableHint(provider: GeminiProvider): string {
  return provider === "ai-studio"
    ? "Check the network connection and the backend URL; with start.sh --use api, make sure GEMINI_API_KEY is set in .env."
    : "Is gemini-web2api running? Start it with ./start.sh --use bridge.";
}

async function requestJson(
  url: string,
  init: RequestInit,
  options: RequestOptions,
  provider: GeminiProvider,
): Promise<unknown> {
  const fetchImpl = resolveFetch(options.fetchImpl);
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const externalSignal = options.signal;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
    const raw = await response.text();
    let data: unknown;

    if (raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        if (response.ok) {
          throw new GeminiApiError(
            provider === "ai-studio"
              ? "The Gemini API returned a response that was not valid JSON. Check the base URL."
              : "The bridge returned a response that was not valid JSON. Check the base URL and server version.",
            "bad-response",
          );
        }
      }
    }

    const target = url.replace(/\/models(?:\/[^/]+)?(?::\w+)?$/, "");

    if (!response.ok) {
      throw httpError(response.status, serverErrorMessage(data, raw), target, provider);
    }

    if (data === undefined) {
      throw new GeminiApiError(
        provider === "ai-studio"
          ? "The Gemini API returned an empty response."
          : "The bridge returned an empty response.",
        "bad-response",
      );
    }

    return data;
  } catch (error) {
    if (error instanceof GeminiApiError) {
      throw error;
    }
    if (timedOut) {
      const seconds = Math.round(timeoutMs / 1000);
      throw new GeminiApiError(
        `The request timed out after ${seconds} seconds. The backend may still be waiting on Gemini; retry in a moment.`,
        "timeout",
      );
    }
    if (externalSignal?.aborted) {
      throw new GeminiApiError("The request was cancelled.", "aborted");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GeminiApiError("The request was cancelled.", "aborted");
    }
    throw new GeminiApiError(
      `Could not reach ${provider === "ai-studio" ? "the Gemini API" : "the Gemini bridge"} at ${url}. ${unreachableHint(
        provider,
      )} (${describeNetworkError(error)})`,
      "network",
    );
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

/** The bridge takes an OpenAI-style Bearer token; Google takes x-goog-api-key. */
function authHeaders(settings: GeminiSettings): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = settings.apiKey.trim();
  if (!key) {
    return headers;
  }
  if (settings.provider === "ai-studio") {
    headers["x-goog-api-key"] = key;
  } else {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function parseBridgeModels(data: unknown): ModelInfo[] {
  const object = record(data);
  const list = Array.isArray(data)
    ? data
    : object && Array.isArray(object.data)
      ? object.data
      : null;

  if (!list) {
    throw new GeminiApiError(
      "The bridge's /v1/models response did not contain a model list.",
      "bad-response",
    );
  }

  const models: ModelInfo[] = [];
  for (const entry of list) {
    const item = record(entry);
    if (!item || typeof item.id !== "string" || !item.id.trim()) {
      continue;
    }
    models.push({
      id: item.id,
      description:
        typeof item.description === "string" && item.description.trim()
          ? item.description.trim()
          : "No description reported",
    });
  }
  return models;
}

/**
 * Google lists models as `models/gemini-…` and reports which methods each one
 * supports, so only generateContent-capable chat models are offered.
 */
function parseAiStudioModels(data: unknown): ModelInfo[] {
  const object = record(data);
  const list = object && Array.isArray(object.models) ? object.models : null;

  if (!list) {
    throw new GeminiApiError(
      "The Gemini API model list was missing. Check the API key and base URL.",
      "bad-response",
    );
  }

  const models: ModelInfo[] = [];
  for (const entry of list) {
    const item = record(entry);
    if (!item || typeof item.name !== "string" || !item.name.trim()) {
      continue;
    }
    const methods = Array.isArray(item.supportedGenerationMethods)
      ? item.supportedGenerationMethods
      : null;
    if (methods && !methods.includes("generateContent")) {
      continue;
    }
    const id = item.name.replace(/^models\//, "").trim();
    if (!id) {
      continue;
    }
    const label = [item.displayName, item.description].find(
      (value): value is string => typeof value === "string" && Boolean(value.trim()),
    );
    models.push({
      id,
      description: label ? label.trim() : "No description reported",
    });
  }
  return models;
}

export async function listModels(
  settings: GeminiSettings,
  options: RequestOptions = {},
): Promise<ModelInfo[]> {
  const baseUrl = validateBaseUrl(settings.baseUrl);
  const isAiStudio = settings.provider === "ai-studio";
  const data = await requestJson(
    endpoint(baseUrl, isAiStudio ? "models?pageSize=200" : "models"),
    {
      method: "GET",
      headers: authHeaders(settings),
    },
    {
      ...options,
      timeoutMs: options.timeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS,
    },
    settings.provider,
  );

  return isAiStudio ? parseAiStudioModels(data) : parseBridgeModels(data);
}

export async function checkConnection(
  settings: GeminiSettings,
  options: RequestOptions = {},
): Promise<ConnectionResult> {
  const startedAt = Date.now();
  const models = await listModels(settings, options);
  return {
    models,
    latencyMs: Date.now() - startedAt,
    checkedAt: Date.now(),
  };
}

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

/**
 * Google's REST API expects alternating roles. Failed answers are already
 * filtered out of history, which can leave two user turns in a row, so merge
 * them rather than letting the API reject the request.
 */
export function toGeminiContents(messages: ApiMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const message of messages) {
    if (!message.content.trim()) {
      continue;
    }
    const role: GeminiContent["role"] =
      message.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      const previous = last.parts[0]?.text ?? "";
      last.parts = [{ text: `${previous}\n\n${message.content}` }];
      continue;
    }
    contents.push({ role, parts: [{ text: message.content }] });
  }
  return contents;
}

function aiStudioText(data: unknown): { text: string; model?: string } {
  const object = record(data);
  if (!object) {
    return { text: "" };
  }

  const feedback = record(object.promptFeedback);
  const blockReason =
    feedback && typeof feedback.blockReason === "string"
      ? feedback.blockReason
      : "";

  const candidates = Array.isArray(object.candidates) ? object.candidates : [];
  const first = record(candidates[0]);
  const contentObject = record(first?.content);
  const parts = contentObject && Array.isArray(contentObject.parts)
    ? contentObject.parts
    : [];

  const text = parts
    .map((part) => {
      const block = record(part);
      return block && typeof block.text === "string" ? block.text : "";
    })
    .join("");

  if (!text.trim() && blockReason) {
    throw new GeminiApiError(
      `Gemini declined the prompt (${blockReason}). Rephrase the question and retry.`,
      "bad-response",
    );
  }
  if (!text.trim() && first && first.finishReason === "SAFETY") {
    throw new GeminiApiError(
      "Gemini blocked this answer for safety reasons. Rephrase the question and retry.",
      "bad-response",
    );
  }

  return {
    text,
    model:
      typeof object.modelVersion === "string" && object.modelVersion.trim()
        ? object.modelVersion.trim()
        : undefined,
  };
}

async function sendAiStudioChat(
  settings: GeminiSettings,
  messages: ApiMessage[],
  options: RequestOptions,
): Promise<ChatResult> {
  const baseUrl = validateBaseUrl(settings.baseUrl);
  const model = settings.model.trim().replace(/^models\//, "");
  const startedAt = Date.now();
  const data = await requestJson(
    endpoint(baseUrl, `models/${encodeURIComponent(model)}:generateContent`),
    {
      method: "POST",
      headers: {
        ...authHeaders(settings),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contents: toGeminiContents(messages) }),
    },
    {
      ...options,
      timeoutMs: options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    },
    "ai-studio",
  );

  const { text, model: reportedModel } = aiStudioText(data);
  if (!text.trim()) {
    throw new GeminiApiError(
      "Gemini returned an empty answer. Check the model name, the API key, and Google's service status, then retry.",
      "bad-response",
    );
  }

  return {
    content: text,
    model: reportedModel ?? model,
    durationMs: Date.now() - startedAt,
  };
}

async function sendBridgeChat(
  settings: GeminiSettings,
  messages: ApiMessage[],
  options: RequestOptions,
): Promise<ChatResult> {
  const baseUrl = validateBaseUrl(settings.baseUrl);
  const startedAt = Date.now();
  const data = await requestJson(
    endpoint(baseUrl, "chat/completions"),
    {
      method: "POST",
      headers: {
        ...authHeaders(settings),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        stream: false,
      }),
    },
    {
      ...options,
      timeoutMs: options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    },
    "bridge",
  );

  const object = record(data);
  const choices = object?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new GeminiApiError(
      "The bridge response contained no choices. Check its server logs for an upstream error.",
      "bad-response",
    );
  }

  const firstChoice = record(choices[0]);
  const message = firstChoice ? record(firstChoice.message) : null;
  let content: unknown = message?.content;

  if (Array.isArray(content)) {
    content = content
      .map((part) => {
        const block = record(part);
        return block && typeof block.text === "string" ? block.text : "";
      })
      .join("");
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new GeminiApiError(
      "Gemini returned an empty answer. This can happen when the bridge cannot reach gemini.google.com; check the bridge logs and retry.",
      "bad-response",
    );
  }

  return {
    content,
    model:
      typeof object?.model === "string" && object.model.trim()
        ? object.model
        : settings.model,
    durationMs: Date.now() - startedAt,
  };
}

export async function sendChat(
  settings: GeminiSettings,
  messages: ApiMessage[],
  options: RequestOptions = {},
): Promise<ChatResult> {
  if (!settings.model.trim()) {
    throw new GeminiApiError(
      "No model is selected. Choose a model in the chat toolbar.",
      "config",
    );
  }
  if (messages.length === 0) {
    throw new GeminiApiError("There is no message to send.", "config");
  }

  return settings.provider === "ai-studio"
    ? sendAiStudioChat(settings, messages, options)
    : sendBridgeChat(settings, messages, options);
}

export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof GeminiApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message || "An unexpected error occurred.";
  }
  return "An unexpected error occurred.";
}
