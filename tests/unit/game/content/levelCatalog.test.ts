import { describe, expect, it } from 'vitest';
import { getBoardHash } from '../../../../src/game/presentation/testing/BrowserTestStatusBridge';
import {
  createGeneratedLevelSession,
  getPlayableLevelContent,
  getPlayableLevelIds,
} from '../../../../src/game/content/levelCatalog';

describe('level catalog', () => {
  it('exposes the built-in fantasy levels and validates lookup', () => {
    expect(getPlayableLevelIds()).toEqual([
      'archive-stabilization',
      'moonwell-recovery',
      'rootbound-seal',
    ]);

    const archive = getPlayableLevelContent('archive-stabilization');
    expect(archive?.title).toBe('Archive Stabilization');
    expect(archive?.definition.moveLimit).toBe(15);
    expect(archive?.definition.objectives).toHaveLength(2);

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
  });
});
