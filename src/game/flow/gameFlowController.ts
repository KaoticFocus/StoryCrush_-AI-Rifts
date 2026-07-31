export type GameFlowNodeId =
  | 'main-menu'
  | 'multiverse-map'
  | 'fantasy-chapter-intro'
  | 'fantasy-dialogue'
  | 'fantasy-choice'
  | 'puzzle'
  | 'results'
  | 'fantasy-consequence'
  | 'return-to-map';

export const VALID_GAME_FLOW_NODE_IDS: readonly GameFlowNodeId[] = [
  'main-menu',
  'multiverse-map',
  'fantasy-chapter-intro',
  'fantasy-dialogue',
  'fantasy-choice',
  'puzzle',
  'results',
  'fantasy-consequence',
  'return-to-map',
];

export type StoryFlag = 'FANTASY_ARCHIVE_STABILIZED' | 'FANTASY_FRACTURE_EXPLOITED';

export type PuzzleOutcome = 'won' | 'failed';

export interface StoryChoice {
  id: string;
  label: string;
  flag: StoryFlag;
}

export interface StoryNode {
  id: GameFlowNodeId;
  kind:
    'menu' | 'map' | 'chapter-intro' | 'dialogue' | 'choice' | 'puzzle' | 'results' | 'consequence';
  title: string;
  description?: string;
}

export interface StoryChoiceResult {
  ok: boolean;
  state: GameFlowState;
  reason?: 'invalid-transition' | 'choice-already-committed' | 'invalid-choice';
}

export interface ChapterDefinition {
  id: string;
  title: string;
  universeId: string;
  introNodeId: GameFlowNodeId;
  dialogueNodeId: GameFlowNodeId;
  choiceNodeId: GameFlowNodeId;
  puzzleNodeId: GameFlowNodeId;
  resultsNodeId: GameFlowNodeId;
  consequenceNodeId: GameFlowNodeId;
  availableChoices: readonly StoryChoice[];
}

export interface PrototypeCampaignDefinition {
  chapters: readonly ChapterDefinition[];
}

export interface PuzzleResultRecord {
  outcome: PuzzleOutcome;
  score: number;
  movesRemaining: number;
  objectiveCompleted?: boolean;
}

export interface ChapterStatusRecord {
  status: 'available' | 'in-progress' | 'completed';
  lastOutcome?: PuzzleOutcome;
}

export interface GameFlowState {
  currentNodeId: GameFlowNodeId;
  storyFlags: readonly StoryFlag[];
  chapterStatus: Record<string, ChapterStatusRecord>;
  latestPuzzleResult: PuzzleResultRecord | null;
  hasContinuableSession: boolean;
}

export interface GameFlowController {
  getState(): GameFlowState;
  advanceTo(nodeId: GameFlowNodeId): StoryChoiceResult;
  chooseStoryOption(choiceId: string): StoryChoiceResult;
  recordPuzzleResult(result: PuzzleResultRecord): GameFlowState;
  getConsequenceNode(): GameFlowNodeId | null;
  resetProgress(): GameFlowState;
  restoreState(state: GameFlowState): GameFlowState;
}

let sharedGameFlowController: GameFlowController | null = null;
let stateChangeHandler: ((state: GameFlowState) => void) | null = null;

export function setGameFlowStateChangeHandler(
  handler: ((state: GameFlowState) => void) | null,
): void {
  stateChangeHandler = handler;
}

function notifyStateChanged(state: GameFlowState): void {
  stateChangeHandler?.(state);
}

export function createInitialGameFlowState(): GameFlowState {
  return {
    currentNodeId: 'main-menu',
    storyFlags: [],
    chapterStatus: {},
    latestPuzzleResult: null,
    hasContinuableSession: false,
  };
}

export function createPrototypeCampaignDefinition(): PrototypeCampaignDefinition {
  return {
    chapters: [
      {
        id: 'fantasy-chapter',
        title: 'The Archive Fracture',
        universeId: 'fantasy',
        introNodeId: 'fantasy-chapter-intro',
        dialogueNodeId: 'fantasy-dialogue',
        choiceNodeId: 'fantasy-choice',
        puzzleNodeId: 'puzzle',
        resultsNodeId: 'results',
        consequenceNodeId: 'fantasy-consequence',
        availableChoices: [
          {
            id: 'fantasy-stabilize',
            label: 'Stabilize the archive',
            flag: 'FANTASY_ARCHIVE_STABILIZED',
          },
          {
            id: 'fantasy-exploit',
            label: 'Draw power from the fracture',
            flag: 'FANTASY_FRACTURE_EXPLOITED',
          },
        ],
      },
    ],
  };
}

function cloneState(state: GameFlowState): GameFlowState {
  return {
    ...state,
    storyFlags: [...state.storyFlags],
    chapterStatus: Object.fromEntries(
      Object.entries(state.chapterStatus).map(([id, status]) => [id, { ...status }]),
    ),
    latestPuzzleResult: state.latestPuzzleResult ? { ...state.latestPuzzleResult } : null,
  };
}

function isValidStoryFlag(flag: unknown): flag is StoryFlag {
  return flag === 'FANTASY_ARCHIVE_STABILIZED' || flag === 'FANTASY_FRACTURE_EXPLOITED';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasUnsafeKeys(value: Record<string, unknown>): boolean {
  return ['__proto__', 'constructor', 'prototype'].some((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  );
}

function getValidNodeIds(definition: PrototypeCampaignDefinition): Set<GameFlowNodeId> {
  const baseNodes: readonly GameFlowNodeId[] = [
    'main-menu',
    'multiverse-map',
    'fantasy-chapter-intro',
    'fantasy-dialogue',
    'fantasy-choice',
    'puzzle',
    'results',
    'fantasy-consequence',
    'return-to-map',
  ];
  const chapterNodes = definition.chapters.flatMap((chapter) => [
    chapter.introNodeId,
    chapter.dialogueNodeId,
    chapter.choiceNodeId,
    chapter.puzzleNodeId,
    chapter.resultsNodeId,
    chapter.consequenceNodeId,
  ]);

  return new Set<GameFlowNodeId>([...baseNodes, ...chapterNodes]);
}

function isValidChapterStatusRecord(value: unknown): value is ChapterStatusRecord {
  if (!isPlainObject(value) || hasUnsafeKeys(value)) {
    return false;
  }
  const status = value.status;
  if (typeof status !== 'string') {
    return false;
  }
  if (status !== 'available' && status !== 'in-progress' && status !== 'completed') {
    return false;
  }
  if (
    value.lastOutcome !== undefined &&
    value.lastOutcome !== 'won' &&
    value.lastOutcome !== 'failed'
  ) {
    return false;
  }
  return true;
}

function isValidPuzzleResultRecord(value: unknown): value is PuzzleResultRecord {
  if (!isPlainObject(value) || hasUnsafeKeys(value)) {
    return false;
  }
  const { outcome, score, movesRemaining, objectiveCompleted } = value;
  if (outcome !== 'won' && outcome !== 'failed') {
    return false;
  }
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    return false;
  }
  if (
    typeof movesRemaining !== 'number' ||
    !Number.isFinite(movesRemaining) ||
    movesRemaining < 0
  ) {
    return false;
  }
  if (objectiveCompleted !== undefined && typeof objectiveCompleted !== 'boolean') {
    return false;
  }
  return true;
}

function isValidStoryFlagList(storyFlags: unknown): storyFlags is readonly StoryFlag[] {
  return (
    Array.isArray(storyFlags) &&
    storyFlags.every((flag) => isValidStoryFlag(flag)) &&
    new Set(storyFlags).size === storyFlags.length
  );
}

function createResumeFallbackState(state: GameFlowState): GameFlowState {
  const storyFlags = isValidStoryFlagList(state.storyFlags) ? [...state.storyFlags] : [];
  const chapterStatus = isValidChapterStatusMap(state.chapterStatus)
    ? Object.fromEntries(
        Object.entries(state.chapterStatus).map(([id, chapter]) => [id, { ...chapter }]),
      )
    : {};

  return {
    currentNodeId: 'main-menu',
    storyFlags,
    chapterStatus,
    latestPuzzleResult: null,
    hasContinuableSession: false,
  };
}

function isValidChapterStatusMap(value: unknown): value is Record<string, ChapterStatusRecord> {
  if (!isPlainObject(value) || hasUnsafeKeys(value)) {
    return false;
  }
  return Object.entries(value).every(([id, entry]) => {
    if (typeof id !== 'string' || id.length === 0) {
      return false;
    }
    return isValidChapterStatusRecord(entry);
  });
}

function deriveHasContinuableSession(
  currentNodeId: GameFlowNodeId,
  latestPuzzleResult: PuzzleResultRecord | null,
  storyFlags: readonly StoryFlag[],
): boolean {
  if (currentNodeId === 'main-menu' || currentNodeId === 'fantasy-consequence') {
    return false;
  }
  if (currentNodeId === 'puzzle') {
    return storyFlags.length === 1;
  }
  return Boolean(latestPuzzleResult && storyFlags.length === 1);
}

export interface GameFlowValidationResult {
  ok: boolean;
  state: GameFlowState | null;
}

export interface GameFlowResumeResolution {
  requestedNodeId: GameFlowNodeId;
  resolvedNodeId: GameFlowNodeId;
  reason:
    'map' | 'intro' | 'dialogue' | 'choice' | 'puzzle' | 'results' | 'consequence' | 'recovered';
  state: GameFlowState;
}

export function validateAndNormalizeGameFlowState(
  state: GameFlowState,
  definition: PrototypeCampaignDefinition,
): GameFlowValidationResult {
  if (!isPlainObject(state) || hasUnsafeKeys(state as Record<string, unknown>)) {
    return { ok: false, state: null };
  }

  const validNodeIds = getValidNodeIds(definition);
  if (
    typeof state.currentNodeId !== 'string' ||
    !validNodeIds.has(state.currentNodeId as GameFlowNodeId)
  ) {
    return { ok: false, state: null };
  }
  if (!isValidStoryFlagList(state.storyFlags)) {
    return { ok: false, state: null };
  }
  if (new Set(state.storyFlags).size !== state.storyFlags.length) {
    return { ok: false, state: null };
  }
  if (
    state.storyFlags.includes('FANTASY_ARCHIVE_STABILIZED') &&
    state.storyFlags.includes('FANTASY_FRACTURE_EXPLOITED')
  ) {
    return { ok: false, state: null };
  }
  if (typeof state.hasContinuableSession !== 'boolean') {
    return { ok: false, state: null };
  }
  if (!isValidChapterStatusMap(state.chapterStatus)) {
    return { ok: false, state: null };
  }
  if (state.latestPuzzleResult !== null && !isValidPuzzleResultRecord(state.latestPuzzleResult)) {
    return { ok: false, state: null };
  }

  const currentNodeId = state.currentNodeId as GameFlowNodeId;
  const storyFlags = [...state.storyFlags];
  const chapterStatus = Object.fromEntries(
    Object.entries(state.chapterStatus).map(([id, chapter]) => [id, { ...chapter }]),
  );
  const latestPuzzleResult = state.latestPuzzleResult ? { ...state.latestPuzzleResult } : null;

  const hasContinuableSession = deriveHasContinuableSession(
    currentNodeId,
    latestPuzzleResult,
    storyFlags,
  );

  if (currentNodeId === 'puzzle') {
    if (storyFlags.length !== 1 || latestPuzzleResult !== null) {
      return { ok: false, state: null };
    }
  }
  if (currentNodeId === 'results') {
    if (!latestPuzzleResult || storyFlags.length !== 1) {
      return { ok: false, state: null };
    }
  }
  if (currentNodeId === 'fantasy-consequence') {
    if (!latestPuzzleResult || storyFlags.length !== 1) {
      return { ok: false, state: null };
    }
  }
  if (currentNodeId === 'fantasy-choice' && storyFlags.length > 1) {
    return { ok: false, state: null };
  }

  return {
    ok: true,
    state: {
      currentNodeId,
      storyFlags,
      chapterStatus,
      latestPuzzleResult,
      hasContinuableSession,
    },
  };
}

export function resolveGameFlowResumeState(
  requestedNodeId: GameFlowNodeId,
  state: GameFlowState,
  definition: PrototypeCampaignDefinition,
): GameFlowResumeResolution {
  const validated = validateAndNormalizeGameFlowState(state, definition);
  const normalizedState =
    validated.ok && validated.state ? validated.state : createResumeFallbackState(state);

  const requested = requestedNodeId === 'main-menu' ? 'main-menu' : requestedNodeId;
  if (requested === 'multiverse-map' || requested === 'return-to-map') {
    return {
      requestedNodeId: requested,
      resolvedNodeId: 'multiverse-map',
      reason: 'map',
      state: { ...normalizedState, currentNodeId: 'multiverse-map' },
    };
  }
  if (requested === 'fantasy-chapter-intro') {
    return {
      requestedNodeId: requested,
      resolvedNodeId: 'fantasy-chapter-intro',
      reason: 'intro',
      state: { ...normalizedState, currentNodeId: 'fantasy-chapter-intro' },
    };
  }
  if (requested === 'fantasy-dialogue') {
    return {
      requestedNodeId: requested,
      resolvedNodeId: 'fantasy-dialogue',
      reason: 'dialogue',
      state: { ...normalizedState, currentNodeId: 'fantasy-dialogue' },
    };
  }
  if (requested === 'fantasy-choice') {
    if (normalizedState.storyFlags.length === 0) {
      return {
        requestedNodeId: requested,
        resolvedNodeId: 'fantasy-choice',
        reason: 'choice',
        state: { ...normalizedState, currentNodeId: 'fantasy-choice' },
      };
    }
    return {
      requestedNodeId: requested,
      resolvedNodeId: 'puzzle',
      reason: 'puzzle',
      state: {
        ...normalizedState,
        currentNodeId: 'puzzle',
        latestPuzzleResult: null,
        hasContinuableSession: true,
      },
    };
  }
  if (requested === 'puzzle') {
    if (normalizedState.storyFlags.length !== 1) {
      return {
        requestedNodeId: requested,
        resolvedNodeId: 'fantasy-choice',
        reason: 'choice',
        state: { ...normalizedState, currentNodeId: 'fantasy-choice' },
      };
    }
    return {
      requestedNodeId: requested,
      resolvedNodeId: 'puzzle',
      reason: 'puzzle',
      state: {
        ...normalizedState,
        currentNodeId: 'puzzle',
        latestPuzzleResult: null,
        hasContinuableSession: true,
      },
    };
  }
  if (requested === 'results') {
    if (normalizedState.latestPuzzleResult && normalizedState.storyFlags.length === 1) {
      return {
        requestedNodeId: requested,
        resolvedNodeId: 'results',
        reason: 'results',
        state: normalizedState,
      };
    }
    return {
      requestedNodeId: requested,
      resolvedNodeId: 'main-menu',
      reason: 'recovered',
      state: createInitialGameFlowState(),
    };
  }
  if (requested === 'fantasy-consequence') {
    if (normalizedState.latestPuzzleResult && normalizedState.storyFlags.length === 1) {
      return {
        requestedNodeId: requested,
        resolvedNodeId: 'fantasy-consequence',
        reason: 'consequence',
        state: normalizedState,
      };
    }
    return {
      requestedNodeId: requested,
      resolvedNodeId: 'main-menu',
      reason: 'recovered',
      state: createInitialGameFlowState(),
    };
  }
  return {
    requestedNodeId: requested,
    resolvedNodeId: 'main-menu',
    reason: 'recovered',
    state: createInitialGameFlowState(),
  };
}

function getNodeMap(definition: PrototypeCampaignDefinition): Map<GameFlowNodeId, StoryNode> {
  const baseNodes: readonly StoryNode[] = [
    { id: 'main-menu', kind: 'menu', title: 'Main Menu' },
    { id: 'multiverse-map', kind: 'map', title: 'Multiverse Map' },
    { id: 'fantasy-chapter-intro', kind: 'chapter-intro', title: 'Chapter Introduction' },
    { id: 'fantasy-dialogue', kind: 'dialogue', title: 'Dialogue' },
    { id: 'fantasy-choice', kind: 'choice', title: 'Story Choice' },
    { id: 'puzzle', kind: 'puzzle', title: 'Puzzle' },
    { id: 'results', kind: 'results', title: 'Results' },
    { id: 'fantasy-consequence', kind: 'consequence', title: 'Consequence' },
    { id: 'return-to-map', kind: 'map', title: 'Return to Map' },
  ];
  const nodes = new Map<GameFlowNodeId, StoryNode>(
    baseNodes.map((node): [GameFlowNodeId, StoryNode] => [node.id as GameFlowNodeId, node]),
  );

  const chapter = definition.chapters[0];
  if (chapter) {
    nodes.set(chapter.introNodeId, {
      id: chapter.introNodeId,
      kind: 'chapter-intro',
      title: chapter.title,
      description: 'A magical archive has detected an unstable memory fracture.',
    });
    nodes.set(chapter.dialogueNodeId, {
      id: chapter.dialogueNodeId,
      kind: 'dialogue',
      title: 'The Archive Speaks',
      description: 'The archive whispers a warning about the fracture.',
    });
    nodes.set(chapter.choiceNodeId, {
      id: chapter.choiceNodeId,
      kind: 'choice',
      title: 'Choose a response',
      description: 'Choose how to respond to the fracture.',
    });
  }
  return nodes;
}

export function createGameFlowController(
  definition: PrototypeCampaignDefinition = createPrototypeCampaignDefinition(),
): GameFlowController {
  const nodes = getNodeMap(definition);
  let state = createInitialGameFlowState();

  return {
    getState(): GameFlowState {
      return cloneState(state);
    },
    advanceTo(nodeId: GameFlowNodeId): StoryChoiceResult {
      const node = nodes.get(nodeId);
      if (!node) {
        return { ok: false, state: cloneState(state), reason: 'invalid-transition' };
      }

      const allowedTransitions: Record<GameFlowNodeId, readonly GameFlowNodeId[]> = {
        'main-menu': ['multiverse-map', 'puzzle'],
        'multiverse-map': ['fantasy-chapter-intro', 'main-menu'],
        'fantasy-chapter-intro': ['fantasy-dialogue', 'main-menu'],
        'fantasy-dialogue': ['fantasy-choice', 'main-menu'],
        'fantasy-choice': ['puzzle', 'main-menu'],
        puzzle: ['results', 'multiverse-map'],
        results: ['fantasy-consequence'],
        'fantasy-consequence': ['return-to-map', 'multiverse-map'],
        'return-to-map': ['multiverse-map', 'main-menu'],
      };

      const nextNodes = allowedTransitions[state.currentNodeId] ?? [];
      if (!nextNodes.includes(nodeId)) {
        return { ok: false, state: cloneState(state), reason: 'invalid-transition' };
      }

      if (
        state.currentNodeId === 'fantasy-choice' &&
        nodeId === 'puzzle' &&
        state.storyFlags.length === 0
      ) {
        return { ok: false, state: cloneState(state), reason: 'invalid-transition' };
      }

      const nextState = cloneState(state);
      nextState.currentNodeId = nodeId;
      if (nodeId === 'fantasy-chapter-intro') {
        nextState.chapterStatus[definition.chapters[0]?.id ?? 'fantasy-chapter'] = {
          status: 'in-progress',
        };
      }
      if (nodeId === 'fantasy-consequence') {
        nextState.hasContinuableSession = false;
      }
      state = nextState;
      notifyStateChanged(cloneState(state));
      return { ok: true, state: cloneState(state) };
    },
    chooseStoryOption(choiceId: string): StoryChoiceResult {
      const chapter = definition.chapters[0];
      const isChoiceContext =
        state.currentNodeId === 'fantasy-choice' || state.currentNodeId === 'fantasy-dialogue';
      if (!chapter || !isChoiceContext) {
        return { ok: false, state: cloneState(state), reason: 'invalid-choice' };
      }

      const choice = chapter.availableChoices.find((entry) => entry.id === choiceId);
      if (!choice) {
        return { ok: false, state: cloneState(state), reason: 'invalid-choice' };
      }

      if (state.storyFlags.includes(choice.flag) || state.storyFlags.length > 0) {
        return { ok: false, state: cloneState(state), reason: 'choice-already-committed' };
      }

      const nextState = cloneState(state);
      nextState.storyFlags = [choice.flag];
      state = nextState;
      notifyStateChanged(cloneState(state));
      return { ok: true, state: cloneState(state) };
    },
    recordPuzzleResult(result: PuzzleResultRecord): GameFlowState {
      const nextState = cloneState(state);
      nextState.latestPuzzleResult = result;
      nextState.hasContinuableSession = true;
      const chapterId = definition.chapters[0]?.id ?? 'fantasy-chapter';
      nextState.chapterStatus[chapterId] = {
        status: 'completed',
        lastOutcome: result.outcome,
      };
      state = nextState;
      notifyStateChanged(cloneState(state));
      return cloneState(state);
    },
    getConsequenceNode(): GameFlowNodeId | null {
      const chapter = definition.chapters[0];
      if (!chapter) return null;
      const latest = state.latestPuzzleResult;
      if (!latest) return null;
      if (state.storyFlags.includes('FANTASY_ARCHIVE_STABILIZED')) {
        return latest.outcome === 'won' ? 'fantasy-consequence' : 'fantasy-consequence';
      }
      return 'fantasy-consequence';
    },
    resetProgress(): GameFlowState {
      state = createInitialGameFlowState();
      notifyStateChanged(cloneState(state));
      return cloneState(state);
    },
    restoreState(nextState: GameFlowState): GameFlowState {
      const validation = validateAndNormalizeGameFlowState(nextState, definition);
      if (!validation.ok || !validation.state) {
        return cloneState(state);
      }
      state = cloneState(validation.state);
      notifyStateChanged(cloneState(state));
      return cloneState(state);
    },
  };
}

export function getSharedGameFlowController(
  definition: PrototypeCampaignDefinition = createPrototypeCampaignDefinition(),
): GameFlowController {
  if (!sharedGameFlowController) {
    sharedGameFlowController = createGameFlowController(definition);
  }
  return sharedGameFlowController;
}
