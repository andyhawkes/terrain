// High fantasy as a hand-coloured Dutch or French atlas of around 1700:
// an engraved plate on cream paper, the sea left as paper, each realm
// coloured along its borders in pink, yellow, green or orange, inside a
// yellow graduated border, with an ornate compass rose and a title
// cartouche.
import {markerSymbols} from './markers.js';
import {mountains, hills, trees} from './relief-drawings.js';

var parchment = new URL('../../images/parchment.jpg', import.meta.url).href;

// Pigments as they look washed onto old paper, not printed colour
var INK = '#2e241b';
var GOLD = '#d9b84a';
var YELLOW = '#e6cc5a';
var RED = '#c0503a';
var BLUE = '#5b7fae';
var VELLUM = '#f3ead2';
var WAVES = 'M-20,9 q5,-4 10,0 t10,0 t10,0 t10,0';

// Trees are painted green, not left in the paper's colour
function painted(drawing) {
    return drawing.map(function (part) {return part.cls === 'mask' ? {d: part.d, cls: 'crown'} : part});
}

export default {
    id: 'illuminated',
    name: 'Illuminated atlas',
    description: 'A hand-coloured old atlas: realms edged in colour, a yellow border, monsters and ships.',

    // Engraved Roman capitals spaced out for realms, an old book face for
    // places; or blackletter
    fonts: [
        {id: 'fell', name: 'IM Fell', label: '"IM Fell English", serif', region: '"IM Fell DW Pica", serif'},
        {id: 'gotisch', name: 'Grenze Gotisch', label: '"IM Fell English", serif', region: '"Grenze Gotisch", serif',
            regionCase: 'normal'}
    ],

    // paper colours the mountains: a pale ochre wash
    backgrounds: [
        {id: 'cream', name: 'Cream paper', color: VELLUM, paper: '#e6d3a4', halo: {color: VELLUM, opacity: 0.7}, legendColor: VELLUM},
        // paper fills the drawings (see underhill.js): nothing on the texture
        {id: 'parchment', name: 'Parchment', color: '#efe3c8', image: parchment, imageScale: 1.5, paper: 'transparent',
            halo: {color: '#e8d7b8', opacity: 0.8}, legendColor: VELLUM}
    ],

    // Each realm coloured strongly along its borders and coast, lightly
    // within
    regionTints: {
        colors: ['#d9708a', '#e0b83a', '#5f9e57', '#e08a3c', '#9b7cc0', '#5fa5a0'],
        opacity: 0.85,
        watercolour: true,
        edge: {width: 9, inside: 0.2}
    },

    // A yellow border between ink rules, with a graduated strip inside it
    // like a plate's degree scale
    frame: {
        width: 20,
        bands: [
            {at: 7, width: 11.5, color: YELLOW, wash: true},
            {at: 0, width: 0.6, color: INK},
            {at: 1, width: 3, color: INK, dash: [24, 24]},
            {at: 4.4, width: 0.6, color: INK},
            {at: 7, width: 0.5, color: INK},
            {at: 7.5, width: 2.5, color: INK, dash: [0.5, 11.5]},
            {at: 18.6, width: 1.4, color: INK}
        ]
    },

    // Coloured by hand: washes of colour under crisp ink
    compassRose: {gold: GOLD, red: RED, blue: BLUE, paper: VELLUM, ink: INK, wash: 0.85},
    cartouche: {gold: GOLD, paper: VELLUM, ink: INK, scroll: BLUE, cloth: '#d9708a', wash: 0.85},

    colors: {
        ink: INK,
        coast: INK,
        river: INK,
        border: INK,
        slope: '#6b5a3a',
        city: INK,
        cityFill: GOLD,
        label: INK,
        region: INK,
        halo: VELLUM,
        symbol: INK,
        marker: RED
    },

    widths: {
        coast: 1.5,
        river: 0.9,
        border: 1.1,
        slope: 1,
        city: 1.5,
        halo: 4
    },

    // Dotted, as engraved
    borderDash: [1.5, 2.5],

    slopeShading: false,
    smoothCoast: true,
    // A little water-lining, as an engraver drew it
    coastLines: [{offset: 3.5, width: 0.6}, {offset: 7, width: 0.4}],

    roads: {lines: [{color: '#7a4a24', width: 2}]},
    routes: {color: RED, width: 2.6, dotted: [0, 7], dashed: [10, 5], arrowSize: 10, arrowSpacing: 90},

    extras: {units: 'leagues', perUnit: 400, compass: true, compassSize: 1.5},

    labels: {
        regionCase: 'upper',
        regionSpacing: '0.35em',
        regionVariant: 'normal',
        regionHalo: 5,
        shadow: null
    },

    cities: {
        capitalRadius: 6,
        townRadius: 3.5,
        fillOpacity: 1
    },

    symbols: {
        relief: {
            spacing: {mountain: 17, hill: 18, tree: 8},
            mountain: {kind: 'path', variants: mountains(14, 7)},
            hill: {kind: 'path', variants: hills(8, 11)},
            tree: {kind: 'path', climate: {cold: [0, 1, 2, 3], warm: [4, 5, 6, 7, 8, 9]},
                variants: trees(4, 41, 'pine').concat(trees(6, 43, 'broadleaf')).map(painted)}
        },
        poi: {kind: 'path', transform: 'scale(1.4)', variants: [
            // Tower
            [{d: 'M-4,10 L-4,-5 L-6,-5 L-6,-10 L-3.5,-10 L-3.5,-8 L-1,-8 L-1,-10 L1,-10 L1,-8 L3.5,-8 L3.5,-10 L6,-10 L6,-5 L4,-5 L4,10 Z', cls: 'mask'},
                {d: 'M-4,10 L-4,-5 L-6,-5 L-6,-10 L-3.5,-10 L-3.5,-8 L-1,-8 L-1,-10 L1,-10 L1,-8 L3.5,-8 L3.5,-10 L6,-10 L6,-5 L4,-5 L4,10 Z M-1.5,10 L-1.5,6 Q0,4 1.5,6 L1.5,10', cls: 'ridge'}],
            // Shrine
            [{d: 'M-8,10 L-8,0 L0,-8 L8,0 L8,10 Z', cls: 'mask'},
                {d: 'M-8,10 L-8,0 L0,-8 L8,0 L8,10 Z M0,-8 L0,-12 M-2,-10 L2,-10 M-2,10 L-2,4 L2,4 L2,10', cls: 'ridge'}],
            // Standing stone
            [{d: 'M-4,10 L-3,-8 L2,-9 L4,10 Z', cls: 'mask'}, {d: 'M-4,10 L-3,-8 L2,-9 L4,10 Z M-8,10 L8,10', cls: 'ridge'}]
        ]},
        wreck: {kind: 'path', transform: 'scale(1.4)', variants: [
            // A ship going down
            [{d: 'M-13,2 Q0,7 12,-2 L9,-6 Q8,0 0,1 Q-8,1 -11,-3 Z', cls: 'mask'},
                {d: 'M-13,2 Q0,7 12,-2 L9,-6 Q8,0 0,1 Q-8,1 -11,-3 Z M0,1 L-2,-12 M-2,-12 L5,-8 L-1,-5 ' + WAVES, cls: 'ridge'}],
            // A whirlpool
            [{d: 'M0,0 m-2,0 a2,2 0 1,1 4,0 a4,4 0 1,1 -8,0 a6,6 0 1,1 12,0 a8,8 0 1,1 -16,0', cls: 'ridge'}]
        ]},
        markers: markerSymbols('mark')
    },

    parts: {
        // The background's paper colour (see backgrounds)
        mask: {fill: 'currentColor', stroke: 'none'},
        shadow: {fill: '#a9844f', stroke: 'none'},
        ridge: {fill: 'none', stroke: INK, 'stroke-width': 1.1},
        crease: {fill: 'none', stroke: INK, 'stroke-width': 0.6},
        crown: {fill: '#8fb27a', stroke: 'none'},
        leaf: {fill: 'none', stroke: INK, 'stroke-width': 0.8},
        twig: {fill: 'none', stroke: INK, 'stroke-width': 0.6},
        mark: {fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5}
    },

    css: [
        'MAP .note-label { font-style: italic; fill: var(--marker); }'
    ].join('\n')
};
