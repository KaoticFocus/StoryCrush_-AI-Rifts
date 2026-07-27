# StoryCrush: AI Rifts - Product Scope (Vertical Slice)

## Objective

Deliver a 20-30 minute playable vertical slice that validates:

1. Match-3 gameplay is satisfying.
2. Narrative choices affect later gameplay.
3. Rifts change both board behavior and story outcomes.
4. Fantasy and Cyberpunk can collide in a convincing convergence.

## In Scope (Vertical Slice Only)

- Two universes only: Fantasy and Cyberpunk.
- One end-to-end playable loop:
  - Title -> map -> chapter intro -> dialogue -> story choice -> puzzle -> result -> map.
- One meaningful early choice in Fantasy:
  - Free corrupted dragon OR harness dragon power.
- One reused rift framework with at least one major corrupted dragon rift and one cross-universe convergence event.
- Save/resume support for local prototype use.
- Deterministic content for core systems (no AI dependency).

## Out of Scope for Initial Slice

- Nine-universe full content rollout.
- Live ops systems, social systems, guild features, competitive multiplayer.
- Economy-heavy progression and cloud-account infrastructure.
- AI-controlled gameplay rules or permanent save-state mutation.

## Success Metrics

- A player can complete the full loop in 20-30 minutes.
- At least one decision changes both later dialogue and puzzle conditions.
- At least one rift modifies rules/objectives during active play.
- Convergence level includes combined mechanics (not a skin swap).
- Slice remains fully playable with AI features disabled.

## Baseline Constraints from Current Repository

- Repository currently has no application code, no build scripts, no package manifest, and no tests.
- The immediate goal is to establish a minimal project foundation safely (Phase 0/1 prep) before building game features.
