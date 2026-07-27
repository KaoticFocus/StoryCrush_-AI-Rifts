import { describe, expect, it } from 'vitest';
import {
  AriaStatusAnnouncer,
  createAriaStatusMessage,
} from '../../../src/game/presentation/accessibility/ariaStatus';

describe('ariaStatus', () => {
  it('formats authoritative move, hint, and objective messages', () => {
    expect(createAriaStatusMessage({ kind: 'move-accepted', score: 120, movesRemaining: 14 })).toBe(
      'Move accepted. Score 120. 14 moves remaining.',
    );
    expect(
      createAriaStatusMessage({
        kind: 'hint',
        from: { row: 0, column: 1 },
        to: { row: 1, column: 1 },
      }),
    ).toBe('Hint: swap row 1, column 2 with row 2, column 2.');
    expect(createAriaStatusMessage({ kind: 'objective-completed', label: 'Collect Rubies' })).toBe(
      'Objective completed: Collect Rubies.',
    );
  });

  it('suppresses immediately duplicated messages', () => {
    const announcer = new AriaStatusAnnouncer();
    expect(announcer.announce('Game paused.')).toBe(true);
    expect(announcer.announce('Game paused.')).toBe(false);
    announcer.clear();
    expect(announcer.announce('Game paused.')).toBe(true);
  });
});