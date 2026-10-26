# Plan: from tutorial demo to map-making tool

This fork started from Martin O'Leary's [terrain generator](https://mewo2.com/notes/terrain/). The original was a step-by-step explanation of how the algorithm works. The aim now is a tool for making maps, while still letting you explore the algorithm.

## Goals

- **Make maps people can use.** That includes tabletop RPG game masters, parents making treasure maps for their kids, and anyone who just enjoys playing with it. It's a fun experiment first.
- **Two equal ways to start a map:**
  - *Random*: generate a complete map from a seed and a few settings.
  - *Blank*: start with a flat map and build it up by hand with slopes, cones, blobs, erosion, sea level, cities and so on. You can also generate a random map and then tinker with it.
- **A neutral editor, with themed output.** The tool itself looks plain. The style belongs to the map: simple, fantasy, military, pirate, and more.
- **Edits that can be undone and saved.** Every action is one recorded step.

## Core ideas

### One map, many views

There is a single map state: mesh, heightmap, cities, points of interest, wrecks, markers, names and label edits. Every view draws from it:

- the finished map;
- diagnostic views, such as heightmap colours, erosion rate, city scores and territories.

Nothing needs copying between stages.

### Everything is a step

Each action is a step in one ordered list. That includes "new blank map", "generate random map", "add 10 blobs", "erode", "add city", "move label" and "delete wreck". A step that uses randomness records its own seed, so replaying the list rebuilds exactly the same map. From that:

- **Undo/redo** means moving back and forth through the list. Each step's result is cached, so this is instant.
- **A save file** is just the step list as JSON. It stays small, whether the map was generated or built by hand.
- **Watching a map being built** step by step becomes possible, for the "explore the algorithm" side.
- **Later sculpting tools** fit in the same way: a brush stroke is just another step.

### Seeded and independent of the browser

The generation code (`src/core/`) doesn't use the DOM, and all its randomness comes from a seeded generator. The same seed always produces the same map. That allows:

- shareable seeds and links;
- a "map of the day" seeded from the date;
- generating maps from the command line, e.g. on a Raspberry Pi driving a pen plotter.

Generation runs in stages (grid, terrain, names, wrecks, points of interest), and each stage has its own random stream derived from the seed. So changing the detail level only changes the grid: the same seed gives the same coastline, hills and names at any detail. Hills are scattered over a fixed area bigger than any map, so a square map and an A4 map from one seed share their middle. What still varies with detail: small inlets, islands and river branches; erosion; and which cities get picked first, so capitals and region names can move.

Maps record the generator version they were made with (`generator` in saved files and `#map=` links, `v` in seed links). Any change that makes the same steps give a different map must bump `GENERATOR_VERSION` in `document.js`. A map from a newer version is refused. Version 1 maps aren't replayed the old way, since none were ever saved.

### Themes are data

A theme describes how the map is drawn: fonts, colours, line styles for coasts, rivers and borders, marker symbols, background, and later a naming style. Adding a theme means writing data, not changing the editor. There will also be a **Plotter** theme: strokes only, single-stroke (Hershey-style) fonts, no fills or background images.

## Phases

Each phase leaves the app working.

### Phase 1: Foundations
- [x] Move to Vite and ES modules. Keep D3 v4 for now, from npm instead of vendored files.
- [x] Seeded random number generation. Remove every direct `Math.random` call from the generation code.
- [x] Split the generation code (`src/core/`) from SVG rendering (`src/render/`). The core runs in Node.
- [x] One shared map state, built from a step history with cached snapshots and undo/redo.
- [x] Choose a point-of-interest symbol, wreck variant and place names once, when the item is created, so they don't change on every redraw.
- [x] Rewire the existing tabs to the shared map. Remove the "Copy heightmap from…" buttons.
- [x] Fix these bugs:
  - edit modes getting out of sync;
  - Quick start inputs only updating on blur;
  - drag and delete ignoring items added later;
  - duplicate element IDs.
- [x] A command-line script that generates a map from a seed, plus tests showing generation is deterministic.

### Phase 2: Neutral editor layout
- [x] Top bar: New map (Random or Blank, with detail level and seed), Open, Save, Export (PNG/SVG). The seed of the current map is shown.
- [x] Tool strip: Pointer, Move, Edit labels, Add marker, Delete, Undo/Redo. Keyboard shortcuts: V, G, T, M, D, Esc.
- [x] The map in the centre, fitted to the window. The status bar shows hints for the active tool and a View picker.
- [x] One map view with view modes: Map, Heightmap, Erosion rate, City scores, Territories. (A mesh demo view was later removed: it no longer added anything.)
- [x] Right-hand panel:
  - **Build**: new terrain, shaping, sea level and erosion (with sliders), places.
  - **Style**: theme, lettering, background, layer toggles.
- [x] Remove the tabs. Plain, neutral editor styling (`css/editor.css`), separate from how the map is drawn (`css/map.css`).
- [x] Save and Open map files, which were planned for Phase 6. They fit the top bar and were simple once the step history existed.

### Phase 3: Themes
- [x] A theme format (`src/themes/`; `simple.js` documents every field) and a renderer that uses it. The theme's stylesheet is written into the SVG, so exports carry it.
- [x] The style is part of the map: theme, font, background and hidden layers are a step, so they can be undone, are saved in map files and carry over to new maps.
- [x] **Simple** (the default), **Fantasy** (the original look: parchment, IM Fell type, tentacle wrecks; first called Lovecraftian) and **Plotter**. **Pirate** came later (see Phase 7).
- [x] Plotter: strokes only, single-stroke Hershey lettering, borders drawn as separate dashes, slope hatching cleared from under labels.
- [x] Fonts are bundled (`@fontsource`), and exports embed only the current theme's fonts, so labels keep their font in PNG/SVG.
- Later, for plotting (waiting for the plotter build): clear rivers and borders from under labels too, optimise pen travel, set a physical paper size.

### Phase 4: Tools
- [x] Tools: Pointer (V), Move (G), Edit text (E), Add text (T), Add symbol (S), Add marker (M), Delete (D). Esc returns to Pointer. The status bar explains the active tool.
- [x] Edit text in place with a text box on the map, replacing `prompt()`. Enter saves, Esc cancels. Double-click edits text with Pointer or Move. Clicking a city with Edit text names it even when its label is hidden.
- [x] Add text: free text anywhere on the map ("Here be dragons"), drawn in the theme's lettering. It can be moved, edited and deleted.
- [x] Marker types: X marks the spot, Danger, Flag, Camp and Landmark, chosen from a bar above the map. Each theme draws them in its own style, in the colour picked for each marker (black by default; swatches or any custom colour).
- [x] Add symbol: place a wreck or point of interest by hand, choosing which of the theme's drawings to use from a bar above the map. Clicking an existing wreck or point of interest swaps it for the chosen symbol, which can also turn a wreck into a point of interest or back. Simple and Plotter have three wreck drawings (ship, anchor, sinking ship). A chosen drawing is stored as its number in the theme's set, so another theme with fewer drawings wraps round to one of its own.
- [x] Place-name language: Random (a new made-up language per map, as before) or a named one (Plain, English-ish, Germanic, Slavic, French-ish, Welsh-ish, Hawaiian-ish, Greenlandic-ish, Arabic-ish). Chosen under New map, kept in the map's settings, and in share links as `names=`. The Build panel can rename every place in another language, which then names places added later. The CLI takes `--language`.
- [x] Symbol parts are styled straight from the theme (`parts`), since CSS can't reach inside SVG `<use>` elements. This also keeps plotter output free of fills.

### Phase 5: Undo/redo and history
- [x] Undo/redo buttons and shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y). The buttons' tooltips say which step they'll undo or redo.
- [x] A History panel listing every step in plain words, e.g. "Add 5 blobs", "Move Nenonu", "Rename Kuleno to “Innsmouth”". Each new map starts a group. Click any step to jump back to it; undone steps are struck through until you redo them or make a new change.
- [x] Replay: plays the current map's steps back from its start, highlighting each in the list. Esc or any change stops it. The map can't be edited during a replay, and the history is never changed by it.
- Later: replay the stages inside "New random map" (mesh, heightmap, erosion, cities) for the explore-the-algorithm side. Show the Heightmap view automatically while replaying a hand-built map's terrain steps.

### Phase 6: Autosave and sharing
- [x] Autosave: the current map, with its undo/redo history, is kept in this browser and restored on reload. Earlier maps from the session aren't kept.
- [x] Share links, via the Share button:
  - An unedited random map gets a short, readable link: `?seed=…`, plus any non-default settings (`shape`, `detail`, `territories`, `cities`, `poi`, `wrecks`, `names`) and style (`theme`, `font`, `background`).
  - Anything else (edited or hand-built maps) gets its steps compressed into the link: `#map=…`.
  - Opening a link adds that map on top of the current history, so the previous map can still be reached with Undo or History. The link is then removed from the address bar.
- [x] Map of the day: the seed `today` stands for today's date (`?seed=today`, the Map of the day button, `npm run generate -- --seed today`).
- [x] Each map's steps are self-contained: a new map depends on nothing before it except the style, which is written into its first step when saved on its own. Save, autosave and links all hold just the current map.

### Map shapes
- [x] Square (the original size and detail levels) or A4 landscape/portrait, chosen under New map. Shapes live in `SHAPES` in `steps.js`.
- [x] An A4 map has about three times the square's area (2.12 × 1.5 map units). It's drawn at 700 SVG units per map unit instead of 1000, so text, lines and symbols, which are sized in SVG units, print the same size on A4 with a border as a square map printed across A4: town names about 3.8 mm tall.
- [x] Detail levels per shape: square 4k/16k/65k points, A4 16k/32k/65k. 65k is the practical cap: about 3–4 s to generate. Beyond that it gets slow fast, and the cells are already finer (about 0.9 mm) than A4 print or a plotter pen shows. A4 maps default to 30 cities, 8 territories, 2 points of interest and 2 wrecks.
- [x] Terrain that assumed a 1 × 1 map scales with its area: the number of random hills and the slope hatching length.
- [x] City labels never go past the map's edge. Before, that cost no more than covering about 100 river or coast points, which on the A4 shapes it occasionally lost to.
- [x] Saved maps and share links record the shape (`shape=`); older maps open as square, unchanged. The CLI takes `--shape`.
- Deferred: A3. It's A4 printed bigger, and few people have an A3 printer at home.

### Phase 7: More themes
- [x] **Pirate**: an old sea chart. Sepia ink on parchment (or plain sand), Pirata One blackletter for regions and IM Fell DW Pica for towns, dotted red borders, and water-lining: short strokes on the sea along the coast, thinning out further from land (`seaShading` in the theme format; a "Sea shading" layer for themes that use it). Wrecks: a sinking ship, a sea serpent, a shark's fin. Points of interest: skull and crossbones, palm tree, treasure chest, cannon. A bold brushy X.
- Later: better wreck drawings for Pirate; the current ones are rudimentary.
- [x] Extras drawn over the map, under Style → Extras (`src/render/extras.js` works out what to draw; `svg.js` draws it):
  - A map width, in miles, km or leagues. It sets the scale bar and the grid size.
  - A grid: none, square (lettered columns and numbered rows, "Grid C4") or hex (flat-topped, numbered 0101 for hex crawls), every N units.
  - A scale bar, a compass rose and a title box, each in the theme's colours and lettering. Plotter draws them stroke-only, with single-stroke lettering.
  - The scale bar, compass and title can be dragged with Move and removed with Delete, and the title edited with Edit text.
  - All of these are part of the style, so they can be undone and are saved. A theme can set defaults (`extras` in the theme format), which apply until the map sets its own; Pirate defaults to leagues and a compass rose. A new map keeps the previous one's extras, except its title and where things were moved to. Maps with extras share as full `#map=` links.
- [ ] **Military**, on top of that layer: a topographic or ops map, with a stencil face for regions, a square coordinate grid, and map-style symbols (objective, target, hazard, bunker, radio mast).
- [ ] Theme naming styles, as an option alongside the made-up languages: English-sounding pirate names ("Dead Man's Cove", "Port Blackwater") and military codenames ("Objective Granite", "Hill 312"). They're word lists and patterns, not sounds, so they're a new kind of name generator.
- Later: high fantasy.

### Phase 8: D3 v7
- [ ] Move to D3 v7 and `d3-delaunay`. This removes the `d3-color` audit warning and makes generation lighter, but the grid is built differently, so it needs a `GENERATOR_VERSION` bump and every seed gives a different map.

### Later
- A 3D view of the terrain, probably with three.js, and sculpting tools that record brush strokes as steps.
- A command-line "map of the day" for a home-made pen plotter, outputting stroke-only SVG and possibly HPGL or G-code.
- Memory, measured on an A4 High map:
  - Done: the grid no longer keeps d3's Voronoi diagram, and builds its cell outlines only for the diagnostic views (123 → 60 MB). Water flow is cached for the latest heightmap. Territories and label placement are cached separately, so moving a city recomputes nothing and renaming one only re-places labels.
  - Done: the grid and heightmaps use typed arrays (grid 60 → 15 MB). Undo keeps the last 30 steps but at most 2 million heightmap vertices (16 terrain snapshots on A4 High), plus the map's first step; undoing further replays from there. Rivers, coasts, hatching, territories and labels are kept for the 3–10 most recent heightmaps, depending on size. 60 terrain steps on A4 High hold about 100 MB (30 steps used to hold 337 MB).
  - Done: redraws skip layers drawn from the same data as last time, and slope hatching is one SVG path instead of an element per stroke (thousands of elements). On A4 High, undo/redo between terrain steps takes about 30–50 ms of script time (was 75–115) and adding a marker 3 ms (was about 70). Diagnostic views keep their cells when switching between them and only recolour.
  - Next, if needed: slope hatching as a typed array (it's most of what's left per heightmap).

## Decisions so far
- **Desktop first.** Phone layouts aren't a goal for now. Screens narrower than 760px or shorter than 500px (phones, either way up) get a notice asking for a bigger screen, and the editor doesn't start until the window is big enough.
- **Zoom and pan are not a priority.**
- **Build tools are fine** (Vite, npm).
- **Editing tools only change what you touch.**
  - Moving a feature (city, point of interest, wreck, marker) moves only its marker, and a city's label goes with it. Terrain, territories, borders and other labels stay as they are. Territories still come from the spot where the city was placed.
  - Moving a label never moves what it labels. A city label is stored as an offset from its city, so it keeps following the city if the city moves later.
- **Save files hold the step list, not the full mesh.** If replaying ever gets slow (e.g. many sculpting steps), a save can include a heightmap snapshot.
