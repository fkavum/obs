# Introduction — OBS Streaming Toolkit

> **Read this first.** This file is the permanent context for the project. It exists so that
> any new session (human or AI assistant) can start working without the owner re-explaining
> everything. Keep it up to date when a major decision changes.

---

## 1. Who this is for

The owner is a **live streamer broadcasting simultaneously to Twitch, YouTube Live and Kick**.
Everything built here is built first for that real, daily use case — not as a demo.

## 2. Purpose of this project

Build a set of **custom OBS tools, plugins and overlays** that solve the problems every
multi-platform streamer has, and that off-the-shelf products solve only partially:

1. **Platform fragmentation.** Chat, followers, subs, donations and viewer counts live in
   three different places with three different APIs. Nothing on the market treats all three
   as equal first-class citizens — Kick especially is an afterthought everywhere.
2. **Vendor lock-in and cost.** Alert/overlay SaaS products are subscription-based, cloud-
   dependent, and go down when their servers go down. This toolkit runs **locally**, offline-
   capable, owned by the streamer.
3. **No customization.** Existing widgets can't be shaped to a specific brand or workflow.
   Here, every overlay is plain HTML/CSS/JS the owner fully controls.

**Definition of done for this project:** the owner can go live on all three platforms and run
the entire stream — chat, alerts, scene switching, timers, stream health — from tools in this
repository, with no third-party subscription in the loop.

## 3. Design principles

| Principle | Meaning in practice |
|---|---|
| **Local-first** | Everything runs on the streaming PC. No account, no cloud, no telemetry. |
| **Platform-agnostic core** | Platform differences are absorbed by adapters. Overlays never know which platform an event came from unless they choose to care. |
| **One event, one shape** | Every platform event is normalized into a single event schema (see `docs/architecture.md`). A Twitch sub, a YouTube membership and a Kick sub all arrive as the same `subscription` event with a `platform` field. |
| **Browser sources over native plugins** | An overlay that is a plain web page works in OBS on every OS with zero compilation and can be hot-reloaded while live. Native C++ plugins are only for what a browser source genuinely cannot do. |
| **Never break the live stream** | Any component may crash; nothing may take OBS down with it. Reconnect loops, timeouts and safe defaults everywhere. |
| **Config over code** | Credentials, channel names and toggles live in `config/`, never hardcoded. |

## 4. Architecture in one paragraph

A **bridge** service (Node.js) connects to Twitch, YouTube and Kick, normalizes everything
into a common event stream, and republishes it on a local WebSocket. **Overlays** are static
web pages added to OBS as Browser Sources; they subscribe to that WebSocket and render.
The bridge also speaks **obs-websocket v5** back to OBS, so it can switch scenes, toggle
sources and react to what happens in chat. Native plugins and OBS Lua/Python scripts are
optional add-ons for deeper integration.

```
Twitch ─┐
YouTube ─┼─▶ bridge (normalize) ──▶ local WebSocket ──▶ overlays (Browser Source in OBS)
Kick   ─┘         │
                  └──────── obs-websocket v5 ────────▶ OBS (scenes, sources, recording)
```

Full detail: `docs/architecture.md`.

## 5. Repository layout

```
introduction.md        This file — project context, read first.
README.md              Short public-facing overview.
CLAUDE.md              Session primer for AI assistants; points here.
docs/
  architecture.md      Event schema, bridge design, platform notes.
  roadmap.md           Proposed tools, priority order, current status.
packages/
  core/                Shared types, normalized event schema, utilities.
  bridge/              Node service: platform connectors + WebSocket server + OBS control.
  overlays/            Browser-source overlays (one folder per overlay).
plugins/               Native OBS C++ plugins (only if truly needed; requires CMake).
scripts/               OBS Lua/Python scripts (Tools ▸ Scripts inside OBS).
config/                Local configuration and credentials. Git-ignored except examples.
assets/                Fonts, images, sounds used by overlays.
```

## 6. Environment (as of 2026-09-13)

- macOS (darwin), zsh
- Node.js v26, npm 11
- Python 3.9 (system)
- **No CMake installed** — native plugin work needs `brew install cmake` first.
- **OBS not installed at `/Applications/OBS.app`** — install OBS Studio before testing
  overlays or obs-websocket integration.

## 7. Ground rules for future sessions

- **Never commit secrets.** OAuth tokens, client secrets and stream keys go in
  `config/*.local.json` or `.env`, both git-ignored. Only `*.example.*` files are committed.
- **Don't add a cloud dependency** without the owner explicitly asking for one.
- **Prefer a new overlay over a new framework.** Vanilla HTML/CSS/JS is the default for
  overlays; a build step must justify itself.
- **Test targets matter:** an overlay must be readable at 1920×1080 over live video, and must
  degrade silently (render nothing) when the bridge is offline — never show an error box on
  stream.
- Check `docs/roadmap.md` for what is done and what is next before proposing work.
