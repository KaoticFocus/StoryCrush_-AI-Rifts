# Development Roadmap (Implementation Sequence)

## Current Status

- Phase 0 audit completed with evidence in docs.
- Phase 0B foundation scaffold complete (toolchain + minimal Phaser boot flow).
- Phase 1A is complete: deterministic board model, seeded generation, swap validation, and match detection.
- Phase 1B is complete: deterministic match resolution (removal, gravity, refill, cascades).
- Phase 1C is complete: valid-move analysis, dead-board detection, and deterministic dead-board reshuffling.
- Phase 1D is complete: match-shape classification and special-piece planning.
- Phase 1E is complete: discriminated board-piece modeling and special-piece placement.
- Phase 1F is complete: activation-aware playable swap validation, deterministic special activation effects, chain reactions, and activation-aware dead-board/reshuffle analysis.
- Phase 1G is complete: deterministic level-domain scoring, move consumption, score and collection objectives, win/failure evaluation, and session-level dead-board recovery orchestration.
- Phase 1H-A is complete: first playable Phaser puzzle scene, responsive board rendering, pointer/touch input, HUD synchronization, deterministic prototype level, and restart/menu flow.
- Phase 1H-B1 is complete: deterministic playback planning, accepted/rejected swap animation, match highlighting, generic special feedback, removal, special creation, gravity, refill, cascade sequencing, reshuffle fade fallback, playback controls, reduced motion, and final-state synchronization.
- Phase 1H-B2 is current and implemented: distinct special-effect presentation, deterministic reshuffle movement, incremental score feedback, incremental objective feedback, refined timing, and reduced-motion equivalents.
- Phase 1I-A is complete.
- Phase 1I-B1 is complete: viewport screenshots, zoom, touch emulation,
  safe-area simulation, and wildcard outlier classification are recorded in
  `performance-accessibility-audit.md`. Physical-device and canvas-semantics
  limits remain documented there.
- Practical Milestone 2 / Phase 1I-B2 is locally complete: local release gates,
  preview parity, regression matrix, CI verification/browser-smoke workflows,
  static-host configuration, release checklist, known-issue classification, and
  release-candidate handoff are verified. GitHub-hosted workflow observation and
  public deployed-site smoke remain externally blocked pending a push plus a
  real URL or deployment credentials.
- Practical Milestone 3 is active as a mobile-first narrative-shell milestone.
  Phase 2A delivers a placeholder Fantasy chapter, typed flow-controller state,
  puzzle-lab isolation, and the menu-to-map-to-story-to-puzzle-to-results-to-consequence loop.
  Phase 2B adds durable browser persistence with restore-on-startup, continue-state availability,
  migration-tolerant storage handling, and persistence-coordinator auto-save behavior.

## Phase 0B - Foundation Scaffold

### Objective

Create the smallest reliable TypeScript + Phaser + Vite foundation with automated verification.

### Implemented Deliverables

- package.json with dev/build/preview/test/lint/typecheck/format/verify scripts
- TypeScript, Vite, Vitest, ESLint, and Prettier configuration
- Minimal app boot with BootScene -> MainMenuScene transition
- Basic startup fallback error message in HTML shell
- Framework-independent utility test example (clamp)

### Exit Gate Before Phase 1

Phase 1 work must not begin until the following pass:

- npm run format:check
- npm run lint
- npm run typecheck
- npm run test:run
- npm run build
- npm run verify

Status: complete.

## Phase 1A - Deterministic Board Foundation

### Objective

Implement framework-independent board-domain rules with deterministic behavior and unit tests.

### Implemented Scope

- Board dimensions and coordinate contracts
- Piece-grid board representation
- Deterministic seeded RNG
- Initial board generation without initial matches
- Structural swap validation
- Scoring-swap validation
- Horizontal and vertical match detection

### Deferred to Future Phase 1 Work

- None. Phase 1A scope is complete.

## Phase 1B - Deterministic Match Resolution

### Objective

Resolve accepted scoring swaps through deterministic removal, gravity, refill, and cascade stabilization.

### In Scope

- Match removal to transient empty-cell grid
- Column gravity with order preservation
- Deterministic refill with placement metadata
- Full cascade resolution with step history and safety limit

### Out of Scope (Reserved for Phase 1C)

- Valid-move discovery
- Dead-board detection
- Deterministic reshuffling
- Guaranteed available move after reshuffle

## Phase 1C - Playability Analysis and Dead-Board Recovery

### Objective

Add deterministic analysis and recovery so stable boards can be evaluated for playability and dead boards can be reshuffled safely.

### In Scope

- Valid scoring-swap enumeration
- Dead-board detection for stable boards
- Piece inventory counting
- Deterministic dead-board reshuffle with bounded search and explicit failure

### Future Work Beyond Phase 1C

- Initial board generation is still not guaranteed to include at least one valid scoring move.

## Phase 1D - Match-Shape Classification and Special-Piece Planning

### Objective

Classify match geometry deterministically and plan special-piece creation without activating specials yet.

### Implemented Scope

- Match grouping across intersecting runs
- Shape classification for straight, L, T, cross, and complex groups
- Deterministic special-piece creation planning

Status: complete.

## Phase 1E - Discriminated Board-Piece Model and Special-Piece Placement

### Objective

Migrate the board-domain model from raw piece-type strings to discriminated board-piece objects and apply planned special-piece placements during cascade resolution.

### Implemented Scope

- Standard and special board-piece factories and type guards
- Immutable board storage using `BoardPiece` objects
- Board snapshots and resolution grids that preserve exact piece identity
- Exact inventory counting and reshuffle behavior for special pieces
- Special-piece placement integrated into cascade planning and application

### Deferred to Future Phase 1 Work

- None. Phase 1E scope is complete.

## Phase 1F - Special-Piece Activation and Deterministic Activation Chains

### Objective

Resolve special-piece effects in deterministic, serializable, domain-only board logic and integrate activation chains into cascade resolution.

### Implemented Scope

- Activation-aware playable swap validation
- Line-clear, area-clear, and wildcard activation effects
- Direct special combinations and wildcard direct-target rules
- FIFO activation queue with reason priority and one-activation-per-coordinate
- Activation metadata in cascade step history
- Activation-aware playable-move enumeration and dead-board logic
- Activation-aware reshuffle acceptance

Status: complete.

## Phase 1G - Deterministic Scoring and Outcome Evaluation

### Implemented Scope

- Deterministic scoring events
- Base match scoring
- Special activation scoring
- Cascade multipliers
- Move consumption
- Collection and score objectives
- Win and failure state evaluation

Status: complete.

### Explicitly Out of Scope for Phase 1G

- Phaser rendering and animation integration
- Narrative integration changes

## Phase 1H-A - Phaser Puzzle Scene, Rendering, Input, and HUD (Complete)

### Implemented Scope

- Phaser puzzle scene
- Responsive placeholder board rendering
- Pointer and touch selection
- Adjacent swap submission to level domain
- Immediate accepted-move synchronization to authoritative level state
- HUD display for score, moves, objectives, and level status
- Prototype-level restart and menu navigation

### Explicitly Deferred to Phase 1H-B

- Swap animation
- Rejected swap return animation
- Match-removal animation
- Special activation animation
- Gravity animation
- Refill animation
- Cascade sequencing and playback
- Reshuffle animation
- Playback controls driven from deterministic resolution history

### Still Out of Scope

- Narrative systems and story progression
- Final art and audio polish
- AI integrations

Phase 1H-A establishes the first playable prototype while keeping board and level rules fully outside Phaser.

## Phase 1H-B1 - Resolution Playback Engine and Core Board Animations (Complete)

### Implemented Scope

- Pure serializable playback plan built from `AcceptedLevelMoveResult`
- Accepted swap animation
- Rejected adjacent swap-and-return animation
- Match highlighting
- Generic line-clear, area-clear, and wildcard activation feedback
- Matched-piece removal animation
- Special-piece creation appearance animation
- Gravity movement planning and animation
- Refill entry planning and animation
- Sequential cascade playback with cascade labels and pauses
- Reshuffle fade-out / rebuild / fade-in fallback
- Final authoritative-state synchronization
- Playback speed controls: normal, fast, instant
- Reduced-motion toggle
- Safe cancellation on restart, menu exit, resize, shutdown, and playback failure

### Architectural Constraint

- All timing and visuals remain outside the board and level domains.

## Phase 1H-B2 - Presentation Effects and Polishing (Complete)

### Implemented Scope

- Traveling horizontal and vertical line-clear beam animations
- Area-clear explosion presentation
- Wildcard target presentation and choreography
- Improved activation-chain choreography
- Individual reshuffle movement
- Incremental score and objective feedback
- Animation timing polish and accessibility review

### Architectural Constraint

- All timing and visuals remain outside the board and level domains.

## Phase 1I - Prototype Gameplay Polish and QA (Next)

### Reserved Scope

- Hint presentation using existing playable-move APIs
- Pause and resume
- Lightweight settings persistence
- Gameplay accessibility review
- Performance profiling
- Playback and layout polish
- Formal QA pass for the prototype gameplay loop

## Smallest Safe Implementation Sequence

1. Establish project foundation

- Initialize TypeScript + Phaser 3 + Vite.
- Add Vitest, ESLint, Prettier.
- Define run/build/test/lint/type-check scripts.
- Add minimal app boot that renders a placeholder scene.

2. Implement core match-3 engine (deterministic)

- Board model, swaps, match detection, remove/fall/refill/cascades.
- Moves, score, objectives, win/fail.
- Dead-board detection and reshuffle.
- Seeded RNG.
- Unit tests for all core rule paths.

3. Implement game shell and scene flow

- Loading/title/map/dialogue/choice/puzzle/results/settings screens.
- Save/resume loop with localStorage.

4. Implement content model and validation

- Schemas for universes/chapters/levels/choices/rifts/objectives.
- Validation pass for IDs, links, and asset refs.

5. Implement narrative consequences

- Story flags, choice prerequisites, relationship deltas.
- One demonstrable decision affecting later puzzle conditions.

6. Implement reusable rift system

- State machine and configurable modifiers.
- At least three modifiers: corruption spread, rule inversion, cross-universe intrusion.

7. Build Fantasy vertical-slice content

- Three scenes, three standard levels, one choice-driven variation, one major rift.

8. Build Cyberpunk vertical-slice content

- Three scenes, three standard levels, one firewall control level, one parallel chapter.

9. Build convergence event

- Combined mechanics and dual progress tracks.

10. Add butterfly token progression

- Persistent reward with visible map impact and capped balance.

11. Add optional AI layer with safe fallback

- Provider interface, schema validation, timeout/retry/cache/cost guards.
- Zero dependency of core progression on AI availability.

## Recommended Issue Order

1. Audit repository and document architecture (done)
2. Establish build/test/lint/type-check commands
3. Implement board-state model
4. Implement swapping and match detection
5. Implement cascades and refill
6. Implement goals, moves, win/failure
7. Implement special pieces
8. Create game scene flow
9. Create content schemas and validation
10. Implement save system
11. Implement story flags and choices
12. Implement relationships and consequences
13. Implement reusable rift state machine
14. Build Fantasy levels
15. Build Cyberpunk levels
16. Build convergence event
17. Implement butterfly token progression
18. Add AI provider interface
19. Add generated epilogue with fallback
20. Add accessibility/performance settings
21. Package closed-beta build

## Definition of Done for Each Milestone

- Feature integrated into application flow.
- Automated tests added/updated.
- Existing tests pass.
- Type-check, lint, and production build pass.
- Docs and known limitations updated.
- No duplicate system introduced unnecessarily.
