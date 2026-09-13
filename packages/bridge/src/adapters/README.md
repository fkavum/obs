# Adapters

One folder per platform. The bridge scans this directory at boot.

**Add a platform:** drop a folder in. **Remove a platform:** delete the folder, or switch it
off in the settings screen. Nothing else in the codebase needs to change — no core file lists
platform names.

```
<platform-id>/
  manifest.json   id, label, color, icon, auth type, capabilities
  index.js        export function createAdapter({ config, emit, log })
  normalize.js    platform payload -> common event schema
  icon.svg        shipped here so overlays get branding automatically
```

## Contract

```js
export function createAdapter({ config, emit, log }) {
  return {
    async start() {},   // connect; emit(event) per normalized event
    async stop() {},    // clean disconnect
    health() { return { connected: true, detail: 'chat + events' }; },
  };
}
```

Rules:

- **Never throw into the bridge.** Catch everything; report state through `health()`.
- **Reconnect yourself**, with exponential backoff. One dead platform must not affect the
  others or the bridge.
- **Emit normalized events only** — platform-shaped data never leaves this folder. Anything
  platform-unique goes in `data.raw`.
- **Refresh your own tokens** in the background. The operator logs in once, ever.

Schema and full contract: [`../../../../docs/architecture.md`](../../../../docs/architecture.md)

## `fake`

Build this one first. It replays scripted events so overlays can be developed, styled and
demoed without going live — and it's what `preview=on` uses.
