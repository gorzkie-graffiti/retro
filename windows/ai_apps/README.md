# Gemini Web 2.0

A retro-styled web app for asking Gemini questions and reading the answers.

```bash
.\start.cmd -Use bridge   # local gemini-web2api service
.\start.cmd -Use api      # Google Gemini API, key from .env
```

Full setup, flags, maintenance, and the do-not list: [START.md](START.md).

## Backends

The app can talk to either backend; switch at runtime in **API Settings & Connection**, or pin one per run with `start.cmd -Use`.

- **gemini-web2api** — `gemini-web2api/`, a local server that translates the app into Gemini requests. OpenAI-compatible `POST /v1/chat/completions`.
- **Google Gemini API** — `POST /v1beta/models/{model}:generateContent`. With `.\start.cmd -Use api`, `GEMINI_API_KEY` is read from `.env` and attached by the local dev proxy, so the key never reaches the browser or the built bundle.

## Scripts

| Command | Purpose |
| --- | --- |
| `.\start.cmd` | Start with the remembered backend, starting the bridge if needed |
| `.\start.cmd -Use api -Build` | Build and serve against the Gemini API |
| `npm run dev` | Dev server only (no bridge startup, no provider pinning) |
| `npm run build` | Typecheck and build |
| `npm test` | Vitest suite |
| `npm run typecheck` | TypeScript only |

## Layout

- `src/api/` — backend clients and error mapping.
- `src/components/`, `src/themes/` — the three UI skins and their shared modules.
- `src/lib/` — settings, storage, conversations, Markdown, theming.
- `gemini-web2api/` — optional local bridge.

## Gemini API docs

- [Gemini API docs](https://ai.google.dev/gemini-api/docs/llms.txt)
- [AI Studio docs](https://aistudio.google.com/docs/llms.txt)

Notes on auth, endpoints, models, and quotas: [START.md](START.md#appendix-gemini-api-details).
