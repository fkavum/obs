# Timer

*A countdown for your "starting soon" screen, a "be right back" clock, or a count-up for
anything you like. One source covers all of them.*

## What you need

- [ ] The toolkit running (see [Starting the toolkit](getting-started.md))

That's all — the timer doesn't need any channel connected.

## Add it to OBS

1. Open **http://localhost:8778** and press **Copy** in the **Timer** section.
2. In OBS: **Sources** → **+** → **Browser** → name it `Timer` → **OK**.
3. Paste the link into **URL**. Set **Width** `1920`, **Height** `1080`. Click **OK**.
4. Add the same source to every scene that needs it — starting soon, BRB, ending. One source,
   used everywhere; it shows whatever you start from the setup page.

> Until you press **Start**, it shows nothing at all, so it never sits on a scene looking
> broken. (Turn that off with *Show nothing until the timer is started* if you'd rather.)

## Use it

Everything is on the setup page:

- **Time** — how long, like `5:00`. You can also type `90` for ninety seconds or `1:30:00`.
- **Label on screen** — "Starting soon", "Be right back", anything.
- **Counts** — down to zero, or up from zero.
- **At zero** — stop at `0:00`, show a message, keep counting up (so you can see how far over
  you've run), or disappear.
- **Start · Pause · Reset**, and **+1 min / −1 min** to adjust while it's running.
- **Quick set** buttons for the two you'll use most.

The little clock on the right shows what's on screen right now, so you don't need to look at
your stream to check.

> **It keeps time properly.** Refreshing the OBS source, or opening the page late, picks up
> the countdown exactly where it should be — it doesn't restart. You can start a countdown and
> then switch scenes freely.

## Change how it looks

**http://localhost:8778/settings/?overlay=timer** — quick looks: **Big** for a full-screen
countdown, **Card** for a panel with a background, **Corner** for a small clock in the corner
while you stream, **Minimal** for just digits.

Then: position on the screen, clock and label size, colours, a box behind it, and
**Colour in the last moments** — the clock turns red under ten seconds by default, so you know
to get ready without watching the numbers.

Turn on **Run a pretend countdown in this preview** to style it without starting a real one.

## If something goes wrong

**Nothing shows on the scene**
The timer is stopped. Press **Start** on the setup page. If you want it visible while idle,
turn off *Show nothing until the timer is started* on the style page.

**It restarted when I switched scenes**
It shouldn't — that's the main thing it's built to avoid. If it does, make sure *Shutdown
source when not visible* is **unticked** in the Browser Source properties in OBS.

**The numbers are cut off**
The source is smaller than the clock. Either make the OBS source 1920 × 1080, or lower
**Clock size** on the style page.
