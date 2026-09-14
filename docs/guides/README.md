# Guides

One guide per feature, written for someone who has **never edited a file** and does not know
what a terminal is. If a guide needs a technical word, the guide explains it.

**No feature is done until its guide is written.** Use `_template.md` — the shape is fixed so
every guide feels the same.

| Guide | Covers |
|---|---|
| [Starting the toolkit](getting-started.md) | Turning it on, the setup page, demo chat |
| [Connecting your channels](connect-channels.md) | Twitch, Kick and YouTube logins |
| [Google Cloud App Setup](how-to-add-google-cloud-app.md) | Step-by-step setup for YouTube chat API credentials |
| [Chat overlay](chat-overlay.md) | Adding it to OBS and restyling it |
| [Alerts](alerts.md) | Follow / sub / tip / raid pop-ups, test buttons, sound |

## Writing rules

- **One action per numbered step.** "Click X." not "Click X, then configure Y and Z."
- **Name what they'll see**, not what it's called internally: "the purple *Connect Twitch*
  button", not "the OAuth authorization endpoint".
- **Screenshots for anything visual.** Store them next to the guide in `images/`.
- **No jargon without a plain-words gloss** the first time: "Browser Source (that's OBS's way
  of showing a web page on your stream)".
- **Every guide ends with a troubleshooting section** covering the three most likely failures,
  written as symptom → fix.
- **Keep it to one screen** where possible. A long guide is a design bug in the feature.
