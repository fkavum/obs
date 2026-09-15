# Rehearsal — try everything before you go live

A pretend stream inside the toolkit. Fake chat, fake alerts, your real overlays — so you can
see the whole thing working without going live and without opening OBS.

**Open it at [http://localhost:8778/rehearsal/](http://localhost:8778/rehearsal/)** — it's the
last tab under *Streaming tools*.

## What you can do

**Put something behind the overlays.** Pick a dark room, bright gameplay, a moving scene or a
checkerboard. Or press *Use a video from this computer* and pick any video file — it never
leaves your machine, it just plays behind the overlays so you can see whether your text stays
readable over moving pictures.

**Turn overlays on and off.** Every overlay you have, including ones that come from features
like the Game Center. They appear exactly as you styled them on the style pages. Turning one off
here changes nothing in OBS — this is a rehearsal room, not a control panel.

**Type as anybody.** Put a name in, choose a platform, and send a message. Commands work:
`!race`, `!shop`, `!adopt dog`. It all goes through the real toolkit, so whatever happens here
is what will happen on stream.

**Keep chat busy.** Switch on *Demo chat* and a room full of pretend viewers starts talking,
including the game commands, so you can see how things look when it's noisy. *Send a burst*
fires eight messages at once — useful for checking that your pet cards and alerts queue up
sensibly instead of piling on top of each other.

**Fire an alert.** A follow, a subscription, a donation or a raid, on demand.

## What it can't show you

The stage is an approximation in one specific way. A web browser paints every embedded frame on
solid white and there is no way to ask for a see-through one, so each overlay is **trimmed to
the part it is actually drawing** and the ones underneath show through the gaps.

In practice that means:

- **Placement, size and readability are accurate.** This is what the page is for.
- **Soft shadows and glows may be trimmed** at the edge of a panel.
- **OBS has no such limitation.** On stream your overlays are genuinely transparent.

If something looks wrong here, check it in OBS before believing it.

## If something goes wrong

**The stage is empty**
Nothing is happening yet. Send a message, switch on demo chat, or fire an alert. Overlays with
nothing to say correctly show nothing at all.

**"The toolkit is not running"**
The black terminal window has been closed. Start the toolkit again and reload the page.

**A pet doesn't appear when I type**
Only viewers who actually have a pet appear. Type `!adopt dog` as that name first.
