# RH-3 Fantasy Pressure — Human Playtest Guide

Automated probes are evidence only. Human balance approval is pending.

## Candidate identity

| Field                     | Value                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| Level                     | Thornwake Containment (`thornwake-containment`)                                  |
| Experience                | Fantasy Pressure (`rift-pressure`)                                               |
| Moves                     | 18                                                                               |
| Score objective           | 3000                                                                             |
| Collection                | 9 topaz                                                                          |
| Spread interval           | 3 accepted moves                                                                 |
| Hunger maximum            | 5                                                                                |
| Source                    | row 7, column 3 (zero-based)                                                     |
| Effective threat deadline | 15 accepted moves (`3 × 5`)                                                      |
| Baseline main             | `e64047cddf03a8f87968c2bcc3575957a88a765b`                                       |
| Feature head              | TBD after push                                                                   |
| Source doc fingerprint    | 943 / 23969 / `1ee3feec4466f2a88e5c39c10cb07f9f81529a9e8c5ff79ab696ad972f1f418b` |

Deploy Preview pattern (replace `<PR-number>`):

```text
https://deploy-preview-<PR-number>--storycrush-ai-rifts.netlify.app
```

## Launch instructions

1. Open the Deploy Preview (or local `npm run dev`).
2. Append:
   ```text
   ?playtest=1&level=thornwake-containment&seed=<seed>
   ```
3. Press **Puzzle Lab** on the Main Menu (do not require DevTools).
4. Confirm **Playtest seed &lt;seed&gt;** is visible and announced.
5. Play normally. **Restart Same Board** keeps the seed. **New Board** exits fixed playtest and shows `New Board started with a new seed.`
6. At terminal, copy the **RH-3 Playtest Summary** via **Copy Playtest Summary**.
7. Record subjective ratings below.

## Ten representative seeds (from threat-aware probe 1831–1870)

| #   | Seed | Classification                   | Probe outcome |
| --- | ---: | -------------------------------- | ------------- |
| 1   | 1856 | expected easier threat-aware win | won           |
| 2   | 1838 | expected easier threat-aware win | won           |
| 3   | 1842 | expected close win               | won           |
| 4   | 1869 | expected close win               | won           |
| 5   | 1831 | expected threat failure          | failed        |
| 6   | 1834 | expected threat failure          | failed        |
| 7   | 1839 | special-heavy run                | failed        |
| 8   | 1849 | low-special run                  | failed        |
| 9   | 1836 | near-overwhelm win               | won           |
| 10  | 1845 | representative median run        | won           |

Example:

```text
https://deploy-preview-<PR-number>--storycrush-ai-rifts.netlify.app/?playtest=1&level=thornwake-containment&seed=1856
```

## Keith’s minimum human matrix

At least ten completed human runs:

| Viewport class               | Count |
| ---------------------------- | ----- |
| phone portrait               | 4     |
| phone landscape              | 2     |
| tablet portrait or landscape | 2     |
| desktop                      | 2     |

Also require:

- at least five unique seeds
- at least 2 expected wins, 2 expected close runs, 2 expected failures

## Subjective form (per run)

```text
device and viewport:
seed:
outcome:
copied machine summary:
pressure 1–5:
fairness 1–5:
telegraph readability 1–5:
corruption readability 1–5:
special usefulness 1–5:
frustration 1–5:
did the failure feel understandable?
did a special create a meaningful recovery?
what felt too easy?
what felt unfair?
```

## Human acceptance guide (later decision — not yet claimed)

Suggested review thresholds after Keith supplies results:

- median fairness ≥ 3
- median telegraph readability ≥ 4
- median corruption readability ≥ 4
- median pressure 3–4
- median frustration ≤ 3
- understood why the run failed ≥ 80% of failed runs
