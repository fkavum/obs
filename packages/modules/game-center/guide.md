# Chat games

*Three games your whole chat plays together — Twitch, Kick and YouTube viewers in the same
game, which no platform's own features can do.*

## What you need

- [ ] The toolkit running (see [Starting the toolkit](../../../docs/guides/getting-started.md))
- [ ] At least one channel's name typed in

**No account needed.** Games only *read* chat, so they work with nothing signed in — unlike
alerts or the chatbot.

## Add it to OBS

1. Open **http://localhost:8778** and press **Copy** in the **Chat games** section.
2. In OBS: **Sources** → **+** → **Browser** → name it `Games` → **OK**.
3. Paste the link. Set **Width** `1920`, **Height** `1080`. Click **OK**.

Nothing shows until you start a game, so it never sits on your scene doing nothing.

## The three games

### 🏁 Chat Race — `!race`
Everyone who types `!race` gets a runner. After the joining window they sprint across the
screen, swapping places, and the first three over the line get coins. Best for a quick
burst of chat activity between matches.

### 🐉 Raid Boss — `!attack`
A monster appears with a health bar and chat has to beat it **together** before the timer
runs out. Every `!attack` does damage, with a chance of a critical hit. There's a short
cooldown per person, so it's a team effort rather than whoever types fastest.

The boss's health scales with how many people join, so it stays close whether five or fifty
turn up — but it stops growing halfway through, so a late rush can't make it unwinnable.
Everyone who joined gets coins if it dies; the top damage dealer gets more.

### 💰 Heist — `!heist <amount>`
Chat stakes coins and robs somewhere together. `!heist 50` puts in 50; `!heist all` puts in
everything. **The more people join, the better everyone's odds** — which is the real game,
because chat starts talking each other into joining. Survivors double their stake; the caught
lose theirs.

## Starting a game

On the setup page, press **🏁 Start Chat Race**, **🐉 Start Raid Boss** or **💰 Start Heist**.
Chat joins by typing the command. **Stop the game** cancels it.

Only one game runs at a time.

## Coins

Everyone starts with **100 coins** the first time they join anything. Coins are won by playing
and staked in the heist, and viewers can check theirs by typing `!coins`. They're kept per
person *per platform* — the same name on Twitch and Kick is two different people, because it
usually is.

`!top` shows the leaderboard, which also appears on the setup page and after each game.
Everything is stored in `config/game-center/profiles.local.config`, so it survives restarts.
Delete that file to wipe the scores.

## Pets

Viewers adopt a pet, feed it, and watch it grow up.

```
!adopt dog        your first pet is free — dog, cat, duck or frog
!name Biscuit     name it (first rename free, 100 coins after)
!feed             feed it — !feed fish for something better
!pet              show your pet on stream
!pet @someone     show theirs
!pets  !switch    when you have more than one
!egg              progress toward a mythic
```

**Four starters, plus one that must be earned.** Dog, Cat, Duck and Frog are free to adopt
(a second pet of any kind costs 600 coins). The **Dragon** can't be bought at any price —
you earn it by being top damage in 5 raid bosses, and `!egg` shows how far along you are.

**Food**

| | Cost | XP |
|---|---|---|
| Kibble | 10 | 10 |
| Apple | 25 | 30 |
| Fish | 50 | 70 |
| Cake | 150 | 250 |
| Golden Carrot | 500 | 1,000 |

Each species has a favourite worth 50% more — Dog and Cat love fish, Duck loves apple, Frog
loves kibble, Dragon loves cake.

**Three meals per stream, and that's the point.** Coins decide how *good* each meal is; how
*many* you get is decided by turning up. Nobody can buy their way to a maxed pet in one
evening. The first feed each stream is worth double, and a fed pet forages 10–30 coins back —
so someone who only turns up to feed still sees a number go up.

**Nothing bad happens if you disappear.** A pet that hasn't been fed for a few streams looks
a bit droopy and the card says it missed you — then the next feed is worth **triple**. There's
no decay, no hunger meter draining, and nothing to lose by taking a week off.

**Growing up.** Four stages: a pup with an oversized head becomes a Good Dog at level 10, a
Big Dog at 25, and the Goodest Boy at 50 — which should be rare on any channel. Each stage
changes how the pet is drawn, and an evolution always shows on stream even in quiet mode.

## Dressing up

Every pet can wear one thing per slot: a **hat**, something on its **face**, something round its
**neck**, something on its **back**, and something **held**. Thirty-one items in all.

| Command | What it does |
| --- | --- |
| `!shop` | Show the shelves — what there is to browse, and what to type to browse it. |
| `!shop face` | Open a shelf. `!shop hat 2` for its second page. |
| `!buy <item>` | Buy it. `!buy party hat` and `!buy partyhat` both work. |
| `!wear <item>` | Put it on the pet you have out. |
| `!off <slot>` | Take it off again — `!off hat`. |
| `!coat <colour>` | Change the coat. Free, as often as you like. Twelve colours. |
| `!eyes <colour>` | Change the eyes: onyx, amber, sky, forest, rose, gold. Also free. |
| `!closet` | Everything they own, and what's currently worn. |

**`!shop` on its own shows the shelves**, not a shelf — six of them, with how many things
are on each and the cheapest price, so nobody has to guess that `back` or `coat` exist:

```
!shop hat    crowns, beanies, wizard hats               10 · from 75
!shop face   glasses, shades, an eyepatch                6 · from 75
!shop neck   scarves, bow ties, gold chains              5 · from 75
!shop back   capes and wings (stage 3 and up)            4 · from 600
!shop paw    things to hold — balloons, swords, coffee   6 · from 75
!shop coat   shiny versions of the twelve colours       12 · from 1500
```

**Type whatever word comes to mind.** `!shop glasses`, `!shop eyes` and `!shop face` all open the
same shelf; so do `!shop hats`, `!shop head` and `!shop crown`. A word that matches nothing shows
the shelf list again and says so, rather than quietly opening a different shelf.

**Prices.** Common 75, Uncommon 200, Rare 600, Epic 2,000. Coats and eye colours cost nothing —
that's how someone makes a creature theirs in their first minute. **Shiny** coats are the paid
version: `!buy shiny moss` for 1,500, then `!coat moss shiny`.

**Some things can't be bought.** The Podium Flag comes from finishing a race on the podium, the
Heist Bag from surviving 50 heists, and the Raid Champion Helm from topping the damage in 25 boss
fights. They're handed over automatically the moment they're earned, and a card says so on stream.

**Back items need a grown-up pet.** Capes and wings only show from stage 3 (level 25). They can
be bought and worn earlier — the pet just wears them once it's big enough, and chat is told that
when they put it on.

## Avatars

Everyone has an avatar from the moment they first type — a crest built from their name, so a
new viewer's card already looks like theirs rather than blank. They can change it with one
command:

| Command | What it does |
| --- | --- |
| `!avatar` | Show what they have now. |
| `!avatar hexagon gold skull` | Change it. Any words, in any order. |
| `!avatar random` | Roll a new one. |
| `!avatar pet` | Match it to the pet they have out. |
| `!avatar reset` | Back to the one they started with. |
| `!avatar list` | Every word that works. |

**Any word, in any order.** Each word is checked against the shapes, the patterns, the emblems
and the colours all at once, so nobody has to learn which word goes where. `!avatar gold skull
hexagon` and `!avatar hexagon skull gold` do the same thing. Everyday colour words work too —
"blue" means lagoon, "gold" means honey. Words that mean nothing are ignored and named in the
reply, and the parts that did make sense still apply.

There are 6 shapes, 5 patterns, 24 emblems and 12 colours — 720 looks before you count the
second colour. It's all free: an avatar is how someone shows up, not something to charge for.

## The shop board

An optional overlay that shows what's for sale. Add a browser source pointing at
**http://localhost:8778/overlays/game-center/shop/** at 1920 × 1080.

It **never scrolls** — it pages instead, one section at a time, changing every 8 seconds. If a
section doesn't fit, it becomes another page rather than a scrollbar nobody on stream can move.

**http://localhost:8778/settings/?overlay=game-center.shop** — position, width, one or two columns,
rows per page, seconds per page, and which sections to include. Set `Sections to show` to a single
word like `hat` if you only ever want one shelf.

## Pet cards on stream

The third overlay shows a card when something happens to somebody's pet. Add a browser source
pointing at **http://localhost:8778/overlays/game-center/profile/** at 1920 × 1080.

**Quiet mode is on by default, and you probably want to leave it on.** A busy chat can produce a
card a second; an overlay that covers your stream is one you turn off on day one. With quiet mode
on you only see the moments worth seeing:

- somebody adopts their first pet
- a pet levels up
- a pet **evolves**
- somebody earns an item they can't buy

Everything else — feeding, shopping, checking coins — happens quietly in the background. Turn
quiet mode off in the settings if you want to see it all.

**When lots happens at once.** Only one card is on screen at a time. Up to five wait their turn;
past that the rest collapse into a single line — *"…and 12 others fed their pets"* — so the
channel still feels busy without the screen filling up. The same person can't take the slot twice
inside a minute, unless it's one of the moments above.

**The evolution moment.** When a pet evolves, its new shape appears as a white silhouette for a
few seconds, then the colour arrives. Six seconds, once, and the ordinary cards wait. It's the
payoff for weeks of feeding, so it's the one thing that interrupts. Turn it off in the settings
if you'd rather have a normal card.

**http://localhost:8778/settings/?overlay=game-center.profile** — position, size, colours, how
cards appear, how long they stay, and all of the above.

## Pets wandering on your stream

This is the one most people will actually see. Add a browser source pointing at
**http://localhost:8778/overlays/game-center/wander/** at 1920 × 1080.

**When somebody with a pet types in chat, their pet walks onto the bottom of your screen**,
wanders about for a while, and then wanders off. That's the whole thing. It's also how the shop
pays off: a hat sitting on a card nobody was looking at is a hat nobody buys.

- Only people who **have** a pet appear. Lurkers and people who've never played cost nothing and
  create nothing.
- Talking again resets their stay, so regulars stay out and quiet people drift off.
- **Ten at once by default.** When it's full, the pet whose owner has been quiet longest wanders
  off to make room.
- Change a hat with `!wear` and the pet on screen changes **immediately** — no need to type again.
- Bigger pets are further along: a fully grown one is about half again the size of a new one.

**Keeping it out of the way.** `Keep clear on the left` and `Keep clear on the right` stop pets
walking over your webcam or your alerts — they turn around at those lines instead. `Distance from
that edge` lifts the whole strip up off the bottom, and `Depth of the strip` is how much they
spread up and down, so they don't queue in one straight line.

**http://localhost:8778/settings/?overlay=game-center.wander** — position, size, speed, how long
they stay, how many at once, and whether names show.

## Change how it looks

**http://localhost:8778/settings/?overlay=game-center.games** — position, size, colours, how many players
to list, and how long results stay up.

To style one game in particular, add its name to the preview: `?preview=on&game=heist`.

## If something goes wrong

**Nobody joins**
Check they're typing the command exactly — `!race`, `!attack`, `!heist 50`. It has to be the
first thing in the message.

**"Not enough players"**
The race and heist need at least two. The raid boss works with one.

**The heist says people can't afford it**
The minimum stake is 10. Someone who lost everything has to earn coins back in a race or
boss fight first.

**Chat plays but nothing shows in OBS**
Check the `Games` source is 1920 × 1080 and near the top of your Sources list. The style page
preview is the quickest way to tell whether it's the overlay or OBS.
