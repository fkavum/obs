# Alerts

*Shows a pop-up on stream when someone follows, subscribes, tips or raids — from Twitch, Kick
and YouTube alike, one at a time.*

## What you need

- [ ] The toolkit running (see [Starting the toolkit](getting-started.md))
- [ ] At least one channel **signed in**. Chat works without signing in; alerts don't — a
  platform only tells signed-in apps about follows, subs and tips.
  Twitch: press **Sign in with Twitch** on the setup page. See [Connecting your channels](connect-channels.md).

## Add it to OBS

1. Open **http://localhost:8778** and press **Copy** next to the **Alerts overlay** link.
2. In OBS, under **Sources**, click **+**, choose **Browser**, name it `Alerts`, click **OK**.
3. Paste the link into the **URL** box.
4. Set **Width** to `1920` and **Height** to `1080` — the full screen. The style page decides
   *where* on that screen alerts appear, so don't shrink the box.
5. Click **OK**, then drag the source to the **top** of your Sources list so alerts sit above everything.

> **Sound:** OBS plays browser-source audio to your stream but not to your headphones by
> default. To hear alerts yourself, right-click the `Alerts` source → *Properties* → tick
> **Control audio via OBS**, then set that audio track to *Monitor and Output* in the
> Advanced Audio Properties.

## Try it without waiting for a real follower

On the style page (**http://localhost:8778/settings/?overlay=alerts**) there's a row of buttons:
**Follow · Sub · Tip · Raid**. Each sends one fake alert through the toolkit exactly as a real
one would travel — it appears in OBS. Use them to check position, size and sound.

## Change how it looks

1. Open **http://localhost:8778/settings/?overlay=alerts**.
2. **Quick looks** along the top are one-click styles. *Banner* stretches across the top.
   - **Position** — top/centre/bottom, left/centre/right, and how far from the edge.
   - **Look** — background tinted by platform or one colour, border, highlight colour, text.
   - **Timing & animation** — how long each alert stays, the gap between them, the entrance.
   - **Which alerts** — turn each kind on or off, set a minimum tip or raid size, hide messages.
   - **Wording** — change the sentences. `{name}` is the person, `{amount}` the tip,
     `{months}` the resub streak, `{count}` gifted subs, `{viewers}` the raid size.
   - **Sound** — the built-in chime (tips brighter, raids bigger), the volume, or your own
     sound file's web address.
3. Press **Copy link for OBS**, double-click your `Alerts` source in OBS, paste over the old link.

> **Tip:** switch on **Fire fake alerts in this preview** while styling. Switch it off to see
> real (or test-button) alerts in the preview instead.

## If something goes wrong

**Nothing appears, even with the test buttons**
Check the `Alerts` source is at the top of the Sources list and its box is 1920 × 1080. If the
style page preview shows alerts but OBS doesn't, right-click the source → *Refresh*.

**Real follows don't show but test alerts do**
That channel isn't signed in — look for a green dot *and* "alerts" in its status on the setup
page. Twitch shows "chat + alerts" when both are working.

**Too many alerts after a raid**
*Timing & animation* → **Most alerts waiting in line**. Lower it; the oldest are skipped so you
never fall minutes behind.

**No sound**
See the OBS audio note above — it's an OBS setting, not a toolkit one. In a normal browser tab
the first chime may be blocked until you click the page once.
