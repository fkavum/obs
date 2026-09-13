# bridge

The local service. Connects to Twitch / YouTube / Kick, normalizes events, broadcasts them
on a WebSocket, and controls OBS via obs-websocket v5.

Holds all credentials — overlays never see a token.

Planned layout:

```
src/
  adapters/      twitch.js, youtube.js, kick.js, fake.js
  normalize/     platform payload -> common event schema
  server/        websocket broadcast + static overlay hosting
  obs/           obs-websocket v5 client, scene/source actions
  rules/         event -> OBS action rules engine
```

Build the `fake` adapter early: it replays scripted events so overlays can be developed
without going live.
