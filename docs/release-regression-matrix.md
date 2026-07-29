# Release Regression Matrix

Candidate: `prototype-rc1`; local result date: 2026-07-29.

## Release-Blocker Policy

Load, menu, navigation, synchronization, move, score, objective, terminal, input-lock, restart, lifecycle, settings, console/page-error, hard-sync, mobile/touch, reduced-motion, preview-parity, deployment-asset, blank-page, entry-routing, and secret failures are release blocking. Every blocking record is automated or has explicit manual evidence. A public deploy remains blocked until a real URL is available.

Fields for every row: **ID | Category | Scenario | Fixture/setup | Viewport | Playback mode | Reduced-motion state | Build target | Expected result | Automated | Manual review required | Release blocking | Current result | Evidence | Notes**. Default fields: desktop + mobile; normal; off; development + preview; no; yes; Passed. Overrides are explicit.

| ID | Category | Scenario | Fixture/setup | Expected result | Automated | Manual | Blocking | Current | Evidence / notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RC-ENV-001 | Dependency installation | Clean install | lockfile | `npm ci` succeeds | Yes | No | Yes | Passed | `npm ci` |
| RC-BUILD-001 | Production build | Vite output | default | `dist` exists | Yes | No | Yes | Passed | `npm run build` |
| RC-START-001 | Application startup | Main menu | normal URL | loads without errors | Yes | No | Yes | Passed | smoke |
| RC-MENU-001 | Main menu | Start puzzle | fast-gravity | puzzle opens | Yes | No | Yes | Passed | smoke |
| RC-PUZZLE-001 | Puzzle initialization | Initial board | fast-gravity | hashes match | Yes | No | Yes | Passed | B1 |
| RC-BOARD-001 | Board rendering | Initial cells | fast-gravity | visible square board | Yes | Yes | Yes | Passed | B1 evidence |
| RC-MOVE-001 | Piece selection | Select coordinate | fast-gravity | selection visible | Yes | No | Yes | Passed | smoke |
| RC-MOVE-002 | Accepted swap | Domain move | fast-gravity | one move and sync | Yes | No | Yes | Passed | smoke |
| RC-MOVE-003 | Rejected swap | Non-scoring move | rejected-swap | board/moves unchanged | Yes | No | Yes | Passed | B1 |
| RC-RES-001 | Resolution | Standard match | ordinary-match | authoritative result | Yes | No | Yes | Passed | B1 |
| RC-RES-002 | Resolution | Gravity/refill | fast-gravity | ordered movement | Yes | No | Yes | Passed | smoke |
| RC-RES-003 | Resolution | Cascades | multi-cascade | ordered cascades | Yes | No | Yes | Passed | B1 |
| RC-SPECIAL-001 | Special creation | Created special | line-area-combination | identity preserved | Yes | Yes | Yes | Passed | B1 |
| RC-SPECIAL-002 | Special | Horizontal clear | line-area-combination | effect/sync | Yes | Yes | Yes | Passed | B1-FX-004 |
| RC-SPECIAL-003 | Special | Vertical clear | line-area-combination | effect/sync | Yes | Yes | Yes | Passed | B1-FX-004 |
| RC-SPECIAL-004 | Special | Area clear | line-area-combination | effect/sync | Yes | Yes | Yes | Passed | B1-FX-004 |
| RC-SPECIAL-005 | Special | Wildcard target | wildcard-target | target clear | Yes | Yes | Yes | Passed | B1-FX-005 |
| RC-SPECIAL-006 | Special | Wildcard pair | wildcard-pair | full-board clear | Yes | Yes | Yes | Passed | smoke |
| RC-SPECIAL-007 | Special | Activation chains | wildcard-pair | domain order retained | Yes | Yes | Yes | Passed | B1 trace |
| RC-RESHUFFLE-001 | Recovery | Automatic reshuffle | automatic-reshuffle | playable stable board | Yes | No | Yes | Passed | B1/domain |
| RC-STATE-001 | Score | Score synchronization | fast-gravity | authority matches | Yes | No | Yes | Passed | smoke |
| RC-STATE-002 | Objectives | Progress | fast-gravity | authority matches | Yes | No | Yes | Passed | smoke |
| RC-STATE-003 | Moves | Consumption | accepted/rejected | once/zero | Yes | No | Yes | Passed | B1/unit |
| RC-STATE-004 | Terminal | Win state | terminal-win | correct state | Yes | Yes | Yes | Passed | B1 |
| RC-STATE-005 | Terminal | Failure state | terminal-failure | correct state | Yes | Yes | Yes | Passed | B1 evidence |
| RC-UI-001 | Hint | Hint display | fast-gravity | no mutation | Yes | Yes | Yes | Passed | smoke |
| RC-UI-002 | Pause | Pause/resume | fast-gravity | state preserved | Yes | Yes | Yes | Passed | smoke |
| RC-UI-003 | Pause | During playback | pause-during-playback | safe pause | Yes | No | Yes | Passed | B1 |
| RC-UI-004 | Pause | Visibility pause | visibility event | safe pause | Yes | No | Yes | Passed | B1 |
| RC-UI-005 | Navigation | Restart | restart-during-playback | no duplicate state | Yes | No | Yes | Passed | B1 |
| RC-UI-006 | Navigation | Menu navigation | menu exit | no stale scene | Yes | No | Yes | Passed | B1 |
| RC-SETTINGS-001 | Settings | Preferences persistence | fast-gravity | preferences only | Yes | No | Yes | Passed | smoke/unit |
| RC-PLAYBACK-001 | Playback | Fast mode | fast-gravity | same final state | Yes | Yes | Yes | Passed | smoke |
| RC-PLAYBACK-002 | Playback | Instant mode | instant-resolution | same final state | Yes | Yes | Yes | Passed | smoke |
| RC-A11Y-001 | Motion | Reduced motion | reduced-motion | safe effects | Yes | Yes | Yes | Passed | B1 |
| RC-LAYOUT-001 | Layout | Desktop resize | resize-during-playback | reachable UI | Yes | Yes | Yes | Passed | B1 |
| RC-MOBILE-001 | Layout | Portrait | mobile-layout | no clipping | Yes | Yes | Yes | Passed | B1 evidence |
| RC-MOBILE-002 | Layout | Landscape | mobile-layout | no clipping | Yes | Yes | Yes | Passed | B1 evidence |
| RC-MOBILE-003 | Input | Touch | fast-gravity | no duplicate move | Yes | Yes | Yes | Passed | B1 evidence |
| RC-A11Y-002 | Layout | Browser zoom | zoom capture | usable canvas/HUD | Yes | Yes | Yes | Passed | B1 evidence |
| RC-A11Y-003 | Layout | Safe-area simulation | safeAreaTest | coordinates work | Yes | Yes | Yes | Passed | B1 evidence |
| RC-A11Y-004 | Access | Keyboard controls | Escape/H | supported commands | Yes | Yes | Yes | Passed | B1 |
| RC-A11Y-005 | Access | ARIA announcements | live region | updates announce | Yes | Yes | Yes | Passed | B1 |
| RC-LIFE-001 | Resources | Cleanup | diagnostics | baseline restored | Yes | No | Yes | Passed | B1-SK-001 |
| RC-SOAK-001 | Soak | Restart | 25 cycles | stable resources | Yes | No | Yes | Passed | B1-SK-002 |
| RC-SOAK-002 | Soak | Navigation | 20 cycles | no stale scene | Yes | No | Yes | Passed | B1-SK-003 |
| RC-SOAK-003 | Soak | Resize | 10 cycles | stable state | Yes | No | Yes | Passed | B1-SK-004 |
| RC-SOAK-004 | Soak | Gameplay | 20 cycles | no recovery | Yes | No | Yes | Passed | B1-SK-005 |
| RC-SOAK-005 | Soak | Hint/pause/settings | 25 cycles | singular controls | Yes | No | Yes | Passed | B1-SK-006: 10 consecutive preview-desktop runs plus desktop/mobile preview pass after document-level Escape/H/M shortcut repair; no errors or recovery |
| RC-PREVIEW-001 | Production preview | Full suite | all fixtures | parity | Yes | No | Yes | Passed | 46 passed, 8 intentionally evidence-gated skips across desktop/mobile after B1-SK-006 repair |
| RC-DEPLOY-001 | Deploy | Static build | netlify.toml | build/publish correct | Yes | No | Yes | Passed | config/build |
| RC-DEPLOY-002 | Deploy | Local preview | local server | assets/refresh/nav | Yes | No | Yes | Passed | preview smoke |
| RC-DEPLOY-003 | Deploy | Public deployed smoke | real URL | normal-user smoke | No | Yes | Yes | Blocked | no URL/credentials |
| RC-ISO-001 | Isolation | Normal URL instrumentation | normal URL | fixtures inert | Yes | No | Yes | Passed | smoke |

Manual canvas review passed for visual distinction, effects/chains, hints/selection, pause, objective/terminal states, desktop/mobile, reduced motion, and 200% zoom. Canvas contrast is manually reviewed only, not WCAG certified.

## B1-SK-006 Repair Record

The initial preview-desktop soak was timing-sensitive: Phaser keyboard-manager
delivery could miss rapid `Escape` or `H` input after canvas/HUD interaction,
leaving a hint absent or pause state unchanged. `PuzzleScene` now owns the same
shortcuts through scene-scoped document `keydown` listeners with repeat
filtering and removes them on shutdown. The soak sends real page keyboard input,
so it covers this focus-independent boundary without invoking scene methods.
