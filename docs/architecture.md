# Architecture Audit and Foundation Plan

## Historical Baseline (Phase 0 Audit)

### Observed Structure

- Root contains only:
  - README.md
  - .git metadata
- No src directory, no tests directory, no docs directory before this Phase 0 update.

### Build and Runtime Tooling

- No package.json or lockfile detected.
- No identified framework, bundler, or test runner currently configured.
- No runnable application entry point detected.

### Existing Systems at Audit Time

- Game systems: not present.
- Narrative systems: not present.
- Save system: not present.
- Content configuration and validation: not present.
- CI scripts/checks: not present.

## Current Scaffold Architecture (Phase 0B)

### Implemented Foundation

- Toolchain:
  - TypeScript
  - Phaser 3
  - Vite
  - Vitest
  - ESLint
  - Prettier
- Scripts:
  - dev, build, preview
  - test, test:run
  - lint, typecheck
  - format, format:check
  - verify
- Minimal app flow:
  - BootScene -> MainMenuScene
- Deterministic utility module with unit tests:
  - clamp utility and test coverage

### Current Directory Shape

- src:
  - main.ts
  - game/config.ts
  - game/scenes/BootScene.ts
  - game/scenes/MainMenuScene.ts
  - styles/global.css
  - types/global.d.ts
  - utils/clamp.ts
- tests:
  - unit/clamp.test.ts

## Architectural Direction (Minimum Safe Start)

Given there is no existing implementation to preserve, adopt a modular architecture that separates rules from rendering and content from code.

## Proposed Top-Level Modules

- app: bootstrapping, configuration, and scene registration.
- game:
  - board: board state and mutation API.
  - matching: swap validation and match finding.
  - scoring: points and combo evaluation.
  - objectives: win/fail objective state.
  - special-pieces: generation and activation logic.
  - hazards: corruption and timed hazards.
  - rifts: rift state machine and modifiers.
- scenes: loading/title/map/dialogue/puzzle/results/settings flow.
- narrative:
  - dialogue, choices, consequences, relationships, flags.
- progression: butterfly tokens and unlock effects.
- content: typed data definitions and authored content.
- services:
  - save (Phase 2B browser-local persistence and restore flow), analytics (stub), audio (stub), ai (interface + fallback).
- ui: reusable presentation components.
- types: shared interfaces.
- utils: deterministic RNG, helpers.

## Core Separation Rules

- Board/game rules must be deterministic and framework-agnostic.
- Phaser scenes render and orchestrate; they do not own core game logic.
- Narrative consequences are data-driven via flags and level modifiers.
- AI integration is optional and cannot gate gameplay completion.

## Phase 0B Guardrails

- Keep scene scope minimal until Phase 1 starts.
- Do not move game rules into Phaser Scene classes.
- Grow directories only when files are needed; avoid empty hierarchy sprawl.

## Phase 1A Board-Domain Architecture (Implemented)

### Module Structure

- src/game/board/boardTypes.ts
  - BoardCoordinate, BoardDimensions, PieceType, match contracts, swap result contracts
- src/game/board/errors.ts
  - BoardDomainError with explicit domain error codes
- src/game/board/boardValidation.ts
  - dimension, coordinate, and allowed-piece validation
- src/game/board/seededRandom.ts
  - deterministic seeded RNG (Mulberry32 variant)
- src/game/board/Board.ts
  - immutable board representation with defensive snapshots and immutable swap
- src/game/board/generateBoard.ts
  - deterministic initial board generation without initial horizontal/vertical matches
- src/game/board/matchDetection.ts
  - pure horizontal/vertical run detection (length >= 3)
- src/game/board/swapValidation.ts
  - structural swap validation and scoring-swap validation
- src/game/board/index.ts
  - board-domain public exports

### Coordinate Convention

- Coordinates use row/column only.
- row increases top-to-bottom.
- column increases left-to-right.
- Indexing is zero-based.

### Board State Representation

- Each cell stores a stable PieceType string identifier.
- No Phaser objects or visual metadata are stored in board state.

### Mutability Decision

- Board state operations are immutable by default.
- Board.toGridSnapshot returns a defensive deep copy.
- Board.swapPieces returns a new Board instance.

### RNG Decision

- SeededRandom uses a deterministic integer-seed algorithm.
- Deterministic generation avoids Math.random usage.
- Invalid seeds throw explicit domain errors.

### Initial Generation Behavior

- Generation fills top-left to bottom-right.
- Candidate piece types that would create immediate horizontal/vertical runs of 3 are excluded.
- Deterministic bounded backtracking is used instead of unbounded retry loops.

### Match Result Contract

- MatchDetectionResult includes:
  - runs: MatchRun[] with orientation, pieceType, and full coordinates
  - matchedCoordinates: unique aggregate coordinates for all runs

### Swap Validation Separation

- Structural swap validation checks:
  - in-bounds coordinates
  - non-identical coordinates
  - orthogonal adjacency
- Scoring swap validation checks:
  - structurally valid swap
  - at least one post-swap match involving one or both swapped coordinates
  - rejected scoring swaps preserve the accepted gameplay state (original board)

## Phase 1B Resolution Architecture (Implemented)

### Stable Board vs Transient Grid

- Board remains a fully populated immutable state object.
- Resolution operations that require empty cells use a transient ResolvableGrid where cells are PieceType or null.
- Refill converts transient grids back to a fully populated Board.

### Resolution Pipeline

For accepted scoring swaps, resolution runs in this order:

1. Apply accepted swap (immutable)
2. Detect matches on swapped board
3. Remove uniquely matched coordinates (set to null)
4. Apply vertical gravity per column
5. Refill null cells deterministically
6. Detect new matches and repeat until stable

### Gravity Behavior

- Gravity compacts each column independently toward the bottom.
- Surviving piece order within each column is preserved.
- Empty cells accumulate at the top.
- Gravity does not refill and does not detect matches.

### Refill Behavior

- Refill processes columns left-to-right.
- Within each column, empty cells are filled bottom-to-top.
- Random consumption follows that traversal order for deterministic replay.
- Refill outputs metadata of every created piece and destination coordinate.

### Cascade Contract

- resolveCascade returns structured step history containing:
  - boardBeforeRemoval
  - match runs and unique matched coordinates
  - gridAfterRemoval
  - gridAfterGravity
  - refill placements
  - boardAfterRefill
- This history is intended for future Phaser animation orchestration while keeping rules in domain code.

### Cascade Safety Limit

- Cascade resolution enforces maxCascadeSteps (default 100).
- Invalid limits fail with invalid-cascade-limit.
- Exceeding the limit fails with cascade-limit-exceeded.

### Immutability and Serialization

- Source boards and source grids are not mutated by resolution operations.
- Public result arrays are returned as fresh snapshots.
- Board snapshots and cascade step data are serializable for deterministic debugging.

## Phase 1C Playability Analysis and Reshuffle (Implemented)

### Valid-Move Enumeration

- Valid moves are enumerated using deterministic row-major traversal.
- For each coordinate, only right and bottom neighbors are inspected.
- Reversed duplicates are avoided by construction (A->B inspected once).
- Existing scoring-swap validation is reused to keep one scoring definition.

### Stable Board Requirement

- Dead-board analysis requires a stable board.
- Stable means no active horizontal/vertical match runs on the populated board.
- Boards with active matches fail analysis with board-not-stable.

### Dead-Board Definition

- A board is dead when it is stable and has zero valid scoring swaps.
- A stable board with at least one valid scoring swap is not dead.

### Piece Inventory Contract

- Piece inventory is reported as deterministic PieceType->count mapping.
- Inventory totals equal board cell count and support exact multiset comparisons.

### Reshuffle Invariants

Successful reshuffles preserve all of the following:

- Unchanged dimensions
- Exact piece-type counts
- No immediate match runs
- At least one valid scoring swap
- Deterministic results for identical inputs and seed/source

## Phase 1H-A / 1H-B1 Presentation Boundary (Implemented)

### Core Rule

- Board and level domains remain the only gameplay authorities.
- Phaser scenes render immutable state, collect pointer input, submit move requests, and display results.
- Phaser does not calculate swap validity, matches, cascades, score, objectives, move consumption, win/failure, or reshuffles.

### Presentation Modules

- `src/game/content/prototypeLevel.ts`
  - Fixed deterministic prototype level definition and initial board.
- `src/game/presentation/PuzzleSessionController.ts`
  - Holds the current immutable `LevelSessionState`.
  - Delegates swap requests to `applyLevelMove`.
  - Replaces state only after accepted results.
  - Preserves state after rejected or terminal results.
  - Recreates the initial deterministic session on restart.
- `src/game/presentation/puzzleLayout.ts`
  - Centralizes responsive HUD/board/footer geometry.
  - Converts board coordinates to screen positions and pointer positions back to board coordinates.
- `src/game/presentation/boardViewModel.ts`
  - Converts immutable `Board` state into presentation-friendly cell data.
- `src/game/presentation/levelViewModel.ts`
  - Formats score, moves, objectives, status, and move-summary text for HUD display.
- `src/game/presentation/pieceAppearance.ts`
  - Maps every standard and special `BoardPiece` kind to distinct placeholder styling.
- `src/game/presentation/BoardView.ts`
  - Tracks one piece display object per occupied coordinate.
  - Renders selection, hover, disabled state, and playback effects.
  - Executes swap, highlight, activation, removal, creation, gravity, refill, cascade-label, reshuffle-fallback, and synchronization commands.
- `src/game/presentation/HudView.ts`
  - Renders score, moves, objectives, status, summary text, restart, menu actions, playback mode, and reduced-motion controls.
- `src/game/presentation/playback/playbackTypes.ts`
  - Defines serializable playback command contracts and summary metadata.
- `src/game/presentation/playback/buildMovePlaybackPlan.ts`
  - Converts immutable accepted-move history into deterministic presentation commands.
- `src/game/presentation/playback/gravityMovementPlanning.ts`
  - Derives gravity movements from transient grids without piece IDs.
- `src/game/presentation/playback/refillPresentationPlanning.ts`
  - Derives deterministic refill entry ordering and off-board start rows.
- `src/game/presentation/playback/specialEffectPlanning.ts`
  - Converts `SpecialActivationEvent` data into serializable line-clear, area-clear, wildcard-target, and full-board effect plans.
- `src/game/presentation/playback/reshuffleMovementPlanning.ts`
  - Maps exact piece identity from original board to reshuffled board using row-major pairing per identity key.
- `src/game/presentation/playback/scorePresentationPlanning.ts`
  - Converts ordered score events into cumulative score presentation entries.
- `src/game/presentation/playback/objectivePresentationPlanning.ts`
  - Converts collection events and objective updates into incremental objective feedback plans.
- `src/game/presentation/playback/playbackTimings.ts`
  - Centralizes mode-dependent, reduced-motion, and effect-intensity timing rules.
- `src/game/presentation/playback/ResolutionPlaybackController.ts`
  - Executes playback plans sequentially, coordinates cancellation, and hard-syncs on failure.

### Scene Responsibilities

- `PuzzleScene` owns scene lifecycle, controller creation, authoritative-state overrides for playback, HUD synchronization timing, resize cancellation, restart/menu cancellation, and presentation-only input locking.
- `MainMenuScene` exposes the prototype entry point and no longer acts only as a diagnostic screen.

### Coordinate Conversion

- Domain-facing APIs use zero-based `{ row, column }` only.
- Screen-space math is isolated in `puzzleLayout.ts`.
- Pointer positions outside the board return `null` and never produce domain move requests.

### Responsive Layout

- Portrait layout places HUD above the board and controls below it.
- Landscape layout places the HUD beside the board when space allows.
- Cell size remains square and is derived from the current viewport.
- Resize preserves the current session state and recomputes layout without consuming moves.

### Authoritative State Versus Display State

- `PuzzleSessionController` adopts accepted `nextState` immediately after the domain move succeeds.
- During accepted playback, BoardView renders from `previousState.board` and transient step snapshots.
- Display-state animation never becomes gameplay authority.
- Final HUD values come from the authoritative controller state after playback completes.

### Playback Plan Sequencing

- Accepted playback begins with the swap command.
- Each cascade step plays in this order:
  - match highlight
  - special activation feedback in domain event order
  - linked score feedback for special activations
  - piece removal
  - linked piece-clear score feedback
  - linked collection-objective feedback
  - protected special creation appearance
  - gravity
  - refill
  - cascade pause before the next step
- Reshuffle, when present, plays after cascades as deterministic per-piece movement.
- The last command always hard-synchronizes the rendered board to authoritative state.

### Special-Effect Presentation

- Horizontal line clear uses a directional beam from the source toward both row edges.
- Vertical line clear mirrors that behavior toward column edges.
- Area clear uses a compact radial shockwave and ring-based affected-cell flashing.
- Wildcard target effects mark domain-provided targets and optionally draw lightweight connection lines.
- Wildcard full-board activation uses a controlled board-wide wave instead of an intense full-screen flash.
- Newly triggered specials receive a short emphasis pulse but do not activate early.

### Incremental HUD Feedback

- Score changes follow domain `ScoreEvent` ordering and animate toward each cumulative score target.
- Collection-objective feedback follows actual `PieceCollectionEvent` records.
- Score-objective feedback follows the same cumulative score transitions used by the score counter.
- Final score and objective values are hard-synchronized from authoritative state after playback.

### Gravity and Refill Planning

- Gravity movement is derived column-by-column from `gridAfterRemovalAndCreation` and `gridAfterGravity`.
- Movement pairing uses preserved bottom-to-top survivor order rather than object identity.
- Refill entry planning uses domain `RefillPlacement[]` ordering and deterministic off-board start rows per column.

### Input Locking

- Input locking lives only in `PuzzleScene`.
- Input is locked during accepted playback, rejected adjacent playback, and whenever the level state is terminal.
- The controller and domains remain stateless about view locks.

### Cancellation and Resize Behavior

- Restart, menu exit, resize, shutdown, and playback failure cancel active tweens and delayed callbacks.
- The same cancellation path now also stops score counters, objective counters, collection feedback, and reshuffle movement.
- Cancellation clears temporary highlights, labels, and stale selection.
- Resize does not preserve partial tween progress; it cancels playback and rebuilds from authoritative state.
- Playback failure never rolls back an accepted move; it logs the error and hard-syncs view state.

### Development Consistency Checks

- BoardView keeps a coordinate-keyed display-object map.
- Development assertions verify one rendered piece per occupied coordinate, no pieces for transient null cells, and piece-kind/piece-type agreement with the expected snapshot.

### Phase 1I-B1 Browser Diagnostics Contract

Browser observability is a presentation-only test boundary and cannot mutate
board or level state.

- `e2e=1` enables the hidden `#storycrush-test-status` bridge and its basic
  read-only scene and gameplay status.
- `debugPerformance=1` is effective only with `e2e=1`, adding frame samples and
  resource-category counts.
- Basic status is available without performance collection; performance
  attributes are absent unless diagnostics are enabled.
- `data-diagnostics-state` is `disabled` without diagnostics, then
  `initializing` and `ready` when requested. An optional diagnostics failure is
  represented by `error` without preventing puzzle load.
- Playwright centralizes URL construction and waits for diagnostics `ready`
  before reading performance attributes.
- `PuzzleScene` owns resize, visibility, and keyboard listeners; `BoardView`
  and `HudView` own display objects, effects, tweens, and timers. Shutdown
  cancels and removes these resources before the next scene generation.
- The DOM shell applies four-way safe-area padding, and Phaser recomputes
  logical board geometry after resize. Reduced motion changes only
  choreography/timing, never domain command ordering.
- The polite ARIA live region is separate from the hidden E2E bridge and is
  fed from authoritative presentation events. Canvas cells remain
  non-semantic; full keyboard board navigation is deferred.
- `safeAreaTest=1` is only honored with `e2e=1`; it applies CSS-only simulated
  30/12/24/12 px insets. The game recalculates Phaser logical geometry within
  the resulting canvas, and browser tests verify corner-cell conversion.
- The evidence suite captures stable preview screenshots under
  `docs/evidence/phase-1i-b1` and uses Playwright touchscreen input for mobile
  gesture/target checks. Browser emulation is not physical-device validation.
- Wildcard outlier measurement samples bounded RAF intervals across repeated
  runs. Only over-100-ms intervals record the active presentation command,
  avoiding raw frame logs while enabling command-correlation classification.

### Phase 1I Deferrals

- Hint presentation remains deferred.
- Pause/resume remains deferred.
- Settings persistence remains deferred.
- Performance profiling and formal QA remain deferred.

### Reshuffle Strategy

Stage A - Seeded permutation attempts:

- Flatten piece list
- Deterministic Fisher-Yates permutation
- Candidate reconstruction and acceptance checks
- Bounded by maxRandomAttempts

Stage B - Deterministic bounded fallback search:

- Row-major backtracking with remaining piece counts
- Local no-run-of-three placement checks
- Deterministic candidate ordering (remaining counts + seeded tie-break)
- Bounded by maxSearchNodes

### Explicit Failure Behavior

- Invalid limits fail with invalid-reshuffle-limit.
- Unstable boards fail with board-not-stable.
- Non-dead boards fail with board-not-dead.
- Bounded search exhaustion fails with reshuffle-search-exhausted.

### Separation from Cascade Resolution

- resolveCascade does not automatically reshuffle.
- Cascade resolution and dead-board recovery remain separate operations.
- A future orchestrator can call resolveCascade -> dead-board analysis -> reshuffle when needed.

## Phase 1D Match-Shape Classification and Special-Piece Planning (Implemented)

### Match Grouping and Shapes

- Intersecting horizontal and vertical runs are grouped into a single match group.
- Groups are classified into `straight-3`, `straight-4`, `straight-5-plus`, `l-shape`, `t-shape`, `cross-shape`, or `complex`.
- Classification remains deterministic and purely derived from run geometry.

### Special-Piece Planning

- Special-piece creation is represented as serializable planning metadata.
- The planner chooses a creation coordinate and planned special kind from the classified shape.
- Planning remains separate from board mutation so cascades stay deterministic and testable.

## Phase 1E Discriminated Board-Piece Model and Special-Piece Placement (Implemented)

### Canonical Board Representation

- Board cells now store discriminated `BoardPiece` objects instead of raw piece-type strings.
- Standard pieces and special pieces share the same board container while preserving exact identity.
- `Board.fromPieceTypes` remains available for convenience when tests or generation want a standard-board shortcut.

### Board-Piece Utilities

- Factories create validated standard and special pieces.
- Type guards and normalization keep board inputs strict and clone-safe.
- Board snapshots deep-clone piece objects so callers cannot mutate internal state.

### Resolution Integration

- Match detection still compares underlying piece type so special pieces of the same color participate in runs consistently.
- Planned special-piece creations are applied during cascade resolution as pure board-piece placement metadata.
- Special pieces are placed into the board during resolution, but activation logic is still deferred to a later phase.

### Exact Inventory and Reshuffle

- Piece inventory now tracks exact piece identities, including special kinds and orientations.
- Dead-board reshuffling preserves exact board-piece multiset behavior instead of collapsing everything back to raw strings.

## Phase 1F Special Activation and Deterministic Activation Chains (Implemented)

### Activation Effects

- Horizontal line-clear activates across the full row, left-to-right.
- Vertical line-clear activates down the full column, top-to-bottom.
- Area-clear activates a clipped radius-1 neighborhood (up to 3x3), row-major.
- Wildcard activation is centralized through wildcard-target resolution and supports:
  - Matched activation (stored piece type)
  - Chain activation (stored piece type)
  - Direct swap with standard (counterpart type)
  - Direct swap with non-wildcard special (counterpart underlying type)
  - Direct wildcard + wildcard swap (entire board)

### Activation Queue and Ordering

- Activations are resolved with FIFO queue behavior.
- Initial direct-swap triggers are ordered destination first, then source.
- Matched-special triggers are appended in row-major order.
- Chain-discovered specials are sorted row-major, then appended.
- A special coordinate activates at most once per resolution step.

### Activation Reason Priority

- Reasons are serializable and deterministic: `direct-swap`, `matched`, `chain-reaction`.
- Priority is strict and enforced for deduplication:
  1. `direct-swap`
  2. `matched`
  3. `chain-reaction`

### Snapshot Rule

- The activation wave resolves against a stable pre-removal snapshot for the current step.
- Queued specials still activate even if another effect also clears their coordinate in the same wave.
- Gravity and refill start only after the activation queue fully resolves.

### Creation and Activation Ordering

- Match planning for new special creation happens before activation resolution.
- Newly planned special coordinates are protected from that step's removal set.
- Existing specials at creation coordinates can activate and be replaced afterward.
- Newly created specials do not activate in the same step they are created.

### Playability and Recovery Migration

- Dead-board analysis now uses activation-aware playable swaps.
- Move enumeration now includes wildcard swaps and special combinations.
- Dead-board reshuffle acceptance now guarantees at least one activation-aware playable move while preserving exact piece inventory.

### Domain Boundary

- Activation resolution remains fully domain-only and independent from Phaser.
- Cascade history includes activation triggers/events for future animation, but no rendering/input concerns are introduced here.

## Phase 1G Level-Domain Scoring, Objectives, and Outcomes (Implemented)

### Board Domain vs Level Domain

- `src/game/board` remains the deterministic puzzle-rules engine.
- `src/game/level` is a deterministic orchestration layer above board rules.
- Board domain resolves swaps and cascades.
- Level domain determines score, objective progress, move consumption, status transitions, and dead-board recovery at session level.
- Neither domain imports Phaser, scenes, display objects, browser DOM APIs, canvas APIs, audio APIs, network services, or AI services.

### Level Definition Contract

- Level definitions are serializable data-only structures.
- Required fields:
  - Stable level id
  - Positive integer move limit
  - Allowed refill piece types
  - One or more objective definitions
  - Scoring rules
  - Deterministic base seed
- Optional per-level limits are supported for cascade/activation/reshuffle safety boundaries.

### Immutable Level Session State

- Session state stores:
  - `levelId`, `baseSeed`
  - Current immutable `Board`
  - Cumulative `score`
  - `movesRemaining`
  - `acceptedMoveCount`
  - `status` (`active`, `won`, `failed`)
  - Objective progress array in objective-definition order
- Transitions are immutable and serialization-safe.
- Terminal states are monotonic: `won` and `failed` never return to `active`.

### Score Event Derivation

- Scoring is derived from Phase 1F resolver history, not board diff reconstruction.
- Piece-clear scoring uses each step's `actualRemovedCoordinates` count.
- Special-activation scoring uses each step's `activationEvents`.
- One event per activation event; no duplicate activation scoring.
- Integer-only arithmetic with explicit safe-integer overflow errors.

### Collection Event Derivation

- Collection events are derived from each step's `actualRemovedCoordinates` and `boardBeforeRemoval`.
- Events record coordinate, full removed piece, and underlying piece type.
- Ordering is deterministic: step index ascending, then row-major coordinates.
- Protected creation coordinates are excluded because they are not in actual removed coordinates.
- Refill placements and reshuffle rearrangements do not directly generate collection events.

### Integer Cascade Multiplier

- Multiplier formula:
  - `1 + stepIndex * cascadeMultiplierIncrement`
- Multiplier applies to both:
  - Piece-clear points
  - Special activation bonuses
- First step is always multiplier `x1`, including direct-special-swap starts.

### Move Consumption Rules

- Accepted playable move: consumes exactly 1 move.
- Rejected move: consumes 0 moves.
- Terminal level move request: consumes 0 moves.
- Accepted move count increments only on accepted moves.

### Objective Progression

- Supported objective types in Phase 1G:
  - Score objective
  - Collect-piece objective
- Score objective progress equals cumulative session score.
- Collect-piece progress increments by matching collection-event piece type.
- Special pieces count by underlying piece type.
- Progress never decreases.

### Status Evaluation Precedence

After an accepted move:

1. Evaluate win first (all objectives complete).
2. Evaluate failure second (objectives incomplete and moves remaining equals zero).
3. Otherwise remain active.

Win precedence ensures completing final objective on final move results in `won`.

### Seed Derivation

- Level-domain seed derivation produces deterministic purpose-specific integer seeds from:
  - Base level seed
  - Accepted move index
  - Purpose (`move-resolution`, `post-move-reshuffle`, `initial-reshuffle`)
- Implementation uses deterministic integer mixing; no `Math.random()` or third-party hashing.

### Transactional Move Application

- `applyLevelMove` acts as an all-or-nothing transaction for accepted moves.
- Ordinary invalid gameplay moves return structured rejected results without throwing.
- Failures in resolution/scoring/reshuffle safety boundaries throw explicit errors and do not return partial next state.

### Automatic Dead-Board Recovery

- During session creation:
  - Stable dead initial boards are reshuffled deterministically before first move.
- After accepted move resolution:
  - If next status is active and final board is dead, deterministic reshuffle is applied.
- Reshuffling consumes no additional move and awards no score or objective progress.

## Determinism Requirements

- Seeded RNG for board generation and reproducible tests.
- Content snapshots for fixed scenario validation.
- Explicit serialization contracts for save/load state.

## Testing Strategy (Initial)

- Unit tests for board operations, match detection, cascading, scoring, objective checks, dead-board reshuffle.
- Integration tests for scene loop and story-choice consequence propagation.
- Content validation tests for references and graph reachability.

## Phase 0 Status Against Exit Criteria

- Project runs locally: satisfied by Phase 0B scaffold.
- Build command known: satisfied.
- Test command known: satisfied.
- Architecture summarized: complete (this document).
- Vertical-slice scope written: complete (docs/product-scope.md).
- No broad rewrite started: complete.

## Release Tooling Boundary (Practical Milestone 2)

- Browser verification is tiered without changing test ownership:
  `test:browser:smoke` selects fast release-blocking fixtures,
  `test:browser:full` runs deterministic regression, and
  `test:browser:soak` selects B1 soak IDs. `test:browser:preview` runs against
  Vite production output.
- Playwright is serial (`workers: 1`, `fullyParallel: false`), keeps trace,
  screenshot, and video only on failure, uses zero local retries, and permits
  one CI retry. A retry pass is a flakiness concern, not silent proof.
- `.github/workflows/verify.yml` runs formatting, lint, typecheck, unit tests,
  and build. `.github/workflows/browser-smoke.yml` installs Chromium only and
  uploads report, trace, screenshot, and video directories only after failure.
- Browser instrumentation remains URL-gated: `e2e=1` exposes a read-only status
  bridge; `debugPerformance=1` separately enables diagnostics. Normal URLs do
  not expose fixtures or diagnostics.
- Escape, H, and M are scene-scoped document keyboard shortcuts with repeat
  filtering. This keeps pause, hint, and menu commands available after canvas or
  HUD interaction; listeners are removed during scene shutdown.
- Static deployment is Vite output only. Netlify-compatible builds run
  `npm run build` and publish `dist`. The app has one entry route, so no SPA
  fallback is configured. Rollback requires host deploy history or a previously
  verified commit reference.
- Workflow YAML and equivalent commands are validated locally. GitHub-hosted
  execution and deployed smoke remain separate evidence and cannot be inferred
  from local preview results.
- Board and level modules remain Phaser-free; release tooling uses normal UI
  input and read-only status, never scene mutation APIs.
