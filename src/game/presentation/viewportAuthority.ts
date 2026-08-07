/* global Element, HTMLCanvasElement, URLSearchParams */
/**
 * Single owner for usable viewport ↔ Phaser scale synchronization.
 * Presentation-only — never mutates gameplay/save/story authority.
 */

import type Phaser from 'phaser';
import { resolveSceneLayoutClass, type SceneLayoutClass } from './sceneShellLayout';

export interface UsableViewportSize {
  width: number;
  height: number;
  source: 'game-root' | 'visual-viewport' | 'window' | 'fallback';
}

export interface ViewportDiagnosticsSnapshot {
  windowInnerWidth: number;
  windowInnerHeight: number;
  documentClientWidth: number;
  documentClientHeight: number;
  visualViewportWidth: number;
  visualViewportHeight: number;
  appShellWidth: number;
  appShellHeight: number;
  gameRootWidth: number;
  gameRootHeight: number;
  canvasCssWidth: number;
  canvasCssHeight: number;
  canvasBackingWidth: number;
  canvasBackingHeight: number;
  phaserScaleWidth: number;
  phaserScaleHeight: number;
  layoutClass: SceneLayoutClass;
  devicePixelRatio: number;
}

const FALLBACK_SIZE = { width: 390, height: 844 } as const;

function roundSize(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

function elementContentSize(element: Element | null): { width: number; height: number } | null {
  if (!(element instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect();
  const width = rect.width || element.clientWidth;
  const height = rect.height || element.clientHeight;
  if (width < 2 || height < 2) return null;
  return roundSize(width, height);
}

/** Measure the actual usable game surface before/without Phaser. */
export function measureUsableViewport(): UsableViewportSize {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ...FALLBACK_SIZE, source: 'fallback' };
  }

  const root = elementContentSize(document.getElementById('game-root'));
  if (root) {
    return { ...root, source: 'game-root' };
  }

  const visual = window.visualViewport;
  if (visual && visual.width >= 2 && visual.height >= 2) {
    return { ...roundSize(visual.width, visual.height), source: 'visual-viewport' };
  }

  if (window.innerWidth >= 2 && window.innerHeight >= 2) {
    return {
      ...roundSize(window.innerWidth, window.innerHeight),
      source: 'window',
    };
  }

  return { ...FALLBACK_SIZE, source: 'fallback' };
}

export function isViewportDebugEnabled(search = window.location.search): boolean {
  return new URLSearchParams(search).get('viewportDebug') === '1';
}

export function collectViewportDiagnostics(game?: Phaser.Game | null): ViewportDiagnosticsSnapshot {
  const root = document.getElementById('game-root');
  const shell = document.getElementById('app-shell');
  const canvas = root?.querySelector('canvas') ?? document.querySelector('canvas');
  const rootRect = root?.getBoundingClientRect();
  const shellRect = shell?.getBoundingClientRect();
  const canvasRect = canvas?.getBoundingClientRect();
  const visual = window.visualViewport;
  const phaserWidth = game?.scale.width ?? 0;
  const phaserHeight = game?.scale.height ?? 0;
  const layoutWidth = phaserWidth || rootRect?.width || window.innerWidth;
  const layoutHeight = phaserHeight || rootRect?.height || window.innerHeight;

  return {
    windowInnerWidth: Math.round(window.innerWidth),
    windowInnerHeight: Math.round(window.innerHeight),
    documentClientWidth: Math.round(document.documentElement.clientWidth),
    documentClientHeight: Math.round(document.documentElement.clientHeight),
    visualViewportWidth: Math.round(visual?.width ?? window.innerWidth),
    visualViewportHeight: Math.round(visual?.height ?? window.innerHeight),
    appShellWidth: Math.round(shellRect?.width ?? 0),
    appShellHeight: Math.round(shellRect?.height ?? 0),
    gameRootWidth: Math.round(rootRect?.width ?? 0),
    gameRootHeight: Math.round(rootRect?.height ?? 0),
    canvasCssWidth: Math.round(canvasRect?.width ?? 0),
    canvasCssHeight: Math.round(canvasRect?.height ?? 0),
    canvasBackingWidth: canvas instanceof HTMLCanvasElement ? canvas.width : 0,
    canvasBackingHeight: canvas instanceof HTMLCanvasElement ? canvas.height : 0,
    phaserScaleWidth: Math.round(phaserWidth),
    phaserScaleHeight: Math.round(phaserHeight),
    layoutClass: resolveSceneLayoutClass(layoutWidth, layoutHeight),
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

/** Publish presentation-only viewport truth onto the hidden test status node. */
export function publishViewportDiagnostics(game?: Phaser.Game | null): ViewportDiagnosticsSnapshot {
  const snapshot = collectViewportDiagnostics(game ?? window.__storyCrushGame ?? null);
  const element = document.getElementById('storycrush-test-status');
  if (element) {
    element.setAttribute('data-window-inner-width', String(snapshot.windowInnerWidth));
    element.setAttribute('data-window-inner-height', String(snapshot.windowInnerHeight));
    element.setAttribute('data-document-client-width', String(snapshot.documentClientWidth));
    element.setAttribute('data-document-client-height', String(snapshot.documentClientHeight));
    element.setAttribute('data-visual-viewport-width', String(snapshot.visualViewportWidth));
    element.setAttribute('data-visual-viewport-height', String(snapshot.visualViewportHeight));
    element.setAttribute('data-app-shell-width', String(snapshot.appShellWidth));
    element.setAttribute('data-app-shell-height', String(snapshot.appShellHeight));
    element.setAttribute('data-game-root-width', String(snapshot.gameRootWidth));
    element.setAttribute('data-game-root-height', String(snapshot.gameRootHeight));
    element.setAttribute('data-canvas-css-width', String(snapshot.canvasCssWidth));
    element.setAttribute('data-canvas-css-height', String(snapshot.canvasCssHeight));
    element.setAttribute('data-canvas-backing-width', String(snapshot.canvasBackingWidth));
    element.setAttribute('data-canvas-backing-height', String(snapshot.canvasBackingHeight));
    element.setAttribute('data-phaser-scale-width', String(snapshot.phaserScaleWidth));
    element.setAttribute('data-phaser-scale-height', String(snapshot.phaserScaleHeight));
    element.setAttribute('data-layout-class', snapshot.layoutClass);
    element.setAttribute('data-device-pixel-ratio', String(snapshot.devicePixelRatio));
  }
  updateViewportDebugOverlay(snapshot);
  return snapshot;
}

function updateViewportDebugOverlay(snapshot: ViewportDiagnosticsSnapshot): void {
  if (!isViewportDebugEnabled()) {
    document.getElementById('storycrush-viewport-debug')?.remove();
    return;
  }

  let overlay = document.getElementById('storycrush-viewport-debug');
  if (!overlay) {
    overlay = document.createElement('pre');
    overlay.id = 'storycrush-viewport-debug';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.append(overlay);
  }

  overlay.textContent = [
    `inner ${snapshot.windowInnerWidth}×${snapshot.windowInnerHeight}`,
    `visual ${snapshot.visualViewportWidth}×${snapshot.visualViewportHeight}`,
    `root ${snapshot.gameRootWidth}×${snapshot.gameRootHeight}`,
    `canvas-css ${snapshot.canvasCssWidth}×${snapshot.canvasCssHeight}`,
    `canvas-backing ${snapshot.canvasBackingWidth}×${snapshot.canvasBackingHeight}`,
    `phaser ${snapshot.phaserScaleWidth}×${snapshot.phaserScaleHeight}`,
    `layout-class ${snapshot.layoutClass}`,
    `DPR ${snapshot.devicePixelRatio}`,
  ].join('\n');
}

/**
 * Force Phaser logical size to match the measured game-root box.
 * Safe to call repeatedly; no-ops when already synchronized.
 */
export function synchronizePhaserToUsableViewport(game: Phaser.Game): UsableViewportSize {
  const measured = measureUsableViewport();
  const scale = game.scale;
  const widthChanged = Math.abs(scale.width - measured.width) > 0.5;
  const heightChanged = Math.abs(scale.height - measured.height) > 0.5;

  // Only resize when the usable box actually changed. Calling refresh() on an
  // unchanged size still emits RESIZE and can rebuild shell UI mid-tap on iOS.
  if (widthChanged || heightChanged) {
    scale.resize(measured.width, measured.height);
  }

  // Keep CSS display size equal to logical size — never rely on max-width shrinking.
  const canvas = game.canvas;
  if (canvas) {
    canvas.style.width = `${measured.width}px`;
    canvas.style.height = `${measured.height}px`;
    canvas.style.maxWidth = 'none';
    canvas.style.maxHeight = 'none';
  }

  publishViewportDiagnostics(game);
  return measured;
}

export interface ViewportAuthorityHandle {
  dispose: () => void;
  sync: () => UsableViewportSize;
}

/** Attach resize / visualViewport / orientation listeners that keep Phaser in sync. */
export function attachViewportAuthority(game: Phaser.Game): ViewportAuthorityHandle {
  let frame = 0;
  const scheduleSync = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      synchronizePhaserToUsableViewport(game);
    });
  };

  const syncNow = () => synchronizePhaserToUsableViewport(game);
  syncNow();

  // Catch late iOS Safari chrome / orientation settling after first paint.
  const startupTimers = [50, 250, 1000].map((delay) => window.setTimeout(syncNow, delay));

  window.addEventListener('resize', scheduleSync);
  window.addEventListener('orientationchange', scheduleSync);
  const visual = window.visualViewport;
  visual?.addEventListener('resize', scheduleSync);
  visual?.addEventListener('scroll', scheduleSync);

  game.events.once('destroy', () => {
    dispose();
  });

  const dispose = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    startupTimers.forEach((id) => window.clearTimeout(id));
    window.removeEventListener('resize', scheduleSync);
    window.removeEventListener('orientationchange', scheduleSync);
    visual?.removeEventListener('resize', scheduleSync);
    visual?.removeEventListener('scroll', scheduleSync);
    document.getElementById('storycrush-viewport-debug')?.remove();
  };

  return { dispose, sync: syncNow };
}
