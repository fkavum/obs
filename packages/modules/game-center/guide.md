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
