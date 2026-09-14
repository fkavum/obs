# Stats bar

*A strip showing how many people are watching across Twitch, Kick and YouTube together, how
long you've been live, and this stream's new followers and subs — with an optional goal bar.*

## What you need

- [ ] The toolkit running (see [Starting the toolkit](getting-started.md))
- [ ] For **viewer counts**: channels **signed in** — platforms only give viewer numbers to
  signed-in apps. Twitch: **Sign in with Twitch** on the setup page.
  (Follower and sub counts come from alerts and need the same sign-in.)

## Add it to OBS

1. Open **http://localhost:8778** and press **Copy** next to **Stats bar**.
2. In OBS: **Sources** → **+** → **Browser** → name it `Stats` → **OK**.
3. Paste the link into **URL**. Set **Width** `1920`, **Height** `90`. Click **OK**.
4. Drag it to the top or bottom edge of your scene.

For a stacked panel in a corner instead, pick the **Panel** quick look on the style page and
use a source about `360 × 300`.

## What the numbers mean

- **watching** — everyone, across all platforms, added up. Each platform's own chip is next to it.
- **live** — time since the first platform went live. Resets when they all go offline.
- **+followers / +subs** — new ones **since the overlay was opened**, not your lifetime total.
  Gifted subs count each. Refreshing the OBS source resets them.
- A platform that hasn't reported for 90 seconds drops out of the total (adjustable), so a
  channel you've stopped streaming to doesn't keep padding the number.

## Set a goal

On the style page, **Goal bar** → choose *followers*, *subs*, *viewers* or *tips*, type a
**Target**, and — for followers, subs and tips — type your **Current number** (e.g. `1180` if
you have 1,180 followers). Both are typed boxes, so exact numbers are easy. The bar then shows
`1,182 / 1,200` and fills as alerts come in. Viewer goals use the live total instead.

The bar has its own look, separate from the pills: the **filled** and **empty** part colours,
thickness and rounding, an optional **box** behind it with its own colour and border (solid or
glow), and whether the label and numbers sit **above**, **below** or are hidden. *Filled part
colour* defaults to *Match the highlight colour* so it follows the rest of the bar unless you
pick something else.

## Change how it looks

**http://localhost:8778/settings/?overlay=stats** — pick what to show, a quick look (*Platform*
tints each chip by its platform, *Panel* stacks vertically, *Neon* glows), sizes and colours.
Copy the link, paste over the old one in OBS.

## If something goes wrong

**It's empty**
It shows nothing until it has a number. Viewer counts need a signed-in channel that is live.
Try **Use fake numbers in this preview** on the style page to check the look meanwhile.

**Viewers are only from one platform**
The others aren't signed in, or aren't live. A green dot with "viewers" in its status on the
setup page means that platform is reporting.

**The follower count went back to 0**
The OBS source was refreshed or the toolkit restarted — counts are per session by design. Use
**Starting from** in the goal settings if you want a running total shown.
