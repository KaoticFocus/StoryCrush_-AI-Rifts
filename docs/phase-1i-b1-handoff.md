# Phase 1I-B1 Implementation Handoff

## Status

Phase 1I-B1 is in progress and is not ready for completion or release-candidate QA.

The completed Phase 1I-A work remains in the working tree along with the
following in-progress Phase 1I-B1 changes. Do not mark Phase 1I-B1 complete
until the browser suite, preview suite, full verification, audit report, and
documentation updates have all passed.

## Completed Work

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

## Last Known Validation

The following focused tests passed before the browser-suite expansion:

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

## Current Unverified or Failing State

- `test-results/` is untracked and contains Playwright videos, traces,
  screenshots, and error contexts from failed desktop browser runs.
  Preserve the artifacts until their failures are investigated; do not include
  them in source control unless intentionally requested.
- The browser tests now include diagnostics and soak cases but have not passed
  after the latest changes.
- `tests/browser/presentation.spec.ts` starts diagnostic and soak sessions
  without `debugPerformance=1` for resource baseline assertions. Verify that
  the bridge publishes the expected diagnostics in that case, or update the
  test/helper contract consistently.
- The required deterministic scenario registry has not been completed for all
  20 named scenarios. The current fixtures still center on `fast-gravity`,
  `instant-resolution`, and `wildcard-pair`.
- No performance measurements have been captured for development or preview.
- No confirmed bottleneck has been measured, fixed, and documented.
- No presentation resource registry has been added. Existing direct counts are
  only partial lifecycle evidence and need audit coverage.
- Required accessibility, safe-area, text-scale, contrast, flash-safety, and
  touch audits are not complete.
- Required project documentation remains unchanged:
  - `README.md`
  - `docs/architecture.md`
  - `docs/roadmap.md`
  - `docs/known-issues.md`
  - `docs/performance-accessibility-audit.md` has not been created.

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

## Resume Sequence

1. Run the focused new unit tests, then `npm run typecheck` and `npm run lint`.
2. Run `npm run test:browser` and inspect the existing `test-results/` traces
   and error contexts for the first browser failure.
3. Repair browser tests and diagnostics only after identifying whether the
   failure is an application issue, a status-bridge contract issue, or a test
   coordinate/layout issue.
4. Run `npm run test:browser:preview` after the development browser suite
   passes.
5. Complete the required scenario registry, measurements, lifecycle and layout
   audits, then write `docs/performance-accessibility-audit.md` with actual
   measured results.
6. Update the requested project documentation and run every command in the
   Phase 1I-B1 verification requirements.

## Non-Negotiable Boundaries

- Board and level domains remain Phaser-free and authoritative.
- Diagnostics must remain opt-in and must not alter move resolution,
  scoring, objectives, or terminal state.
- Do not claim Codespace Chromium timings as real-device certification.
- Do not claim full screen-reader accessibility: the canvas board has no
  semantic cell mirror and full keyboard board navigation remains out of scope.
- Do not implement Phase 1I-B2 while completing this work.