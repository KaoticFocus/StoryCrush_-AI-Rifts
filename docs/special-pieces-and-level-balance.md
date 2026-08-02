# Special Pieces and Level Balance Direction

This is a repository design source document for StoryCrush: AI Rifts. It records the approved product direction for special pieces and how that direction relates to longer Fantasy level goals.

## Match hierarchy

| Pattern       | Approved special                   | Approved eventual effect                              |
| ------------- | ---------------------------------- | ----------------------------------------------------- |
| Straight four | Directional line special           | Clears one complete row or column                     |
| T or L five   | Cross special                      | Clears its complete row and column                    |
| Straight five | Genre-specific type-targeting core | Targets all pieces matching the activation type       |
| Six or more   | Reserved                           | Enhanced core or bonus behavior after later balancing |

## Required principles

- Four is useful.
- T/L is powerful.
- Straight five is exceptional.
- Player-created specials use deterministic swap-based placement.
- Cascade-created specials use deterministic placement.
- Specials normally remain on the board until activated.
- Effect targets, score, objective progress, and cascades remain deterministic.
- The board engine decides affected cells.
- The genre layer decides presentation.
- Fantasy may use runes, sigils, and lightning.
- Cyberpunk may use data sweeps, grid overloads, and network purge effects.
- Special combinations are later scope.
- Level goals are retested before and after special-rule alignment.

## Existing-engine reconciliation

The repository already has a mature special-piece engine from Phases 1D–1H. The future gameplay task is an alignment and refinement pass against the approved product rules, not a greenfield rewrite or a duplicate special system.

Current confirmed engine behavior includes:

- Straight four creates `line-clear`.
- Straight five-plus creates `wildcard`.
- T, L, and cross matches create `area-clear`.
- `line-clear` clears its stored row or column.
- `area-clear` clears a 3×3 region.
- `wildcard` supports selected-type targeting.
- Creation placement and activation chains are deterministic.
- Scoring includes removed-piece points, special bonuses, and cascade multipliers.

### Current deltas versus approved future rules

```text
Current straight-four orientation: follows the match
Approved future orientation: perpendicular to the match

Current T/L/cross effect: 3×3 area clear
Approved future T/L effect: full row-and-column cross clear

Current straight-five behavior: wildcard/type targeting
Approved future presentation: genre-specific lightning or equivalent
```

Six-plus behavior remains reserved for later balancing.

Internal mechanics remain genre-neutral. Visuals, audio, naming, and dialogue become genre-specific in presentation layers.

## Relationship to Phase 3A.1 longer levels

Phase 3A.1 lengthens Fantasy score goals so ordinary play lasts longer under the current special engine. After special-rule alignment, average score output is expected to rise, so level goals must be retested before and after that dedicated pass.

Do not implement the approved future special-rule deltas in the Phase 3A.1 balance PR.
