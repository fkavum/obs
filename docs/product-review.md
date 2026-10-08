# Product review — 2026-09-29

A product-management pass over where the toolkit stands, what's at risk, and what to do next.
Every suggestion here has been checked against the two hard constraints in
[`introduction.md`](../introduction.md) §3. Status tracking stays in [`roadmap.md`](roadmap.md).
This file covers **priorities and reasoning**. When a task here is accepted, move it into the
roadmap.

> **Owner's decisions (2026-09-29):**
> - **Feature freeze: yes.** No new features. Existing features, Game Center included, may
>   still be improved.
> - **Task list accepted except P2 (Tier 3).** Giveaways, polls, session recap and the clip
>   marker are not planned for now.
> - **Done first:** P0-1, the [live-test checklist](live-test-checklist.md), and P1-1, the
>   **Add to OBS** button (built on `dev`, with the guide
>   [Add to OBS](guides/add-to-obs.md)). Both wait on a live check.

---

## 1. The verdict in one paragraph

A lot has been built and very little of it has been proven. In 16 days the toolkit went from
nothing to a bridge with three platforms, seven overlays, a setup wizard, a settings screen,
chat commands, a rehearsal room, a chat economy with pets, and a to-do list. That's roughly
26k lines behind 34 test files. **Only one thing has been checked against a real stream: chat.**
`main`, the branch the owner streams with, was last updated on **2026-09-14** and is
**32 commits behind `dev`**. The project's definition of done is "run the entire stream from
these tools", and it is now held up by validation, not by missing features. **The next two weeks
should go into getting what's built onto `main`, not into building more.**

---

## 2. Scorecard

| Area | Built | Proven live | On `main` | Notes |
|---|---|---|---|---|
| Bridge + adapters (chat) | ✅ | ✅ all 3 platforms, macOS + Windows | ✅ | The foundation is solid. The adapter contract held: adding platforms needed no overlay changes. |
| Setup wizard / sign-in | ✅ | ⚠️ chat only. Twitch device-code sign-in never run | partly | **Single biggest blocker.** Alerts, viewer counts and bot replies all wait on it. |
| Chat overlay (vertical + horizontal) | ✅ | ✅ | ✅ | Ready to use. |
| Settings screen + presets | ✅ | ✅ | ✅ | |
| Alerts | ✅ | ❌ waits on Twitch sign-in | ❌ | Replaces the main paid SaaS widget, so it has the most value waiting on one test. |
| Stats bar | ✅ | ❌ | ❌ | The roadmap disagrees with itself: it's 🟨 under item 8 and ✅ under Build order. |
| Stream health | ✅ | ❌ needs real OBS | ❌ | |
| Timer | ✅ | ❌ (marked ✅ in roadmap) | ❌ | Low risk, since it only needs the bridge and OBS. |
| Chat commands / auto-messages | ✅ | ❌ sending never run | ❌ | Twitch needs a re-sign-in for `chat:edit`. |
| Rehearsal room | ✅ | n/a (it's the test harness) | ❌ | High leverage. It's the reason off-stream testing works. |
| Game Center | ✅ 6 phases | ❌ no live audience | ❌ | The largest module. It was built ahead of Tier 2 being stable (see §3.2). |
| To-do list | ✅ | ❌ | ❌ | Not placed in any roadmap tier. |
| Token refresh over days | code exists | ❌ | — | Hard constraint A depends on this, and time hasn't passed yet. |

---

## 3. Findings

### 3.1 The validation gap is the product's biggest risk
Everything since 2026-09-14 lives only on `dev`. Each extra week of unmerged work makes the
eventual live check larger, the first-contact fixes harder to attribute, and the merge riskier.
The branch rule ("merge after a live check") is right, but nothing currently produces live
checks. They need to be scheduled like a feature.

### 3.2 Scope has drifted from the roadmap's own ordering
The roadmap says Tier 3 comes "after Tier 2 is stable". Game Center (pets, 31 accessories,
12 coats, avatars, a shop) and the to-do list were built while three Tier 2 items were still 🟨.
They're good features, and cross-platform chat games are a real differentiator. But none of
them move the definition of done, and they add surface that has to be proven live too.

### 3.3 Viewer data is committed to git
`config/game-center/profiles.local.config` holds viewers' names, coins and pets, and it is
committed because `*.local.config` files are deliberately tracked. The rule was written for
*looks and settings*. It doesn't fit *viewer state*:
- It breaks the "keep it shareable later" rule (§4). Anyone given the repo gets the owner's
  audience data.
- Every stream writes to a tracked file, so `git status` is never clean after going live, and
  switching between `dev` and `main` can conflict on it.
- It's personal data about third parties (chatters) sitting in version history.

`config/games/points.local.config` is an orphan from before points were renamed to coins.
Nothing reads it now.

### 3.4 The Kick browser fallback is on the edge of the "official APIs only" rule
When Cloudflare challenges a channel lookup, the adapter launches a local browser to fetch the
page. It's honest (no user-agent spoofing), it's only used for lookups, and chat itself goes
through the normal path. But it's the piece most likely to break without warning when Kick
changes its bot protection, and it depends on which browsers happen to be installed. Treat it
as a known maintenance risk: keep a watch on it and record the decision.

### 3.5 Zero-knowledge gaps that remain
- **Adding overlays to OBS is still manual.** The operator copies a URL, creates a Browser
  Source, pastes it and sets the size, once per overlay (seven overlays plus four Game Center
  overlays). The bridge already speaks obs-websocket v5, so it could do this for them.
- **"Is everything ready to go live?" has no single answer.** The status dots cover
  connections, but not token expiry, the YouTube quota for the day, the OBS link, or whether the
  overlays are actually in the scene. `npm run diagnose` exists but needs a terminal.
- **Node.js is a prerequisite.** `start.command` tells the user to install it. Fine for now
  (packaging is deferred, §4), but it's the first thing to fix when distribution happens.
- **YouTube setup is the steepest step.** Google Cloud app registration and the Testing vs
  Production trap. The guides now warn about the 7-day expiry, which is good. The wizard should
  catch it too (see task P1-5).

### 3.6 Hygiene
- Stray files: `file.txt` (contents: `sd`), `config/chat/xxx.local.config` (a test preset).
- Roadmap drift: "Items 1-5 are built and tested" is out of date, and statuses disagree between
  the tier list and Build order. Game Center and the to-do list aren't placed in a tier.
- Some commit messages (`asd`, `lols added.`, `gamesss!`, `tasks`) will make the history hard
  to use when a live regression needs bisecting.

---

## 4. Recommendations

1. **Declare a feature freeze on `dev` until the live-verification backlog is cleared.** Fixes
   and guides only. No new modules.
2. **Turn live verification into a repeatable, scripted session**: a written checklist run
   during a real (or unlisted/test) stream. Merge to `main` in **batches by risk**, not all 32
   commits at once.
3. **Unblock Twitch sign-in first.** One sign-in unlocks four items at once: alerts, viewer
   counts, EventSub, and bot replies.
4. **Separate "settings" from "state".** Settings keep their two locations. Viewer and runtime
   state needs its own git-ignored home. This needs an explicit decision, because the ground
   rules forbid a new config location (see Decisions needed).
5. **After the freeze, spend the next build cycle on removing setup steps, not adding
   features.** "Add to OBS for me" and a go-live check each save more operator effort than any
   new overlay would.
6. **Then finish Tier 3 with the cross-platform items first** (polls, giveaway). They are the
   product's unique value, since no competitor merges three audiences into one vote or one draw.

---

## 5. Task list

Priority: **P0** do now · **P1** next cycle · **P2** after that. Each task names its acceptance
check. Anything that ships a feature also ships its guide.

### P0 — Prove what's built and get it onto `main`

| # | Task | Done when |
|---|---|---|
| P0-1 ✅ | **Write the live-verification checklist** ([`live-test-checklist.md`](live-test-checklist.md)) (`docs/guides/` or `docs/plans/`): one line per feature, what to do, what you should see. Cover alerts, stats, health, timer, commands, Game Center, to-do. | A non-developer could run it on a stream without asking questions. |
| P0-2 | **Run Twitch device-code sign-in live**, including the `chat:edit` re-sign-in. Fix first-contact bugs. | A real follow fires an alert; the bot answers `!command` in Twitch chat. |
| P0-3 | **Run Kick sign-in live** (viewer counts). | Combined viewer count on the stats bar includes Kick. |
| P0-4 | **Run YouTube Super Chat / membership events live** (a test donation is enough). | Arrives as the normalized event and fires the same alert look. |
| P0-5 | **Batch 1 merge to `main`**: timer, stats bar, stream health, rehearsal room (low-risk, no new auth). | Streamed with once on `main` without incident. |
| P0-6 | **Batch 2 merge**: alerts + chat commands, after P0-2. | Same. |
| P0-7 | **Batch 3 merge**: Game Center + to-do, after one stream with a live audience and quiet mode on. | Same, with no coin/pet state corruption after the stream. |
| P0-8 | **Start the token-refresh clock**: sign in on all three platforms, then don't touch them. Check at day 2, 7 and 14. | Still connected at day 14 with no operator action. Record the result in the roadmap. |
| P0-9 | **Move viewer state out of git** (after the decision below): untrack `profiles.local.config`, purge the orphan `games/points.local.config`, and migrate existing data on first run. | `git status` is clean after a stream; a fresh clone contains no viewer data. |
| P0-10 | **Hygiene**: delete `file.txt` and `xxx.local.config`; fix roadmap status drift; place Game Center and to-do in a tier. | Roadmap statuses agree everywhere. |

### P1 — Remove setup steps (next build cycle)

| # | Task | Constraint check | Done when |
|---|---|---|---|
| P1-1 🟨 | **"Add to OBS for me" button** (built 2026-09-29, awaiting live check) per overlay on the settings screen: creates the Browser Source in the current scene via obs-websocket v5 at the right size, with the current URL. Keep Copy URL as the fallback. | Official API. Removes a manual step. The URL is still the only place appearance lives. | One click, and the overlay appears in OBS correctly sized. |
| P1-2 | **Go-live check** on the status screen: a single "Ready to go live?" panel listing platform sign-ins, token health, YouTube quota left today, the OBS link, and which toolkit overlays are present in the current scene. Plain words, green/amber/red. Brings `diagnose` into the browser. | Read-only. No new settings. | The operator can answer "am I ready?" without a terminal. |
| P1-3 | **Game Center backup / restore button** (download / upload one file) on the Game Center page. | Browser UI, no file editing. | Coins and pets survive a machine move without touching git. |
| P1-4 | **Kick fallback watch**: log when the browser fallback triggers, show it on the status screen ("Kick lookup needed a workaround"), and record the decision in the roadmap. | Makes a maintenance risk visible instead of silent. | The fallback can't fail silently. |
| P1-5 | **Wizard detects a Google app left in Testing** (a refresh fails after about 7 days with the known error) and explains the fix in plain words, with a link to the guide section. | Turns a silent break into a one-click fix. | A Testing-status token expiry shows a specific message, not a generic red dot. |
| P1-6 | **Preset automations, first two toggles** (the unblock path from the Postponed table): "`!brb` → switch to BRB scene and start the BRB timer", and "stream starts → starting-soon countdown". On/off only. | These are toggles, not a rules engine, so they stay zero-knowledge. | Works live. The guide is one screen. |

### P2 — Finish Tier 3, cross-platform first

> **Not accepted (2026-09-29).** Kept here for the reasoning only. These are new features, so
> they're covered by the freeze.

| # | Task | Why this order |
|---|---|---|
| P2-1 | **Giveaway tool**: entries from all three chats, deduped per platform identity, drawn on stream. | Core differentiator. It reuses Game Center's profile identity, so it's cheap. |
| P2-2 | **Polls overlay**: one vote across three audiences, with a per-platform breakdown as an option. | Same differentiator. Same command plumbing. |
| P2-3 | **Session recap**: peak viewers per platform, new follows, top chatters, and coins/pets milestones, as a page in the panel after the stream ends. | The data already flows through the bridge. Read-only. |
| P2-4 | **Clip marker, rescoped**: hotkey saves the replay buffer (obs-websocket) and writes a local timestamped log. **Platform VOD markers postponed.** Twitch needs another scope, and YouTube and Kick have no equivalent, so it would be one-platform-only. | Keeps the useful half. Avoids new auth surface. |
| P2-5 | **Game Center economy guardrails** before growing it further: cross-platform coin-farming limits, bot-account handling, a "reset season" button. | Needed once a real audience starts playing. Decide based on the P0-7 observations. |

### Keep postponed (no change recommended)
Moderation actions, the general rules engine, the auto-reacting health monitor, now-playing, the
native plugin, cloud sync. All the reasons in the roadmap still hold. Revisit moderation only
after P0-8 shows token refresh surviving 14 days.

---

## 6. Decisions needed from the owner

1. **Where does viewer/runtime state live?** Proposal: a git-ignored `data/` folder for state
   the toolkit *writes on its own* (profiles, coins, pets, the to-do list), kept apart from
   `config/`, which holds things the operator *chooses*. This is state, not a settings
   location, so the "two settings locations" rule is unaffected. It still deserves a line in
   `introduction.md` §10 so it isn't re-argued.
2. **Is the to-do list's "edit the file by hand mid-stream" path a feature or a debug aid?**
   It's harmless as an optional extra. But if it stays in the guide, it teaches the operator to
   edit files, which the product otherwise never asks of them. Recommendation: keep the file
   watch, drop it from the guide.
3. ~~**Feature freeze: yes or no?**~~ **Yes** (2026-09-29). Improving existing features is allowed.

---

## 7. How we'll know it's working

- **Days since `main` last moved.** Target: under 7 while the freeze lasts, currently 15.
- **Features proven live / features built.** Target: all of Tier 2 by the end of P0,
  currently 3 of 6 (both chat layouts and the settings screen).
- **Operator actions to go from a fresh machine to live** (count clicks and pastes in the
  getting-started guide). P1-1 and P1-2 should cut this roughly in half.
- **Unattended days without a re-sign-in** (P0-8). Target: 14 or more on all three platforms.
- **Third-party subscriptions still in the stream setup.** The definition of done is 0.
