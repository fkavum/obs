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

Early setup. Structure and design docs only — no code yet.

## Requirements

- [OBS Studio](https://obsproject.com/) 30+ with obs-websocket v5 enabled (Tools ▸ WebSocket Server Settings)
- Node.js 20+ (v26 in use)
