# Starting the toolkit

*Turns on the toolkit so your overlays work. You do this every time you stream.*

## What you need

- [ ] The project folder on your computer
- [ ] [Node.js](https://nodejs.org/) installed (get the big green "LTS" button)
- [ ] OBS Studio installed

## Start it

1. Double-click **`start.command`** in the project folder.
2. A black window opens and stays open. That's the toolkit running — leave it alone.
3. Your browser opens the setup page by itself the first time.

> If double-clicking does nothing, open the Terminal app, type `cd `, drag the project
> folder onto the window, press Enter, then type `npm start` and press Enter.

That black window **has to stay open the whole time you stream**. Closing it turns the
overlays off. To stop the toolkit on purpose, click the window and press `Control` + `C`.

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
Something crashed. Open it again; if it closes immediately, the message it prints says why.

**"Port 8778 is already in use"**
The toolkit is already running in another window. Use that one, or close it and start again.

**The browser says it can't connect**
The toolkit isn't running. Start it again and wait about five seconds.
