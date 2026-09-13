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
overlays off. To stop the toolkit on purpose, click the window and press `Ctrl` + `C`
(`Control` + `C` on a Mac).

> **Windows only:** after `Ctrl` + `C` it asks *"Terminate batch job (Y/N)?"* — press `Y`.

## Setting your channels once, for good

Open **`config/app.config.json`** in the project folder with any text editor. It looks like:

```
"twitch":  { "channel": "s0mcs",    "enabled": true },
"kick":    { "channel": "4head",    "enabled": true },
"youtube": { "channel": "NFLonCBS", "enabled": true },
```

Change the names to your own channels and save. Next time you start the toolkit it uses
them. Anything you later change on the setup page wins over this file; to go back to the
file's values, press **Disconnect** on that channel.

## Open the toolkit page

Go to **http://localhost:8778** in your browser. You'll see:

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
