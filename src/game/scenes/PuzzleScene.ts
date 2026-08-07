/* global performance, Performance */
import Phaser from 'phaser';
import { findPlayableSwaps, type Board, type BoardCoordinate } from '../board';
import {
  createBrowserFixtureSession,
  getBrowserFixture,
  type BrowserFixture,
} from '../content/testing/browserFixtures';
import {
  getBrowserScenario,
  type BrowserScenarioDefinition,
} from '../content/testing/browserScenarios';
import {
  createGeneratedLevelSession,
  getPlayableLevelContent,
  getObjectiveSummary,
  type PlayableLevelContent,
  type SeedProvider,
} from '../content/levelCatalog';
import {
  isPuzzleLaunchContext,
  type LevelRunDescriptor,
  type PuzzleLaunchContext,
} from '../content/levelRun';
import { createBrowserSeedProvider } from '../presentation/browserSeedProvider';
import { formatPlaytestSeedLabel } from '../content/playtestLaunch';
import {
  createPlaytestMetricsAccumulator,
  type PlaytestMetricsAccumulator,
} from '../presentation/playtestMetrics';
import {
  createPlaytestSummaryPanel,
  type PlaytestSummaryPanel,
} from '../presentation/playtestSummaryPanel';
import { createPrototypeLevelSession, prototypeLevelDefinition } from '../content/prototypeLevel';
import { BoardView } from '../presentation/BoardView';
import { createBoardViewModel } from '../presentation/boardViewModel';
import { selectHint } from '../presentation/hints/selectHint';
import { HudView } from '../presentation/HudView';
import { createLevelViewModel, formatMoveSummary } from '../presentation/levelViewModel';
import { PuzzleSessionController } from '../presentation/PuzzleSessionController';
import {
  getPlaybackDurations,
  getScoreCountDuration,
} from '../presentation/playback/playbackTimings';
import { ResolutionPlaybackController } from '../presentation/playback/ResolutionPlaybackController';
import {
  type ObjectiveFeedbackPlaybackCommand,
  type PlaybackCommand,
  type PlaybackMode,
  type ScoreFeedbackPlaybackCommand,
} from '../presentation/playback/playbackTypes';
import {
  boardCoordinateToScreenPosition,
  calculatePuzzleLayout,
} from '../presentation/puzzleLayout';
import { type AcceptedLevelMoveResult, type LevelSessionState } from '../level';
import { type RejectedLevelMoveResult } from '../level/levelTypes';
import { PrototypeSettingsController } from '../presentation/settings/PrototypeSettingsController';
import {
  PrototypeSettingsRepository,
  type StorageLike,
} from '../presentation/settings/PrototypeSettingsRepository';
import {
  canAcceptBoardInput,
  canPause,
  createPuzzlePresentationState,
  type PuzzlePresentationState,
} from '../presentation/state/presentationPermissions';
import {
  BrowserTestStatusBridge,
  getBoardHash,
  markBrowserTestScene,
  type BrowserPlaybackState,
  type BrowserTestStatus,
} from '../presentation/testing/BrowserTestStatusBridge';
import { getBrowserTestOptions } from '../presentation/testing/browserTestOptions';
import {
  AnimationFrameMeasurement,
  createPerformanceSample,
  type PerformanceResourceSnapshot,
  type PerformanceSample,
} from '../presentation/testing/performanceMeasurement';
import {
  AriaStatusAnnouncer,
  createAriaStatusMessage,
} from '../presentation/accessibility/ariaStatus';
import { MainMenuScene } from './MainMenuScene';
import { ResultsScene } from './ResultsScene';
import { MultiverseMapScene } from './MultiverseMapScene';
import { getSharedGameFlowController } from '../flow/gameFlowController';

type ShortcutKeyEvent = { key: string; repeat: boolean };

export class PuzzleScene extends Phaser.Scene {
  public static readonly key = 'PuzzleScene';

  private controller: PuzzleSessionController | null = null;
  private playbackController: ResolutionPlaybackController | null = null;
  private boardView: BoardView | null = null;
  private hudView: HudView | null = null;
  private selectedCoordinate: BoardCoordinate | null = null;
  private rejectedCoordinates: BoardCoordinate[] = [];
  private displayBoardOverride: Board | null = null;
  private hudStateOverride: LevelSessionState | null = null;
  private inputLocked = false;
  private presentationState: PuzzlePresentationState = createPuzzlePresentationState();
  private settingsController: PrototypeSettingsController | null = null;
  private playbackMode: PlaybackMode = 'normal';
  private reducedMotion = false;
  private summaryMessage =
    'Select a piece, then tap an orthogonally adjacent piece to submit a move.';
  private hasError = false;
  private resizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null = null;
  private summaryClearTimer: Phaser.Time.TimerEvent | null = null;
  private readonly hudTweens = new Set<Phaser.Tweens.Tween>();
  private readonly hudTimers = new Set<Phaser.Time.TimerEvent>();
  private readonly hudResolvers = new Set<() => void>();
  private visibilityHandler: (() => void) | null = null;
  private escapeKeyHandler: ((event: ShortcutKeyEvent) => void) | null = null;
  private hintKeyHandler: ((event: ShortcutKeyEvent) => void) | null = null;
  private menuKeyHandler: ((event: ShortcutKeyEvent) => void) | null = null;
  private statusBridge: BrowserTestStatusBridge | null = null;
  private sceneGeneration = 0;
  private playbackSequence = 0;
  private lastCommandIndex = -1;
  private lastCommandKind = 'none';
  private hardSyncRecoveryCount = 0;
  private browserFixture: BrowserFixture | null = null;
  private browserScenario: BrowserScenarioDefinition | null = null;
  private lastMoveAccepted = false;
  private lastMoveKind = 'none';
  private lastActivationIndex = -1;
  private lastErrorCode = 'none';
  private playbackStateTrace: BrowserPlaybackState[] = [];
  private commandTrace: string[] = [];
  private readonly ariaAnnouncer = new AriaStatusAnnouncer();
  private readonly flowController = getSharedGameFlowController();
  private readonly seedProvider: SeedProvider = createBrowserSeedProvider();
  private campaignMode = false;
  private campaignRun: LevelRunDescriptor | null = null;
  private launchContext: PuzzleLaunchContext | null = null;
  private currentLevelContent: PlayableLevelContent | null = null;
  private initialBoardHash = '';
  private restartCount = 0;
  private newBoardCount = 0;
  private performanceMeasurement: AnimationFrameMeasurement | null = null;
  private performanceResourcesBefore: PerformanceResourceSnapshot | null = null;
  private performanceSample: PerformanceSample | null = null;
  private performanceFinalizeHandle: number | null = null;
  private diagnosticsState: 'disabled' | 'initializing' | 'ready' | 'error' = 'disabled';
  private diagnosticsError = '';
  private playtestMetrics: PlaytestMetricsAccumulator | null = null;
  private playtestSummaryPanel: PlaytestSummaryPanel | null = null;
  private playtestSeedLabel: Phaser.GameObjects.Text | null = null;
  private static readonly hintDuration = 2500;

  public constructor() {
    super(PuzzleScene.key);
  }

  public create(): void {
    const requestedContext = this.scene.settings.data as unknown;
    const typedRequestedContext = isPuzzleLaunchContext(requestedContext) ? requestedContext : null;
    this.campaignMode = typedRequestedContext?.mode === 'campaign';
    this.campaignRun =
      typedRequestedContext?.mode === 'campaign' ? typedRequestedContext.run : null;
    this.browserScenario = this.getBrowserScenarioFromUrl();
    this.browserFixture = this.getBrowserFixtureFromUrl();
    this.launchContext = this.resolveLaunchContext(requestedContext);
    this.currentLevelContent =
      this.launchContext?.mode === 'browser-fixture'
        ? null
        : getPlayableLevelContent(this.launchContext?.run.levelId);
    // Scene instances are reused; always clear presentation/input latches on (re)entry.
    this.presentationState = createPuzzlePresentationState();
    this.inputLocked = false;
    this.hasError = false;
    this.selectedCoordinate = null;
    this.rejectedCoordinates = [];
    this.displayBoardOverride = null;
    this.hudStateOverride = null;
    this.cameras.main.setBackgroundColor('#020617');
    this.initializePresentationSettings();
    this.sceneGeneration += 1;
    this.statusBridge = new BrowserTestStatusBridge();
    this.diagnosticsState = this.isPerformanceDiagnosticsEnabled() ? 'initializing' : 'disabled';
    markBrowserTestScene('puzzle');

    try {
      if (!this.launchContext) {
        throw new TypeError('Invalid or missing puzzle launch context.');
      }
      if (this.campaignMode && this.campaignRun) {
        if (this.flowController.getState().currentNodeId !== 'puzzle') {
          this.flowController.advanceTo('puzzle');
        }
        this.flowController.recordActiveLevelRun(this.campaignRun);
      }
      this.controller = new PuzzleSessionController(
        this.browserFixture?.definition ?? this.getLaunchDefinition(),
        () => {
          if (this.browserFixture) {
            return createBrowserFixtureSession(this.browserFixture).state;
          }
          if (this.launchContext?.mode === 'browser-fixture') {
            return createPrototypeLevelSession().state;
          }
          const levelContent =
            this.currentLevelContent ?? getPlayableLevelContent('archive-stabilization');
          if (!levelContent) {
            return createPrototypeLevelSession().state;
          }
          const seed = this.resolveSeedForRestart(levelContent);
          return createGeneratedLevelSession({ content: levelContent, seed }).state;
        },
      );
      this.boardView = new BoardView(this);
      this.hudView = new HudView(this);
      this.playbackController = new ResolutionPlaybackController(this.createPlaybackAdapter());
      this.playbackController.setMode(this.playbackMode);
      this.playbackController.setReducedMotion(this.reducedMotion);
      this.initialBoardHash = getBoardHash(this.controller.getState().board);
      this.initializePlaytestSession();

      this.boardView.setCellSelectedHandler((coordinate) => {
        this.handleCellSelection(coordinate);
      });
      this.boardView.setCorruptedCellTappedHandler(() => {
        this.summaryMessage =
          'That cell is corrupted. Match beside it, or clear it with a special, to cleanse it.';
        this.ariaAnnouncer.announce(createAriaStatusMessage({ kind: 'corrupted-cell-tapped' }));
        this.renderScene();
        this.publishBrowserStatus('idle');
      });

      this.hudView.setCallbacks({
        onRestart: () => {
          this.restartSession();
        },
        onNewBoard: () => {
          this.generateNewBoard();
        },
        onBackToMenu: () => {
          this.returnToMenu();
        },
        onCyclePlaybackMode: () => {
          this.cyclePlaybackMode();
        },
        onToggleReducedMotion: () => {
          this.toggleReducedMotion();
        },
        onRequestHint: () => {
          this.requestHint();
        },
        onTogglePause: () => {
          this.togglePause();
        },
        onToggleHints: () => {
          this.toggleHints();
        },
        onResetSettings: () => {
          this.resetSettings();
        },
      });

      this.resizeHandler = () => {
        this.clearHint();
        if (this.playbackController?.isPlaying()) {
          this.playbackController.cancel();
          return;
        }

        this.renderScene();
      };
      this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
      this.registerLifecycleHandlers();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.presentationState.shuttingDown = true;
        this.clearHint();
        this.cancelSummaryTimer();
        this.playbackController?.cancel({ restoreInput: false });
        this.cancelHudPlaybackEffects();
        if (this.performanceFinalizeHandle !== null) {
          window.cancelAnimationFrame(this.performanceFinalizeHandle);
          this.performanceFinalizeHandle = null;
        }
        if (this.resizeHandler) {
          this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
          this.resizeHandler = null;
        }
        this.unregisterLifecycleHandlers();

        this.boardView?.destroy();
        this.hudView?.destroy();
        this.boardView = null;
        this.hudView = null;
        this.statusBridge?.destroy();
        this.statusBridge = null;
        this.playtestSummaryPanel?.destroy();
        this.playtestSummaryPanel = null;
        this.playtestMetrics = null;
        this.destroyPlaytestSeedLabel();
        this.ariaAnnouncer.clear();
      });

      this.renderScene();
      const initialThreat = this.controller.getState().threatState;
      const threatDefinition = this.controller.getDefinition().threat;
      if (initialThreat && threatDefinition) {
        this.ariaAnnouncer.announce(
          createAriaStatusMessage({
            kind: 'threat-initialized',
            hunger: initialThreat.hungerCurrent,
            maximum: threatDefinition.hungerMaximum,
            countdown: initialThreat.acceptedMovesUntilSpread,
          }),
        );
      }
      if (this.isPlaytestMode() && this.launchContext?.mode === 'puzzle-lab') {
        this.ariaAnnouncer.announce(
          createAriaStatusMessage({
            kind: 'playtest-seed',
            seed: this.launchContext.run.seed,
          }),
        );
      }
      this.add
        .text(
          this.scale.width * 0.86,
          this.scale.height * 0.12,
          this.campaignMode ? 'Back to Map' : 'Back to Menu',
          {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#f8fafc',
            backgroundColor: '#0f766e',
            padding: { x: 10, y: 6 },
          },
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          if (this.campaignMode) {
            this.flowController.advanceTo('multiverse-map');
            this.scene.start(MultiverseMapScene.key);
            return;
          }
          this.returnToMenu();
        });
      this.diagnosticsState = this.isPerformanceDiagnosticsEnabled() ? 'ready' : 'disabled';
      this.publishBrowserStatus('idle');
      const statusElement = document.getElementById('storycrush-test-status');
      if (statusElement) {
        statusElement.addEventListener('click', () => {
          if (statusElement.getAttribute('data-scene') === 'puzzle') {
            this.returnToMenu();
          }
        });
      }
    } catch (error) {
      console.error('Failed to initialize puzzle scene', error);
      this.hasError = true;
      this.renderErrorState('Puzzle scene failed to initialize. Return to the menu and try again.');
    }
  }

  private isPlaytestMode(): boolean {
    return this.launchContext?.mode === 'puzzle-lab' && this.launchContext.playtest === true;
  }

  private initializePlaytestSession(): void {
    if (!this.isPlaytestMode() || !this.controller || this.launchContext?.mode !== 'puzzle-lab') {
      return;
    }

    const run = this.launchContext.run;
    const definition = this.controller.getDefinition();
    this.playtestMetrics = createPlaytestMetricsAccumulator();
    this.playtestMetrics.reset({
      levelId: run.levelId,
      seed: run.seed,
      moveLimit: definition.moveLimit,
      hungerMaximum: definition.threat?.hungerMaximum ?? 0,
    });
    this.playtestSummaryPanel = createPlaytestSummaryPanel(document.getElementById('game-root'));
    this.playtestSummaryPanel.hide();
    this.showPlaytestSeedLabel(run.seed);
  }

  private showPlaytestSeedLabel(seed: number): void {
    this.destroyPlaytestSeedLabel();
    this.playtestSeedLabel = this.add
      .text(this.scale.width / 2, this.scale.height * 0.045, formatPlaytestSeedLabel(seed), {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#cbd5e1',
        backgroundColor: '#0f172a',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10_000);
  }

  private destroyPlaytestSeedLabel(): void {
    this.playtestSeedLabel?.destroy();
    this.playtestSeedLabel = null;
  }

  private resetPlaytestMetricsForSameSeed(): void {
    if (!this.isPlaytestMode() || !this.controller || !this.playtestMetrics) {
      return;
    }
    if (this.launchContext?.mode !== 'puzzle-lab') {
      return;
    }

    const run = this.launchContext.run;
    const definition = this.controller.getDefinition();
    this.playtestMetrics.reset({
      levelId: run.levelId,
      seed: run.seed,
      moveLimit: definition.moveLimit,
      hungerMaximum: definition.threat?.hungerMaximum ?? 0,
    });
    this.playtestSummaryPanel?.hide();
  }

  private resolveLaunchContext(launchContext: unknown): PuzzleLaunchContext | null {
    if (this.browserFixture) {
      return { mode: 'browser-fixture', fixtureId: this.browserFixture.id };
    }
    return isPuzzleLaunchContext(launchContext) ? launchContext : null;
  }

  private getLaunchDefinition(): import('../level').LevelDefinition {
    const levelContent =
      this.currentLevelContent ?? getPlayableLevelContent('archive-stabilization');
    const definition = levelContent?.definition ?? prototypeLevelDefinition;
    return this.launchContext && this.launchContext.mode !== 'browser-fixture'
      ? { ...definition, seed: this.launchContext.run.seed }
      : definition;
  }

  private resolveSeedForRestart(levelContent: PlayableLevelContent): number {
    if (this.launchContext?.mode === 'campaign' || this.launchContext?.mode === 'puzzle-lab') {
      return this.launchContext.run.seed;
    }
    return levelContent.definition.seed;
  }

  private renderScene(): void {
    this.renderBoardOnly();
    this.renderHudOnly();
  }

  private renderBoardOnly(): void {
    if (!this.controller || !this.boardView) {
      return;
    }

    const authoritativeState = this.controller.getState();
    const hudState = this.hudStateOverride ?? authoritativeState;
    const displayBoard = this.displayBoardOverride ?? hudState.board;
    const dimensions = displayBoard.getDimensions();
    const layout = this.calculateLayout(dimensions.rows, dimensions.columns, hudState);
    const levelViewModel = createLevelViewModel(this.controller.getDefinition(), hudState);

    this.boardView.render({
      layout,
      boardViewModel: createBoardViewModel(displayBoard),
      selectedCoordinate: this.selectedCoordinate,
      rejectedCoordinates: this.rejectedCoordinates,
      disabled:
        !canAcceptBoardInput({
          state: this.presentationState,
          levelIsActive: hudState.status === 'active',
        }) || this.hasError,
      threat: levelViewModel.threat,
      reducedMotion: this.reducedMotion,
    });
  }

  private renderHudOnly(): void {
    if (!this.controller || !this.hudView) {
      return;
    }

    const authoritativeState = this.controller.getState();
    const hudState = this.hudStateOverride ?? authoritativeState;
    const displayBoard = this.displayBoardOverride ?? hudState.board;
    const dimensions = displayBoard.getDimensions();
    const layout = this.calculateLayout(dimensions.rows, dimensions.columns, hudState);

    this.hudView.render({
      layout,
      viewModel: createLevelViewModel(this.controller.getDefinition(), hudState),
      summary: this.summaryMessage,
      playbackMode: this.playbackMode,
      reducedMotion: this.reducedMotion,
      hintsEnabled: this.settingsController?.getSnapshot().hintsEnabled ?? true,
      paused: this.presentationState.paused,
      showNewBoard: this.launchContext?.mode === 'puzzle-lab',
      hasError: this.hasError,
    });
  }

  private handleCellSelection(coordinate: BoardCoordinate): void {
    if (
      !this.controller ||
      !canAcceptBoardInput({
        state: this.presentationState,
        levelIsActive: this.controller.getState().status === 'active',
      }) ||
      this.hasError
    ) {
      return;
    }

    this.clearHint();

    const state = this.controller.getState();
    if (state.status !== 'active') {
      this.summaryMessage = 'This level is finished. Restart to play the prototype again.';
      this.renderScene();
      return;
    }

    if (
      this.selectedCoordinate &&
      this.selectedCoordinate.row === coordinate.row &&
      this.selectedCoordinate.column === coordinate.column
    ) {
      this.selectedCoordinate = null;
      this.rejectedCoordinates = [];
      this.summaryMessage = 'Selection cleared.';
      this.syncSelectionStatusAttribute(null);
      this.renderScene();
      this.publishBrowserStatus('idle');
      return;
    }

    if (!this.selectedCoordinate) {
      this.selectedCoordinate = coordinate;
      this.rejectedCoordinates = [];
      this.summaryMessage = 'Select an adjacent cell to submit a move.';
      this.syncSelectionStatusAttribute(coordinate);
      this.renderScene();
      this.publishBrowserStatus('idle');
      return;
    }

    const rowDelta = Math.abs(this.selectedCoordinate.row - coordinate.row);
    const columnDelta = Math.abs(this.selectedCoordinate.column - coordinate.column);
    if (rowDelta + columnDelta !== 1) {
      this.selectedCoordinate = coordinate;
      this.rejectedCoordinates = [];
      this.summaryMessage = 'Selection moved. Choose an adjacent cell to submit a swap.';
      this.syncSelectionStatusAttribute(coordinate);
      this.renderScene();
      this.publishBrowserStatus('idle');
      return;
    }

    void this.submitSwap(this.selectedCoordinate, coordinate);
  }

  private async submitSwap(from: BoardCoordinate, to: BoardCoordinate): Promise<void> {
    if (!this.controller || !this.playbackController) {
      return;
    }

    this.setInputLocked(true);
    this.rejectedCoordinates = [];
    this.clearHint();
    this.cancelSummaryTimer();

    try {
      this.startPerformanceMeasurement();
      const moveResult = this.controller.requestSwap(from, to);
      this.selectedCoordinate = null;

      if (moveResult.accepted) {
        await this.playbackController.playAcceptedMove(moveResult);
        return;
      }

      this.summaryMessage = formatMoveSummary(moveResult);

      if (moveResult.kind === 'terminal') {
        this.setInputLocked(true);
        this.displayBoardOverride = null;
        this.hudStateOverride = null;
        this.renderScene();
        return;
      }

      await this.playbackController.playRejectedMove(moveResult);
    } catch (error) {
      console.error('Unexpected error while applying puzzle move', error);
      this.hasError = true;
      this.setInputLocked(false);
      this.selectedCoordinate = null;
      this.rejectedCoordinates = [];
      this.summaryMessage = 'A puzzle presentation error occurred. Restart or return to the menu.';
      this.renderErrorState(this.summaryMessage);
      this.stopPerformanceMeasurement();
    }
  }

  private restartSession(): void {
    if (!this.controller) {
      return;
    }

    try {
      this.cancelSummaryTimer();
      this.playbackController?.cancel({ restoreInput: false });
      this.cancelHudPlaybackEffects();
      this.controller.restart();
      this.restartCount += 1;
      if (this.isPlaytestMode()) {
        this.resetPlaytestMetricsForSameSeed();
      }
      this.displayBoardOverride = null;
      this.hudStateOverride = null;
      this.selectedCoordinate = null;
      this.rejectedCoordinates = [];
      this.presentationState.playbackActive = false;
      this.setInputLocked(false);
      this.hasError = false;
      this.summaryMessage = 'Same level and board restarted.';
      this.ariaAnnouncer.announce(
        createAriaStatusMessage({
          kind: this.controller.getState().threatState ? 'rift-restarted' : 'same-board-restarted',
        }),
      );
      this.renderScene();
      this.publishBrowserStatus('idle');
    } catch (error) {
      console.error('Failed to restart puzzle session', error);
      this.hasError = true;
      this.summaryMessage = 'Restart failed. Return to the menu and try again.';
      this.renderErrorState(this.summaryMessage);
    }
  }

  private generateNewBoard(): void {
    if (this.launchContext?.mode !== 'puzzle-lab' || !this.currentLevelContent) return;
    const exitingPlaytest = this.isPlaytestMode();
    try {
      const seed = getBrowserTestOptions().e2eEnabled
        ? this.launchContext.run.seed + 1
        : this.seedProvider.nextSeed();
      this.launchContext = {
        mode: 'puzzle-lab',
        run: { levelId: this.currentLevelContent.id, seed },
      };
      if (exitingPlaytest) {
        this.playtestMetrics = null;
        this.playtestSummaryPanel?.hide();
        this.destroyPlaytestSeedLabel();
      }
      this.controller = new PuzzleSessionController(
        this.getLaunchDefinition(),
        () => createGeneratedLevelSession({ content: this.currentLevelContent!, seed }).state,
      );
      this.newBoardCount += 1;
      this.initialBoardHash = getBoardHash(this.controller.getState().board);
      this.displayBoardOverride = null;
      this.hudStateOverride = null;
      this.selectedCoordinate = null;
      this.rejectedCoordinates = [];
      this.presentationState.playbackActive = false;
      this.setInputLocked(false);
      this.hasError = false;
      this.summaryMessage = exitingPlaytest
        ? 'New Board started with a new seed.'
        : 'A new board was generated for this level.';
      this.ariaAnnouncer.announce(
        exitingPlaytest
          ? this.summaryMessage
          : createAriaStatusMessage({ kind: 'new-board-generated' }),
      );
      this.renderScene();
      this.publishBrowserStatus('idle');
    } catch (error) {
      console.error('Failed to generate a new puzzle board', error);
      this.hasError = true;
      this.renderErrorState('New board generation failed. Restart or return to the menu.');
    }
  }

  private renderErrorState(message: string): void {
    if (!this.boardView || !this.hudView || !this.controller) {
      this.add
        .text(this.scale.width / 2, this.scale.height / 2, message, {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#fecaca',
          align: 'center',
          wordWrap: { width: this.scale.width - 60 },
        })
        .setOrigin(0.5);

      this.add
        .text(this.scale.width / 2, this.scale.height * 0.68, 'Back to Menu', {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#bfdbfe',
          backgroundColor: '#1d4ed8',
          padding: { x: 12, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.scene.start(MainMenuScene.key);
        });
      return;
    }

    this.summaryMessage = message;
    this.renderScene();
  }

  private initializePresentationSettings(): void {
    const defaultReducedMotion = () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    let storage: StorageLike | null = null;
    try {
      storage = typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      storage = null;
    }
    this.settingsController = new PrototypeSettingsController(
      new PrototypeSettingsRepository(storage, defaultReducedMotion),
    );
    const settings = this.settingsController.getSnapshot();
    this.playbackMode = settings.playbackMode;
    this.reducedMotion = settings.reducedMotion;
  }

  private createPlaybackAdapter() {
    return {
      applyInputLock: (locked: boolean) => {
        this.setInputLocked(locked);
        const playbackActive = this.playbackController?.isPlaying() ?? false;
        this.presentationState.playbackActive = playbackActive;
        if (!playbackActive) {
          this.renderScene();
        }
        this.publishBrowserStatus(playbackActive ? 'playing' : locked ? 'completed' : 'idle');
      },
      isAuthoritativeTerminal: () => this.controller?.getState().status !== 'active',
      getObjectiveDefinitions: () => this.controller?.getDefinition().objectives ?? [],
      prepareAcceptedMove: (result: AcceptedLevelMoveResult) => {
        this.playbackSequence += 1;
        this.lastCommandIndex = -1;
        this.lastCommandKind = 'starting';
        this.lastActivationIndex = -1;
        this.lastMoveAccepted = true;
        this.lastMoveKind = result.moveKind;
        this.lastErrorCode = 'none';
        this.playbackStateTrace = [];
        this.commandTrace = [];
        this.clearHint();
        this.cancelHudPlaybackEffects();
        this.hudView?.cancelTransientEffects();
        this.displayBoardOverride = result.previousState.board;
        this.hudStateOverride = this.cloneState(result.previousState);
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.hasError = false;
        this.summaryMessage = 'Resolving move...';
        this.renderScene();
        this.publishBrowserStatus('starting');
      },
      prepareRejectedMove: (result: RejectedLevelMoveResult) => {
        this.lastMoveAccepted = false;
        this.lastMoveKind = result.kind;
        this.clearHint();
        this.cancelHudPlaybackEffects();
        this.hudView?.cancelTransientEffects();
        this.displayBoardOverride = result.state.board;
        this.hudStateOverride = this.cloneState(result.state);
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.hasError = false;
        this.summaryMessage = 'Rejected move.';
        this.ariaAnnouncer.announce(createAriaStatusMessage({ kind: 'move-rejected' }));
        this.renderScene();
      },
      executeCommand: (command: PlaybackCommand) => this.executePlaybackCommand(command),
      playRejectedSwap: (result: RejectedLevelMoveResult) =>
        this.boardView?.playRejectedSwap(
          result.requestedSwap.from,
          result.requestedSwap.to,
          this.playbackController!.getSettings(),
        ),
      finishAcceptedMove: (result: AcceptedLevelMoveResult) => {
        this.presentationState.playbackActive = false;
        this.cancelHudPlaybackEffects();
        this.hudView?.cancelTransientEffects();
        this.displayBoardOverride = null;
        this.hudStateOverride = null;
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.summaryMessage = formatMoveSummary(result);
        if (this.isPlaytestMode() && this.playtestMetrics) {
          this.playtestMetrics.recordAccepted(result);
        }
        this.ariaAnnouncer.announce(
          result.nextState.status === 'won'
            ? createAriaStatusMessage({ kind: 'level-complete' })
            : createAriaStatusMessage({
                kind: 'move-accepted',
                score: result.scoreAfter,
                movesRemaining: result.movesAfter,
              }),
        );
        const threat = result.nextState.threatState;
        if (threat?.status === 'overwhelmed') {
          this.ariaAnnouncer.announce(createAriaStatusMessage({ kind: 'rift-overwhelmed' }));
        } else if (threat?.status === 'contained') {
          this.ariaAnnouncer.announce(createAriaStatusMessage({ kind: 'rift-contained' }));
        } else if (threat) {
          this.ariaAnnouncer.announce(
            createAriaStatusMessage({
              kind: 'rift-countdown',
              moves: threat.acceptedMovesUntilSpread,
            }),
          );
        }
        this.renderScene();
        this.stopPerformanceMeasurement();
        this.publishBrowserStatus('completed');
        if (result.nextState.status !== 'active') {
          if (this.isPlaytestMode() && this.playtestMetrics && this.controller) {
            this.playtestMetrics.finalize(this.controller.getState());
            this.playtestSummaryPanel?.show(this.playtestMetrics.formatPlainTextSummary());
          }
          if (this.campaignMode) {
            this.flowController.recordPuzzleResult({
              outcome: result.nextState.status === 'won' ? 'won' : 'failed',
              score: result.nextState.score,
              movesRemaining: result.nextState.movesRemaining,
              objectiveCompleted: result.nextState.objectiveProgress.every(
                (entry) => entry.complete,
              ),
            });
            this.flowController.advanceTo('results');
            this.scene.start(ResultsScene.key);
          } else if (
            this.launchContext?.mode === 'puzzle-lab' ||
            this.launchContext?.mode === 'browser-fixture'
          ) {
            // Keep Puzzle Lab / fixture terminals on-scene so failure labels remain readable.
            this.setInputLocked(true);
          } else {
            this.scene.start(MainMenuScene.key);
          }
          return;
        }
        this.scheduleSummaryClear();
      },
      finishRejectedMove: (result: RejectedLevelMoveResult) => {
        this.presentationState.playbackActive = false;
        this.cancelHudPlaybackEffects();
        this.hudView?.cancelTransientEffects();
        this.displayBoardOverride = null;
        this.hudStateOverride = null;
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.summaryMessage = formatMoveSummary(result);
        this.renderScene();
        this.stopPerformanceMeasurement();
      },
      cancelActiveVisuals: () => {
        this.boardView?.cancelActiveVisuals();
        this.cancelHudPlaybackEffects();
        this.hudView?.cancelTransientEffects();
      },
      clearTransientState: () => {
        this.clearHint();
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.boardView?.clearTransientState();
        this.hudView?.cancelTransientEffects();
      },
      synchronizeAuthoritativeState: () => {
        this.presentationState.playbackActive = false;
        this.displayBoardOverride = null;
        this.hudStateOverride = null;
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.hasError = false;
        this.renderScene();
        this.publishBrowserStatus('synchronizing');
      },
      reportPlaybackError: (error: unknown) => {
        this.hardSyncRecoveryCount += 1;
        this.lastErrorCode = error instanceof Error ? error.name : 'unknown-playback-error';
        console.error('Resolution playback failed; synchronized to authoritative state', error);
        this.summaryMessage =
          'Playback interrupted. Synchronized to the authoritative board state.';
        this.renderScene();
        this.publishBrowserStatus('error');
      },
    };
  }

  private cloneState(state: LevelSessionState): LevelSessionState {
    return {
      levelId: state.levelId,
      baseSeed: state.baseSeed,
      board: state.board,
      score: state.score,
      movesRemaining: state.movesRemaining,
      acceptedMoveCount: state.acceptedMoveCount,
      status: state.status,
      objectiveProgress: state.objectiveProgress.map((progress) => ({ ...progress })),
      threatState: state.threatState
        ? {
            ...state.threatState,
            sourceCells: state.threatState.sourceCells.map((coordinate) => ({ ...coordinate })),
            corruptedCells: state.threatState.corruptedCells.map((coordinate) => ({
              ...coordinate,
            })),
            threatenedCell: state.threatState.threatenedCell
              ? { ...state.threatState.threatenedCell }
              : null,
            protectedCells: state.threatState.protectedCells.map((cell) => ({
              ...cell,
              coordinate: { ...cell.coordinate },
            })),
          }
        : undefined,
    };
  }

  private async executePlaybackCommand(command: PlaybackCommand): Promise<void> {
    if (!this.playbackController) {
      return;
    }

    this.lastCommandIndex = command.index;
    this.lastCommandKind = command.kind;
    this.commandTrace.push(command.kind);
    if (command.kind === 'special-activation') {
      this.lastActivationIndex = command.activation.index;
    }
    this.publishBrowserStatus('playing');

    switch (command.kind) {
      case 'score-feedback':
        await this.playScoreFeedbackCommand(command);
        return;
      case 'objective-feedback':
        await this.playObjectiveFeedbackCommand(command);
        return;
      case 'rift-cleanse':
        await this.boardView?.executePlaybackCommand(
          command,
          this.playbackController.getSettings(),
        );
        this.ariaAnnouncer.announce(
          createAriaStatusMessage({
            kind: 'rift-cleanse',
            count: command.events.length,
            events: command.events,
          }),
        );
        return;
      case 'rift-spread':
        await this.boardView?.executePlaybackCommand(
          command,
          this.playbackController.getSettings(),
        );
        this.ariaAnnouncer.announce(
          createAriaStatusMessage({ kind: 'rift-spread', coordinate: command.event.coordinate }),
        );
        return;
      case 'rift-threat-sync':
        if (this.hudStateOverride) {
          this.hudStateOverride.threatState = {
            ...command.state,
            sourceCells: command.state.sourceCells.map((coordinate) => ({ ...coordinate })),
            corruptedCells: command.state.corruptedCells.map((coordinate) => ({ ...coordinate })),
            threatenedCell: command.state.threatenedCell
              ? { ...command.state.threatenedCell }
              : null,
            protectedCells: command.state.protectedCells.map((cell) => ({
              ...cell,
              coordinate: { ...cell.coordinate },
            })),
          };
          this.renderScene();
          const maximum = this.controller?.getDefinition().threat?.hungerMaximum ?? 0;
          this.ariaAnnouncer.announce(
            createAriaStatusMessage({
              kind: 'rift-hunger',
              current: command.state.hungerCurrent,
              maximum,
            }),
          );
        }
        return;
      default:
        await this.boardView?.executePlaybackCommand(
          command,
          this.playbackController.getSettings(),
        );
    }
  }

  private async playScoreFeedbackCommand(command: ScoreFeedbackPlaybackCommand): Promise<void> {
    if (!this.hudStateOverride || !this.playbackController) {
      return;
    }

    const settings = this.playbackController.getSettings();
    const startScore = this.hudStateOverride.score;
    const targetScore = command.scoreEntry.cumulativeScoreAfter;
    const duration = getScoreCountDuration(1, settings);
    void this.hudView?.showScoreFeedback(command.scoreEntry.label, settings);

    await this.runHudTransition(
      duration,
      () => {
        const tweenState = { value: startScore };
        this.trackHudTween(
          this.tweens.add({
            targets: tweenState,
            value: targetScore,
            duration,
            ease: settings.reducedMotion ? 'Linear' : 'Sine.easeOut',
            onUpdate: () => {
              if (!this.hudStateOverride) {
                return;
              }

              this.hudStateOverride.score = Math.round(tweenState.value);
              for (const feedback of command.linkedObjectiveFeedback) {
                const progress = this.hudStateOverride.objectiveProgress.find(
                  (entry) => entry.objectiveId === feedback.objectiveId,
                );
                if (!progress) {
                  continue;
                }

                progress.current = Math.min(Math.round(tweenState.value), feedback.nextCurrent);
                progress.complete = progress.current >= progress.target;
              }
              this.renderHudOnly();
            },
          }),
        );
      },
      () => {
        if (!this.hudStateOverride) {
          return;
        }

        this.hudStateOverride.score = targetScore;
        for (const feedback of command.linkedObjectiveFeedback) {
          const progress = this.hudStateOverride.objectiveProgress.find(
            (entry) => entry.objectiveId === feedback.objectiveId,
          );
          if (!progress) {
            continue;
          }

          progress.current = feedback.nextCurrent;
          progress.complete = progress.current >= progress.target;
        }
        this.renderHudOnly();
      },
    );
  }

  private async playObjectiveFeedbackCommand(
    command: ObjectiveFeedbackPlaybackCommand,
  ): Promise<void> {
    if (!this.hudStateOverride || !this.playbackController) {
      return;
    }

    const settings = this.playbackController.getSettings();
    const durations = getPlaybackDurations(settings);

    await Promise.all(
      command.collectionFeedback.map(async (feedback) => {
        const progress = this.hudStateOverride?.objectiveProgress.find(
          (entry) => entry.objectiveId === feedback.objectiveId,
        );
        if (!progress) {
          return;
        }

        const startValue = progress.current;
        const targetValue = feedback.nextCurrent;
        const sourcePositions = feedback.eventPlans.map((eventPlan) =>
          boardCoordinateToScreenPosition(this.getCurrentLayout(), eventPlan.sourceCoordinate),
        );
        const labelPromise =
          this.hudView?.showObjectiveFeedback({
            objectiveId: feedback.objectiveId,
            label: `+${feedback.delta}`,
            sourcePositions,
            completed: feedback.completedThisMove,
            settings,
          }) ?? Promise.resolve();

        await this.runHudTransition(
          durations.collectionFeedback,
          () => {
            const tweenState = { value: startValue };
            this.trackHudTween(
              this.tweens.add({
                targets: tweenState,
                value: targetValue,
                duration: durations.collectionFeedback,
                ease: settings.reducedMotion ? 'Linear' : 'Sine.easeOut',
                onUpdate: () => {
                  progress.current = Math.round(tweenState.value);
                  progress.complete = progress.current >= progress.target;
                  this.renderHudOnly();
                },
              }),
            );
          },
          () => {
            progress.current = targetValue;
            progress.complete = progress.current >= progress.target;
            this.renderHudOnly();
          },
        );

        await labelPromise;
      }),
    );
  }

  private getCurrentLayout() {
    const authoritativeState = this.controller!.getState();
    const hudState = this.hudStateOverride ?? authoritativeState;
    const displayBoard = this.displayBoardOverride ?? hudState.board;
    const dimensions = displayBoard.getDimensions();

    return this.calculateLayout(dimensions.rows, dimensions.columns, hudState);
  }

  private calculateLayout(rows: number, columns: number, state: LevelSessionState) {
    return calculatePuzzleLayout({
      width: this.scale.width,
      height: this.scale.height,
      rows,
      columns,
      threatHudHeight: state.threatState ? 54 : 0,
    });
  }

  private cancelHudPlaybackEffects(): void {
    for (const tween of this.hudTweens) {
      tween.stop();
    }
    this.hudTweens.clear();

    for (const timer of this.hudTimers) {
      timer.remove(false);
    }
    this.hudTimers.clear();

    for (const resolver of this.hudResolvers) {
      resolver();
    }
    this.hudResolvers.clear();
  }

  private trackHudTween(tween: Phaser.Tweens.Tween): Phaser.Tweens.Tween {
    this.hudTweens.add(tween);
    tween.once(Phaser.Tweens.Events.TWEEN_COMPLETE, () => {
      this.hudTweens.delete(tween);
    });
    tween.once(Phaser.Tweens.Events.TWEEN_STOP, () => {
      this.hudTweens.delete(tween);
    });
    return tween;
  }

  private async runHudTransition(
    duration: number,
    onStart?: () => void,
    onFinish?: () => void,
  ): Promise<void> {
    onStart?.();

    if (duration <= 0) {
      onFinish?.();
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        this.hudResolvers.delete(finish);
        onFinish?.();
        resolve();
      };

      this.hudResolvers.add(finish);
      const timer = this.time.delayedCall(duration, () => {
        this.hudTimers.delete(timer);
        finish();
      });
      this.hudTimers.add(timer);
    });
  }

  private scheduleSummaryClear(): void {
    this.cancelSummaryTimer();
    this.summaryClearTimer = this.time.delayedCall(1800, () => {
      this.summaryClearTimer = null;
      this.summaryMessage =
        'Select a piece, then tap an orthogonally adjacent piece to submit a move.';
      this.renderScene();
    });
  }

  private cancelSummaryTimer(): void {
    if (!this.summaryClearTimer) {
      return;
    }

    this.summaryClearTimer.remove(false);
    this.summaryClearTimer = null;
  }

  private cyclePlaybackMode(): void {
    const nextMode: PlaybackMode =
      this.playbackMode === 'normal' ? 'fast' : this.playbackMode === 'fast' ? 'instant' : 'normal';

    this.playbackMode = this.settingsController?.setPlaybackMode(nextMode).playbackMode ?? nextMode;
    this.playbackController?.setMode(nextMode);
    this.renderScene();
    this.publishBrowserStatus('idle');
  }

  private toggleReducedMotion(): void {
    this.reducedMotion =
      this.settingsController?.setReducedMotion(!this.reducedMotion).reducedMotion ??
      !this.reducedMotion;
    this.playbackController?.setReducedMotion(this.reducedMotion);
    this.renderScene();
    this.publishBrowserStatus('idle');
  }

  private returnToMenu(): void {
    this.clearHint();
    this.cancelSummaryTimer();
    this.playbackController?.cancel({ restoreInput: false });
    this.cancelHudPlaybackEffects();
    this.selectedCoordinate = null;
    this.rejectedCoordinates = [];
    this.presentationState.playbackActive = false;
    this.presentationState.paused = false;
    this.setInputLocked(false);
    this.hasError = false;
    this.summaryMessage = 'Returning to the menu.';
    this.stopPerformanceMeasurement();
    // ScenePlugin.start shuts down this scene before starting Main Menu, so
    // Puzzle status-bridge teardown cannot run after Main Menu has claimed status.
    this.scene.start(MainMenuScene.key);
  }

  private syncSelectionStatusAttribute(coordinate: BoardCoordinate | null): void {
    const selectedCoordinate = coordinate ? `${coordinate.row}:${coordinate.column}` : '';
    const statusElement = document.getElementById('storycrush-test-status');
    statusElement?.setAttribute('data-selected-coordinate', selectedCoordinate);
    if (this.statusBridge) {
      this.statusBridge.update({
        ...this.buildBrowserStatusPayload('idle'),
        selectedCoordinate,
      });
    }
  }

  private buildBrowserStatusPayload(playbackState: BrowserPlaybackState): BrowserTestStatus {
    if (!this.controller) {
      return {
        diagnosticsState: this.diagnosticsState,
        diagnosticsError: this.diagnosticsError,
        sceneGeneration: this.sceneGeneration,
        scenarioId: this.browserScenario?.id ?? '',
        scenarioFeatures: this.browserScenario?.expectedFeatures.join(',') ?? '',
        fixtureId: this.browserFixture?.id ?? 'prototype',
        levelId: '',
        levelTitle: '',
        seed: -1,
        initialBoardHash: '',
        currentBoardHash: '',
        launchMode: this.campaignMode ? 'campaign' : (this.launchContext?.mode ?? 'invalid'),
        restartCount: this.restartCount,
        newBoardCount: this.newBoardCount,
        moveLimit: 0,
        objectiveSummary: '',
        allowedPieceTypes: '',
        levelStatus: 'inactive',
        threatStatus: '',
        threatHungerCurrent: 0,
        threatHungerMaximum: 0,
        threatMovesUntilSpread: 0,
        threatCorruptedCoordinates: '',
        threatThreatenedCoordinate: '',
        playbackState,
        playbackSequence: this.playbackSequence,
        playbackMode: this.playbackMode,
        reducedMotion: this.reducedMotion,
        paused: this.presentationState.paused,
        hasActiveHint: this.presentationState.hasActiveHint,
        selectedCoordinate: this.selectedCoordinate
          ? `${this.selectedCoordinate.row}:${this.selectedCoordinate.column}`
          : '',
        inputLocked: this.inputLocked,
        lastMoveAccepted: this.lastMoveAccepted,
        lastMoveKind: this.lastMoveKind,
        lastCommandIndex: this.lastCommandIndex,
        lastCommandKind: this.lastCommandKind,
        lastActivationIndex: this.lastActivationIndex,
        lastErrorCode: this.lastErrorCode,
        playbackStateTrace: this.playbackStateTrace.join(','),
        commandTrace: this.commandTrace.join(','),
        renderConsistency: 'unknown',
        authoritativeBoardHash: '',
        renderedBoardHash: '',
        score: 0,
        movesRemaining: 0,
        objectivesHash: '',
        hardSyncRecoveryCount: this.hardSyncRecoveryCount,
        expectedMoveFrom: '',
        expectedMoveTo: '',
        expectedMoveSourceKinds: '',
        fixtureSpecialCount: 0,
        fixtureExpectedScoreAfter: this.browserFixture?.expectedOutcome.scoreAfter ?? -1,
        fixtureExpectedMovesAfter: this.browserFixture?.expectedOutcome.movesAfter ?? -1,
        fixtureExpectedObjectivesHash: this.browserFixture?.expectedOutcome.objectivesHash ?? '',
        fixtureExpectedMoveKind: this.browserFixture?.expectedOutcome.moveKind ?? '',
        fixtureExpectedActivationCount: this.browserFixture?.expectedOutcome.activationCount ?? 0,
        logicalCanvasWidth: this.scale.width,
        logicalCanvasHeight: this.scale.height,
        boardX: 0,
        boardY: 0,
        cellSize: 0,
        boardRows: 0,
        boardColumns: 0,
        displayObjects: 0,
        boardPieceCount: 0,
        temporaryObjectCount: 0,
        activeTweenCount: 0,
        activeTimerCount: 0,
        listenerCount: 0,
        performanceSample: this.performanceSample ? JSON.stringify(this.performanceSample) : '',
      };
    }

    const state = this.controller.getState();
    const renderedBoard = this.displayBoardOverride ?? state.board;
    const dimensions = renderedBoard.getDimensions();
    const layout = this.calculateLayout(dimensions.rows, dimensions.columns, state);
    const expectedRenderedHash = getBoardHash(renderedBoard);
    const actualRenderedHash = this.boardView?.getRenderedBoardHash() ?? 'unavailable';
    const expectedMove =
      this.browserFixture?.expectedMove ??
      findPlayableSwaps(state.board, state.threatState?.corruptedCells)[0];
    if (this.playbackStateTrace.at(-1) !== playbackState) {
      this.playbackStateTrace.push(playbackState);
    }
    const expectedMoveSourceKinds = expectedMove
      ? [
          state.board.getPieceAt(expectedMove.from).kind,
          state.board.getPieceAt(expectedMove.to).kind,
        ].join(',')
      : '';
    const fixtureSpecialCount = state.board
      .toGridSnapshot()
      .flat()
      .filter((piece) => piece.kind !== 'standard').length;
    const resources = this.getPerformanceResources();
    const run =
      this.campaignRun ??
      (this.launchContext?.mode === 'puzzle-lab' ? this.launchContext.run : null);
    const definition = this.controller.getDefinition();
    return {
      diagnosticsState: this.diagnosticsState,
      diagnosticsError: this.diagnosticsError,
      sceneGeneration: this.sceneGeneration,
      scenarioId: this.browserScenario?.id ?? '',
      scenarioFeatures: this.browserScenario?.expectedFeatures.join(',') ?? '',
      fixtureId: this.browserFixture?.id ?? 'prototype',
      levelId: run?.levelId ?? definition.id,
      levelTitle: this.currentLevelContent?.title ?? definition.id,
      seed: run?.seed ?? definition.seed,
      initialBoardHash: this.initialBoardHash,
      currentBoardHash: getBoardHash(state.board),
      launchMode: this.campaignMode ? 'campaign' : (this.launchContext?.mode ?? 'invalid'),
      restartCount: this.restartCount,
      newBoardCount: this.newBoardCount,
      moveLimit: definition.moveLimit,
      objectiveSummary: this.currentLevelContent
        ? getObjectiveSummary(this.currentLevelContent)
        : definition.objectives.map((objective) => objective.id).join(','),
      allowedPieceTypes: definition.allowedRefillPieceTypes.join(','),
      levelStatus: state.status,
      threatStatus: state.threatState?.status ?? '',
      threatHungerCurrent: state.threatState?.hungerCurrent ?? 0,
      threatHungerMaximum: definition.threat?.hungerMaximum ?? 0,
      threatMovesUntilSpread: state.threatState?.acceptedMovesUntilSpread ?? 0,
      threatCorruptedCoordinates:
        state.threatState?.corruptedCells
          .map((coordinate) => `${coordinate.row}:${coordinate.column}`)
          .join(',') ?? '',
      threatThreatenedCoordinate: state.threatState?.threatenedCell
        ? `${state.threatState.threatenedCell.row}:${state.threatState.threatenedCell.column}`
        : '',
      playbackState,
      playbackSequence: this.playbackSequence,
      playbackMode: this.playbackMode,
      reducedMotion: this.reducedMotion,
      paused: this.presentationState.paused,
      hasActiveHint: this.presentationState.hasActiveHint,
      selectedCoordinate: this.selectedCoordinate
        ? `${this.selectedCoordinate.row}:${this.selectedCoordinate.column}`
        : '',
      inputLocked: this.inputLocked,
      lastMoveAccepted: this.lastMoveAccepted,
      lastMoveKind: this.lastMoveKind,
      lastCommandIndex: this.lastCommandIndex,
      lastCommandKind: this.lastCommandKind,
      lastActivationIndex: this.lastActivationIndex,
      lastErrorCode: this.lastErrorCode,
      playbackStateTrace: this.playbackStateTrace.join(','),
      commandTrace: this.commandTrace.join(','),
      renderConsistency:
        playbackState === 'error'
          ? 'failed'
          : actualRenderedHash === expectedRenderedHash
            ? 'passed'
            : 'failed',
      authoritativeBoardHash: getBoardHash(state.board),
      renderedBoardHash: actualRenderedHash,
      score: state.score,
      movesRemaining: state.movesRemaining,
      objectivesHash: state.objectiveProgress
        .map((objective) => `${objective.objectiveId}:${objective.current}/${objective.target}`)
        .join(','),
      hardSyncRecoveryCount: this.hardSyncRecoveryCount,
      expectedMoveFrom: expectedMove ? `${expectedMove.from.row}:${expectedMove.from.column}` : '',
      expectedMoveTo: expectedMove ? `${expectedMove.to.row}:${expectedMove.to.column}` : '',
      expectedMoveSourceKinds,
      fixtureSpecialCount,
      fixtureExpectedScoreAfter: this.browserFixture?.expectedOutcome.scoreAfter ?? -1,
      fixtureExpectedMovesAfter: this.browserFixture?.expectedOutcome.movesAfter ?? -1,
      fixtureExpectedObjectivesHash: this.browserFixture?.expectedOutcome.objectivesHash ?? '',
      fixtureExpectedMoveKind: this.browserFixture?.expectedOutcome.moveKind ?? '',
      fixtureExpectedActivationCount: this.browserFixture?.expectedOutcome.activationCount ?? 0,
      logicalCanvasWidth: this.scale.width,
      logicalCanvasHeight: this.scale.height,
      boardX: layout.boardRect.x,
      boardY: layout.boardRect.y,
      cellSize: layout.cellSize,
      boardRows: dimensions.rows,
      boardColumns: dimensions.columns,
      displayObjects: resources.displayObjects,
      boardPieceCount: resources.boardPieces,
      temporaryObjectCount: resources.temporaryObjects,
      activeTweenCount: resources.activeTweens,
      activeTimerCount: resources.activeTimers,
      listenerCount: resources.listeners,
      performanceSample: this.performanceSample ? JSON.stringify(this.performanceSample) : '',
    };
  }

  private publishBrowserStatus(playbackState: BrowserPlaybackState): void {
    if (!this.statusBridge || !this.controller) {
      return;
    }

    this.statusBridge.update(this.buildBrowserStatusPayload(playbackState));
  }

  private isPerformanceDiagnosticsEnabled(): boolean {
    return getBrowserTestOptions().performanceDiagnosticsEnabled;
  }

  private getPerformanceResources(): PerformanceResourceSnapshot {
    const board = this.boardView?.getResourceSnapshot() ?? {
      displayObjects: 0,
      boardPieces: 0,
      temporaryObjects: 0,
      activeTweens: 0,
      activeTimers: 0,
    };
    const hud = this.hudView?.getResourceSnapshot() ?? {
      displayObjects: 0,
      temporaryObjects: 0,
      activeTweens: 0,
      activeTimers: 0,
    };
    return {
      displayObjects: board.displayObjects + hud.displayObjects,
      boardPieces: board.boardPieces,
      temporaryObjects: board.temporaryObjects + hud.temporaryObjects,
      activeTweens: board.activeTweens + hud.activeTweens + this.hudTweens.size,
      activeTimers: board.activeTimers + hud.activeTimers + this.hudTimers.size,
      listeners:
        Number(this.resizeHandler !== null) +
        Number(this.visibilityHandler !== null) +
        Number(this.escapeKeyHandler !== null) +
        Number(this.hintKeyHandler !== null),
    };
  }

  private startPerformanceMeasurement(): void {
    if (!this.isPerformanceDiagnosticsEnabled()) return;
    this.performanceResourcesBefore = this.getPerformanceResources();
    this.performanceMeasurement = new AnimationFrameMeasurement(
      true,
      2_000,
      () => this.lastCommandKind,
    );
    this.performanceMeasurement.start();
  }

  private stopPerformanceMeasurement(): void {
    if (!this.performanceMeasurement || !this.performanceResourcesBefore || !this.controller)
      return;
    const measurement = this.performanceMeasurement.stop();
    const resourcesBefore = this.performanceResourcesBefore;
    this.performanceMeasurement = null;
    this.performanceResourcesBefore = null;
    if (this.performanceFinalizeHandle !== null) {
      window.cancelAnimationFrame(this.performanceFinalizeHandle);
    }
    this.schedulePerformanceFinalization(measurement, resourcesBefore);
  }

  private schedulePerformanceFinalization(
    measurement: ReturnType<AnimationFrameMeasurement['stop']>,
    resourcesBefore: PerformanceResourceSnapshot,
    remainingFrames = 12,
  ): void {
    this.performanceFinalizeHandle = window.requestAnimationFrame(() => {
      this.performanceFinalizeHandle = null;
      const resourcesAfter = this.getPerformanceResources();
      if (resourcesAfter.activeTweens > 0 && remainingFrames > 0) {
        this.schedulePerformanceFinalization(measurement, resourcesBefore, remainingFrames - 1);
        return;
      }
      const deviceMemory = performance as Performance & { memory?: { usedJSHeapSize?: number } };
      const state = this.controller?.getState();
      if (!state) return;
      this.performanceSample = createPerformanceSample({
        scenarioId: this.browserFixture?.id ?? 'prototype',
        buildKind: import.meta.env.DEV ? 'development' : 'preview',
        viewport: {
          width: this.scale.width,
          height: this.scale.height,
          devicePixelRatio: window.devicePixelRatio,
        },
        playbackMode: this.playbackMode,
        reducedMotion: this.reducedMotion,
        frameDurations: measurement.frameDurations,
        longFrameCommandCounts: measurement.longFrameCommandCounts,
        playbackDurationMs: measurement.durationMs,
        resourcesBefore,
        resourcesAfter,
        ...(deviceMemory.memory?.usedJSHeapSize === undefined
          ? {}
          : { heapAfterBytes: deviceMemory.memory.usedJSHeapSize }),
      });
      this.publishBrowserStatus(state.status === 'active' ? 'completed' : 'idle');
    });
  }

  private getBrowserFixtureFromUrl(): BrowserFixture | null {
    const query = new window.URLSearchParams(window.location.search);
    if (!getBrowserTestOptions().e2eEnabled) {
      return null;
    }
    return getBrowserFixture(this.browserScenario?.fixtureId ?? query.get('fixture'));
  }

  private getBrowserScenarioFromUrl(): BrowserScenarioDefinition | null {
    if (!getBrowserTestOptions().e2eEnabled) return null;
    const query = new window.URLSearchParams(window.location.search);
    return getBrowserScenario(query.get('scenario'));
  }

  private setInputLocked(locked: boolean): void {
    this.inputLocked = locked;
    this.presentationState.inputLocked = locked;
  }

  private requestHint(): void {
    if (!this.controller || !this.settingsController) {
      return;
    }
    const state = this.controller.getState();
    const result = selectHint({
      board: state.board,
      levelIsActive: state.status === 'active',
      hintsEnabled: this.settingsController.getSnapshot().hintsEnabled,
      presentationState: this.presentationState,
      unavailableCoordinates: state.threatState?.corruptedCells,
    });
    if (result.kind === 'hint') {
      this.presentationState.hasActiveHint = true;
      this.boardView?.showHint({
        from: result.move.from,
        to: result.move.to,
        duration: PuzzleScene.hintDuration,
        reducedMotion: this.reducedMotion,
      });
      this.summaryMessage = 'Hint: swap the highlighted pieces.';
      this.ariaAnnouncer.announce(
        createAriaStatusMessage({ kind: 'hint', from: result.move.from, to: result.move.to }),
      );
    } else if (result.reason === 'no-playable-move') {
      console.error('Active puzzle board has no playable move; presentation did not alter state.');
      this.summaryMessage = 'No playable move was found. Board view synchronized.';
      this.playbackController?.cancel({ restoreInput: false });
    } else {
      this.summaryMessage =
        result.reason === 'disabled' ? 'Hints are disabled in settings.' : 'Hint unavailable.';
    }
    this.renderScene();
    this.publishBrowserStatus('idle');
  }

  private clearHint(): void {
    this.presentationState.hasActiveHint = false;
    this.boardView?.clearHint();
  }

  private toggleHints(): void {
    if (!this.settingsController) {
      return;
    }
    const settings = this.settingsController.getSnapshot();
    const next = this.settingsController.setHintsEnabled(!settings.hintsEnabled);
    if (!next.hintsEnabled) {
      this.clearHint();
    }
    this.renderScene();
  }

  private resetSettings(): void {
    const settings = this.settingsController?.reset();
    if (!settings) {
      return;
    }
    this.playbackMode = settings.playbackMode;
    this.reducedMotion = settings.reducedMotion;
    this.playbackController?.setMode(this.playbackMode);
    this.playbackController?.setReducedMotion(this.reducedMotion);
    this.renderScene();
    this.publishBrowserStatus('idle');
  }

  private togglePause(): void {
    if (this.presentationState.paused) {
      this.presentationState.paused = false;
      this.setInputLocked(this.controller?.getState().status !== 'active');
      this.summaryMessage = 'Resumed.';
      this.ariaAnnouncer.announce(createAriaStatusMessage({ kind: 'resumed' }));
      this.renderScene();
      this.publishBrowserStatus('idle');
      return;
    }
    if (!canPause(this.presentationState)) {
      return;
    }
    this.clearHint();
    this.selectedCoordinate = null;
    this.rejectedCoordinates = [];
    this.cancelSummaryTimer();
    this.playbackController?.cancel({ restoreInput: false });
    this.cancelHudPlaybackEffects();
    this.presentationState.playbackActive = false;
    this.presentationState.paused = true;
    this.setInputLocked(true);
    this.summaryMessage = 'Paused.';
    this.ariaAnnouncer.announce(createAriaStatusMessage({ kind: 'paused' }));
    this.renderScene();
    this.publishBrowserStatus('idle');
  }

  private registerLifecycleHandlers(): void {
    this.visibilityHandler = () => {
      if (document.hidden && !this.presentationState.paused) {
        this.togglePause();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.escapeKeyHandler = (event) => {
      if (event.key === 'Escape' && !event.repeat) this.togglePause();
    };
    this.hintKeyHandler = (event) => {
      if (event.key.toLowerCase() === 'h' && !event.repeat) this.requestHint();
    };
    this.menuKeyHandler = (event) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === 'm') this.returnToMenu();
      if (key === 'r') this.restartSession();
      if (key === 'b') this.generateNewBoard();
    };
    document.addEventListener('keydown', this.escapeKeyHandler);
    document.addEventListener('keydown', this.hintKeyHandler);
    document.addEventListener('keydown', this.menuKeyHandler);
  }

  private unregisterLifecycleHandlers(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.escapeKeyHandler) {
      document.removeEventListener('keydown', this.escapeKeyHandler);
      this.escapeKeyHandler = null;
    }
    if (this.menuKeyHandler) {
      document.removeEventListener('keydown', this.menuKeyHandler);
      this.menuKeyHandler = null;
    }
    if (this.hintKeyHandler) {
      document.removeEventListener('keydown', this.hintKeyHandler);
      this.hintKeyHandler = null;
    }
  }
}
