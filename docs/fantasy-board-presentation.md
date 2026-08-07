# Fantasy Board Presentation (FP-1)

Presentation-only Fantasy board and piece skin for Puzzle Scene. **Presentation never owns gameplay authority** — it does not choose cells, targets, scores, objectives, threat outcomes, or cascades.

## Ownership

| Concern                           | Owner                                                         |
| --------------------------------- | ------------------------------------------------------------- |
| Theme contract / visual IDs       | `src/game/presentation/fantasy/fantasyPresentationProfile.ts` |
| Texture load once per scene       | `src/game/presentation/fantasy/ensureFantasyTextures.ts`      |
| Board/piece/Rift draw consumption | `src/game/presentation/BoardView.ts`                          |
| Board-adjacent HUD trim           | `src/game/presentation/HudView.ts`                            |
| Scene wiring + diagnostics        | `src/game/scenes/PuzzleScene.ts`                              |

## Asset keys and naming

Runtime derivatives live under Vite `public/`:

```text
public/assets/fantasy/pieces/
public/assets/fantasy/pieces/mobile/
public/assets/fantasy/specials/
public/assets/fantasy/board/
```

Phaser texture keys use the `fantasy:` prefix (example: `fantasy:piece:ruby`).  
Source art remains under `assets/source/fantasy/` with phone overrides in `<category>/mobile/`.

Mobile package metadata (do not overwrite general Fantasy root files):

```text
assets/source/fantasy/asset-manifest.mobile.json
assets/source/fantasy/text-style.mobile.json
assets/source/fantasy/README.mobile.md
```

## Mobile vs general selection

| Layout                                                          | Asset preference                   |
| --------------------------------------------------------------- | ---------------------------------- |
| Phone portrait / phone landscape (`prefersMobileFantasyAssets`) | `/assets/fantasy/<cat>/mobile/...` |
| Tablet / desktop                                                | `/assets/fantasy/<cat>/...`        |

Fallback chain (phone): **mobile → general → procedural/vector**.  
Resolver: `fantasyAssetResolver.ts`. Loader: `ensureFantasyTextures.ts` (stable keys; variant switch on resize).

## Standard piece mapping

| Piece type | Visual id                 | Glyph id          | Runtime file                   |
| ---------- | ------------------------- | ----------------- | ------------------------------ |
| ruby       | fantasy-ruby-flame        | flame-point       | piece_fire_red.png             |
| sapphire   | fantasy-sapphire-wave     | wave-disc         | piece_water_blue.png           |
| emerald    | fantasy-emerald-leaf      | leaf-hex          | piece_leaf_green.png           |
| topaz      | fantasy-topaz-sun         | sun-burst         | piece_sun_gold.png             |
| amethyst   | fantasy-amethyst-crescent | crescent-triangle | piece_moon_triangle_purple.png |
| pearl      | fantasy-pearl-moon        | double-crescent   | piece_moon_silver.png          |

## Special-piece mapping

| Special                   | Visual id                       | Runtime treatment           |
| ------------------------- | ------------------------------- | --------------------------- |
| line-clear horizontal     | fantasy-special-line-horizontal | special_fire_horizontal.png |
| line-clear vertical       | fantasy-special-line-vertical   | same texture, rotated 90°   |
| cross-clear               | fantasy-special-cross           | special_starburst_green.png |
| wildcard (type-targeting) | fantasy-special-type-target     | special_vortex_blue.png     |

## Rift visual mapping

| State      | Visual id               | Treatment                                 |
| ---------- | ----------------------- | ----------------------------------------- |
| source     | fantasy-rift-source     | root-heart mark `❖`, thick crimson border |
| threatened | fantasy-rift-threatened | corner-bracket reticle + `◉`              |
| corrupted  | fantasy-rift-corrupted  | thorn hatch + `Ψ`                         |

## Reduced motion

Animated effect profile ids resolve to `*-reduced` variants via `resolveFantasyEffectProfile`. Threat pulse tweens are skipped; static reticle/symbols remain.

## Phone width fill

Phone portrait layout (`viewportWidth <= 500`) sizes square cells from nearly the full safe width first (≈6–10px side gutters), then compresses HUD/footer before shrinking the grid. Fantasy frame thickness shrinks to stay inside those gutters. Tablet/desktop keep intentional board ceilings so wider layouts do not stretch edge-to-edge.

## Fallback

If a texture is missing or load fails, BoardView draws the existing procedural vector pieces/cells. Theme diagnostic becomes `procedural-vector`.

## Production-art replacement path

1. Drop approved phone art into `assets/source/fantasy/<category>/mobile/`, then copy derivatives to `public/assets/fantasy/<category>/mobile/`.
2. Update `fantasyMobileTextureUrls` / general `textureUrls` only when filenames change.
3. Do not change `BoardView` gameplay hooks, board geometry, or domain code.
4. Keep general Fantasy root metadata separate from `*.mobile.*` metadata.

## Diagnostics

Status bridge may expose:

- `data-board-theme`
- `data-piece-visual-id`
- `data-special-visual-id`
- `data-rift-visual-state`
- `data-reduced-motion-presentation`
- `data-fantasy-assets-ready`
- `data-asset-variant` (`mobile` \| `general` \| `procedural`)
- `data-board-asset-variant` / `data-piece-asset-variant` / `data-hud-asset-variant`
