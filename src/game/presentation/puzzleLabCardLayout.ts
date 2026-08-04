export interface PuzzleLabCardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PuzzleLabCardLayout {
  columns: number;
  compact: boolean;
  cards: PuzzleLabCardBounds[];
}

export function calculatePuzzleLabCardLayout(input: {
  width: number;
  height: number;
  cardCount: number;
}): PuzzleLabCardLayout {
  const width = Math.max(1, Math.floor(input.width));
  const height = Math.max(1, Math.floor(input.height));
  const cardCount = Math.max(0, Math.floor(input.cardCount));
  const portrait = width < height;
  const phone = Math.min(width, height) < 600;
  const columns = phone
    ? portrait
      ? 1
      : Math.min(2, cardCount)
    : width >= 1120 && width / Math.max(1, cardCount) >= 250
      ? Math.min(4, cardCount)
      : Math.min(2, cardCount);
  const rows = Math.max(1, Math.ceil(cardCount / Math.max(1, columns)));
  const margin = phone ? 16 : 24;
  const gap = phone ? 10 : 16;
  const top = phone ? 58 : 64;
  const bottom = 48;
  const cardWidth = (width - margin * 2 - gap * Math.max(0, columns - 1)) / Math.max(1, columns);
  const cardHeight = (height - top - bottom - gap * Math.max(0, rows - 1)) / rows;
  const compact = cardHeight < 200 || cardWidth < 250;

  return {
    columns,
    compact,
    cards: Array.from({ length: cardCount }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      return {
        x: margin + column * (cardWidth + gap),
        y: top + row * (cardHeight + gap),
        width: cardWidth,
        height: cardHeight,
      };
    }),
  };
}
