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

## Setting your channels once, for good

Open **`config/initial.config.json`** in the project folder with any text editor. It looks like:

```
"twitch":  { "channel": "s0mcs",    "enabled": true },
"kick":    { "channel": "4head",    "enabled": true },
"youtube": { "channel": "NFLonCBS", "enabled": true },
```

Change the names to your own channels and save. Next time you start the toolkit it uses
them. Anything you later change on the setup page wins over this file; to go back to the
file's values, press **Disconnect** on that channel.

**`refreshSeconds`** (YouTube only) is how often it checks for new chat — **10** by default.
Twitch and Kick don't need one: they push messages the instant they're sent. YouTube has to
be asked, and every ask spends a little of a free daily allowance, so:

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

If you see neither, it's running at exactly your setting.

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
