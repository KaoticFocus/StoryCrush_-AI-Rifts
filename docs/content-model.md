# Content Model (Phase 0 Draft)

## Purpose

Define content as structured data so levels, chapters, and consequences do not require core-engine code changes.

## Primary Entity Types

- Universe
- Chapter
- StoryNode
- DialogueLine
- Choice
- Character
- RelationshipRule
- Level
- PieceType
- Objective
- Hazard
- Reward
- RiftModifier
- ParallelChapterLink
- ConvergenceEvent
- Ending

## ID and Reference Rules

- Every entity must use a globally unique string ID.
- References must point to existing IDs only.
- Cycles allowed only where explicitly supported (for branch rejoin).
- Duplicate IDs are validation errors.

## Core Level Fields (Minimum)

- id
- universeId
- board: width, height, allowedPieceIds
- moveLimit
- objectives[]
- specialPieceRules[]
- hazards[]
- backgroundAssetId
- musicAssetId
- requiredFlags[]
- awardedFlags[]
- rift: probability or scriptedTrigger
- successNodeId
- failureNodeId

## Core Choice Fields (Minimum)

- id
- sourceStoryNodeId
- text
- prerequisites[]
- flagChanges[]
- relationshipChanges[]
- immediateDialogueNodeId
- deferredConsequences[]

## Core Rift Fields (Minimum)

- id
- trigger
- warningSequence
- corruptionVisualProfile
- ruleModifierId
- corruptedPieceIds[]
- riftObjective
- aiMessageKeyOrFallbackText
- successConsequences[]
- failureConsequences[]
- branchDestinationIds

## Validation Requirements

Validator must detect:

- Missing references
- Invalid character IDs
- Broken chapter/story links
- Impossible objective definitions
- Missing assets
- Duplicate IDs
- Unreachable story nodes

## Phase 0 Notes

- A lightweight runtime flow-content model exists for Phase 2A narrative nodes,
  choice flags, consequence outcomes, and persisted chapter state.
- Persistence now uses a schema-versioned envelope with strict validation for
  narrative state, resume resolution, and safe recovery paths.
- This document remains the long-term contract target for a fuller schema system.

## AI and Voice Content Extensions

The content model should eventually capture:

- narrative event contracts for authored and provider-generated dialogue
- provider eligibility flags and fallback content
- voice profile metadata, subtitles, and authored audio notes
- cost and policy metadata for speech and narrative requests
- deterministic memory and relationship state that remains separate from provider outputs

These fields must remain optional and must never replace the deterministic progression contract.
