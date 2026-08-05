import { describe, expect, it } from 'vitest';
import { resolveCascade } from '../../../src/game/board';
import * as levelApi from '../../../src/game/level';
import {
  applyLevelMove,
  createInitialRiftHungerState,
  createLevelSession,
  DEFAULT_SCORING_RULES,
  planRiftHungerCleanses,
  selectThreatenedCell,
  type LevelDefinition,
  type RiftHungerDefinition,
  type RiftHungerState,
} from '../../../src/game/level';
import { findMatchRuns, findPlayableSwaps, isDeadBoard } from '../../../src/game/board';
import { selectHint } from '../../../src/game/presentation/hints/selectHint';
import {
  boardFromPieces,
  crossClearPiece,
  lineClearPiece,
  standardPiece,
  wildcardPiece,
} from '../board/boardTestHelpers';

function threatDefinition(overrides?: Partial<RiftHungerDefinition>): RiftHungerDefinition {
  return {
    kind: 'rift-hunger',
    sourceCells: [{ row: 3, column: 3 }],
    spreadInterval: 3,
    hungerMaximum: 5,
    spreadPriority: 'orthogonal-stable-coordinate',
    ...overrides,
  };
}

function makeDefinition(overrides?: Partial<LevelDefinition>): LevelDefinition {
  return {
    id: 'rift-special-cleanse-test',
    moveLimit: 15,
    allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
    objectives: [{ id: 'score-main', kind: 'score', targetScore: 50_000 }],
    scoring: { ...DEFAULT_SCORING_RULES },
    seed: 42,
    threat: threatDefinition(),
    ...overrides,
  };
}

function makeThreatState(
  corruptedCells: Array<{ row: number; column: number }>,
  overrides?: Partial<RiftHungerState> & {
    sourceCells?: Array<{ row: number; column: number }>;
    dimensions?: { rows: number; columns: number };
  },
): RiftHungerState {
  const dimensions = overrides?.dimensions ?? { rows: 4, columns: 4 };
  const source = overrides?.sourceCells?.[0] ?? { row: 3, column: 3 };
  const definition = threatDefinition({ sourceCells: [source] });
  const base = createInitialRiftHungerState({ definition, boardDimensions: dimensions });
  const all = [...corruptedCells];
  if (!all.some((cell) => cell.row === source.row && cell.column === source.column)) {
    all.push(source);
  }
  all.sort((a, b) => (a.row === b.row ? a.column - b.column : a.row - b.row));
  const threatened =
    selectThreatenedCell({
      dimensions,
      corruptedCells: all,
      protectedCells: [],
    }) ?? base.threatenedCell;
  return {
    ...base,
    ...overrides,
    status: 'active',
    sourceCells: [source],
    corruptedCells: all,
    threatenedCell: threatened,
    acceptedMovesUntilSpread: overrides?.acceptedMovesUntilSpread ?? 3,
    protectedCells: [],
  };
}

describe('RH-2 special Rift cleansing planner', () => {
  it('exports only planRiftHungerCleanses as the all-cause planner', () => {
    expect(typeof levelApi.planRiftHungerCleanses).toBe('function');
    expect(Object.prototype.hasOwnProperty.call(levelApi, 'planAdjacentMatchCleanses')).toBe(false);
    expect((levelApi as Record<string, unknown>).planAdjacentMatchCleanses).toBeUndefined();
  });

  it('returns empty events when only source corruption exists', () => {
    const board = boardFromPieces([
      [
        standardPiece('ruby'),
        standardPiece('sapphire'),
        standardPiece('ruby'),
        standardPiece('topaz'),
      ],
      [
        standardPiece('topaz'),
        lineClearPiece('ruby', 'horizontal'),
        standardPiece('emerald'),
        standardPiece('pearl'),
      ],
      [
        standardPiece('emerald'),
        standardPiece('amethyst'),
        standardPiece('sapphire'),
        standardPiece('emerald'),
      ],
      [
        standardPiece('pearl'),
        standardPiece('topaz'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
      ],
    ]);
    const previousState = makeThreatState([], { sourceCells: [{ row: 0, column: 3 }] });
    const resolution = resolveCascade({
      board,
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      seed: 7,
      unavailableCoordinates: previousState.corruptedCells,
    });
    expect(resolution.isValid).toBe(true);
    if (!resolution.isValid) {
      return;
    }
    expect(planRiftHungerCleanses({ previousState, resolution })).toEqual([]);
  });

  it('cleanses horizontal line-clear contact with adjacent+line provenance', () => {
    const board = boardFromPieces([
      [
        standardPiece('ruby'),
        standardPiece('sapphire'),
        standardPiece('ruby'),
        standardPiece('topaz'),
      ],
      [
        standardPiece('topaz'),
        lineClearPiece('ruby', 'horizontal'),
        standardPiece('emerald'),
        standardPiece('pearl'),
      ],
      [
        standardPiece('emerald'),
        standardPiece('amethyst'),
        standardPiece('sapphire'),
        standardPiece('emerald'),
      ],
      [
        standardPiece('pearl'),
        standardPiece('topaz'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
      ],
    ]);
    const previousState = makeThreatState([
      { row: 0, column: 3 },
      { row: 1, column: 0 },
    ]);
    const resolution = resolveCascade({
      board,
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      seed: 7,
      unavailableCoordinates: previousState.corruptedCells,
    });
    expect(resolution.isValid).toBe(true);
    if (!resolution.isValid) {
      return;
    }

    const events = planRiftHungerCleanses({ previousState, resolution });
    const lineHit = events.find(
      (event) => event.coordinate.row === 0 && event.coordinate.column === 3,
    );
    expect(lineHit).toBeDefined();
    expect(lineHit!.causes).toEqual(['adjacent-match', 'line-clear']);
    expect(lineHit!.evidence.map((entry) => entry.kind)).toEqual([
      'adjacent-match',
      'special-activation',
    ]);
    expect(lineHit!.evidence[1]).toEqual(
      expect.objectContaining({
        kind: 'special-activation',
        cause: 'line-clear',
        activationReason: 'direct-swap',
      }),
    );
  });

  it('cleanses unique cross-clear and line-clear cells from a special combination', () => {
    const board = boardFromPieces([
      [
        crossClearPiece('emerald'),
        lineClearPiece('sapphire', 'vertical'),
        standardPiece('topaz'),
        standardPiece('pearl'),
      ],
      [
        standardPiece('ruby'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
        standardPiece('ruby'),
      ],
      [
        standardPiece('topaz'),
        standardPiece('emerald'),
        standardPiece('sapphire'),
        standardPiece('topaz'),
      ],
      [
        standardPiece('pearl'),
        standardPiece('ruby'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
      ],
    ]);
    const previousState = makeThreatState(
      [
        { row: 0, column: 2 },
        { row: 1, column: 0 },
        { row: 2, column: 1 },
      ],
      { sourceCells: [{ row: 3, column: 0 }] },
    );
    const resolution = resolveCascade({
      board,
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      seed: 7,
      unavailableCoordinates: previousState.corruptedCells,
    });
    expect(resolution.isValid).toBe(true);
    if (!resolution.isValid) {
      return;
    }

    const events = planRiftHungerCleanses({ previousState, resolution });
    expect(events.map((event) => event.coordinate)).toEqual([
      { row: 0, column: 2 },
      { row: 1, column: 0 },
      { row: 2, column: 1 },
    ]);
    expect(events[0]!.causes).toEqual(['cross-clear']);
    expect(events[1]!.causes).toEqual(['line-clear']);
    expect(events[2]!.causes).toEqual(['cross-clear']);
    // Source never cleansed even when in line geometry.
    expect(
      events.some((event) => event.coordinate.row === 3 && event.coordinate.column === 0),
    ).toBe(false);
  });

  it('cleanses wildcard type-target corruption using authoritative affected coordinates', () => {
    const board = boardFromPieces([
      [
        wildcardPiece('ruby'),
        standardPiece('sapphire'),
        standardPiece('ruby'),
        standardPiece('topaz'),
      ],
      [
        standardPiece('emerald'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
        standardPiece('emerald'),
      ],
      [
        standardPiece('topaz'),
        standardPiece('ruby'),
        standardPiece('sapphire'),
        standardPiece('topaz'),
      ],
      [
        standardPiece('pearl'),
        standardPiece('emerald'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
      ],
    ]);
    const previousState = makeThreatState([
      { row: 0, column: 2 },
      { row: 2, column: 2 },
    ]);
    const resolution = resolveCascade({
      board,
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      seed: 7,
      unavailableCoordinates: previousState.corruptedCells,
    });
    expect(resolution.isValid).toBe(true);
    if (!resolution.isValid) {
      return;
    }

    const activation = resolution.steps[0]?.activationEvents[0];
    expect(activation?.piece.kind).toBe('wildcard');
    expect(activation?.wildcardTarget).toEqual({ mode: 'piece-type', pieceType: 'sapphire' });

    const events = planRiftHungerCleanses({ previousState, resolution });
    expect(events).toEqual([
      expect.objectContaining({
        coordinate: { row: 2, column: 2 },
        causes: ['wildcard'],
      }),
    ]);
    // Nonmatching ruby corruption remains.
    expect(
      events.some((event) => event.coordinate.row === 0 && event.coordinate.column === 2),
    ).toBe(false);
  });

  it('excludes newly spread coordinate even when special geometry covers it', () => {
    const board = boardFromPieces([
      [
        crossClearPiece('emerald'),
        lineClearPiece('sapphire', 'vertical'),
        standardPiece('topaz'),
        standardPiece('pearl'),
      ],
      [
        standardPiece('ruby'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
        standardPiece('ruby'),
      ],
      [
        standardPiece('topaz'),
        standardPiece('emerald'),
        standardPiece('sapphire'),
        standardPiece('topaz'),
      ],
      [
        standardPiece('pearl'),
        standardPiece('ruby'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
      ],
    ]);
    const previousState = makeThreatState(
      [
        { row: 0, column: 2 },
        { row: 2, column: 1 },
      ],
      { sourceCells: [{ row: 3, column: 0 }] },
    );
    const resolution = resolveCascade({
      board,
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      seed: 7,
      unavailableCoordinates: previousState.corruptedCells,
    });
    expect(resolution.isValid).toBe(true);
    if (!resolution.isValid) {
      return;
    }

    const events = planRiftHungerCleanses({
      previousState,
      resolution,
      newlySpreadCoordinate: { row: 0, column: 2 },
    });
    expect(events.map((event) => event.coordinate)).toEqual([{ row: 2, column: 1 }]);
  });

  it('keeps cause and evidence order stable and clones defensively', () => {
    const board = boardFromPieces([
      [
        standardPiece('ruby'),
        standardPiece('sapphire'),
        standardPiece('ruby'),
        standardPiece('topaz'),
      ],
      [
        standardPiece('topaz'),
        lineClearPiece('ruby', 'horizontal'),
        standardPiece('emerald'),
        standardPiece('pearl'),
      ],
      [
        standardPiece('emerald'),
        standardPiece('amethyst'),
        standardPiece('sapphire'),
        standardPiece('emerald'),
      ],
      [
        standardPiece('pearl'),
        standardPiece('topaz'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
      ],
    ]);
    const previousState = makeThreatState([{ row: 0, column: 3 }]);
    const resolution = resolveCascade({
      board,
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      seed: 7,
      unavailableCoordinates: previousState.corruptedCells,
    });
    expect(resolution.isValid).toBe(true);
    if (!resolution.isValid) {
      return;
    }

    const first = planRiftHungerCleanses({ previousState, resolution });
    const second = planRiftHungerCleanses({ previousState, resolution });
    expect(second).toEqual(first);

    const event = first[0]!;
    event.coordinate.row = 99;
    event.causes.push('wildcard');
    event.evidence[0] = {
      kind: 'adjacent-match',
      stepIndex: 9,
      matchedCoordinates: [{ row: 9, column: 9 }],
    };
    const again = planRiftHungerCleanses({ previousState, resolution });
    expect(again[0]!.coordinate).toEqual({ row: 0, column: 3 });
    expect(again[0]!.causes).toEqual(['adjacent-match', 'line-clear']);
  });
});

describe('RH-2 entire-board wildcard-pair cleansing', () => {
  function wildcardPairBoard() {
    return boardFromPieces([
      [
        wildcardPiece('ruby'),
        wildcardPiece('sapphire'),
        standardPiece('emerald'),
        standardPiece('topaz'),
      ],
      [
        standardPiece('amethyst'),
        standardPiece('pearl'),
        standardPiece('ruby'),
        standardPiece('sapphire'),
      ],
      [
        standardPiece('topaz'),
        standardPiece('emerald'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
      ],
      [
        standardPiece('ruby'),
        standardPiece('sapphire'),
        standardPiece('emerald'),
        standardPiece('topaz'),
      ],
    ]);
  }

  it('cleanses all pre-existing non-source corruption via resolveCascade entire-board pair', () => {
    const board = wildcardPairBoard();
    const previousState = makeThreatState(
      [
        { row: 0, column: 2 },
        { row: 1, column: 0 },
        { row: 2, column: 1 },
      ],
      { sourceCells: [{ row: 3, column: 3 }] },
    );
    const resolution = resolveCascade({
      board,
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      seed: 42,
      unavailableCoordinates: previousState.corruptedCells,
    });
    expect(resolution.isValid).toBe(true);
    if (!resolution.isValid) {
      return;
    }

    const activations = resolution.steps[0]?.activationEvents ?? [];
    expect(activations.length).toBeGreaterThanOrEqual(1);
    expect(activations.every((activation) => activation.piece.kind === 'wildcard')).toBe(true);
    expect(activations.every((activation) => activation.reason === 'direct-swap')).toBe(true);
    expect(
      activations.every((activation) => activation.wildcardTarget?.mode === 'entire-board'),
    ).toBe(true);
    expect(activations.every((activation) => activation.affectedCoordinates.length === 16)).toBe(
      true,
    );

    const events = planRiftHungerCleanses({ previousState, resolution });
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.coordinate)).toEqual([
      { row: 0, column: 2 },
      { row: 1, column: 0 },
      { row: 2, column: 1 },
    ]);
    for (const event of events) {
      expect(event.causes).toEqual(['wildcard']);
      expect(event.evidence.length).toBe(activations.length);
      for (const evidence of event.evidence) {
        expect(evidence.kind).toBe('special-activation');
        if (evidence.kind !== 'special-activation') {
          continue;
        }
        expect(evidence.cause).toBe('wildcard');
        expect(evidence.wildcardTarget).toEqual({ mode: 'entire-board' });
        expect(evidence.stepIndex).toBe(0);
        const activation = activations[evidence.activationIndex];
        expect(activation).toBeDefined();
        expect(evidence.activationCoordinate).toEqual(activation!.coordinate);
        expect(evidence.activationReason).toBe(activation!.reason);
      }
    }
    expect(
      events.some((event) => event.coordinate.row === 3 && event.coordinate.column === 3),
    ).toBe(false);
  });

  it('excludes same-move spread target under entire-board pair coverage', () => {
    const board = wildcardPairBoard();
    const lockedSpread = { row: 1, column: 1 };
    const previousState = {
      ...makeThreatState(
        [
          { row: 0, column: 2 },
          { row: 1, column: 0 },
          { row: 2, column: 1 },
        ],
        {
          sourceCells: [{ row: 3, column: 3 }],
          acceptedMovesUntilSpread: 1,
        },
      ),
      threatenedCell: lockedSpread,
      acceptedMovesUntilSpread: 1,
    };
    const resolution = resolveCascade({
      board,
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      seed: 42,
      unavailableCoordinates: previousState.corruptedCells,
    });
    expect(resolution.isValid).toBe(true);
    if (!resolution.isValid) {
      return;
    }

    const events = planRiftHungerCleanses({
      previousState,
      resolution,
      newlySpreadCoordinate: lockedSpread,
    });
    expect(events).toHaveLength(3);
    expect(
      events.every((event) => !(event.coordinate.row === 1 && event.coordinate.column === 1)),
    ).toBe(true);

    const definition = makeDefinition({
      threat: threatDefinition({
        sourceCells: [{ row: 3, column: 3 }],
        spreadInterval: 3,
      }),
    });
    const session = createLevelSession({ definition, initialBoard: board });
    const prepared = {
      ...session.state,
      threatState: previousState,
    };
    const result = applyLevelMove({
      definition,
      state: prepared,
      from: { row: 0, column: 0 },
      to: { row: 0, column: 1 },
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }
    expect(result.movesConsumed).toBe(1);
    expect(result.threatTransition?.spreadEvent?.coordinate).toEqual(lockedSpread);
    expect(result.threatTransition?.cleanseEvents).toHaveLength(3);
    expect(result.nextState.threatState?.hungerCurrent).toBe(1);
    expect(result.nextState.threatState?.corruptedCells).toEqual(
      expect.arrayContaining([
        { row: 1, column: 1 },
        { row: 3, column: 3 },
      ]),
    );
    expect(
      result.nextState.threatState?.corruptedCells.some(
        (cell) => cell.row === 0 && cell.column === 2,
      ),
    ).toBe(false);
  });

  it('awards no cleanse score or collection for wildcard-pair cleansing via applyLevelMove', () => {
    const board = wildcardPairBoard();
    const definition = makeDefinition({
      threat: threatDefinition({ sourceCells: [{ row: 3, column: 3 }] }),
      objectives: [
        { id: 'score-main', kind: 'score', targetScore: 50_000 },
        { id: 'collect-emerald', kind: 'collect-piece', pieceType: 'emerald', targetCount: 8 },
      ],
    });
    const session = createLevelSession({ definition, initialBoard: board });
    const prepared = {
      ...session.state,
      threatState: makeThreatState(
        [
          { row: 0, column: 2 },
          { row: 1, column: 0 },
          { row: 2, column: 1 },
        ],
        { sourceCells: [{ row: 3, column: 3 }] },
      ),
    };
    const scoreBefore = prepared.score;
    const collectBefore =
      prepared.objectiveProgress.find((entry) => entry.objectiveId === 'collect-emerald')
        ?.current ?? 0;

    const runs = Array.from({ length: 10 }, () =>
      applyLevelMove({
        definition,
        state: prepared,
        from: { row: 0, column: 0 },
        to: { row: 0, column: 1 },
      }),
    );
    const first = runs[0]!;
    expect(first.accepted).toBe(true);
    if (!first.accepted) {
      return;
    }
    expect(first.threatTransition?.cleanseEvents).toHaveLength(3);
    expect(first.movesConsumed).toBe(1);
    expect(first.scoreAfter).toBe(scoreBefore + first.scoreCalculation.totalAwardedPoints);
    expect(
      first.scoreCalculation.events.every(
        (event) => event.kind === 'piece-clear' || event.kind === 'special-activation',
      ),
    ).toBe(true);
    const collectAfter =
      first.nextState.objectiveProgress.find((entry) => entry.objectiveId === 'collect-emerald')
        ?.current ?? 0;
    expect(collectAfter).toBeGreaterThanOrEqual(collectBefore);
    expect(first.nextState.threatState?.corruptedCells).toEqual([{ row: 3, column: 3 }]);
    expect(
      findMatchRuns(first.nextState.board, first.nextState.threatState!.corruptedCells).runs,
    ).toHaveLength(0);
    expect(
      findPlayableSwaps(first.nextState.board, first.nextState.threatState!.corruptedCells).length,
    ).toBeGreaterThan(0);

    for (const run of runs) {
      expect(run.accepted).toBe(true);
      if (!run.accepted || !first.accepted) {
        continue;
      }
      expect(run.scoreAfter).toBe(first.scoreAfter);
      expect(run.threatTransition?.cleanseEvents).toEqual(first.threatTransition?.cleanseEvents);
      expect(run.nextState.board.toGridSnapshot()).toEqual(first.nextState.board.toGridSnapshot());
    }
  });
});

describe('RH-2 special cleanse accounting via applyLevelMove', () => {
  it('awards no cleanse points or collection when specials touch corruption', () => {
    const board = boardFromPieces([
      [
        crossClearPiece('emerald'),
        lineClearPiece('sapphire', 'vertical'),
        standardPiece('topaz'),
        standardPiece('pearl'),
      ],
      [
        standardPiece('ruby'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
        standardPiece('ruby'),
      ],
      [
        standardPiece('topaz'),
        standardPiece('emerald'),
        standardPiece('sapphire'),
        standardPiece('topaz'),
      ],
      [
        standardPiece('pearl'),
        standardPiece('ruby'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
      ],
    ]);
    const definition = makeDefinition({
      threat: threatDefinition({ sourceCells: [{ row: 3, column: 0 }] }),
      objectives: [
        { id: 'score-main', kind: 'score', targetScore: 50_000 },
        { id: 'collect-topaz', kind: 'collect-piece', pieceType: 'topaz', targetCount: 8 },
      ],
    });
    const session = createLevelSession({ definition, initialBoard: board });
    const prepared = {
      ...session.state,
      threatState: makeThreatState(
        [
          { row: 0, column: 2 },
          { row: 1, column: 0 },
          { row: 2, column: 1 },
        ],
        { sourceCells: [{ row: 3, column: 0 }] },
      ),
    };
    const scoreBefore = prepared.score;
    const collectBefore =
      prepared.objectiveProgress.find((entry) => entry.objectiveId === 'collect-topaz')?.current ??
      0;

    const result = applyLevelMove({
      definition,
      state: prepared,
      from: { row: 0, column: 0 },
      to: { row: 0, column: 1 },
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }

    expect(result.threatTransition?.cleanseEvents).toHaveLength(3);
    expect(result.movesConsumed).toBe(1);
    expect(result.nextState.threatState?.hungerCurrent).toBe(0);

    // Score equals cascade calculation only — no cleanse bonus.
    expect(result.scoreAfter).toBe(scoreBefore + result.scoreCalculation.totalAwardedPoints);
    expect(
      result.scoreCalculation.events.every(
        (event) => event.kind === 'piece-clear' || event.kind === 'special-activation',
      ),
    ).toBe(true);

    const collectAfter =
      result.nextState.objectiveProgress.find((entry) => entry.objectiveId === 'collect-topaz')
        ?.current ?? 0;
    // Corrupted topaz at (0,2) was not removed as a piece, so collection cannot include it.
    for (const event of result.collectionEvents) {
      expect(event.coordinate.row === 0 && event.coordinate.column === 2 ? false : true).toBe(true);
    }
    expect(collectAfter).toBeGreaterThanOrEqual(collectBefore);
  });
});

describe('RH-2 special-cleanse returned-mask stabilization', () => {
  it('rearranges when a special cleanse exposes resting matches, deterministically ×10', () => {
    // Construct: horizontal line cleanse removes corruption that was splitting a ruby run.
    // Pre-move board places three rubies with the rightmost corrupted so cascade cannot clear them
    // as a match; after line cleanse the returned mask exposes an immediate match.
    const board = boardFromPieces([
      [
        standardPiece('ruby'),
        standardPiece('sapphire'),
        standardPiece('ruby'),
        standardPiece('ruby'),
      ],
      [
        standardPiece('topaz'),
        lineClearPiece('ruby', 'horizontal'),
        standardPiece('emerald'),
        standardPiece('pearl'),
      ],
      [
        standardPiece('emerald'),
        standardPiece('amethyst'),
        standardPiece('sapphire'),
        standardPiece('emerald'),
      ],
      [
        standardPiece('pearl'),
        standardPiece('topaz'),
        standardPiece('amethyst'),
        standardPiece('pearl'),
      ],
    ]);
    const definition = makeDefinition();
    const session = createLevelSession({ definition, initialBoard: board });
    const prepared = {
      ...session.state,
      threatState: makeThreatState([{ row: 0, column: 3 }]),
    };

    const runs = Array.from({ length: 10 }, () => {
      const result = applyLevelMove({
        definition,
        state: prepared,
        from: { row: 0, column: 1 },
        to: { row: 1, column: 1 },
      });
      expect(result.accepted).toBe(true);
      if (!result.accepted) {
        throw new Error('expected accepted move');
      }
      return result;
    });

    const first = runs[0]!;
    const cleanse = first.threatTransition?.cleanseEvents.find(
      (event) => event.coordinate.row === 0 && event.coordinate.column === 3,
    );
    expect(cleanse?.causes).toContain('line-clear');

    const returnedMask = first.nextState.threatState?.corruptedCells ?? [];
    expect(first.reshuffle).toBeDefined();
    const preRuns = findMatchRuns(first.resolution.finalBoard, returnedMask).runs.length;
    const preDead = isDeadBoard(first.resolution.finalBoard, returnedMask);
    expect(preRuns > 0 || preDead).toBe(true);
    expect(findMatchRuns(first.nextState.board, returnedMask).runs).toHaveLength(0);
    expect(findPlayableSwaps(first.nextState.board, returnedMask).length).toBeGreaterThan(0);
    expect(first.reshuffle!.originalInventory).toEqual(first.reshuffle!.reshuffledInventory);

    const hint = selectHint({
      board: first.nextState.board,
      levelIsActive: true,
      hintsEnabled: true,
      presentationState: {
        paused: false,
        playbackActive: false,
        inputLocked: false,
        shuttingDown: false,
        hasActiveHint: false,
      },
      unavailableCoordinates: returnedMask,
    });
    expect(hint.kind).toBe('hint');

    for (const run of runs) {
      expect(run.nextState.board.toGridSnapshot()).toEqual(first.nextState.board.toGridSnapshot());
      expect(run.reshuffle?.randomAttempts).toBe(first.reshuffle?.randomAttempts);
      expect(run.scoreAfter).toBe(first.scoreAfter);
      expect(run.threatTransition?.cleanseEvents).toEqual(first.threatTransition?.cleanseEvents);
    }
  });
});
