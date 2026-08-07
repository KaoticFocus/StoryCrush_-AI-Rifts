import { describe, expect, it } from 'vitest';
import { calculatePuzzleLabCardLayout } from '../../../src/game/presentation/puzzleLabCardLayout';

function assertNonOverlapping(
  cards: readonly { x: number; y: number; width: number; height: number }[],
): void {
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const a = cards[i]!;
      const b = cards[j]!;
      const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlapX && overlapY).toBe(false);
    }
  }
}

describe('puzzleLabCardLayout', () => {
  it('handles empty and single-card catalogs', () => {
    const empty = calculatePuzzleLabCardLayout({ width: 390, height: 844, cardCount: 0 });
    expect(empty.cards).toHaveLength(0);

    const one = calculatePuzzleLabCardLayout({ width: 390, height: 844, cardCount: 1 });
    expect(one.cards).toHaveLength(1);
    expect(one.columns).toBe(1);
  });

  it('keeps four and five cards usable on phone portrait 320×568', () => {
    for (const cardCount of [4, 5]) {
      const layout = calculatePuzzleLabCardLayout({ width: 320, height: 568, cardCount });
      expect(layout.columns).toBe(1);
      expect(layout.cards).toHaveLength(cardCount);
      expect(layout.compact).toBe(true);
      assertNonOverlapping(layout.cards);
      for (const card of layout.cards) {
        expect(card.y + card.height).toBeLessThanOrEqual(568 - 30);
        expect(card.height).toBeGreaterThan(40);
      }
    }
  });

  it('uses multi-column layouts on landscape and desktop for five/six cards', () => {
    const phoneLandscape = calculatePuzzleLabCardLayout({
      width: 844,
      height: 390,
      cardCount: 5,
    });
    expect(phoneLandscape.columns).toBeGreaterThanOrEqual(2);
    expect(phoneLandscape.cards).toHaveLength(5);
    assertNonOverlapping(phoneLandscape.cards);

    const desktopFive = calculatePuzzleLabCardLayout({
      width: 1280,
      height: 720,
      cardCount: 5,
    });
    expect(desktopFive.columns).toBe(5);
    expect(desktopFive.cards).toHaveLength(5);
    assertNonOverlapping(desktopFive.cards);

    const desktopSix = calculatePuzzleLabCardLayout({
      width: 1280,
      height: 720,
      cardCount: 6,
    });
    expect(desktopSix.cards).toHaveLength(6);
    assertNonOverlapping(desktopSix.cards);
  });
});
