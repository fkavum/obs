# Connecting Twitch, Kick and YouTube

*Links your channels so their chat shows up in your overlay. You do this once.*

Each platform makes you create a small "application" so it knows which program is asking.
It sounds technical; it's four boxes and a button. The toolkit gives you the exact values
to paste.

## What you need

- [ ] The toolkit running (see [Starting the toolkit](getting-started.md))
- [ ] Being logged in to the channel you want to connect

## The same four steps for every platform

On **http://localhost:8778**, find the platform's box and follow the numbered steps in it.
They always work the same way:

1. Click the developer page link — it opens the right page on that platform.
2. Create an application. Call it anything, e.g. "My overlay".
3. When it asks for a **Redirect URL**, press **Copy the Redirect URL** in the toolkit and
   paste it in. It has to match *exactly* — no extra slash, no `https`.
4. Copy the **ID** and **Secret** it gives you back into the toolkit, press **Save**, then
   press **Connect**.

A tab opens, you log in, it says connected, and it closes itself. The dot next to the
platform turns green.

> You only do this once per platform. The toolkit keeps you logged in from then on and
> renews it in the background — you should never have to do it again.

## Platform notes

**Twitch** — Create the app at the Twitch developer console. Choose category *Chat Bot*.
You get chat, plus follows, subs, cheers and raids.

**Kick** — Create the app in Kick's developer settings. Type your channel name exactly as it
appears in your Kick address (the part after `kick.com/`).

**YouTube** — Create the app in Google Cloud Console, under *Credentials* → *OAuth client ID*
→ *Web application*. You also have to enable the **YouTube Data API v3** for the project.
Google will warn that the app is unverified; that's expected for something only you use —
click through *Advanced* → *Go to (your app)*.

> **About YouTube:** Google limits how often the toolkit is allowed to ask for new chat
> messages each day. The toolkit spreads this out over the day by itself and shows how much
> is left next to the YouTube dot. If it ever runs out, YouTube chat pauses and comes back
> the next day — everything else keeps working. Streaming most of the day, every day, is
> where you'd notice.

## Turning a channel off

Flip **Use this channel** off. Nothing is deleted, and flipping it back on reconnects.
**Disconnect** is the stronger one — it forgets your login and you'd have to log in again.

## If something goes wrong

**"This login link has expired"**
You took more than ten minutes between pressing Connect and logging in. Press Connect again.

**The login page says the redirect URL doesn't match**
The Redirect URL on the platform isn't character-for-character what the toolkit shows.
Use the **Copy the Redirect URL** button rather than typing it, and check you didn't add a
trailing slash.

**The dot is orange and says "Connecting…"**
Give it about thirty seconds. If it stays orange, check your channel name is spelled exactly
right — it's the most common cause.

**Kick says it blocked the lookup**
Kick sometimes refuses automated requests for a few minutes. Wait and it reconnects by itself.

**The dot says "Needs you to log in"**
Press **Connect** again. If that keeps happening, press **Disconnect** first, then set it up again.
