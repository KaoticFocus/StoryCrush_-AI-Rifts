# Persistence and Save/Resume

## Storage contract

StoryCrush stores narrative-flow progress under the browser storage key `storycrush.game-flow`.

The active persisted envelope is schema version 2:

```ts
interface PersistedGameFlowEnvelopeV2 {
  schemaVersion: 2;
  savedAtEpochMs: number;
  state: GameFlowState;
}
```

## Migration and compatibility

- Version 1 payloads are read and migrated to schema 2 on the next successful restore.
- The repository preserves version 2 payloads as-is after validation.
- Unknown future versions are not overwritten automatically; the app surfaces an unsupported-version status and preserves the raw payload.
- Corrupt JSON or structurally invalid state is treated as a corrupt save and reset safely.

## Validation rules

The repository and controller restore path share one strict validator. It rejects:

- unknown node IDs
- unknown story flags
- duplicate story flags
- mutually exclusive story-choice flags
- chapter-status records with invalid values
- negative, NaN, Infinity, and numeric-string puzzle results
- incoherent state combinations such as puzzle/results/consequence without a valid choice/result pair

The validator clones defensively and never mutates the incoming payload.

## Resume matrix

The restore resolver normalizes persisted state to a safe, deterministic resume target:

- `map` → resolves to the map scene
- `intro` → resolves to the chapter intro scene
- `dialogue` → resolves to the safe dialogue start
- `choice` with no commitment → resolves to the choice scene
- `choice` with commitment → resumes the campaign puzzle entry and clears stale terminal results
- `puzzle` → restarts the deterministic campaign puzzle and preserves choice/chapter progress
- `results` / `consequence` → resume only when the persisted result is valid

Invalid or incoherent states fall back to a documented safe recovery path and reset to the main menu.

## Persistence UX

- New Game prompts for confirmation when an existing save is present.
- Continue shows a concise restore message when a puzzle restart is required.
- Storage failures degrade to memory-only behavior for the current tab and show one deduplicated warning.
- Puzzle Lab play does not create, mutate, overwrite, or clear campaign persistence.

## Browser limits and policy

- Persistence is browser-local only; it is not cloud-synced or cross-device.
- The system is designed for the current tab and browser profile; it does not promise multi-slot or cross-tab synchronization.
- Browser privacy modes or storage restrictions may disable durable writes, in which case the game remains playable in memory.

## Testing and verification

The persistence contract is exercised through unit tests and browser-level smoke coverage. The browser suite seeds storage directly and verifies the main-menu continue flow at mobile portrait/landscape viewports.
