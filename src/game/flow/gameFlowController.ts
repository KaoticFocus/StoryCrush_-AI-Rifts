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

function isValidGameFlowState(state: GameFlowState): boolean {
  if (!state || typeof state !== 'object') return false;
  if (typeof state.currentNodeId !== 'string') return false;
  if (!Array.isArray(state.storyFlags)) return false;
  if (!state.storyFlags.every((flag) => isValidStoryFlag(flag))) return false;
  if (typeof state.hasContinuableSession !== 'boolean') return false;
  if (!state.chapterStatus || typeof state.chapterStatus !== 'object') return false;
  if (state.latestPuzzleResult && typeof state.latestPuzzleResult === 'object') {
    const { outcome, score, movesRemaining, objectiveCompleted } = state.latestPuzzleResult;
    if (outcome !== 'won' && outcome !== 'failed') return false;
    if (typeof score !== 'number' || typeof movesRemaining !== 'number') return false;
    if (objectiveCompleted !== undefined && typeof objectiveCompleted !== 'boolean') return false;
  }
  if (state.latestPuzzleResult === null) {
    return true;
  }
  return true;
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
      if (!isValidGameFlowState(nextState)) {
        return cloneState(state);
      }
      state = cloneState(nextState);
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
