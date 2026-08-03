# Level Balance Baseline — Phase 3A.1 / Phase 3B

Date: 2026-08-02

Starting `main` SHA (Phase 3B branch point): `4657b52a38d996629c7d656cb6134d64a6849a00`

Branch: `feat/phase-3b-special-rule-alignment`

## Goals (unchanged in Phase 3B)

| Level                 | Previous score | First-pass score |     Move limit | Collection             |
| --------------------- | -------------: | ---------------: | -------------: | ---------------------- |
| Archive Stabilization |            600 |            2,500 | 15 (unchanged) | 10 ruby (unchanged)    |
| Moonwell Recovery     |            700 |            3,500 | 12 (unchanged) | 8 sapphire (unchanged) |
| Rootbound Seal        |            900 |            5,000 | 10 (unchanged) | 9 emerald (unchanged)  |

These score goals remain provisional playtest values, not final permanent balance.

## Scoring rules (numeric values unchanged)

```text
10 points per removed piece
40 line-clear activation bonus
50 cross-clear activation bonus (was area-clear field name)
60 wildcard activation bonus
cascade multiplier increment: 1
```

Phase 3B changed special creation orientation and cross activation geometry. It did **not** change scoring constants, move limits, collections, seeds, board sizes, or allowed piece sets.

## Deterministic balance probe

Policy (evidence only; not a claim about human skill):

1. Enumerate legal playable swaps via `findPlayableSwaps`.
2. Evaluate each candidate with `applyLevelMove` from the current immutable session state.
3. Prefer immediate objective completion (`won`).
4. Otherwise prefer highest immediate score delta.
5. Then prefer collection progress delta.
6. Then prefer special creation or activation count.
7. Use coordinate order as the final deterministic tie-breaker.

Seed matrix (21 seeds, shared by every level):

```text
1807, 1808, 1809, 1810, 1901, 1907, 2001, 2107, 2203, 2309,
2401, 2503, 2609, 2707, 2801, 2903, 3001, 3109, 3203, 3307, 3401
```

Helper location: `tests/unit/game/content/levelBalanceProbe.ts`.

## Aggregate results — Phase 3A.1 (pre-alignment, superseded)

| Level                 | Wins | Failures | Median score | Score range  | Median moves used | Median moves left on win | Collection complete | Specials created | Specials activated | Cascade steps |
| --------------------- | ---: | -------: | -----------: | ------------ | ----------------: | -----------------------: | ------------------: | ---------------: | -----------------: | ------------: |
| Archive Stabilization |   16 |        5 |        2,680 | 1,290–3,640  |                10 |                        5 |               21/21 |               77 |                 55 |           575 |
| Moonwell Recovery     |   21 |        0 |        4,290 | 3,500–7,450  |                 6 |                        6 |               21/21 |              116 |                 81 |           502 |
| Rootbound Seal        |   17 |        4 |        5,210 | 2,820–12,950 |                 8 |                        3 |               21/21 |              142 |                103 |           651 |

## Aggregate results — Phase 3B (post-alignment, current)

| Level                 | Wins | Failures | Median score | Score range | Median moves used | Median moves left on win | Collection complete | Specials created | Specials activated | Cascade steps |
| --------------------- | ---: | -------: | -----------: | ----------- | ----------------: | -----------------------: | ------------------: | ---------------: | -----------------: | ------------: |
| Archive Stabilization |   18 |        3 |        2,690 | 2,110–3,400 |                 9 |                        7 |               21/21 |               76 |                 57 |           549 |
| Moonwell Recovery     |   21 |        0 |        4,260 | 3,510–9,270 |                 6 |                        6 |               21/21 |              121 |                 86 |           502 |
| Rootbound Seal        |   19 |        2 |        5,940 | 3,910–9,270 |                 8 |                        3 |               21/21 |              152 |                121 |           611 |

### Specials by kind (Phase 3B totals across 21 seeds)

| Level     | Created line / cross / wildcard | Activated line / cross / wildcard |
| --------- | ------------------------------- | --------------------------------- |
| Archive   | 56 / 18 / 2                     | 43 / 14 / 0                       |
| Moonwell  | 74 / 42 / 5                     | 56 / 26 / 4                       |
| Rootbound | 86 / 54 / 12                    | 71 / 39 / 11                      |

### Impact notes

- Archive and Rootbound win rates rose under the greedy heuristic; Moonwell remains 21/21.
- Rootbound median score rose (5,210 → 5,940); Moonwell max score rose (outlier cascades).
- Goals were intentionally **not** retuned in Phase 3B. Recommend a separate rebalance PR after human playtesting.

## Limitations

- Deterministic greedy results do not replace human playtesting.
- The probe is not an optimal solver and can lose seeds a skilled player might clear.
- Values must be retested after combination expansion or further special changes.

## Recommended next human playtest

1. Phone portrait first: clear each level once without coaching.
2. Confirm line specials feel directional and perpendicular to the creating four.
3. Confirm T/L cross clears feel distinctly stronger than a four.
4. Confirm straight-five lightning cores remain exceptional.
5. Decide whether Rootbound’s higher score output warrants a goal increase in a follow-up PR.
