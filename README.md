# OBS Streaming Toolkit

Custom OBS tools and overlays for **multi-platform live streaming** — Twitch, YouTube Live
and Kick, treated as equals.

Local-first: no cloud, no accounts, no subscriptions. Built to two hard rules — it needs
**almost no maintenance** once running, and it's **usable by someone with no technical
knowledge**: one-click start, a browser setup wizard, and visual settings with live preview.

- **What and why:** [`introduction.md`](introduction.md) ← start here
- **How it fits together:** [`docs/architecture.md`](docs/architecture.md)
- **Chat overlay options:** [`docs/overlay-chat.md`](docs/overlay-chat.md)
- **What's planned, done, and deliberately postponed:** [`docs/roadmap.md`](docs/roadmap.md)
- **End-user guides:** [`docs/guides/`](docs/guides/)

## Status

Working. Bridge, setup wizard, settings screen, vertical chat overlay, and Twitch / Kick /
YouTube adapters are built; see [`docs/roadmap.md`](docs/roadmap.md) for what's next and what
is deliberately postponed.

The three real platform adapters have not yet been run against a live channel.

## Running it

Double-click **`start.command`**, or:

```bash
npm start          # normal run
npm run demo       # force the fake-chat platform on
npm test           # unit tests
```

No `npm install` — the toolkit has zero dependencies.

Then open **http://localhost:8778** and type your channel names. Twitch and Kick chat work
with no account at all; signing in is optional and only adds alerts and viewer counts.

## Requirements

- [OBS Studio](https://obsproject.com/) 30+ (obs-websocket v5 is only needed for later features)
- Node.js 20+ (v26 in use)
