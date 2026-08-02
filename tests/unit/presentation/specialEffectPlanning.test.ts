import { describe, expect, it } from 'vitest';
import { buildSpecialEffectPresentation } from '../../../src/game/presentation/playback/specialEffectPlanning';
import { crossClearPiece, lineClearPiece, wildcardPiece } from '../board/boardTestHelpers';

describe('buildSpecialEffectPresentation', () => {
  it('builds horizontal line-clear branches from the source coordinate', () => {
    const plan = buildSpecialEffectPresentation({
      dimensions: { rows: 5, columns: 5 },
      event: {
        index: 0,
        coordinate: { row: 2, column: 2 },
        piece: lineClearPiece('ruby', 'horizontal'),
        reason: 'matched',
        affectedCoordinates: [
          { row: 2, column: 0 },
          { row: 2, column: 1 },
          { row: 2, column: 2 },
          { row: 2, column: 3 },
          { row: 2, column: 4 },
        ],
        newlyTriggeredSpecialCoordinates: [{ row: 2, column: 4 }],
      },
    });

    expect(plan.kind).toBe('line-clear-horizontal');
    if (plan.kind !== 'line-clear-horizontal') {
      return;
    }

    expect(plan.backwardBranch).toEqual([
      { row: 2, column: 1 },
      { row: 2, column: 0 },
    ]);
    expect(plan.forwardBranch).toEqual([
      { row: 2, column: 3 },
      { row: 2, column: 4 },
    ]);
  });

  it('builds vertical line-clear branches at edges without out-of-bounds coordinates', () => {
    const plan = buildSpecialEffectPresentation({
      dimensions: { rows: 4, columns: 1 },
      event: {
        index: 0,
        coordinate: { row: 0, column: 0 },
        piece: lineClearPiece('sapphire', 'vertical'),
        reason: 'direct-swap',
        affectedCoordinates: [
          { row: 0, column: 0 },
          { row: 1, column: 0 },
          { row: 2, column: 0 },
          { row: 3, column: 0 },
        ],
        newlyTriggeredSpecialCoordinates: [],
      },
    });

    expect(plan.kind).toBe('line-clear-vertical');
    if (plan.kind !== 'line-clear-vertical') {
      return;
    }

    expect(plan.backwardBranch).toEqual([]);
    expect(plan.forwardBranch).toEqual([
      { row: 1, column: 0 },
      { row: 2, column: 0 },
      { row: 3, column: 0 },
    ]);
  });

  it('builds cross-clear row/column branches and distance rings', () => {
    const centerPlan = buildSpecialEffectPresentation({
      dimensions: { rows: 5, columns: 5 },
      event: {
        index: 1,
        coordinate: { row: 2, column: 2 },
        piece: crossClearPiece('emerald'),
        reason: 'matched',
        affectedCoordinates: [
          { row: 2, column: 0 },
          { row: 2, column: 1 },
          { row: 2, column: 2 },
          { row: 2, column: 3 },
          { row: 2, column: 4 },
          { row: 0, column: 2 },
          { row: 1, column: 2 },
          { row: 3, column: 2 },
          { row: 4, column: 2 },
        ],
        newlyTriggeredSpecialCoordinates: [],
      },
    });
    expect(centerPlan.kind).toBe('cross-clear');
    if (centerPlan.kind !== 'cross-clear') {
      return;
    }
    expect(centerPlan.rings[0]).toEqual([{ row: 2, column: 2 }]);
    expect(centerPlan.rowBranch).toEqual([
      { row: 2, column: 0 },
      { row: 2, column: 1 },
      { row: 2, column: 2 },
      { row: 2, column: 3 },
      { row: 2, column: 4 },
    ]);
    expect(centerPlan.columnBranch).toEqual([
      { row: 0, column: 2 },
      { row: 1, column: 2 },
      { row: 3, column: 2 },
      { row: 4, column: 2 },
    ]);

    const edgePlan = buildSpecialEffectPresentation({
      dimensions: { rows: 3, columns: 3 },
      event: {
        index: 2,
        coordinate: { row: 0, column: 0 },
        piece: crossClearPiece('emerald'),
        reason: 'matched',
        affectedCoordinates: [
          { row: 0, column: 0 },
          { row: 0, column: 1 },
          { row: 0, column: 2 },
          { row: 1, column: 0 },
          { row: 2, column: 0 },
        ],
        newlyTriggeredSpecialCoordinates: [],
      },
    });
    expect(edgePlan.kind).toBe('cross-clear');
    if (edgePlan.kind !== 'cross-clear') {
      return;
    }
    expect(edgePlan.rowBranch).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
    ]);
    expect(edgePlan.columnBranch).toEqual([
      { row: 1, column: 0 },
      { row: 2, column: 0 },
    ]);
  });

  it('distinguishes wildcard piece-type targets from full-board effects deterministically', () => {
    const targetPlan = buildSpecialEffectPresentation({
      dimensions: { rows: 3, columns: 3 },
      event: {
        index: 0,
        coordinate: { row: 1, column: 1 },
        piece: wildcardPiece('ruby'),
        reason: 'direct-swap',
        wildcardTarget: { mode: 'piece-type', pieceType: 'sapphire' },
        affectedCoordinates: [
          { row: 0, column: 0 },
          { row: 0, column: 2 },
          { row: 2, column: 1 },
        ],
        newlyTriggeredSpecialCoordinates: [{ row: 2, column: 1 }],
      },
    });
    expect(targetPlan.kind).toBe('wildcard-target');

    const fullBoardPlan = buildSpecialEffectPresentation({
      dimensions: { rows: 2, columns: 2 },
      event: {
        index: 1,
        coordinate: { row: 0, column: 0 },
        piece: wildcardPiece('emerald'),
        reason: 'direct-swap',
        wildcardTarget: { mode: 'entire-board' },
        affectedCoordinates: [
          { row: 0, column: 0 },
          { row: 0, column: 1 },
          { row: 1, column: 0 },
          { row: 1, column: 1 },
        ],
        newlyTriggeredSpecialCoordinates: [],
      },
    });
    expect(fullBoardPlan.kind).toBe('wildcard-full-board');
  });
});
