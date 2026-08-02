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

4. AI and voice integration remains unscoped

- Impact: risk of over-coupling narrative or speech systems to core gameplay.
- Severity: medium.
- Status: addressed by the new deterministic-authority and provider-isolation roadmap guidance in [ai-voice-roadmap.md](ai-voice-roadmap.md).

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

- Scope: directional line-clear beams, cross-clear sigil beams, wildcard target marking, and full-board wildcard wave.

8. Individual reshuffle animation exists

- Scope: deterministic per-piece reshuffle movement preserving exact piece appearance.

9. Incremental score and objective feedback exists

- Scope: ordered score counting, collection progress updates, and short completion feedback.

## Recently Resolved in Practical Milestone 2

### B1-SK-006: Preview keyboard shortcut delivery

- Severity: High before repair.
- Release blocking: resolved.
- Affected environment: production-preview desktop browser soak.
- Reproduction: rapid `H` and `Escape` input after canvas/HUD interaction could
  be missed by Phaser keyboard-manager delivery.
- Impact: hint/pause state could fail to change during the release-blocking
  hint/pause/settings soak.
- Workaround: none required after repair.
- Planned milestone: resolved in Practical Milestone 2.
- Resolution: scene-scoped document `keydown` listeners now own Escape, H, and
  M with repeat filtering; ten isolated preview-desktop B1-SK-006 repetitions
  and the full preview suite passed.

## Remaining Confirmed Limitations

- Phase 3A.1 longer Fantasy score goals (2,500 / 3,500 / 5,000) remain provisional. Phase 3B aligns special rules (perpendicular line clears, full `cross-clear`) without retuning those goals; human playtesting and a separate rebalance PR are still required.
- Distinct enhanced six-plus behavior remains reserved; current six-plus straight runs intentionally use the existing wildcard fallback.
- Only score and collection objectives are implemented.
- No blockers or hazards are implemented.
- No timed levels are implemented.
- Enhanced special combinations are still deferred.
- Placeholder visuals only.
- No sound integration is implemented.
- No narrative integration is implemented.
- Durable browser save/restore for the narrative flow is now implemented through a schema-versioned repository, shared persistence coordinator, strict validation, and startup restore handling.
- Phaser production bundle-size warning remains non-blocking.
- Browser-specific edge cases may still exist until broader manual device coverage is expanded.
- Codespace Chromium performance samples are regression evidence, not physical-device performance certification. The 183.3 ms preview-mobile wildcard observation was classified as an isolated shared-host/browser scheduling outlier after ten repeat runs with no >100 ms frame, lifecycle drift, or command correlation.
- Browser emulation and safe-area simulation do not certify notch safe areas, touch ergonomics, or multi-touch behavior on hardware. Physical-device touch and safe-area verification remains deferred to release-candidate work.
- The Phaser canvas board has no semantic cell mirror and no full keyboard board navigation. Canvas text does not follow browser zoom like DOM text.
- B1 diagnostics are inert without `e2e=1&debugPerformance=1`; only presentation preferences use local storage, not gameplay state.

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

## Release-Candidate Classification

### RC-ISSUE-001: Public deployment verification resolved

- Severity: High
- Release blocking: Resolved
- Affected environment: public static host
- Resolution: Netlify authentication completed, the existing site was linked, the production deployment was published at https://storycrush-ai-rifts.netlify.app, and desktop/mobile smoke passed.
- Reproduction: no deployed URL or deployment credential is in repository configuration.
- Impact: public asset, refresh, and normal-user smoke checks cannot run.
- Workaround: run the documented smoke after configuring a real host URL.
- Planned milestone: Practical Milestone 2 closure after deployment access.

### RC-ISSUE-002: Physical-device touch and safe-area certification absent

- Severity: Medium
- Release blocking: No
- Affected environment: notch devices and physical touch hardware
- Reproduction: evidence is Chromium emulation plus safe-area simulation only.
- Impact: real-device ergonomics and multi-touch are unverified.
- Workaround: retain emulation evidence and perform hardware sign-off before broader release.
- Planned milestone: post-prototype device validation.

### RC-ISSUE-003: Canvas board lacks semantic and complete keyboard access

- Severity: Medium
- Release blocking: No
- Affected environment: screen readers and keyboard-only board play
- Reproduction: board cells are Phaser canvas; only Escape/H and ARIA status are supported.
- Impact: no semantic cell mirror or full keyboard board navigation.
- Workaround: use pointer/touch input and HUD announcements.
- Planned milestone: Practical Milestone 3 or later accessibility work.

### RC-ISSUE-004: Browser zoom has no semantic canvas reflow

- Severity: Low
- Release blocking: No
- Affected environment: browser zoom users
- Reproduction: Phaser canvas scales visually rather than providing DOM reflow.
- Impact: tested zoom is usable but is not WCAG reflow certification.
- Workaround: use tested viewport/layout settings.
- Planned milestone: later accessibility work.

### RC-ISSUE-005: Shared-host frame pacing varies

- Severity: Advisory
- Release blocking: No
- Affected environment: shared Codespaces or CI hosts
- Reproduction: desktop P95 and the historical wildcard frame vary by host scheduling.
- Impact: evidence is not a 60 FPS certification.
- Workaround: use deterministic state/lifecycle assertions and remeasure on target hardware.
- Planned milestone: performance work after prototype scope.

### RC-ISSUE-006: Prototype scope and bundle advisory

- Severity: Low
- Release blocking: No
- Affected environment: all builds
- Reproduction: placeholder visuals; no sound, final art, narrative, saves; score and collection objectives only; enhanced combinations deferred; Vite reports its Phaser-sized main chunk.
- Impact: incomplete product scope and a non-blocking bundle advisory.
- Workaround: document limits and do not suppress the Vite warning.
- Planned milestone: Practical Milestone 3 and later.

### RC-ISSUE-007: Dependency audit advisories

- Severity: High
- Release blocking: No
- Affected environment: development and CI dependency installation
- Reproduction: `npm ci` completes, then npm reports five high-severity dependency advisories.
- Impact: the lockfile's transitive dependency graph requires a separately reviewed update.
- Workaround: do not use `npm audit fix --force` during release hardening; review and update dependencies in a dedicated change.
- Planned milestone: dependency-maintenance follow-up.
