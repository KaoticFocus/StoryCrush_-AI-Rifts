import {
  Board,
  createLineClearPiece,
  createWildcardPiece,
  type BoardCoordinate,
} from '../../board';
import {
  applyLevelMove,
  cloneRiftHungerState,
  createLevelSession,
  type CreateLevelSessionResult,
  type LevelDefinition,
  type LevelSessionState,
  type RiftHungerState,
  validateRiftHungerStateRelationship,
} from '../../level';
import { createPrototypeBoard, prototypeLevelDefinition } from '../prototypeLevel';

export type BrowserFixtureId =
  | 'fast-gravity'
  | 'terminal-failure'
  | 'instant-resolution'
  | 'line-area-combination'
  | 'wildcard-target'
  | 'wildcard-pair'
  | 'rift-spread'
  | 'rift-cleanse'
  | 'rift-overwhelm';

export interface BrowserFixture {
  id: BrowserFixtureId;
  definition: LevelDefinition;
  initialBoard: Board;
  expectedMove: {
    from: BoardCoordinate;
    to: BoardCoordinate;
  };
  /** Optional threat-state seed applied after session create (RH-1 cleanse fixtures). */
  prepareThreatState?: (state: RiftHungerState) => RiftHungerState;
  expectedOutcome: {
    scoreAfter: number;
    movesAfter: number;
    objectivesHash: string;
    moveKind: string;
    commandKinds: string[];
    activationCount: number;
  };
}

function createFixtureDefinition(id: BrowserFixtureId, seed: number): LevelDefinition {
  return {
    ...prototypeLevelDefinition,
    id: `browser-${id}`,
    seed,
    moveLimit: 5,
    objectives: [
      { id: 'score-target', kind: 'score', targetScore: 10_000 },
      { id: 'collect-ruby', kind: 'collect-piece', pieceType: 'ruby', targetCount: 100 },
    ],
  };
}

function createPrototypeFixtureBoard(): Board {
  return Board.fromGrid(createPrototypeBoard().toGridSnapshot());
}

function createWildcardPairBoard(): Board {
  const grid = createPrototypeBoard().toGridSnapshot();
  grid[4][4] = createWildcardPiece('emerald');
  grid[4][5] = createWildcardPiece('topaz');
  grid[6][6] = createLineClearPiece('ruby', 'horizontal');
  return Board.fromGrid(grid);
}

function objectivesHash(session: CreateLevelSessionResult['state']): string {
  return session.objectiveProgress
    .map((objective) => `${objective.objectiveId}:${objective.current}/${objective.target}`)
    .join(',');
}

function withPreparedThreatState(
  definition: LevelDefinition,
  state: LevelSessionState,
  prepareThreatState?: (threat: RiftHungerState) => RiftHungerState,
): LevelSessionState {
  if (!prepareThreatState || !state.threatState || !definition.threat) {
    return state;
  }
  const nextThreat = validateRiftHungerStateRelationship({
    definition: definition.threat,
    state: prepareThreatState(cloneRiftHungerState(state.threatState)),
    boardDimensions: state.board.getDimensions(),
  });
  return {
    ...state,
    threatState: nextThreat,
  };
}

function createFixture(input: Omit<BrowserFixture, 'expectedOutcome'>): BrowserFixture {
  const session = createLevelSession({
    definition: input.definition,
    initialBoard: input.initialBoard,
  });
  const preparedState = withPreparedThreatState(
    input.definition,
    session.state,
    input.prepareThreatState,
  );
  const result = applyLevelMove({
    definition: input.definition,
    state: preparedState,
    ...input.expectedMove,
  });
  if (!result.accepted) {
    throw new Error(`browser fixture ${input.id} expected move was rejected`);
  }

  return {
    ...input,
    expectedOutcome: {
      scoreAfter: result.scoreAfter,
      movesAfter: result.movesAfter,
      objectivesHash: objectivesHash(result.nextState),
      moveKind: result.moveKind,
      commandKinds: [
        'swap',
        ...result.resolution.steps.flatMap((step) => [
          'highlight-matches',
          ...step.activationEvents.map(() => 'special-activation'),
          'remove-pieces',
          'apply-gravity',
          'refill-pieces',
        ]),
        ...(result.threatTransition?.cleanseEvents.length ? ['rift-cleanse'] : []),
        ...(result.threatTransition?.spreadEvent ? ['rift-spread'] : []),
        ...(result.threatTransition ? ['rift-threat-sync'] : []),
        'synchronize-board',
      ],
      activationCount: result.resolution.steps.reduce(
        (count, step) => count + step.activationEvents.length,
        0,
      ),
    },
  };
}

const fixtures: Record<BrowserFixtureId, BrowserFixture> = {
  'fast-gravity': createFixture({
    id: 'fast-gravity',
    definition: createFixtureDefinition('fast-gravity', 31_001),
    initialBoard: createPrototypeFixtureBoard(),
    expectedMove: { from: { row: 0, column: 1 }, to: { row: 1, column: 1 } },
  }),
  'terminal-failure': createFixture({
    id: 'terminal-failure',
    definition: {
      ...createFixtureDefinition('terminal-failure', 31_006),
      moveLimit: 1,
    },
    initialBoard: createPrototypeFixtureBoard(),
    expectedMove: { from: { row: 0, column: 1 }, to: { row: 1, column: 1 } },
  }),
  'instant-resolution': createFixture({
    id: 'instant-resolution',
    definition: createFixtureDefinition('instant-resolution', 31_002),
    initialBoard: createPrototypeFixtureBoard(),
    expectedMove: { from: { row: 0, column: 1 }, to: { row: 1, column: 1 } },
  }),
  'line-area-combination': createFixture({
    id: 'line-area-combination',
    definition: createFixtureDefinition('line-area-combination', 31_003),
    initialBoard: createPrototypeFixtureBoard(),
    expectedMove: { from: { row: 6, column: 6 }, to: { row: 6, column: 7 } },
  }),
  'wildcard-target': createFixture({
    id: 'wildcard-target',
    definition: createFixtureDefinition('wildcard-target', 31_004),
    initialBoard: createPrototypeFixtureBoard(),
    expectedMove: { from: { row: 4, column: 4 }, to: { row: 4, column: 5 } },
  }),
  'wildcard-pair': createFixture({
    id: 'wildcard-pair',
    definition: createFixtureDefinition('wildcard-pair', 31_005),
    initialBoard: createWildcardPairBoard(),
    expectedMove: { from: { row: 4, column: 4 }, to: { row: 4, column: 5 } },
  }),
  'rift-spread': createFixture({
    id: 'rift-spread',
    definition: {
      ...createFixtureDefinition('rift-spread', 31_007),
      threat: {
        kind: 'rift-hunger',
        sourceCells: [{ row: 7, column: 7 }],
        spreadInterval: 1,
        hungerMaximum: 5,
        spreadPriority: 'orthogonal-stable-coordinate',
      },
    },
    initialBoard: createPrototypeFixtureBoard(),
    expectedMove: { from: { row: 0, column: 1 }, to: { row: 1, column: 1 } },
  }),
  'rift-cleanse': createFixture({
    id: 'rift-cleanse',
    definition: {
      ...createFixtureDefinition('rift-cleanse', 31_008),
      threat: {
        kind: 'rift-hunger',
        sourceCells: [{ row: 7, column: 0 }],
        spreadInterval: 3,
        hungerMaximum: 5,
        spreadPriority: 'orthogonal-stable-coordinate',
      },
    },
    initialBoard: createPrototypeFixtureBoard(),
    expectedMove: { from: { row: 0, column: 1 }, to: { row: 1, column: 1 } },
    prepareThreatState: (threat) => ({
      ...threat,
      corruptedCells: [
        { row: 1, column: 0 },
        { row: 7, column: 0 },
      ],
      threatenedCell: { row: 7, column: 1 },
      acceptedMovesUntilSpread: 3,
      status: 'active',
    }),
  }),
  'rift-overwhelm': createFixture({
    id: 'rift-overwhelm',
    definition: {
      ...createFixtureDefinition('rift-overwhelm', 31_009),
      threat: {
        kind: 'rift-hunger',
        sourceCells: [{ row: 7, column: 7 }],
        spreadInterval: 1,
        hungerMaximum: 1,
        spreadPriority: 'orthogonal-stable-coordinate',
      },
    },
    initialBoard: createPrototypeFixtureBoard(),
    expectedMove: { from: { row: 0, column: 1 }, to: { row: 1, column: 1 } },
  }),
};

export function getBrowserFixture(id: string | null): BrowserFixture | null {
  if (!id || !Object.hasOwn(fixtures, id)) {
    return null;
  }
  return fixtures[id as BrowserFixtureId];
}

export function createBrowserFixtureSession(fixture: BrowserFixture): CreateLevelSessionResult {
  const session = createLevelSession({
    definition: fixture.definition,
    initialBoard: fixture.initialBoard,
  });
  return {
    ...session,
    state: withPreparedThreatState(fixture.definition, session.state, fixture.prepareThreatState),
  };
}
