# Renderer Architecture

## Current Direction

This project stays on a custom SVG rendering path for now.

The main reason is that the hardest part of the product is not a generic chart layout. It is the custom visual language:

- liquid ribbon geometry
- branch split / merge behavior that mimics a design template
- collision-aware label placement
- dynamic canvas expansion for dense quarters
- company-specific hierarchical revenue structures

A full D3 migration would not solve those problems automatically, and would likely create a long regression window while the custom layout language is rebuilt.

## New Runtime Split

The frontend now exposes a small runtime boundary on `window.earningsImageStudio`:

- `layout`
  - `snapshotCanvasSize`
  - `stackValueSlices`
  - `separateStackSlices`
  - `resolveVerticalBoxes`
  - `resolveVerticalBoxesVariableGap`
  - `prototypeBandConfig`
  - `approximateTextWidth`
  - `approximateTextBlockWidth`
  - `estimatedStackSpan`
- `render`
  - `renderPixelReplicaSvg`
  - `renderIncomeStatementSvg`

This is not a full file-level extraction yet. It is an intentional seam so we can keep moving without destabilizing the renderer.

## Why This Split Helps

- Layout rules can evolve without being tied to DOM update code.
- Render entry points now have a stable home for future extraction.
- Browser-side diagnostics can inspect layout behavior through one runtime object.
- If we later split files, the call sites are already aligned to engine boundaries.

## D3 Recommendation

Do not migrate the whole renderer to D3 right now.

Recommended future partial adoption, if needed:

- `d3-path`
  - useful for structured path generation
- `d3-scale`
  - useful when scales become more formal and reusable
- `d3-interpolate`
  - useful for future transitions between quarters
- `d3-selection`
  - only if UI-side SVG interactivity becomes much richer

Not recommended right now:

- replacing the core ribbon engine with `d3-sankey`

Reason:

- the project needs template-specific ribbon behavior, not generic sankey bands
- the current bridge language includes custom cap joins, source hold lengths, and asymmetrical fan-out behavior that would still need custom geometry

## Next Refactor Steps

1. Move layout-only computations out of `renderPixelReplicaSvg` into a dedicated `buildReplicaLayoutModel(snapshot)` function.
2. Move ribbon path factories into a dedicated geometry module.
3. Add layout diagnostics output for:
   - left label overflow
   - right band overflow
   - canvas height expansion reason
4. Split the runtime into separate files only after the layout model is stable.
