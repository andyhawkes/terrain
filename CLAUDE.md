# Working on terrain

A themed fantasy map editor (a fork of mewo2/terrain). Layout and commands are in `README.md`; goals in `docs/PLAN.md`; the ordered roadmap in `docs/ROADMAP.md`. Read only what a task needs.

## Workflow

- One roadmap item or fix per branch, cut from an up-to-date `master`, one PR into `master`. Andy merges. Commit and push only when asked.
- `gh` defaults to the upstream remote (mewo2/terrain): always pass `--repo andyhawkes/terrain`.
- Start a fresh session for each new roadmap item rather than continuing a long one.
- `npm test` (Node's test runner, `test/*.test.js`, a few seconds) must pass before committing. Add a test for new core behaviour.

## Rules that must hold

- **Scope.** A change to one theme must not change how any other theme draws. New rendering behaviour is an opt-in theme setting (see `simple.js` for the format; `smoothCoast`, `regionTints`, `symbols.relief.hachures` are examples). Ask before a shared visual change.
- **Determinism.** `src/core/` has no DOM and all randomness is seeded. Each generation stage draws from its own stream (`withStream` in `random.js`), so a seed gives the same map at any detail level. A deliberate change to generation bumps `GENERATOR_VERSION` in `document.js` with a note of why.
- **Symbols** are `<symbol>`s drawn with `<use>`. Part styles go on as attributes from `theme.parts`, never CSS, and colour comes through `currentColor` (markers set `color`; a background's `paper` sets the mask fill). Safari applies the map's stylesheet inside `<use>` copies, so generic map CSS must not match symbol contents (see `themeCSS`).
- **Performance.** A4 maps at high detail are slow to edit. Redraws skip layers whose inputs haven't changed (`unchanged()` in `svg.js`); `derive.js` caches per heightmap. Don't add per-redraw work.
- **Small screens** get a notice instead of the editor (`editor.css` and `main.js` share the media query).

## Style

Plain ES modules, `var` and function expressions, as in the existing code. Short comments that say why. British spelling in UI text ("colour").

## Checking in the browser

- Start with `preview_start` name `terrain` (Vite on port 5173). Set the viewport to 1200x800 first: the pane is narrow enough to trigger the small-screen notice, which hides the map and makes measurements read zero.
- Open a test map by link: `/?seed=<seed>&theme=<id>&v=3`. Wait a couple of seconds after load: the autosave restore can overwrite a map dispatched too early.
- Prefer measuring through `javascript_tool` (element counts, bounding boxes, computed styles, an SVG fingerprint per theme compared before and after) over screenshots. Screenshot when the look itself is the question, and zoom into a region rather than taking the whole page.
- To show a close-up, set the map SVG's `viewBox` to a small region, then reload to undo.
- Note the map that was open before testing (seed and theme), put it back afterwards, and reset the viewport to desktop.
