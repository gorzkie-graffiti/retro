# Start Guide

The quickest way to run this project without breaking it. For the long version, see [README.md](README.md).

The app needs answers from one of two backends, and you choose which one:

| Backend | What it is | Key needed |
| --- | --- | --- |
| `bridge` (default) | `gemini-web2api`, a local server in `gemini-web2api/` that talks to Gemini | only if its `config.json` sets `api_keys` |
| `api` | Google's Gemini API directly, through a local proxy | `GEMINI_API_KEY` in `.env` |

## Quick start

```bash
cp .env.example .env      # only needed for API mode; then add GEMINI_API_KEY
./start.sh                # remembered backend, starts the bridge if needed
./start.sh --use bridge   # force the local gemini-web2api service
./start.sh --use api      # force Google's Gemini API, key from .env
```

Flags:

| Flag | Effect |
| --- | --- |
| `--use bridge\|api` | Pin the backend for this run (`web2api` and `ai-studio` are accepted aliases) |
| `--port <number>` | Web app port (default `5173`, or `4173` with `--build`) |
| `--build` | Build the production bundle first and serve it |
| `--no-bridge` | Never start `gemini-web2api` automatically |
| `-h`, `--help` | Show usage |

`start.sh` installs dependencies if `node_modules/` is missing, loads `.env`, starts the bridge when nothing is listening on `BRIDGE_URL`, and stops a bridge it started when you press Ctrl+C. A bridge you started yourself is left alone.

---

## 1. Start gemini-web2api (bridge mode)

`start.sh --use bridge` starts it for you. To run it by hand:

1. Optionally create a real config from the example:
   ```bash
   cd gemini-web2api
   cp config.example.json config.json
   ```
   Without `config.json` the bridge runs on its built-in defaults (port `8081`, no API key required). If you do create one, set `api_keys`, `default_model`, and `port` as needed, and keep your real config out of version control.

2. Install the Python dependency if it is missing:
   ```bash
   pip install httpx
   ```
   Declared in `requirements.txt` as `httpx>=0.25`.

3. Start it:
   ```bash
   python gemini_web2api.py
   ```
   Or pick a port explicitly: `python gemini_web2api.py --port 8081`.

4. The bridge prints its base URL when ready, normally `http://127.0.0.1:8081/v1`. Config is read at startup, so restart after editing `config.json`.

---

## 2. Start the retro Gemini app

From the repo root:

1. Install frontend dependencies once:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   ./start.sh
   ```
   or without the script: `npm run dev`.
3. Open the printed URL, usually `http://127.0.0.1:5173/`.

Production-style run:

```bash
./start.sh --build            # build, then serve the bundle
npm run build && npm run preview   # same thing without the script
```

---

## 3. How to use it

### Choosing a backend

- **In the app:** the *API Settings & Connection* module has a **Backend** selector. Switching it resets the base URL and model to that backend's defaults; press **Save & test connection**.
- **From the terminal:** `./start.sh --use bridge` or `./start.sh --use api` pins the backend for that run, even if a different one was saved in the browser.
- **API mode** (`--use api`) reads `GEMINI_API_KEY` from `.env` and proxies requests through the dev server, so the key never reaches the browser or the bundle. You can also paste a key into API Settings (stored in this browser only) — useful when serving a plain build without the proxy.

### Asking questions

1. Type a question and send it with **Enter** (**Shift+Enter** for a new line).
2. Earlier turns are resent with each question, so Gemini can follow the conversation.
3. If an answer fails, press **Retry** — retry is part of the design, so one failure does not mean the setup is broken.
4. If the status light is red, open **API Settings & Connection** and read the message: it distinguishes a bad key, a missing model, an unreachable server, and a rate limit.

### Themes

The app has three skins: the Web 2.0 dashboard, the Messenger window, and the Windows 98/XP assistant. Switching themes keeps API settings, the selected model, conversations, the active conversation, and unsent composer text. If something in that list disappears after a switch, that is a bug.

### Models

Each backend has its own model list. The connection check loads the real list from the backend and falls back to documented IDs when the backend does not report one. Bridge-only IDs (`gemini-auto`, thinking variants) do not exist on the Gemini API, and vice versa, so a model can work in one mode and fail in the other.

---

## 4. Maintenance

- **Back up `config.json`** if you use one, and keep it out of public repos. `.env` is git-ignored; keep it that way.
- **Rotate keys** by editing `.env` (API mode) or the bridge config, then restart. Vite reads `.env` at startup, so a running dev server needs a restart.
- **Keep both sides in sync** if you change the bridge port or host: update `BRIDGE_URL` in `.env` and the base URL in API Settings.
- **Local data is disposable.** Conversations and settings live in browser `localStorage`; clearing site data erases them. Do not treat them as a backup.
- **Upgrade safely:** `npm install` after pulling, and `pip install -r gemini-web2api/requirements.txt` for the bridge.
- **Health check:** open API Settings — `Connected` plus a model count means both the network path and the key are fine. Check `gemini-web2api/bridge.log` when the bridge starts but does not answer.
- **Before shipping a build:** run `npm run typecheck`, `npm test`, and `npm run build`. There is no lint script.

---

## 5. Things NOT to do

- **Do not `chmod -R 777`** the project, the bridge folder, or your config. Fix the specific path and owner instead.
- **Do not make `config.json` or `.env` world-readable/writable** because a test failed. They hold keys and settings.
- **Do not commit `.env`, `config.json`, API keys, cookies, or token files.** Commit `.env.example` instead.
- **Do not paste a real key into the frontend source, a public asset, a chat message, or a commit.** In API mode the key belongs in `.env` and is attached by the proxy.
- **Do not switch AI Studio to a public/direct URL that embeds `?key=` and then share the link.** It leaks the key.
- **Do not expose the bridge to the internet** without intentionally designing for it. It is an unauthenticated local service by default.
- **Do not "fix" permissions on the Gemini credential/cookie files** by loosening the whole tree. Fix the path or the owning user.
- **Do not edit `gemini_web2api.py` when configuration would do.** If code really must change, change it deliberately and test a real request.
- **Do not disable CORS, auth, or safety prompts to make one local test pass.** Scope any relaxation narrowly and revert it.
- **Do not delete `package-lock.json` or reinstall "just in case".** Install what the project declares.
- **Do not treat one failed request as a broken install.** Retry first; then read the error, which names the actual problem.
- **Do not build with a proxy key and then serve the bundle from an untrusted host** expecting the key to be injected; the proxy exists only in Vite's dev and preview servers.

If you are about to do one of these, stop and ask what you were trying to fix. There is almost always a narrower, safer fix.

---

## Appendix: Gemini API details

This is the reference behind API mode. Source docs:

- [Gemini API docs index](https://ai.google.dev/gemini-api/docs/llms.txt)
- [AI Studio docs index](https://aistudio.google.com/docs/llms.txt)

### Authentication and keys

- Create/manage keys in [Google AI Studio](https://aistudio.google.com/apikey); they are tied to a Google Cloud project, and quotas apply per project.
- REST host: `https://generativelanguage.googleapis.com`, documented version `v1beta`.
- Direct REST calls send `x-goog-api-key: YOUR_API_KEY` and `Content-Type: application/json`.
- The Interactions API also sends `Api-Revision: 2026-05-20` in the current docs; check the docs before hard-coding a revision.
- The SDK reads `GEMINI_API_KEY` or `GOOGLE_API_KEY`; `GOOGLE_API_KEY` wins if both are set.

### Two REST shapes

1. **Interactions API (recommended for new projects)**
   - `POST https://generativelanguage.googleapis.com/v1beta/interactions`
   - Required: `model` and `input`.
   - Optional: `system_instruction`, `generation_config`, `previous_interaction_id`, `store`.
   - `store:false` opts out of storage but cannot be combined with stored-conversation continuation.

2. **`generateContent` (what this app uses)**
   - `POST .../v1beta/models/{MODEL}:generateContent`
   - Body: `{"contents":[{"role":"user","parts":[{"text":"…"}]}]}`
   - History is included in the request; roles are `user` and `model`.
   - The app merges consecutive same-role turns, because a failed answer can otherwise leave two user turns in a row, which the API rejects.

### Models

IDs are strings. The docs currently list `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, and `gemini-4-argon`, among others. Access changes, so check the live list in API Settings or the [models page](https://aistudio.google.com/docs/models.md).

### Quotas and limits

- Measured in requests per minute, input tokens per minute, and requests per day, per project.
- RPD resets at midnight Pacific time; published limits are not guaranteed.
- `429 RESOURCE_EXHAUSTED` means slow down, shorten context, or retry after a pause.
- By default Interactions requests are stored (1 day free tier, 55 days paid, per current docs).

### Quick reference pages

- [API keys](https://aistudio.google.com/docs/api-key.md)
- [Get started](https://aistudio.google.com/docs/get-started.md)
- [Interactions overview](https://aistudio.google.com/docs/interactions-overview.md)
- [Legacy generateContent quickstart](https://ai.google.dev/gemini-api/docs/generate-content/get-started.md.txt)
- [Rate limits](https://aistudio.google.com/docs/rate-limits.md)
