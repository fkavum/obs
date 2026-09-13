# Unified chat overlay

Merged chat from every connected platform, in one OBS Browser Source.

- **Vertical** layout ships first; **horizontal** is the same overlay with `layout=horizontal`.
- Every visual option is a URL query parameter, written for you by the settings screen.
- Platform colors and icons come from `GET /api/platforms` — never hardcoded here, so a new
  adapter shows up correctly with no edits to this overlay.

Full option list and layout diagrams: [`../../../docs/overlay-chat.md`](../../../docs/overlay-chat.md)

Styling without going live: append `?preview=on`.
