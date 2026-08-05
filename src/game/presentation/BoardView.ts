import Phaser from 'phaser';
import { Board, type BoardCoordinate, type BoardPiece, type ResolvableGrid } from '../board';
import {
  createBoardViewModel,
  type BoardCellViewModel,
  type BoardViewModel,
} from './boardViewModel';
import { getPieceAppearance, type PieceAppearance } from './pieceAppearance';
import {
  getBoardCellBounds,
  screenPositionToBoardCoordinate,
  type PuzzleLayout,
} from './puzzleLayout';
import {
  getGravityDuration,
  getPlaybackDurations,
  getRefillDuration,
  getReshuffleDuration,
  getSpecialEffectDuration,
} from './playback/playbackTimings';
import {
  type ApplyGravityPlaybackCommand,
  type CascadePausePlaybackCommand,
  type CreateSpecialsPlaybackCommand,
  type HighlightMatchesPlaybackCommand,
  type PlaybackCommand,
  type RefillPiecesPlaybackCommand,
  type RemovePiecesPlaybackCommand,
  type ReshuffleMovementPlaybackCommand,
  type SpecialActivationPlaybackCommand,
  type SwapPlaybackCommand,
} from './playback/playbackTypes';
import { type PlaybackSettings } from './playback/ResolutionPlaybackController';
import { type SpecialEffectPresentationPlan } from './playback/specialEffectPlanning';
import { planTwoPhaseCoordinateRekey } from './playback/twoPhaseCoordinateRekey';
import { getBoardPieceHash } from './testing/BrowserTestStatusBridge';
import { type ThreatViewModel } from './levelViewModel';
import { type RiftHungerCleanseEvent } from '../level/riftHungerTypes';

function selectRiftCleanseFlashColor(events: readonly RiftHungerCleanseEvent[]): number {
  const causes = new Set(events.flatMap((event) => event.causes));
  if (causes.has('wildcard')) {
    return 0xe9d5ff;
  }
  if (causes.has('cross-clear')) {
    return 0xfca5a5;
  }
  if (causes.has('line-clear')) {
    return 0x7dd3fc;
  }
  return 0x86efac;
}

interface BoardViewState {
  selectedCoordinate: BoardCoordinate | null;
  hoverCoordinate: BoardCoordinate | null;
  rejectedCoordinates: BoardCoordinate[];
  disabled: boolean;
}

interface PieceDisplayObject {
  coordinate: BoardCoordinate;
  piece: BoardPiece;
  appearance: PieceAppearance;
  container: Phaser.GameObjects.Container;
}

function coordinateKey(coordinate: BoardCoordinate): string {
  return `${coordinate.row}:${coordinate.column}`;
}

function areAdjacent(left: BoardCoordinate, right: BoardCoordinate): boolean {
  const rowDelta = Math.abs(left.row - right.row);
  const columnDelta = Math.abs(left.column - right.column);
  return rowDelta + columnDelta === 1;
}

function isCoordinateInList(
  coordinate: BoardCoordinate,
  list: readonly BoardCoordinate[],
): boolean {
  return list.some((entry) => entry.row === coordinate.row && entry.column === coordinate.column);
}

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

function clonePiece(piece: BoardPiece): BoardPiece {
  return { ...piece };
}

export class BoardView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly backgroundGraphics: Phaser.GameObjects.Graphics;
  private readonly cellBackgroundGraphics: Phaser.GameObjects.Graphics;
  private readonly pieceLayer: Phaser.GameObjects.Container;
  private readonly threatLayer: Phaser.GameObjects.Container;
  private threatGraphics: Phaser.GameObjects.Graphics;
  private readonly effectLayer: Phaser.GameObjects.Container;
  private readonly overlayGraphics: Phaser.GameObjects.Graphics;
  private readonly hitZone: Phaser.GameObjects.Zone;
  private readonly pieceDisplays = new Map<string, PieceDisplayObject>();
  private readonly transientObjects = new Set<Phaser.GameObjects.GameObject>();
  private readonly activeTweens = new Set<Phaser.Tweens.Tween>();
  private readonly activeTimers = new Set<Phaser.Time.TimerEvent>();
  private readonly pendingResolvers = new Set<() => void>();
  private readonly hintObjects = new Set<Phaser.GameObjects.GameObject>();
  private hintTimer: Phaser.Time.TimerEvent | null = null;
  private layout: PuzzleLayout | null = null;
  private boardViewModel: BoardViewModel | null = null;
  private readonly pointerDownHandler: (pointer: Phaser.Input.Pointer) => void;
  private readonly pointerMoveHandler: (pointer: Phaser.Input.Pointer) => void;
  private readonly pointerOutHandler: () => void;
  private state: BoardViewState = {
    selectedCoordinate: null,
    hoverCoordinate: null,
    rejectedCoordinates: [],
    disabled: false,
  };
  private onCellSelected: ((coordinate: BoardCoordinate) => void) | null = null;
  private onCorruptedCellTapped: ((coordinate: BoardCoordinate) => void) | null = null;
  private threatViewModel: ThreatViewModel | undefined;
  private threatTween: Phaser.Tweens.Tween | null = null;

  public constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0);
    this.backgroundGraphics = scene.add.graphics();
    this.cellBackgroundGraphics = scene.add.graphics();
    this.pieceLayer = scene.add.container(0, 0);
    this.threatLayer = scene.add.container(0, 0);
    this.threatGraphics = scene.add.graphics();
    this.threatLayer.add(this.threatGraphics);
    this.effectLayer = scene.add.container(0, 0);
    this.overlayGraphics = scene.add.graphics();
    this.hitZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();

    this.pointerDownHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.layout || this.state.disabled || !this.onCellSelected) {
        return;
      }

      const coordinate = screenPositionToBoardCoordinate(this.layout, {
        x: pointer.x,
        y: pointer.y,
      });
      if (coordinate) {
        if (
          this.threatViewModel?.corruptedCoordinates.some(
            (entry) => entry.row === coordinate.row && entry.column === coordinate.column,
          )
        ) {
          this.onCorruptedCellTapped?.(coordinate);
          return;
        }
        this.onCellSelected(coordinate);
      }
    };
    this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.layout || this.state.disabled) {
        return;
      }

      const hoverCoordinate = screenPositionToBoardCoordinate(this.layout, {
        x: pointer.x,
        y: pointer.y,
      });

      const previous = this.state.hoverCoordinate;
      const isSame =
        previous?.row === hoverCoordinate?.row && previous?.column === hoverCoordinate?.column;
      if (isSame) {
        return;
      }

      this.state = {
        ...this.state,
        hoverCoordinate,
      };
      this.redrawOverlay();
    };
    this.pointerOutHandler = () => {
      if (!this.state.hoverCoordinate) {
        return;
      }

      this.state = {
        ...this.state,
        hoverCoordinate: null,
      };
      this.redrawOverlay();
    };
    this.hitZone.on('pointerdown', this.pointerDownHandler);
    this.hitZone.on('pointermove', this.pointerMoveHandler);
    this.hitZone.on('pointerout', this.pointerOutHandler);

    this.root.add([
      this.backgroundGraphics,
      this.cellBackgroundGraphics,
      this.pieceLayer,
      this.threatLayer,
      this.effectLayer,
      this.overlayGraphics,
      this.hitZone,
    ]);
  }

  public setCellSelectedHandler(handler: (coordinate: BoardCoordinate) => void): void {
    this.onCellSelected = handler;
  }

  public setCorruptedCellTappedHandler(handler: (coordinate: BoardCoordinate) => void): void {
    this.onCorruptedCellTapped = handler;
  }

  public getRenderedBoardHash(): string | null {
    if (!this.boardViewModel) {
      return null;
    }

    const { rows, columns } = this.boardViewModel;
    const cells: string[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const display = this.pieceDisplays.get(coordinateKey({ row, column }));
        cells.push(display ? getBoardPieceHash(display.piece) : 'empty');
      }
    }
    return `${rows}x${columns}|${cells.join(',')}`;
  }

  public getResourceSnapshot(): {
    displayObjects: number;
    boardPieces: number;
    temporaryObjects: number;
    activeTweens: number;
    activeTimers: number;
  } {
    return {
      displayObjects: this.root.getAll().length,
      boardPieces: this.pieceDisplays.size,
      temporaryObjects: this.transientObjects.size + this.hintObjects.size,
      activeTweens: this.activeTweens.size,
      activeTimers: this.activeTimers.size + (this.hintTimer ? 1 : 0),
    };
  }

  public render(input: {
    layout: PuzzleLayout;
    boardViewModel: BoardViewModel;
    selectedCoordinate: BoardCoordinate | null;
    rejectedCoordinates?: BoardCoordinate[];
    disabled: boolean;
    threat?: ThreatViewModel;
    reducedMotion?: boolean;
  }): void {
    this.layout = input.layout;
    this.boardViewModel = input.boardViewModel;
    this.threatViewModel = input.threat;
    this.state = {
      ...this.state,
      selectedCoordinate: input.selectedCoordinate,
      rejectedCoordinates: input.rejectedCoordinates ?? [],
      disabled: input.disabled,
    };

    this.drawBoardChrome();
    this.rebuildPieces();
    this.redrawThreatLayer(Boolean(input.reducedMotion));
    this.redrawOverlay();
  }

  public async executePlaybackCommand(
    command: PlaybackCommand,
    settings: PlaybackSettings,
  ): Promise<void> {
    switch (command.kind) {
      case 'swap':
        await this.animateAcceptedSwap(command, settings);
        return;
      case 'highlight-matches':
        await this.highlightMatches(command, settings);
        return;
      case 'special-activation':
        await this.playSpecialActivation(command, settings);
        return;
      case 'score-feedback':
      case 'objective-feedback':
        return;
      case 'remove-pieces':
        await this.removePieces(command, settings);
        return;
      case 'create-specials':
        await this.createSpecialPieces(command, settings);
        return;
      case 'apply-gravity':
        await this.applyGravity(command, settings);
        return;
      case 'refill-pieces':
        await this.refillPieces(command, settings);
        return;
      case 'cascade-pause':
        await this.showCascadePause(command, settings);
        return;
      case 'rift-cleanse': {
        // Presentation priority when a cell has multiple causes: wildcard > cross > line > adjacent.
        const color = selectRiftCleanseFlashColor(command.events);
        await this.flashCoordinates(
          command.events.map((event) => event.coordinate),
          color,
          settings,
        );
        return;
      }
      case 'rift-spread':
        await this.flashCoordinates([command.event.coordinate], 0xfb7185, settings);
        return;
      case 'rift-threat-sync':
        return;
      case 'reshuffle-movement':
        await this.playReshuffleMovement(command, settings);
        return;
      case 'synchronize-board':
        this.synchronizeBoardSnapshot(command.board);
        return;
    }
  }

  public async playRejectedSwap(
    from: BoardCoordinate,
    to: BoardCoordinate,
    settings: PlaybackSettings,
  ): Promise<void> {
    const durations = getPlaybackDurations(settings);
    const first = this.pieceDisplays.get(coordinateKey(from));
    const second = this.pieceDisplays.get(coordinateKey(to));

    if (!first || !second) {
      return;
    }

    const firstOrigin = { x: first.container.x, y: first.container.y };
    const secondOrigin = { x: second.container.x, y: second.container.y };

    await this.runTimedTransition(durations.rejectedSwapHalf, () => {
      this.trackTween(
        this.scene.tweens.add({
          targets: first.container,
          x: secondOrigin.x,
          y: secondOrigin.y,
          duration: durations.rejectedSwapHalf,
          ease: 'Sine.easeInOut',
        }),
      );
      this.trackTween(
        this.scene.tweens.add({
          targets: second.container,
          x: firstOrigin.x,
          y: firstOrigin.y,
          duration: durations.rejectedSwapHalf,
          ease: 'Sine.easeInOut',
        }),
      );
    });

    await this.runTimedTransition(durations.rejectedSwapHalf, () => {
      this.trackTween(
        this.scene.tweens.add({
          targets: first.container,
          x: firstOrigin.x,
          y: firstOrigin.y,
          duration: durations.rejectedSwapHalf,
          ease: 'Sine.easeInOut',
        }),
      );
      this.trackTween(
        this.scene.tweens.add({
          targets: second.container,
          x: secondOrigin.x,
          y: secondOrigin.y,
          duration: durations.rejectedSwapHalf,
          ease: 'Sine.easeInOut',
        }),
      );
    });

    await this.flashCoordinates([from, to], 0xf87171, settings, durations.matchHighlight);
  }

  public cancelActiveVisuals(): void {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens.clear();
    this.threatTween = null;

    for (const timer of this.activeTimers) {
      timer.remove(false);
    }
    this.activeTimers.clear();

    for (const resolver of this.pendingResolvers) {
      resolver();
    }
    this.pendingResolvers.clear();
  }

  public showHint(input: {
    from: BoardCoordinate;
    to: BoardCoordinate;
    duration: number;
    reducedMotion: boolean;
  }): void {
    this.clearHint();
    if (!this.layout) {
      return;
    }

    const outlines = this.createHighlights([input.from, input.to], 0x38bdf8, 0.22);
    for (const outline of outlines) {
      this.hintObjects.add(outline);
    }

    const from = this.getCellCenter(input.from);
    const to = this.getCellCenter(input.to);
    const connector = this.scene.add.graphics();
    connector.lineStyle(Math.max(3, this.layout.cellSize * 0.08), 0xfef08a, 0.95);
    connector.beginPath();
    connector.moveTo(from.x, from.y);
    connector.lineTo(to.x, to.y);
    connector.strokePath();
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowSize = Math.max(7, this.layout.cellSize * 0.18);
    connector.fillStyle(0xfef08a, 0.95);
    connector.fillTriangle(
      to.x,
      to.y,
      to.x - Math.cos(angle - Math.PI / 2) * arrowSize - Math.cos(angle) * arrowSize,
      to.y - Math.sin(angle - Math.PI / 2) * arrowSize - Math.sin(angle) * arrowSize,
      to.x - Math.cos(angle + Math.PI / 2) * arrowSize - Math.cos(angle) * arrowSize,
      to.y - Math.sin(angle + Math.PI / 2) * arrowSize - Math.sin(angle) * arrowSize,
    );
    this.effectLayer.add(connector);
    this.hintObjects.add(connector);

    if (!input.reducedMotion) {
      this.trackTween(
        this.scene.tweens.add({
          targets: [...outlines, connector],
          alpha: 0.45,
          duration: 420,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      );
    }

    this.hintTimer = this.scene.time.delayedCall(input.duration, () => {
      this.hintTimer = null;
      this.clearHint();
    });
  }

  public clearHint(): void {
    this.hintTimer?.remove(false);
    this.hintTimer = null;
    for (const object of this.hintObjects) {
      this.transientObjects.delete(object);
      object.destroy();
    }
    this.hintObjects.clear();
  }

  public clearTransientState(): void {
    this.clearHint();
    for (const object of this.transientObjects) {
      object.destroy();
    }
    this.transientObjects.clear();
    this.effectLayer.removeAll(true);
    this.state = {
      ...this.state,
      hoverCoordinate: null,
      rejectedCoordinates: [],
    };
    this.redrawOverlay();
  }

  public destroy(): void {
    this.cancelActiveVisuals();
    this.clearTransientState();
    this.hitZone.removeAllListeners();
    this.root.destroy(true);
  }

  private redrawThreatLayer(reducedMotion: boolean): void {
    if (!this.layout) return;
    if (this.threatTween) {
      this.threatTween.stop();
      this.activeTweens.delete(this.threatTween);
      this.threatTween = null;
    }
    this.threatLayer.removeAll(true);
    this.threatLayer.setAlpha(1);
    this.threatGraphics = this.scene.add.graphics();
    this.threatLayer.add(this.threatGraphics);
    const threat = this.threatViewModel;
    if (!threat) return;

    for (const coordinate of threat.corruptedCoordinates) {
      const bounds = getBoardCellBounds(this.layout, coordinate);
      const source = isCoordinateInList(coordinate, threat.sourceCoordinates);
      this.threatGraphics.fillStyle(source ? 0x3f0712 : 0x111827, 0.76);
      this.threatGraphics.fillRect(bounds.x + 2, bounds.y + 2, bounds.width - 4, bounds.height - 4);
      this.threatGraphics.lineStyle(source ? 4 : 2, source ? 0xf43f5e : 0xa78bfa, 0.95);
      this.threatGraphics.strokeRect(
        bounds.x + 3,
        bounds.y + 3,
        bounds.width - 6,
        bounds.height - 6,
      );
      const hatchStep = Math.max(8, Math.floor(bounds.width / 5));
      this.threatGraphics.lineStyle(1, 0xc4b5fd, 0.38);
      for (let offset = -bounds.height; offset < bounds.width; offset += hatchStep) {
        this.threatGraphics.beginPath();
        this.threatGraphics.moveTo(bounds.x + Math.max(2, offset), bounds.y + 2);
        this.threatGraphics.lineTo(
          bounds.x + Math.min(bounds.width - 2, offset + bounds.height),
          bounds.y + bounds.height - 2,
        );
        this.threatGraphics.strokePath();
      }
      const symbol = this.scene.add
        .text(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, source ? '◆' : '×', {
          fontFamily: 'monospace',
          fontSize: `${Math.max(16, Math.floor(bounds.width * 0.42))}px`,
          color: source ? '#fb7185' : '#ddd6fe',
        })
        .setOrigin(0.5);
      this.threatLayer.add(symbol);
    }

    if (threat.threatenedCoordinate) {
      const bounds = getBoardCellBounds(this.layout, threat.threatenedCoordinate);
      this.threatGraphics.lineStyle(3, 0xfbbf24, 1);
      this.threatGraphics.strokeRoundedRect(
        bounds.x + 4,
        bounds.y + 4,
        bounds.width - 8,
        bounds.height - 8,
        8,
      );
      const warning = this.scene.add
        .text(bounds.x + bounds.width - 7, bounds.y + 4, '!', {
          fontFamily: 'monospace',
          fontSize: `${Math.max(14, Math.floor(bounds.width * 0.32))}px`,
          color: '#fef3c7',
          backgroundColor: '#92400e',
          padding: { x: 3, y: 0 },
        })
        .setOrigin(1, 0);
      this.threatLayer.add(warning);
    }

    if (!reducedMotion) {
      this.threatTween = this.trackTween(
        this.scene.tweens.add({
          targets: this.threatLayer,
          alpha: 0.76,
          duration: 1250,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      );
    } else {
      this.threatLayer.setAlpha(1);
    }
  }

  private drawBoardChrome(): void {
    if (!this.layout || !this.boardViewModel) {
      return;
    }

    this.backgroundGraphics.clear();
    this.cellBackgroundGraphics.clear();

    this.backgroundGraphics.fillStyle(0x0f172a, 0.85);
    this.backgroundGraphics.fillRoundedRect(
      this.layout.boardRect.x - 12,
      this.layout.boardRect.y - 12,
      this.layout.boardRect.width + 24,
      this.layout.boardRect.height + 24,
      20,
    );
    this.backgroundGraphics.lineStyle(2, 0x334155, 1);
    this.backgroundGraphics.strokeRoundedRect(
      this.layout.boardRect.x - 12,
      this.layout.boardRect.y - 12,
      this.layout.boardRect.width + 24,
      this.layout.boardRect.height + 24,
      20,
    );

    for (const cell of this.boardViewModel.cells) {
      const bounds = getBoardCellBounds(this.layout, cell.coordinate);
      this.cellBackgroundGraphics.fillStyle(0x172033, 1);
      this.cellBackgroundGraphics.fillRoundedRect(
        bounds.x + 2,
        bounds.y + 2,
        bounds.width - 4,
        bounds.height - 4,
        12,
      );
      this.cellBackgroundGraphics.lineStyle(1, 0x314158, 0.95);
      this.cellBackgroundGraphics.strokeRoundedRect(
        bounds.x + 2,
        bounds.y + 2,
        bounds.width - 4,
        bounds.height - 4,
        12,
      );
    }

    this.hitZone.setPosition(this.layout.boardRect.x, this.layout.boardRect.y);
    this.hitZone.setSize(this.layout.boardRect.width, this.layout.boardRect.height);
  }

  private rebuildPieces(): void {
    if (!this.boardViewModel) {
      return;
    }

    this.pieceLayer.removeAll(true);
    this.pieceDisplays.clear();

    for (const cell of this.boardViewModel.cells) {
      const pieceDisplay = this.createPieceDisplay(cell, cell.coordinate);
      this.pieceLayer.add(pieceDisplay.container);
      this.pieceDisplays.set(coordinateKey(cell.coordinate), pieceDisplay);
    }

    this.assertBoardMatchesBoardSnapshot(
      Board.fromGrid(
        this.boardViewModel.cells.reduce<BoardPiece[][]>((rows, cell) => {
          rows[cell.coordinate.row] ??= [];
          rows[cell.coordinate.row][cell.coordinate.column] = cell.piece;
          return rows;
        }, []),
      ).toGridSnapshot(),
    );
  }

  private redrawOverlay(): void {
    if (!this.layout || !this.boardViewModel) {
      return;
    }

    this.overlayGraphics.clear();

    const adjacentKeys = new Set<string>();
    if (this.state.selectedCoordinate) {
      for (const cell of this.boardViewModel.cells) {
        if (areAdjacent(this.state.selectedCoordinate, cell.coordinate)) {
          adjacentKeys.add(coordinateKey(cell.coordinate));
        }
      }
    }

    for (const cell of this.boardViewModel.cells) {
      const bounds = getBoardCellBounds(this.layout, cell.coordinate);
      const isSelected =
        this.state.selectedCoordinate?.row === cell.coordinate.row &&
        this.state.selectedCoordinate?.column === cell.coordinate.column;
      const isHovered =
        this.state.hoverCoordinate?.row === cell.coordinate.row &&
        this.state.hoverCoordinate?.column === cell.coordinate.column;
      const isAdjacentCandidate = adjacentKeys.has(coordinateKey(cell.coordinate));
      const isRejected = isCoordinateInList(cell.coordinate, this.state.rejectedCoordinates);

      if (isAdjacentCandidate && !isSelected) {
        this.overlayGraphics.lineStyle(2, 0x7dd3fc, 0.3);
        this.overlayGraphics.strokeRoundedRect(
          bounds.x + 4,
          bounds.y + 4,
          bounds.width - 8,
          bounds.height - 8,
          10,
        );
      }

      if (isHovered && !this.state.disabled) {
        this.overlayGraphics.lineStyle(2, 0xe2e8f0, 0.45);
        this.overlayGraphics.strokeRoundedRect(
          bounds.x + 5,
          bounds.y + 5,
          bounds.width - 10,
          bounds.height - 10,
          10,
        );
      }

      if (isSelected) {
        this.overlayGraphics.lineStyle(4, 0xf8fafc, 1);
        this.overlayGraphics.strokeRoundedRect(
          bounds.x + 3,
          bounds.y + 3,
          bounds.width - 6,
          bounds.height - 6,
          12,
        );
      }

      if (isRejected) {
        this.overlayGraphics.lineStyle(4, 0xf87171, 1);
        this.overlayGraphics.strokeRoundedRect(
          bounds.x + 1,
          bounds.y + 1,
          bounds.width - 2,
          bounds.height - 2,
          12,
        );
      }
    }

    if (this.state.disabled) {
      this.overlayGraphics.fillStyle(0x020617, 0.35);
      this.overlayGraphics.fillRoundedRect(
        this.layout.boardRect.x - 12,
        this.layout.boardRect.y - 12,
        this.layout.boardRect.width + 24,
        this.layout.boardRect.height + 24,
        20,
      );
    }
  }

  private async animateAcceptedSwap(
    command: SwapPlaybackCommand,
    settings: PlaybackSettings,
  ): Promise<void> {
    const durations = getPlaybackDurations(settings);
    const firstKey = coordinateKey(command.from);
    const secondKey = coordinateKey(command.to);
    const first = this.pieceDisplays.get(firstKey);
    const second = this.pieceDisplays.get(secondKey);

    if (!first || !second) {
      this.synchronizeBoardSnapshot(command.boardAfter);
      return;
    }

    const firstTarget = this.getCellCenter(command.to);
    const secondTarget = this.getCellCenter(command.from);

    await this.runTimedTransition(
      durations.swap,
      () => {
        this.trackTween(
          this.scene.tweens.add({
            targets: first.container,
            x: firstTarget.x,
            y: firstTarget.y,
            duration: durations.swap,
            ease: 'Sine.easeInOut',
          }),
        );
        this.trackTween(
          this.scene.tweens.add({
            targets: second.container,
            x: secondTarget.x,
            y: secondTarget.y,
            duration: durations.swap,
            ease: 'Sine.easeInOut',
          }),
        );
      },
      () => {
        this.pieceDisplays.delete(firstKey);
        this.pieceDisplays.delete(secondKey);
        first.coordinate = cloneCoordinate(command.to);
        second.coordinate = cloneCoordinate(command.from);
        this.pieceDisplays.set(firstKey, second);
        this.pieceDisplays.set(secondKey, first);
      },
    );
  }

  private async highlightMatches(
    command: HighlightMatchesPlaybackCommand,
    settings: PlaybackSettings,
  ): Promise<void> {
    await this.flashCoordinates(command.matchedCoordinates, 0xfacc15, settings);
    if (command.createdSpecialCoordinates.length > 0) {
      await this.flashCoordinates(command.createdSpecialCoordinates, 0x86efac, settings, 0, 0.22);
    }
  }

  private async playSpecialActivation(
    command: SpecialActivationPlaybackCommand,
    settings: PlaybackSettings,
  ): Promise<void> {
    const duration = getSpecialEffectDuration({
      kind: command.effectPlan.kind,
      affectedCount: command.effectPlan.affectedCoordinates.length,
      activationIndex: command.effectPlan.activationIndex,
      settings,
    });
    const source = this.pieceDisplays.get(coordinateKey(command.activation.coordinate));

    await this.pulseSourcePiece(source, settings, duration);

    if (settings.mode !== 'instant') {
      switch (command.effectPlan.kind) {
        case 'line-clear-horizontal':
        case 'line-clear-vertical':
          await this.playLineClearEffect(command.effectPlan, settings, duration);
          break;
        case 'cross-clear':
          await this.playCrossClearEffect(command.effectPlan, settings, duration);
          break;
        case 'wildcard-target':
          await this.playWildcardTargetEffect(command.effectPlan, settings, duration);
          break;
        case 'wildcard-full-board':
          await this.playWildcardFullBoardEffect(command.effectPlan, settings, duration);
          break;
      }
    }

    if (command.effectPlan.newlyTriggeredCoordinates.length > 0) {
      await this.flashCoordinates(
        command.effectPlan.newlyTriggeredCoordinates,
        0xf9fafb,
        settings,
        Math.max(0, getPlaybackDurations(settings).chainTriggerPulse),
        0.26,
      );
    }
  }

  private async removePieces(
    command: RemovePiecesPlaybackCommand,
    settings: PlaybackSettings,
  ): Promise<void> {
    const durations = getPlaybackDurations(settings);
    const targets = command.removedCoordinates
      .map((coordinate) => {
        const key = coordinateKey(coordinate);
        const display = this.pieceDisplays.get(key);
        return display ? { key, display } : null;
      })
      .filter((entry): entry is { key: string; display: PieceDisplayObject } => entry !== null);

    await this.runTimedTransition(
      durations.removal,
      () => {
        for (const entry of targets) {
          this.trackTween(
            this.scene.tweens.add({
              targets: entry.display.container,
              alpha: 0,
              scaleX: settings.reducedMotion ? 1 : 0.2,
              scaleY: settings.reducedMotion ? 1 : 0.2,
              y:
                entry.display.container.y -
                (settings.reducedMotion ? 0 : this.layout!.cellSize * 0.12),
              duration: durations.removal,
              ease: 'Sine.easeInOut',
            }),
          );
        }
      },
      () => {
        for (const entry of targets) {
          this.pieceDisplays.delete(entry.key);
          entry.display.container.destroy();
        }
      },
    );
  }

  private async createSpecialPieces(
    command: CreateSpecialsPlaybackCommand,
    settings: PlaybackSettings,
  ): Promise<void> {
    const durations = getPlaybackDurations(settings);
    const createdDisplays: PieceDisplayObject[] = [];

    for (const creation of command.createdSpecialPieces) {
      const key = coordinateKey(creation.coordinate);
      const existing = this.pieceDisplays.get(key);
      if (existing) {
        this.pieceDisplays.delete(key);
        existing.container.destroy();
      }

      const display = this.createPieceDisplay(
        {
          key,
          coordinate: cloneCoordinate(creation.coordinate),
          appearance: getPieceAppearance(creation.piece),
          piece: clonePiece(creation.piece),
        },
        creation.coordinate,
      );
      display.container.setScale(settings.reducedMotion ? 1 : 0.6);
      display.container.setAlpha(settings.reducedMotion ? 0.2 : 0.75);
      this.pieceDisplays.set(key, display);
      this.pieceLayer.add(display.container);
      createdDisplays.push(display);
    }

    await this.runTimedTransition(
      durations.specialCreation,
      () => {
        for (const display of createdDisplays) {
          this.trackTween(
            this.scene.tweens.add({
              targets: display.container,
              alpha: 1,
              scaleX: 1,
              scaleY: 1,
              duration: durations.specialCreation,
              ease: 'Back.Out',
            }),
          );
        }
      },
      () => {
        this.assertDisplayMatchesGrid(command.gridAfterCreation);
      },
    );
  }

  private async applyGravity(
    command: ApplyGravityPlaybackCommand,
    settings: PlaybackSettings,
  ): Promise<void> {
    const movements: Array<{
      fromKey: string;
      toKey: string;
      display: PieceDisplayObject;
      target: { x: number; y: number };
      distance: number;
      coordinate: BoardCoordinate;
    }> = command.movements
      .map((movement) => {
        const key = coordinateKey(movement.from);
        const display = this.pieceDisplays.get(key);
        return display
          ? {
              fromKey: key,
              toKey: coordinateKey(movement.to),
              display,
              target: this.getCellCenter(movement.to),
              distance: movement.distance,
              coordinate: movement.to,
            }
          : null;
      })
      .filter(
        (
          movement,
        ): movement is {
          fromKey: string;
          toKey: string;
          display: PieceDisplayObject;
          target: { x: number; y: number };
          distance: number;
          coordinate: BoardCoordinate;
        } => movement !== null,
      );

    const duration = movements.reduce(
      (maxDuration, movement) =>
        Math.max(maxDuration, getGravityDuration(movement.distance, settings)),
      0,
    );

    await this.runTimedTransition(
      duration,
      () => {
        for (const movement of movements) {
          this.trackTween(
            this.scene.tweens.add({
              targets: movement.display.container,
              x: movement.target.x,
              y: movement.target.y,
              duration: getGravityDuration(movement.distance, settings),
              ease: settings.reducedMotion ? 'Linear' : 'Quad.easeIn',
            }),
          );
        }
      },
      () => {
        const rekeyPlan = planTwoPhaseCoordinateRekey(movements);
        // Vacate every moving source before publishing any destination. A lower
        // piece can fall into the source coordinate of another concurrent fall.
        for (const sourceKey of rekeyPlan.sourceKeysToRemove) {
          this.pieceDisplays.delete(sourceKey);
        }
        for (const assignment of rekeyPlan.destinationAssignments) {
          const movement = movements[assignment.movementIndex];
          movement.display.container.setPosition(movement.target.x, movement.target.y);
          movement.display.coordinate = cloneCoordinate(movement.coordinate);
          this.pieceDisplays.set(assignment.toKey, movement.display);
        }
        this.assertDisplayMatchesGrid(command.gridAfter);
      },
    );
  }

  private async refillPieces(
    command: RefillPiecesPlaybackCommand,
    settings: PlaybackSettings,
  ): Promise<void> {
    const entries = command.entries.map((entry) => {
      const key = coordinateKey(entry.destination);
      const display = this.createPieceDisplay(
        {
          key,
          coordinate: cloneCoordinate(entry.destination),
          appearance: getPieceAppearance(entry.piece),
          piece: clonePiece(entry.piece),
        },
        { row: entry.startRow, column: entry.destination.column },
      );
      display.container.setAlpha(settings.reducedMotion ? 0.2 : 0.75);
      this.pieceDisplays.set(key, display);
      this.pieceLayer.add(display.container);
      return {
        display,
        target: this.getCellCenter(entry.destination),
        distance: entry.destination.row - entry.startRow,
      };
    });

    const duration = entries.reduce(
      (maxDuration, entry) => Math.max(maxDuration, getRefillDuration(entry.distance, settings)),
      0,
    );

    await this.runTimedTransition(
      duration,
      () => {
        for (const entry of entries) {
          this.trackTween(
            this.scene.tweens.add({
              targets: entry.display.container,
              x: entry.target.x,
              y: entry.target.y,
              alpha: 1,
              duration: getRefillDuration(entry.distance, settings),
              ease: settings.reducedMotion ? 'Linear' : 'Quad.easeIn',
            }),
          );
        }
      },
      () => {
        this.assertBoardMatchesBoardSnapshot(command.boardAfter);
      },
    );
  }

  private async showCascadePause(
    command: CascadePausePlaybackCommand,
    settings: PlaybackSettings,
  ): Promise<void> {
    const durations = getPlaybackDurations(settings);
    if (durations.cascadePause === 0 || !this.layout) {
      return;
    }

    const label = this.scene.add
      .text(
        this.layout.boardRect.x + this.layout.boardRect.width / 2,
        this.layout.boardRect.y - 22,
        `Cascade ×${command.cascadeNumber}`,
        {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#fde68a',
          backgroundColor: '#0f172a',
          padding: { x: 8, y: 4 },
        },
      )
      .setOrigin(0.5);

    this.effectLayer.add(label);
    this.transientObjects.add(label);

    await this.runTimedTransition(
      durations.cascadePause,
      () => {
        this.trackTween(
          this.scene.tweens.add({
            targets: label,
            alpha: 0,
            y: label.y - 8,
            duration: durations.cascadePause,
            ease: 'Sine.easeInOut',
          }),
        );
      },
      () => {
        this.transientObjects.delete(label);
        label.destroy();
      },
    );
  }

  private async playReshuffleMovement(
    command: ReshuffleMovementPlaybackCommand,
    settings: PlaybackSettings,
  ): Promise<void> {
    const durations = getPlaybackDurations(settings);
    const label = this.scene.add
      .text(
        this.layout!.boardRect.x + this.layout!.boardRect.width / 2,
        this.layout!.boardRect.y - 22,
        'No Moves - Reshuffling',
        {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#fef3c7',
          backgroundColor: '#0f172a',
          padding: { x: 8, y: 4 },
        },
      )
      .setOrigin(0.5);
    this.effectLayer.add(label);
    this.transientObjects.add(label);

    const movementEntries: Array<{
      movement: ReshuffleMovementPlaybackCommand['movementPlan']['movements'][number];
      display: PieceDisplayObject;
      start: { x: number; y: number };
      end: { x: number; y: number };
      midpoint: { x: number; y: number };
      segmentDuration: number;
      startDelay: number;
    }> = command.movementPlan.movements
      .map((movement) => {
        const display = this.pieceDisplays.get(coordinateKey(movement.from));
        if (!display) {
          return null;
        }

        const start = { x: display.container.x, y: display.container.y };
        const end = this.getCellCenter(movement.to);
        const deltaX = end.x - start.x;
        const deltaY = end.y - start.y;
        const arcSign = movement.index % 2 === 0 ? 1 : -1;
        const midpoint = {
          x:
            start.x +
            deltaX / 2 +
            arcSign * Math.min(this.layout!.cellSize * 0.28, Math.abs(deltaY) * 0.18),
          y:
            start.y +
            deltaY / 2 -
            Math.min(
              this.layout!.cellSize * 0.38,
              (Math.abs(deltaX) + Math.abs(deltaY)) * 0.08 + 10,
            ),
        };
        const distance =
          Math.abs(movement.from.row - movement.to.row) +
          Math.abs(movement.from.column - movement.to.column);
        const segmentDuration = getReshuffleDuration(distance, settings);
        const startDelay =
          settings.mode === 'instant'
            ? 0
            : movement.index * Math.min(14, Math.max(6, segmentDuration / 10));

        return {
          movement,
          display,
          start,
          end,
          midpoint,
          segmentDuration,
          startDelay,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          movement: ReshuffleMovementPlaybackCommand['movementPlan']['movements'][number];
          display: PieceDisplayObject;
          start: { x: number; y: number };
          end: { x: number; y: number };
          midpoint: { x: number; y: number };
          segmentDuration: number;
          startDelay: number;
        } => entry !== null,
      );

    const totalDuration = movementEntries.reduce(
      (maxDuration, entry) => Math.max(maxDuration, entry.startDelay + entry.segmentDuration),
      durations.cascadeLabel,
    );

    await this.runTimedTransition(
      totalDuration,
      () => {
        for (const display of this.pieceDisplays.values()) {
          this.trackTween(
            this.scene.tweens.add({
              targets: display.container,
              scaleX: settings.reducedMotion ? 1 : 0.92,
              scaleY: settings.reducedMotion ? 1 : 0.92,
              yoyo: true,
              duration: Math.max(0, durations.cascadeLabel),
              repeat: 0,
              ease: 'Sine.easeInOut',
            }),
          );
        }

        for (const entry of movementEntries) {
          if (settings.mode === 'instant') {
            entry.display.container.setPosition(entry.end.x, entry.end.y);
            continue;
          }

          if (settings.reducedMotion) {
            this.trackTween(
              this.scene.tweens.add({
                targets: entry.display.container,
                x: entry.end.x,
                y: entry.end.y,
                alpha: 1,
                delay: entry.startDelay,
                duration: entry.segmentDuration,
                ease: 'Sine.easeInOut',
              }),
            );
            continue;
          }

          this.trackTween(
            this.scene.tweens.add({
              targets: entry.display.container,
              x: entry.midpoint.x,
              y: entry.midpoint.y,
              alpha: 0.9,
              delay: entry.startDelay,
              duration: Math.max(1, Math.round(entry.segmentDuration * 0.45)),
              ease: 'Sine.easeOut',
              onComplete: () => {
                this.trackTween(
                  this.scene.tweens.add({
                    targets: entry.display.container,
                    x: entry.end.x,
                    y: entry.end.y,
                    alpha: 1,
                    duration: Math.max(1, Math.round(entry.segmentDuration * 0.55)),
                    ease: 'Sine.easeInOut',
                  }),
                );
              },
            }),
          );
        }
      },
      () => {
        const nextMap = new Map<string, PieceDisplayObject>();
        for (const stationary of command.movementPlan.stationary) {
          const key = coordinateKey(stationary.coordinate);
          const display = this.pieceDisplays.get(key);
          if (!display) {
            continue;
          }
          nextMap.set(key, display);
        }
        for (const entry of movementEntries) {
          entry.display.coordinate = cloneCoordinate(entry.movement.to);
          nextMap.set(coordinateKey(entry.movement.to), entry.display);
        }

        this.pieceDisplays.clear();
        for (const [key, display] of nextMap.entries()) {
          display.container.setScale(1);
          display.container.setAlpha(1);
          this.pieceDisplays.set(key, display);
        }

        this.assertBoardMatchesBoardSnapshot(command.toBoard);
        this.transientObjects.delete(label);
        label.destroy();
      },
    );
  }

  private async pulseSourcePiece(
    source: PieceDisplayObject | undefined,
    settings: PlaybackSettings,
    totalDuration: number,
  ): Promise<void> {
    if (!source) {
      return;
    }

    const durations = getPlaybackDurations(settings);
    await this.runTimedTransition(
      Math.min(totalDuration, durations.specialActivationPulse + durations.specialActivationPause),
      () => {
        this.trackTween(
          this.scene.tweens.add({
            targets: source.container,
            alpha: settings.reducedMotion ? 0.75 : 1,
            scaleX: settings.reducedMotion ? 1 : 1.16,
            scaleY: settings.reducedMotion ? 1 : 1.16,
            yoyo: true,
            duration: durations.specialActivationPulse,
            repeat: 0,
            ease: 'Sine.easeInOut',
          }),
        );
      },
      () => {
        source.container.setAlpha(1);
        source.container.setScale(1);
      },
    );
  }

  private async playLineClearEffect(
    plan: Extract<
      SpecialEffectPresentationPlan,
      { kind: 'line-clear-horizontal' | 'line-clear-vertical' }
    >,
    settings: PlaybackSettings,
    duration: number,
  ): Promise<void> {
    if (settings.reducedMotion || duration === 0) {
      await this.flashCoordinates(plan.affectedCoordinates, 0x7dd3fc, settings, duration, 0.24);
      return;
    }

    const beam = this.scene.add.graphics();
    this.effectLayer.add(beam);
    this.transientObjects.add(beam);
    const source = this.getCellCenter(plan.source);
    const backwardTarget =
      plan.backwardBranch.length > 0 ? this.getCellCenter(plan.backwardBranch.at(-1)!) : source;
    const forwardTarget =
      plan.forwardBranch.length > 0 ? this.getCellCenter(plan.forwardBranch.at(-1)!) : source;
    const state = { backward: 0, forward: 0 };

    const drawBeam = () => {
      beam.clear();
      beam.lineStyle(6, 0xfef08a, 0.95);
      beam.fillStyle(0xfef3c7, 1);

      const backwardPoint = Phaser.Math.Interpolation.Linear(
        [source.x, backwardTarget.x],
        state.backward,
      );
      const backwardY = Phaser.Math.Interpolation.Linear(
        [source.y, backwardTarget.y],
        state.backward,
      );
      const forwardPoint = Phaser.Math.Interpolation.Linear(
        [source.x, forwardTarget.x],
        state.forward,
      );
      const forwardY = Phaser.Math.Interpolation.Linear([source.y, forwardTarget.y], state.forward);

      beam.beginPath();
      beam.moveTo(backwardPoint, backwardY);
      beam.lineTo(forwardPoint, forwardY);
      beam.strokePath();
      beam.fillCircle(backwardPoint, backwardY, 6);
      beam.fillCircle(forwardPoint, forwardY, 6);
    };

    for (const [index, coordinate] of plan.affectedCoordinates.entries()) {
      const delay = Math.round((duration * index) / Math.max(1, plan.affectedCoordinates.length));
      this.scheduleCallback(delay, () => {
        void this.flashCoordinates(
          [coordinate],
          0xfef08a,
          settings,
          Math.max(40, duration / 4),
          0.28,
        );
      });
    }

    await this.runTimedTransition(
      duration,
      () => {
        drawBeam();
        this.trackTween(
          this.scene.tweens.add({
            targets: state,
            backward: 1,
            forward: 1,
            duration,
            ease: 'Linear',
            onUpdate: drawBeam,
          }),
        );
      },
      () => {
        this.transientObjects.delete(beam);
        beam.destroy();
      },
    );
  }

  private async playCrossClearEffect(
    plan: Extract<SpecialEffectPresentationPlan, { kind: 'cross-clear' }>,
    settings: PlaybackSettings,
    duration: number,
  ): Promise<void> {
    if (settings.reducedMotion || duration === 0) {
      await this.flashCoordinates(plan.affectedCoordinates, 0xfca5a5, settings, duration, 0.24);
      return;
    }

    const beams = this.scene.add.graphics();
    this.effectLayer.add(beams);
    this.transientObjects.add(beams);
    const state = { alpha: 0.95, width: 6 };

    for (const [ringIndex, ring] of plan.rings.entries()) {
      const delay = Math.round((duration * ringIndex) / Math.max(1, plan.rings.length));
      this.scheduleCallback(delay, () => {
        void this.flashCoordinates(ring, 0xfca5a5, settings, Math.max(40, duration / 5), 0.24);
      });
    }

    const drawCross = () => {
      beams.clear();
      beams.lineStyle(state.width, 0xfca5a5, state.alpha);
      const rowCells = plan.rowBranch.map((coordinate) => this.getCellCenter(coordinate));
      if (rowCells.length > 0) {
        beams.beginPath();
        beams.moveTo(rowCells[0].x, rowCells[0].y);
        for (const cell of rowCells.slice(1)) {
          beams.lineTo(cell.x, cell.y);
        }
        beams.strokePath();
      }
      const columnCells = [
        ...plan.rowBranch.filter(
          (coordinate) =>
            coordinate.row === plan.source.row && coordinate.column === plan.source.column,
        ),
        ...plan.columnBranch,
      ]
        .sort((left, right) => left.row - right.row)
        .map((coordinate) => this.getCellCenter(coordinate));
      if (columnCells.length > 0) {
        beams.beginPath();
        beams.moveTo(columnCells[0].x, columnCells[0].y);
        for (const cell of columnCells.slice(1)) {
          beams.lineTo(cell.x, cell.y);
        }
        beams.strokePath();
      }
      const source = this.getCellCenter(plan.source);
      beams.fillStyle(0xfef2f2, Math.max(0, state.alpha * 0.35));
      beams.fillCircle(source.x, source.y, Math.max(5, this.layout!.cellSize * 0.18));
    };

    await this.runTimedTransition(
      duration,
      () => {
        drawCross();
        this.trackTween(
          this.scene.tweens.add({
            targets: state,
            alpha: 0,
            width: 2,
            duration,
            ease: 'Sine.easeOut',
            onUpdate: () => {
              drawCross();
            },
          }),
        );
      },
      () => {
        this.transientObjects.delete(beams);
        beams.destroy();
      },
    );
  }

  private async playWildcardTargetEffect(
    plan: Extract<SpecialEffectPresentationPlan, { kind: 'wildcard-target' }>,
    settings: PlaybackSettings,
    duration: number,
  ): Promise<void> {
    if (settings.reducedMotion || duration === 0) {
      await this.flashCoordinates(plan.affectedCoordinates, 0xe9d5ff, settings, duration, 0.22);
      return;
    }

    const source = this.getCellCenter(plan.source);
    const rings = this.scene.add.graphics();
    const threads = this.scene.add.graphics();
    this.effectLayer.add([threads, rings]);
    this.transientObjects.add(rings);
    this.transientObjects.add(threads);
    const state = { radius: 8, alpha: 0.9 };

    const highlightedTargets = plan.affectedCoordinates.slice(0, 12);
    await this.runTimedTransition(
      duration,
      () => {
        for (const [batchIndex, batch] of plan.targetBatches.entries()) {
          const delay = Math.round(
            (duration * batchIndex) / Math.max(1, plan.targetBatches.length),
          );
          this.scheduleCallback(delay, () => {
            void this.flashCoordinates(batch, 0xe9d5ff, settings, Math.max(50, duration / 4), 0.22);
          });
        }

        this.trackTween(
          this.scene.tweens.add({
            targets: state,
            radius: this.layout!.cellSize * 0.68,
            alpha: 0,
            duration,
            ease: 'Sine.easeOut',
            onUpdate: () => {
              rings.clear();
              rings.lineStyle(3, 0xe9d5ff, Math.max(0, state.alpha));
              rings.strokeCircle(source.x, source.y, state.radius);
              rings.strokeCircle(source.x, source.y, state.radius * 0.58);

              threads.clear();
              threads.lineStyle(2, 0xe9d5ff, 0.45);
              for (const coordinate of highlightedTargets) {
                const target = this.getCellCenter(coordinate);
                threads.beginPath();
                threads.moveTo(source.x, source.y);
                threads.lineTo(target.x, target.y);
                threads.strokePath();
                threads.fillStyle(0xffffff, 0.75);
                threads.fillCircle(target.x, target.y, 4);
              }
            },
          }),
        );
      },
      () => {
        this.transientObjects.delete(rings);
        this.transientObjects.delete(threads);
        rings.destroy();
        threads.destroy();
      },
    );
  }

  private async playWildcardFullBoardEffect(
    plan: Extract<SpecialEffectPresentationPlan, { kind: 'wildcard-full-board' }>,
    settings: PlaybackSettings,
    duration: number,
  ): Promise<void> {
    if (settings.reducedMotion || duration === 0) {
      await this.flashCoordinates(plan.affectedCoordinates, 0xbfdbfe, settings, duration, 0.18);
      return;
    }

    const overlay = this.scene.add.graphics();
    this.effectLayer.add(overlay);
    this.transientObjects.add(overlay);
    const state = { alpha: 0.28, progress: 0 };

    for (const [batchIndex, batch] of plan.waveBatches.entries()) {
      const delay = Math.round((duration * batchIndex) / Math.max(1, plan.waveBatches.length));
      this.scheduleCallback(delay, () => {
        void this.flashCoordinates(batch, 0xbfdbfe, settings, Math.max(45, duration / 5), 0.18);
      });
    }

    await this.runTimedTransition(
      duration,
      () => {
        this.trackTween(
          this.scene.tweens.add({
            targets: state,
            alpha: 0,
            progress: 1,
            duration,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
              overlay.clear();
              overlay.fillStyle(0xbfe3ff, state.alpha);
              const waveWidth = this.layout!.boardRect.width * 0.28;
              const x =
                this.layout!.boardRect.x -
                waveWidth +
                (this.layout!.boardRect.width + waveWidth) * state.progress;
              overlay.fillRoundedRect(
                x,
                this.layout!.boardRect.y,
                waveWidth,
                this.layout!.boardRect.height,
                18,
              );
            },
          }),
        );
      },
      () => {
        this.transientObjects.delete(overlay);
        overlay.destroy();
      },
    );
  }

  private createPieceDisplay(
    cell: Pick<BoardCellViewModel, 'coordinate' | 'appearance' | 'piece' | 'key'>,
    positionCoordinate: { row: number; column: number },
  ): PieceDisplayObject {
    const center = this.getCellCenter(positionCoordinate);
    const container = this.scene.add.container(center.x, center.y);
    const graphics = this.scene.add.graphics();
    container.add(graphics);
    this.drawPiece(graphics, cell.appearance, { x: 0, y: 0 });

    return {
      coordinate: cloneCoordinate(cell.coordinate),
      piece: clonePiece(cell.piece),
      appearance: cell.appearance,
      container,
    };
  }

  private drawPiece(
    graphics: Phaser.GameObjects.Graphics,
    appearance: PieceAppearance,
    center: { x: number; y: number },
  ): void {
    if (!this.layout) {
      return;
    }

    const radius = this.layout.cellSize * 0.32;

    graphics.lineStyle(Math.max(2, this.layout.cellSize * 0.04), appearance.strokeColor, 1);
    graphics.fillStyle(appearance.fillColor, 1);

    switch (appearance.shape) {
      case 'circle':
        graphics.fillCircle(center.x, center.y, radius);
        graphics.strokeCircle(center.x, center.y, radius);
        break;
      case 'rounded-square':
        graphics.fillRoundedRect(
          center.x - radius,
          center.y - radius,
          radius * 2,
          radius * 2,
          radius * 0.4,
        );
        graphics.strokeRoundedRect(
          center.x - radius,
          center.y - radius,
          radius * 2,
          radius * 2,
          radius * 0.4,
        );
        break;
      case 'hexagon': {
        const points = Array.from({ length: 6 }, (_, index) => {
          const angle = Phaser.Math.DegToRad(60 * index - 30);
          return new Phaser.Geom.Point(
            center.x + Math.cos(angle) * radius,
            center.y + Math.sin(angle) * radius,
          );
        });
        graphics.fillPoints(points, true);
        graphics.strokePoints(points, true);
        break;
      }
      case 'diamond': {
        const points = [
          new Phaser.Geom.Point(center.x, center.y - radius),
          new Phaser.Geom.Point(center.x + radius, center.y),
          new Phaser.Geom.Point(center.x, center.y + radius),
          new Phaser.Geom.Point(center.x - radius, center.y),
        ];
        graphics.fillPoints(points, true);
        graphics.strokePoints(points, true);
        break;
      }
      case 'triangle': {
        const points = [
          new Phaser.Geom.Point(center.x, center.y - radius),
          new Phaser.Geom.Point(center.x + radius, center.y + radius * 0.85),
          new Phaser.Geom.Point(center.x - radius, center.y + radius * 0.85),
        ];
        graphics.fillPoints(points, true);
        graphics.strokePoints(points, true);
        break;
      }
    }

    this.drawPieceSymbol(graphics, center, radius, appearance);
    this.drawPieceOverlay(graphics, center, radius, appearance);
  }

  private drawPieceSymbol(
    graphics: Phaser.GameObjects.Graphics,
    center: { x: number; y: number },
    radius: number,
    appearance: PieceAppearance,
  ): void {
    graphics.lineStyle(Math.max(2, radius * 0.18), appearance.symbolColor, 1);
    graphics.fillStyle(appearance.symbolColor, 1);

    switch (appearance.symbol) {
      case 'flame':
        graphics.fillTriangle(
          center.x,
          center.y - radius * 0.6,
          center.x + radius * 0.4,
          center.y + radius * 0.35,
          center.x - radius * 0.25,
          center.y + radius * 0.45,
        );
        break;
      case 'wave':
        graphics.beginPath();
        graphics.moveTo(center.x - radius * 0.65, center.y + radius * 0.1);
        graphics.lineTo(center.x - radius * 0.2, center.y - radius * 0.15);
        graphics.lineTo(center.x + radius * 0.2, center.y + radius * 0.15);
        graphics.lineTo(center.x + radius * 0.65, center.y - radius * 0.1);
        graphics.strokePath();
        break;
      case 'leaf': {
        const points = [
          new Phaser.Geom.Point(center.x, center.y - radius * 0.55),
          new Phaser.Geom.Point(center.x + radius * 0.4, center.y),
          new Phaser.Geom.Point(center.x, center.y + radius * 0.45),
          new Phaser.Geom.Point(center.x - radius * 0.35, center.y),
        ];
        graphics.fillPoints(points, true);
        graphics.lineStyle(Math.max(1, radius * 0.1), appearance.strokeColor, 0.8);
        graphics.beginPath();
        graphics.moveTo(center.x, center.y - radius * 0.45);
        graphics.lineTo(center.x, center.y + radius * 0.35);
        graphics.strokePath();
        break;
      }
      case 'sun':
        graphics.strokeCircle(center.x, center.y, radius * 0.28);
        for (let index = 0; index < 8; index += 1) {
          const angle = Phaser.Math.DegToRad(index * 45);
          graphics.beginPath();
          graphics.moveTo(
            center.x + Math.cos(angle) * radius * 0.42,
            center.y + Math.sin(angle) * radius * 0.42,
          );
          graphics.lineTo(
            center.x + Math.cos(angle) * radius * 0.7,
            center.y + Math.sin(angle) * radius * 0.7,
          );
          graphics.strokePath();
        }
        break;
      case 'spiral':
        graphics.beginPath();
        for (let step = 0; step <= 18; step += 1) {
          const t = step / 18;
          const angle = Phaser.Math.DegToRad(320 * t);
          const distance = radius * 0.08 + radius * 0.45 * t;
          const x = center.x + Math.cos(angle) * distance;
          const y = center.y + Math.sin(angle) * distance;
          if (step === 0) {
            graphics.moveTo(x, y);
          } else {
            graphics.lineTo(x, y);
          }
        }
        graphics.strokePath();
        break;
      case 'ring':
        graphics.strokeCircle(center.x, center.y, radius * 0.4);
        break;
    }
  }

  private drawPieceOverlay(
    graphics: Phaser.GameObjects.Graphics,
    center: { x: number; y: number },
    radius: number,
    appearance: PieceAppearance,
  ): void {
    graphics.lineStyle(Math.max(2, radius * 0.18), 0xf8fafc, 0.95);
    switch (appearance.overlay.kind) {
      case 'none':
        return;
      case 'line-clear':
        if (appearance.overlay.orientation === 'horizontal') {
          graphics.beginPath();
          graphics.moveTo(center.x - radius * 0.9, center.y);
          graphics.lineTo(center.x + radius * 0.9, center.y);
          graphics.strokePath();
        } else {
          graphics.beginPath();
          graphics.moveTo(center.x, center.y - radius * 0.9);
          graphics.lineTo(center.x, center.y + radius * 0.9);
          graphics.strokePath();
        }
        return;
      case 'cross-clear':
        // Plus-sign silhouette distinct from line-clear and wildcard rings.
        graphics.beginPath();
        graphics.moveTo(center.x - radius * 0.85, center.y);
        graphics.lineTo(center.x + radius * 0.85, center.y);
        graphics.moveTo(center.x, center.y - radius * 0.85);
        graphics.lineTo(center.x, center.y + radius * 0.85);
        graphics.strokePath();
        graphics.strokeCircle(center.x, center.y, radius * 0.28);
        return;
      case 'wildcard':
        graphics.strokeCircle(center.x, center.y, radius * 0.78);
        for (let index = 0; index < 6; index += 1) {
          const angle = Phaser.Math.DegToRad(index * 60);
          graphics.beginPath();
          graphics.moveTo(
            center.x - Math.cos(angle) * radius * 0.15,
            center.y - Math.sin(angle) * radius * 0.15,
          );
          graphics.lineTo(
            center.x + Math.cos(angle) * radius * 0.8,
            center.y + Math.sin(angle) * radius * 0.8,
          );
          graphics.strokePath();
        }
        return;
    }
  }

  private getCellCenter(coordinate: { row: number; column: number }): { x: number; y: number } {
    if (!this.layout) {
      throw new Error('Board layout is not initialized');
    }

    return {
      x: this.layout.boardRect.x + (coordinate.column + 0.5) * this.layout.cellSize,
      y: this.layout.boardRect.y + (coordinate.row + 0.5) * this.layout.cellSize,
    };
  }

  private synchronizeBoardSnapshot(snapshot: BoardPiece[][]): void {
    this.boardViewModel = createBoardViewModel(Board.fromGrid(snapshot));
    this.rebuildPieces();
    this.redrawOverlay();
  }

  private createHighlights(
    coordinates: readonly BoardCoordinate[],
    color: number,
    alpha: number,
  ): Phaser.GameObjects.Graphics[] {
    if (!this.layout) {
      return [];
    }

    return coordinates.map((coordinate) => {
      const bounds = getBoardCellBounds(this.layout!, coordinate);
      const highlight = this.scene.add.graphics();
      highlight.fillStyle(color, alpha);
      highlight.fillRoundedRect(
        bounds.x + 4,
        bounds.y + 4,
        bounds.width - 8,
        bounds.height - 8,
        10,
      );
      highlight.lineStyle(3, color, 0.9);
      highlight.strokeRoundedRect(
        bounds.x + 4,
        bounds.y + 4,
        bounds.width - 8,
        bounds.height - 8,
        10,
      );
      this.effectLayer.add(highlight);
      this.transientObjects.add(highlight);
      return highlight;
    });
  }

  private destroyHighlights(highlights: readonly Phaser.GameObjects.Graphics[]): void {
    for (const highlight of highlights) {
      this.transientObjects.delete(highlight);
      highlight.destroy();
    }
  }

  private async flashCoordinates(
    coordinates: readonly BoardCoordinate[],
    color: number,
    settings: PlaybackSettings,
    durationOverride?: number,
    alpha = 0.28,
  ): Promise<void> {
    const durations = getPlaybackDurations(settings);
    const duration = durationOverride ?? durations.matchHighlight;
    if (duration === 0 || coordinates.length === 0) {
      return;
    }

    const highlights = this.createHighlights(coordinates, color, alpha);
    await this.runTimedTransition(duration, undefined, () => {
      this.destroyHighlights(highlights);
    });
  }

  private async runTimedTransition(
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
        this.pendingResolvers.delete(finish);
        onFinish?.();
        resolve();
      };

      this.pendingResolvers.add(finish);
      const timer = this.scene.time.delayedCall(duration, () => {
        this.activeTimers.delete(timer);
        finish();
      });
      this.activeTimers.add(timer);
    });
  }

  private scheduleCallback(delay: number, callback: () => void): void {
    if (delay <= 0) {
      callback();
      return;
    }

    const timer = this.scene.time.delayedCall(delay, () => {
      this.activeTimers.delete(timer);
      callback();
    });
    this.activeTimers.add(timer);
  }

  private trackTween(tween: Phaser.Tweens.Tween): Phaser.Tweens.Tween {
    this.activeTweens.add(tween);
    tween.once(Phaser.Tweens.Events.TWEEN_COMPLETE, () => {
      this.activeTweens.delete(tween);
    });
    tween.once(Phaser.Tweens.Events.TWEEN_STOP, () => {
      this.activeTweens.delete(tween);
    });
    return tween;
  }

  private assertBoardMatchesBoardSnapshot(snapshot: BoardPiece[][]): void {
    const expectedGrid: ResolvableGrid = snapshot.map((row) => row.map((piece) => ({ ...piece })));
    this.assertDisplayMatchesGrid(expectedGrid);
  }

  private assertDisplayMatchesGrid(grid: ResolvableGrid): void {
    if (!this.shouldAssertConsistency()) {
      return;
    }

    const expectedOccupiedKeys = new Set<string>();

    for (let row = 0; row < grid.length; row += 1) {
      for (let column = 0; column < grid[row].length; column += 1) {
        const coordinate = { row, column };
        const key = coordinateKey(coordinate);
        const cell = grid[row][column];

        if (cell === null) {
          if (this.pieceDisplays.has(key)) {
            throw new Error(`unexpected rendered piece at ${key}`);
          }
          continue;
        }

        expectedOccupiedKeys.add(key);
        const display = this.pieceDisplays.get(key);
        if (!display) {
          throw new Error(`missing rendered piece at ${key}`);
        }

        if (display.piece.kind !== cell.kind || display.piece.pieceType !== cell.pieceType) {
          throw new Error(
            `rendered piece mismatch at ${key}: expected ${cell.kind}:${cell.pieceType}, received ${display.piece.kind}:${display.piece.pieceType}`,
          );
        }
      }
    }

    if (this.pieceDisplays.size !== expectedOccupiedKeys.size) {
      throw new Error('rendered occupancy count mismatch');
    }
  }

  private shouldAssertConsistency(): boolean {
    return import.meta.env.DEV;
  }
}
