// A hand-drawn storybook map: black and red ink on cream paper, little
// mountains, hills and trees, and names in an uncial hand.
import {markerSymbols} from './markers.js';

var parchment = new URL('../../images/parchment.jpg', import.meta.url).href;

var INK = '#1a1a1a';
var RED = '#a3221b';
var PAPER = '#f3ead2';

// Relief drawings sit on y = 0 (their base) and are about 22 units wide
// (mountains are then scaled up a little).
// mask fills the shape with paper so nearer ones hide those behind; ridge
// is the outline, shadow the solid dark side of a mountain and shade the
// hatching on a hill.
function mountain(outline, shadow) {
    return [{d: outline + ' Z', cls: 'mask'}, {d: shadow, cls: 'shadow'}, {d: outline, cls: 'ridge'}];
}

export default {
    id: 'underhill',
    name: 'Underhill',
    description: 'A storybook map in black and red ink, with little hills, mountains and woods.',

    fonts: [
        {id: 'uncial', name: 'Uncial', label: '"Almendra", serif', region: '"Uncial Antiqua", serif'},
        {id: 'almendra', name: 'Almendra', label: '"Almendra", serif', region: '"Almendra", serif', regionCase: 'upper'}
    ],

    backgrounds: [
        {id: 'paper', name: 'Paper', color: PAPER, halo: {color: PAPER, opacity: 0.9, shadow: null}},
        {id: 'parchment', name: 'Parchment', color: '#efe3c8', image: parchment, imageScale: 1.5,
            halo: {color: '#e8d7b8', opacity: 0.85, shadow: null}}
    ],

    colors: {
        ink: INK,
        coast: INK,
        river: INK,
        border: RED,
        slope: INK,
        city: INK,
        cityFill: PAPER,
        label: INK,
        region: RED,
        halo: PAPER,
        symbol: INK,
        marker: RED
    },

    widths: {
        coast: 2.6,
        river: 1.1,
        border: 1.4,
        slope: 1,
        city: 1.5,
        halo: 5
    },

    borderDash: [5, 4],

    // Relief is drawn with the symbols below, not hatching
    slopeShading: false,

    // A bold, smoothed coast with fainter lines following it out at sea
    smoothCoast: true,
    coastLines: [{offset: 5, width: 1}, {offset: 10, width: 0.6}],

    extras: {units: 'miles', perUnit: 300},

    labels: {
        regionCase: 'normal',
        regionSpacing: '0.08em',
        regionVariant: 'normal',
        regionHalo: 7,
        shadow: null
    },

    cities: {
        capitalRadius: 5,
        townRadius: 3,
        fillOpacity: 1
    },

    symbols: {
        // Mountains, hills and trees, placed from the terrain (spacing is
        // how far apart each kind is kept, in SVG units)
        relief: {
            // Mountains close together, so they read as ranges
            spacing: {mountain: 17, hill: 18, tree: 8},
            mountain: {kind: 'path', transform: 'scale(1.25)', variants: [
                // Tall and narrow, the far side in solid shadow
                mountain('M-8,0 L-1,-20 L1,-19 L8,0', 'M1,-19 L8,0 L3,0 L2.5,-7 L1.5,-13 Z'),
                mountain('M-10,0 L-4,-15 L-2,-11 L2,-21 L10,0', 'M2,-21 L10,0 L5,0 L4,-9 Z M-4,-15 L-2,-11 L-2.5,-6 Z'),
                mountain('M-7,0 L0,-15 L7,0', 'M0,-15 L7,0 L2.5,0 L1.5,-6 Z'),
                mountain('M-9,0 L-2,-18 L0,-16 L2,-19 L9,0', 'M2,-19 L9,0 L4,0 L3,-8 Z M-2,-18 L0,-16 L-0.5,-10 Z')
            ]},
            hill: {kind: 'path', variants: [
                [{d: 'M-9,0 Q0,-10 9,0 Z', cls: 'mask'}, {d: 'M-9,0 Q0,-10 9,0', cls: 'ridge'},
                    {d: 'M3,-4 L5,-1.5 M5,-3 L6.5,-1', cls: 'shade'}],
                [{d: 'M-10,0 Q-4,-8 1,-2 Q5,-9 10,0 Z', cls: 'mask'}, {d: 'M-10,0 Q-4,-8 1,-2 Q5,-9 10,0', cls: 'ridge'},
                    {d: 'M6,-3 L7.5,-1', cls: 'shade'}]
            ]},
            tree: {kind: 'path', variants: [
                // Round-topped
                [{d: 'M-4,-3 C-7,-4 -6,-10 -2,-10 C-1,-13 4,-12 4,-9 C7,-8 6,-3 3,-3 Z', cls: 'mask'},
                    {d: 'M-4,-3 C-7,-4 -6,-10 -2,-10 C-1,-13 4,-12 4,-9 C7,-8 6,-3 3,-3 Z', cls: 'ridge'},
                    {d: 'M0,-3 L0,1', cls: 'ridge'}],
                // Pointed
                [{d: 'M0,-12 L-3,-6 L-1.5,-6 L-4,-1 L4,-1 L1.5,-6 L3,-6 Z', cls: 'mask'},
                    {d: 'M0,-12 L-3,-6 L-1.5,-6 L-4,-1 L4,-1 L1.5,-6 L3,-6 Z', cls: 'ridge'},
                    {d: 'M0,-1 L0,1.5', cls: 'ridge'}],
                // Small and round
                [{d: 'M-3,-2 C-5,-4 -4,-9 0,-9 C4,-9 5,-4 3,-2 Z', cls: 'mask'},
                    {d: 'M-3,-2 C-5,-4 -4,-9 0,-9 C4,-9 5,-4 3,-2 Z', cls: 'ridge'},
                    {d: 'M0,-2 L0,1', cls: 'ridge'}]
            ]}
        },
        poi: {kind: 'path', transform: 'scale(1.4)', variants: [
            // Tower
            [{d: 'M-4,10 L-4,-5 L-6,-5 L-6,-10 L-3.5,-10 L-3.5,-8 L-1,-8 L-1,-10 L1,-10 L1,-8 L3.5,-8 L3.5,-10 L6,-10 L6,-5 L4,-5 L4,10 Z', cls: 'mask'},
                {d: 'M-4,10 L-4,-5 L-6,-5 L-6,-10 L-3.5,-10 L-3.5,-8 L-1,-8 L-1,-10 L1,-10 L1,-8 L3.5,-8 L3.5,-10 L6,-10 L6,-5 L4,-5 L4,10 Z M-1.5,10 L-1.5,6 Q0,4 1.5,6 L1.5,10', cls: 'ridge'}],
            // Ruined arch
            [{d: 'M-9,10 L-9,-4 Q-9,-10 -2,-10 M2,-9 Q8,-8 8,-2 L8,10 M-5,10 L-5,-3 Q-5,-6 -1,-6 M4,10 L4,-2', cls: 'ridge'}],
            // Standing stones
            [{d: 'M-10,10 L-9,0 L-6,-1 L-6,10 Z M-2,10 L-2,-4 L2,-4 L2,10 Z M6,10 L6,-1 L9,0 L10,10 Z', cls: 'mask'},
                {d: 'M-10,10 L-9,0 L-6,-1 L-6,10 Z M-2,10 L-2,-4 L2,-4 L2,10 Z M6,10 L6,-1 L9,0 L10,10 Z M-12,10 L12,10', cls: 'ridge'}],
            // Cave in a hillside
            [{d: 'M-12,8 Q0,-14 12,8 Z', cls: 'mask'},
                {d: 'M-12,8 Q0,-14 12,8 M-4,8 L-4,3 Q0,-2 4,3 L4,8', cls: 'ridge'}]
        ]},
        wreck: {kind: 'path', transform: 'scale(1.4)', variants: [
            // A ship gone down, mast showing
            [{d: 'M-12,2 L10,-2 Q12,2 8,4 L-10,5 Z', cls: 'mask'},
                {d: 'M-12,2 L10,-2 Q12,2 8,4 L-10,5 Z M-1,1 L-4,-12 M-4,-12 L-9,-8 M-20,9 q5,-4 10,0 t10,0 t10,0 t10,0', cls: 'ridge'}],
            // Something in the water
            [{d: 'M-18,7 Q-14,-4 -10,7 M-6,7 Q-2,-4 2,7 M6,7 Q8,-7 13,-7 Q17,-6 15,-3 L11,-4 Q10,1 11,7 M-20,9 q5,-4 10,0 t10,0 t10,0 t10,0', cls: 'ridge'}]
        ]},
        markers: markerSymbols('mark')
    },

    parts: {
        mask: {fill: PAPER, stroke: 'none'},
        ridge: {fill: 'none', stroke: INK, 'stroke-width': 1.3},
        shadow: {fill: INK, stroke: 'none'},
        shade: {fill: 'none', stroke: INK, 'stroke-width': 1},
        mark: {fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5}
    },

    css: [
        'MAP .note-label { font-style: italic; fill: var(--marker); }'
    ].join('\n')
};
