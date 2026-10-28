# Fantasy map generator

## About this repo

This repo began as a fork of the [excellent work](https://github.com/mewo2/terrain) done by [Martin O'Leary](https://mewo2.com/) on his Uncharted Atlas project, and has been evolved significantly to create a generative map-making tool.

You can generate random maps or build one by hand from a blank start, edit it, and export it in different themes.

See [docs/PLAN.md](docs/PLAN.md) for the goals and phases in the overhaul of the original code.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the features being added to it over time.

### Running it

```
npm install
npm run dev        # start the editor at http://localhost:5173
npm test           # run the core tests
npm run build      # static build in dist/
npm run generate -- --seed hello --npts 4096 --out map.json   # generate a map without a browser
npm run generate -- --seed today                             # the map of the day
```

### Layout

- `src/core/`: map generation, independent of the DOM. All randomness is seeded. A map is a list of *steps*: see `steps.js` and `document.js`.
- `src/render/`: draws a map state as SVG.
- `src/themes/`: map themes as plain data. `simple.js` documents the format.
- `src/main.js` and `src/ui/`: the editor (top bar, tools, views and side panels).
- `css/editor.css` styles the editor; `css/map.css` only covers the diagnostic views.
- `scripts/`: command-line tools.
