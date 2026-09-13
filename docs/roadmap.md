# Roadmap

Status legend: ⬜ not started · 🟨 in progress · ✅ done

Nothing is built yet. This file is the proposal + tracker.

---

## Tier 1 — the foundation (build first, everything depends on it)

### ⬜ 1. Multi-platform bridge
The core service. Twitch + YouTube + Kick adapters → normalized events → local WebSocket.
Without this, every tool below has to solve auth and connection logic on its own.
**Build a fake/replay adapter alongside it** so overlays can be developed and tested
without going live.

---

## Tier 2 — must-have streamer tools

### ⬜ 2. Unified chat overlay + moderation panel
One merged chat from all three platforms, each message badged with its platform.
On-stream overlay version (read-only, styled) and an off-stream panel version on a second
monitor with timeout/ban/delete buttons that fan out to the right platform.
*Why it matters:* reading three chat windows while playing is the single biggest tax of
multi-streaming, and merged chat is the thing streamers ask for most.

### ⬜ 3. Alerts (follow / sub / donation / raid)
Animated on-stream alerts driven by normalized events, with a queue so simultaneous events
don't overlap, per-event-type templates, sound, and a test-fire button.
*Why it matters:* replaces the main paid SaaS widget, and unlike them it fires for Kick and
YouTube with the same look as Twitch.

### ⬜ 4. Live stats bar
Combined and per-platform viewer count, follower/sub counts, uptime, and a session goal bar.
*Why it matters:* when multi-streaming, "how many people am I actually talking to" is a
number no single platform can tell you.

### ⬜ 5. Chat-driven scene automation
Rules engine: event → OBS action. `!brb` from a mod switches to the BRB scene; a raid
triggers the raid scene; going live on all platforms sets the starting-soon countdown.
Built on obs-websocket v5. Rules live in a config file, not in code.
*Why it matters:* this is the part no SaaS product can do, because it needs local OBS control.

### ⬜ 6. Stream health monitor
Watches dropped frames, encoder lag, bitrate and CPU via obs-websocket; warns on a private
overlay (visible to the streamer only, not on the broadcast) and can auto-drop bitrate or
switch to a fallback scene before the stream visibly breaks.
*Why it matters:* catching a degrading stream in the first 10 seconds instead of from a
chat message three minutes later.

---

## Tier 3 — high value, build once Tier 2 is stable

- ⬜ **Chat commands & timers** — `!discord`, `!socials`, rotating auto-messages, all three platforms at once.
- ⬜ **Polls & predictions overlay** — chat-voted polls that work cross-platform (Twitch's native polls exclude the other two audiences).
- ⬜ **Giveaway tool** — collect entries from all three chats, dedupe likely-same users, draw on stream.
- ⬜ **Clip / highlight marker** — a hotkey or chat command that saves a replay-buffer clip and writes a timestamped marker for VOD editing.
- ⬜ **Now-playing overlay** — current track from the local music source, with a DMCA-safe mode.
- ⬜ **Countdown / BRB / starting-soon scenes** — timers as browser sources, controllable from the panel.
- ⬜ **Session recap** — post-stream summary: peak viewers per platform, new follows, top chatters, clips taken.

## Not planned (deliberately)

- Cloud hosting or accounts of any kind.
- A mobile app.
- Native C++ plugins, until something on the roadmap actually needs one.

---

## Suggested build order

1. Bridge with **one** platform (Twitch — best-documented) + fake adapter.
2. Unified chat overlay against that single platform.
3. Add Kick, then YouTube, to the bridge. Overlay should need zero changes — that's the
   proof the schema is right.
4. Alerts.
5. Stats bar.
6. Scene automation + health monitor.
