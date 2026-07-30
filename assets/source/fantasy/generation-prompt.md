# Agentic Game Asset Generation Prompt

Use the attached fantasy match-3 game-board image as the **visual reference and style bible**. Your job is to reconstruct the interface as a production-ready collection of individual game assets.

## Primary objective

Analyze the reference image, identify every **visually unique and reusable element**, and create a separate file for each element.

Do not export repeated copies of the same asset. For example, the red fire tile appears many times but should be created only once.

The finished assets must allow a developer to rebuild the entire screen inside Phaser, Unity, Godot, HTML Canvas, or another game engine without relying on the original flattened image.

---

## Agent workflow

1. Inspect the complete reference image before generating anything.
2. Create an asset inventory organized by category.
3. Compare the inventory against the required asset list below and add any visually unique elements that were overlooked.
4. Generate each asset individually.
5. Save each asset using the required filename convention.
6. Validate transparency, consistency, padding, lighting, perspective, and scale.
7. Produce:
   - Individual transparent asset files
   - A JSON asset manifest
   - A labeled contact sheet
   - A reconstructed preview of the complete interface using only the generated assets
8. Continue automatically until every listed asset has been completed. Do not stop after producing a sample batch.
9. Do not ask the user to crop, rename, separate, or manually move files.

---

## Visual direction

Reproduce the reference’s visual language:

- High-fantasy match-3 game interface
- Dark enchanted cavern setting
- Blackened iron and carved stone
- Antique gold filigree
- Purple crystal ornaments
- Highly polished magical gemstones
- Strong internal gemstone illumination
- Controlled bloom and magical glow
- Detailed beveled edges
- Rich, premium mobile-game rendering
- Front-facing game UI with consistent lighting
- Crisp silhouettes suitable for animation and interaction

The artwork should feel cohesive, as though every asset came from the same professional game-art studio.

Do not introduce modern, cartoon, minimalist, sci-fi, flat-vector, or photorealistic elements.

---

# Required asset inventory

## 1. Standard match-3 pieces

Create one transparent file for each standard piece:

1. Red faceted gemstone containing a glowing fire symbol
2. Blue circular gemstone containing a water-wave symbol
3. Gold sun medallion
4. Purple triangular gemstone containing a crescent-moon symbol
5. Silver circular moon medallion
6. Green faceted gemstone containing a leaf symbol

Each piece must:

- Face directly forward
- Be centered
- Fit within the same square footprint
- Use identical perspective and visual weight
- Have transparent space around the silhouette
- Contain no tile-cell background
- Contain no neighboring elements
- Preserve the polished bevels and magical internal lighting

Suggested filenames:

```text
piece_fire_red.png
piece_water_blue.png
piece_sun_gold.png
piece_moon_triangle_purple.png
piece_moon_silver.png
piece_leaf_green.png
```

---

## 2. Special match-3 pieces

Create separate transparent files for:

1. Green circular starburst power-up
2. Red fire gemstone with a horizontal-stripe or line-clearing modifier
3. Blue magical vortex or whirlpool power-up
4. Any additional special-state overlay visible in the reference
5. A generic selected-piece glow
6. A valid-move highlight
7. A magical activation ring
8. A destruction or collection sparkle

Suggested filenames:

```text
special_starburst_green.png
special_fire_horizontal.png
special_vortex_blue.png
overlay_piece_selected.png
overlay_valid_move.png
fx_activation_ring.png
fx_collection_sparkle.png
```

Where possible, keep reusable effects separate from the underlying gemstone.

---

## 3. Board and grid assets

Create the board as modular assets rather than one permanently flattened image.

Required assets:

- Empty dark beveled tile cell
- Inner grid background
- Board top edge
- Board bottom edge
- Board left edge
- Board right edge
- Board corner ornament
- Purple side-diamond ornament
- Purple top-center crest gemstone
- Gold and iron frame trim
- Board shadow or backing plate

Use mirrorable assets where symmetry permits. Note mirroring instructions in the manifest.

Suggested filenames:

```text
board_cell_empty.png
board_grid_background.png
board_edge_top.png
board_edge_bottom.png
board_edge_side.png
board_corner.png
board_ornament_side_gem.png
board_ornament_top_crest.png
board_backplate.png
```

Create frame pieces so they can be used as a nine-slice or modular scalable frame.

---

## 4. Right-side information panel

Create separate assets for:

- Main right-panel background
- Right-panel ornamental frame
- Top crown ornament
- Large purple crown gemstone
- Title plaque
- Score and moves panel
- Score-panel divider
- Central blue crystal medallion
- Green magical status plaque
- Green status glow and vine effect
- Objectives panel
- Objectives heading ornament
- Objective icon socket
- Section dividers
- Lower illustration frame
- Bottom purple gemstone crest

Suggested filenames:

```text
sidebar_background.png
sidebar_frame.png
sidebar_crown_ornament.png
sidebar_crown_gem.png
panel_title_plaque.png
panel_score_moves.png
panel_score_divider.png
panel_center_crystal.png
panel_status_plaque.png
panel_status_magic_overlay.png
panel_objectives.png
panel_objectives_heading.png
panel_objective_icon_socket.png
panel_section_divider.png
panel_artwork_frame.png
sidebar_bottom_crest.png
```

Do not bake words or numbers into these backgrounds.

---

## 5. Objective icons

Create separate transparent files for:

- Small faceted red ruby
- Small purple crystal shard

Do not reuse the red fire game piece for the objective ruby. They are different visual objects.

Suggested filenames:

```text
objective_ruby.png
objective_purple_crystal.png
```

---

## 6. Bottom interface controls

Create a reusable large-button system.

### Button backgrounds

Generate button backgrounds without text or icons:

- Purple button
- Blue button
- Teal-green button
- Cyan-blue button
- Disabled button
- Pressed-state overlay
- Hover-state overlay
- Focus or selected-state glow

Suggested filenames:

```text
button_large_purple.png
button_large_blue.png
button_large_teal.png
button_large_cyan.png
button_large_disabled.png
button_state_pressed.png
button_state_hover.png
button_state_selected.png
```

Button frames must share the same dimensions, bevel geometry, padding, and ornamental structure.

### Button icons

Create separate transparent icon files for:

- Restart arrows
- Castle or return-to-menu icon
- Crossed swords
- Magical starburst
- Glowing magnifying glass
- Pause symbol

Suggested filenames:

```text
icon_restart.png
icon_back_to_menu.png
icon_mode_swords.png
icon_motion_star.png
icon_hint_magnifier.png
icon_pause.png
```

Do not bake the icons into the buttons.

---

## 7. Instruction plaque

Create:

- Empty instruction plaque
- Left ornamental end cap
- Right ornamental end cap
- Optional plaque highlight or selected state

Suggested filenames:

```text
instruction_plaque.png
instruction_plaque_endcap.png
instruction_plaque_highlight.png
```

Do not include instructional text in the artwork.

---

## 8. Environmental artwork

Create separate files for:

- Full dark enchanted-cavern background
- Distant crystalline formations
- Rocky foreground floor
- Left purple crystal cluster
- Right purple crystal cluster, only if it cannot be created by mirroring the left asset
- Floating purple magical particles
- Lower-panel gothic castle illustration
- Castle haze or atmospheric overlay

Suggested filenames:

```text
background_cavern.png
background_crystal_formations.png
foreground_rock_floor.png
decoration_crystal_cluster.png
decoration_magic_particles.png
artwork_dark_castle.png
artwork_castle_atmosphere.png
```

Environmental layers should be capable of subtle parallax movement.

---

## 9. Reusable ornamental elements

Create separate transparent files for recurring ornamental motifs:

- Purple diamond gemstone
- Blue crystal gemstone
- Gold filigree corner
- Gold divider flourish
- Small gold diamond divider
- Blackened metal trim
- Green magical vine flourish
- Generic magical glow
- Purple ambient glow
- Blue ambient glow
- Green ambient glow

Suggested filenames:

```text
ornament_gem_purple.png
ornament_gem_blue.png
ornament_corner_gold.png
ornament_divider_gold.png
ornament_divider_diamond.png
ornament_metal_trim.png
ornament_vine_green.png
fx_glow_generic.png
fx_glow_purple.png
fx_glow_blue.png
fx_glow_green.png
```

---

# Text handling

Do not rasterize interface text into the generated artwork.

The following must remain editable text in the game engine:

- Prototype Level
- Score
- Moves
- Status: Active
- Objectives
- Score: 0 / 600
- Collect Ruby: 0 / 10
- Instructional text
- Restart
- Back to Menu
- Mode: Normal
- Motion: Full
- Hint
- Pause
- All changing numbers and objective values

Provide a `text-style.json` file describing:

- Suggested font category
- Font size ratios
- Gold text color
- Pale-gold secondary text color
- Green status text color
- Stroke width
- Shadow settings
- Letter spacing
- Alignment
- Maximum text bounds

Do not imitate an unavailable proprietary font. Recommend a legally usable equivalent.

---

# Technical output requirements

## File format

- PNG with full alpha transparency for isolated assets
- WebP copies may also be supplied
- SVG only for simple symbols when the result preserves the rendered style
- sRGB color profile
- No visible matte around transparent edges
- No checkerboard rendered into the image
- No white, black, or colored background behind isolated assets

## Resolution

Produce assets at a minimum of **2× intended display resolution**.

Recommended sizes:

- Match pieces: `512 × 512`
- Objective icons: `256 × 256`
- Button icons: `256 × 256`
- Large buttons: approximately `1024 × 320`
- Frame components: large enough for clean nine-slice scaling
- Environmental backgrounds: at least `2816 × 2112`
- Effects: enough transparent padding to prevent clipped bloom

Maintain consistent relative scale across related assets.

## Cropping and padding

- Crop to the asset’s usable bounds
- Preserve 8–12% transparent padding
- Preserve additional space around magical glows
- Do not clip shadows, sparks, bevels, or bloom
- Center game pieces on identical canvases
- Keep pivots and visual centers consistent

---

# Asset manifest

Create an `asset-manifest.json` file containing an entry for every generated file.

Example structure:

```json
{
  "assets": [
    {
      "id": "piece_fire_red",
      "file": "pieces/piece_fire_red.png",
      "category": "match_piece",
      "width": 512,
      "height": 512,
      "pivot": {
        "x": 0.5,
        "y": 0.5
      },
      "mirrorable": false,
      "nineSlice": null,
      "notes": "Standard red fire match piece"
    }
  ]
}
```

For scalable panels and frames, include nine-slice margins:

```json
{
  "nineSlice": {
    "left": 80,
    "right": 80,
    "top": 70,
    "bottom": 70
  }
}
```

---

# Folder structure

```text
fantasy-game-assets/
├── pieces/
├── specials/
├── board/
├── panels/
├── buttons/
├── icons/
├── objectives/
├── ornaments/
├── effects/
├── environment/
├── typography/
├── previews/
├── asset-manifest.json
└── text-style.json
```

---

# Quality-control rules

Before marking the task complete, verify that:

- Every visually unique element has its own file.
- No file contains accidental fragments of neighboring elements.
- Repeated elements have not been exported multiple times.
- All isolated assets have real alpha transparency.
- Tile pieces share identical scale and perspective.
- Light direction is consistent throughout the asset set.
- Gold, iron, crystal, and gemstone materials remain consistent.
- UI text has not been baked into reusable backgrounds.
- Button icons and button backgrounds are independent.
- Effects have enough padding to animate without clipping.
- Modular frames reconnect without visible seams.
- The reconstructed preview closely matches the original composition.
- All filenames exactly match their manifest entries.

When uncertain whether an element should be merged or separated, prefer separation and reuse. The final result should function as a clean, modular game-development asset pack rather than a collection of cropped screenshots.
