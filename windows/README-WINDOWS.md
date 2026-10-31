# Retro projects for Windows

This folder is a Windows-ready copy of the projects in the parent directory.
It intentionally does **not** include `node_modules`, build folders, Git
metadata, browser cookies, API keys, or local service configuration. Install
dependencies on the Windows machine so native packages match Windows.

This is the Windows mirror of the full retro suit. The main point of the repo is
the whole setup, not any single subproject. Start with
[RETRO_SETUP.md](../RETRO_SETUP.md) for the full walkthrough, then come back here
for Windows-specific launch commands and converted scripts.

## Prerequisites

- Windows 10/11
- [Node.js 20+](https://nodejs.org/) (includes npm)
- [Python 3.8+](https://www.python.org/downloads/) with the **Add Python to
  PATH** option, for Retro PKP and the optional Gemini bridge
- `ffmpeg` and ImageMagick in `PATH` for full yt2009 media support

## First run

Double-click `setup.cmd`, or open Command Prompt in this folder and run:

```cmd
setup.cmd
```

The script installs dependencies only. It never copies credentials or runtime
data from another computer.

## Start a project

| Project | Command / file | Result |
| --- | --- | --- |
| Gemini Retro | `ai_apps\start.cmd -Use bridge` | Starts the app and its local Gemini bridge. |
| Gemini Retro (API) | `ai_apps\start.cmd -Use api` | Requires `ai_apps\.env` with `GEMINI_API_KEY=...`. |
| Retro PKP | `start-retro-pkp.cmd` | Runs the Worker and local site; open http://127.0.0.1:8000. |
| Spotamp | `build-spotamp.cmd` | Builds `spotamp\dist`; load it unpacked in Chrome/Edge. |
| yt2009 | `start-yt2009.cmd` | Starts the yt2009 server (finish its upstream setup first if required). |

Run commands from Command Prompt or PowerShell. Keep the window open while a
server is running; press Ctrl+C to stop it. See each project's `START.md` for
use and troubleshooting.

## What was converted

- `ai_apps/start.ps1` replaces the Bash-only launcher and is exposed through
  `ai_apps/start.cmd` for double-click/Command Prompt use.
- Project scripts use `npm.cmd`, `npx.cmd`, `py -3`, and Windows path-safe
  launchers.
- The application source, package manifests, lockfiles, and static assets are
  retained unchanged unless a displayed command needed its Windows equivalent.

## Reddit redirect

Old Reddit already exists, so this repo does not reinvent it. For a quick
redirect to `old.reddit.com`, use the Tampermonkey script at
[`../windows/redirect-old-reddit.js`](../windows/redirect-old-reddit.js).

## Where to read first

The top-level tutorial is [RETRO_SETUP.md](../RETRO_SETUP.md). It covers the
ISO, the Node install, extracting the zip, the first `setup.cmd` run, all of the
projects, credits, and the Reddit Tampermonkey redirect.

This file is the Windows-specific mirror: prerequisites, the launch table, and
the notes on what was converted for Windows.

Do not copy `.env`, `config.json`, `cookie.txt`, or `back/config.json` from an
untrusted machine. They can contain API keys, browser cookies, or access tokens.
