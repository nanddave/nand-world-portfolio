# Agent instructions (Codex, Claude, others)

This repo is shared by several coding agents. The full working rules are in **CLAUDE.md**. Read it before changing anything; it applies to every agent, not only Claude.

Short version:
- Zero cost: no paid services or assets, and no new npm dependencies without Nand's approval.
- Never invent facts about Nand. All story content lives in `src/content/stops.js`.
- `npm run build` (deployed to Vercel from `dist/`) and `npm run build:single` must both pass.
- Check visual changes with `node tools/shot.mjs` (see CLAUDE.md).
- Plan and status: `docs/PLAN.md` and `HANDOFF.md`. Update them when you finish a phase.
- Work on a branch and open a PR. `main` auto-deploys to production on Vercel.
