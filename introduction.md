# Introduction — OBS Streaming Toolkit

> **Read this first.** This file is the permanent context for the project. It exists so that
> any new session (human or AI assistant) can start working without the owner re-explaining
> everything. Keep it up to date when a major decision changes.

---

## 1. Who this is for

The owner is a **live streamer broadcasting simultaneously to Twitch, YouTube Live and Kick**.
Everything built here is built first for that real, daily use case — not as a demo.

The operator of these tools is assumed to be **non-technical**: someone who can install an
app, click buttons in a browser, and copy a URL into OBS. Nothing more.

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
   Here, every overlay is fully restylable — through a settings screen, not through code.

**Definition of done for this project:** the owner can go live on all three platforms and run
the entire stream — chat, alerts, scene switching, timers, stream health — from tools in this
repository, with no third-party subscription in the loop.

## 3. The two hard constraints

These two outrank every other consideration. **A feature that violates either one gets
postponed, not shipped.**

### A. Near-zero maintenance cost

Once it's set up, it keeps working without anyone touching it. Concretely:

- **No manual token juggling.** OAuth tokens refresh themselves in the background. The
  operator logs in once per platform, ever.
- **No file editing.** Not JSON, not YAML, not `.env`. All configuration happens in a
  browser settings screen.
- **No dependency treadmill.** Minimal dependencies, pinned. A library that needs frequent
  updating to keep working is a reason to not use that library.
- **No fragile scraping.** Only official, documented APIs. If a platform only offers an
  unofficial surface for something, that feature waits.
- **Fails quietly and recovers itself.** Reconnects, retries, backs off. The operator should
  never be the retry mechanism.

### B. Usable by someone with zero technical knowledge

- Start it: one double-click or one command. Not a build step.
- Set it up: a browser wizard — "Connect Twitch" → log in → done.
- Configure it: visual controls with a **live preview**, then a **Copy URL** button to paste
  into OBS. Never "open this file and change line 14".
- **Every feature ships a `GUIDE.md`** written for someone who has never edited a file.
  See `docs/guides/`.

If a feature can't meet both, it goes to the Postponed list in `docs/roadmap.md` with the
reason written down — so the decision doesn't get re-litigated later.

## 4. Distribution

**Decided 2026-09-13: build for the owner's machine now, keep it shareable later.**

The toolkit is for the owner's own streams today. But the setup wizard and the guides are
built to a standard where handing it to another streamer is only a packaging job — not a
rewrite. So:

- **Assume one user, but never assume it's a developer.** No step may require reading code.
- **The owner registers their own platform apps**, once, through the wizard. There is no
  shared/hosted OAuth application to maintain.
- **Not building yet:** signed installers, auto-update, multi-user support, a support
  channel. These are the packaging work deferred until distribution actually happens.
- **Don't take a shortcut that would have to be undone to share it** — e.g. hardcoding the
  owner's channel name, or a path under `/Users/fkavum/`.

## 5. Design principles

| Principle | Meaning in practice |
|---|---|
| **Local-first** | Everything runs on the streaming PC. No account, no cloud, no telemetry. |
| **Modular platforms** | Each platform is a self-contained, drop-in adapter folder. Adding a platform = adding a folder. Removing one = deleting it or flicking a toggle. No platform name is hardcoded anywhere in the core. |
| **One event, one shape** | Every platform event is normalized into a single event schema (see `docs/architecture.md`). A Twitch sub, a YouTube membership and a Kick sub all arrive as the same `subscription` event with a `platform` field. |
| **Settings live in the URL** | An overlay's entire appearance is encoded in its Browser Source URL. Nothing to back up, nothing to lose, and the same overlay can be added twice with two different looks. |
| **Browser sources over native plugins** | An overlay that is a plain web page works in OBS on every OS with zero compilation and can be hot-reloaded while live. Native C++ plugins are only for what a browser source genuinely cannot do. |
| **Never break the live stream** | Any component may crash; nothing may take OBS down with it. Reconnect loops, timeouts and safe defaults everywhere. |

## 6. Architecture in one paragraph

A **bridge** service (Node.js) loads one **adapter** per platform, normalizes everything into
a common event stream, and republishes it on a local WebSocket. **Overlays** are static web
pages added to OBS as Browser Sources; they subscribe to that WebSocket and render themselves
according to settings passed in their URL. A **settings screen** in the browser builds those
URLs visually. The bridge also speaks **obs-websocket v5** back to OBS.

```
adapters/twitch  ─┐
adapters/youtube ─┼─▶ bridge (normalize) ──▶ local WebSocket ──▶ overlays (OBS Browser Source)
adapters/kick    ─┘         │                                        ▲
  (drop-in folders)         │                                        │ settings encoded in URL
                            │                                   settings screen (live preview)
                            └──── obs-websocket v5 ────▶ OBS (scenes, sources, recording)
```

Full detail: `docs/architecture.md`.

## 7. Repository layout

```
introduction.md        This file — project context, read first.
README.md              Short public-facing overview.
CLAUDE.md              Session primer for AI assistants; points here.
docs/
  architecture.md      Adapter contract, event schema, settings system.
  roadmap.md           Tools, priority order, status, and the Postponed list with reasons.
  overlay-chat.md      Full config spec for the unified chat overlay (vertical + horizontal).
  guides/              End-user guides. _template.md defines the required shape.
packages/
  core/                Shared types, normalized event schema, utilities.
  bridge/              Node service.
    src/adapters/      One folder per platform. Drop in / delete out.
  overlays/            Browser-source overlays (one folder per overlay).
    chat/              Unified chat overlay.
plugins/               Native OBS C++ plugins (only if truly needed; requires CMake).
scripts/               OBS Lua/Python scripts (Tools ▸ Scripts inside OBS).
config/                Local configuration and credentials. Git-ignored except examples.
assets/                Fonts, images, sounds used by overlays.
```

## 8. Environment (as of 2026-09-13)

- macOS (darwin), zsh
- Node.js v26, npm 11
- Python 3.9 (system)
- **No CMake installed** — native plugin work needs `brew install cmake` first.
- **OBS not installed at `/Applications/OBS.app`** — install OBS Studio before testing
  overlays or obs-websocket integration.

## 9. Ground rules for future sessions

- **Check both hard constraints (§3) before proposing a feature.** If it fails one, propose
  it as postponed with the reason, rather than building it.
- **Never commit secrets.** Tokens and client secrets live in git-ignored local files. Only
  `*.example.*` files are committed.
- **No feature ships without its `GUIDE.md`**, written for a non-technical reader.
- **No new configuration mechanism.** Overlay settings go in the URL; service settings go in
  the settings screen. Don't invent a third place.
- **Don't hardcode a platform name in core, bridge or overlay code.** Read it from the
  adapter manifests. This is what keeps platforms removable.
- **Prefer a new overlay over a new framework.** Vanilla HTML/CSS/JS is the default; a build
  step must justify itself.
- **Test targets:** an overlay must be readable at 1920×1080 over live video, and must degrade
  silently (render nothing) when the bridge is offline — never an error box on stream.
- Check `docs/roadmap.md` for status before proposing work.
