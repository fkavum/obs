# Game Center — implementation plan

*Status: plan only. Nothing here is built. Written 2026-09-15.*

A shared world for chat across Twitch, Kick and YouTube: coins earned by playing chat games,
spent on a profile with an avatar and a pet you feed, level up, evolve and dress up.

---

## 0. The problem to fix first

The chat games that exist today are **not** modular. Adding them meant editing seven shared
files:

| File | Lines added |
|---|---|
| `packages/core/src/settings-schema.js` | 57 |
| `packages/panel/wizard.js` | 69 |
| `packages/panel/index.html` | 27 |
| `packages/bridge/src/server/index.js` | 25 |
| `config/initial.config.json`, `config/config.js`, `preview-feed.js` | 6 |

**183 lines of a feature living inside other people's files.** A game center is several times
larger than the games alone, so this compounds until every change risks breaking something
unrelated. It also breaks the project's own rule that a feature should be a drop-in folder.

Platforms already solve this: an adapter is a folder, the bridge scans the directory, and
**nothing in the codebase names a platform**. Features need the same contract.

### The module contract

```
packages/modules/game-center/
  module.json        id, label, version, what it provides
  index.js           createModule({ config, hub, store, log }) -> { start, stop, routes, status }
  api.js             its own HTTP routes, mounted under /api/m/game-center/
  overlays/          browser sources, served at /overlays/game-center/<name>/
    games/  profile/  shop/
  panel/             pages and setup-page cards, served at /panel/game-center/
  settings/          overlay setting schemas, registered not hardcoded
  data/              default data files, seeded like initial.config.json
  guide.md
  test/
```

Core changes, made **once**, then never again for any future feature:

1. **Module loader** — scans `packages/modules/*/module.json`, same shape as the adapter loader.
2. **Route mounting** — a module's routes are namespaced; `server/index.js` gains a single
   generic "hand unknown `/api/m/<id>/*` to that module" branch instead of a branch per feature.
3. **Overlay registry from modules** — `OVERLAYS` in the settings schema becomes populated at
   runtime from module manifests and served over `/api/overlays`, instead of a hardcoded list
   that every feature appends to.
4. **Panel composition** — the setup page renders module cards from the registry, so a module
   supplies its own card instead of editing `index.html` and `wizard.js`.
5. **Per-module data directory** — `config/<module-id>/` with the existing initial/local
   seeding, granted automatically.

**Test of success:** delete `packages/modules/game-center/` and the toolkit starts clean with
no dangling references. Same test the adapters already pass.

**Enforced, not just intended.** A rule kept by discipline erodes the first time something is
urgent. Two automated guards:

- A test that greps the shared tree for any module id (`game-center`, and each module found on
  disk) and fails if one appears outside `packages/modules/`. This is the rule that was broken
  last time, written down as a test.
- A test that loads the toolkit with the module directory emptied and asserts the bridge still
  starts, every page still serves, and the existing suite still passes.

**How much of this already exists** (checked against the code, not assumed):

| Needed | Status |
|---|---|
| Scan a directory and load what it finds | Exists — `adapters/loader.js`, reusable shape |
| Per-folder `initial`/`local` data seeding | Exists — `store.js`, 6 helpers |
| Serving overlays generically by path | Exists — one branch already handles `/overlays/*` |
| Settings screen building itself from a registry | Exists — reads `OVERLAYS`, no per-overlay code |
| **Module loader** | New |
| **Generic `/api/m/<id>/*` mounting** | New — replaces 19 hardcoded route branches growing by feature |
| **`OVERLAYS` populated from modules** | New — currently a hardcoded list each feature appends to |
| **Setup page cards from a registry** | New — currently 52 hardcoded DOM hooks |

So the refactor is four pieces on top of patterns the codebase already uses, not a rewrite.

---

## 1. Design decisions that change this plan

Three findings from the [creature and economy design](game-center-design.md) affect the build:

**One currency, not two.** The games already pay "points". Adding "coins" alongside them is the
fastest route to feeling like a mobile cash-shop. Recommendation: **rename points → coins** and
carry the existing balances over. This is a naming change plus a migration, not a new system.

**Viewers cannot open the setup page.** They see the stream and chat, nothing else. So every
piece of feedback is either an overlay card or a one-line bot reply — and bot replies need a
signed-in platform, which not everyone will have. **Everything must work from cards alone.**
That makes the card renderer the centre of the feature, not an afterthought, and it rules out a
shop that lives on the overlay.

**Accessory slots are `hat` · `face` · `neck` · `back` · `paw`** — five, not the four the spike
used, and notably **no shoes** (see "What I'd push back on" below).

## 2. Data model

One profile per viewer **per platform** — the same name on Twitch and Kick is two people,
consistent with how the games already score.

```jsonc
// config/game-center/profiles.local.config
{
  "twitch:pixelpete": {
    "name": "PixelPete", "platform": "twitch",
    "coins": 340, "joinedAt": 0, "lastSeen": 0,
    "avatar": { "style": "…", "palette": "…", "accessories": [] },
    "pets": [{ "id": "p1", "species": "…", "name": "Noodle", "xp": 0, "level": 3,
               "stage": 1, "colour": "…", "accessories": [], "fedAt": 0 }],
    "activePet": "p1",
    "inventory": ["…"],
    "stats": { "played": 12, "wins": 3 }
  }
}
```

**Writes are debounced.** A busy chat could touch hundreds of profiles a minute; rewriting the
file per change would be the first thing to break on a real stream. Held in memory, flushed
every few seconds only when dirty, and on shutdown.

**Scaling note to decide before building:** a single JSON file is fine for a few thousand
profiles and awkward beyond that. Proposal: keep one file, but cap retained profiles (e.g.
drop those unseen for 90 days, since they hold nothing a viewer would miss). Revisit only if
it actually hurts.

---

## 3. Rendering pets and avatars

**Constraint:** everything is drawn in code as inline SVG — no image files, no downloads.
This is forced by the browser-source sandbox and by the toolkit's zero-dependency rule.

**Validated by spike** (built and rendered before writing this plan):

- A species declares **anchor points** — `head`, `body`, `feet` — each with a position and a
  scale.
- An accessory is drawn **once**, declares which anchor it uses, and is placed by a transform.
  One top hat definition sat correctly on four different body shapes.
- Evolution works by **adding or swapping parts** (the dragon grew wings at stage 2 and a crest
  at stage 3) rather than redrawing the creature.
- Roughly 60 lines of path data per species is enough.

**The real risk the spike exposed:** four species drawn this way had *too similar a silhouette*
at small size. Colour does not distinguish them. Species must differ in outline — ear shape,
tail, body proportion — which is a design problem, not a code one, and is the first thing the
creature designs must solve.

---

## 4. Phases

Each phase is shippable on its own and verifiable without a live stream.

| # | Phase | Delivers | Depends on |
|---|---|---|---|
| **0** | Module system | The contract above; nothing user-visible | — |
| **1** | Move games into a module | Identical behaviour, zero shared-file edits. Proves the contract. | 0 |
| **2** | Coins and profiles | Currency replacing today's points, profile store, `!coins` | 1 |
| **3** | Pets | Species, SVG renderer, adoption, feeding, XP, levels, evolution | 2 |
| **4** | Customisation and shop | Colours, accessories, slots, buying, equipping | 3 |
| **5** | Avatars | The human-side profile picture | 2 |
| **6** | Profile card overlay | On-stream card when someone shows their pet; panel browser | 3–5 |

Phase 1 is the one that matters most: it converts the existing 183 lines of shared-file edits
back into a folder, and proves the contract on code that already works before anything new is
built on it.

---

## 5. What I'd push back on

Two things you asked for that the design argues against. Your call — here's the case.

**Shoes.** You asked for hats, shoes and clothes; hats and clothes are in. Shoes are ~6px tall on
creatures that sit (cat, frog), have talons (owl), or have no feet at all (ghost) — on a 300×120
chat card nobody would ever see them. The recommendation is to spend that effort on **held items**
instead (coffee cup, balloon, foam sword, controller): eye level, readable at any size, far more
personality. If you still want shoes, they're one `feet` slot rendering two shapes at the
front-foot anchors, hidden for the species without feet.

**Free colour choice.** You asked to let people pick colours. A raw hex picker reliably produces
neon-on-neon that's unreadable over video within a day. The recommendation is **twelve curated
coats**, each deriving its own outline and belly shades in code — viewers still choose, but every
choice looks deliberate — plus six free eye colours, and gradient "shiny" coats as a premium
unlock. If you want the full picker anyway, the compromise is constraining it to a
lightness/saturation band that stays legible over video.

---

## 6. Decisions (settled 2026-09-15)

1. **Points are renamed to coins**, carrying existing balances over. One currency.
2. **Five creatures first** — Dog, Cat, Duck, Frog, Dragon. Further species ship one per release
   as free content drops.
3. **A collection, not one pet.** `!pets` and `!switch`; a reason to keep earning.
4. **Quiet mode on by default.** Only level-ups, evolutions and hatchings appear on stream; feeds
   are silent unless the streamer turns them on.

---


## 7. Creative design

Species roster, evolution lines, feeding economy, accessories, avatars, commands, card layouts and
the traps to avoid: **[`game-center-design.md`](game-center-design.md)**.
