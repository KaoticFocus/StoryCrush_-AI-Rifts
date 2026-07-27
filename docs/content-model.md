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

- No runtime schema implementation exists yet.
- This document is the contract target for Phase 3 implementation.
