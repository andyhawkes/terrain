// An old sea chart: sepia ink on parchment, blackletter names, shading on
// the water along the coast, and things a pirate would mark.
import {markerSymbols} from './markers.js';

var parchment = new URL('../../images/parchment.jpg', import.meta.url).href;

var INK = '#3b2a1a';
var PAPER = '#efe3c8';
var WAVES = 'M-20,9 q5,-4 10,0 t10,0 t10,0 t10,0';

export default {
    id: 'pirate',
    name: 'Pirate',
    description: 'An old sea chart: sepia ink, blackletter names and treasure to find.',

    fonts: [
        {id: 'pirata', name: 'Pirata One', label: '"IM Fell DW Pica", serif', region: '"Pirata One", serif'},
        {id: 'fell', name: 'IM Fell', label: '"IM Fell DW Pica", serif', region: '"IM Fell DW Pica", serif',
            regionCase: 'upper'}
    ],

    backgrounds: [
        {id: 'chart', name: 'Old chart', color: '#efe3c8', image: parchment, imageScale: 1.5,
            halo: {color: '#e8d7b8', opacity: 0.85, shadow: null}},
        {id: 'sand', name: 'Sand', color: '#efe2c4', halo: {color: '#efe2c4', opacity: 0.9, shadow: null}}
    ],

    colors: {
        ink: INK,
        coast: INK,
        sea: '#47585c',
        river: '#4f6470',
        border: '#8b2e1f',
        slope: '#7a6650',
        city: INK,
        cityFill: PAPER,
        label: '#2e1f12',
        region: '#7a2414',
        halo: PAPER,
        symbol: INK,
        marker: '#b3261e'
    },

    widths: {
        coast: 3,
        sea: 1.2,
        river: 1.5,
        border: 3,
        slope: 1,
        city: 2.5,
        halo: 5
    },

    // Dots, with round ends
    borderDash: [0.5, 7],

    seaShading: true,

    // Defaults for the extras drawn over the map (see extras.js)
    extras: {units: 'leagues', perUnit: 40, compass: true},

    labels: {
        regionCase: 'normal',
        regionSpacing: '0.04em',
        regionVariant: 'normal',
        regionHalo: 9,
        shadow: null
    },

    cities: {
        capitalRadius: 8,
        townRadius: 4,
        fillOpacity: 1
    },

    symbols: {
        poi: {kind: 'path', transform: 'scale(1.6)', variants: [
            // Skull and crossbones
            [
                {d: 'M-12,-2 L12,12 M12,-2 L-12,12', cls: 'bone'},
                {d: 'M-8,1 C-10,-13 10,-13 8,1 L5,3 L5,7 L-5,7 L-5,3 Z', cls: 'ink'},
                {d: 'M-5.5,-3 a2.3,2.3 0 1,0 4.6,0 a2.3,2.3 0 1,0 -4.6,0 M0.9,-3 a2.3,2.3 0 1,0 4.6,0 a2.3,2.3 0 1,0 -4.6,0 M-2,6 L-2,3.5 M2,6 L2,3.5', cls: 'paper'}
            ],
            // Palm tree
            [
                {d: 'M-1,13 Q-3,2 2,-8 M-9,13 L9,13', cls: 'line'},
                {d: 'M2,-8 Q-5,-13 -12,-6 Q-5,-9 2,-8 Z M2,-8 Q9,-13 13,-4 Q8,-9 2,-8 Z M2,-8 Q-2,-15 -7,-15 Q-2,-12 2,-8 Z M2,-8 Q6,-16 11,-13 Q5,-12 2,-8 Z', cls: 'ink'}
            ],
            // Treasure chest
            [
                {d: 'M-11,-1 Q-11,-9 0,-9 Q11,-9 11,-1 L11,10 L-11,10 Z', cls: 'ink'},
                {d: 'M-11,-1 L11,-1 M-6,-8 L-6,10 M6,-8 L6,10', cls: 'paperLine'},
                {d: 'M-2,0.5 L2,0.5 L2,5 L-2,5 Z', cls: 'paper'}
            ],
            // Cannon
            [
                {d: 'M-13,-3 L7,-7 Q10,-5 9,-1 L-12,3 Z', cls: 'ink'},
                {d: 'M-4,7 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0', cls: 'line'},
                {d: 'M-12,12 L13,12', cls: 'line'}
            ]
        ]},
        wreck: {kind: 'path', transform: 'scale(1.5)', variants: [
            // A sinking ship with a broken mast
            [
                {d: 'M-15,3 L9,-7 Q15,0 9,5 L-12,7 Z', cls: 'ink'},
                {d: 'M-1,0 L-5,-15 M-5,-15 L-11,-10 M3,-3 L6,-10', cls: 'line'},
                {d: WAVES, cls: 'line'}
            ],
            // A sea serpent
            [
                {d: 'M-18,7 Q-14,-5 -10,7 M-6,7 Q-2,-5 2,7', cls: 'thick'},
                {d: 'M6,7 Q7,-9 13,-9 Q18,-8 16,-4 L11,-5 Q10,0 11,7 Z', cls: 'ink'},
                {d: WAVES, cls: 'line'}
            ],
            // A shark's fin
            [
                {d: 'M-7,6 Q1,-1 4,-14 Q7,-1 12,6 Z', cls: 'ink'},
                {d: WAVES, cls: 'line'}
            ]
        ]},
        // The X is a bold, brushy red cross; other markers are drawn in ink
        markers: markerSymbols('mark', {
            x: {kind: 'path', transform: 'scale(1.5)', variants: [[
                {d: 'M-12,-12 Q0,-1 12,12 M12,-12 Q1,0 -12,12', cls: 'markX'}
            ]]}
        })
    },

    parts: {
        ink: {fill: INK, stroke: 'none'},
        paper: {fill: PAPER, stroke: 'none'},
        paperLine: {fill: 'none', stroke: PAPER, 'stroke-width': 1.5},
        line: {fill: 'none', stroke: INK, 'stroke-width': 2},
        thick: {fill: 'none', stroke: INK, 'stroke-width': 4},
        bone: {fill: 'none', stroke: INK, 'stroke-width': 3.5},
        mark: {fill: 'none', stroke: 'currentColor', 'stroke-width': 3},
        markX: {fill: 'none', stroke: 'currentColor', 'stroke-width': 6}
    },

    css: [
        'MAP .note-label { font-style: italic; fill: var(--marker); }'
    ].join('\n')
};
