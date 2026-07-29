# Release Candidate Handoff

## Candidate

- Identifier: `prototype-rc1`
- Date: 2026-07-29
- Branch: `main`
- Verification commit: `ef53d34`
- Node: `v24.14.0`; npm: `11.9.0`
- Build target: Vite static output in `dist`

## Included Scope

Deterministic match-3 engine, specials, cascades, score, moves, score and collection objectives, win/failure, hints, pause, settings, reduced motion, browser diagnostics, mobile layout, and documented partial accessibility support.

## Excluded Scope

Final art, sound, narrative, gameplay-save persistence, AI, content expansion, enhanced combinations, and additional objective types.

## Verification

Local release candidate verified on this working tree:

- `npm run verify`: 51 Vitest files / 235 tests passing; format, lint,
  typecheck, and production build passing.
- `npm run test:browser:smoke`: 14/14 development and 14/14 preview passing.
- Development and preview full suites: 46 passing each with 8 intentionally
  environment-gated evidence/outlier skips.
- `npm run test:browser:soak`: 12/12 passing across desktop and mobile.
- B1-SK-006: the preview-desktop hint/pause/settings soak had intermittent
  Phaser keyboard-manager delivery after rapid canvas/HUD interaction. Scene-
  scoped document shortcuts with repeat filtering repaired the boundary; ten
  isolated preview-desktop repetitions and the full preview suite passed.

The GitHub workflow files are locally syntax/configuration validated and their
equivalent commands pass locally. No GitHub-hosted run has been observed.

## Release Status

Public deployment verification is complete:

- Production URL: https://storycrush-ai-rifts.netlify.app
- Production deploy ID: 6a6a87d91421349213b6da47
- Draft URL: https://6a6a87292c190c238782ef42--storycrush-ai-rifts.netlify.app
- Draft deploy ID: 6a6a87292c190c238782ef42
- GitHub-hosted verify and browser-smoke workflows passed for the current push
- Desktop and mobile browser smoke passed on the production site (7/7 each)

## Non-Blocking Limitations

No physical-device certification; safe-area simulation only; no complete screen-reader board or keyboard board navigation; no semantic canvas reflow at browser zoom; variable shared-host frame pacing; placeholder visuals; no sound, final art, narrative, gameplay saves, enhanced combinations, or objectives beyond score and collection. The Vite large-chunk advisory is non-blocking.

## Build and Preview

```bash
npm ci
npm run test:release
npm run build
npm run preview
```

Use `npm run test:release:full` for the full regression and soak gate.

## Deployment and Rollback

Netlify-compatible hosting runs `npm run build` and publishes `dist`. The app has one Vite entry route, so an SPA redirect is neither configured nor required. Before publishing, configure those two values and run the normal-user smoke against the actual URL. Roll back through host deploy history or redeploy a previously verified commit, retaining the deploy/commit reference in the host release record.

## Next Milestone

Practical Milestone 2 closure is complete with public deployment and hosted
verification confirmed.
