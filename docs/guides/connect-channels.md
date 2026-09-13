# Connecting Twitch, Kick and YouTube

*Links your channels so their chat shows up in your overlay. You do this once per platform.*

## What you need

- [ ] The toolkit running (see [Starting the toolkit](getting-started.md))
- [ ] Being logged in to the channel you want to connect

---

## Twitch and Kick — just type your channel name

1. On **http://localhost:8778**, find the Twitch (or Kick) box.
2. Type your channel name.
3. That's it. Chat starts arriving.

**No account, no login, no developer page.** Reading chat on both of these is public, so the
toolkit simply listens the way any viewer's browser does.

### Signing in (optional)

Signing in to Twitch adds the things that genuinely need permission: **follower, subscriber,
cheer and raid alerts, and viewer counts**. On Kick it adds **viewer counts**. Chat itself
works either way.

To do it: press **Sign in with Twitch (optional)**, and a short code appears like
`WXYZ-1234`. Press **Open the page** and type the code there. The toolkit notices by itself.
No secret, no Redirect URL.

> If it says *"No application set up yet"*, open **Use your own Twitch application** below the
> button and follow the four steps. You need the **Client ID** only — there is no secret.

Kick's sign-in needs the developer-page route below, because Kick requires a secret.

---

## YouTube — the developer page way

YouTube is the one that does need setting up, because Google requires an account even to read
a live chat. See the detailed step-by-step guide at [Google Cloud App Setup](how-to-add-google-cloud-app.md).

1. Click the developer page link in the YouTube box — it opens Google Cloud Console.
2. Create a project, then go to *Credentials* → *OAuth client ID* → *Web application*.
3. Enable the **YouTube Data API v3** for that project.
4. When it asks for a **Redirect URL**, press **Copy the Redirect URL** in the toolkit and
   paste it in. It has to match *exactly* — no extra slash, no `https`.
5. Copy the **ID** and **Secret** back into the toolkit, press **Save**, then press **Connect**.

6. On the **OAuth consent screen** page, set **Publishing status** to **In production** (press
   *Publish app*). Leaving it on *Testing* makes Google forget your login **every 7 days**,
   which means signing in again each week — the whole point is to sign in once.

Google warns that the app is unverified, which is expected for something only you use — click
*Advanced* → *Go to (your app)*.

**It's free.** The YouTube Data API has no price and no billing; you don't add a card. What it
has is a daily allowance (see below).

The same developer-page route is available for Twitch and Kick too, if you'd rather use your
own application on those.

---

## Why the three are different

Not out of inconsistency — each platform allows something different:

- **Twitch and Kick let anyone read chat without an account.** So the toolkit does exactly
  that, and you set nothing up. Signing in is only for alerts and viewer counts, which do
  need permission.
- **Twitch's optional sign-in** uses a code you type on their site, which needs no secret —
  so the toolkit can ship the application built in.
- **Kick's sign-in requires a secret**, and a secret can't be shipped inside an app that runs
  on your computer — anyone could read it out — so you make your own.
- **YouTube needs an account even to read chat**, and Google counts usage **per application,
  not per person**. If everyone shared one built-in app you'd share one daily allowance and
  run out faster. Your own app means your own allowance.

You can always use your own application on any platform if you'd rather.

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

**It says "no Kick channel called …" but that IS my username**
Update the toolkit — newer versions try Kick's alternative spellings (underscore vs hyphen)
automatically. If it still can't find it, open your channel in a browser and paste the whole
address (`https://kick.com/…`) into the channel box instead.

**The dot is orange and says "Connecting…"**
Give it thirty seconds. If it stays orange, check your channel name is spelled right —
that's the most common cause.

**Kick says its bot protection blocked the lookup**
Not something you did. Kick's website sits behind a bot filter that sometimes challenges
programs the way it challenges suspicious visitors — it depends on your connection, not on
how often you asked. The toolkit handles it in this order, all by itself:

1. It asks again through a browser already on your computer (Edge on Windows, Chrome on a
   Mac), which passes the filter because it *is* a browser.
2. If that also fails, it waits 5 minutes and tries again, and keeps doing so. Chat starts by
   itself the moment it gets through — you don't need to touch anything.

It only ever has to get through **once** per channel; after that the answer is remembered.

**Works on one computer but not another on the same Wi-Fi?** The two machines look
different to Kick's filter even though they share a connection. The usual reasons, in order:

- **Something on the PC is inspecting HTTPS** — an antivirus "web shield", parental
  controls, or a work proxy. Kick's filter then sees *that* program, not the toolkit, and
  refuses it. Add an exception for `node.exe` in that software, or switch off its web/HTTPS
  scanning, and try again. Windows PCs with third-party antivirus are the classic case.
- **One machine is using IPv6 and the other IPv4**, so they have different public addresses
  and are scored separately. The toolkit prefers IPv4 by default to avoid this.
- **The Windows copy is out of date.** The message *"Kick blocked the lookup for this
  channel"* (without "bot protection") is from before the fix; update it.

To find out which, run the diagnostic on the machine that fails and send the output:

```
npm run diagnose
```

(Open the project folder, click the address bar, type `cmd`, press Enter, then type that.)
It reports which address it connected over, whether the security certificate came from
Cloudflare or from something on your PC, and whether the browser fallback works.

If it stays blocked for a long time, there is a manual way round: open
`https://kick.com/api/v2/channels/YOUR-CHANNEL` in your own browser, find the number after
`"chatroom":{"id":`, and add it to `config/initial.config.json` like this:
`"kick": { "channel": "yourname", "chatroomId": 1234567, "chatroomFor": "yourname", "enabled": true }`.
Then restart the toolkit.

**The dot says "Needs you to log in"**
Sign in again. If it keeps happening, press **Disconnect** first, then set it up again.
