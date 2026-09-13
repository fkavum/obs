# Roadmap

Status: ⬜ not started · 🟨 in progress · ✅ done

Items 1-5 are built and tested. This file stays the proposal + tracker.

Every item is judged against the two hard constraints in `introduction.md` §3:
**near-zero maintenance** and **usable with zero technical knowledge**. Items that fail
either one are in **Postponed** at the bottom, with the reason recorded so the decision
doesn't get re-argued later.

---

## Tier 1 — foundation

### ✅ 1. Bridge + adapter system
Adapter auto-discovery, normalized event stream, local WebSocket, HTTP server for overlays.
**Build the `fake` adapter first** — it powers development, demos and `preview=on`, and it
means overlay work never requires going live.
*Constraints:* core holds no platform-specific code, so a platform breaking can't break the toolkit.

### ✅ 2. Setup wizard
Includes both login paths: one-click code sign-in where the platform allows a public client
(Twitch), and register-your-own-application on every platform including Twitch. See the Login
section of [`architecture.md`](architecture.md) for why the three platforms differ.
Browser page: a **Connect** button per platform (log in → done), an OBS connection check, and
a status screen with a green/red dot per platform in plain words. Writes
`config/config.local.json` so the operator never opens a file.
*This is the feature that makes everything else zero-knowledge.* It ships before any overlay.

### ✅ 3. Platform adapters — Twitch → Kick → YouTube
In that order: Twitch is the best-documented, Kick second, YouTube last because its polling
quota needs the most care (see `docs/architecture.md`). **The chat overlay must need zero
changes as each is added** — that's the proof the adapter contract is right.
*Maintenance:* automatic token refresh is part of "done", not a follow-up.

---

## Tier 2 — must-have streamer tools

### ✅ 4. Unified chat overlay — vertical
One merged chat from all platforms, platform-tinted and badged. Fully restylable: borders,
background transparency, platform icons, per-platform message backgrounds, sizes.
Full spec: [`overlay-chat.md`](overlay-chat.md).
*Why it matters:* reading three chat windows while playing is the single biggest tax of
multi-streaming.

### ✅ 5. Settings screen (visual, live preview)
Controls for every overlay option, the real overlay live-previewing beside them, one-click
theme presets, and a **Copy URL** button to paste into OBS.
*Ships with #4 — the overlay is not "done" until it can be restyled without touching a URL.*

### ⬜ 6. Unified chat overlay — horizontal
Same overlay, same settings screen, `layout=horizontal`. Card row along the top or bottom.

### ⬜ 7. Alerts (follow / sub / donation / raid)
Queued so simultaneous events don't overlap, per-event templates, sound, test-fire button.
Restyled from the same settings screen.
*Why it matters:* replaces the main paid SaaS widget, and fires for Kick and YouTube with the
same look as Twitch.

### ⬜ 8. Live stats bar
Combined and per-platform viewer counts, uptime, session goal bar.
*Why it matters:* when multi-streaming, "how many people am I actually talking to" is a
number no single platform can tell you.

### ⬜ 9. Stream health warning (read-only)
Dropped frames, encoder lag and bitrate on a **streamer-only** overlay, not on the broadcast.
Warns; does not act.
*The auto-react version is postponed — see below.*

---

## Tier 3 — after Tier 2 is stable

- ⬜ **Chat commands & timers** — `!discord`, rotating auto-messages, all platforms at once. Commands managed in the settings screen, not a file.
- ⬜ **Countdown / BRB / starting-soon timers** — browser sources, controlled from the settings screen.
- ⬜ **Clip / highlight marker** — a hotkey saves a replay-buffer clip and writes a timestamped VOD marker.
- ⬜ **Polls overlay** — chat-voted polls that work across all three audiences at once.
- ⬜ **Giveaway tool** — entries from all chats, deduped, drawn on stream.
- ⬜ **Session recap** — peak viewers per platform, new follows, top chatters, clips taken.

---

## Postponed — and why

Not rejected. Each fails a hard constraint **as currently scoped**; the note says what would
have to change.

| Feature | Fails | Reason | What would unblock it |
|---|---|---|---|
| **Moderation actions** (timeout/ban from a merged panel) | Maintenance | Needs mod-scope tokens on all three platforms and per-platform action APIs — triple the auth surface and the most likely thing to silently break. | Ship read-only merged chat first; add actions once the token refresh layer has proven itself over real streams. |
| **Rules-engine scene automation** | Zero-knowledge | "event → OBS action" rules are a programming language wearing a config file. A non-technical operator can't author or debug one. | Replace with a small set of **preset automations** as on/off toggles (e.g. "switch to BRB when I type `!brb`"). Revisit the general engine only if the presets prove limiting. |
| **Auto-reacting health monitor** (auto-drop bitrate, auto-switch scene) | Never break the stream | An automated action that misfires mid-stream is worse than the problem it solves. | Run the read-only warning version (#9) for a season. If its warnings prove reliable, add opt-in actions one at a time. |
| **Now-playing overlay** | Maintenance | Music-service OAuth is another token to keep alive and another API that changes, for a cosmetic feature. | A local-source-only version (reading what OBS already has) with no third-party account. |
| **Native C++ OBS plugin** | Maintenance | Needs CMake, per-OS builds, and rebuilding on OBS major versions. | Only if something genuinely can't be done as a browser source. |
| **Cloud sync / hosted version** | Local-first | Adds an account, a server to run, and an outage mode. | Not planned. |

---

## Build order

1. ✅ Bridge + `fake` adapter.
2. ✅ Setup wizard + status screen.
3. ✅ Twitch adapter.
4. ✅ **Vertical chat overlay + settings screen** — the first thing usable on a real stream.
5. ✅ Kick adapter, then YouTube adapter. The overlay needed no changes, which is the
   evidence that the adapter contract holds.
6. Horizontal chat layout ← next
7. Alerts → stats bar → health warning.

A guide (`docs/guides/`) ships with each numbered item. Not after.

## What isn't verified yet

The three real adapters are written against each platform's documented API but have **not
been run against a live channel** — that needs real credentials and an actual broadcast.
Expect the first real connection of each to need small fixes. Everything else (bridge,
overlay, wizard, settings, event flow) is verified end to end against the fake adapter.
