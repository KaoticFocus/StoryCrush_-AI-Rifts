import { describe, expect, it } from 'vitest';
import { applyGravity } from '../../../src/game/board/applyGravity';
import { standardGrid } from './boardTestHelpers';

describe('applyGravity', () => {
  it('keeps a full grid unchanged', () => {
    const grid = standardGrid([
      ['ruby', 'sapphire'],
      ['topaz', 'amethyst'],
    ]);

    expect(applyGravity(grid)).toEqual(grid);
  });

  it('handles one gap in a column', () => {
    const grid = standardGrid([[null], ['ruby'], ['topaz']]);
    expect(applyGravity(grid)).toEqual(standardGrid([[null], ['ruby'], ['topaz']]));
  });

  it('handles multiple separated gaps and preserves piece order', () => {
    const grid = standardGrid([['ruby'], [null], ['sapphire'], [null], ['emerald']]);
    expect(applyGravity(grid)).toEqual(
      standardGrid([[null], [null], ['ruby'], ['sapphire'], ['emerald']]),
    );
  });

  it('handles empty cells at top and bottom', () => {
    const grid = standardGrid([[null], ['ruby'], [null]]);
    expect(applyGravity(grid)).toEqual(standardGrid([[null], [null], ['ruby']]));
  });

  it('handles entirely empty columns', () => {
    const grid = standardGrid([
      [null, 'ruby'],
      [null, 'sapphire'],
      [null, 'topaz'],
    ]);

    expect(applyGravity(grid)).toEqual([
      [null, standardGrid([['ruby'], ['sapphire'], ['topaz']])[0][0]],
      [null, standardGrid([['ruby'], ['sapphire'], ['topaz']])[1][0]],
      [null, standardGrid([['ruby'], ['sapphire'], ['topaz']])[2][0]],
    ]);
  });

  it('handles multiple columns with different gap patterns', () => {
    const grid = standardGrid([
      ['ruby', null, 'emerald'],
      [null, 'sapphire', null],
      ['topaz', null, 'amethyst'],
      [null, 'pearl', null],
    ]);

    expect(applyGravity(grid)).toEqual(
      standardGrid([
        [null, null, null],
        [null, null, null],
        ['ruby', 'sapphire', 'emerald'],
        ['topaz', 'pearl', 'amethyst'],
      ]),
    );
  });

  it('supports rectangular and single-row grids', () => {
    expect(
      applyGravity(
        standardGrid([
          ['ruby', null, 'topaz'],
          [null, 'sapphire', 'amethyst'],
        ]),
      ),
    ).toEqual(
      standardGrid([
        [null, null, 'topaz'],
        ['ruby', 'sapphire', 'amethyst'],
      ]),
    );

    expect(applyGravity(standardGrid([[null, 'ruby', null]]))).toEqual(
      standardGrid([[null, 'ruby', null]]),
    );
  });

  it('supports single-column grids', () => {
    expect(applyGravity(standardGrid([['ruby'], [null], ['sapphire'], [null]]))).toEqual(
      standardGrid([[null], [null], ['ruby'], ['sapphire']]),
    );
  });

  it('does not mutate the input grid', () => {
    const grid = standardGrid([
      ['ruby', null],
      [null, 'sapphire'],
    ]);

    const before = grid.map((row) => [...row]);
    applyGravity(grid);

    expect(grid).toEqual(before);
  });
});
