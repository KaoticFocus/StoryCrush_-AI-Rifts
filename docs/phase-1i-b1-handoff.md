# Phase 1I-B1 Implementation Handoff

## Status

Phase 1I-B1 is in progress and is not ready for completion or release-candidate QA.

The completed Phase 1I-A work remains in the working tree along with the
following in-progress Phase 1I-B1 changes. Do not mark Phase 1I-B1 complete
until the browser suite, preview suite, full verification, audit report, and
documentation updates have all passed.

## Completed in Recovery Pass A

- Established an explicit browser diagnostics contract.
  - `e2e=1` owns `#storycrush-test-status` and publishes basic read-only E2E
    scene, fixture, playback, input, render, board, score, objective, and
    geometry status.
  - `debugPerformance=1` is effective only with `e2e=1` and adds resource and
    frame-sample diagnostics.
  - `data-diagnostics-state` is `disabled`, `initializing`, `ready`, or `error`.
    Performance attributes are absent when diagnostics are disabled.
- Added centralized Playwright URL construction plus scene and diagnostics
  readiness/resource helpers. Diagnostics tests now wait for `ready` before
  reading resource attributes.
- Corrected the HUD test coordinate. The old coordinate clicked above the first
  control row, leaving later status assertions waiting on an action that never
  occurred.
- Repaired diagnostics resource assertions to check stable cleanup categories
  rather than compare a partial object with a complete snapshot.
- Added browser coverage for normal E2E, diagnostics E2E, and normal production
  URL behavior.
- Development Playwright passes: 18 tests (9 Chromium desktop, 9 Chromium
  mobile). Production-preview Playwright passes: 18 tests on the same projects.
  The suites cover `fast-gravity`, `instant-resolution`, and `wildcard-pair`.

## Completed Work Before Recovery Pass A

- Added presentation-only performance measurement helpers in
  `src/game/presentation/testing/performanceMeasurement.ts`.
  - Calculates average, P95, maximum, and over-33/50/100 ms frame counts.
  - Collects a bounded `requestAnimationFrame` sample only when enabled.
  - Produces plain serializable samples with optional heap fields.
- Added an ARIA status helper in
  `src/game/presentation/accessibility/ariaStatus.ts`.
  - Formats authoritative accepted-move, rejected-move, hint, objective,
    terminal, pause, and resume messages.
  - Suppresses immediately repeated announcements.
- Added the live region shell in `index.html`.
- Extended `PuzzleScene` diagnostics, behind both `e2e=1` and
  `debugPerformance=1`.
  - Captures a performance sample around move playback.
  - Exposes display-object, board-piece, temporary-object, tween, timer, and
    listener counts through the existing browser status bridge.
  - Publishes ARIA updates from authoritative move, hint, pause, and resume
    paths.
- Adjusted HUD input handling and puzzle layout.
  - Button taps use a single pointer event path.
  - The 320 x 568 and short landscape sizing boundary was adjusted so the
    board and required controls have a viable layout.
- Added focused unit coverage:
  - `tests/unit/presentation/performanceMeasurement.test.ts`
  - `tests/unit/presentation/ariaStatus.test.ts`
  - additional required-viewport coverage in
    `tests/unit/presentation/puzzleLayout.test.ts`
- Extended browser coverage with diagnostics and proposed restart/navigation/
  resize soak assertions, and changed Playwright to desktop + Chromium mobile
  projects with the requested serial execution and retained failure artifacts.

## Current Validation

Focused B1 unit coverage, including browser diagnostics option parsing, passes.
Recovery Pass A final unit result: 50 Vitest files and 227 tests passed.

### Historical Validation

```text
tests/unit/presentation/performanceMeasurement.test.ts
tests/unit/presentation/ariaStatus.test.ts
tests/unit/presentation/puzzleLayout.test.ts
```

The prior completed Phase 1I-A verification passed:

```text
47 Vitest files
212 Vitest tests
npm run verify
10 Playwright browser tests
```

Those baseline counts and browser results do not validate the in-progress
Phase 1I-B1 browser changes.

## Remaining for Recovery Pass B

- The required deterministic scenario registry has not been completed for all
  20 named scenarios. The current fixtures still center on `fast-gravity`,
  `instant-resolution`, and `wildcard-pair`.
- No performance measurements have been captured for development or preview.
- No confirmed bottleneck has been measured, fixed, and documented.
- No presentation resource registry has been added. Existing direct counts are
  only partial lifecycle evidence and need audit coverage.
- Restart, navigation, resize, and gameplay soak tests remain deferred.
- Required mobile-layout, touch, reduced-motion, flash, keyboard, ARIA,
  safe-area, text-scale, and contrast audits are not complete.
- `docs/performance-accessibility-audit.md` and final milestone documentation
  remain incomplete. Do not mark Phase 1I-B1 complete.

## Working Tree Scope

Modified tracked files at handoff:

```text
index.html
package.json
playwright.config.ts
src/game/config.ts
src/game/presentation/BoardView.ts
src/game/presentation/HudView.ts
src/game/presentation/puzzleLayout.ts
src/game/presentation/testing/BrowserTestStatusBridge.ts
src/game/scenes/MainMenuScene.ts
src/game/scenes/PuzzleScene.ts
src/styles/global.css
tests/browser/presentation.spec.ts
tests/unit/presentation/puzzleLayout.test.ts
```

New untracked source/test files at handoff:

```text
src/game/presentation/accessibility/ariaStatus.ts
src/game/presentation/testing/performanceMeasurement.ts
tests/unit/presentation/ariaStatus.test.ts
tests/unit/presentation/performanceMeasurement.test.ts
```

Generated, untracked artifacts:

```text
test-results/
```

## Recovery Pass B Sequence

1. Expand the deterministic performance scenario registry.
2. Collect development and preview baseline measurements.
3. Audit resource/listener lifecycle and run restart/navigation/resize/gameplay
   soak tests.
4. Complete mobile, touch, reduced-motion, flash, keyboard, and ARIA audits.
5. Write `docs/performance-accessibility-audit.md` with measured evidence.
6. Repair only evidence-backed defects and complete final milestone documentation.

## Non-Negotiable Boundaries

- Board and level domains remain Phaser-free and authoritative.
- Diagnostics must remain opt-in and must not alter move resolution,
  scoring, objectives, or terminal state.
- Do not claim Codespace Chromium timings as real-device certification.
- Do not claim full screen-reader accessibility: the canvas board has no
  semantic cell mirror and full keyboard board navigation remains out of scope.
- Do not implement Phase 1I-B2 while completing this work.
