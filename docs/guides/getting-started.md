# Starting the toolkit

*Turns on the toolkit so your overlays work. You do this every time you stream.*

## What you need

- [ ] The project folder on your computer
- [ ] [Node.js](https://nodejs.org/) installed (get the big green "LTS" button)
- [ ] OBS Studio installed

## Start it

**On Windows:** double-click **`start.bat`**.

**On a Mac:** double-click **`start.command`**.

Either way a black window opens and stays open — that's the toolkit running. Leave it alone.
Your browser opens the setup page by itself the first time.

> **Mac:** if double-clicking does nothing, open the Terminal app, type `cd `, drag the
> project folder onto the window, press Enter, then type `npm start` and press Enter.
>
> **Windows:** if the window flashes and disappears, open the folder, click the address bar,
> type `cmd` and press Enter, then type `npm start` and press Enter. The message that was
> flashing past will now stay on screen.

That black window **has to stay open the whole time you stream**. Closing it turns the
overlays off.

**To stop the toolkit**, press **Stop the toolkit** at the bottom of the setup page, or
simply close the black window. (`Ctrl` + `C` in the window works too. On Windows it then asks
*"Terminate batch job (Y/N)?"* and closes when you press `Y` — that's normal, not a crash.)

## Your settings file

The first time you start the toolkit it creates **`config/config.local.json`** by copying
everything out of **`config/initial.config.json`**. From then on the `.local` one is the real
file — every change you make on the setup pages, and every login, is saved there.

```
config/
  initial.config.json        the starting point. Safe to edit; it is only a seed.
  config.local.json          the master file: accounts, logins, ports.

  commands/
    commands.initial.config        the example commands — never changed by the toolkit
    commands.local.config          yours, copied from the examples. This is what you edit.
    auto-messages.initial.config   same idea for auto-messages
    auto-messages.local.config
    gaming.local.config            a command set you saved

  chat/                      one folder per feature
    neon.initial.config        a look that comes with the toolkit — editable
    my-look.local.config       one you saved yourself
  alerts/   stats/   health/   timer/
```

The master file names all of it, so you can move things if you want:

```json
"presets": { "chat": "chat", "commands": "commands", ... },
"files":   { "commands": "commands/commands", "timer": "timer/timer", ... }
```

**`.initial.config` never changes; `.local.config` is yours.** The first time the toolkit
needs your commands it copies the examples into `commands.local.config` and edits only that
from then on — so you can rewrite every starter command without losing the examples. Press
**Restore the examples** on the commands page, or just delete the `.local.config` file, and
they come back.

Open `config/initial.config.json` in any text editor to change what a *fresh* install starts
with — channel names, the starting chat commands, timer defaults:

```
"twitch":  { "channel": "s0mcs",    "enabled": true },
"kick":    { "channel": "4head",    "enabled": true },
"youtube": { "channel": "NFLonCBS", "enabled": true, "refreshSeconds": 10 },
```

Two rules that make this safe:

- Editing the seed **never overwrites** something you've already changed. Your working file wins.
- But a setting the seed has and your working file **doesn't** gets added — so when the toolkit
  gains a new feature, its defaults appear without disturbing anything.

**To start completely over**, delete `config.local.json` and start the toolkit again.

> **`config.local.json` holds your logins.** Don't share it, and don't put it in a public
> repository — it's already excluded from git for you.

**`refreshSeconds`** (YouTube only) is how often it checks for new chat — **10** by default.
Twitch and Kick push messages instantly and need no setting. YouTube has to be asked, and
every ask spends a little of a free daily allowance:

| refreshSeconds | Feels like | Full speed for about |
|---|---|---|
| 5 | live | 2 hours of busy chat, then it eases off |
| **10** (default) | a short beat behind | 4 hours |
| 20 | noticeably delayed | 8 hours |

**The number you set is the number you get.** Only two things can make it slower, and the
setup page tells you which one is happening, next to the YouTube dot:

- *(YouTube's minimum)* — YouTube itself sets a shortest allowed wait, which it raises when
  chat is quiet. The toolkit can't go faster than that.
- *(saving quota)* — once about a quarter of the day's free allowance is left, it stretches
  what remains over the hours until reset, so chat slows down instead of stopping.

## Saving your own looks

Every style page has a row of **Quick looks**, and next to them a **Yours** section. Set
something up the way you like it, press **+ Save this look**, give it a name, and it becomes a
button you can press any time. Press the **×** on one to delete it.

The commands page has the same as **Saved sets** — keep one set of commands for gaming nights
and another for chatting streams, and switch between them.

Each one is its own small file in that feature's folder, so you can read and edit them by hand:

```json
// config/chat/my-look.local.config
{
  "name": "My look",
  "settings": { "layout": "horizontal", "scale": "120" }
}
```

**The Quick looks are files too.** `config/chat/neon.initial.config` is the Neon look — change
a colour in it, restart the toolkit, and Neon is your version from then on. The toolkit only
writes those files if they're missing, so your edits are never overwritten. Delete one and it
comes back as shipped, which is how you undo.

Your own presets (`.local.config`) and the shipped ones (`.initial.config`) are separate files
even when they share a name, so saving yours can never destroy a built-in.

## Open the toolkit page

Go to **http://localhost:8778** in your browser. If that sits on "loading" (it can on some
Windows PCs), use **http://127.0.0.1:8778** instead — same page. You'll see:

- **Setup** — connect Twitch, Kick and YouTube, and check they're working
- **Chat overlay style** — change how your chat looks

Bookmark that address.

## First time? Try it without going live

On the Setup page, scroll to **Demo chat** and switch on **Send fake chat**. The toolkit
now makes up chat messages, so you can build and style your overlay before connecting any
real account.

Turn it off when you're done, or leave it on — it's harmless.

## If something goes wrong

**The black window closed on its own**
Something crashed. Open it again; the window now stays open on Windows so you can read the
message. On a Mac, start it from Terminal as described above to see it.

**Windows says it can't find `node`**
Node.js isn't installed, or the computer hasn't picked it up yet. Install it from
[nodejs.org](https://nodejs.org/), then **restart the computer** and try again.

**"Port 8778 is already in use"**
The toolkit is already running in another window. Use that one, or close it and start again.

**The browser says it can't connect**
The toolkit isn't running. Start it again and wait about five seconds.

**The page just spins on "loading" (Windows)**
Use **http://127.0.0.1:8778** instead of `localhost`. Newer versions of the toolkit listen on
both, so if you still see this, update.

**I fixed a channel name but nothing changed**
Update the toolkit: changing a name on the setup page now applies straight away. On older
versions, switch the channel off and on again.
