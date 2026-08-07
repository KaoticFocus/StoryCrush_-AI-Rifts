import { describe, expect, it } from 'vitest';
import { getBoardHash } from '../../../../src/game/presentation/testing/BrowserTestStatusBridge';
import {
  createGeneratedLevelSession,
  createPlayableLevelContent,
  getExperienceLabel,
  getPlayableLevelContent,
  getPlayableLevelIds,
  getThreatSummary,
  isThreatLevel,
  validatePlayableLevelCatalog,
} from '../../../../src/game/content/levelCatalog';
import { DEFAULT_SCORING_RULES } from '../../../../src/game/level';
import { findMatchRuns, hasValidScoringSwap } from '../../../../src/game/board';

describe('level catalog', () => {
  it('exposes the built-in fantasy levels and validates lookup', () => {
    expect(getPlayableLevelIds()).toEqual([
      'archive-stabilization',
      'moonwell-recovery',
      'thornwake-containment',
      'rootbound-seal',
      'rift-erosion-lab',
    ]);

    const archive = getPlayableLevelContent('archive-stabilization');
    expect(archive?.title).toBe('Archive Stabilization');
    expect(archive?.definition.moveLimit).toBe(15);
    expect(archive?.definition.objectives).toEqual([
      { id: 'score-target', kind: 'score', targetScore: 2500 },
      { id: 'collect-ruby', kind: 'collect-piece', pieceType: 'ruby', targetCount: 10 },
    ]);
    expect(archive?.experienceKind).toBe('calm');
    expect(isThreatLevel(archive!)).toBe(false);
    expect(getThreatSummary(archive!)).toBeNull();
    expect(getExperienceLabel(archive!)).toBeNull();

    const thornwake = getPlayableLevelContent('thornwake-containment');
    expect(thornwake?.title).toBe('Thornwake Containment');
    expect(thornwake?.experienceKind).toBe('rift-pressure');
    expect(thornwake?.boardRows).toBe(8);
    expect(thornwake?.boardColumns).toBe(8);
    expect(thornwake?.allowedPieceTypes).toEqual([
      'ruby',
      'sapphire',
      'emerald',
      'topaz',
      'amethyst',
      'pearl',
    ]);
    expect(thornwake?.definition.seed).toBe(1831);
    expect(thornwake?.definition.threat).toEqual({
      kind: 'rift-hunger',
      sourceCells: [{ row: 7, column: 3 }],
      spreadInterval: 3,
      hungerMaximum: 5,
      spreadPriority: 'orthogonal-stable-coordinate',
    });
    expect(getExperienceLabel(thornwake!)).toBe('Fantasy Pressure');
    expect(getThreatSummary(thornwake!)).toBe('Rift every 3 moves · Hunger 5');

    const lab = getPlayableLevelContent('rift-erosion-lab');
    expect(lab?.definition.moveLimit).toBe(15);
    expect(lab?.definition.threat?.hungerMaximum).toBe(5);
    expect(lab?.definition.threat?.spreadInterval).toBe(3);
    expect(getExperienceLabel(lab!)).toBe('Experimental Rift Hunger');

    expect(getPlayableLevelContent('missing-level')).toBeNull();
  });

  it('creates stable boards for the same level and seed while varying with different seeds', () => {
    const archive = getPlayableLevelContent('archive-stabilization');
    expect(archive).not.toBeNull();

    const sameSeed = createGeneratedLevelSession({
      content: archive!,
      seed: 1807,
      seedProvider: undefined,
    });
    const sameSeedAgain = createGeneratedLevelSession({
      content: archive!,
      seed: 1807,
      seedProvider: undefined,
    });

    expect(getBoardHash(sameSeed.state.board)).toBe(getBoardHash(sameSeedAgain.state.board));

    const differentSeed = createGeneratedLevelSession({
      content: archive!,
      seed: 1808,
      seedProvider: undefined,
    });

    expect(getBoardHash(sameSeed.state.board)).not.toBe(getBoardHash(differentSeed.state.board));
    expect(sameSeed.state.board.getDimensions()).toEqual({ rows: 8, columns: 8 });
    expect(sameSeed.state.objectiveProgress).toHaveLength(2);
    expect(sameSeed.state.baseSeed).toBe(1807);
    expect(findMatchRuns(sameSeed.state.board).runs).toEqual([]);
    expect(hasValidScoringSwap(sameSeed.state.board)).toBe(true);
    expect(
      sameSeed.state.board
        .toGridSnapshot()
        .flat()
        .every((piece) => archive!.allowedPieceTypes.includes(piece.pieceType)),
    ).toBe(true);
  });

  it('uses an injected seed provider and rejects missing or invalid seeds', () => {
    const archive = getPlayableLevelContent('archive-stabilization')!;
    const generated = createGeneratedLevelSession({
      content: archive,
      seedProvider: { nextSeed: () => 4242 },
    });

    expect(generated.state.baseSeed).toBe(4242);
    expect(() => createGeneratedLevelSession({ content: archive })).toThrow(/seed is required/);
    expect(() => createGeneratedLevelSession({ content: archive, seed: -1 })).toThrow(
      /seed is required/,
    );
  });

  it('rejects invalid dimensions, allowed pieces, objectives, move limits, and duplicate ids', () => {
    const create = (overrides: Record<string, unknown> = {}) =>
      createPlayableLevelContent({
        title: 'Test',
        subtitle: 'Test level',
        definition: {
          id: 'test-level',
          moveLimit: 10,
          allowedRefillPieceTypes: ['ruby', 'sapphire'],
          objectives: [{ id: 'score', kind: 'score', targetScore: 100 }],
          scoring: DEFAULT_SCORING_RULES,
          seed: 1,
          ...overrides,
        },
      });

    expect(() =>
      createPlayableLevelContent({
        title: 'Test',
        subtitle: 'Test level',
        boardRows: 0,
        definition: create().definition,
      }),
    ).toThrow();
    expect(() => create({ allowedRefillPieceTypes: [] })).toThrow();
    expect(() => create({ objectives: [] })).toThrow();
    expect(() => create({ moveLimit: 0 })).toThrow();
    const level = create();
    expect(() => validatePlayableLevelCatalog([level, level])).toThrow(/duplicate level id/);
  });
});
