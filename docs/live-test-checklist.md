# Live-test checklist

The check that has to pass before anything moves from `dev` to `main` (see
[`introduction.md`](../introduction.md) §5). Run it top to bottom on a real stream. Tick what
works. Anything that doesn't gets one line in **What went wrong**, in plain words. That line
becomes the first-contact fix.

**Allow about an hour.** Twenty minutes off air, thirty live, ten after. You'll need a second
account on each platform (or a friend in chat), because a channel can't follow itself or send
itself a tip.

> **Tip:** an unlisted YouTube stream, or a Twitch stream with a "testing, not really live"
> title, is fine. What matters is that the platforms are real, not that anyone is watching.

---

## A. Off air (about 20 min)

### A1. Safety copy
- [ ] Make a copy of the whole `config` folder somewhere safe (the desktop is fine). If
      anything below corrupts coins, pets or settings, that copy is the way back.

### A2. The toolkit starts
- [ ] Double-click `start.command` (Mac) or `start.bat` (Windows). The setup page opens.
- [ ] Every platform you use shows a dot and a plain-words status, with no error codes.

### A3. Sign in: the untested part
Chat already works without signing in. These unlock everything else.
- [ ] **Twitch:** press **Connect**, enter the code at twitch.tv/activate, come back. It says signed in.
      (Signed in to Twitch before? Sign in **again**: the bot needs the newer *send
      messages* permission.)
- [ ] **Kick:** press **Connect** and log in. It says signed in.
- [ ] **YouTube:** still signed in from before (chat proven). If not, connect it.
- [ ] Write down today's date in **Results** (below). The token-refresh clock starts now.

### A4. OBS connection
- [ ] OBS open. On the setup page, **OBS connection** → **Connect to OBS** on → **Test the
      connection** says *Works — OBS 30.x*.

### A5. Add to OBS: never run against real OBS yet
Make a new empty scene called `Toolkit test` in OBS and click it.
- [ ] Setup page → **Add to OBS** next to **Chat overlay**. A message says it was added, and
      it appears in `Toolkit test` at 400 × 1080 on the left.
- [ ] Press it again. The message says it's *already in OBS*. There's no second copy.
- [ ] Open **Chat overlay style**, change **Text size**, press **Add to OBS**. OBS changes to
      the new size within a second or two.
- [ ] Add **Alerts**, **Stats bar** and **Timer** the same way. Each lands at the right size.
- [ ] Game Center page: add **Chat games**, **Shop board**, **Pet & profile cards**,
      **Wandering pets**. To-do page: add **To-do list**.
- [ ] If you already had a source from another service with the same name (e.g. `Alerts`),
      it is untouched and the toolkit's one is called `Alerts 2`.
- [ ] Switch **Connect to OBS** off and press **Add to OBS**. A plain message explains what to
      do. Switch it back on.

### A6. Rehearsal room
- [ ] Open **Rehearsal**. Type a chat line. It shows on the chat overlay in OBS, the same line
      you typed.
- [ ] Commands page: **Answer commands** on. In the rehearsal room, type `!socials`. The
      answer shows as **Bot** on the overlays.

---

## B. Live (about 30 min)

Go live on all three platforms, with the `Toolkit test` scene visible.

### B1. Chat (already proven, so this is a regression check only)
- [ ] One message from each platform shows on the chat overlay, tinted and badged correctly.

### B2. Alerts: the biggest unknown
From your second account:
- [ ] **Twitch follow** → one alert, correct name.
- [ ] **Kick follow** → one alert, same look as Twitch.
- [ ] **YouTube Super Chat** (smallest amount) → a tip alert with the amount.
- [ ] **YouTube membership**, if you can → a sub alert.
- [ ] Two events close together → they queue, one after the other, never overlapping.
- [ ] The alert sound plays on the stream (check the VOD afterwards).

### B3. Stats bar
- [ ] Viewer count shows a number per platform and a combined total, and they roughly match
      what each platform's dashboard says.
- [ ] Time live counts up from when you went live.
- [ ] The follow from B2 is counted in this stream's follows.

### B4. Stream health
- [ ] Put the health link in a dock (**View → Docks → Custom Browser Docks**). It shows real
      dropped frames and bitrate while live.
- [ ] Not on the stream: check the VOD. It must not appear.

### B5. Chat commands (sending has never run)
- [ ] In **Twitch** chat, type `!socials` → the bot answers in Twitch chat.
- [ ] Same in **Kick** and **YouTube** chat → it answers on each (or, for a platform that
      can't send, shows as **Bot** on the overlay rather than vanishing).
- [ ] An auto-message posts on its own at its interval.

### B6. Timer
- [ ] Start a 1:00 countdown from the setup page. It shows on stream and reaches zero.
- [ ] Refresh the timer source in OBS mid-countdown. It picks up where it was.

### B7. Game Center (never had a live audience)
Your second account (and anyone else around) plays:
- [ ] **Start Chat Race** → `!race` from two platforms → runners race, and winners get coins.
- [ ] **Start Raid Boss** → `!attack` a few times → it dies or times out, and coins are paid.
- [ ] **Start Heist** → `!heist 50` → survivors double, the caught lose their stake.
- [ ] `!coins` and `!top` answer correctly.
- [ ] `!adopt dog`, `!name Biscuit`, `!feed`, `!pet` → the pet card shows on stream.
- [ ] `!shop` lists the shelves. `!shop hat` opens one on the shop board.
- [ ] The second account chats, and its pet wanders along the bottom.
- [ ] **Quiet mode** (on by default): ordinary chatter does *not* flood the stream with cards.

### B8. To-do list
- [ ] In your own chat, `!task add test the list` → it appears on stream as **1**.
- [ ] `!task done 1` → ticked. `!task clear done` → gone.
- [ ] The second account types `!task add hack` → nothing happens (only you can run the list).
- [ ] To-do page: switch on the option that lets **chat keep one task each** → the second account types
      `!create testing` → it appears with their name. `!done` → it clears itself.

### B9. Nothing broke the stream
- [ ] At no point did OBS freeze, stutter or show an error box on stream.

---

## C. After (about 10 min)

- [ ] Stop the stream. Restart the toolkit. Coins, pets, the timer setup and your looks all
      come back as they were.
- [ ] `git status`: note which files changed just from streaming (expected today:
      `profiles.local.config`, `tasks.local.config`). This is the viewer-data problem in
      [`product-review.md`](product-review.md) §3.3. Don't commit viewer data along with a fix.
- [ ] Fill in **Results** below, and update the ✅/🟨 markers in [`roadmap.md`](roadmap.md).

### Token-refresh clock (hard constraint A)
Don't sign in again, don't press Connect, don't restart anything on purpose. Just check:
- [ ] Day 2: all platforms still signed in.
- [ ] Day 7: still signed in. YouTube is the one to watch: an app left in *Testing* drops
      its login right about now.
- [ ] Day 14: still signed in. Only now is "log in once, ever" proven.

---

## What moves to `main`, and when

Merge in batches, lowest risk first. Each batch needs its sections ticked on one stream, then
one more stream on `main` without incident.

| Batch | Contains | Needs |
|---|---|---|
| 1 | Timer, stats bar, stream health, rehearsal room, Add to OBS | A4–A6, B3, B4, B6, B9 |
| 2 | Alerts, chat commands | A3, B2, B5 |
| 3 | Game Center, to-do list | B7, B8, and section C with no lost coins or pets |

---

## Results

One row per run. Keep old rows. They're the history of what first contact broke.

| Date | Sections passed | What went wrong | Fixed in |
|---|---|---|---|
| | | | |
