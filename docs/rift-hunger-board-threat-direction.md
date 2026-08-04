# Rift Hunger: Board Threat and Pressure-System Direction

## Document purpose

This document records the approved product direction for adding an active board threat to **StoryCrush: AI Rifts**.

The system is intended to make selected levels feel like the player is fighting against something rather than only racing a score or collection target. The threat should create urgency, make special pieces more strategically meaningful, and reinforce the fiction of unstable Rifts consuming each universe.

This is a gameplay source document, not an implementation prompt.

---

## Core product decision

StoryCrush should use a **board threat** rather than a traditional opponent that takes a separate turn.

The first approved threat system is:

```text
Rift Hunger
```

Its first gameplay form is:

```text
Rift Erosion
```

Rift Erosion spreads through the board over time, corrupting or consuming cells while the player continues normal match-3 play.

The player fights the threat through matching, cascades, and special-piece effects. The system should remain integrated with the existing deterministic board engine rather than becoming a separate combat game.

---

## Player-facing fantasy

The player is not only solving a puzzle.

The player is stabilizing a living Rift while something inside it is actively trying to consume the board.

The intended emotional rhythm is:

```text
Observe the threat.
Plan around the threatened cells.
Create a useful special.
Contain the spread.
Recover control.
Finish the objective before the Rift overwhelms the board.
```

The threat should feel dangerous but readable.

It should create tension without feeling arbitrary, unfair, or random.

---

## Initial mechanic: Rift Erosion

A Rift source appears on the board or along one edge of the board.

After a defined number of accepted player moves, the Rift spreads into one adjacent eligible cell.

The first implementation should use a simple cadence:

```text
Every three accepted moves, the Rift spreads into one telegraphed adjacent cell.
```

The spread target is chosen deterministically.

The player must be able to see the next threatened cell before the spread occurs.

The Rift may affect the target cell in one of the following ways:

- Consume the piece in the cell.
- Corrupt the piece so it cannot be matched normally.
- Convert the cell into a temporary blocker.
- Add progress to a visible Rift Hunger or board-collapse meter.

The first playable version should choose one primary effect rather than implementing all four at once.

Recommended first effect:

```text
The threatened cell becomes corrupted and unavailable for ordinary matching until cleansed.
```

This retains the shape of the board, clearly communicates danger, and avoids removing too much information from the player.

---

## First-pass player counterplay

The player fights Rift Erosion through normal gameplay.

Approved first-pass counterplay:

- Matching adjacent to a corrupted cell removes or damages that corruption.
- A line clear removes corruption along its affected row or column.
- A cross clear removes corruption along both affected directions.
- A wildcard or type-targeting core may cleanse corrupted pieces of the selected type when compatible with the final threat representation.
- Cascades may cleanse multiple corrupted cells when their authoritative affected coordinates intersect the threat.
- Clearing corruption may reduce the Rift Hunger meter or damage a boss in boss encounters.

The threat system must consume authoritative board events.

Presentation must not independently decide whether corruption was removed.

---

## Why this mechanic fits StoryCrush

Rift Hunger supports several existing product goals.

### It gives special pieces strategic meaning

Special pieces should not exist only to increase score.

Against Rift Erosion:

- A line clear becomes a precision containment tool.
- A cross clear becomes a strong emergency purge.
- A type-targeting core can become a board-wide rescue tool.
- Cascades can produce dramatic reversals.

### It reinforces the fiction

The player is repairing unstable Rifts between universes.

A spreading board threat makes the Rift feel alive, dangerous, and narratively relevant.

### It creates encounter variety

The same match-3 engine can support:

- Calm puzzle levels.
- Timed-pressure levels.
- Containment levels.
- Rescue levels.
- Boss encounters.
- Story-critical Rift collapses.

### It remains genre-neutral in the engine

The authoritative mechanic can remain one reusable system while each universe changes its appearance, sound, naming, and narrative meaning.

---

## Encounter types

Rift Hunger should not appear in every level.

The game should alternate between pressure and recovery.

### Puzzle levels

Pure score, collection, or other puzzle objectives.

Purpose:

- Teach mechanics.
- Allow experimentation.
- Give the player breathing room.
- Support lower-intensity story beats.

### Pressure levels

Rift Erosion spreads according to a deterministic cadence.

Purpose:

- Add urgency.
- Force tactical use of specials.
- Make move order matter.
- Create risk without requiring a named boss.

### Boss encounters

A named antagonist, creature, system, or force controls the Rift.

The underlying board threat remains deterministic, but the fiction presents it as an opponent.

Possible boss structure:

```text
The boss has health or stability.
Cleansing corruption damages the boss.
Failing to contain the Rift strengthens the next attack.
Special clears create larger damage windows.
The boss pattern changes at deterministic thresholds.
```

The first threat implementation should not begin with a full boss system.

Boss behavior should build on the proven Rift Erosion foundation.

---

## Fairness requirements

Fairness is a hard requirement.

The threat should create pressure, not surprise punishment.

### Telegraphing

The player must be shown:

- Which cell is threatened next.
- How many accepted moves remain before the spread.
- What will happen when the spread resolves.
- How the player can cleanse or stop it.

The threatened cell should have a clear, accessible visual treatment.

Color alone is not sufficient.

### Determinism

Spread behavior must be deterministic.

The same:

```text
board state
threat state
seed
accepted move history
```

must produce the same spread target and result.

The engine should never choose a threat target through untracked runtime randomness.

### Protection for newly created specials

A newly created special should not be immediately consumed without warning.

Recommended first rule:

```text
A player-created special receives one accepted-move cycle of protection from direct Rift consumption.
```

This protection must be explicit in threat state and visible to the player if it affects targeting.

The exact rule should be validated during prototyping.

### Playability preservation

After a spread resolves, the engine must verify that the board remains playable.

The threat must not create an unrecoverable state accidentally.

The existing valid-move and reshuffle systems should remain authoritative.

If the spread creates a dead board:

- Use the established deterministic reshuffle behavior.
- Preserve threat cells and protected-state rules.
- Preserve exact special-piece inventory.
- Do not silently remove the threat to make the board playable.

### No invisible targeting

The Rift must not secretly retarget after the player commits a move unless the rules clearly state that the telegraph updates after every accepted move.

The visible forecast and the authoritative target must match.

### No duplicated penalties

A single spread event must not:

- Consume the same cell twice.
- Increment the loss meter twice.
- Remove the same piece twice.
- Trigger duplicate score or objective changes.
- Activate the same special more than once.

---

## Threat-state model

The authoritative engine should use genre-neutral threat data.

A possible conceptual model:

```text
ThreatState
- threatId
- threatKind
- sourceCells
- corruptedCells
- threatenedCell
- spreadInterval
- acceptedMovesUntilSpread
- spreadPriority
- spreadGeneration
- hungerCurrent
- hungerMaximum
- protectedCells
- status
```

Possible status values:

```text
inactive
active
contained
overwhelmed
defeated
```

The exact TypeScript model should be designed during implementation after inspecting the existing level/session/persistence architecture.

---

## Neutral engine terminology

Recommended engine terms:

```text
threat
corruption
spread
threatened cell
corrupted cell
cleanse
contain
overwhelmed
```

Genre-specific terms should not become authoritative domain types.

Examples such as vines, malware, rot, teeth, or emotional fracture belong to content and presentation layers.

---

## Deterministic spread priority

The first implementation should use one documented deterministic targeting policy.

Possible priority order:

1. Eligible adjacent cells closest to the current objective-critical region.
2. Cells containing standard pieces before special pieces.
3. Unprotected cells before protected cells.
4. Stable coordinate order as the final tie-break.

A simpler first version may use:

```text
adjacent eligible cells
-> exclude protected cells
-> exclude already corrupted cells
-> stable row/column order
```

The final priority must be easy to explain, test, and reproduce.

Avoid complex “smart enemy” behavior in the first version.

---

## Cleansing rules

The first cleansing rule should be simple and universal.

Recommended first rule:

```text
Any authoritative removal effect that touches a corrupted cell cleanses that cell.
```

Possible qualifying effects:

- Adjacent match cleanse.
- Direct match through a corrupted piece, if corrupted pieces remain matchable.
- Line clear.
- Cross clear.
- Wildcard/type-targeting clear.
- Existing combination effects.
- Cascade effects.

The implementation must decide whether a corrupted cell contains:

```text
a corrupted piece
```

or:

```text
a board overlay attached to a cell
```

Recommended architecture:

```text
Corruption is a cell-state overlay, not a new piece type.
```

Reasons:

- Preserves underlying piece identity.
- Allows objective and score rules to remain explicit.
- Avoids contaminating normal piece-type matching.
- Supports multiple corruption stages later.
- Makes cleansing and visual overlays easier to separate.
- Allows the board engine to retain deterministic piece inventory.

This recommendation should be validated against the current board model before implementation.

---

## Corruption stages

The first version should use one corruption stage.

Future versions may support:

```text
threatened
corrupted
hardened
consumed
```

Do not implement multiple stages in the first Rift Erosion PR unless the existing architecture makes it nearly free and the added states are fully tested.

---

## Loss conditions

The first threat level should use one clear failure rule.

Recommended options:

### Hunger meter

Each successful spread increases Rift Hunger.

The level fails when:

```text
hungerCurrent >= hungerMaximum
```

### Board occupation

The level fails when corrupted cells reach a threshold.

Example:

```text
The level fails when 40 percent of playable cells are corrupted.
```

### Objective timeout

The existing move limit remains the failure boundary, while corruption makes reaching the objective more difficult.

Recommended first implementation:

```text
Use the existing move limit plus a visible Rift Hunger meter.
```

This gives the threat its own identity without replacing the existing level framework.

---

## Threat pacing

The initial cadence should be easy to understand.

Recommended first-pass values:

```text
Spread interval: every 3 accepted moves
Initial warning: visible from level start
First spread: after the third accepted move
Maximum simultaneous threatened cells: 1
```

Rejected moves must not advance the threat.

Paused gameplay must not advance the threat.

Presentation playback must not advance the threat.

Only accepted authoritative moves advance the threat countdown.

---

## Interaction with existing special pieces

### Line clear

- Clears corruption on the authoritative affected row or column.
- Orientation comes from the stored line-clear orientation.
- Does not clear the perpendicular direction.

### Cross clear

- Clears corruption on the full authoritative row and column.
- The center is counted once.
- Threat meter reduction or boss damage should count unique cleansed cells.

### Wildcard or type-targeting core

Possible first behavior:

- Clears corrupted cells whose underlying piece type matches the selected type.
- Preserves existing wildcard target selection.
- Does not introduce a new special combination.

This interaction should be added only when it can reuse the normal wildcard affected-coordinate pipeline cleanly.

### Special combinations

Existing combination behavior should continue to resolve through authoritative affected coordinates.

Rift Hunger should observe the final removal/affected-cell results.

It should not create separate duplicate combination logic.

---

## Interaction with objectives and scoring

Threat cleansing should be explicit in scoring and objectives.

Possible future objective kinds:

```text
cleanse-corruption
contain-rift
survive-spreads
damage-threat
protect-cells
rescue-pieces
```

The first implementation should avoid adding several new objective kinds at once.

Recommended first threat objective:

```text
Complete the existing score or collection objective before Rift Hunger reaches its limit.
```

Possible first scoring behavior:

- Normal removed-piece scoring remains unchanged.
- Normal special activation bonuses remain unchanged.
- Cleansing corruption may award a small separate, deterministic bonus.
- A cell should never award both duplicate cleanse bonuses and duplicate removal points for the same event.

A separate balance pass will be required.

---

## Genre-specific presentation

The engine mechanic remains the same across universes.

The content and presentation layers reinterpret it.

### Fantasy

Possible names and visuals:

- Shadow vines
- Cursed roots
- Void rot
- Black thorns
- Hungry sigils

Presentation ideas:

- Roots crawl toward the telegraphed cell.
- Corrupted cells pulse with dark runes.
- Cleansing creates a burst of light or leaves.
- Cross clears produce a sigil-shaped purge.

### Cyberpunk

Possible names and visuals:

- Malware
- Data decay
- Hostile nanites
- Grid corruption
- Memory infection

Presentation ideas:

- Glitch blocks spread across cells.
- The next target flickers with a warning reticle.
- Cleansing produces a data sweep.
- Line clears resemble network purges.

### Horror

Possible names and visuals:

- Flesh growth
- Mold
- Teeth
- Spreading darkness
- Parasite cells

Presentation must remain readable and avoid obscuring piece identity.

### Romance or drama universes

Possible metaphorical presentations:

- Emotional fracture
- Memory loss
- Relationship static
- Doubt
- Narrative collapse

The threat should fit the emotional language of the universe without changing its authoritative rules.

---

## Accessibility

Threat presentation must be understandable without relying only on animation, sound, or color.

Required:

- Distinct threatened-cell symbol.
- Distinct corrupted-cell symbol.
- Text or status announcement for the next spread.
- Move countdown communicated accessibly.
- Reduced-motion presentation.
- Screen-reader-compatible status when supported.
- High-contrast warning treatment.
- No rapid flicker.
- No board movement that makes touch targeting unstable.

Suggested announcements:

```text
Rift Hunger will spread in 2 moves.
Cell row 4, column 6 is threatened.
The Rift spread to row 4, column 6.
Three corrupted cells were cleansed.
Rift Hunger is 4 of 8.
```

Player-facing localization should replace raw coordinates with clearer language when practical.

---

## Mobile-first considerations

The threat must be readable on phone portrait before desktop enhancement.

Phone requirements:

- Threat countdown remains visible without covering objectives.
- The threatened-cell marker does not obscure the piece.
- Corruption overlays remain distinguishable at small tile sizes.
- Touch targets remain unchanged.
- Warning animations stay inside the board.
- The hunger meter remains readable in portrait and landscape.
- No extra modal interrupts active play.

Tablet and desktop may add more atmospheric presentation, but not more authoritative information.

---

## Narrative integration

Rift Hunger can become a bridge between puzzle play and story.

Possible narrative uses:

- A character warns that the Rift is becoming unstable.
- A named villain manipulates the spread.
- A relationship choice changes threat presentation or cadence in a later system.
- A successful containment changes the post-level scene.
- Failure may lead to a recoverable narrative consequence rather than an immediate story dead end.

The first implementation should not make narrative progression depend on remote AI services.

All authoritative outcomes must remain local and deterministic.

---

## Boss encounter direction

Bosses should reuse the threat engine.

A future boss may define:

```text
BossThreatProfile
- displayName
- health
- phases
- spread cadence by phase
- spread pattern
- cleanse damage conversion
- special vulnerability
- failure escalation
- presentation profile
```

Possible boss behaviors:

- Spread from multiple sources.
- Harden previously corrupted cells.
- Protect a corruption source.
- Retarget after a phase transition.
- React to line, cross, or wildcard clears differently.
- Speak or animate between authoritative turns.

Boss dialogue and voice remain presentation layers.

They must never decide board outcomes.

---

## First implementation scope

The first Rift Hunger development phase should remain deliberately narrow.

Recommended MVP:

```text
One Fantasy pressure level.
One Rift source.
One threatened cell at a time.
Spread every three accepted moves.
One corruption stage.
Corruption stored as deterministic cell-state data.
Matching adjacent to corruption cleanses it.
Line and cross clears cleanse affected corruption.
Visible Rift Hunger meter.
Failure at a fixed hunger threshold.
Save/resume support.
Restart Same Board support.
Deterministic tests.
Phone-first browser verification.
```

Optional for the first phase only when low-risk:

```text
Wildcard/type-targeting cleanse support.
Small cleanse score bonus.
Simple local sound hook.
```

Explicitly out of scope for the first phase:

- Multiple simultaneous threats.
- Boss phases.
- Adaptive or AI-selected targeting.
- Remote AI dependency.
- Generated dialogue.
- Voice providers.
- Complex corruption stages.
- New special combinations.
- Threat-specific monetization.
- Cyberpunk implementation.
- Full campaign rollout.
- Final balance.
- Production-wide analytics.

---

## Implementation sequencing

Recommended order:

### Phase RH-0 — Architecture and threat-state contract

- Inspect board, level, persistence, scoring, presentation, and test ownership.
- Decide cell overlay versus piece replacement.
- Define deterministic targeting contract.
- Define save schema and compatibility.
- Add pure threat-state unit tests.

### Phase RH-1 — Single-source Rift Erosion

- Add one threat source.
- Add telegraph.
- Add accepted-move countdown.
- Spread to one deterministic adjacent cell.
- Add one corruption stage.
- Add hunger meter and failure threshold.
- Add cleansing through adjacent matches.

### Phase RH-2 — Special-piece interaction

- Line clear cleansing.
- Cross clear cleansing.
- Wildcard cleansing when compatible.
- Chain/cascade correctness.
- Score and objective accounting.
- Presentation effects.

### Phase RH-3 — Level content and balance

- Add one or more pressure levels.
- Measure deterministic outcomes.
- Conduct human playtesting.
- Tune interval, hunger limit, and goals.
- Preserve calm levels between pressure levels.

### Phase RH-4 — Boss foundation

- Named threat profile.
- Health/stability.
- Deterministic phases.
- Narrative reactions.
- No remote authority.

---

## Required test categories

When implemented, tests should cover:

- Deterministic spread target.
- Same seed and move history produce the same spread.
- Rejected moves do not advance the countdown.
- Accepted moves advance exactly once.
- Pause and presentation playback do not advance threat state.
- Telegraph matches the actual target.
- Newly created special protection.
- Edge and corner spread.
- No eligible target behavior.
- Dead-board handling.
- Reshuffle preservation.
- Save/resume.
- Restart Same Board.
- New Board.
- Adjacent-match cleanse.
- Line-clear cleanse.
- Cross-clear cleanse.
- Wildcard cleanse if included.
- Unique-cell accounting.
- No duplicate score.
- No duplicate objective progress.
- Hunger threshold.
- Win and failure priority on the same move.
- Reduced motion.
- Touch interaction.
- Phone portrait.
- Phone landscape.
- Tablet.
- Desktop.
- No console errors.
- No fixed waits controlling authoritative resolution.

---

## Balance principles

Rift Hunger will materially affect difficulty.

Do not assume existing score and collection goals remain appropriate.

After implementation, measure:

- Win/failure rate by level and seed.
- Median score.
- Median moves used.
- Hunger at completion.
- Number of spread events survived.
- Corrupted cells created.
- Corrupted cells cleansed.
- Specials created and activated.
- Cascades.
- Threat-related failures.
- Player recovery after near-overwhelm states.

Deterministic probes are evidence only.

Human playtesting remains required because perceived pressure, readability, and fairness cannot be inferred fully from automated results.

---

## Design principles

The system should follow these rules:

```text
Threat is visible.
Threat is deterministic.
Threat is dangerous but fair.
Threat uses normal match-3 play.
Specials become tactical tools.
Presentation never owns gameplay authority.
Every universe can reinterpret the same mechanic.
Not every level applies pressure.
Recovery levels matter.
Human playtesting determines final balance.
```

---

## Open design questions

These should be answered through prototyping rather than assumed:

1. Does corruption replace a piece or overlay the cell?
2. Can a corrupted piece still participate in a match?
3. Does adjacent matching cleanse immediately or deal one point of damage?
4. How long should newly created specials be protected?
5. Does corruption block gravity, or does it remain attached to the cell?
6. Can the Rift spread diagonally?
7. What happens when no eligible adjacent target exists?
8. Does cleansing reduce hunger, prevent future hunger, or both?
9. Should threat failure override a simultaneous objective win?
10. Should the first pressure level use a hunger meter, occupation threshold, or move-limit-only failure?
11. How much score, if any, should cleansing award?
12. Should wildcards target corrupted overlays by underlying piece type?
13. How should reshuffling preserve telegraphed and corrupted cells?
14. How should boss damage map from cleansed cells?
15. How often should calm levels appear between pressure encounters?

---

## Approved initial direction

The approved first prototype is:

> Every three accepted moves, the Rift spreads into one telegraphed adjacent cell. The affected cell becomes corrupted. Matching beside it or hitting it with a special cleanses it. The player must finish the level objective before Rift Hunger reaches its limit.

This prototype should be built only after the current special-piece alignment and its immediate balance work are stable.

Rift Hunger is intended to become the foundational opponent-pressure system for StoryCrush: AI Rifts.
