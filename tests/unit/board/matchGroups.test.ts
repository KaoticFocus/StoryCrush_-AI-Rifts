import { describe, expect, it } from 'vitest';
import {
  classifyMatchGroup,
  classifyMatchGroups,
  groupMatchRuns,
} from '../../../src/game/board/matchGroups';
import { MatchDetectionResult } from '../../../src/game/board/boardTypes';

function coordinate(row: number, column: number) {
  return { row, column };
}

describe('match group classification', () => {
  it('groups intersecting runs and leaves independent runs separate', () => {
    const matches: MatchDetectionResult = {
      runs: [
        {
          orientation: 'horizontal',
          pieceType: 'ruby',
          coordinates: [coordinate(1, 1), coordinate(1, 2), coordinate(1, 3)],
        },
        {
          orientation: 'vertical',
          pieceType: 'ruby',
          coordinates: [coordinate(0, 2), coordinate(1, 2), coordinate(2, 2)],
        },
        {
          orientation: 'horizontal',
          pieceType: 'sapphire',
          coordinates: [coordinate(4, 0), coordinate(4, 1), coordinate(4, 2)],
        },
      ],
      matchedCoordinates: [
        coordinate(1, 1),
        coordinate(1, 2),
        coordinate(1, 3),
        coordinate(0, 2),
        coordinate(2, 2),
        coordinate(4, 0),
        coordinate(4, 1),
        coordinate(4, 2),
      ],
    };

    const groups = groupMatchRuns(matches);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.pieceType)).toEqual(['ruby', 'sapphire']);
    expect(groups[0].coordinates).toEqual([
      coordinate(0, 2),
      coordinate(1, 1),
      coordinate(1, 2),
      coordinate(1, 3),
      coordinate(2, 2),
    ]);
  });

  it('classifies t-shaped and l-shaped groups deterministically', () => {
    const tShapeMatches: MatchDetectionResult = {
      runs: [
        {
          orientation: 'horizontal',
          pieceType: 'ruby',
          coordinates: [coordinate(1, 1), coordinate(1, 2), coordinate(1, 3)],
        },
        {
          orientation: 'vertical',
          pieceType: 'ruby',
          coordinates: [coordinate(0, 2), coordinate(1, 2), coordinate(2, 2)],
        },
      ],
      matchedCoordinates: [
        coordinate(1, 1),
        coordinate(1, 2),
        coordinate(1, 3),
        coordinate(0, 2),
        coordinate(2, 2),
      ],
    };

    const lShapeMatches: MatchDetectionResult = {
      runs: [
        {
          orientation: 'horizontal',
          pieceType: 'emerald',
          coordinates: [coordinate(2, 1), coordinate(2, 2), coordinate(2, 3)],
        },
        {
          orientation: 'vertical',
          pieceType: 'emerald',
          coordinates: [coordinate(2, 3), coordinate(3, 3), coordinate(4, 3)],
        },
      ],
      matchedCoordinates: [
        coordinate(2, 1),
        coordinate(2, 2),
        coordinate(2, 3),
        coordinate(3, 3),
        coordinate(4, 3),
      ],
    };

    const tShapeGroup = classifyMatchGroup(groupMatchRuns(tShapeMatches)[0]);
    const lShapeGroup = classifyMatchGroups(groupMatchRuns(lShapeMatches))[0];

    expect(tShapeGroup.shape).toBe('cross-shape');
    expect(tShapeGroup.pivotCoordinates).toEqual([coordinate(1, 2)]);
    expect(tShapeGroup.primaryOrientation).toBe('horizontal');

    expect(lShapeGroup.shape).toBe('l-shape');
    expect(lShapeGroup.pivotCoordinates).toEqual([coordinate(2, 3)]);
  });
});
