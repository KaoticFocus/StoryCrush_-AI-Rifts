# StoryCrush: AI Rifts

StoryCrush is a narrative-driven match-3 concept where player choices and cross-universe rifts reshape gameplay outcomes.

This repository is currently in Phase 1G (deterministic scoring, objectives, move consumption, and level outcomes).

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
- Tooling is configured: Vitest, ESLint, Prettier, type-check, and production build.
- A minimal Phaser boot flow is still live: BootScene -> MainMenuScene.

Gameplay presentation systems are not implemented yet.

## Project Description

This foundation build currently validates:

- Browser boot and Phaser initialization
- Minimal scene registration and transition
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
- Non-interactive verification pipeline for CI-style checks

It intentionally does not include rendered puzzle gameplay. Resolution and level outcomes exist only in deterministic domain layers and are currently test-driven.
These systems are still domain-only and are not player-visible in Phaser scenes.
It does not yet include Phaser board rendering, gameplay input, animations, sound, narrative branching systems, rift mechanics, saves, universe content, or AI features.

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
```

## Verification Command

Use this before considering a change complete:

```bash
npm run verify
```

This runs formatting checks, lint, type-check, tests, and production build in a non-watch flow.

## Project Structure Summary

```text
src/
	main.ts
	game/
		config.ts
		board/
			Board.ts
			applyGravity.ts
			deadBoard.ts
			boardTypes.ts
			boardValidation.ts
			generateBoard.ts
			index.ts
			matchDetection.ts
			pieceInventory.ts
			refillBoard.ts
			removeMatches.ts
			reshuffleBoard.ts
			resolveCascade.ts
			resolutionGrid.ts
			seededRandom.ts
			swapValidation.ts
			validMoves.ts
		scenes/
			BootScene.ts
			MainMenuScene.ts
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
			pieceInventory.test.ts
			refillBoard.test.ts
			removeMatches.test.ts
			reshuffleBoard.test.ts
			resolveCascade.test.ts
			seededRandom.test.ts
			swapValidation.test.ts
			validMoves.test.ts
		level/
			applyLevelMove.test.ts
			collectionEvents.test.ts
			createLevelSession.test.ts
			levelValidation.test.ts
			objectives.test.ts
			scoring.test.ts
			seedDerivation.test.ts

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

## Current Milestone Notes

Phase 1G behavior is fully domain-only and serialization-friendly:

- Playable swaps include ordinary matches, wildcard swaps, and special-to-special swaps.
- Special activations use deterministic FIFO chain processing with one activation per coordinate per step.
- Wildcards use centralized targeting rules for matched, chained, and direct-swap activation.
- Cascade step history now includes activation triggers, activation events, and total affected coordinates.
- Level sessions track immutable score, moves, objectives, and terminal status (`active`, `won`, `failed`).
- Accepted playable moves consume exactly one move; rejected and terminal move requests consume zero.
- Score derives from structured cascade history:
  - Piece-clear points from actual removed coordinates.
  - Special activation bonuses from activation events.
  - Integer cascade multiplier by step index.
- Supported objective types are score and piece collection only.
- Active dead boards are automatically reshuffled via deterministic seed derivation and existing reshuffle rules.

Default scoring rules:

- `pointsPerRemovedPiece`: 10
- `lineClearActivationBonus`: 40
- `areaClearActivationBonus`: 50
- `wildcardActivationBonus`: 60
- `cascadeMultiplierIncrement`: 1

These behaviors are covered by tests under `tests/unit/board` and `tests/unit/level`, including:

- `specialActivation.test.ts`
- `wildcardTargeting.test.ts`
- `playableSwapValidation.test.ts`
- `specialActivationResolution.test.ts`
- `scoring.test.ts`
- `collectionEvents.test.ts`
- `createLevelSession.test.ts`
- `applyLevelMove.test.ts`

This milestone remains non-visual and domain-only. Phaser scenes are unchanged and do not render puzzle gameplay yet.
