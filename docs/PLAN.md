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
- [x] Move to Vite and ES modules. Keep D3 v4 for now (moved to v7 in Phase 8), from npm instead of vendored files.
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
  - The panel folds away with the button at the top right, leaving a strip as wide as the tool strip with icons for Build, Style and History; clicking one opens the panel at that tab. Folded or not is remembered per browser.
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
- [x] Place-name language: Random (a new made-up language per map, as before) or a named one (Plain, English-ish, Germanic, Slavic, French-ish, Welsh-ish, Hawaiian-ish, Greenlandic-ish, Arabic-ish), or Pirate names or Military codenames (see Phase 7). Chosen under New map, kept in the map's settings, and in share links as `names=`. The Build panel can rename every place in another language, which then names places added later. The CLI takes `--language`.
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
  - A scale bar, a compass rose and a title box, each in the theme's colours and lettering. The title box fits its text, measured once the theme's font has loaded, and wraps between words beyond half the map's width. The compass rose can be sized from half to six times normal, from subtle to a feature of the map; its lines keep the same weight at any size, and at its default place it stays on the map. Plotter draws them stroke-only, with single-stroke lettering.
  - The scale bar, compass and title can be dragged with Move and removed with Delete, and the title edited with Edit text.
  - All of these are part of the style, so they can be undone and are saved. A theme can set defaults (`extras` in the theme format), which apply until the map sets its own; Pirate defaults to leagues and a compass rose. A new map keeps the previous one's extras, except its title and where things were moved to. Maps with extras share as full `#map=` links.
- [x] **Military**: a field map. Pale field-green paper (or white), Big Shoulders Stencil regions in olive (Stardos Stencil until it turned out to lack accented letters such as š and ž) with Barlow Condensed towns, or an "Ops" choice of Black Ops One and Share Tech Mono (all OFL). Blue water and water-lining, brown hill shading, dash-dot borders, black town dots. Defaults to a 5 km square grid on a 50 km map, a scale bar and a small compass rose. Wrecks: the chart symbol for a wreck, a hull above water, a sea mine. Points of interest: bunker, radio mast, observation post, supply depot. The X is a target crosshair and danger a hazard sign.
- [x] Naming styles from word lists and patterns (`src/core/wordnames.js`), offered as "Pirate names" and "Military codenames" in the same Place names list as the made-up languages, so they work under New map, Rename all, share links and `--language`. Pirate: towns like Port Blackwater, Dead Man's Cove or Jolly Ned's Haven, and regions like The Bone Isles. Military: Objective Granite, Hill 312, Checkpoint Kilo, FOB Mantis, and regions like Sector Lima or Zone Viper. Names on a map don't repeat. Choosing a theme doesn't change the names.
- Later: high fantasy.

### Phase 9: Storybook relief, and more themes
- [x] Mountains, hills and trees drawn as little pictures (`reliefSymbols` in `terrain.js`, drawn by `drawRelief` in `svg.js`):
  - Mountains go on the highest land (bigger on higher peaks), hills on the middle ground, and trees in clumps (from a smooth random field) on lower land.
  - Symbols keep apart from each other, the coast and rivers, and are left out around cities.
  - They're spaced in SVG units, so they look the same at any detail.
  - They're drawn back to front so nearer ones overlap.
  - A theme supplies the drawings (`symbols.relief`) and can turn slope hatching off (`slopeShading: false`). A "Hills and forests" layer toggle shows for themes that use it.
- [x] **Underhill**: a storybook map in black and red ink on cream paper (or parchment), in the style of Tolkien's own maps:
  - Lettering: Uncial Antiqua regions in red with Almendra towns (both OFL), or Almendra throughout.
  - Bold, rugged mountains packed into ranges on the highest ground. They're generated (`src/themes/relief-drawings.js`, from a fixed seed): spires to broad massifs, slightly rough ridgelines, some with a second summit, a solid black east face with a ragged edge, and rock creases on the lit side. Hills are generated the same way, with a dark east crescent.
  - Hills, woods, and dashed red borders.
  - Drawings are filled to match the background (`paper` on a background): the cream on Paper, so nearer ones hide those behind, and nothing on Parchment, where only the ink shows.
  - A heavy, smoothed coastline with two finer lines following it out at sea.
  - Its own towers, ruins, standing stones, caves and wrecks.
- [x] Coast lines at sea (`coastLines` in the theme format): lines following the shore at set distances, worked out from each sea point's distance to land and drawn as contours of it, so they always sit on the sea side. They hide with the coastline.
- [x] A theme can ask for its coastline smoothed (`smoothCoast`), so it doesn't follow every corner of the grid. Only Underhill does; other themes draw coasts as before, and labels are placed around the unsmoothed coast for every theme.
- [x] **Shire names**, a word-list naming style: Bramblecombe, Little Cloverley, Teaselshire, The Apple Leas. Tolkien's own place names are never used.
- [x] **Throne-ish**: rival kingdoms on aged vellum (or plain vellum):
  - Lettering: Marcellus SC (or Cinzel) capitals for regions and Cormorant Garamond for towns (OFL).
  - Sepia ink and a smoothed coast with one line at sea.
  - Hachures instead of mountain symbols (`relief.hachures`):
    - Strokes start on evenly spaced contour lines across the high ground (above the middle of the land's heights) and run downhill to about the next contour, so they sit in rows like an engraved survey map.
    - They're heavier on steeper slopes and on slopes facing away from a north-west light, in three line weights.
    - Spacing is in SVG units, so it looks the same at any detail.
  - Hand-drawn trees (the generator's `trees`): lumpy broadleaf crowns and ragged pines, each different, in a lighter line. They're mixed by climate: pines in the north and on high ground, broadleaf elsewhere (a tree spec's `climate` lists, using how cold each spot is). They sit over a soft green watercolour wash (`treeWash`).
  - The generator's `engraved` style (a sepia wash and hatching in place of a solid shadow) was tried for Throne-ish's mountains and replaced by hachures. It stays available to any theme.
  - Dashed red borders, with its own ruined towers, battlefields, shrines, standing stones, longships and whirlpools.
- [x] Region tints (`regionTints` in the theme format): each region's land washed in a colour from the theme's list. The layer is see-through as a whole, so cell edges don't show. A "Region colours" toggle shows for themes that use it.
- [x] Watercolour washes (`regionTints.watercolour`): an SVG filter roughens the edges and makes the colour uneven, like pigment. It adds no noticeable time to redraws.
- [x] Castles for capitals (`symbols.capital` in the theme format). They can be moved, renamed and deleted like any city. Other themes keep circles.
- [x] **Kingdom names**: Stormhold-type compounds, keeps and halls (Embermoor, Greygarden Castle, Night's Rest), and regions like The Shattered Downs or Thornmarch Marches. Place names from the books and the show are never used.
- [x] Typography roles: regions, capitals, towns, your own text, the title (and the compass's N), grid labels and the scale bar each have a font, size (small to extra large), case (as written, capitals, small capitals) and letter spacing, under Style → Lettering. The theme's lettering choices are now presets; a role can use any font from the theme's presets. Changes are part of the style (undoable, saved, in full share links); changing theme or preset keeps sizes and resets the rest. Only what's changed is set on the text, so unchanged maps draw exactly as before. Labels are placed at the chosen sizes, and the title box is measured in the title's own lettering. Plotter's single-stroke lettering offers no small capitals or spacing. Your own text now takes the theme's label font in every theme; it had been drawn in the editor's own font. Not done: loading your own fonts. A font is only bundled once its licence is confirmed (the OlausMagnus font found online had none listed).
- Later: Fantasy and Pirate could use relief symbols too.

### Roads and routes
- [x] **Roads** on random maps, as an option in New map ("Roads between towns", on by default, and `roads=0` in seed links when off). Cities join the network one at a time, the cheapest to reach first, along the easiest ground to the nearest road already built, so roads merge instead of running side by side. Travel costs are like territories': steep climbs and high ground cost more, following or crossing a river costs extra, and the sea can't be crossed, so each island has its own network. Roads have their own random stream (they use no random numbers yet), so a seed gives the same map with or without them. Being on by default changes what a seed gives, so `GENERATOR_VERSION` is 4; seed links from version 3 open without roads (saved maps from before get them). They take about 50 ms on a square Medium map.
- [x] Roads are kept as a few points each (smoothed off the grid, then thinned) and drawn as smooth curves through them, so they can be edited. Build → Places → "Join towns with roads" does the same for hand-built maps; doing it again replaces the roads it built, but not roads you drew or reshaped.
- [x] **Routes**: the Draw road or route tool (R) draws a road or a route by clicking points; double-click or Enter finishes, Backspace takes back a point, Esc cancels. Clicking a city joins the line to it exactly. Routes are dotted, dashed or have arrows, and can have a label (asked for when a route is finished, and changed with Edit text). Clicking a route with the tool gives it the chosen style.
- [x] Editing: the Move tool shows small square handles on the points of roads and routes, except where a place sits on a point (so places can still be dragged; the point shows once the place moves off it). Route labels can be dragged on their own, kept as an offset from above the middle of the route so they follow it; Delete on a route label removes the label. Delete removes a whole road or route. Built roads stay as they are when a town moves or the terrain changes; the Draw road or route tool's "Redraw roads" button is then enabled (`roadsStale` in `steps.js`). Handles and click targets are drawn over the map by the editor only, and left out of exports. Every change is a step (`joinTowns`, `addRoad`, `addRoute`, `setRoute`, `movePoint`), so it can be undone, saved and shared.
- [x] Each theme styles its roads (`roads.lines`: lines drawn one over another, so a dark line under a narrow one in the paper colour makes a cased road) and routes (`routes`: colour, width, dot and dash patterns, arrowheads), documented in `simple.js`. Simple: a plain brown line and red routes. Fantasy: dashed tracks. Pirate: faint dashed tracks and a red course. Military: cased roads. Underhill: double-lined ink roads and red journey dots. Throne-ish: sepia. Plotter: plain strokes, with dots and dashes drawn as separate strokes. Roads and Routes can be hidden in the Style panel.
- [x] Roads go under the relief symbols, which are left off the roads so they don't hide them; routes go over everything but the labels. City labels keep off roads as they do rivers. Maps without roads or routes draw exactly as before in every theme: their layers are only added to the SVG when there is something in them.
- Not done: a single point can't be added to or removed from a finished line.

### Legend
- [x] A **legend** under Style → Extras, off by default in every theme. It's built from the map (`legendEntries` in `render/extras.js`), so it only lists what's there and showing: capitals and towns, each point of interest and wreck drawing used, markers by type and colour (a red and a blue flag are two entries), roads, each route style, borders, and each region's colour for themes with region tints. Hiding a layer takes its entries out. Swatches are the map's own drawings in the theme's style, shrunk to fit. The heading and the entries have their own lettering roles (Legend title, from the region font, and Legend entries, from the label font) under Style → Lettering. A background can colour the legend's box (`legendColor`; Simple's cream background does), and the entries' halo then matches it.
- [x] Like the other extras it can be dragged with Move and removed with Delete. It sits in the bottom-right corner and grows up and left. Edit text renames an entry or the heading (e.g. "Dragon lair" for a point of interest); Delete on an entry, or renaming it to nothing, leaves it out, and "Show all legend entries" puts them back. Names are kept in the style (`legendNames`, by entry), so they're undoable and saved, and a new map starts without them. Labels keep clear of the legend as they do the title box.
- [x] The legend measures its text and symbols, so it's only redrawn when what it shows changes. Maps without a legend draw exactly as before.
- Later: named kinds of point of interest (roadmap item 3) would give entries better default names than "Point of interest". Plotter's legend box has no fill (like its title box), so anything under it shows through.

### Phase 8: D3 v7
- [x] Moved to D3 v7, d3-array v3 and `d3-delaunay` (replacing D3 v4 and `d3-voronoi`). `npm audit` is clean: the `d3-color` warning is gone. The grid is built from the Delaunay triangulation: its vertices are the triangles' centres, kept on the map, and its edges join triangles that share a side. Tools use v7's event handling (`d3.pointer`, events passed to handlers). The grid is built differently, so `GENERATOR_VERSION` is now 3 and every seed gives a different map from before.

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
