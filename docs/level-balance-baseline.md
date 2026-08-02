# Level Balance Baseline — Phase 3A.1

Date: 2026-08-01

Starting `main` SHA: `22113d9e4a58a160a817d852cd7d1f08b555909d`

Branch: `feat/phase-3a1-longer-level-balance`

## Goals

| Level                 | Previous score | First-pass score |     Move limit | Collection             |
| --------------------- | -------------: | ---------------: | -------------: | ---------------------- |
| Archive Stabilization |            600 |            2,500 | 15 (unchanged) | 10 ruby (unchanged)    |
| Moonwell Recovery     |            700 |            3,500 | 12 (unchanged) | 8 sapphire (unchanged) |
| Rootbound Seal        |            900 |            5,000 | 10 (unchanged) | 9 emerald (unchanged)  |

These score goals are provisional playtest values, not final permanent balance.

## Scoring rules (unchanged)

```text
10 points per removed piece
40 line-clear activation bonus
50 area-clear activation bonus
60 wildcard activation bonus
cascade multiplier increment: 1
```

Special-piece creation and activation mechanics were not modified in this pass.

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

Includes each catalog seed plus 18 additional fixed seeds. The matrix is re-run twice; summaries must be identical.

Helper location: `tests/unit/game/content/levelBalanceProbe.ts`.

## Aggregate results (greedy heuristic)

| Level                 | Wins | Failures | Median score | Score range  | Median moves used | Median moves left on win | Collection complete | Specials created | Specials activated | Cascade steps |
| --------------------- | ---: | -------: | -----------: | ------------ | ----------------: | -----------------------: | ------------------: | ---------------: | -----------------: | ------------: |
| Archive Stabilization |   16 |        5 |        2,670 | 1,290–3,640  |                10 |                      5.5 |               21/21 |               75 |                 54 |           560 |
| Moonwell Recovery     |   21 |        0 |        4,290 | 3,500–7,450  |                 6 |                        6 |               21/21 |              117 |                 81 |           502 |
| Rootbound Seal        |   18 |        3 |        5,220 | 3,800–12,950 |                 7 |                        3 |               21/21 |              146 |                108 |           617 |

### Move-limit decision

Every level demonstrated at least one completion path at its existing move limit under the greedy heuristic. Per the Phase 3A.1 gate, no move limits were increased.

Difficulty ordering by score target and move scarcity remains Archive → Moonwell → Rootbound. The heuristic finds Moonwell unusually winnable because the five-type board produces strong cascades; human playtesting must confirm perceived difficulty.

## Limitations

- Deterministic greedy results do not replace human playtesting.
- The probe is not an optimal solver and can lose seeds a skilled player might clear.
- Values must be retested after the approved special-rule alignment pass, which is expected to raise average score output.

## Recommended next human playtest

1. Phone portrait first: clear each level once without coaching.
2. Note whether Archive feels too short or Moonwell too swingy.
3. Record whether Rootbound’s 10-move pressure still feels fair at 5,000.
4. Retest after special-rule alignment (perpendicular line clears and full cross clears).
