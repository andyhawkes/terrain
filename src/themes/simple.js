// A clean, modern atlas look. This file doubles as the reference for the
// theme format.
import {markerSymbols} from './markers.js';
export default {
    id: 'simple',
    name: 'Simple',
    description: 'Clean lines and plain labels. Easy to read and print.',

    // Label fonts the user can pick from; the first is the default. label is
    // used for cities, region for region names. A value of the form
    // {hershey: 'name'} draws single-stroke Hershey text instead (see plotter.js).
    // A font can also override labels.regionCase, and set rise for fonts
    // whose letters hang below the baseline: how far to raise text, in ems.
    fonts: [
        {id: 'sans', name: 'Source Sans', label: '"Source Sans 3", sans-serif', region: '"Source Sans 3", sans-serif'},
        {id: 'classic', name: 'Cinzel', label: '"Cinzel", serif', region: '"Cinzel", serif'}
    ],

    // Backgrounds to choose from; the first is the default. image is drawn
    // behind the map, scaled up by imageScale and centred. halo can override
    // the label halo for this background: {color, opacity, shadow}. paper
    // sets currentColor for relief, point of interest and wreck symbols, so
    // their fills can suit the background (see underhill.js). legendColor
    // fills the legend's box, which is otherwise the halo colour.
    backgrounds: [
        {id: 'white', name: 'White', color: '#ffffff'},
        {id: 'cream', name: 'Cream', color: '#f7f2e4', legendColor: '#f7f2e4'}
    ],

    colors: {
        ink: '#2b2b2b',        // default for lines without their own colour
        coast: '#1d3557',
        river: '#4a7fb5',
        border: '#a05a6a',
        slope: '#a3a3a3',
        city: '#2b2b2b',
        cityFill: '#ffffff',
        label: '#222222',
        region: '#5c5c5c',
        halo: '#ffffff',       // outline behind labels, so they stay readable
        symbol: '#2b2b2b',     // points of interest and wrecks
        marker: '#c62828'
    },

    widths: {
        coast: 3,
        river: 2,
        border: 3,
        slope: 1,
        city: 3,
        halo: 6
    },

    borderDash: [6, 5],

    // Roads: lines drawn one over another, widest first, each with a colour,
    // a width in SVG units and an optional dash pattern. A dark line under a
    // narrower one in color 'paper' (the background's colour) makes a cased
    // road. Plotter themes get their dashes as separate strokes.
    roads: {lines: [{color: '#8a7a66', width: 2}]},

    // Routes the user draws (a journey, a quest, a ship's course): colour,
    // width, and the dash patterns of dotted and dashed routes (a dash of no
    // length with round ends is a dot). Routes with arrows are solid, with an
    // open arrowhead (arrowSize long) every arrowSpacing and at the end.
    routes: {color: '#c62828', width: 3, dotted: [0, 9], dashed: [10, 6], arrowSize: 10, arrowSpacing: 90},

    // regionTints: {colors: [...], opacity, watercolour, edge} washes each
    // region's land in a colour (one per region, in turn), optionally with a
    // watercolour effect (see throneish.js). edge: {width, inside} keeps the
    // colour strong in a band width wide (SVG units) along each region's
    // borders and coast, with inside of its strength within, as old atlases
    // were coloured (see illuminated.js)

    // fills: {sea: [...], land: [...], bands, shading} fills the sea and
    // the land in colour by height, each a list of colours from the coast
    // outwards (a single colour is a flat fill), relative to the map's
    // deepest sea and highest point. bands: true gives steps of flat colour
    // rather than a blend; shading (0 to 1) adds light hill shading from the
    // north-west (see colouredrelief.js)

    // woodland: {color, outline, width} draws forests as filled areas, where
    // relief's trees would grow (and on hills too), optionally with a line
    // around them in outline. It hides with the forests; leave relief's
    // tree out to draw the areas instead of trees (see surveyor.js)

    // contours: {interval, top, index, smooth, labels} draws contour lines.
    // The map's highest point stands for top (say, in metres), with a line
    // every interval and every index-th line heavier; smooth is how many
    // times to smooth them, and labels numbers the heavier ones with their
    // height. Colour colors.contour, widths widths.contour and
    // widths.contourIndex (see surveyor.js)

    // frame: {width, bands, corner} draws a decorative frame around the
    // map, its inside on the edge of the margin where coasts stop: bands
    // of colour, each {at, width, color, dash, wash} with at its distance
    // out from the margin (wash: true paints it in watercolour, under the
    // other bands), and a corner drawing (a path spec, as below) in each
    // corner. width is how far it reaches out. The extras move in to sit
    // inside it, labels keep off it, and regionTints stop at it (see
    // illuminated.js)

    // graticule: {spacing, width, color} draws straight lines of latitude
    // and longitude every spacing SVG units out from the map's centre,
    // inside the margin, in that colour and width. The frame's dashed bands
    // are centred on each side, so a spacing that's a whole number of a
    // band's dashes puts each line on a tick (see illuminated.js)

    // compassRose: {gold, red, blue, paper, ink} draws an ornate compass
    // rose in those colours instead of the plain one; cartouche: {gold,
    // paper, ink, scroll, cloth} draws the title in a cartouche with scrolls
    // rather than a box, with a cloth swag and a shell if cloth is set. Either can take wash (an opacity), to colour it by hand: washes
    // under crisp lines in the ink colour (see illuminated.js)

    // seaPictures: {count, clearance, spacing, transform, variants} puts up
    // to count drawings (path specs, as below, facing right, standing on
    // the water at 0) out on open water, clearance from the shore and
    // spacing apart (SVG units), towards the map's edges. Those on the
    // right-hand side face left. No theme uses it for now: Illuminated's
    // drawings were too childish, and wait on a pass over the artwork

    // smoothCoast: true draws the coastline smoothed, rather than following
    // every corner of the grid (see underhill.js)

    // Lines on the sea following the coast, like hand-drawn maps: each at an
    // offset from the shore, with a stroke width, in SVG units, e.g.
    // coastLines: [{offset: 6, width: 1}, {offset: 13, width: 0.6}],

    // Short strokes on the sea along the coast, like old charts' water-lining
    // (colour colors.sea and width widths.sea, or the coast's and 1)
    seaShading: false,

    // Defaults for extras drawn over the map, used until the map sets its
    // own (see render/extras.js): units ('miles', 'km', 'leagues'), perUnit
    // (units across one map unit), grid ('none', 'square', 'numbered',
    // 'hex'), gridLabels, scaleBar, compass, and gridOpacity for the grid's lines
    extras: {units: 'miles', perUnit: 100},

    labels: {
        regionCase: 'upper',    // 'upper' or 'normal'
        regionSpacing: '0.15em',
        regionVariant: 'normal',
        regionHalo: 8,
        shadow: null            // CSS drop-shadow() arguments, or null
    },

    cities: {
        capitalRadius: 9,
        townRadius: 5,
        fillOpacity: 1
    },

    // Point symbols. Each item has a variant number: random for generated
    // items, or the one the user picked. Variant n draws the (n mod count)th
    // drawing, so a theme can offer any number of variants.
    //   {kind: 'text', chars: [...], size, font}: a character from a font
    //   {kind: 'path', variants: [[{d, cls}...]...], transform}: SVG paths
    //     drawn around (0, 0), optionally transformed (e.g. scaled); cls lets
    //     the CSS below style parts separately
    symbols: {
        poi: {kind: 'path', transform: 'scale(1.6)', variants: [
            [{d: 'M-11,9 L0,-11 L11,9 Z', cls: 'solid'}],
            [{d: 'M0,-12 L3.5,-3.5 12,-3.5 5,2 7.5,11 0,5.5 -7.5,11 -5,2 -12,-3.5 -3.5,-3.5 Z', cls: 'solid'}],
            [{d: 'M-6,12 L-6,-12 M-6,-12 L10,-7 L-6,-1', cls: 'line'}]
        ]},
        wreck: {kind: 'path', transform: 'scale(1.5)', variants: [[
            {d: 'M-16,0 Q0,9 16,0 Z', cls: 'solid'},
            {d: 'M1,0 L6,-17 M6,-17 L13,-12', cls: 'line'},
            {d: 'M-20,8 q5,-4 10,0 t10,0 t10,0 t10,0', cls: 'line'}
        ], [
            {d: 'M-3,-14 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0 M0,-11 L0,12 M-7,-5 L7,-5 M-12,4 Q-10,12 0,12 Q10,12 12,4', cls: 'line'}
        ], [
            {d: 'M-12,4 L8,-14 Q15,-4 4,4 Z', cls: 'solid'},
            {d: 'M-20,8 q5,-4 10,0 t10,0 t10,0 t10,0', cls: 'line'}
        ]]},
        // One spec per marker type: x, danger, flag, camp, star
        markers: markerSymbols('mark', null, 'markX')
        // A theme can also draw relief as little pictures (see underhill.js):
        // relief: {spacing: {mountain, hill, tree}, mountain, hill, tree},
        // with spacing in SVG units and each kind a path spec like these.
        // Kinds can be left out; relief.hachures ({spacing, levels, widths})
        // shades the high ground with hachures instead (see throneish.js).
        // slopeShading: false, at the top level, then turns hatching off.
    },

    // How each part (cls) of a symbol is drawn, as SVG style properties.
    // These go directly on the symbol's paths: page CSS can't style the
    // inside of a <use>, and plotting software may ignore CSS altogether.
    parts: {
        solid: {fill: '#2b2b2b', stroke: 'none'},
        line: {fill: 'none', stroke: '#2b2b2b', 'stroke-width': 3},
        // Markers use currentColor: the colour the user picked for each one
        mark: {fill: 'none', stroke: 'currentColor', 'stroke-width': 3},
        markX: {fill: 'none', stroke: 'currentColor', 'stroke-width': 4}
    },

    // Extra CSS for the map's own elements (not symbols: see parts), with MAP
    // standing for the map's own selector
    css: [
        'MAP .note-label { font-style: italic; fill: var(--marker); }'
    ].join('\n')
};
