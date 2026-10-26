# Fantasy map generator

## About this fork

This fork is turning the original demo into a map-making tool. You can generate random maps or build one by hand from a blank start, edit it, and export it in different themes. See [docs/PLAN.md](docs/PLAN.md) for the goals and phases.

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

## Original README

This is code for generating fantasy maps, using the algorithm behind [@unchartedatlas][uncharted]. For more details, see [these notes][notes].

## Dependencies

This code depends on the following:

 * [D3.js][d3] (tested with version 4.2.0)
 * Adam Hooper's [js-priority-queue][priority]
 * My [language generation code][language]

## Support, licensing, ongoing development

This project is, from my perspective, finished.

The code is available under the [MIT license][license], so you can fork it,
improve it, learn from it, build upon it. However, I have no interest in
maintaining it as an ongoing open source project, nor in providing support for
it. Pull requests will be either ignored or closed.

If you do make something interesting with this code, please do still let me know! I'm sorry that I can't provide any support, but I am still genuinely interested in seeing creative applications of the code.

[uncharted]: https://twitter.com/unchartedatlas
[notes]: https://mewo2.com/notes/terrain/
[language]: https://github.com/mewo2/naming-language/
[priority]: https://github.com/adamhooper/js-priority-queue
[d3]: https://d3js.org/
[license]: https://github.com/mewo2/terrain/blob/master/LICENSE.md
