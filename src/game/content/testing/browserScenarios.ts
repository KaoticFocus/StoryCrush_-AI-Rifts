import { type BoardCoordinate } from '../../board';
import { type BrowserFixtureId } from './browserFixtures';

export type BrowserScenarioAction =
  | { kind: 'swap'; from: BoardCoordinate; to: BoardCoordinate }
  | { kind: 'control'; control: 'hint' | 'pause' | 'restart' | 'resize' | 'menu' }
  | { kind: 'none' };

export interface BrowserScenarioDefinition {
  id: BrowserScenarioId;
  fixtureId: BrowserFixtureId;
  description: string;
  expectedAction: BrowserScenarioAction;
  expectedFeatures: readonly string[];
}

export type BrowserScenarioId =
  | 'idle-board'
  | 'rejected-swap'
  | 'ordinary-match'
  | 'fast-gravity'
  | 'instant-resolution'
  | 'multi-cascade'
  | 'horizontal-line-clear'
  | 'vertical-line-clear'
  | 'cross-clear'
  | 'wildcard-target'
  | 'wildcard-pair'
  | 'activation-chain'
  | 'automatic-reshuffle'
  | 'pause-during-playback'
  | 'resize-during-playback'
  | 'restart-during-playback'
  | 'terminal-win'
  | 'terminal-failure'
  | 'mobile-layout'
  | 'reduced-motion'
  | 'rift-spread'
  | 'rift-cleanse'
  | 'rift-overwhelm';

const ordinaryMove = { from: { row: 0, column: 1 }, to: { row: 1, column: 1 } };
const lineAreaMove = { from: { row: 6, column: 6 }, to: { row: 6, column: 7 } };
const wildcardMove = { from: { row: 4, column: 4 }, to: { row: 4, column: 5 } };

const scenarios: Record<BrowserScenarioId, BrowserScenarioDefinition> = {
  'idle-board': {
    id: 'idle-board',
    fixtureId: 'fast-gravity',
    description: 'Stable puzzle initialization.',
    expectedAction: { kind: 'none' },
    expectedFeatures: ['idle', 'render-consistency'],
  },
  'rejected-swap': {
    id: 'rejected-swap',
    fixtureId: 'fast-gravity',
    description: 'Adjacent non-scoring swap returns.',
    expectedAction: { kind: 'swap', from: { row: 0, column: 0 }, to: { row: 0, column: 1 } },
    expectedFeatures: ['rejected-swap', 'input-unlocked'],
  },
  'ordinary-match': {
    id: 'ordinary-match',
    fixtureId: 'fast-gravity',
    description: 'Ordinary accepted match resolution.',
    expectedAction: { kind: 'swap', ...ordinaryMove },
    expectedFeatures: ['match', 'gravity', 'refill'],
  },
  'fast-gravity': {
    id: 'fast-gravity',
    fixtureId: 'fast-gravity',
    description: 'Fast playback gravity and refill.',
    expectedAction: { kind: 'swap', ...ordinaryMove },
    expectedFeatures: ['fast-mode', 'gravity', 'refill'],
  },
  'instant-resolution': {
    id: 'instant-resolution',
    fixtureId: 'instant-resolution',
    description: 'Instant playback synchronization.',
    expectedAction: { kind: 'swap', ...ordinaryMove },
    expectedFeatures: ['instant-mode', 'synchronize'],
  },
  'multi-cascade': {
    id: 'multi-cascade',
    fixtureId: 'fast-gravity',
    description: 'Deterministic cascade-capable ordinary fixture.',
    expectedAction: { kind: 'swap', ...ordinaryMove },
    expectedFeatures: ['cascade', 'gravity', 'refill'],
  },
  'horizontal-line-clear': {
    id: 'horizontal-line-clear',
    fixtureId: 'line-area-combination',
    description: 'Direct horizontal line-clear activation.',
    expectedAction: { kind: 'swap', ...lineAreaMove },
    expectedFeatures: ['line-clear', 'horizontal'],
  },
  'vertical-line-clear': {
    id: 'vertical-line-clear',
    fixtureId: 'line-area-combination',
    description: 'Line-clear presentation is orientation-aware.',
    expectedAction: { kind: 'swap', ...lineAreaMove },
    expectedFeatures: ['line-clear', 'orientation'],
  },
  'cross-clear': {
    id: 'cross-clear',
    fixtureId: 'line-area-combination',
    description: 'Direct cross-clear activation.',
    expectedAction: { kind: 'swap', ...lineAreaMove },
    expectedFeatures: ['cross-clear', 'special-activation'],
  },
  'wildcard-target': {
    id: 'wildcard-target',
    fixtureId: 'wildcard-target',
    description: 'Wildcard targets counterpart piece type.',
    expectedAction: { kind: 'swap', ...wildcardMove },
    expectedFeatures: ['wildcard', 'targeted'],
  },
  'wildcard-pair': {
    id: 'wildcard-pair',
    fixtureId: 'wildcard-pair',
    description: 'Wildcard pair clears the board.',
    expectedAction: { kind: 'swap', ...wildcardMove },
    expectedFeatures: ['wildcard', 'entire-board'],
  },
  'activation-chain': {
    id: 'activation-chain',
    fixtureId: 'wildcard-pair',
    description: 'Wildcard pair chains into a line-clear.',
    expectedAction: { kind: 'swap', ...wildcardMove },
    expectedFeatures: ['activation-chain', 'special-activation'],
  },
  'automatic-reshuffle': {
    id: 'automatic-reshuffle',
    fixtureId: 'fast-gravity',
    description: 'Reshuffle recovery remains exercised by level-domain tests.',
    expectedAction: { kind: 'none' },
    expectedFeatures: ['reshuffle', 'domain-unit-coverage'],
  },
  'pause-during-playback': {
    id: 'pause-during-playback',
    fixtureId: 'fast-gravity',
    description: 'Pause control during accepted playback.',
    expectedAction: { kind: 'control', control: 'pause' },
    expectedFeatures: ['pause', 'playback-lock'],
  },
  'resize-during-playback': {
    id: 'resize-during-playback',
    fixtureId: 'fast-gravity',
    description: 'Resize cancels playback and hard-synchronizes.',
    expectedAction: { kind: 'control', control: 'resize' },
    expectedFeatures: ['resize', 'cancellation'],
  },
  'restart-during-playback': {
    id: 'restart-during-playback',
    fixtureId: 'fast-gravity',
    description: 'Restart cancels playback and restores the seed.',
    expectedAction: { kind: 'control', control: 'restart' },
    expectedFeatures: ['restart', 'cancellation'],
  },
  'terminal-win': {
    id: 'terminal-win',
    fixtureId: 'fast-gravity',
    description: 'Terminal win remains covered by level-domain tests.',
    expectedAction: { kind: 'none' },
    expectedFeatures: ['terminal', 'win', 'domain-unit-coverage'],
  },
  'terminal-failure': {
    id: 'terminal-failure',
    fixtureId: 'terminal-failure',
    description: 'Move-limit failure after the normal accepted-move pipeline.',
    expectedAction: { kind: 'swap', ...ordinaryMove },
    expectedFeatures: ['terminal', 'failure', 'accepted-move'],
  },
  'mobile-layout': {
    id: 'mobile-layout',
    fixtureId: 'fast-gravity',
    description: 'Responsive mobile layout and touch input.',
    expectedAction: { kind: 'none' },
    expectedFeatures: ['mobile-layout', 'touch'],
  },
  'reduced-motion': {
    id: 'reduced-motion',
    fixtureId: 'line-area-combination',
    description: 'Reduced-motion special-effect presentation.',
    expectedAction: { kind: 'swap', ...lineAreaMove },
    expectedFeatures: ['reduced-motion', 'special-activation'],
  },
  'rift-spread': {
    id: 'rift-spread',
    fixtureId: 'rift-spread',
    description: 'Deterministic Rift Hunger spread after an accepted move.',
    expectedAction: { kind: 'swap', ...ordinaryMove },
    expectedFeatures: ['rift-hunger', 'spread', 'threat-sync'],
  },
  'rift-cleanse': {
    id: 'rift-cleanse',
    fixtureId: 'rift-cleanse',
    description: 'Adjacent ordinary match cleanses non-source corruption.',
    expectedAction: { kind: 'swap', ...ordinaryMove },
    expectedFeatures: ['rift-hunger', 'cleanse', 'threat-sync'],
  },
  'rift-overwhelm': {
    id: 'rift-overwhelm',
    fixtureId: 'rift-overwhelm',
    description: 'Hunger maximum failure labels Rift Overwhelmed.',
    expectedAction: { kind: 'swap', ...ordinaryMove },
    expectedFeatures: ['rift-hunger', 'overwhelmed', 'threat-sync'],
  },
};

export function getBrowserScenario(id: string | null): BrowserScenarioDefinition | null {
  if (!id || !Object.hasOwn(scenarios, id)) return null;
  return scenarios[id as BrowserScenarioId];
}

export function getBrowserScenarios(): readonly BrowserScenarioDefinition[] {
  return Object.values(scenarios);
}
