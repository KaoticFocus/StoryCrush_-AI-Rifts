# Known Issues and Technical Risks

## Historical Blocking Issues (Phase 0 Audit)

1. No runnable application code

- Impact: cannot satisfy run/build validation.
- Severity: critical.
- Status: resolved in Phase 0B scaffold.

2. No package/tooling manifest

- Impact: no script contract for dev/build/test/lint/type-check.
- Severity: critical.
- Status: resolved in Phase 0B scaffold.

3. No tests

- Impact: no baseline confidence or regression protection.
- Severity: high.
- Status: partially resolved. Baseline unit test coverage exists; gameplay/system coverage not started.

4. No content schema or validator

- Impact: high risk of brittle hardcoded content once implementation starts.
- Severity: high.
- Status: unresolved (planned for later phase).

5. No save-state contract

- Impact: risk of early data model drift and migration pain.
- Severity: medium.
- Status: unresolved (planned for later phase).

## Current Confirmed Limitations (Post-Phase 0B)

1. Placeholder visual style remains

- Impact: effects are readable and distinct, but they still use prototype vector styling rather than final art direction.
- Severity: expected for current milestone.

2. Production bundle warning from Phaser size

- Impact: Vite reports chunk size warning (>500 kB) in production build.
- Severity: medium. Not blocking Phase 0B.

3. Browser-manual validation scope

- Impact: runtime was validated by starting dev/preview servers and probing HTTP responses; full interactive browser-console inspection was not completed in this environment.
- Severity: medium.

4. Generated-board valid-move guarantee is not implemented yet

- Impact: generated boards avoid initial matches but are not yet guaranteed to contain at least one valid scoring move.
- Severity: medium. Planned for dead-board detection/reshuffle milestone.

5. Prototype scope remains intentionally narrow

- Impact: the playable prototype exposes one deterministic level with score and piece-collection objectives only.
- Severity: expected for current milestone.

6. Placeholder visuals only

- Impact: board pieces, cells, and HUD use temporary vector graphics and prototype text styling.
- Severity: expected for current milestone.

7. Enhanced special combinations are not implemented

- Impact: baseline direct combinations exist, but advanced commercial-style combo upgrades are intentionally deferred.
- Severity: expected for current milestone.

8. Enhanced special combinations are not implemented

- Impact: baseline direct combinations exist, but advanced commercial-style combo upgrades remain deferred.
- Severity: expected for current milestone.

9. Objective type coverage is intentionally narrow

- Impact: only score and piece-collection objectives are available in domain logic.
- Severity: expected for current milestone.

10. Browser-manual validation coverage still depends on available automation

- Impact: dev and preview startup can be validated headlessly, but full in-browser interaction depends on available browser tooling in the environment.
- Severity: medium.

11. Session-level dead-board recovery is now implemented, but initial generation still does not guarantee moves

- Impact: level sessions can recover dead initial and post-move boards via deterministic reshuffle orchestration, but standalone generation still does not guarantee an opening move.
- Severity: medium.

## Recently Resolved in Phase 1G

1. Deterministic scoring exists

- Scope: piece-clear points, special-activation bonuses, integer cascade multipliers.

2. Move consumption exists

- Scope: accepted moves consume one; rejected/terminal consume zero.

3. Score objectives exist

- Scope: cumulative score objective progression and completion.

4. Collection objectives exist

- Scope: deterministic removed-piece collection events and progress updates.

5. Win/failure evaluation exists

- Scope: objective-completion win precedence and no-moves failure evaluation.

6. Session dead-board recovery exists

- Scope: deterministic initial and post-move dead-board reshuffle orchestration.

## Recently Resolved in Phase 1H-A / 1H-B2

1. Board is now rendered in Phaser

- Scope: complete 8 x 8 prototype board with placeholder standard and special piece visuals.

2. Pointer and touch input now exist

- Scope: selection, deselection, non-adjacent reselection, adjacent swap submission, and rejected-move feedback.

3. HUD now exists

- Scope: score, moves, objective progress, status, restart, and menu navigation.

4. A playable prototype loop now exists

- Scope: main menu entry, puzzle scene, deterministic restart, and terminal-state input lock.

5. Core board playback now exists

- Scope: accepted swap, rejected adjacent swap-and-return, match highlight, generic special feedback, removal, special creation, gravity, refill, cascade sequencing, and authoritative final sync.

6. Playback controls now exist

- Scope: normal, fast, instant, and reduced-motion behavior inside the prototype HUD.

7. Distinct special-effect presentation exists

- Scope: directional line-clear beams, area-clear shockwave, wildcard target marking, and full-board wildcard wave.

8. Individual reshuffle animation exists

- Scope: deterministic per-piece reshuffle movement preserving exact piece appearance.

9. Incremental score and objective feedback exists

- Scope: ordered score counting, collection progress updates, and short completion feedback.

## Remaining Confirmed Limitations

- Only score and collection objectives are implemented.
- No blockers or hazards are implemented.
- No timed levels are implemented.
- Enhanced special combinations are still deferred.
- Placeholder visuals only.
- No sound integration is implemented.
- No narrative integration is implemented.
- No save persistence layer is implemented.
- Phaser production bundle-size warning remains non-blocking.
- Browser-specific edge cases may still exist until broader manual device coverage is expanded.

## Process Risks

1. Scope creep into all universes too early

- Mitigation: enforce Fantasy + Cyberpunk-only vertical slice until convergence is playable.

2. Mixing game rules with scene/render code

- Mitigation: isolate deterministic engine modules and test them without scene runtime.

3. AI coupling too early

- Mitigation: deterministic authored content first; AI features remain optional overlays.

## Environment Notes

- ripgrep is unavailable in this container path; use find/grep alternatives for now.

## Open Questions

- Preferred package manager (npm/pnpm/yarn)?
- Preferred deployment target for preview (Netlify vs GitHub Pages)?
- Minimum supported device profile for performance targets?
