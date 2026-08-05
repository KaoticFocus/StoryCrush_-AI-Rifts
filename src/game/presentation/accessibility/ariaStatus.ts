import { type BoardCoordinate } from '../../board';
import {
  type RiftHungerCleanseCause,
  type RiftHungerCleanseEvent,
} from '../../level/riftHungerTypes';

export function formatCoordinate(coordinate: BoardCoordinate): string {
  return `row ${coordinate.row + 1}, column ${coordinate.column + 1}`;
}

const CAUSE_LABEL: Record<RiftHungerCleanseCause, string> = {
  'adjacent-match': 'Adjacent match',
  'line-clear': 'Line clear',
  'cross-clear': 'Cross clear',
  wildcard: 'Wildcard',
};

/**
 * One concise ARIA summary per accepted move for unique cleansed cells.
 */
export function summarizeRiftCleanseAria(events: readonly RiftHungerCleanseEvent[]): string {
  const count = events.length;
  if (count === 0) {
    return 'No corrupted cells cleansed.';
  }

  const causeSet = new Set<RiftHungerCleanseCause>();
  for (const event of events) {
    for (const cause of event.causes) {
      causeSet.add(cause);
    }
  }
  const causes = [...causeSet];
  const cellWord = count === 1 ? 'cell' : 'cells';

  if (causes.length === 1) {
    const cause = causes[0]!;
    if (cause === 'adjacent-match') {
      return `${count} corrupted ${cellWord} cleansed.`;
    }
    if (cause === 'wildcard') {
      return `Wildcard cleansed ${count} corrupted ${cellWord}.`;
    }
    return `${CAUSE_LABEL[cause]} cleansed ${count} corrupted ${cellWord}.`;
  }

  const countWord =
    count === 1 ? 'One' : count === 2 ? 'Two' : count === 3 ? 'Three' : String(count);
  return `${countWord} corrupted ${cellWord} cleansed by multiple effects.`;
}

export function createAriaStatusMessage(
  input:
    | { kind: 'move-accepted'; score: number; movesRemaining: number }
    | { kind: 'move-rejected' }
    | { kind: 'hint'; from: BoardCoordinate; to: BoardCoordinate }
    | { kind: 'objective-completed'; label: string }
    | { kind: 'paused' }
    | { kind: 'resumed' }
    | { kind: 'same-board-restarted' }
    | { kind: 'new-board-generated' }
    | { kind: 'campaign-puzzle-restored' }
    | { kind: 'level-complete' }
    | { kind: 'out-of-moves' }
    | { kind: 'threat-initialized'; hunger: number; maximum: number; countdown: number }
    | { kind: 'corrupted-cell-tapped' }
    | { kind: 'rift-countdown'; moves: number }
    | { kind: 'rift-spread'; coordinate: BoardCoordinate }
    | { kind: 'rift-cleanse'; count: number; events?: readonly RiftHungerCleanseEvent[] }
    | { kind: 'rift-hunger'; current: number; maximum: number }
    | { kind: 'rift-overwhelmed' }
    | { kind: 'rift-contained' }
    | { kind: 'rift-restarted' },
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
    case 'same-board-restarted':
      return 'Same board restarted.';
    case 'new-board-generated':
      return 'New board generated.';
    case 'campaign-puzzle-restored':
      return 'Campaign puzzle restored with the same level and board.';
    case 'level-complete':
      return 'Level complete.';
    case 'out-of-moves':
      return 'Out of moves.';
    case 'threat-initialized':
      return `Rift Hunger active. Hunger ${input.hunger} of ${input.maximum}. Spread in ${input.countdown} ${input.countdown === 1 ? 'move' : 'moves'}.`;
    case 'corrupted-cell-tapped':
      return 'That cell is corrupted. Match beside it to cleanse it.';
    case 'rift-countdown':
      return `Rift spreads in ${input.moves} ${input.moves === 1 ? 'move' : 'moves'}.`;
    case 'rift-spread':
      return `Rift spread to ${formatCoordinate(input.coordinate)}.`;
    case 'rift-cleanse':
      if (input.events) {
        return summarizeRiftCleanseAria(input.events);
      }
      return `${input.count} corrupted ${input.count === 1 ? 'cell' : 'cells'} cleansed.`;
    case 'rift-hunger':
      return `Rift hunger ${input.current} of ${input.maximum}.`;
    case 'rift-overwhelmed':
      return 'Rift overwhelmed the board.';
    case 'rift-contained':
      return 'Rift contained.';
    case 'rift-restarted':
      return 'Rift Hunger level restarted.';
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
