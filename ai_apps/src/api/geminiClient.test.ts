import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkConnection,
  friendlyErrorMessage,
  GeminiApiError,
  listModels,
  sendChat,
  validateBaseUrl,
} from "./geminiClient";
import type { GeminiSettings } from "../types";

const SETTINGS: GeminiSettings = {
  provider: "bridge",
  baseUrl: "http://127.0.0.1:8081/v1",
  apiKey: "",
  model: "gemini-3.6-flash",
};

const AI_STUDIO_SETTINGS: GeminiSettings = {
  provider: "ai-studio",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  apiKey: "key-123",
  model: "gemini-3.6-flash",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(
  implementation: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return vi.fn(implementation) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateBaseUrl", () => {
  it("normalizes trailing slashes", () => {
    expect(validateBaseUrl(" http://127.0.0.1:8081/v1/// ")).toBe(
      "http://127.0.0.1:8081/v1",
    );
  });

  it("rejects missing or non-http URLs", () => {
    expect(() => validateBaseUrl("")).toThrow(/base URL/i);
    expect(() => validateBaseUrl("127.0.0.1:8081/v1")).toThrow(/not valid/i);
    expect(() => validateBaseUrl("ftp://127.0.0.1/v1")).toThrow(/http/i);
  });

  it("accepts the same-origin API proxy path", () => {
    expect(validateBaseUrl("/gemini-api/v1beta/")).toBe("/gemini-api/v1beta");
  });
});

describe("listModels", () => {
  it("reads the documented OpenAI-compatible model list", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({
        object: "list",
        data: [
          {
            id: "gemini-3.6-flash",
            object: "model",
            description: "All-around model",
          },
          { id: "gemini-3.1-pro", object: "model" },
        ],
      }),
    );

    const models = await listModels(SETTINGS, { fetchImpl });

    expect(models).toEqual([
      { id: "gemini-3.6-flash", description: "All-around model" },
      { id: "gemini-3.1-pro", description: "No description reported" },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8081/v1/models",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends the API key as a Bearer token when configured", async () => {
    const fetchImpl = mockFetch(async () => jsonResponse({ data: [] }));
    await listModels({ ...SETTINGS, apiKey: "sk-test" }, { fetchImpl });

    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-test",
    );
  });

  it("omits Authorization when no key is configured", async () => {
    const fetchImpl = mockFetch(async () => jsonResponse({ data: [] }));
    await listModels(SETTINGS, { fetchImpl });

    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it("fails clearly when the endpoint is missing", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({ error: { message: "not found" } }, 404),
    );

    await expect(listModels(SETTINGS, { fetchImpl })).rejects.toMatchObject({
      kind: "not-found",
      status: 404,
    });
  });

  it("surfaces a helpful authentication error", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({ error: { message: "invalid api key" } }, 401),
    );

    const error = await listModels(SETTINGS, { fetchImpl }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(GeminiApiError);
    expect((error as GeminiApiError).kind).toBe("auth");
    expect(friendlyErrorMessage(error)).toMatch(/API Settings/i);
  });
});

describe("checkConnection", () => {
  it("reports models and a latency measurement", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({ data: [{ id: "gemini-3.6-flash", description: "Flash" }] }),
    );

    const result = await checkConnection(SETTINGS, { fetchImpl });
    expect(result.models).toHaveLength(1);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.checkedAt).toBeGreaterThan(0);
  });
});

describe("sendChat", () => {
  it("sends the full prior conversation as non-streaming messages", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({
        model: "gemini-3.6-flash",
        choices: [
          { message: { role: "assistant", content: "Hello again, Ada." } },
        ],
      }),
    );

    const result = await sendChat(
      { ...SETTINGS, apiKey: "sk-retro" },
      [
        { role: "user", content: "My name is Ada." },
        { role: "assistant", content: "Nice to meet you, Ada." },
        { role: "user", content: "What is my name?" },
      ],
      { fetchImpl },
    );

    expect(result.content).toBe("Hello again, Ada.");
    expect(result.model).toBe("gemini-3.6-flash");

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8081/v1/chat/completions");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-retro");
    expect(headers["Content-Type"]).toBe("application/json");

    const payload = JSON.parse(String(init.body)) as {
      model: string;
      stream: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    expect(payload.model).toBe("gemini-3.6-flash");
    expect(payload.stream).toBe(false);
    expect(payload.messages).toEqual([
      { role: "user", content: "My name is Ada." },
      { role: "assistant", content: "Nice to meet you, Ada." },
      { role: "user", content: "What is my name?" },
    ]);
  });

  it("turns an empty answer into an explicit error rather than a blank reply", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({ choices: [{ message: { content: "   " } }] }),
    );

    await expect(
      sendChat(SETTINGS, [{ role: "user", content: "Hi" }], { fetchImpl }),
    ).rejects.toMatchObject({ kind: "bad-response" });
  });

  it("maps upstream server failures", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({ error: { message: "upstream error" } }, 502),
    );

    const error = await sendChat(
      SETTINGS,
      [{ role: "user", content: "Hi" }],
      { fetchImpl },
    ).catch((caught: unknown) => caught);

    expect((error as GeminiApiError).kind).toBe("server");
    expect(friendlyErrorMessage(error)).toMatch(/gemini\.google\.com/i);
  });

  it("reports network failures with the attempted URL", async () => {
    const fetchImpl = mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const error = await sendChat(
      SETTINGS,
      [{ role: "user", content: "Hi" }],
      { fetchImpl },
    ).catch((caught: unknown) => caught);

    expect((error as GeminiApiError).kind).toBe("network");
    expect((error as Error).message).toContain(
      "http://127.0.0.1:8081/v1/chat/completions",
    );
  });

  it("times out hanging bridge requests", async () => {
    const fetchImpl = mockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    await expect(
      sendChat(SETTINGS, [{ role: "user", content: "Hi" }], {
        fetchImpl,
        timeoutMs: 15,
      }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("reports a caller cancellation as aborted", async () => {
    const controller = new AbortController();
    const fetchImpl = mockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const pending = sendChat(SETTINGS, [{ role: "user", content: "Hi" }], {
      fetchImpl,
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
  });
});

describe("Gemini API provider", () => {
  it("posts generateContent with Gemini roles and the API key header", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: "Hello, Ada." }] } }],
        modelVersion: "gemini-3.6-flash",
      }),
    );

    const result = await sendChat(
      AI_STUDIO_SETTINGS,
      [
        { role: "user", content: "My name is Ada." },
        { role: "assistant", content: "Nice to meet you." },
        { role: "user", content: "What is my name?" },
      ],
      { fetchImpl },
    );

    expect(result.content).toBe("Hello, Ada.");
    expect(result.model).toBe("gemini-3.6-flash");

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("key-123");
    expect(headers.Authorization).toBeUndefined();

    const payload = JSON.parse(String(init.body)) as {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    };
    expect(payload.contents).toEqual([
      { role: "user", parts: [{ text: "My name is Ada." }] },
      { role: "model", parts: [{ text: "Nice to meet you." }] },
      { role: "user", parts: [{ text: "What is my name?" }] },
    ]);
  });

  it("merges consecutive user turns so the history is accepted", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
    );

    await sendChat(
      AI_STUDIO_SETTINGS,
      [
        { role: "user", content: "First try." },
        { role: "user", content: "Second try." },
      ],
      { fetchImpl },
    );

    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    const payload = JSON.parse(String(init.body)) as {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    };
    expect(payload.contents).toHaveLength(1);
    expect(payload.contents[0].parts[0].text).toBe("First try.\n\nSecond try.");
  });

  it("reads the Gemini model list and keeps only generateContent models", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({
        models: [
          {
            name: "models/gemini-3.8-flash",
            displayName: "Gemini 3.8 Flash",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/embedding-001",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
      }),
    );

    const models = await listModels(AI_STUDIO_SETTINGS, { fetchImpl });

    expect(models).toEqual([
      { id: "gemini-3.8-flash", description: "Gemini 3.8 Flash" },
    ]);
  });

  it("surfaces a rejected key with a .env hint", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(
        { error: { code: 400, message: "API key not valid" } },
        400,
      ),
    );

    const error = await sendChat(
      AI_STUDIO_SETTINGS,
      [{ role: "user", content: "Hi" }],
      { fetchImpl },
    ).catch((caught: unknown) => caught);

    expect((error as GeminiApiError).kind).toBe("auth");
    expect(friendlyErrorMessage(error)).toMatch(/GEMINI_API_KEY/);
  });

  it("explains a safety block instead of returning a blank answer", async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse({ promptFeedback: { blockReason: "SAFETY" } }),
    );

    const error = await sendChat(
      AI_STUDIO_SETTINGS,
      [{ role: "user", content: "Hi" }],
      { fetchImpl },
    ).catch((caught: unknown) => caught);

    expect((error as GeminiApiError).kind).toBe("bad-response");
    expect(friendlyErrorMessage(error)).toMatch(/SAFETY/);
  });
});
