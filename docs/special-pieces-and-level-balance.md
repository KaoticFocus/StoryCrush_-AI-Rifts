# Special Pieces and Level Balance Direction

This is a repository design source document for StoryCrush: AI Rifts. It records the approved product direction for special pieces and how that direction relates to longer Fantasy level goals and Phase 3B alignment.

## Match hierarchy

| Pattern       | Approved special                   | Approved effect                                       |
| ------------- | ---------------------------------- | ----------------------------------------------------- |
| Straight four | Directional line special           | Clears one complete row or column                     |
| T or L five   | Cross special                      | Clears its complete row and column                    |
| Straight five | Genre-specific type-targeting core | Targets all pieces matching the activation type       |
| Six or more   | Reserved (enhanced)                | Distinct enhanced reward after later design/balancing |

Until a distinct enhanced six-plus effect is designed, the current engine treats every straight run of five or more (including six, seven, and eight on an 8-cell board) as `straight-5-plus` and creates the existing wildcard/type-targeting core.

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
- Special combination _expansion_ is later scope; existing combination infrastructure is preserved.
- Level goals are retested before and after special-rule alignment.

## Phase 3B aligned engine behavior

Phase 3B aligns the existing Phase 1D–1H special engine to the approved product rules. It is not a second special system.

Canonical domain kinds:

```text
line-clear
cross-clear
wildcard
```

Current confirmed engine behavior:

- Straight four creates `line-clear` with **perpendicular** stored orientation (horizontal four → vertical clearer; vertical four → horizontal clearer).
- Straight runs of five or more are classified as `straight-5-plus` and create `wildcard` (genre-neutral type-targeting core). This currently includes lengths 5, 6, 7, and 8.
- T, L, and cross matches create `cross-clear`.
- `line-clear` clears its stored row or column only (never both).
- `cross-clear` clears the full row and full column through its cell; the center is counted once.
- `wildcard` supports selected-type targeting (and existing wildcard-pair entire-board behavior).
- Creation placement and activation chains remain deterministic.
- Scoring includes removed-piece points, special bonuses, and cascade multipliers (values unchanged).

### Legacy compatibility

Persisted or fixture pieces that still use the legacy discriminant `area-clear` are decode-normalized to `cross-clear`. New creations always emit `cross-clear`. Inventory keys use `cross-clear:…`; legacy `area-clear:…` keys still parse.

Scoring field `crossClearActivationBonus` is canonical (value 50). Legacy input alias `areaClearActivationBonus` is accepted by `validateScoringRules` and normalized to `crossClearActivationBonus`. Equal simultaneous values are accepted; unequal simultaneous values are rejected as `invalid-scoring-rules`.

### Previous versus aligned rules

```text
Previous straight-four orientation: followed the match
Aligned orientation: perpendicular to the match (stored orientation = cleared line)

Previous T/L/cross effect: 3×3 area-clear
Aligned T/L/cross effect: full row-and-column cross-clear (`cross-clear`)

Straight-five-or-more behavior: unchanged wildcard/type targeting via straight-5-plus
Fantasy presentation labels: rune wave / arcane pillar / sigil cross / lightning core
```

A distinct enhanced six-plus reward/effect remains reserved for a later design and balance pass. Phase 3B does not add a separate six-plus special; current six-, seven-, and eight-piece straight runs intentionally use the existing wildcard fallback.

Internal mechanics remain genre-neutral. Visuals, audio, naming, and dialogue become genre-specific in presentation layers.

## Combinations

Existing combination detection and resolution are preserved for this pass:

- Wildcard swaps and wildcard-pair entire-board targeting remain.
- Dual-special `special-combination` still enqueues both specials as direct-swap activations.
- No new line+cross, wildcard+cross, or cross+cross variants were added.
- Combination bonuses were not retuned.

Combination expansion remains future work and must be recorded separately from this alignment.

## Relationship to Phase 3A.1 longer levels

Phase 3A.1 lengthened Fantasy score goals under the pre-alignment special engine. Phase 3B changes special geometry and therefore score output. Goals, move limits, collections, seeds, and scoring constants were **not** changed in Phase 3B.

Human playtesting and a separate rebalance PR remain required after alignment evidence is reviewed.

## Naming note

“Phase 3B” in this document means **special-rule alignment**. Older roadmap mentions of later data-driven content are separate future work and are not renumbered here.
