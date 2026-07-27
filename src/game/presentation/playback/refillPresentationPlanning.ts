import { type RefillPlacement } from '../../board';
import { type RefillPresentationEntry } from './playbackTypes';

function clonePlacement(placement: RefillPlacement): RefillPlacement {
  return {
    coordinate: { ...placement.coordinate },
    piece: { ...placement.piece },
  };
}

export function planRefillPresentation(input: {
  rows: number;
  placements: readonly RefillPlacement[];
}): RefillPresentationEntry[] {
  const groupedPlacements = new Map<number, Array<{ placement: RefillPlacement; index: number }>>();

  input.placements.forEach((placement, index) => {
    const clonedPlacement = clonePlacement(placement);
    const columnPlacements = groupedPlacements.get(clonedPlacement.coordinate.column) ?? [];
    columnPlacements.push({ placement: clonedPlacement, index });
    groupedPlacements.set(clonedPlacement.coordinate.column, columnPlacements);
  });

  const entries: RefillPresentationEntry[] = [];

  for (const [, columnPlacements] of [...groupedPlacements.entries()].sort(
    ([left], [right]) => left - right,
  )) {
    const orderedColumnPlacements = [...columnPlacements].sort(
      (left, right) => left.placement.coordinate.row - right.placement.coordinate.row,
    );
    const stackSize = orderedColumnPlacements.length;

    orderedColumnPlacements.forEach(({ placement, index }, stackIndex) => {
      entries.push({
        index,
        destination: { ...placement.coordinate },
        piece: { ...placement.piece },
        startRow: -stackSize + stackIndex,
        stackIndex,
        stackSize,
      });
    });
  }

  return entries.sort((left, right) => left.index - right.index);
}
