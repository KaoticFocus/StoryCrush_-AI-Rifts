import Phaser from 'phaser';
import { type Board, type BoardCoordinate } from '../board';
import { createPrototypeLevelSession, prototypeLevelDefinition } from '../content/prototypeLevel';
import { BoardView } from '../presentation/BoardView';
import { createBoardViewModel } from '../presentation/boardViewModel';
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
import { MainMenuScene } from './MainMenuScene';

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

  public constructor() {
    super(PuzzleScene.key);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#020617');
    this.initializePlaybackPreferences();

    try {
      this.controller = new PuzzleSessionController(
        prototypeLevelDefinition,
        () => createPrototypeLevelSession().state,
      );
      this.boardView = new BoardView(this);
      this.hudView = new HudView(this);
      this.playbackController = new ResolutionPlaybackController(this.createPlaybackAdapter());
      this.playbackController.setMode(this.playbackMode);
      this.playbackController.setReducedMotion(this.reducedMotion);

      this.boardView.setCellSelectedHandler((coordinate) => {
        this.handleCellSelection(coordinate);
      });

      this.hudView.setCallbacks({
        onRestart: () => {
          this.restartSession();
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
      });

      this.resizeHandler = () => {
        if (this.playbackController?.isPlaying()) {
          this.playbackController.cancel();
          return;
        }

        this.renderScene();
      };
      this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.cancelSummaryTimer();
        this.playbackController?.cancel({ restoreInput: false });
        this.cancelHudPlaybackEffects();
        if (this.resizeHandler) {
          this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
          this.resizeHandler = null;
        }

        this.boardView?.destroy();
        this.hudView?.destroy();
        this.boardView = null;
        this.hudView = null;
      });

      this.renderScene();
    } catch (error) {
      console.error('Failed to initialize puzzle scene', error);
      this.hasError = true;
      this.renderErrorState('Puzzle scene failed to initialize. Return to the menu and try again.');
    }
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
    const layout = calculatePuzzleLayout({
      width: this.scale.width,
      height: this.scale.height,
      rows: dimensions.rows,
      columns: dimensions.columns,
    });

    this.boardView.render({
      layout,
      boardViewModel: createBoardViewModel(displayBoard),
      selectedCoordinate: this.selectedCoordinate,
      rejectedCoordinates: this.rejectedCoordinates,
      disabled: this.inputLocked || hudState.status !== 'active' || this.hasError,
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
    const layout = calculatePuzzleLayout({
      width: this.scale.width,
      height: this.scale.height,
      rows: dimensions.rows,
      columns: dimensions.columns,
    });

    this.hudView.render({
      layout,
      viewModel: createLevelViewModel(this.controller.getDefinition(), hudState),
      summary: this.summaryMessage,
      playbackMode: this.playbackMode,
      reducedMotion: this.reducedMotion,
      hasError: this.hasError,
    });
  }

  private handleCellSelection(coordinate: BoardCoordinate): void {
    if (!this.controller || this.inputLocked || this.hasError) {
      return;
    }

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
      this.renderScene();
      return;
    }

    if (!this.selectedCoordinate) {
      this.selectedCoordinate = coordinate;
      this.rejectedCoordinates = [];
      this.summaryMessage = 'Select an adjacent cell to submit a move.';
      this.renderScene();
      return;
    }

    const rowDelta = Math.abs(this.selectedCoordinate.row - coordinate.row);
    const columnDelta = Math.abs(this.selectedCoordinate.column - coordinate.column);
    if (rowDelta + columnDelta !== 1) {
      this.selectedCoordinate = coordinate;
      this.rejectedCoordinates = [];
      this.summaryMessage = 'Selection moved. Choose an adjacent cell to submit a swap.';
      this.renderScene();
      return;
    }

    void this.submitSwap(this.selectedCoordinate, coordinate);
  }

  private async submitSwap(from: BoardCoordinate, to: BoardCoordinate): Promise<void> {
    if (!this.controller || !this.playbackController) {
      return;
    }

    this.inputLocked = true;
    this.rejectedCoordinates = [];
    this.cancelSummaryTimer();

    try {
      const moveResult = this.controller.requestSwap(from, to);
      this.selectedCoordinate = null;

      if (moveResult.accepted) {
        await this.playbackController.playAcceptedMove(moveResult);
        return;
      }

      this.summaryMessage = formatMoveSummary(moveResult);

      if (moveResult.kind === 'terminal') {
        this.inputLocked = true;
        this.displayBoardOverride = null;
        this.hudStateOverride = null;
        this.renderScene();
        return;
      }

      await this.playbackController.playRejectedMove(moveResult);
    } catch (error) {
      console.error('Unexpected error while applying puzzle move', error);
      this.hasError = true;
      this.inputLocked = false;
      this.selectedCoordinate = null;
      this.rejectedCoordinates = [];
      this.summaryMessage = 'A puzzle presentation error occurred. Restart or return to the menu.';
      this.renderErrorState(this.summaryMessage);
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
      this.displayBoardOverride = null;
      this.hudStateOverride = null;
      this.selectedCoordinate = null;
      this.rejectedCoordinates = [];
      this.inputLocked = false;
      this.hasError = false;
      this.summaryMessage = 'Prototype level restarted with the same deterministic seed.';
      this.renderScene();
    } catch (error) {
      console.error('Failed to restart puzzle session', error);
      this.hasError = true;
      this.summaryMessage = 'Restart failed. Return to the menu and try again.';
      this.renderErrorState(this.summaryMessage);
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

  private initializePlaybackPreferences(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private createPlaybackAdapter() {
    return {
      applyInputLock: (locked: boolean) => {
        this.inputLocked = locked;
        if (!this.playbackController?.isPlaying()) {
          this.renderScene();
        }
      },
      isAuthoritativeTerminal: () => this.controller?.getState().status !== 'active',
      getObjectiveDefinitions: () => this.controller?.getDefinition().objectives ?? [],
      prepareAcceptedMove: (result: AcceptedLevelMoveResult) => {
        this.cancelHudPlaybackEffects();
        this.hudView?.cancelTransientEffects();
        this.displayBoardOverride = result.previousState.board;
        this.hudStateOverride = this.cloneState(result.previousState);
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.hasError = false;
        this.summaryMessage = 'Resolving move...';
        this.renderScene();
      },
      prepareRejectedMove: (result: RejectedLevelMoveResult) => {
        this.cancelHudPlaybackEffects();
        this.hudView?.cancelTransientEffects();
        this.displayBoardOverride = result.state.board;
        this.hudStateOverride = this.cloneState(result.state);
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.hasError = false;
        this.summaryMessage = 'Rejected move.';
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
        this.cancelHudPlaybackEffects();
        this.hudView?.cancelTransientEffects();
        this.displayBoardOverride = null;
        this.hudStateOverride = null;
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.summaryMessage = formatMoveSummary(result);
        this.renderScene();
        this.scheduleSummaryClear();
      },
      finishRejectedMove: (result: RejectedLevelMoveResult) => {
        this.cancelHudPlaybackEffects();
        this.hudView?.cancelTransientEffects();
        this.displayBoardOverride = null;
        this.hudStateOverride = null;
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.summaryMessage = formatMoveSummary(result);
        this.renderScene();
      },
      cancelActiveVisuals: () => {
        this.boardView?.cancelActiveVisuals();
        this.cancelHudPlaybackEffects();
        this.hudView?.cancelTransientEffects();
      },
      clearTransientState: () => {
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.boardView?.clearTransientState();
        this.hudView?.cancelTransientEffects();
      },
      synchronizeAuthoritativeState: () => {
        this.displayBoardOverride = null;
        this.hudStateOverride = null;
        this.selectedCoordinate = null;
        this.rejectedCoordinates = [];
        this.hasError = false;
        this.renderScene();
      },
      reportPlaybackError: (error: unknown) => {
        console.error('Resolution playback failed; synchronized to authoritative state', error);
        this.summaryMessage =
          'Playback interrupted. Synchronized to the authoritative board state.';
        this.renderScene();
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
    };
  }

  private async executePlaybackCommand(command: PlaybackCommand): Promise<void> {
    if (!this.playbackController) {
      return;
    }

    switch (command.kind) {
      case 'score-feedback':
        await this.playScoreFeedbackCommand(command);
        return;
      case 'objective-feedback':
        await this.playObjectiveFeedbackCommand(command);
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
    const labelPromise =
      this.hudView?.showScoreFeedback(command.scoreEntry.label, settings) ?? Promise.resolve();

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

    await labelPromise;
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

    return calculatePuzzleLayout({
      width: this.scale.width,
      height: this.scale.height,
      rows: dimensions.rows,
      columns: dimensions.columns,
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

    this.playbackMode = nextMode;
    this.playbackController?.setMode(nextMode);
    this.renderScene();
  }

  private toggleReducedMotion(): void {
    this.reducedMotion = !this.reducedMotion;
    this.playbackController?.setReducedMotion(this.reducedMotion);
    this.renderScene();
  }

  private returnToMenu(): void {
    this.cancelSummaryTimer();
    this.playbackController?.cancel({ restoreInput: false });
    this.cancelHudPlaybackEffects();
    this.scene.start(MainMenuScene.key);
  }
}
