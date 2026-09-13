# Session primer

**Read [`introduction.md`](introduction.md) before doing anything in this repo.** It has the
project's purpose, the two hard constraints, architecture decisions, layout and ground rules,
so they don't have to be re-explained each session.

Then check [`docs/roadmap.md`](docs/roadmap.md) for status and what's next, and update its
status markers when work completes.

## The two hard constraints — check every proposal against these

1. **Near-zero maintenance.** Automatic token refresh, no file editing, minimal pinned
   dependencies, official APIs only, self-healing reconnects.
2. **Usable with zero technical knowledge.** One-click start, browser setup wizard, visual
   settings with live preview and a Copy URL button. Never "edit line 14".

A feature that fails either one gets **postponed with the reason recorded** in the roadmap's
Postponed table — not built anyway.

## Branches

`main` = what the owner streams with, must always work. Build on `dev`; merge to `main` only
after verifying against a live stream. Docs-only changes may go straight to `main`.

## Reminders

- **Every feature ships a `GUIDE.md`** for a non-technical reader. Shape: `docs/guides/_template.md`.
- **Never hardcode a platform name** in core, bridge or overlay code — read it from the adapter
  manifests (`GET /api/platforms`). This is what keeps platforms drop-in removable.
- **Two settings locations only:** overlay appearance → URL params; service settings → setup
  wizard. Don't add a third.
- Event schema and adapter contract: [`docs/architecture.md`](docs/architecture.md).
  Chat overlay options: [`docs/overlay-chat.md`](docs/overlay-chat.md).
- Never commit credentials. Overlays must render nothing (not an error) when the bridge is down.
