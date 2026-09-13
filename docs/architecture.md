# Architecture

## Components

### `packages/bridge` — the bridge service (Node.js)

A single long-running local process. Responsibilities:

1. **Connect** to Twitch, YouTube and Kick using per-platform adapters.
2. **Normalize** every incoming message/event into the common schema below.
3. **Broadcast** normalized events over a local WebSocket server (default `ws://127.0.0.1:8777`).
4. **Control OBS** via obs-websocket v5 (default `ws://127.0.0.1:4455`) — scene switches,
   source toggles, recording, replay buffer.
5. **Persist** a small rolling event log so overlays that connect late can catch up.

The bridge is the only component that holds credentials. Overlays never see a token.

### `packages/overlays` — browser sources

Each overlay is a self-contained folder with an `index.html`. Added in OBS as a
**Browser Source** pointing at the local file or at the bridge's static server.
An overlay:
- connects to the bridge WebSocket, with automatic reconnect;
- renders **nothing** when disconnected (never an error box on stream);
- takes its settings from URL query params so the same overlay can be used twice with
  different looks (e.g. `?theme=dark&maxMessages=20`).

### `packages/core` — shared code

Event schema definitions, platform enums, formatting helpers. Imported by bridge and
(where a build step exists) by overlays.

### `plugins/` — native OBS plugins (C++)

Only for capabilities a browser source cannot reach: custom video filters, capture sources,
audio processing. Requires CMake and the OBS plugin template. Not needed for anything on the
current roadmap — keep it empty until it isn't.

### `scripts/` — OBS Lua/Python scripts

Loaded inside OBS via **Tools ▸ Scripts**. Good for small in-OBS automations that don't
justify a separate process.

---

## Normalized event schema

Every event the bridge emits has this envelope:

```jsonc
{
  "id": "uuid-v4",                 // unique per event
  "type": "chat",                  // see event types below
  "platform": "twitch",            // "twitch" | "youtube" | "kick"
  "ts": 1757750400000,             // epoch ms, when the bridge received it
  "channel": "channel-name",
  "user": {
    "id": "platform-user-id",
    "name": "login_name",
    "displayName": "Display Name",
    "avatar": "https://...",       // may be null
    "roles": ["moderator", "subscriber"],  // normalized role list
    "color": "#ff7f50"             // may be null
  },
  "data": { /* type-specific, see below */ }
}
```

### Event types

| `type` | `data` payload | Notes |
|---|---|---|
| `chat` | `{ text, emotes[], fragments[], replyTo? }` | `fragments` lets overlays render emotes inline without re-parsing. |
| `chat.delete` | `{ messageId }` | Message removed by a mod. |
| `chat.clear` | `{ userId? }` | Whole chat or one user purged. |
| `follow` | `{}` | YouTube = new subscriber (free); Kick = follow. |
| `subscription` | `{ tier, months, isGift, giftCount? }` | Twitch sub / YouTube membership / Kick sub. |
| `donation` | `{ amount, currency, message }` | Bits, Super Chat, Kick tips, external tip jars. |
| `raid` | `{ viewers, fromChannel }` | Twitch raid / Kick host. |
| `viewers` | `{ count }` | Emitted periodically per platform. |
| `stream.state` | `{ live: bool, title, category }` | Per-platform live state. |
| `system` | `{ level, message }` | Bridge-internal; for the control panel, never for overlays. |

Rule: **adding a platform must never change this schema.** If a platform has something
unique, it goes in `data.raw` — overlays that care can read it, everyone else ignores it.

---

## Platform notes

> Verify current API details before implementing — platform APIs move. These are starting points.

**Twitch**
- Chat: IRC (`irc-ws.chat.twitch.tv`) or EventSub `channel.chat.message`.
- Events: EventSub over WebSocket — follows, subs, cheers, raids.
- Auth: OAuth; needs a registered application and per-scope user tokens.

**YouTube Live**
- Chat: Data API v3 `liveChatMessages.list` — **polling**, and quota-limited. Quota is the
  main design constraint; poll interval must respect the API's own `pollingIntervalMillis`.
- Super Chat arrives through the same chat feed.
- Auth: Google OAuth 2.0.

**Kick**
- Has an official developer API/OAuth and webhooks; also a Pusher-based realtime chat channel.
- Verify which surface is current and stable before choosing. Kick's API has historically
  moved faster than the others; isolate all of it behind the adapter so churn can't leak out.

---

## Ports (defaults, overridable in `config/`)

| Port | Use |
|---|---|
| 8777 | Bridge WebSocket — overlays subscribe here |
| 8778 | Bridge HTTP — serves overlays and the control panel |
| 4455 | obs-websocket v5 (OBS's own server; enable in OBS ▸ Tools) |

## Failure policy

- Every platform adapter reconnects with exponential backoff and never throws into the
  main loop. One dead platform must not stop the other two.
- If OBS is closed, the bridge keeps running and keeps serving overlays.
- If the bridge dies, overlays keep their last rendered frame and retry silently.
