import react from "@vitejs/plugin-react";
import { loadEnv, type ProxyOptions } from "vite";
import { defineConfig } from "vitest/config";

const AI_STUDIO_ORIGIN = "https://generativelanguage.googleapis.com";

interface ProxyRequestLike {
  getHeader(name: string): unknown;
  setHeader(name: string, value: string): void;
}

interface ProxyServerLike {
  on(event: "proxyReq", listener: (request: ProxyRequestLike) => void): void;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiKey = (env.GEMINI_API_KEY ?? "").trim();

  /**
   * AI Studio mode: the browser calls the same-origin `/gemini-api/*` path and
   * this proxy attaches the key from `.env` server-side, so the key is never
   * sent to or stored by the browser. Without a key the route is not created.
   */
  const proxy: Record<string, ProxyOptions> | undefined = apiKey
    ? {
        "/gemini-api": {
          target: AI_STUDIO_ORIGIN,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/gemini-api/, ""),
          configure: (proxyServer) => {
            const server = proxyServer as unknown as ProxyServerLike;
            server.on("proxyReq", (request) => {
              if (!request.getHeader("x-goog-api-key")) {
                request.setHeader("x-goog-api-key", apiKey);
              }
            });
          },
        },
      }
    : undefined;

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy,
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      proxy,
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
