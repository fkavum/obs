# Chat commands

*Viewers type `!socials` and the bot answers — on Twitch, Kick and YouTube at once. Plus
messages that post themselves on a loop.*

## What you need

- [ ] The toolkit running (see [Starting the toolkit](getting-started.md))
- [ ] **To answer**, at least one channel signed in. Reading commands needs no account, but no
  platform lets an anonymous connection *talk*. See [Connecting your channels](connect-channels.md).

> **Already signed in to Twitch?** Sign in again once. The bot needs permission to send
> messages, which your existing login doesn't include — Twitch grants it at sign-in.

## Set it up

1. Open **http://localhost:8778/commands/**.
2. Switch **Answer commands** on.
3. Five commands are there to start with — `!socials`, `!discord`, `!uptime`, `!hello`,
   `!commands`. Click one to open it and change the answer to your own links.
   (They're copied from `config/commands/commands.initial.config` the first time, into
   `commands.local.config` which is what you edit. Rewrite them freely — press **Restore the
   examples** any time to get the originals back.)
4. Press **Test** on a command to see exactly what it would say.

That's it. Type `!socials` in your own chat and the bot replies.

## Making a command

Click **Add a command**, then fill in:

- **Command** — what people type, like `!discord`. The `!` is added for you.
- **Answer** — what the bot says.
- **Also responds to** — other spellings, e.g. `!links, !social`.
- **Who can use it** — everyone, subscribers, VIPs, moderators, or just you. A moderator
  counts as a subscriber too, so you don't need to list every level.
- **Wait between uses** — how long before *anyone* can use it again (stops one person spamming
  it for the whole chat).
- **Wait per person** — how long before *the same person* can use it again.

### Things you can put in an answer

| | |
|---|---|
| `{user}` | who typed it |
| `{args}` | whatever they typed after the command |
| `{count}` | how many times it's been used |
| `{uptime}` | how long you've been live |
| `{viewers}` | total watching across all platforms |
| `{platform}` | twitch, kick or youtube |
| `{commands}` | the list of your commands |
| `{random: a \| b \| c}` | picks one at random |

So `Hey {user}, you're viewer number {count}!` becomes *"Hey Bob, you're viewer number 42!"*.

## Saved sets

Press **Save this set** to keep the commands and auto-messages you have now under a name.
Load it again any time from the same row — handy if you want a different set for different
kinds of stream. Loading a set replaces what's on screen, so it asks first.

## Auto-messages

Messages the bot posts on a loop — a follow reminder, your Discord link. For each one:

- **Every** — how many minutes between posts.
- **Only if chat said at least** — how many messages chat must have sent since the last one.
  This stops the bot talking to an empty room, which looks worse than saying nothing.

They rotate, so you never get the same one twice in a row. Both start switched **off**.

## Good to know

**It only answers where it was asked.** A `!socials` on Kick gets answered on Kick, not
broadcast to all three. Auto-messages go everywhere you're signed in.

**YouTube replies are expensive.** Google charges 50 quota units per message the bot sends —
ten times what reading chat costs. A chatty bot on YouTube will eat the day's allowance far
faster than the chat it's replying to. Keep auto-messages infrequent there.

**It can't be tricked into running platform commands.** If someone types `!echo /ban someone`,
the bot says "ban someone" as plain text. Anything that would make your account run a command
is stripped before sending.

**It won't talk to itself.** A reply that happens to contain a trigger doesn't set off a loop.

**An answer it can't send still shows on your overlays.** On a channel the bot isn't signed in
to, viewers there won't see the reply in their chat — but it appears on your chat overlay,
credited to **Bot**, so you can see the command worked. This is what makes commands testable in
the [rehearsal room](rehearsal.md) before anything is signed in.

## If something goes wrong

**The bot reads commands but never answers**
Nothing is signed in. The top of the commands page says where it can talk — if it says
"nowhere", sign in on the Setup page. Until then the answers still show on your own chat
overlay as **Bot**; they just don't reach your viewers.

**It answers on Kick but not Twitch**
Sign in to Twitch again. Permission to send messages is granted at sign-in, and a login made
before this feature existed doesn't have it.

**A command does nothing sometimes**
That's a cooldown. Check *Wait between uses* and *Wait per person* on that command — a value
of 0 in both means no waiting.

**Auto-messages never post**
They need chat to be active: check *Only if chat said at least*. Set it to 0 to post
regardless.
