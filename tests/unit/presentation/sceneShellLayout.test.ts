import { describe, expect, it } from 'vitest';
import {
  calculateSceneShellLayout,
  resolveSceneLayoutClass,
} from '../../../src/game/presentation/sceneShellLayout';

describe('sceneShellLayout', () => {
  it('classifies phone portrait, landscape, tablet, and desktop', () => {
    expect(resolveSceneLayoutClass(390, 844)).toBe('phone-portrait');
    expect(resolveSceneLayoutClass(320, 568)).toBe('phone-portrait');
    expect(resolveSceneLayoutClass(844, 390)).toBe('phone-landscape');
    expect(resolveSceneLayoutClass(820, 1180)).toBe('tablet');
    expect(resolveSceneLayoutClass(1280, 720)).toBe('desktop');
  });

  it('stacks cards on phone portrait and keeps readable wrap widths', () => {
    const shell = calculateSceneShellLayout({ width: 390, height: 844 });
    expect(shell.stackCards).toBe(true);
    expect(shell.titleWrapWidth).toBeLessThanOrEqual(shell.safeWidth);
    expect(shell.bodyWrapWidth).toBeLessThanOrEqual(shell.safeWidth);
    expect(shell.minTouch).toBeGreaterThanOrEqual(44);
    expect(shell.safeX + shell.safeWidth).toBeLessThanOrEqual(390);
  });

  it('keeps side-by-side cards on desktop and phone landscape', () => {
    const desktop = calculateSceneShellLayout({ width: 1280, height: 720 });
    expect(desktop.stackCards).toBe(false);
    expect(desktop.layoutClass).toBe('desktop');

    const landscape = calculateSceneShellLayout({ width: 844, height: 390 });
    expect(landscape.stackCards).toBe(false);
    expect(landscape.layoutClass).toBe('phone-landscape');
  });
});
