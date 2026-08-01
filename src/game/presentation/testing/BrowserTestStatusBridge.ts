import { type Board, type BoardPiece } from '../../board';
import { getBrowserTestOptions } from './browserTestOptions';

export type BrowserPlaybackState =
  'idle' | 'starting' | 'playing' | 'synchronizing' | 'completed' | 'cancelled' | 'error';

export interface BrowserTestStatus {
  diagnosticsState: 'disabled' | 'initializing' | 'ready' | 'error';
  diagnosticsError: string;
  sceneGeneration: number;
  scenarioId: string;
  scenarioFeatures: string;
  fixtureId: string;
  levelId: string;
  levelTitle: string;
  seed: number;
  initialBoardHash: string;
  currentBoardHash: string;
  launchMode: string;
  restartCount: number;
  newBoardCount: number;
  moveLimit: number;
  objectiveSummary: string;
  allowedPieceTypes: string;
  levelStatus: string;
  playbackState: BrowserPlaybackState;
  playbackSequence: number;
  playbackMode: string;
  reducedMotion: boolean;
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
  displayObjects: number;
  boardPieceCount: number;
  temporaryObjectCount: number;
  activeTweenCount: number;
  activeTimerCount: number;
  listenerCount: number;
  performanceSample: string;
}

const performanceAttributeKeys = new Set([
  'displayObjects',
  'boardPieceCount',
  'temporaryObjectCount',
  'activeTweenCount',
  'activeTimerCount',
  'listenerCount',
  'performanceSample',
  'diagnosticsError',
]);

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
  if (!getBrowserTestOptions().e2eEnabled) return;
  const element = document.getElementById('storycrush-test-status');
  if (!element) return;
  element.setAttribute('data-scene', scene);
  element.setAttribute(
    'data-scene-generation',
    String(Number(element.getAttribute('data-scene-generation') ?? '0') + 1),
  );
}

export function syncBrowserTestSceneFromGame(): void {
  if (!getBrowserTestOptions().e2eEnabled) return;
  const element = document.getElementById('storycrush-test-status');
  const game =
    typeof window !== 'undefined'
      ? (window as typeof window & { __storyCrushGame?: unknown }).__storyCrushGame
      : undefined;
  if (!element || !game || typeof game !== 'object') return;
  const sceneManager = (
    game as {
      scene?: {
        getScenes?: () => unknown[];
        getScene?: (key: string) => {
          sys?: { isActive?: () => boolean; scene?: { key?: string } };
          scene?: { key?: string };
        };
      };
    }
  ).scene;
  const scenes = sceneManager?.getScenes?.() ?? [];
  const activeScene = scenes.find((candidate) => {
    const scene = candidate as
      { sys?: { isActive?: () => boolean; scene?: { key?: string } } } | undefined;
    return scene?.sys?.isActive?.() ?? false;
  }) as { sys?: { scene?: { key?: string } } } | undefined;
  const sceneKey =
    activeScene?.sys?.scene?.key ??
    sceneManager?.getScene?.('MainMenuScene')?.scene?.key ??
    'unknown';
  if (sceneKey) {
    const mappedScene =
      sceneKey === 'MainMenuScene'
        ? 'main-menu'
        : sceneKey === 'PuzzleLabScene'
          ? 'puzzle-lab'
          : sceneKey === 'PuzzleScene'
            ? 'puzzle'
            : sceneKey === 'MultiverseMapScene'
              ? 'multiverse-map'
              : sceneKey === 'ChapterIntroScene'
                ? 'chapter-intro'
                : sceneKey === 'DialogueScene'
                  ? 'dialogue'
                  : sceneKey === 'StoryChoiceScene'
                    ? 'story-choice'
                    : sceneKey === 'ResultsScene'
                      ? 'results'
                      : sceneKey === 'ConsequenceScene'
                        ? 'consequence'
                        : sceneKey;
    element.setAttribute('data-scene', mappedScene);
  }
}

export class BrowserTestStatusBridge {
  private readonly element: HTMLElement | null;
  private readonly performanceDiagnosticsEnabled: boolean;

  public constructor() {
    const options = getBrowserTestOptions();
    // E2E owns basic status; performance attributes require the separate opt-in flag.
    this.element = options.e2eEnabled ? document.getElementById('storycrush-test-status') : null;
    this.performanceDiagnosticsEnabled = options.performanceDiagnosticsEnabled;
  }

  public update(status: BrowserTestStatus): void {
    if (!this.element) return;
    for (const [key, value] of Object.entries(status)) {
      const attributeKey = key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
      if (!this.performanceDiagnosticsEnabled && performanceAttributeKeys.has(key)) {
        this.element.removeAttribute(`data-${attributeKey}`);
        continue;
      }
      this.element.setAttribute(
        `data-${attributeKey}`,
        key === 'diagnosticsState' && !this.performanceDiagnosticsEnabled
          ? 'disabled'
          : String(value),
      );
    }
  }

  public destroy(): void {
    if (this.element) this.element.replaceChildren();
  }
}
