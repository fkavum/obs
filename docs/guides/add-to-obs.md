# Add to OBS

*One button puts an overlay into OBS for you. No creating sources, no pasting links, no typing sizes.*

## What you need

- [ ] The toolkit running. The setup page opens at **http://localhost:8778**.
- [ ] OBS open.
- [ ] The **OBS connection** switched on (below). You only do this once.

## Set it up (once)

1. In OBS, click **Tools** → **WebSocket Server Settings**.
2. Tick **Enable WebSocket server**.
3. If **Enable Authentication** is ticked, press **Show Connect Info** and copy the password.
4. Click **OK** in OBS.
5. On **http://localhost:8778**, scroll to **OBS connection**.
6. Paste the password into the **Password** box. If authentication wasn't ticked, leave it empty.
7. Switch on **Connect to OBS**.
8. Press **Test the connection**. It should say *Works*.

## Use it

1. In OBS, click the scene you want the overlay in.
2. On the toolkit's page, press **Add to OBS** next to that overlay.
3. A short message at the bottom of the page says what happened, for example
   *Added "Chat overlay" to the scene "Gaming"*.

**Changed the look?** Press **Add to OBS** again on the style page. The overlay that's
already in OBS changes to match. You don't get a second copy.

**Want it in another scene too?** Click that scene in OBS and press **Add to OBS** again.
It's the same source in both scenes, so changing its look changes it everywhere.

> **Good to know:**
> - **It only touches overlays from this toolkit.** If you already have a source called
>   *Alerts* from another service, it's left alone and the new one is called *Alerts 2*.
> - **An overlay you added by hand is found**, whatever you named it, and updated rather
>   than duplicated.
> - The **Setup** page and feature pages never reset a look you chose. There, the button only
>   adds the overlay if it's missing. To change a look, use the overlay's style page.
> - **Stream health** has no button: it belongs in an OBS dock, for your eyes only, and OBS
>   doesn't let other programs create docks. Use its **Copy** button and see
>   [Stream health](stream-health.md).
> - Using **Studio Mode**? The overlay goes into the scene on the left (the preview), not the
>   one that's live.

## If something goes wrong

**"Connect the toolkit to OBS first" or "OBS isn't reachable"**
Check that OBS is open, then go through *Set it up* above. Press **Test the connection**. It
says in plain words what's wrong.

**"OBS has 2 sources showing this overlay"**
You have the same overlay twice, for example with two different looks. The toolkit won't
guess which one you meant. Press **Copy** instead, then in OBS double-click the source you
want to change and paste the link into its **URL** box.

**The overlay is in OBS but looks smaller than expected**
Your OBS canvas is smaller than the overlay (for example 1280 × 720), so it was shrunk to fit.
That's normal, and it looks the same on stream. To place it yourself, drag its corners in OBS.
