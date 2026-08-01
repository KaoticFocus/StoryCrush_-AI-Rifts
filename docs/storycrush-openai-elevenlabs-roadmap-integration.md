# StoryCrush: AI Rifts — OpenAI + ElevenLabs Roadmap Integration

Work directly in the existing GitHub Codespace for:

- Repository: `KaoticFocus/StoryCrush_-AI-Rifts`
- Base: updated `main` after PR #3 is reviewed and merged
- New branch: `docs/openai-elevenlabs-roadmap`

This is a documentation-only task. Do not implement API calls, Netlify functions, generated dialogue, runtime speech, sound effects, gameplay changes, or Fantasy art. Do not modify PR #3.

Mobile-first requirement: Design and verify phone portrait first, then phone landscape, tablet portrait/landscape, and desktop enhancement.

## Strategic Principle

Add this principle to the roadmap and architecture:

> Deterministic StoryCrush systems create the facts. OpenAI interprets those facts through character personality and memory. ElevenLabs performs the approved dialogue. Core progression must never depend on either API.

OpenAI and ElevenLabs must enhance the narrative layer without controlling:

- Board state
- Piece generation
- Swap validity
- Cascades
- Score
- Moves
- Objectives
- Win/failure
- Rewards
- Story flags
- Relationship arithmetic
- Rift rules
- Save truth
- Progression

## Immediate Priority

Make the roadmap state clearly that visible game development resumes before API integration:

1. Finish and merge Phase 2B.
2. Add fresh boards and multiple Fantasy levels.
3. Add varied objectives and data-driven level definitions.
4. Add deterministic choices, relationships, memories, and Rift mechanics.
5. Complete the Fantasy vertical slice.
6. Add ElevenLabs-authored character voice.
7. Add bounded OpenAI reactions only after the deterministic game and narrative systems are stable.

## Documentation to Review

Inspect:

```text
README.md
docs/roadmap.md
docs/architecture.md
docs/content-model.md
docs/known-issues.md
```

Preserve completed phase history and existing terminology.

Create:

```text
docs/ai-voice-roadmap.md
```

## Revised Roadmap

### Phase 3A — Gameplay Variety and Fresh Boards

Deliver:

- Fresh boards during ordinary play
- Explicit fixed seeds only for tests, diagnostics, replay, or seeded challenges
- Multiple Fantasy level configurations
- Different move limits and objectives
- Different allowed piece sets
- Multiple replayable levels
- Data-selected levels instead of one hardcoded prototype

No OpenAI or ElevenLabs work in this phase.

Exit gate: a player immediately sees meaningful gameplay variety while tests remain reproducible.

### Phase 3B — Data-Driven Content and Event Contracts

Deliver typed data for:

- Universes
- Chapters
- Levels
- Characters
- Dialogue
- Choices
- Rifts
- Objectives
- Destinations
- Voice-profile metadata
- Authored subtitles
- Fallback lines
- Event priorities
- AI-eligibility flags

Add deterministic narrative events such as:

```ts
interface NarrativeEvent {
  eventId: string;
  universeId: string;
  chapterId: string;
  characterId?: string;
  eventType:
    | 'choice_committed'
    | 'puzzle_started'
    | 'special_created'
    | 'cascade_completed'
    | 'moves_low'
    | 'puzzle_won'
    | 'puzzle_failed'
    | 'rift_activated'
    | 'relationship_threshold_crossed';
  facts: Record<string, string | number | boolean>;
}
```

These events prepare the game for future dialogue without calling an API.

### Phase 4 — Choices, Relationships, Consequences, and Semantic Memory

Deliver:

- Deterministic story flags
- Relationship values
- Choice prerequisites
- Consequence resolution
- One choice that visibly changes a later puzzle
- Semantic character memories stored in the save

Example:

```ts
interface CharacterMemoryEvent {
  id: string;
  characterId: string;
  type: 'player_exploited_rift_after_warning';
  relationshipDelta: number;
  chapterId: string;
  sourceEventId: string;
}
```

OpenAI must never become the memory database or save-state authority.

### Phase 5 — Rift System

Deliver:

- Deterministic Rift state machine
- Corruption spread
- Rule inversion
- Cross-universe intrusion
- Rift board transformations
- Rift objectives
- Rift narrative events and commentary triggers

No runtime AI dependency.

### Phase 6A — Fantasy Vertical Slice

Deliver:

- Three standard Fantasy levels
- One choice-driven variation
- One major corrupted-dragon Rift
- Fantasy characters and relationships
- Rune Circle mechanic
- Authored dialogue
- Authored subtitles
- Authored fallback gameplay reactions
- Voice-direction notes

The vertical slice must work without either API.

### Phase 6B — ElevenLabs Authored Voice Foundation

Introduce ElevenLabs before OpenAI-generated dialogue.

Initial scope:

- One major Fantasy character
- One approved voice
- Authored story dialogue
- Authored gameplay reactions
- Server-side TTS only
- Audio caching
- Subtitle-first playback
- Voice mute and volume controls
- Speech queue
- No overlapping major lines
- Priority and interruption rules
- Timeout handling
- Cost logging
- Mobile audio-unlock handling
- Fallback when TTS fails

Success criteria:

- One Fantasy chapter has voiced authored dialogue.
- Voice failure never blocks progress.
- Every spoken line has subtitles.
- The game remains fully playable with voice disabled.

ElevenLabs sound-effects generation may be used during development to create reviewed candidate assets. Do not call it live for routine match events.

### Phase 7 — Cyberpunk Vertical Slice

Deliver:

- Cyberpunk story scenes
- Three Cyberpunk levels
- Firewall-control mechanic
- Cyberpunk relationships and memories
- Cyberpunk voice profiles
- Authored voice support
- Clear voice contrast among Fantasy, Cyberpunk, and The Editor

### Phase 8 — Fantasy–Cyberpunk Convergence

Deliver:

- Combined mechanics
- Dual progress tracks
- Cross-universe reactions
- Deterministic convergence facts
- Speech priority for competing character events

### Phase 9 — Butterfly Tokens

Deliver deterministic rewards and spending. AI may describe rewards but can never grant, remove, or calculate them.

### Phase 10A — OpenAI Narrative Provider Foundation

Add an optional server-side OpenAI provider:

```text
Phaser client
  → Netlify narrative function
  → OpenAI Responses API
  → strict structured-output validation
  → approved narrative result
  → optional ElevenLabs speech function
  → cached or streamed audio
  → subtitle-first presentation
```

Deliver:

- Provider-neutral narrative interface
- Server-side credentials only
- Strict JSON-schema output
- Character prompt templates
- Approved fact and memory inputs
- Maximum line length
- Approved emotion, delivery, priority, and animation enums
- Timeout and retry policy
- Cache
- Rate limits
- Per-session and daily spending guards
- Authored fallback lines
- Emergency provider-disable switch
- Regression evaluations before model changes
- Zero progression dependency on AI

Suggested result:

```ts
interface GeneratedCharacterReaction {
  line: string;
  characterId: string;
  emotion:
    | 'calm'
    | 'concerned'
    | 'hopeful'
    | 'betrayed'
    | 'angry'
    | 'afraid'
    | 'amused'
    | 'threatening';
  delivery: 'neutral' | 'quiet' | 'urgent' | 'whisper' | 'commanding';
  priority: 'ambient' | 'normal' | 'important' | 'critical';
  animationCue:
    | 'none'
    | 'look_away'
    | 'lean_forward'
    | 'glitch'
    | 'rift_reaction';
}
```

Model output cannot directly alter mechanics or state.

### Phase 10B — One-Character Reactive Dialogue Proof

Initial runtime-AI milestone:

- One Fantasy character
- One ElevenLabs voice
- Five deterministic gameplay triggers
- Structured OpenAI output
- Subtitles
- Audio caching
- Speech priority
- Authored fallback for every trigger

Recommended triggers:

1. First rejected swap
2. First special created
3. Large cascade
4. Three moves remaining
5. Puzzle outcome

Exit gate:

- Reactions use actual gameplay facts.
- No invented mechanics appear.
- Failures never block progression.
- Latency and cost remain inside documented budgets.
- Repeated commentary is suppressed.

### Phase 10C — Dynamic Consequences and Character Memory

OpenAI may express deterministic:

- Story flags
- Relationship state
- Semantic memories
- Puzzle results
- Rift history

The deterministic consequence resolver decides what happened. OpenAI decides how an approved character expresses it.

Require authored critical-path fallback scenes and character-consistency evaluations.

### Phase 10D — Multi-Character Reactive Narrative

Only after the one-character proof is stable:

- Multiple voices
- Speech arbitration
- Interruption rules
- Conversation turn limits
- Cross-universe banter
- The Editor commentary
- Player-controlled reaction frequency

### Phase 10E — Optional Player Voice Experiment

Experimental and optional:

- Push-to-talk
- Visible microphone state
- Explicit permission and consent
- Speech transcription
- Bounded responses
- Privacy settings
- Text alternative
- Age-rating and abuse review
- Session limits

Do not schedule this until the game is compelling without it.

### Phase 11 — Narrative, Voice, and Evaluation Tools

Deliver:

- Character prompt editor
- Voice-profile editor
- Narrative-event simulator
- Memory inspector
- Structured-output validator
- Evaluation fixtures
- Character-consistency evaluations
- Cost reports
- Cache inspector
- Subtitle review
- Audio approval workflow
- Fallback coverage report

## Architecture Rules

Update `docs/architecture.md` and the new AI/voice document with:

### Deterministic authority

AI output is presentation content, never authoritative state.

### Server-only credentials

OpenAI and ElevenLabs keys exist only in server or Netlify environment variables.

### Provider isolation

```ts
interface NarrativeProvider {
  generateReaction(input: NarrativeContext): Promise<NarrativeProviderResult>;
}

interface SpeechProvider {
  synthesize(input: SpeechRequest): Promise<SpeechProviderResult>;
}
```

Scenes must not contain provider-specific request code.

### Structured validation

Every OpenAI result must pass strict runtime schema validation.

### Progression independence

The game works when:

- OpenAI is unavailable
- ElevenLabs is unavailable
- Both are unavailable
- Voice is disabled
- Generated reactions are disabled
- A request times out
- A budget limit is reached

### Subtitle-first presentation

Every spoken line has visible text.

### Speech arbitration

Only one major line plays at a time unless an authored overlap is approved.

### Caching

Cache by approved text, voice ID, voice settings, language, provider version, and content version.

### Privacy and safety

- Send only minimal narrative facts.
- Never send raw save files.
- Avoid unnecessary personal data.
- Document retention assumptions.
- Include moderation and age-rating review where appropriate.
- Give players controls for voice and generated dialogue.

### Cost controls

- Per-line limit
- Per-session limit
- Daily project limit
- Cache-first behavior
- Repeated-trigger suppression
- Request telemetry
- Emergency provider shutdown

## Dialogue Trigger Policy

Document three classes:

### Critical authored dialogue

Major choices, chapter openings/endings, tutorials, and essential consequences. Authored text always exists. OpenAI is never required.

### Contextual generated dialogue

Large cascades, low moves, Rift use, relationship callbacks, and repeated behavior. OpenAI may generate bounded expression, but authored fallback always exists.

### Ambient commentary

Minor praise and banter. Lowest priority, aggressively rate-limited, and player-adjustable.

## Mobile and Accessibility Requirements

Add:

- Voice must not cover board controls.
- Handle mobile audio-unlock requirements.
- Subtitles are designed for phone portrait first.
- Subtitles cannot cover objectives, moves, or critical board rows.
- Generated lines do not pause active play unless the scene is intentionally cinematic.
- Separate controls exist for voices, sound effects, and music.
- Commentary frequency is adjustable.
- Captions remain when audio fails.
- Speech queues clear on scene change, restart, pause, and browser backgrounding.

Mobile-first requirement: Design and verify phone portrait first, then phone landscape, tablet portrait/landscape, and desktop enhancement.

## Revised Issue Order

Update the recommended order to:

1. Finish and merge Phase 2B
2. Fresh-board gameplay variety
3. Multiple Fantasy levels
4. Data-driven content schemas
5. Narrative-event contracts
6. Story choices
7. Relationships and semantic memories
8. Rift state machine
9. Fantasy level set
10. Fantasy vertical slice
11. Authored subtitle coverage
12. ElevenLabs provider interface
13. One-character authored voice proof
14. Cyberpunk vertical slice
15. Convergence event
16. Butterfly Tokens
17. OpenAI provider interface
18. Structured narrative-response schema
19. One-character reactive dialogue proof
20. Dynamic consequence scenes
21. Multi-character speech arbitration
22. AI/voice authoring and evaluation tools
23. Optional player-voice experiment
24. Closed-beta hardening

State explicitly that API integration cannot delay fresh boards, multiple levels, choices, Rifts, or the Fantasy vertical slice.

## Scope Boundaries

Explicitly defer or prohibit:

- AI-controlled board generation
- AI-controlled scoring or rewards
- AI-controlled relationship arithmetic
- AI-generated mechanics
- Unbounded character chat
- Always-listening microphone behavior
- Voice cloning without rights and consent
- Live sound-effect calls for ordinary matches
- AI dependency for tutorials or critical story facts
- Cloud memory as save authority
- Generated speech without subtitles
- Client-side production API keys

## Files to Update

Update:

```text
docs/roadmap.md
docs/architecture.md
docs/content-model.md
docs/known-issues.md
```

Create:

```text
docs/ai-voice-roadmap.md
```

Optionally add one concise link in `README.md`.

## Verification

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Confirm no gameplay, persistence, API, or asset code changed.

## Commit and Draft PR

Commit:

```text
docs: integrate OpenAI and ElevenLabs roadmap
```

Push:

```bash
git push -u origin docs/openai-elevenlabs-roadmap
```

Open a draft PR into `main`.

Title:

```text
Roadmap: OpenAI narrative and ElevenLabs character voice
```

Do not merge.

## Final Report

Return:

- Starting main SHA
- Branch
- Commit SHA
- Draft PR number and URL
- Files created and updated
- Revised phase sequence
- ElevenLabs entry phase
- OpenAI entry phase
- First reactive-dialogue proof
- Deterministic-authority rules
- Fallback policy
- Mobile/accessibility policy
- Cost and privacy controls
- Verification results
- Known limitations
- Confirmation that no API or gameplay code was implemented
- Confirmation that PR #3 was not modified
