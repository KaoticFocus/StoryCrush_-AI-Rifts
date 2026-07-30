# Fantasy Match-3 Modular Asset Pack

This pack was created from the supplied fantasy game-board reference and the accompanying agentic asset-generation prompt.

## Contents

- 6 standard match pieces
- 3 special pieces
- selection and valid-move overlays
- board cell, grid, frame, and ornament components
- right-side panel components
- objective icons
- reusable button backgrounds and button-state overlays
- button icons
- instruction plaque components
- environmental layers
- reusable ornaments and glow effects
- `asset-manifest.json`
- `text-style.json`
- labeled asset contact sheet
- reconstructed interface preview
- original generation prompt

## Important production note

This is an extraction-and-reconstruction prototype derived from a flattened reference image. It is suitable for prototyping, layout reconstruction, engine integration tests, and further art-direction work. It is not a replacement for layered source art or a final hand-painted production pass.

Some assets were reconstructed procedurally where the reference contained baked text or overlapping interface elements. Review edge mattes, pivots, dimensions, and nine-slice margins in the target engine before shipping.

## Suggested engine workflow

1. Import the PNG files with premultiplied alpha disabled unless your engine requires it.
2. Use `asset-manifest.json` for dimensions, pivots, mirrorability, and nine-slice metadata.
3. Render interface copy as live text using `text-style.json`.
4. Keep glows and status effects on separate additive-blend layers.
5. Atlas the match pieces, icons, and small ornaments after visual approval.
