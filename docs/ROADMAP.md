# Roadmap

What's next, in order. `PLAN.md` records what's been done and the decisions behind it; this file is the list of what to do next. Each item gets its own branch and pull request.

Ground rules that apply to all of it:

- **Keep changes to what's asked.** New behaviour goes in as theme settings that a theme turns on, so other themes look exactly as before unless a change is meant to apply to all of them. When it is, say so up front.
- **Check that nothing else changed.** Fingerprint the SVG each theme draws before a change and compare afterwards.
- **Fonts and artwork need a clear licence.** OFL fonts via Fontsource are fine. Fonts or drawings without a stated licence aren't bundled.

## 1. Region labels that don't clash

Region names sometimes run into each other. On the Throne-ish test map, "REDGARDEN VALE" and "THE SILENT REACH" read as one line, and on Underhill "The Apple Leas" touched "Brambleby Fields". The longer word-list names make it more likely.

- Region labels should avoid each other, as they already avoid rivers, borders and town labels.
- They should also avoid the title box, scale bar and compass rose, and never run off the map.
- If a name can't fit anywhere, try a smaller size or splitting it over two lines before letting it overlap.
- **This changes label placement in every theme.** That's the point of the fix, but labels on existing maps will move. Compare before and after on several seeds and shapes, and check that town labels aren't made worse.

Status: Complete

## 2. Typography

Choose fonts per role, not just one pairing per theme.

- **Roles:** regions, capitals, towns, your own text, the title, grid labels and the scale bar.
- **Per role:** font, size (a few steps, such as small to large), case (as written, capitals, small capitals) and letter spacing.
- **Themes offer presets** (today's lettering choices become presets) and a set of fonts that suit them. Anything you change is part of the map's style, so it can be undone and is saved.
- **Labels must still fit:** label placement works with the chosen sizes, and the title box measures the chosen font.
- **Fonts with a hanging baseline** (like R'lyehian) keep working through the existing `rise` setting.
- **Open questions:**
  - Should any font be usable in any theme, or only the theme's own set?
  - Should you be able to load your own font files? That would mean storing them with the map, and the licence is then yours to check.

Status: Complete

## 3. Wreck and point-of-interest drawings, and iconography

Make the symbols as good as the relief drawings.

- **Better drawings:** redo the rudimentary ones, starting with Pirate's wrecks, in each theme's own style (engraved, hand-drawn, stroke-only for Plotter). Generated variety, like the mountains and trees, where it suits.
- **Named kinds of point of interest:** today a point of interest is just "one of the theme's drawings". Give them meanings that every theme draws in its own way, such as tower, ruin, cave, temple, mine, camp, bridge, lighthouse, shipwreck and sea monster. The legend (item 5) needs those names, and the Add symbol picker can show them.
- **One visual language per theme:** markers, wrecks, points of interest, castles and relief should look like they come from the same hand.
- **Generated maps** could pick sensible kinds for the terrain, such as lighthouses on coasts and mines in hills.
- **Artwork found elsewhere** is only used with a clear licence. The bold icon sets looked too cartoonish next to the fine linework, so drawings are made to match the map instead.

Status: Not started (needs active human input, aesthetic taste, and judgement)

## 4. Roads and routes

- **Roads:** an option for random maps to join towns with roads that follow easy ground, using the same cost-of-travel idea as territories. Hand-built maps can draw them too.
- **Routes:** draw a path by clicking points, for a journey, a quest or a ship's course. Routes have a style (dotted, dashed, with arrows) and an optional label.
- **Drawing:** themes style roads and routes: dashed or double lines, red journey dots for Underhill, sepia for Throne-ish, plain strokes for Plotter.
- **Editing:** roads and routes are steps like everything else. They can be moved by their points, deleted and saved.

Status: Complete

## 5. Legend

- **A key that lists what's on the map:** cities and capitals, the kinds of point of interest and wrecks used, markers by type, roads and routes, borders, and region colours where a theme uses them.
- **Built from the map itself,** so it only lists what's actually there, in the theme's own drawings and lettering.
- **Like the other extras:** switched on under Style → Extras, movable, and deletable. Entries can be renamed, for example "Dragon lair" for a danger marker.

Status: Complete

## 6. Several peoples on one map

A naming feature that any theme can use.

- **Different names per region:** each region (or group of regions) named in its own made-up language, e.g. elvish-sounding, dwarvish-sounding and human. The languages already exist; this assigns them per region and names the region's towns to match.
- **Matching lettering (optional):** a theme can give each people its own lettering, such as flowing script for one and blocky capitals for another. That depends on typography roles (item 2).
- **Choices:** under New map and Rename all, "Several peoples" alongside Random and the named languages, with how many peoples there are.
- **Open question:** should neighbouring regions tend to share a people, so peoples form larger areas rather than a patchwork?

## 7. New themes

The order among these is still open. Several need the same new drawing features, so those come first:

- **Sea and land fills:** filling the sea (or the land) with a colour, not just drawing the coastline. Most themes so far rely on the paper colour.
- **Colour by height:** colouring land by elevation, in bands or smoothly.
- **Contour lines:** lines at fixed height intervals, optionally labelled. The coastline is already a contour at sea level.
- **Woodland areas:** forests drawn as filled shapes as well as, or instead of, tree symbols.

Status: Complete. Sea and land fills and colour by height (`fills`), contour lines (`contours`) and woodland areas (`woodland`).

### Illuminated atlas

High fantasy as a richly coloured old atlas, closer to a medieval manuscript or a 16th-century atlas than to an ink sketch:

- Bright colour: deep blue seas, green lowlands, gold accents.
- A decorative border around the whole map, an ornate compass rose and a title cartouche.
- Sea creatures and ships in the margins.
- It would suit several peoples' names (item 6).

Status: Not started

### Coloured relief

A physical atlas or video-game world map:

- Land coloured by height: green lowlands, ochre hills, grey rock, white peaks.
- Blue seas, deeper offshore.
- Clean modern lettering, rivers in blue, and light hill shading.

Status: Complete

### Ordnance Survey style

A modern British survey map:

- Brown contour lines at regular intervals.
- Blue water, with the sea filled.
- Green woodland areas.
- A numbered kilometre grid (eastings and northings), not lettered squares.
- Survey-style symbols: church, triangulation pillar, castle, viewpoint, campsite and so on.
- Roads in survey colours, once roads exist (item 4).
- **Lettering:** a clean humanist sans. The real survey fonts aren't openly licensed, so an OFL one with a similar feel.
- **Name:** "Ordnance Survey" is a trademark, so the theme should be called something like "Surveyor".

Status: In progress, as **Surveyor**. Everything above is drawn; the point-of-interest symbols are simple stand-ins awaiting a decision on their artwork.

## Deferred

- **Replaying how a random map is made** (the algorithm-explorer side): stepping through the stages inside "New random map". Not a priority. It may be dropped altogether if the 3D view and sculpting tools happen.
- **3D view and sculpting tools.** Sculpting would record brush strokes as steps.
- **Magical world:** points of interest for wizards' towers, portals, crystal formations, enchanted forests and floating islands, with optional glowing ley lines between magical sites. Parked for now; it could become part of a theme later.
- **Relief for Fantasy and Pirate:** they could use relief symbols or hachures. Mock it up before changing either theme.
- **Pen-plotter output and A3,** until the plotter build starts. That covers clearing rivers and borders from under labels, ordering strokes to cut pen travel, and a physical paper size.
- **Measuring:** a route's length in the map's units (miles, km, leagues), shown while drawing and optionally on the map. This also covers "how far is it from here to there".
- **Smaller leftovers:**
  - Capitals can change between detail levels, so region names move.
  - Plotter lettering drops accents ("š" shows as "s").
  - Slope hatching could use a typed array if memory becomes a concern again.
