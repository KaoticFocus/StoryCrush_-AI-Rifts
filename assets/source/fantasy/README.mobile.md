# Mobile Fantasy Game Assets — Executed Prompt Output

This package was created by executing the supplied agentic mobile asset-extraction prompt against the Fantasy mobile board reference.

## Contents

- **80 manifest-listed assets** across pieces, specials, board, HUD, panels, buttons, icons, objectives, ornaments, effects, and environment.
- `asset-manifest.json` with file paths, dimensions, pivots, mirrorability, nine-slice guidance, and notes.
- `text-style.json` with an editable-text style recommendation.
- `previews/asset-contact-sheet.png` — generated catalog/contact sheet used as the clean reconstruction source.
- `previews/reconstructed-interface-preview.png` — a preview assembled from the exported assets.
- `source/` — supplied reference and generation prompt.

## Important production note

This is a **high-fidelity prototype asset extraction/reconstruction pass**, not a final hand-painted production atlas. The AI-generated catalog was used to obtain clean, consistent reusable components and those components were isolated, normalized, and packaged automatically. Fine transparent-edge cleanup and final art-direction repainting are recommended before shipping.

## Editable text

All primary labels, titles, scores, move counts, objective counts, instruction text, and button labels should be rendered as game-engine text. The preview contains text only to demonstrate assembly.

## Mirroring

Assets marked `mirrorable: true` in the manifest can be flipped to reduce texture memory when their asymmetry is not semantically meaningful.

## Mobile-first use

Assets are normalized onto larger canvases for scaling. Verify final output at 320×568, 360×800, 390×844, 412×915, and landscape/tablet sizes before production lock.
