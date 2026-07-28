import { type BoardCoordinate } from '../../board';

export function formatCoordinate(coordinate: BoardCoordinate): string {
  return `row ${coordinate.row + 1}, column ${coordinate.column + 1}`;
}

export function createAriaStatusMessage(
  input:
    | { kind: 'move-accepted'; score: number; movesRemaining: number }
    | { kind: 'move-rejected' }
    | { kind: 'hint'; from: BoardCoordinate; to: BoardCoordinate }
    | { kind: 'objective-completed'; label: string }
    | { kind: 'paused' }
    | { kind: 'resumed' }
    | { kind: 'level-complete' }
    | { kind: 'out-of-moves' },
): string {
  switch (input.kind) {
    case 'move-accepted':
      return `Move accepted. Score ${input.score}. ${input.movesRemaining} moves remaining.`;
    case 'move-rejected':
      return 'Move rejected. Choose an adjacent swap that makes a match.';
    case 'hint':
      return `Hint: swap ${formatCoordinate(input.from)} with ${formatCoordinate(input.to)}.`;
    case 'objective-completed':
      return `Objective completed: ${input.label}.`;
    case 'paused':
      return 'Game paused.';
    case 'resumed':
      return 'Game resumed.';
    case 'level-complete':
      return 'Level complete.';
    case 'out-of-moves':
      return 'Out of moves.';
  }
}

export class AriaStatusAnnouncer {
  private lastMessage = '';

  public announce(message: string): boolean {
    if (!message || message === this.lastMessage) return false;
    this.lastMessage = message;
    const element =
      typeof document === 'undefined' ? null : document.getElementById('storycrush-status');
    if (element) element.textContent = message;
    return true;
  }

  public clear(): void {
    this.lastMessage = '';
    const element =
      typeof document === 'undefined' ? null : document.getElementById('storycrush-status');
    if (element) element.textContent = '';
  }
}
