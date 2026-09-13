# Architecture

Two rules shape everything here: **near-zero maintenance** and **usable by a non-technical
operator** (see `introduction.md` §3). Where a design choice below looks over-engineered,
it's usually buying one of those two.

## Components

### `packages/bridge` — the bridge service (Node.js)

A single long-running local process. Responsibilities:

1. **Discover and load adapters** from `src/adapters/*/` (see the adapter contract below).
2. **Normalize** every incoming message/event into the common schema.
3. **Broadcast** normalized events over a local WebSocket (default `ws://127.0.0.1:8777`).
4. **Serve** overlays, the settings screen and the setup wizard over local HTTP (`:8778`).
5. **Control OBS** via obs-websocket v5 (`ws://127.0.0.1:4455`).
6. **Hold and refresh all credentials.** Overlays never see a token. Token refresh is
   automatic and silent — the operator logs in once per platform, ever.

The bridge core contains **zero platform-specific code**. It knows about adapters, not about
Twitch.

### `packages/overlays` — browser sources

Each overlay is a self-contained folder with an `index.html`. Added in OBS as a
**Browser Source**. Every overlay:
- reads its entire appearance from **URL query parameters** — no config file, no server state;
- connects to the bridge WebSocket with automatic reconnect;
- renders **nothing** when disconnected (never an error box on stream);
- supports `preview=on`, which generates fake messages so the operator can style it in OBS
  without being live.

### `packages/core` — shared code

Event schema, helpers, the settings-parsing utility shared by overlays. No platform code.

### `plugins/` — native OBS plugins (C++)

Empty on purpose. A native plugin needs compiling, per-OS builds and rebuilding on every OBS
major version — that is the opposite of zero-maintenance. Only build one when a browser
source genuinely cannot do the job.

### `scripts/` — OBS Lua/Python scripts

Small in-OBS automations, loaded via **Tools ▸ Scripts**.

---

## The adapter contract (this is what makes platforms modular)

A platform is a folder in `packages/bridge/src/adapters/`. The bridge scans that directory at
boot. **Drop a folder in → the platform exists. Delete it → it's gone.** Nothing else in the
codebase references a platform by name.

```
src/adapters/
  twitch/
    manifest.json      identity, capabilities, branding
    index.js           createAdapter()
    normalize.js       platform payload -> common event schema
    icon.svg           shipped with the adapter, served to overlays
  youtube/
  kick/
  fake/                scripted replay adapter for development
```

### `manifest.json`

```jsonc
{
  "id": "twitch",
  "label": "Twitch",
  "color": "#9146FF",          // overlays use this for platform tinting
  "icon": "icon.svg",
  "auth": "oauth2",
  "capabilities": ["chat", "follow", "subscription", "donation", "raid", "viewers"]
}
```

Because branding and capabilities travel *with* the adapter, adding a platform automatically
gives every overlay its icon and color, and automatically adds it to the settings screen's
platform toggles. No overlay needs editing to support a new platform.

### `index.js`

```js
export function createAdapter({ config, emit, log }) {
  return {
    async start() {},          // connect; call emit(event) for each normalized event
    async stop() {},           // clean disconnect
    health() {                 // polled by the bridge for the status screen
      return { connected: true, detail: 'chat + events' };
    },
  };
}
```

Requirements on every adapter:
- **Never throw into the bridge.** Catch everything; report via `health()`.
- **Reconnect on its own** with exponential backoff. One dead platform must not affect the
  other two, or the bridge.
- **Emit only normalized events.** Platform-shaped data stays inside the adapter.
- Put anything platform-unique in `data.raw` rather than changing the schema.

### Serving platform info

`GET /api/platforms` returns the manifests of all loaded + enabled adapters. Overlays and the
settings screen build themselves from this response — that is why no platform list is
hardcoded anywhere.

---

## Normalized event schema

Every event the bridge emits has this envelope:

```jsonc
{
  "id": "uuid-v4",
  "type": "chat",
  "platform": "twitch",
  "ts": 1757750400000,
  "channel": "channel-name",
  "user": {
    "id": "platform-user-id",
    "name": "login_name",
    "displayName": "Display Name",
    "avatar": "https://...",              // may be null
    "roles": ["moderator", "subscriber"], // normalized role list
    "color": "#ff7f50"                    // may be null
  },
  "data": { /* type-specific */ }
}
```

| `type` | `data` payload | Notes |
|---|---|---|
| `chat` | `{ text, fragments[], replyTo? }` | `fragments` = pre-split text/emote parts so overlays never re-parse. |
| `chat.delete` | `{ messageId }` | Message removed by a mod. |
| `chat.clear` | `{ userId? }` | Whole chat or one user purged. |
| `follow` | `{}` | YouTube = free subscribe; Kick = follow. |
| `subscription` | `{ tier, months, isGift, giftCount? }` | Twitch sub / YouTube membership / Kick sub. |
| `donation` | `{ amount, currency, message }` | Bits, Super Chat, Kick tips. |
| `raid` | `{ viewers, fromChannel }` | Twitch raid / Kick host. |
| `viewers` | `{ count }` | Emitted periodically per platform. |
| `stream.state` | `{ live, title, category }` | Per-platform live state. |
| `system` | `{ level, message }` | Bridge-internal; status screen only, never overlays. |

**Rule: adding a platform must never change this schema.**

---

## Settings system

There are exactly two places settings live. Don't invent a third.

**1. Overlay appearance → the Browser Source URL.**
`http://127.0.0.1:8778/overlays/chat/?layout=vertical&border=accent-left&bgOpacity=45`

Why: nothing to back up or corrupt, survives a reinstall, and the same overlay can be added
twice with two different looks. The operator never sees the parameters — the settings screen
writes them and hands over a **Copy URL** button.

**2. Service settings (accounts, ports, OBS connection) → the setup wizard**, stored in
`config/config.local.json`. The operator never opens that file; the wizard writes it.

### Chat needs no login at all (Twitch and Kick)

Verified empirically, not assumed: Twitch accepts an anonymous IRC connection — a
`justinfan<random>` nick with no `PASS` — and still ACKs `twitch.tv/tags`, so display names,
colours, badges, emote positions and user ids all arrive. Kick's realtime chat socket is
likewise public; the adapter only needs the chatroom id, which comes from a public endpoint.

So the default path is: type a channel name, chat works. **Signing in is optional and only
unlocks what genuinely requires permission** — follows, subs, cheers, raids and viewer counts
on Twitch, viewer counts on Kick. An adapter declares this with `anonymousChat` in its
manifest, and the wizard builds itself from that.

YouTube is the exception: Google rejects unauthenticated callers outright
("Method doesn't allow unregistered callers"), so it needs credentials even to read chat.

### Login (two modes, both supported everywhere)

The shared auth layer handles both, and an adapter declares which it wants with
`oauth.mode`. Every platform also keeps the manual "register your own application" path, so
the built-in option is a convenience rather than a lock-in.

**`device`** — the operator presses Connect, gets a short code, and types it on the
platform's activation page. This is a *public client*: client id only, **no secret**, and
**no redirect URL**. That matters for a local-first tool for three reasons: there is no
server to hold a secret on; a secret shipped inside a distributed app is not a secret; and
with no redirect URL, changing the HTTP port cannot break logins. The bridge polls the
platform in the background and the browser just reads status, so a closed tab doesn't
abandon a login in progress. **Twitch** uses this.

**`redirect`** — the classic authorization-code flow with a client secret and a registered
redirect URL. **Kick** requires it: its token endpoint mandates `client_secret` and it has no
public-client option. **YouTube** uses it deliberately even though Google could support
otherwise, because **Google's quota is charged per application, not per user** — one shipped
client id would mean every operator sharing a single 10,000 unit day. A per-operator app is
a per-operator allowance.

A platform ships a ready-to-use public client id in its manifest as `defaultClientId`. A
client id is public by design — it travels in plain OAuth requests — so committing one is
safe in a way that committing a secret never is. An operator's own saved id always wins over
the shipped default.

### Settings screen

Served at `http://127.0.0.1:8778/settings`. For each overlay: visual controls on the left
(sliders, color pickers, dropdowns), the **real overlay live-previewing** on the right over a
sample video-ish background, and a Copy URL button. Presets ship as one-click themes.

---

## Platform notes

> Verify current API details before implementing — platform APIs move.

**Twitch** — best-documented, lowest maintenance. Chat via IRC or EventSub
`channel.chat.message`; events via EventSub over WebSocket. OAuth with refresh tokens.

**Kick** — official developer API/OAuth and webhooks exist, plus a Pusher-based realtime
chat channel. Historically the fastest-moving of the three; keep 100% of it behind the
adapter so churn can't leak out.

**YouTube** — the highest-maintenance platform of the three, and the risk to be designed
around. Live chat comes from Data API v3 `liveChatMessages.list`, which is **polled** and
**quota-limited**, and the chat ID changes with every broadcast. Naive polling can exhaust a
day's quota in a few hours of streaming. Mitigations, all inside the adapter: honour the
API's own `pollingIntervalMillis`, back off when chat is quiet, and surface remaining quota on
the status screen rather than dying silently mid-stream. Do not let this complexity reach the
core.

---

## Ports (defaults, changeable in the wizard)

| Port | Use |
|---|---|
| 8777 | Bridge WebSocket — overlays subscribe here |
| 8778 | Bridge HTTP — overlays, settings screen, setup wizard |
| 4455 | obs-websocket v5 (OBS's own server; enable in OBS ▸ Tools) |

## Failure policy

- Adapters reconnect with exponential backoff and never throw into the main loop.
- If OBS is closed, the bridge keeps running and keeps serving overlays.
- If the bridge dies, overlays keep their last rendered frame and retry silently.
- If a token can't be refreshed, the status screen says which platform needs a re-login —
  in words, not an error code. Everything else keeps running.
