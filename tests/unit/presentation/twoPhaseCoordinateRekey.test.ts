import { describe, expect, it } from 'vitest';
import { planTwoPhaseCoordinateRekey } from '../../../src/game/presentation/playback/twoPhaseCoordinateRekey';

describe('planTwoPhaseCoordinateRekey', () => {
  it('vacates overlapping sources before deterministically publishing destinations', () => {
    const sourceMap = new Map([
      ['1:0', 'top-piece'],
      ['3:0', 'bottom-piece'],
      ['2:1', 'horizontal-line-clear'],
      ['1:1', 'vertical-line-clear'],
    ]);
    const plan = planTwoPhaseCoordinateRekey([
      { fromKey: '1:0', toKey: '3:0' },
      { fromKey: '3:0', toKey: '4:0' },
      { fromKey: '2:1', toKey: '3:1' },
      { fromKey: '1:1', toKey: '2:1' },
    ]);

    for (const key of plan.sourceKeysToRemove) sourceMap.delete(key);
    for (const assignment of plan.destinationAssignments) {
      const source = ['1:0', '3:0', '2:1', '1:1'][assignment.movementIndex];
      const destination = plan.destinationAssignments[assignment.movementIndex].toKey;
      const value = ['top-piece', 'bottom-piece', 'horizontal-line-clear', 'vertical-line-clear'][
        assignment.movementIndex
      ];
      expect(source).toBeDefined();
      sourceMap.set(destination, value);
    }

    expect([...sourceMap.entries()]).toEqual([
      ['3:0', 'top-piece'],
      ['4:0', 'bottom-piece'],
      ['3:1', 'horizontal-line-clear'],
      ['2:1', 'vertical-line-clear'],
    ]);
  });

  it('rejects duplicate source or destination keys without mutating caller movement data', () => {
    const movements = [
      { fromKey: '1:0', toKey: '2:0' },
      { fromKey: '3:0', toKey: '2:0' },
    ];
    expect(() => planTwoPhaseCoordinateRekey(movements)).toThrow(
      'duplicate gravity destination key',
    );
    expect(movements).toEqual([
      { fromKey: '1:0', toKey: '2:0' },
      { fromKey: '3:0', toKey: '2:0' },
    ]);
  });
});
