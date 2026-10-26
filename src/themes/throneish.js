// Rival kingdoms on aged vellum: Roman capitals, sepia ink, each realm
// washed in its own heraldic colour, and castles for the seats of power.
import {markerSymbols} from './markers.js';
import {mountains, hills} from './relief-drawings.js';

var parchment = new URL('../../images/parchment.jpg', import.meta.url).href;

var INK = '#2b2116';
var VELLUM = '#ece0c6';
var WAVES = 'M-20,9 q5,-4 10,0 t10,0 t10,0 t10,0';

// A castle with two towers and a keep, its base just below the city's spot
var CASTLE = 'M-10,4 L-10,-9 L-9,-9 L-9,-11 L-8,-11 L-8,-9 L-7,-9 L-7,-11 L-6,-11 L-6,-9 L-5,-9 L-5,-5 L-3,-5 ' +
    'L-3,-14 L-2,-14 L-2,-16 L-1,-16 L-1,-14 L1,-14 L1,-16 L2,-16 L2,-14 L3,-14 L3,-5 L5,-5 L5,-9 L6,-9 L6,-11 ' +
    'L7,-11 L7,-9 L8,-9 L8,-11 L9,-11 L9,-9 L10,-9 L10,4 Z';

export default {
    id: 'throneish',
    name: 'Throne-ish',
    description: 'Rival kingdoms on aged vellum, each washed in its own colour, with castles for capitals.',

    fonts: [
        {id: 'marcellus', name: 'Marcellus', label: '"Cormorant Garamond", serif', region: '"Marcellus SC", serif'},
        {id: 'cinzel', name: 'Cinzel', label: '"Cormorant Garamond", serif', region: '"Cinzel", serif'}
    ],

    backgrounds: [
        // paper fills the drawings (see underhill.js): nothing on the texture
        {id: 'vellum', name: 'Vellum', color: '#e9dcc2', image: parchment, imageScale: 1.5, paper: 'transparent',
            halo: {color: '#e8d7b8', opacity: 0.85, shadow: null}},
        {id: 'plain', name: 'Plain', color: VELLUM, paper: VELLUM, halo: {color: VELLUM, opacity: 0.9, shadow: null}}
    ],

    colors: {
        ink: INK,
        coast: INK,
        river: '#3d5a6c',
        border: '#6b1f1f',
        slope: INK,
        city: INK,
        cityFill: VELLUM,
        label: INK,
        region: INK,
        halo: VELLUM,
        symbol: INK,
        marker: '#8c1c1c'
    },

    widths: {
        coast: 2.2,
        river: 1.3,
        border: 1.6,
        slope: 1,
        city: 1.5,
        halo: 5
    },

    borderDash: [8, 3],

    // Each realm in its own muted heraldic colour, in watercolour
    regionTints: {
        colors: ['#8c2f2f', '#2f4a7a', '#b08a2e', '#3f6b3a', '#6b3f73', '#4f5a63', '#a0562a', '#2f6f6a'],
        opacity: 0.3,
        watercolour: true
    },

    slopeShading: false,
    smoothCoast: true,
    coastLines: [{offset: 5, width: 0.7}],

    extras: {units: 'leagues', perUnit: 400},

    labels: {
        regionCase: 'upper',
        regionSpacing: '0.18em',
        regionVariant: 'normal',
        regionHalo: 6,
        shadow: null
    },

    cities: {
        capitalRadius: 5,
        townRadius: 3,
        fillOpacity: 1
    },

    symbols: {
        // Castles for capitals
        capital: {kind: 'path', variants: [[
            {d: CASTLE, cls: 'mask'},
            {d: CASTLE, cls: 'ridge'},
            {d: 'M-1.5,4 L-1.5,0 Q0,-2 1.5,0 L1.5,4 M0,-16 L0,-21 L4,-19.5 L0,-18', cls: 'ridge'}
        ]]},
        relief: {
            spacing: {mountain: 17, hill: 18, tree: 8},
            mountain: {kind: 'path', variants: mountains(12, 23)},
            hill: {kind: 'path', variants: hills(6, 29)},
            tree: {kind: 'path', variants: [
                // Mostly pines, for cold northern woods
                [{d: 'M0,-13 L-3,-7 L-1.5,-7 L-4,-2 L4,-2 L1.5,-7 L3,-7 Z', cls: 'mask'},
                    {d: 'M0,-13 L-3,-7 L-1.5,-7 L-4,-2 L4,-2 L1.5,-7 L3,-7 Z M0,-2 L0,1', cls: 'ridge'}],
                [{d: 'M0,-11 L-3.5,-3 L3.5,-3 Z', cls: 'mask'},
                    {d: 'M0,-11 L-3.5,-3 L3.5,-3 Z M0,-3 L0,0.5', cls: 'ridge'}],
                [{d: 'M-3,-2 C-5,-4 -4,-9 0,-9 C4,-9 5,-4 3,-2 Z', cls: 'mask'},
                    {d: 'M-3,-2 C-5,-4 -4,-9 0,-9 C4,-9 5,-4 3,-2 Z M0,-2 L0,1', cls: 'ridge'}]
            ]}
        },
        poi: {kind: 'path', transform: 'scale(1.4)', variants: [
            // Ruined tower
            [{d: 'M-4,10 L-4,-6 L-2,-8 L0,-5 L2,-9 L4,-7 L4,10 Z', cls: 'mask'},
                {d: 'M-4,10 L-4,-6 L-2,-8 L0,-5 L2,-9 L4,-7 L4,10 M-1,10 L-1,6 Q0,5 1,6 L1,10 M-7,10 L7,10', cls: 'ridge'}],
            // Battlefield: crossed swords
            [{d: 'M-9,-9 L8,8 M9,-9 L-8,8 M-6,7 L-3,4 M6,7 L3,4 M-10,-6 L-6,-10 M10,-6 L6,-10', cls: 'ridge'}],
            // Shrine
            [{d: 'M-8,10 L-8,0 L0,-8 L8,0 L8,10 Z', cls: 'mask'},
                {d: 'M-8,10 L-8,0 L0,-8 L8,0 L8,10 Z M0,-8 L0,-12 M-2,-10 L2,-10 M-2,10 L-2,4 L2,4 L2,10', cls: 'ridge'}],
            // Standing stone
            [{d: 'M-4,10 L-3,-8 L2,-9 L4,10 Z', cls: 'mask'}, {d: 'M-4,10 L-3,-8 L2,-9 L4,10 Z M-8,10 L8,10', cls: 'ridge'}]
        ]},
        wreck: {kind: 'path', transform: 'scale(1.4)', variants: [
            // A longship going down
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
        ridge: {fill: 'none', stroke: INK, 'stroke-width': 1.2},
        shadow: {fill: INK, stroke: 'none'},
        crease: {fill: 'none', stroke: INK, 'stroke-width': 0.9},
        mark: {fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5}
    },

    css: [
        'MAP .note-label { font-style: italic; fill: var(--marker); }'
    ].join('\n')
};
