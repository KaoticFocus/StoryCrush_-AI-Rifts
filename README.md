# StoryCrush: AI Rifts

StoryCrush is a narrative-driven match-3 concept where player choices and cross-universe rifts reshape gameplay outcomes.

Practical Milestones 1 and 2 are complete as `prototype-rc1`.
GitHub-hosted verify and browser-smoke workflows ran successfully for the push,
and the prototype is publicly deployed at [https://storycrush-ai-rifts.netlify.app](https://storycrush-ai-rifts.netlify.app).
The draft deployment used for pre-release smoke was [https://6a6a87292c190c238782ef42--storycrush-ai-rifts.netlify.app](https://6a6a87292c190c238782ef42--storycrush-ai-rifts.netlify.app).
The measured audit is available at [docs/performance-accessibility-audit.md](docs/performance-accessibility-audit.md).

## Current Milestone Status

- Phase 0 audit documents are complete.
- Phase 0B scaffold is complete with TypeScript + Phaser + Vite.
- Phase 1A board-domain modules are implemented and unit tested.
- Phase 1B deterministic resolution is implemented (removal, gravity, refill, cascades).
- Phase 1C move-analysis and dead-board recovery are implemented (valid-move enumeration, dead-board checks, deterministic reshuffle).
- Phase 1D match-shape classification and special-piece planning are implemented.
- Phase 1E discriminated board-piece modeling and special-piece placement are implemented.
- Phase 1F activation-aware swap validation, special activation effects, and deterministic activation chains are implemented.
- Phase 1G level-domain scoring, objective progress, move consumption, win/failure evaluation, and dead-board recovery orchestration are implemented.
- Phase 1H-A Phaser presentation is complete with a playable prototype puzzle scene, placeholder piece rendering, pointer/touch input, responsive layout, and HUD synchronization.
- Phase 1H-B1 presentation playback is complete with deterministic playback planning, accepted/rejected swap animation, match highlighting, generic special feedback, removal, special creation, gravity, refill, cascade sequencing, reshuffle fade fallback, and final-state synchronization.
- Phase 1H-B2 presentation polish is implemented with distinct special effects, deterministic reshuffle movement, incremental score feedback, incremental objective feedback, and refined playback timings.
- Tooling is configured: Vitest, ESLint, Prettier, type-check, and production build.
- The main playable flow is BootScene -> MainMenuScene -> Narrative Flow -> PuzzleScene.

Phase 1I prototype hardening and local release-candidate QA are complete. The
prototype retains the documented accessibility, scope, and deployment limits.

## Project Description

This foundation build currently validates:

- Browser boot and Phaser initialization
- Playable Phaser menu-to-puzzle scene flow
- Deterministic board-domain rules outside Phaser runtime
- Discriminated board-piece storage with defensive cloning and validation
- Deterministic swap-resolution pipeline with activation-aware cascade history
- Deterministic playability analysis and dead-board reshuffling with bounded search
- Deterministic special activation effects (line-clear, area-clear, wildcard)
- Deterministic direct special combinations (including wildcard combinations)
- Deterministic special-piece placement during cascades after activation resolution
- Deterministic score calculation from cascade history
- Deterministic move consumption and terminal-level protection
- Deterministic score and piece-collection objectives
- Deterministic level win/failure evaluation
- Deterministic level-session dead-board recovery via reshuffle orchestration
- Responsive Phaser board layout with pointer and touch selection
- Deterministic presentation playback driven only by accepted level-domain history
- Accepted swap animation, rejected adjacent swap-and-return animation, match highlighting, special-effect presentation, removal, gravity, refill, cascades, and deterministic reshuffle movement
- Prototype HUD with incremental score counting, incremental objective progress, completion feedback, status, restart, menu navigation, playback-speed controls, and reduced-motion toggle
- Safe playback cancellation on restart, menu exit, resize, shutdown, and playback failure hard-sync
- Non-interactive verification pipeline for CI-style checks

It intentionally keeps board and level rules outside Phaser. Phaser reads immutable move history, animates display objects, and hard-synchronizes to the authoritative controller state after playback.
It does not yet include final art, sound, full narrative branching, rift mechanics, durable saves, universe content beyond the placeholder Fantasy chapter, or AI features.

## Prerequisites

- Node.js 20+
- npm 10+

## Installation

```bash
npm install
```

## Commands

```bash
npm run dev
npm run build
npm run preview
npm run test
npm run test:run
npm run lint
npm run typecheck
npm run format
npm run format:check
npm run verify
npm run test:browser
npm run test:browser:smoke
npm run test:browser:full
npm run test:browser:preview
npm run test:browser:soak
npm run test:release
npm run test:release:full
```

## Play The Prototype

Run the app locally:

```bash
npm install
npm run dev
```

Then open the app and follow this temporary flow:

- Main menu
- Select `Play Prototype`
- Tap or click one board cell
- Tap or click an orthogonally adjacent cell to submit a move

Input behavior:

- Selecting the same cell deselects it.
- Selecting a non-adjacent cell changes the current selection.
- Rejected adjacent swaps animate out and back, show brief feedback, and consume no moves.
- Accepted swaps animate through swap, match highlight, distinct line-clear/area-clear/wildcard effects, removal, special creation, gravity, refill, cascades, deterministic reshuffle movement when needed, and final authoritative synchronization.
- Restart restores the same deterministic prototype level.

Playback controls:

- `Mode: normal` uses standard timing.
- `Mode: fast` uses approximately half-duration playback.
- `Mode: instant` applies the same logical display updates without visible tween delays.
- `Motion: reduced` shortens or removes scaling and pause-heavy transitions while preserving required position changes.

Current effect behavior:

- Horizontal and vertical line clears use directional beam travel in normal mode and simultaneous lane highlighting in reduced motion.
- Area clear uses a compact radial shockwave in normal mode and simultaneous affected-cell flashing in reduced motion.
- Wildcard targeting marks domain-provided targets and uses full-board wave presentation for entire-board activation.
- Chain reactions preserve domain activation order and emphasize newly triggered specials without activating them early.
- Reshuffles animate deterministic per-piece movement derived from exact piece identity, with reduced-motion fade/reposition behavior.
- Score and objective progress advance incrementally during playback and hard-synchronize at the end.

Cancellation behavior:

- Restart, menu exit, resize, shutdown, and playback failure cancel active tweens and rebuild from the authoritative controller state.
- Terminal states remain input-locked after playback completes.

The prototype level uses an 8 x 8 board, 15 moves, a score target, and a Ruby collection target.

## Verification Command

Use this before considering a change complete:

```bash
npm run verify
```

This runs formatting checks, lint, type-check, tests, and production build in a non-watch flow.

## Browser Test Diagnostics

Browser test instrumentation is opt-in and remains inert during normal gameplay:

- `?e2e=1` exposes the hidden `#storycrush-test-status` bridge with read-only
  scene, fixture, playback, input, render-consistency, board, score, objective,
  and geometry attributes.
- `?e2e=1&debugPerformance=1` additionally enables frame samples and resource
  diagnostics. `data-diagnostics-state` progresses from `initializing` to
  `ready`; performance attributes are absent when diagnostics are disabled.

Run `npm run test:browser` for the desktop and mobile development suite. Run
`npm run test:browser:preview` for the same suite against a built Vite preview
server.

## Accessibility and Viewports

The responsive prototype is exercised at `320 x 568`, `360 x 800`, `390 x 844`,
`412 x 915`, `844 x 390`, `1280 x 720`, and `1440 x 900`. Curated preview
screenshots are in [docs/evidence/phase-1i-b1](docs/evidence/phase-1i-b1).

Desktop Chromium evidence covers 125%, 150%, and 200% page scale. Mobile
Chromium touch emulation covers portrait, narrow portrait, and landscape; the
safe-area simulation is gated by `?e2e=1&safeAreaTest=1` and uses 30/12/24/12 px
top/right/bottom/left insets. These are browser-emulation checks, not physical
device, notch, or formal accessibility certification. Phaser canvas text does
not provide complete DOM-style zoom/reflow.

- `Escape` pauses or resumes the puzzle.
- `H` requests a hint.
- Reduced motion preserves gameplay order while removing nonessential travel
  and scale-heavy effects.
- The polite ARIA status region announces authoritative move, hint, objective,
  terminal, and pause state updates. The board and controls are canvas-only:
  they do not provide complete screen-reader cell semantics or keyboard board
  navigation.

Use `?e2e=1&debugPerformance=1` only for the read-only browser diagnostics
used by automation. It is inactive on normal URLs. See
[docs/performance-results.json](docs/performance-results.json) for structured
measurements. The evidence commands are `npm run test:browser:evidence` and
`npm run test:browser:outlier`.

## Project Structure Summary

```text
src/
	main.ts
	game/
		config.ts
		content/
			prototypeLevel.ts
		board/
			Board.ts
			applyGravity.ts
			applyMatchPlanning.ts
			deadBoard.ts
			errors.ts
			boardTypes.ts
			boardValidation.ts
			generateBoard.ts
			index.ts
			matchDetection.ts
			matchGroups.ts
			pieceInventory.ts
			playableSwapValidation.ts
			refillBoard.ts
			removeMatches.ts
			reshuffleBoard.ts
			resolveCascade.ts
			resolutionGrid.ts
			seededRandom.ts
			specialActivation.ts
			specialPiecePlanning.ts
			swapValidation.ts
			validMoves.ts
			wildcardTargeting.ts
		presentation/
			BoardView.ts
			HudView.ts
			PuzzleSessionController.ts
			boardViewModel.ts
			levelViewModel.ts
			pieceAppearance.ts
			playback/
				ResolutionPlaybackController.ts
				buildMovePlaybackPlan.ts
				gravityMovementPlanning.ts
				objectivePresentationPlanning.ts
				playbackTimings.ts
				playbackTypes.ts
				refillPresentationPlanning.ts
				reshuffleMovementPlanning.ts
				scorePresentationPlanning.ts
				specialEffectPlanning.ts
			puzzleLayout.ts
		scenes/
			BootScene.ts
			MainMenuScene.ts
			PuzzleScene.ts
		level/
			applyLevelMove.ts
			collectionEvents.ts
			createLevelSession.ts
			levelTypes.ts
			levelValidation.ts
			objectives.ts
			scoring.ts
			seedDerivation.ts
			index.ts
	styles/
		global.css
	types/
		global.d.ts
	utils/
		clamp.ts

tests/
	unit/
		clamp.test.ts
		board/
			applyGravity.test.ts
			Board.test.ts
			deadBoard.test.ts
			generateBoard.test.ts
			matchDetection.test.ts
			matchGroups.test.ts
			pieceInventory.test.ts
			playableSwapValidation.test.ts
			refillBoard.test.ts
			removeMatches.test.ts
			reshuffleBoard.test.ts
			resolveCascade.test.ts
			seededRandom.test.ts
			specialActivation.test.ts
			specialActivationResolution.test.ts
			specialPiecePlanning.test.ts
			swapValidation.test.ts
			validMoves.test.ts
			wildcardTargeting.test.ts
		level/
			applyLevelMove.test.ts
			collectionEvents.test.ts
			createLevelSession.test.ts
			levelValidation.test.ts
			objectives.test.ts
			scoring.test.ts
			seedDerivation.test.ts
		presentation/
			PuzzleSessionController.test.ts
			ResolutionPlaybackController.test.ts
			boardViewModel.test.ts
			buildMovePlaybackPlan.test.ts
			gravityMovementPlanning.test.ts
			levelViewModel.test.ts
			objectivePresentationPlanning.test.ts
			playbackTimings.test.ts
			puzzleLayout.test.ts
			refillPresentationPlanning.test.ts
			reshuffleMovementPlanning.test.ts
			scorePresentationPlanning.test.ts
			specialEffectPlanning.test.ts

docs/
	product-scope.md
	architecture.md
	roadmap.md
	content-model.md
	known-issues.md
```

## Documentation

- [docs/product-scope.md](docs/product-scope.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/roadmap.md](docs/roadmap.md)
- [docs/content-model.md](docs/content-model.md)
- [docs/known-issues.md](docs/known-issues.md)
- [docs/release-regression-matrix.md](docs/release-regression-matrix.md)
- [docs/prototype-release-checklist.md](docs/prototype-release-checklist.md)
- [docs/release-candidate-handoff.md](docs/release-candidate-handoff.md)

## Current Milestone Notes

Phase 1H-A uses the existing domain layer as the sole gameplay authority and adds a presentation adapter plus Phaser views:

- Playable swaps include ordinary matches, wildcard swaps, and special-to-special swaps.
- Special activations use deterministic FIFO chain processing with one activation per coordinate per step.
- Wildcards use centralized targeting rules for matched, chained, and direct-swap activation.
- Cascade step history now includes activation triggers, activation events, and total affected coordinates.
- Level sessions track immutable score, moves, objectives, and terminal status (`active`, `won`, `failed`).
- Accepted playable moves consume exactly one move; rejected and terminal move requests consume zero.
- Score derives from structured cascade history.
- Piece-clear points come from actual removed coordinates.
- Special activation bonuses come from activation events.
- Integer cascade multipliers scale by cascade-step index.
- Supported objective types are score and piece collection only.
- Active dead boards are automatically reshuffled via deterministic seed derivation and existing reshuffle rules.
- PuzzleScene does not calculate any board or level rules; it only requests moves and renders returned state.
- Board rendering uses placeholder vector graphics for all standard and special piece kinds.
- HUD text is synchronized from immutable level-session state after every accepted move or restart.
- Resize recalculates layout without restarting the level.
- Detailed swap, removal, gravity, refill, special, and reshuffle playback remains reserved for Phase 1H-B.

Default scoring rules:

- `pointsPerRemovedPiece`: 10
- `lineClearActivationBonus`: 40
- `areaClearActivationBonus`: 50
- `wildcardActivationBonus`: 60
- `cascadeMultiplierIncrement`: 1

These behaviors are covered by tests under `tests/unit/board`, `tests/unit/level`, and `tests/unit/presentation`, including:

- `specialActivation.test.ts`
- `wildcardTargeting.test.ts`
- `playableSwapValidation.test.ts`
- `specialActivationResolution.test.ts`
- `scoring.test.ts`
- `collectionEvents.test.ts`
- `createLevelSession.test.ts`
- `applyLevelMove.test.ts`
- `PuzzleSessionController.test.ts`
- `puzzleLayout.test.ts`
- `boardViewModel.test.ts`
- `levelViewModel.test.ts`

Current limitation: the prototype redraws immediately to the post-resolution board state. It does not yet animate swaps, removals, activations, gravity, refill, cascades, or reshuffles.
