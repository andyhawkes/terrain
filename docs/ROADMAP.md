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

## 3. Wreck and point-of-interest drawings, and iconography

Make the symbols as good as the relief drawings.

- **Better drawings:** redo the rudimentary ones, starting with Pirate's wrecks, in each theme's own style (engraved, hand-drawn, stroke-only for Plotter). Generated variety, like the mountains and trees, where it suits.
- **Named kinds of point of interest:** today a point of interest is just "one of the theme's drawings". Give them meanings that every theme draws in its own way, such as tower, ruin, cave, temple, mine, camp, bridge, lighthouse, shipwreck and sea monster. The legend (item 5) needs those names, and the Add symbol picker can show them.
- **One visual language per theme:** markers, wrecks, points of interest, castles and relief should look like they come from the same hand.
- **Generated maps** could pick sensible kinds for the terrain, such as lighthouses on coasts and mines in hills.
- **Artwork found elsewhere** is only used with a clear licence. The bold icon sets looked too cartoonish next to the fine linework, so drawings are made to match the map instead.

## 4. Roads and routes

- **Roads:** an option for random maps to join towns with roads that follow easy ground, using the same cost-of-travel idea as territories. Hand-built maps can draw them too.
- **Routes:** draw a path by clicking points, for a journey, a quest or a ship's course. Routes have a style (dotted, dashed, with arrows) and an optional label.
- **Drawing:** themes style roads and routes: dashed or double lines, red journey dots for Underhill, sepia for Throne-ish, plain strokes for Plotter.
- **Measuring:** a route's length in the map's units (miles, km, leagues), shown while drawing and optionally on the map. This also covers "how far is it from here to there".
- **Editing:** roads and routes are steps like everything else. They can be moved by their points, deleted and saved.

## 5. Legend

- **A key that lists what's on the map:** cities and capitals, the kinds of point of interest and wrecks used, markers by type, roads and routes, borders, and region colours where a theme uses them.
- **Built from the map itself,** so it only lists what's actually there, in the theme's own drawings and lettering.
- **Like the other extras:** switched on under Style → Extras, movable, and deletable. Entries can be renamed, for example "Dragon lair" for a danger marker.

## Deferred

- **Replaying how a random map is made** (the algorithm-explorer side): stepping through the stages inside "New random map". Not a priority. It may be dropped altogether if the 3D view and sculpting tools happen.
- **3D view and sculpting tools.** Sculpting would record brush strokes as steps.
- **High fantasy theme:** see the ideas below; pick a direction first.
- **Relief for Fantasy and Pirate:** they could use relief symbols or hachures. Mock it up before changing either theme.
- **Pen-plotter output and A3,** until the plotter build starts. That covers clearing rivers and borders from under labels, ordering strokes to cut pen travel, and a physical paper size.
- **Smaller leftovers:**
  - Capitals can change between detail levels, so region names move.
  - Plotter lettering drops accents ("š" shows as "s").
  - Slope hatching could use a typed array if memory becomes a concern again.

## High fantasy: ideas

Underhill already covers the Tolkien-style storybook map, and Throne-ish the rival-kingdoms map. High fantasy could be something neither does. Some directions, which could be combined:

- **Illuminated atlas.**
  - Bright colour where the others are muted: deep blue seas, green lowlands, gold accents.
  - A decorative border around the whole map, an ornate compass rose, and a title cartouche.
  - Sea creatures and ships in the margins.
  - Closer to a medieval manuscript or a 16th-century atlas than to an ink sketch.
- **Coloured relief.**
  - Land coloured by height (green lowlands, ochre hills, grey rock, white peaks), the way physical atlases and video-game world maps do it.
  - That's a new kind of drawing for this project: no theme colours land by height yet. It would suit a bright, painterly theme.
- **A magical world.**
  - Points of interest for wizards' towers, portals, crystal formations, enchanted forests and floating islands.
  - Optional ley lines: glowing lines connecting magical sites.
- **Several peoples on one map.**
  - Each region named in a different language (elvish-sounding, dwarvish-sounding, human), using the existing made-up languages.
  - Matching lettering per people, for example flowing script for elves and blocky runes for dwarves.
  - That's mostly a naming feature, and other themes could use it too.

A first version could be the illuminated atlas with coloured relief, plus several peoples' names.
