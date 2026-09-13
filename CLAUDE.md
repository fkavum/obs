# Session primer

**Read [`introduction.md`](introduction.md) before doing anything in this repo.** It contains
the project's purpose, architecture decisions, repository layout and ground rules, so they
don't have to be re-explained each session.

Then check [`docs/roadmap.md`](docs/roadmap.md) for current status and what's next, and
update its status markers when work completes.

Quick reminders:
- Never commit credentials. `config/*.local.json` and `.env` are git-ignored; commit only `*.example.*`.
- Normalized event schema is defined in `docs/architecture.md` — don't invent a second shape.
- Overlays are vanilla HTML/CSS/JS and must render nothing (not an error) when the bridge is down.
