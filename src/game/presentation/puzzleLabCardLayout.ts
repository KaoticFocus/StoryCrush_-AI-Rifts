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

function chooseColumns(input: {
  width: number;
  height: number;
  cardCount: number;
  phone: boolean;
  portrait: boolean;
}): number {
  const { width, cardCount, phone, portrait } = input;
  if (cardCount <= 0) {
    return 1;
  }
  if (phone) {
    if (portrait) {
      return 1;
    }
    // Landscape phones: prefer 2–3 columns from available width.
    if (width >= 820 && cardCount >= 5) {
      return Math.min(3, cardCount);
    }
    return Math.min(2, cardCount);
  }
  // Desktop / tablet: prefer a single balanced row of five when width allows.
  const minReadableCardWidth = 200;
  if (width / cardCount >= minReadableCardWidth && cardCount <= 5) {
    return cardCount;
  }
  if (width >= 1120 && width / Math.max(1, Math.min(5, cardCount)) >= 220) {
    return Math.min(5, cardCount);
  }
  if (width >= 900) {
    return Math.min(3, cardCount);
  }
  return Math.min(2, cardCount);
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
  const dense = phone && portrait && cardCount >= 5;
  const columns = chooseColumns({ width, height, cardCount, phone, portrait });
  const rows = Math.max(1, Math.ceil(cardCount / Math.max(1, columns)));
  const margin = phone ? (dense ? 12 : 16) : 24;
  const gap = phone ? (dense ? 6 : 10) : 16;
  const top = phone ? (dense ? 46 : 58) : 64;
  const bottom = phone ? (dense ? 36 : 48) : 48;
  const cardWidth = (width - margin * 2 - gap * Math.max(0, columns - 1)) / Math.max(1, columns);
  const cardHeight = (height - top - bottom - gap * Math.max(0, rows - 1)) / rows;
  const compact = cardHeight < 200 || cardWidth < 250 || dense;

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
