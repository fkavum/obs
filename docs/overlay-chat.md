# Unified Chat Overlay — design & config spec

The flagship overlay: one merged chat from all connected platforms, fully restylable from the
settings screen. **Vertical layout ships first; horizontal is the same overlay with a
different `layout` value** — one codebase, one settings screen, two arrangements.

---

## Layouts

### Vertical (build first)

A column, typically down one side of the screen. The default and most-used shape.

```
┌──────────────────┐  width  380px (default), height = OBS source height
│ ▎🟣 Ninja        │  ← platform accent border on the left edge
│ ▎ hey chat!      │
│                  │
│ ▎🟢 kickuser     │  ← different platform = different tint/accent
│ ▎ pog            │
│                  │
│ ▎🔴 ytviewer     │
│ ▎ first time here│  ← messages wrap; newest enters at the bottom
└──────────────────┘
```

- Newest message enters at the bottom (default) or top.
- Older messages scroll off; `maxMessages` caps how many are held.
- Anchoring left or right flips icon/accent placement so it always hugs the screen edge.

### Horizontal (build second)

A band across the top or bottom, for streamers who keep the sides clear for gameplay.

```
┌──────────────────────────────────────────────────────────────────┐  height 120px
│ 🟣 Ninja          │ 🟢 kickuser  │ 🔴 ytviewer              │ 🟣 …│
│ hey chat!         │ pog          │ first time here          │     │
└──────────────────────────────────────────────────────────────────┘
   ← newest enters from this side, older cards slide off the far end
```

- Messages are fixed-width cards in a row, not a wrapped paragraph.
- Long messages are clamped to `cardLines` lines with an ellipsis — a horizontal band cannot
  grow, so overflow has to be handled by truncation rather than by scrolling.
- `flow` sets which side new messages enter from.

**Shared between both:** every style option below, the message component, the WebSocket
client, filtering, and animations. Only arrangement and overflow differ.

---

## Configuration

All settings are URL query parameters. The operator never types them — the settings screen
has a control for each one, with a live preview, and a **Copy URL** button.

### Layout

| Key | Values | Default | Notes |
|---|---|---|---|
| `layout` | `vertical` \| `horizontal` | `vertical` | |
| `anchor` | `left` \| `right` (vertical) · `top` \| `bottom` (horizontal) | `left` | Flips accents/icons to hug the screen edge. |
| `flow` | `newest-bottom` \| `newest-top` (vertical) · `newest-left` \| `newest-right` (horizontal) | `newest-bottom` | |
| `cardWidth` | px | `320` | Horizontal only. |
| `cardLines` | 1–6 | `3` | Horizontal only; lines before truncation. |

### Size & spacing

| Key | Values | Default | Notes |
|---|---|---|---|
| `scale` | 50–200 | `100` | Master size multiplier — the one knob to fix "too small on stream". |
| `fontSize` | px | `18` | |
| `font` | font family name | `Inter` | Falls back to a system stack. |
| `gap` | px | `8` | Space between messages. |
| `padding` | px | `10` | Space inside a message. |
| `maxMessages` | 1–100 | `25` | |
| `avatar` | `0` = off, else px | `0` | |

### Message background

| Key | Values | Default | Notes |
|---|---|---|---|
| `msgBg` | `platform` \| `flat` \| `none` | `platform` | **`platform` tints each message by the sender's platform** — purple for Twitch, green for Kick, red for YouTube, from the adapter manifest. |
| `bgOpacity` | 0–100 | `45` | Background transparency. `0` = fully see-through. |
| `bgColor` | hex | `#000000` | Used when `msgBg=flat`. |
| `bgTint` | 0–100 | `35` | How strongly the platform color tints the background in `platform` mode. |
| `bgColor.twitch` etc. | hex | manifest color | Per-platform override; key is built from the adapter id, so a new platform is overridable without a code change. |

### Border

| Key | Values | Default | Notes |
|---|---|---|---|
| `border` | `none` \| `solid` \| `accent-left` \| `accent-top` \| `glow` \| `pill` \| `outline` | `accent-left` | `accent-left` = a colored bar on the edge — cheapest way to read platform at a glance. |
| `borderWidth` | px | `3` | |
| `borderColor` | `platform` \| hex | `platform` | |
| `radius` | px | `10` | Corner rounding. `pill` overrides this. |

### Text

| Key | Values | Default | Notes |
|---|---|---|---|
| `textColor` | hex | `#ffffff` | |
| `nameColor` | `platform` \| `user` \| hex | `user` | `user` keeps each chatter's own platform color. |
| `nameWeight` | 400–900 | `700` | |
| `shadow` | `none` \| `soft` \| `hard` \| `outline` | `outline` | Legibility over moving video. Default deliberately strong. |
| `case` | `normal` \| `upper` | `normal` | |

### Platform display

| Key | Values | Default | Notes |
|---|---|---|---|
| `icons` | `on` \| `off` | `on` | Platform icons per message. |
| `iconStyle` | `color` \| `mono` \| `badge` | `color` | `badge` = icon on a filled platform-colored chip. |
| `iconPos` | `before-name` \| `after-name` \| `corner` | `before-name` | |
| `iconSize` | px | `18` | |
| `platforms` | comma list, e.g. `twitch,kick` | all enabled | Filter which platforms this instance shows — lets you run a Twitch-only overlay and a merged one side by side. |
| `badges` | `on` \| `off` | `on` | Mod/sub/VIP role badges. |

### Behaviour

| Key | Values | Default | Notes |
|---|---|---|---|
| `fade` | seconds, `0` = never | `0` | Auto-hide a message after N seconds. |
| `animIn` | `fade` \| `slide` \| `pop` \| `none` | `slide` | |
| `hideCommands` | `on` \| `off` | `on` | Hides `!command` messages. |
| `hideBots` | comma list of names | common bot list | |
| `hideUsers` | comma list | empty | |
| `emotes` | `on` \| `off` | `on` | |
| `dedupe` | `on` \| `off` | `off` | Collapses the same message repeated across platforms. |
| `preview` | `on` \| `off` | `off` | **Generates fake messages** so the look can be styled inside OBS without going live. |
| `theme` | preset name | `default` | Applies a bundled preset; individual params still override it. |

### Example URLs

```
# Vertical, right-hand side, heavy platform tinting, large text
…/overlays/chat/?layout=vertical&anchor=right&msgBg=platform&bgTint=60&scale=120

# Horizontal bottom band, subtle, no icons, auto-fading
…/overlays/chat/?layout=horizontal&anchor=bottom&msgBg=flat&bgOpacity=25&icons=off&fade=20

# Styling session in OBS with nobody watching
…/overlays/chat/?preview=on
```

---

## Implementation notes

- **One message component** renders in both layouts; CSS handles arrangement. No second
  codebase for horizontal.
- **Platform colors and icons come from `GET /api/platforms`**, never from a hardcoded map.
  A new adapter appears in this overlay with correct branding and no edits here.
- **Settings parsing lives in `packages/core`**, so every future overlay gets the same
  URL-settings behaviour for free.
- **Unknown parameters are ignored, invalid values fall back to the default.** A malformed URL
  must never produce a blank or broken overlay on stream.
- Cap the DOM at `maxMessages` and remove nodes as they scroll out — a chat overlay left
  running for an 8-hour stream must not grow memory.
