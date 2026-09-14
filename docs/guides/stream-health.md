# Stream health

*Tells you — and only you — when your stream is in trouble: dropped frames, an overloaded
encoder, a struggling graphics card. It watches OBS; it never changes anything.*

> **This one is for your eyes only.** Don't put it in a scene you broadcast. See
> *Where to put it* below.

## What you need

- [ ] The toolkit running (see [Starting the toolkit](getting-started.md))
- [ ] OBS's WebSocket server switched on (four clicks, below)

## Connect it to OBS

1. In OBS: **Tools** → **WebSocket Server Settings**.
2. Tick **Enable WebSocket server**.
3. If **Enable Authentication** is ticked, press **Show Connect Info**, copy the **Server
   Password**, and paste it into the OBS box on **http://localhost:8778**. If authentication
   is off, leave the password box empty.
4. Click **OK** in OBS, then press **Test the connection** on the setup page. It should say
   *Works — OBS 30.x*.
5. Switch **Watch OBS** on.

## Where to put it

**Best: as a panel inside OBS.** In OBS, **View** → **Docks** → **Custom Browser Docks**.
Give it a name like `Health`, paste the link from the setup page, click **Apply**. It appears
as a dockable panel you can drag anywhere in the OBS window. Only you ever see it.

**Also fine:** open the link in a normal browser window on your second monitor.

**Don't:** add it as a Browser *Source* in a scene you stream — your viewers would see it.

## What it tells you

A coloured dot and a sentence: **All good**, **Something to watch**, or **Problem on stream**.
When something's wrong it names it and says what to do:

| It says | What it means | What to do |
|---|---|---|
| **Losing frames** | Your upload can't keep up | Lower the bitrate in OBS, or stop other uploads on your network |
| **Encoder overloaded** | Your computer can't encode fast enough | Lower the output resolution, drop to 30fps, or use a faster encoder preset |
| **Graphics lagging** | Your GPU is overloaded | Lower the game's settings or OBS's canvas resolution |
| **Network congested** | The connection to the platform is backing up | Lower your bitrate |
| **CPU at 95%** | Something is eating the processor | Close other programs |
| **Reconnecting** | The connection dropped | OBS is trying to get back on by itself |

Underneath: your current **bitrate**, **fps**, **dropped %** and **CPU**, which turn yellow
and red as they get worse.

> **The numbers are about *now*, not the whole stream.** If you lost frames an hour ago and
> nothing since, this says you're fine — because you are. OBS's own stats panel shows lifetime
> totals, which is why it can look alarming long after the problem passed.

## Change it

**http://localhost:8778/settings/?overlay=health**

- **Show** — always, or **only when something is wrong** (the *Quiet* and *Compact* looks do
  this: the panel disappears entirely while everything is fine).
- **When to warn** — the percentages at which each problem counts as a warning or an alarm.
  The defaults warn at 1% and alarm at 5%.
- **Layout / Look** — size, colours, stacked or in a row.

Turn on **Use made-up numbers in this preview** to see every warning state without streaming.

## If something goes wrong

**"Could not reach OBS"**
OBS isn't running, or its WebSocket server isn't enabled. Check **Tools → WebSocket Server
Settings** and that the address matches (default `ws://127.0.0.1:4455`).

**"That OBS WebSocket password is wrong"**
Press **Show Connect Info** in OBS and copy the password again. The toolkit stops retrying
after a wrong password, so fix it and press **Test the connection**.

**The panel is empty**
If **Show** is set to *only when something is wrong*, an empty panel means nothing is wrong.
Set it to *always* if you'd rather see it all the time.

**It says "Not streaming"**
It's connected to OBS but you haven't started streaming. Frame and bitrate figures only exist
once the stream is running.
