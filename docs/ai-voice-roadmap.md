# AI and Character Voice Roadmap

## Guiding Principle

Deterministic StoryCrush systems create the facts. OpenAI interprets those facts through character personality and memory. ElevenLabs performs the approved dialogue. Core progression must never depend on either API.

## Product Order

### Gameplay-first order

1. Finish and merge Phase 2B.
2. Add fresh boards and multiple Fantasy levels.
3. Add varied objectives and data-driven level definitions.
4. Add deterministic choices, relationships, memories, and Rift mechanics.
5. Complete the Fantasy vertical slice.
6. Add ElevenLabs-authored character voice.
7. Add bounded OpenAI reactions only after the deterministic game and narrative systems are stable.

## Deterministic Authority

StoryCrush gameplay remains authoritative in the deterministic engine. AI features are presentation overlays only.

The game must continue to function when:

- OpenAI is unavailable.
- ElevenLabs is unavailable.
- Both are unavailable.
- Voice is disabled.
- Generated reactions are disabled.
- A request times out.
- A budget limit is reached.

## Scope Boundaries

The following remain explicitly out of scope for this roadmap phase:

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

## Phase Sequence

### Phase 3A — Gameplay Variety and Fresh Boards

Deliver fresh boards during ordinary play, explicit fixed seeds only for tests or diagnostics, multiple Fantasy level configurations, and data-selected levels instead of one hardcoded prototype.

### Phase 3B — Data-Driven Content and Event Contracts

Deliver typed data for universes, chapters, levels, characters, dialogue, choices, Rifts, objectives, destinations, voice-profile metadata, authored subtitles, fallback lines, event priorities, and AI-eligibility flags.

### Phase 4 — Choices, Relationships, Consequences, and Semantic Memory

Deliver deterministic story flags, relationship values, choice prerequisites, consequence resolution, visible choice-driven puzzle changes, and semantic character memories stored in the save. OpenAI never becomes the memory database or save-state authority.

### Phase 5 — Rift System

Deliver the deterministic Rift state machine, corruption spread, rule inversion, cross-universe intrusion, Rift board transformations, Rift objectives, and Rift narrative events.

### Phase 6A — Fantasy Vertical Slice

Deliver three standard Fantasy levels, one choice-driven variation, one major corrupted-dragon Rift, authored dialogue and subtitles, and voice-direction notes. The vertical slice works without either API.

### Phase 6B — ElevenLabs Authored Voice Foundation

Introduce ElevenLabs before OpenAI-generated dialogue. Initial scope includes one major Fantasy character, one approved voice, authored story dialogue, authored gameplay reactions, server-side TTS only, audio caching, subtitle-first playback, voice mute and volume controls, speech queueing, and fallback handling.

### Phase 7 — Cyberpunk Vertical Slice

Deliver Cyberpunk story scenes, levels, relationships, memories, voice profiles, and authored speech support.

### Phase 8 — Fantasy–Cyberpunk Convergence

Deliver combined mechanics, dual progress tracks, cross-universe reactions, deterministic convergence facts, and speech priority for competing character events.

### Phase 9 — Butterfly Tokens

Deliver deterministic rewards and spending. AI may describe rewards but can never grant, remove, or calculate them.

### Phase 10A — OpenAI Narrative Provider Foundation

Add an optional server-side OpenAI provider behind a provider-neutral narrative interface. Strict structured-output validation, server-side credentials only, character prompt templates, approved fact and memory inputs, timeout and retry policies, cost guards, fallback lines, and provider-disable controls are required.

### Phase 10B — One-Character Reactive Dialogue Proof

Deliver one Fantasy character, one ElevenLabs voice, five deterministic gameplay triggers, structured OpenAI output, subtitles, audio caching, speech priority, and authored fallback for each trigger.

### Phase 10C — Dynamic Consequences and Character Memory

OpenAI may express deterministic story flags, relationship state, semantic memories, puzzle results, and Rift history, while the deterministic consequence resolver decides what happened.

### Phase 10D — Multi-Character Reactive Narrative

Only after the one-character proof is stable, add multiple voices, speech arbitration, interruption rules, conversation turn limits, cross-universe banter, and The Editor commentary.

### Phase 10E — Optional Player Voice Experiment

Optional and experimental only, after the core game is compelling without it.

### Phase 11 — Narrative, Voice, and Evaluation Tools

Deliver prompt editing, voice-profile editing, narrative-event simulation, memory inspection, structured-output validation, evaluation fixtures, cost reporting, cache inspection, subtitle review, audio approval workflows, and fallback-coverage reporting.

## Architecture Rules

### Provider isolation

Scenes must not contain provider-specific request code. Narrative and speech providers are called through isolated interfaces.

### Structured validation

Every OpenAI result must pass strict runtime schema validation before it can influence presentation.

### Subtitle-first presentation

Every spoken line has visible text. Voice failure never blocks progression.

### Speech arbitration

Only one major line plays at a time unless an authored overlap is approved.

### Caching

Cache by approved text, voice ID, voice settings, language, provider version, and content version.

### Privacy and safety

Send only minimal narrative facts, avoid raw save files, document retention assumptions, and include moderation and age-rating review where appropriate.

### Cost controls

Per-line, per-session, and daily project limits, cache-first behavior, repeated-trigger suppression, request telemetry, and emergency provider shutdown are required.

## Dialogue Trigger Policy

### Critical authored dialogue

Major choices, chapter openings and endings, tutorials, and essential consequences. Authored text always exists. OpenAI is never required.

### Contextual generated dialogue

Large cascades, low moves, Rift use, relationship callbacks, and repeated behavior. OpenAI may generate bounded expression, but authored fallback always exists.

### Ambient commentary

Minor praise and banter. Lowest priority, aggressively rate-limited, and player-adjustable.

## Mobile and Accessibility Requirements

- Voice must not cover board controls.
- Mobile audio-unlock handling is required.
- Subtitles are designed for phone portrait first.
- Subtitles cannot cover objectives, moves, or critical board rows.
- Generated lines do not pause active play unless the scene is intentionally cinematic.
- Separate controls exist for voices, sound effects, and music.
- Commentary frequency is adjustable.
- Captions remain when audio fails.
- Speech queues clear on scene change, restart, pause, and browser backgrounding.
