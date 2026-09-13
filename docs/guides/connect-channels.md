# Connecting Twitch, Kick and YouTube

*Links your channels so their chat shows up in your overlay. You do this once per platform.*

## What you need

- [ ] The toolkit running (see [Starting the toolkit](getting-started.md))
- [ ] Being logged in to the channel you want to connect

---

## Twitch — the quick way

1. On **http://localhost:8778**, find the Twitch box.
2. Type your channel name.
3. Press **Sign in with Twitch**.
4. A short code appears, like `WXYZ-1234`. Press **Open the page**, and type the code there.
5. The toolkit notices by itself and the dot turns green.

That's it. No developer page, no secret, no Redirect URL.

> If it says *"No application set up yet"*, open **Use your own Twitch application** below the
> button and follow the four steps there. You need the **Client ID** only — there is no secret.

---

## Kick and YouTube — the developer page way

These two don't offer the quick sign-in, so you create a small "application" once so the
platform knows which program is asking. It sounds technical; it's four boxes and a button,
and the toolkit gives you the exact values to paste.

In the platform's box on the setup page:

1. Click the developer page link — it opens the right page.
2. Create an application. Call it anything, e.g. "My overlay".
3. When it asks for a **Redirect URL**, press **Copy the Redirect URL** in the toolkit and
   paste it in. It has to match *exactly* — no extra slash, no `https`.
4. Copy the **ID** and **Secret** back into the toolkit, press **Save**, then press **Connect**.

A tab opens, you log in, and it closes itself.

**Kick** — the developer settings are in your Kick account settings. Type your channel name
exactly as it appears in your Kick address (the part after `kick.com/`).

**YouTube** — create the app in Google Cloud Console under *Credentials* → *OAuth client ID*
→ *Web application*, and enable the **YouTube Data API v3** for the project. Google warns that
the app is unverified, which is expected for something only you use — click *Advanced* →
*Go to (your app)*.

---

## Why the three are different

Not out of inconsistency — each platform allows something different:

- **Twitch** permits a "public" sign-in that needs no secret, so the toolkit can ship one
  built in and you just press a button.
- **Kick** requires a secret for every login. A secret can't be shipped inside an app that
  runs on your computer — anyone could read it — so you make your own.
- **YouTube** *could* work like Twitch, but Google counts chat usage **per application, not
  per person**. If everyone shared one built-in app, you'd all be sharing one daily allowance
  and would run out faster. Your own app means your own allowance.

You can always use your own application on any platform, including Twitch, if you'd rather.

> **About YouTube's allowance:** Google limits how often the toolkit may fetch new chat
> messages each day. The toolkit spreads this across the day by itself and shows how much is
> left next to the YouTube dot. If it runs out, YouTube chat pauses and returns the next day;
> everything else keeps working. Streaming most of the day, every day, is where you'd notice.

---

## Turning a channel off

Flip **Use this channel** off. Nothing is deleted, and flipping it back on reconnects.
**Disconnect** is the stronger one — it forgets your login and you'd have to sign in again.

## If something goes wrong

**The code ran out before I typed it in**
Codes last about 15 minutes. Press **Sign in** again for a fresh one.

**"This login link has expired"** (Kick or YouTube)
More than ten minutes passed between pressing Connect and logging in. Press Connect again.

**The login page says the redirect URL doesn't match** (Kick or YouTube)
The Redirect URL on the platform isn't character-for-character what the toolkit shows. Use the
**Copy the Redirect URL** button instead of typing it, and check for a trailing slash.

**The dot is orange and says "Connecting…"**
Give it thirty seconds. If it stays orange, check your channel name is spelled exactly right —
that's the most common cause.

**Kick says it blocked the lookup**
Kick sometimes refuses automated requests for a few minutes. It reconnects by itself.

**The dot says "Needs you to log in"**
Sign in again. If it keeps happening, press **Disconnect** first, then set it up again.
