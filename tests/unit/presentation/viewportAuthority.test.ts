import { describe, expect, it } from 'vitest';
import { isViewportDebugEnabled } from '../../../src/game/presentation/viewportAuthority';
import { resolveSceneLayoutClass } from '../../../src/game/presentation/sceneShellLayout';

describe('viewportAuthority', () => {
  it('detects viewportDebug query flag', () => {
    expect(isViewportDebugEnabled('?e2e=1')).toBe(false);
    expect(isViewportDebugEnabled('?viewportDebug=1')).toBe(true);
    expect(isViewportDebugEnabled('?e2e=1&viewportDebug=1')).toBe(true);
  });

  it('classifies phone widths used by viewport diagnostics', () => {
    expect(resolveSceneLayoutClass(390, 844)).toBe('phone-portrait');
    expect(resolveSceneLayoutClass(320, 568)).toBe('phone-portrait');
    expect(resolveSceneLayoutClass(844, 390)).toBe('phone-landscape');
  });
});
