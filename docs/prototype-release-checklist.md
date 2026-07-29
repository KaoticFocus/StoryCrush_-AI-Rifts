# Prototype Release Checklist

Candidate: `prototype-rc1`; statuses reflect the verified public release on 2026-07-29.

| Area          | Item                                                                                | Status  | Evidence / note                                                                                         |
| ------------- | ----------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Source        | Working tree reviewed; no unintended generated files                                | Passed  | final git audit                                                                                         |
| Source        | No secrets or local paths                                                           | Passed  | source/output scans                                                                                     |
| Dependencies  | Clean `npm ci`; lockfile current; no global dependency                              | Passed  | reproducibility gate                                                                                    |
| Code          | Format, lint, typecheck, unit tests, production build                               | Passed  | `npm run verify`                                                                                        |
| Boundaries    | Board/level Phaser-free; preferences-only persistence                               | Passed  | scans and coverage                                                                                      |
| Browser       | Smoke, full, preview, soak; desktop/mobile/touch                                    | Passed  | 14/14 smoke dev + preview; 46 passed per full dev/preview suite with 8 evidence-gated skips; 12/12 soak |
| Browser       | B1-SK-006 hint/pause/settings preview stability                                     | Passed  | 10 consecutive preview-desktop passes after document-level shortcut repair                              |
| Browser       | Reduced motion, zoom, safe-area simulation                                          | Passed  | B1 evidence; hardware excluded                                                                          |
| Gameplay      | Startup, moves, cascades, specials, reshuffle, score, objectives, terminal, restart | Passed  | regression matrix                                                                                       |
| Presentation  | Hint, pause, visibility pause, modes, settings, ARIA, mobile                        | Passed  | regression matrix                                                                                       |
| Deployment    | Build command, publish directory, asset paths, local preview                        | Passed  | Netlify config and output audit                                                                         |
| Deployment    | Public deployed smoke                                                               | Passed  | Netlify production and draft URLs live; desktop/mobile smoke passed against the public site           |
| CI            | GitHub-hosted workflow execution                                                    | Passed  | verify and browser-smoke workflows completed successfully for the current push                          |
| Documentation | README, architecture, roadmap, known issues, B1 audit                               | Passed  | reconciled docs                                                                                         |
| Documentation | Matrix, checklist, release handoff                                                  | Passed  | release documents                                                                                       |

Counts: **Passed 16; Failed 0; Blocked 0; Not applicable 0.**
