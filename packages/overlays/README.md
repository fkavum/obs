# overlays

Browser sources for OBS. One folder per overlay, each with its own `index.html`.

Rules for every overlay:
- Connect to the bridge WebSocket with automatic reconnect.
- Render **nothing** when disconnected — never an error box on stream.
- Take settings from URL query params (`?theme=dark&maxMessages=20`) so one overlay can be
  reused with different looks.
- Transparent background; readable at 1920x1080 over moving video.

Add to OBS: **Sources ▸ + ▸ Browser**, point at the overlay's URL, set width/height,
tick *Shutdown source when not visible* only if the overlay is safe to restart.
