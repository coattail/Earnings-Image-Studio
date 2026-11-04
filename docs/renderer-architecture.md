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

## Runtime and source boundaries

`js/runtime-files.json` defines source order once. The direct Node renderer,
audits, tests, and production compiler all consume it. Files are classic scripts:
public runtime functions retain their names and the `window.earningsImageStudio`
and automation APIs remain stable.

| Module | Responsibility |
| --- | --- |
| `app-01-layout.js` | Shared geometry and packing solvers |
| `app-02-sankey.js` | Replica layout ownership and ordered refinement passes |
| `renderer/replica-annotations.js` | Label measurement and annotation output, with explicit per-call layout inputs |
| `renderer/replica-markup.js` | SVG output from finalized replica coordinates, styles and annotation callbacks |
| `renderer/revenue-only.js` | Revenue-only disclosure presentation |
| `renderer/segment-bars.js` | Historical bars, axes and logo collision refinement |
| `renderer/income-statement.js` | Statement rendering entry and non-replica fallback |
| `renderer/runtime.js` | Stable layout/render/i18n API assembly |
| `app-03-data.js` | Financial snapshots and historical data adapters |
| `app-04-bootstrap.js` | Loading, DOM updates, exports and automation |

The SVG phase receives a named layout model. It does not assign to layout-owner
bindings. Annotation helpers receive their local geometry dependencies on each
call; this preserves late-bound editor offsets and the original ordering of
layout passes, including the hoisted branch-label resolver used during packing.

`npm run build` compiles the ordered modules into a single minified production
asset. Readable modules remain the source of truth. A source-integrity manifest
lets data-only cloud runs validate the checked-in bundle without installing npm
dependencies. The root site and Pages artifact load the same bundle.

The startup path preloads data alongside the deferred bundle. Small logos are
embedded in the logo index (2 KB per asset, 16 KB total budget), avoiding another
request before rendering. Large logos retain lazy loading and all exported SVGs
retain embedded images. The complete sidebar is populated after the first chart
gets a paint opportunity.

## Verification

Before this extraction, 340 latest, historical, bilingual and editor scenarios
were captured across all 41 companies. All 335 renderable SVGs remain byte-for-byte
identical after extraction and production minification; the five pre-existing
publication errors are also unchanged. This is a preservation check, not a claim
that missing financial disclosures have been resolved.

The recurring `test_built_runtime_parity.cjs` compares current source and compiled
SVGs across the same matrix. Domain tests cover monetary ratios, additive drags,
source labels, bar history and logo placement. Artifact validation rejects stale
source hashes, altered bundles, missing inputs and an outdated HTML bundle link.

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

### Connected expense-stage placement

After profit-stage placement and expense-terminal compaction, `resolveExpenseStageTop`
balances the gross-to-expense inlet against the leading expense outlet using their
actual flow ports and horizontal distances. Earlier crowding rules could lift the
parent independently of its terminal fan, leaving a nearly flat inlet followed by
a steep outlet, particularly when the expense breakdown grew beyond three rows.

The parent moves toward equal incoming/outgoing slopes only when their difference
exceeds the layout tolerance. Canvas bounds, the operating-profit lane, downward
flow at every child port, and overlapping cost-label footprints constrain that
move. Later small expense rows do not dominate the parent position merely because
their labels need more space. Monetary thicknesses and financial data stay intact.

The primary-language core is captured after terminal compaction and port balance,
so translated labels share the same financial skeleton. Interactive expense edits
use a clean automatic baseline, with the user's offsets applied afterward; explicit
parent placement and loss/extreme-gain layouts retain their existing rules.

### Final revenue-source information packing

Earlier source spacing reserved provisional ribbon and metric positions. Restored
node offsets could subsequently place a multi-line title or growth block inside
another source, and a saved horizontal offset could detach a tiny residual from
its peer column. The annotation formatter now also measures each visible text
line, including its outline, at the final source position.

`resolveSourceInformationColumn` packs those footprints together with the monetary
rectangles. Only horizontally overlapping footprints impose vertical separation;
forward/backward bounds let a crowded suffix use room above while respecting the
title, canvas and outer inflow directions. An infeasible column retains its prior
positions rather than clipping or changing monetary thicknesses. Normal display
also projects peer sources onto their shared column, preserving a common column
translation. In the editor, interactive offsets remain additive to the automatic
baseline. Neither path rewrites saved offsets or financial data. The pass applies
to all companies and uses the active language's actual annotation wrapping.
The direct renderer mirrors the UI's additive offset merge; `--edit-mode` enables
the unconstrained interactive path for drag regression checks and editor previews.

### Future extraction

1. Move layout-only computations out of `renderPixelReplicaSvg` into a dedicated `buildReplicaLayoutModel(snapshot)` function.
2. Move ribbon path factories into a dedicated geometry module.
3. Add layout diagnostics output for:
   - left label overflow
   - right band overflow
   - canvas height expansion reason
4. Continue extracting bounded layout passes as explicit input/output solvers; preserve pass ordering and the source/production parity matrix.
