# Performance and Accessibility Audit

## Scope and Environment

Run identifier: `phase-1i-b1-codespace-2026-07-28`.

- Host: Ubuntu 24.04.4 LTS dev container (Codespaces).
- Browser: Playwright Chromium desktop and iPhone 13 emulation.
- Playwright: 1.62.0; one worker, serial suite, retained failure trace/video/screenshot.
- Builds: Vite development and production preview.
- Measured viewports: desktop `1280 x 720` at DPR 1 and mobile emulation `390 x 664` at DPR 3. Resize soak additionally exercised `390 x 844`, `844 x 390`, `320 x 568`, and `1440 x 900`.
- Diagnostics are opt-in: `?e2e=1&debugPerformance=1`. Normal and plain E2E URLs do not enable the sampler.

Codespace Chromium samples are useful regression evidence, not physical-device certification.

## Baseline

- Focused B1 unit slice: 4 files / 15 tests passing.
- Production bundle: main JavaScript `1,361.94 kB`, gzip `370.36 kB`; CSS `0.78 kB`, gzip `0.42 kB`.
- Vite reports its existing chunk-over-500-kB advisory. Diagnostics are tree-included but inactive without both URL flags.
- Idle resource snapshot: 29 display objects, 64 board pieces, 0 temporary objects, 0 active tweens, 0 active timers, and 4 scene listeners for both tested device profiles.
- Browser baseline: preview suite passed 46/46. Development originally exposed one wildcard-target completion timeout; the repair below passed in focused desktop/mobile rerun.

## Scenario Registry

`src/game/content/testing/browserScenarios.ts` supplies the E2E-gated read-only registry. Fixtures reuse normal deterministic level constructors and normal scene playback:

| Scenario                | Fixture               | Action                |
| ----------------------- | --------------------- | --------------------- |
| idle-board              | fast-gravity          | none                  |
| rejected-swap           | fast-gravity          | non-scoring swap      |
| ordinary-match          | fast-gravity          | accepted swap         |
| fast-gravity            | fast-gravity          | accepted swap         |
| instant-resolution      | instant-resolution    | accepted swap         |
| multi-cascade           | fast-gravity          | accepted swap         |
| horizontal-line-clear   | line-area-combination | accepted swap         |
| vertical-line-clear     | line-area-combination | accepted swap         |
| area-clear              | line-area-combination | accepted swap         |
| wildcard-target         | wildcard-target       | accepted swap         |
| wildcard-pair           | wildcard-pair         | accepted swap         |
| activation-chain        | wildcard-pair         | accepted swap         |
| automatic-reshuffle     | fast-gravity          | none; domain coverage |
| pause-during-playback   | fast-gravity          | pause control         |
| resize-during-playback  | fast-gravity          | resize control        |
| restart-during-playback | fast-gravity          | restart control       |
| terminal-win            | fast-gravity          | none; domain coverage |
| terminal-failure        | fast-gravity          | none; domain coverage |
| mobile-layout           | fast-gravity          | none                  |
| reduced-motion          | line-area-combination | accepted swap         |

Unknown scenario IDs resolve to `null`; only `e2e=1` permits fixture selection. Normal URLs ignore fixture and scenario parameters.

## Performance Results

All serializable samples are in [docs/performance-results.json](performance-results.json). Each begins immediately before an action, samples bounded `requestAnimationFrame` intervals, ends after authoritative synchronization, and reports cleanup. All recorded samples have matching rendered/authoritative hashes, hard-sync delta 0, and cleanup of 0 temporary objects, playback tweens, and playback timers.

| Build / viewport      | Scenario / mode   | Avg / P95 / max ms   | >33 / >50 / >100 | Duration ms |
| --------------------- | ----------------- | -------------------- | ---------------- | ----------- |
| dev 1280x720 DPR1     | ordinary / normal | 23.809 / 66.6 / 83.4 | 15 / 3 / 0       | 1360.4      |
| dev 1280x720 DPR1     | gravity / fast    | 23.214 / 50.0 / 66.7 | 8 / 1 / 0        | 675.7       |
| dev 1280x720 DPR1     | instant           | 0 / 0 / 0 (0 frames) | 0 / 0 / 0        | 92.0        |
| dev 1280x720 DPR1     | wildcard pair     | 18.924 / 33.3 / 66.7 | 45 / 4 / 0       | 7666.7      |
| dev 390x664 DPR3      | reduced motion    | 16.681 / 16.8 / 33.3 | 1 / 0 / 0        | 1625.1      |
| preview 1280x720 DPR1 | ordinary / normal | 22.914 / 50.1 / 83.5 | 13 / 3 / 0       | 1307.7      |
| preview 1280x720 DPR1 | gravity / fast    | 23.566 / 50.0 / 50.1 | 10 / 1 / 0       | 719.5       |
| preview 1280x720 DPR1 | instant           | 0 / 0 / 0 (0 frames) | 0 / 0 / 0        | 38.3        |
| preview 390x664 DPR3  | wildcard pair     | 16.979 / 16.8 / 66.7 | 6 / 1 / 0        | 7294.6      |
| preview 390x664 DPR3  | reduced motion    | 17.977 / 33.3 / 50.1 | 5 / 1 / 0        | 1714.6      |

The desktop P95 samples exceed the aspirational 25 ms target in this shared Codespace environment. A final preview mobile wildcard-pair run also observed one 183.3 ms frame; it did not reproduce as a resource leak, stuck playback, hard-sync recovery, or console/page error. These results must not be represented as a 60 FPS certification. Heap-before is not exposed by the current diagnostic contract; Chromium heap-after is recorded when supported.

## Lifecycle and Soaks

Diagnostics prove persistent counts and stable synchronization; scene shutdown explicitly removes resize, visibility, keyboard, settings, playback, and view-owned resources.

- Restart: `B1-SK-002` performs 25 cycles, checks snapshots at 5-cycle intervals, and sees deterministic hashes and hard-sync count 0.
- Navigation: `B1-SK-003` completes 20 menu-puzzle-menu cycles with no stale scene marker or console/page error.
- Resize: `B1-SK-004` performs 10 cycles through the required operational sizes. It preserves hash consistency, unlocks input, and returns resources to baseline.
- Gameplay: `B1-SK-005` completes 20 accepted instant moves, restarting after each fixture terminal path, with stable scores/moves/hash and no recovery.
- Hint, pause, settings: `B1-SK-006` performs 25 cycles and checks singular controls, cleared pause state, stable resource counts, and a settings-only local-storage key.

No resource-growth trend was observed. The tracked 4 listeners are resize, visibility, Escape, and H; they are scene-owned and removed on shutdown.

## Evidence-backed Repair

| Scenario                             | Symptom and evidence                                                                                                                                | Root cause                                                                                                                                                 | Fix                                                                         | Before / after                                                                                         | Tradeoff                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| wildcard-target, development desktop | `B1-FX-005` stayed `playing` after the fixed 5 s assertion budget; preview completed and a focused rerun completed in 8.9 s desktop / 8.0 s mobile. | The normal wildcard special effect can outlast 5 s under shared Codespace scheduling. The test timeout was narrower than the legitimate measured duration. | Give only wildcard-target a bounded 15 s completion budget.                 | Dev full baseline: 45/46 with this one timeout. Focused rerun: 2/2.                                    | A longer bounded wait delays detection of a genuine stuck effect, but avoids rejecting a valid special effect under variable host load. |
| 844x390 landscape evidence           | Initial preview screenshot showed the lower footer clipped. Direct geometry reproduction found an 844x474 canvas inside an 844x390 viewport.        | CSS Grid automatic minimum sizing preserved the Phaser canvas intrinsic height.                                                                            | Set `min-width: 0` and `min-height: 0` on the app and game-root grid items. | Before: footer clipped. After: canvas is 844x390, 26 px cells, and all footer controls remain visible. | Landscape cells are smaller, but controls retain 92x36 px targets and no overlap.                                                       |

## Mobile, Touch, and Safe Area

- Automated resize evidence covers 320x568, 390x844, 844x390, 1280x720, and 1440x900; layout tests also cover the responsive geometry constraints.
- The canvas remains fitted inside `#app-shell`, which applies all four `env(safe-area-inset-*)` paddings. Canvas coordinate conversion uses the logical Phaser dimensions after resize.
- Board cells are square and hit testing is centralized through the board layout. HUD buttons use one pointer-down path; hint graphics are on a non-interactive effect layer.
- Browser emulation cannot certify notch avoidance, edge ergonomics, multi-touch behavior, or target usability on physical hardware. There is intentionally no drag-to-swap.

## Visual Evidence

Curated production-preview screenshots are stored in
`docs/evidence/phase-1i-b1/`. The directory contains stable main-menu, idle,
hint, pause, accepted-playback, special-activation, wildcard-pair, terminal,
reduced-motion, zoom, and safe-area states. Naming is
`<viewport>-<state>.png`; failure-only Playwright images, traces, and videos
were removed.

The seven reviewed viewports are `320x568`, `360x800`, `390x844`, `412x915`,
`844x390`, `1280x720`, and `1440x900`. Every viewport passed the automated
board-visibility, square-cell, HUD/control reachability, non-overlap, and
no-scroll checks. No partial or failed layout was found. The terminal evidence
uses the deterministic `terminal-failure` fixture and normal level-domain move
path.

## Browser Zoom

Preview desktop Chromium passed interaction and visibility checks at 125%, 150%,
and 200% CDP page scale. Evidence includes 150% idle/pause and 200% terminal
states; `390x844` was also captured at equivalent 150% scale. Phaser canvas
text is raster/canvas content rather than responsive DOM text, so this is not a
claim of WCAG zoom or DOM reflow compliance. No browser scrolling or critical
coordinate error was observed in the emulated runs.

## Touch and Safe Area

Playwright Chromium touch emulation passed selection, edge-cell selection,
accepted move, hint, pause/resume, mode and motion toggles, restart, and menu
return at `390x844`, `320x568`, and `844x390`. The 320x568 effective board cell
was 30x30 px and the repaired 844x390 landscape cell was 26x26 px; footer
controls were at least 92x36 px and did not overlap. This
is practical emulation evidence, not formal target-size compliance or
physical-device certification.

`?e2e=1&safeAreaTest=1` applies an inert-on-normal-URLs CSS simulation of top
30 px, right 12 px, bottom 24 px, and left 12 px insets. Portrait, landscape,
pause overlay, and corner-cell conversion all passed. The simulation validates
the presentation boundary only; physical notch and home-indicator behavior is
still deferred for hardware testing.

## Wildcard Outlier Investigation

The original preview-mobile wildcard-pair observation was one 183.3 ms frame.
Ten independent preview Chromium mobile runs at 390x844 produced average frame
intervals from 16.878 to 18.249 ms, P95 from 16.7 to 33.3 ms, and longest frames
from 33.4 to 100 ms. No repeat run exceeded 100 ms. The over-100-ms command
correlation map was empty; all runs retained matching hashes, zero hard-sync
recovery, zero temporary/tween/timer cleanup residue, and no console/page
errors.

Classification: **shared-host/browser scheduling outlier**. It does not block
B1 closure because it was not reproducible at a common presentation boundary
and had no state or lifecycle symptom.

## Accessibility Review

- Standard pieces vary by shape and interior symbol as well as color. Line clears add directional overlays, area clears add radial treatment, and wildcards add a distinct overlay.
- Canvas text and graphics were manually reviewed through the automated layouts; no WCAG claim is made. Canvas content remains outside ordinary DOM contrast tooling.
- Browser zoom does not scale Phaser canvas text in the same way as DOM text. Layout is tested at constrained viewports; physical 125/150/200% browser-zoom review remains a device/browser follow-up.
- Reduced motion keeps authoritative ordering and uses shorter/static alternatives. The reduced-motion special sample completed with zero leaked transient resources.
- Special effects avoid full-screen white frames and screen shake. Effects are per-board-area, bounded in duration, and reduced motion removes travel-heavy choreography.
- Keyboard: Escape toggles pause/resume and H requests a hint. The canvas receives the handlers only once per scene generation; terminal and paused state restrictions apply. No keyboard board navigation or unconfirmed restart shortcut exists.
- ARIA: the separate polite live region announces accepted/rejected moves, score/moves in accepted message, objective completion, terminal state, pause/resume, and hint coordinates while suppressing immediate duplicates. The hidden E2E status bridge is separate.
- Semantic DOM controls are limited to the live region and startup fallback. Gameplay controls and board cells remain canvas-only; piece identities are not exposed as semantic cells. A future semantic companion board would need focus management, cell labels, selected state, and keyboard move semantics without duplicating gameplay rules.

## Remaining Risks

- Codespace and browser emulation are not physical-device certification.
- The canvas lacks a semantic board mirror and full keyboard board navigation.
- Placeholder visuals, no sound, no final art, no narrative, no gameplay-save persistence, and score/collection-only objectives remain intentional prototype limits.
- Enhanced special combinations remain deferred.
- The Vite large-chunk advisory remains.
- Desktop shared-host P95 values exceed the engineering target. The original 183.3 ms preview-mobile wildcard frame was classified as a non-blocking shared-host/browser scheduling outlier after ten clean repeat runs.
