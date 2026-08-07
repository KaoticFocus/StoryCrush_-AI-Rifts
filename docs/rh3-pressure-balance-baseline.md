# RH-3 Fantasy Pressure Balance Baseline — Thornwake Containment

Date: 2026-08-05

Base `main` SHA: `e64047cddf03a8f87968c2bcc3575957a88a765b`

Feature head placeholder: `TBD_AFTER_PUSH`

Branch: `feat/rh3-fantasy-pressure-level-balance`

## Scope

RH-3 adds **Thornwake Containment** as the first curated Fantasy pressure level in Puzzle Lab only. Calm Archive / Moonwell / Rootbound levels and **Rift Erosion Lab** remain unchanged. Boss encounters and campaign pressure wiring stay deferred to RH-4.

These values are **provisional automation evidence**, not a final-balance claim. Human playtest is **pending**.

## Selected level values (Thornwake Containment)

| Field                |            Value |
| -------------------- | ---------------: |
| Move limit           |               18 |
| Score target         |            3,000 |
| Collection           |          9 topaz |
| Spread interval      | 3 accepted moves |
| Hunger maximum       |                5 |
| Source cell          |  row 7, column 3 |
| Default catalog seed |             1831 |

Effective threat deadline (moves before hunger can reach maximum under uninterrupted spread cadence): **15**.

## Probe policy summaries (40 seeds: 1831–1870)

Evidence-only greedy policies from `tests/unit/game/content/riftPressureBalanceProbe.ts`:

| Policy          |  Wins | Win rate | Threat failures | Median score | Median moves | Notes                                                    |
| --------------- | ----: | -------: | --------------: | -----------: | -----------: | -------------------------------------------------------- |
| first-playable  |  0/40 |       0% |              40 |          750 |           15 | Baseline without objective/threat bias                   |
| objective-first | 19/40 |    47.5% |              21 |        2,945 |           15 | Special-origin cleanse rate 30%; near-overwhelm wins 1   |
| threat-aware    | 23/40 |    57.5% |              17 |        3,025 |         14.5 | Special-origin cleanse rate 27.5%; near-overwhelm wins 9 |

Hard gates (no unfinished runs, invalid rejected selections, or active-without-playable returns): **pass** for all three policies.

Soft targets: **met** — threat-aware win rate within the 45–75% band and at least 15 percentage points above first-playable (tactical diff **57.5 pp**).

## Calm / lab unchanged statement

- Archive Stabilization, Moonwell Recovery, and Rootbound Seal: no threat overlay, goals unchanged.
- Rift Erosion Lab: still the experimental single-source lab level with **Experimental Rift Hunger** labeling; RH-2 special cleansing behavior unchanged.

## Human playtest status

Automated probes do not substitute for human skill, pacing, or feel. Subjective playtest matrix and seed list: [rh3-pressure-playtest.md](rh3-pressure-playtest.md).
