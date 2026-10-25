# Plan: from tutorial demo to map-making tool

This fork started from Martin O'Leary's [terrain generator](https://mewo2.com/notes/terrain/). The original was a step-by-step explanation of how the algorithm works. The aim now is a tool for making maps, while still letting you explore the algorithm.

## Goals

- **Make maps people can use.** That includes tabletop RPG game masters, parents making treasure maps for their kids, and anyone who just enjoys playing with it. It's a fun experiment first.
- **Two equal ways to start a map:**
  - *Random*: generate a complete map from a seed and a few settings.
  - *Blank*: start with a flat map and build it up by hand with slopes, cones, blobs, erosion, sea level, cities and so on. You can also generate a random map and then tinker with it.
- **A neutral editor, with themed output.** The tool itself looks plain. The style belongs to the map: simple, Lovecraftian, military, pirate, high fantasy, and more.
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
- [x] One map view with view modes: Map, Heightmap, Erosion rate, City scores, Territories, Mesh demo.
- [x] Right-hand panel:
  - **Build**: new terrain, shaping, sea level and erosion (with sliders), places.
  - **Style**: label font, parchment, layer toggles.
  - **Advanced**: the mesh demo and a history count.
- [x] Remove the tabs. Plain, neutral editor styling (`css/editor.css`), separate from how the map is drawn (`css/map.css`).
- [x] Save and Open map files, which were planned for Phase 6. They fit the top bar and were simple once the step history existed.

### Phase 3: Themes
- [x] A theme format (`src/themes/`; `simple.js` documents every field) and a renderer that uses it. The theme's stylesheet is written into the SVG, so exports carry it.
- [x] The style is part of the map: theme, font, background and hidden layers are a step, so they can be undone, are saved in map files and carry over to new maps.
- [x] **Simple** (the default), **Lovecraftian** (the original look: parchment, IM Fell type, tentacle wrecks) and **Plotter**.
- [x] Plotter: strokes only, single-stroke Hershey lettering, borders drawn as separate dashes, slope hatching cleared from under labels.
- [x] Fonts are bundled (`@fontsource`), and exports embed only the current theme's fonts, so labels keep their font in PNG/SVG.
- Later: pirate, military, high fantasy, and theme-specific naming styles.
- Later, for plotting: clear rivers and borders from under labels too, optimise pen travel, set a physical paper size.

### Phase 4: Tools
- One tool controller with clear hints for the active tool. Esc returns to Select.
- Edit labels in place with a text box, replacing `prompt()`.
- More marker types: treasure cross, plus theme-specific markers.

### Phase 5: Undo/redo UI
- Undo/redo buttons and keyboard shortcuts become part of the main UI. They exist in basic form from Phase 1.
- A history panel, with the option to replay how a map was built.

### Phase 6: Autosave and sharing
- Autosave to browser storage.
- Shareable seed links, e.g. `?seed=…`.
- (Saving and opening map files moved into Phase 2.)

### Later
- A 3D view of the terrain, probably with three.js, and sculpting tools that record brush strokes as steps.
- A command-line "map of the day" for a home-made pen plotter, outputting stroke-only SVG and possibly HPGL or G-code.
- Possibly moving to D3 v7 and `d3-delaunay`. This means reworking the mesh code, which relies on D3 v4's voronoi edge structure.

## Decisions so far
- **Desktop first.** Phone layouts aren't a goal for now.
- **Zoom and pan are not a priority.**
- **Build tools are fine** (Vite, npm).
- **Editing tools only change what you touch.**
  - Moving a feature (city, point of interest, wreck, marker) moves only its marker, and a city's label goes with it. Terrain, territories, borders and other labels stay as they are. Territories still come from the spot where the city was placed.
  - Moving a label never moves what it labels. A city label is stored as an offset from its city, so it keeps following the city if the city moves later.
- **Save files hold the step list, not the full mesh.** If replaying ever gets slow (e.g. many sculpting steps), a save can include a heightmap snapshot.
