import { type Board, type BoardPiece } from '../../board';

export type BrowserPlaybackState =
  'idle' | 'starting' | 'playing' | 'synchronizing' | 'completed' | 'cancelled' | 'error';

export interface BrowserTestStatus {
  sceneGeneration: number;
  fixtureId: string;
  levelStatus: string;
  playbackState: BrowserPlaybackState;
  playbackSequence: number;
  playbackMode: string;
  paused: boolean;
  hasActiveHint: boolean;
  selectedCoordinate: string;
  inputLocked: boolean;
  lastMoveAccepted: boolean;
  lastMoveKind: string;
  lastCommandIndex: number;
  lastCommandKind: string;
  lastActivationIndex: number;
  lastErrorCode: string;
  playbackStateTrace: string;
  commandTrace: string;
  renderConsistency: 'unknown' | 'passed' | 'failed';
  authoritativeBoardHash: string;
  renderedBoardHash: string;
  score: number;
  movesRemaining: number;
  objectivesHash: string;
  hardSyncRecoveryCount: number;
  expectedMoveFrom: string;
  expectedMoveTo: string;
  expectedMoveSourceKinds: string;
  fixtureSpecialCount: number;
  fixtureExpectedScoreAfter: number;
  fixtureExpectedMovesAfter: number;
  fixtureExpectedObjectivesHash: string;
  fixtureExpectedMoveKind: string;
  fixtureExpectedActivationCount: number;
  logicalCanvasWidth: number;
  logicalCanvasHeight: number;
  boardX: number;
  boardY: number;
  cellSize: number;
  boardRows: number;
  boardColumns: number;
}

export function getBoardPieceHash(piece: BoardPiece): string {
  return `${piece.kind}:${piece.pieceType}:${piece.kind === 'line-clear' ? piece.orientation : ''}`;
}

export function getBoardHash(board: Board): string {
  const dimensions = board.getDimensions();
  return `${dimensions.rows}x${dimensions.columns}|${board
    .toGridSnapshot()
    .flat()
    .map(getBoardPieceHash)
    .join(',')}`;
}

export function markBrowserTestScene(scene: string): void {
  if (new window.URLSearchParams(window.location.search).get('e2e') !== '1') return;
  document.getElementById('storycrush-test-status')?.setAttribute('data-scene', scene);
}

export class BrowserTestStatusBridge {
  private readonly element: HTMLElement | null;

  public constructor() {
    const enabled = new window.URLSearchParams(window.location.search).get('e2e') === '1';
    this.element = enabled ? document.getElementById('storycrush-test-status') : null;
  }

  public update(status: BrowserTestStatus): void {
    if (!this.element) return;
    for (const [key, value] of Object.entries(status)) {
      const attributeKey = key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
      this.element.setAttribute(`data-${attributeKey}`, String(value));
    }
  }

  public destroy(): void {
    if (this.element) this.element.replaceChildren();
  }
}
