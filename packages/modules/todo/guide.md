# To-do list

*A checklist on your stream that you run from your own chat — and, if you want, that everyone
watching can put themselves on.*

## What you need

- [ ] The toolkit running (see [Starting the toolkit](../../../docs/guides/getting-started.md))
- [ ] At least one channel's name typed in

**No account needed.** The list only *reads* chat, so it works with nothing signed in. If you
have signed a platform in, the bot also answers in chat — but the list on screen is the real
answer, so nothing depends on it.

## Add it to OBS

1. Open **http://localhost:8778**, go to **To-do list** and press **Copy** under *Add it to OBS*.
2. In OBS: **Sources** → **+** → **Browser** → name it `To-do` → **OK**.
3. Paste the link. Set **Width** `1920`, **Height** `1080`. Click **OK**.

The panel hides itself while the list is empty, so it never sits on your scene doing nothing.

## Putting things on the list

Two ways, and they are the same list — whichever you use, the other updates itself.

**From the setup page.** Type a task, press **Add**. Each row has a tick, arrows to move it up
and down, and an ✕ to take it off. Click the words to reword them.

**From your own chat**, while you play:

| You type | What happens |
|---|---|
| `!task add tidy the desk` | Puts it at the bottom of the list |
| `!task tidy the desk` | The same thing — the word *add* is optional |
| `!task done 2` | Ticks task 2 |
| `!task undone 2` | Unticks it again |
| `!task move 3 1` | Makes task 3 the first one |
| `!task edit 2 the new wording` | Rewords task 2 |
| `!task remove 2` | Takes task 2 off |
| `!task clear done` | Clears the ticked ones (`clear all`, `clear chat`) |
| `!task chat on` | Lets viewers add their own (`off` stops it) |
| `!tasks` | Reads the list back — anyone can use this one |

**The numbers are the ones on screen.** Task 2 is whatever is on the second line right now, so
you never have to remember an id — you read it off your own overlay. Taking one off or moving
one renumbers the rest, exactly as you see it happen.

**Only you can run these.** The toolkit goes by the channel-owner badge the platform itself
puts on your messages, so there is nothing to set up and nobody else — not even a moderator —
can run your list.

## Letting chat join in

On the setup page, switch on **Viewers can add their own task**. Then anyone watching can type:

| They type | What happens |
|---|---|
| `!create beating the final boss` | Their task joins the list, shown with their name |
| `!create something else` | Replaces the one they had — everyone gets **one** |
| `!done` | Ticks it, everyone sees it, and it disappears a few seconds later |

Their platform's colour and icon sit next to their name, so chat can see at a glance who is
doing what. Switch it off again and the commands stop working immediately; anything already on
the list stays until you clear it with **Remove all viewer tasks**.

## Change how it looks

1. Open **http://127.0.0.1:8778/settings/?overlay=todo.list** (or press *Change how it looks*).
2. **Position** puts the panel anywhere on the screen and sets how wide it is.
3. **Size** covers the text size, the spacing and how many tasks show at once — the rest become
   a quiet "+3 more".
4. **Look** is the background, the colours, the corners and the edge that keeps the text
   readable over video.
5. **What it shows** is the heading, the numbers, whether ticked tasks stay up, whether they
   get crossed out, and whether viewer names show.
6. Click **Copy URL**, then in OBS double-click your source and paste the new URL over the old.

> **Tip:** turn on **Preview mode** to style it against a pretend list, without being live.

## Where the list is kept

In `config/todo/tasks.local.config`, which you can open in any text editor if you want to write
a long list out in one go. It looks like this, and the simplest form is just lines:

```json
{
  "chatCanAdd": false,
  "tasks": [
    "stream for two hours",
    { "text": "finish the level", "done": true }
  ]
}
```

Save it and the overlay updates straight away — the toolkit is watching the file, so there is
nothing to restart. If you make a mess of it, the toolkit keeps whatever is already on screen
rather than clearing your stream.

## If something goes wrong

**I typed `!task add` and nothing happened**
The toolkit only recognises you by your channel-owner badge. Make sure you are typing in *your
own* channel's chat, on a platform the toolkit is connected to (a green dot on the setup page).
To try it without going live, open **Rehearsal**, tick **Send it as you, the streamer**, and
type the command there.

**A viewer's `!create` does nothing**
The switch is off. Turn on **Viewers can add their own task** on the To-do list page.

**The panel is not on my stream**
It hides when the list is empty — add a task and it appears. If it is still blank, check the
Browser Source URL matches the one on the setup page, and that the toolkit is running.
