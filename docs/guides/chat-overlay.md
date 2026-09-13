# Chat overlay

*Puts chat from Twitch, Kick and YouTube together in one box on your stream.*

## What you need

- [ ] The toolkit running (see [Starting the toolkit](getting-started.md))
- [ ] At least one channel connected, **or** Demo chat switched on

## Add it to OBS

1. Open **http://localhost:8778** and press **Copy** next to the chat overlay link.
2. In OBS, under **Sources**, click **+**.
3. Choose **Browser**.
4. Type a name like `Chat`, then click **OK**.
5. Delete whatever is in the **URL** box and paste your link.
6. Set **Width** to `400` and **Height** to `1080`.
7. Click **OK**.

Chat now appears in your scene. Drag it where you want it.

> **Tip:** OBS remembers the size you typed, not the size you drag it to. If the text looks
> blurry, set Width and Height properly instead of stretching the box.

## Change how it looks

1. Open **http://localhost:8778/settings/**.
2. Change anything on the left; the preview on the right updates as you go.
   - **Quick looks** along the top are one-click styles. Start there.
   - **Layout** — which side of the screen, and whether new messages come in at the top or bottom.
   - **Size & spacing** — *Overall size* is the one to use if chat looks too small on stream.
   - **Message background** — how see-through each message is, and whether each message is
     tinted by the platform it came from. You can set a custom colour per platform here.
   - **Border** — *Accent left* puts a coloured bar down the side of each message, which is
     the easiest way to tell platforms apart at a glance.
   - **Platform display** — turn the little Twitch/Kick/YouTube icons on or off and change their style.
   - **Behaviour** — hide `!commands`, hide bots, or make messages disappear after a while.
3. Press **Copy link for OBS**.
4. In OBS, double-click your `Chat` source, delete the old link, paste the new one, click **OK**.

> **Tip:** leave **Use fake messages in this preview** switched on while you're styling, so
> you can see what it looks like without being live.

## Useful things people miss

- **Two chats at once.** Add the overlay twice with different links — for example a Twitch-only
  one and a merged one. Under *Platform display* → *Show only these platforms*.
- **Hiding bot spam.** *Behaviour* → *Hide these bots*. Common ones are already in there.
- **Messages that clear themselves.** *Behaviour* → *Hide messages after*. Good for busy scenes.

## If something goes wrong

**The box is empty**
Nothing is sending chat yet. Open the Setup page: every channel should have a green dot.
For a quick check, switch on **Demo chat** — if fake messages appear, the overlay is fine and
the problem is the channel connection.

**It's there but I can't see it over my game**
The source may be underneath another one. In OBS, drag `Chat` to the top of the Sources list.

**Text is too small on stream**
Settings → **Size & spacing** → **Overall size**. Drag it up, copy the new link, paste it into OBS.

**It went blank in the middle of my stream**
The toolkit stopped. Check the black window is still open. The overlay reconnects by itself
within a few seconds of it coming back — you don't need to touch OBS.
