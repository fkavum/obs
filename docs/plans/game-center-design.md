# Game Center — creature and economy design

*Companion to [`game-center.md`](game-center.md). Design only; nothing built.*

## The two constraints everything else follows from

**One currency.** The games already pay "points". Introducing "coins" as a second thing is the
fastest way to make this feel like a mobile game with a cash shop. **Rename points → coins**
everywhere; don't add a currency alongside them.

**Viewers can only see the stream and chat.** They can't open the setup page. So every piece of
feedback is either a card on the overlay, or a one-line bot reply — and bot replies only work
when a platform is signed in. Everything must work with cards alone; chat replies are a bonus.

---

## A. Species

### Shared frame
`viewBox="0 0 100 100"`, ground at y=88, 2px outline in a darkened coat colour (never black), one
shared eye component across the roster so it reads as one family.

**Silhouette rule:** fill the creature black at 40px. It must be identifiable by shape alone, and
differ from every other species in at least two of: head shape, ear shape, tail shape, body
proportion. *Colour never carries identity* — viewers recolour their pets, and some viewers are
colour-blind.

### Tier 1 — first adoption free

| Species | Personality | Silhouette key |
|---|---|---|
| **Dog** | Loves you loudly; has never had a bad day | Floppy ears below the jawline, thick curled tail |
| **Cat** | Judges you silently. Accepts fish as apology | Tall triangle ears, S-curve tail to head height, slit pupils |
| **Duck** | Chaotic. Screams. Admits no crimes | Wide flat bill, egg body, upturned tail |
| **Frog** | Zen. Occasionally licks something it shouldn't | Eye bumps *above* the head outline, squat blob, no ears |

### Tier 2 — 600 coins

| Species | Personality | Silhouette key |
|---|---|---|
| **Raccoon** | Petty thief. Loves you, is also robbing you | Fat banded horizontal tail, mask, visible hands |
| **Owl** | Knows everything. Says nothing | One egg shape, huge disc eyes, ear tufts |
| **Axolotl** | Perpetually smiling, no idea what's happening | Three feathery gill fronds each side |
| **Turtle** | Arrives after the boss is dead, asks who won | Dome shell, sleepy half-lidded eyes |

### Mythics — earned, never sold
Arrive as an **egg**, hatched by feeding on 5 separate stream-days. Only creatures allowed a
gradient and a glow — that's the visual language for "earned".

| Species | Earned by | Silhouette key |
|---|---|---|
| **Dragon** | Top damage in 5 raid bosses | Bat wings, horns, spade tail, spine ridges |
| **Phoenix** | Podium in 15 races | Three long tail plumes, flame crest |
| **Ghost** | Survive 20 heists at stake ≥50 | Wavy hem, floats, no legs |

### Rejected, with reasons
Fox and wolf are colour variants of dog/cat and fail the silhouette test. Bunny ears clash with
cat at small size. Snake has nothing to hang a hat on. Kraken was considered for the heist mythic
— eight tentacles is 8× the accessory-collision problem and turns to soup on a small card.

**Ship five creatures first** (Dog, Cat, Duck, Frog, Dragon). Each is ~120–180 lines of SVG once
stages and anchors are included; eleven at launch is 1,500+ lines of hand-tuned art *before*
knowing whether anyone feeds their pet. Add a species per release as free content drops.

---

## B. Evolution — four stages, parametric not redrawn

Each species is drawn **once** with three scale parameters and two optional groups:

| Stage | Levels | head | body | eyes | Adds | Reads as |
|---|---|---|---|---|---|---|
| 1 | 1–9 | 1.15 | 0.75 | 1.3 | — | Big head, tiny body, stub tail, no detail |
| 2 | 10–24 | 1.0 | 1.0 | 1.0 | `features` | Adult proportions, whiskers/stripes/ridges appear |
| 3 | 25–49 | 1.0 | 1.05 | 1.0 | `flourish` | One anatomical addition per species |
| 4 | 50+ | 1.0 | 1.05 | 1.0 | `aura` | Soft glow, three orbiting sparkles, eye glints |

**Resist any stage design that needs a species redrawn** — that's what makes eleven species
tractable.

Worked lines: Dog → Pup · Good Dog · Big Dog (chest ruff) · Goodest Boy. Cat → Kitten · Cat ·
Chonk (*the body actually widens — that's the joke*) · The Landlord. Raccoon → Kit · Bandit ·
Trash Panda (loot sack at its feet) · Mastermind.

**The evolution moment** is the most shareable thing in the system: hold the card 6 seconds, draw
the creature as a white silhouette with a scale pulse, then swap to the new stage.

---

## C. Feeding — the loop in one sentence

*Show up, feed your pet up to three times, watch it grow; the pet finds you a few coins for
tomorrow.*

| Food | Cost | XP |
|---|---|---|
| Kibble | 10 | 10 |
| Apple | 25 | 30 |
| Fish | 50 | 70 |
| Cake | 150 | 250 |
| Golden Carrot | 500 | 1,000 (one in stock per stream) |

**Favourite food** per species gives +50% XP and a reaction line — Dog: steak · Cat: fish ·
Duck: peas ("bread is bad for ducks, and the duck knows you know") · Dragon: chilli.

**Levels:** XP to next = `25 × current level`. Stage 2 at ~4 casual streams, stage 3 at ~25,
stage 4 at ~100. Stage 4 should be rare enough that a handful exist on the whole channel.

### Five rules that stop it being click-to-win

1. **Three meals per stream-day.** XP is gated by *attendance*; coins only decide how good each
   meal is. This is the mechanic that makes the whole thing work.
2. **First feed of a stream is 2× XP.** Showing up beats showing off.
3. **Streaks count streams attended, not days** — a week off costs nothing but the week.
4. **The pet forages** 10–30 coins per fed stream-day, so someone who only turns up to feed still
   sees a number rise. (Raccoon ×1.5 — its one mechanical perk.)
5. **Hunger is a mood, not a punishment.** After 3 missed stream-days the pet droops and the card
   says "Biscuit missed you." No XP or coin loss. The next feed is **3× XP — welcome back.**
   *Reject Tamagotchi-style decay outright: it makes people quit rather than return.*

---

## D. Customisation

### Colour: twelve curated coats, not a hex picker
A free colour picker produces neon-on-neon garbage within a day. A **coat** is one swatch that
derives three colours in code: `coat`, `outline` (−25% lightness), `belly` (+20% lightness,
−20% saturation). Twelve launch coats, all tested on light and dark backgrounds: Biscuit, Charcoal,
Snow, Rust, Moss, Lagoon, Plum, Bubblegum, Honey, Slate, Cocoa, Mint. Eyes: 6 options, free.

**Shiny coats** (1,500) are six two-tone gradients — the only gradients allowed outside mythics.

Species-locked accents never change: raccoon mask, duck bill, axolotl gills, dragon belly plates.
Those are identity, not decoration.

### Five slots, one anchor table per species
`hat` · `face` · `neck` · `back` · `paw`. Each species declares `{x, y, scale, rotate}` per slot in
its own frame. Accessories are drawn once in a 40×40 box with their attach point at the origin.
Render order: `back` → body → head → `neck` → `face` → `hat` → `paw`.

Hats cover ears; tall-eared species raise their hat anchor and accept it. *Don't build ear cut-outs
per hat per species — combinatorial pit.* `back` unlocks at stage 3: capes and wings change the
silhouette, so they're the prestige tier.

**~31 accessories** across Common 75 / Uncommon 200 / Rare 600 / Epic 2,000, plus three
**Legendary** earned-only items — Raid Champion Helm (top damage on 25 bosses), Heist Bag (survive
50 heists), and a free podium Flag. All animation is CSS transform/opacity on the accessory group.

---

## E. Avatars: crests, not faces

Drawing human faces in a few hundred lines of SVG at 32px produces clip-art nobody feels
represented by, and skin/hair sliders are months of work that still fail the people they're meant
to include. A **crest** — like a team badge — says "this is mine, I chose it" with no uncanny
valley, and reads at 24px beside the pet.

`shape (6) × pattern (5) × emblem (24) × two colours from the pet palette` ≈ **100,000 legible
combinations**. Sharing the palette with pets is what makes a card look like one design.

Everyone has one **before they do anything** — generated deterministically from a hash of
`platform + username`, so the first `!pet` card already looks personal. Changing it is free; this
is identity, not a shop. A small platform mark sits in the corner, taken from the adapter manifest,
never hardcoded.

`!avatar pet` uses your pet's face as your crest. Cheap to build; people will love it.

---

## F. Economy

Income is the **existing payouts, unchanged**, plus foraging: casual ~120 coins/stream, regular
~250, dedicated ~400. Starting balance stays 100.

| Item | Cost | Casual | Dedicated |
|---|---|---|---|
| First pet | free | now | now |
| Common accessory | 75 | same stream | same stream |
| Tier 2 species | 600 | ~1.5 weeks | 2 streams |
| Shiny coat | 1,500 | ~4 weeks | 4 streams |
| Epic accessory | 2,000 | ~5 weeks | 5 streams |
| Mythic | milestone + 5 fed days | — | 3–7 weeks |

Food is the only recurring sink (~50–450/stream), which is what stops balances inflating.
**Nothing in the shop affects game odds** — a Dragon does no more boss damage than a Duck. That's
the line that keeps it from feeling pay-to-win even with no real money involved.

**Mythics are milestones, not random drops.** A 2% egg drop makes viewers feel robbed for months; a
milestone lets them watch "12/15 podiums" on their card and tell you about it. Three milestones
across three different games means the community ends up with a mix rather than all Dragons.

---

## G. Commands

`!adopt <species>` · `!pet [@name]` · `!feed [food]` · `!name <name>` · `!coins` · `!shop [category]`
· `!buy <item>` · `!wear <item>` · `!coat <name>` · `!eyes <name>` · `!avatar <word>` · `!pets` ·
`!switch <species>` · `!pat @name` · `!gift <food> @name` · `!egg` · `!top pets` · `!pethelp`

**No `!daily`** — deliberately. Foraging already rewards showing up, and it routes through the pet,
which is the thing we want people looking at. **Only food is giftable, never coins** — coin gifting
invites begging and alt-account farming.

---

## H. Traps to avoid

**Overlay clutter — the big one.** Thirty people typing `!feed` is thirty cards. One toast slot,
queue depth 5, overflow collapses to "…and 12 others fed their pets". Per-user card cooldown 60s,
except level-ups and evolutions which always show. A streamer-side **Quiet mode** shows only
level-ups, evolutions and hatchings.

**The shop can't live on the overlay** — a scrolling price list on stream is noise. `!shop` replies
in chat; when no bot is connected, the streamer can toggle a static **Shop Board** overlay.

**OBS is a CEF instance.** `feGaussianBlur` on a dozen animated cards will stutter. Gradients only
on shiny coats and mythics; at most one filter on screen; never animate a path's `d`. Test a Phoenix
in a scarf and fairy wings on a laptop before signing off.

**Per-platform identity stays.** The same person on Twitch and Kick has two pets. **Don't build
account linking** — OAuth on both sides is a maintenance sink and breaks the near-zero-maintenance
rule. Make the platform mark clear and move on.

**Pet names need a blocklist** and a streamer "Reset name" button on the leaderboard row. Nothing
more than that.

**Emoji food in text is fine; emoji stuck onto the SVG pet is two art styles fighting.** Keep apart.

---

## I. Card layouts

**Chat card 300×120:** pet 100×100 left. Right: pet name + stage title · crest 20px + owner ·
XP bar · *one* line of context. Never two. Minimum text 12px.

**Profile card 600×400:** pet at 220×220 on a soft circle in its belly colour; crest 48px;
name; owner + platform mark; stage title; level + XP bar; three stat chips; equipped accessories as
chips; mythic progress if an egg is pending.
