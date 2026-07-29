import { describe, expect, it } from 'vitest';
import { findMatchRuns, findPlayableSwaps, isSpecialPiece } from '../../../src/game/board';
import {
  createBrowserFixtureSession,
  getBrowserFixture,
} from '../../../src/game/content/testing/browserFixtures';
import { applyLevelMove } from '../../../src/game/level';

describe('browser fixtures', () => {
  it.each([
    'fast-gravity',
    'terminal-failure',
    'instant-resolution',
    'line-area-combination',
    'wildcard-target',
    'wildcard-pair',
  ] as const)('%s is stable, active, playable, and accepts its expected move', (fixtureId) => {
    const fixture = getBrowserFixture(fixtureId);
    expect(fixture).not.toBeNull();
    if (!fixture) return;

    const session = createBrowserFixtureSession(fixture);
    expect(findMatchRuns(session.state.board).runs).toEqual([]);
    expect(session.state.status).toBe('active');
    expect(findPlayableSwaps(session.state.board)).toContainEqual({
      ...fixture.expectedMove,
      kind: expect.any(String),
    });

    const result = applyLevelMove({
      definition: fixture.definition,
      state: session.state,
      ...fixture.expectedMove,
    });
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.movesAfter).toBe(session.state.movesRemaining - 1);
      expect(result.scoreAfter).toBeGreaterThan(0);
      expect(result.resolution.steps.length).toBeGreaterThan(0);
    }
  });

  it('keeps wildcard-pair special activation inside the normal domain resolution', () => {
    const fixture = getBrowserFixture('wildcard-pair');
    expect(fixture).not.toBeNull();
    if (!fixture) return;

    expect(fixture.initialBoard.getPieceAt({ row: 4, column: 4 }).kind).toBe('wildcard');
    expect(fixture.initialBoard.getPieceAt({ row: 4, column: 5 }).kind).toBe('wildcard');
    expect(isSpecialPiece(fixture.initialBoard.getPieceAt({ row: 6, column: 6 }))).toBe(true);

    const result = applyLevelMove({
      definition: fixture.definition,
      state: createBrowserFixtureSession(fixture).state,
      ...fixture.expectedMove,
    });
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      const activations = result.resolution.steps.flatMap((step) => step.activationEvents);
      expect(activations.filter((activation) => activation.piece.kind === 'wildcard')).toHaveLength(
        2,
      );
      expect(activations.some((activation) => activation.piece.kind === 'line-clear')).toBe(true);
    }
  });

  it('keeps direct special combinations and wildcard targeting in the normal domain resolution', () => {
    const lineAreaFixture = getBrowserFixture('line-area-combination');
    const wildcardFixture = getBrowserFixture('wildcard-target');
    expect(lineAreaFixture).not.toBeNull();
    expect(wildcardFixture).not.toBeNull();
    if (!lineAreaFixture || !wildcardFixture) return;

    const lineAreaResult = applyLevelMove({
      definition: lineAreaFixture.definition,
      state: createBrowserFixtureSession(lineAreaFixture).state,
      ...lineAreaFixture.expectedMove,
    });
    expect(lineAreaResult.accepted).toBe(true);
    if (lineAreaResult.accepted) {
      const kinds = lineAreaResult.resolution.steps.flatMap((step) =>
        step.activationEvents.map((activation) => activation.piece.kind),
      );
      expect(kinds).toEqual(expect.arrayContaining(['line-clear', 'area-clear']));
    }

    const wildcardResult = applyLevelMove({
      definition: wildcardFixture.definition,
      state: createBrowserFixtureSession(wildcardFixture).state,
      ...wildcardFixture.expectedMove,
    });
    expect(wildcardResult.accepted).toBe(true);
    if (wildcardResult.accepted) {
      const wildcardActivations = wildcardResult.resolution.steps.flatMap((step) =>
        step.activationEvents.filter((activation) => activation.piece.kind === 'wildcard'),
      );
      expect(wildcardActivations).toHaveLength(1);
      expect(wildcardActivations[0]?.wildcardTarget).toEqual({
        mode: 'piece-type',
        pieceType: 'topaz',
      });
    }
  });

  it('returns null for unknown fixture ids', () => {
    expect(getBrowserFixture('unknown')).toBeNull();
  });
});
