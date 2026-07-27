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

1. Foundation-only application

- Impact: no rendered playable puzzle loop yet; board-domain logic is currently test-driven only.
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

5. Core puzzle progression systems remain deferred

- Impact: scoring, objectives, special pieces, and broader gameplay progression remain unavailable.
- Severity: expected for current milestone.

6. Resolution is domain-only and not player-visible

- Impact: match resolution pipeline exists in board-domain modules and tests but is not rendered in Phaser scenes.
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

10. Resolution remains domain-only and not player-visible

- Impact: activation-capable cascade logic is fully implemented in board-domain modules and tests, but is not rendered in Phaser scenes.
- Severity: expected for current milestone.

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

## Remaining Confirmed Limitations

- Only score and collection objectives are implemented.
- No blockers or hazards are implemented.
- No timed levels are implemented.
- Enhanced special combinations are still deferred.
- No Phaser board rendering is implemented.
- No player input system is implemented.
- No puzzle animation system is implemented.
- No sound integration is implemented.
- No narrative integration is implemented.
- No save persistence layer is implemented.
- Phaser production bundle-size warning remains non-blocking.
- Full interactive browser validation remains pending.

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
