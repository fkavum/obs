# OBS Streaming Toolkit

Custom OBS tools, overlays and plugins for **multi-platform live streaming** —
Twitch, YouTube Live and Kick, treated as equals.

Local-first: no cloud, no accounts, no subscriptions. Everything runs on the streaming PC.

- **What and why:** [`introduction.md`](introduction.md) ← start here
- **How it fits together:** [`docs/architecture.md`](docs/architecture.md)
- **What's planned and what's done:** [`docs/roadmap.md`](docs/roadmap.md)

## Status

Early setup. Structure and design docs only — no code yet.

## Requirements

- [OBS Studio](https://obsproject.com/) 30+ with obs-websocket v5 enabled (Tools ▸ WebSocket Server Settings)
- Node.js 20+ (v26 in use)
- CMake — only if native plugins are built later
