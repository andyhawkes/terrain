// A field map: stencilled region names, a kilometre grid, blue water and
// brown hill shading, and map symbols for bunkers, masts and targets.
import {markerSymbols} from './markers.js';

var INK = '#1d1f1a';
var WATER = '#2f6fa3';
var WAVES = 'M-20,9 q5,-4 10,0 t10,0 t10,0 t10,0';

export default {
    id: 'military',
    name: 'Military',
    description: 'A field map: stencilled names, a kilometre grid and map symbols.',

    fonts: [
        {id: 'stencil', name: 'Stencil', label: '"Barlow Condensed", sans-serif', region: '"Big Shoulders Stencil Display", sans-serif'},
        {id: 'ops', name: 'Ops', label: '"Share Tech Mono", monospace', region: '"Black Ops One", sans-serif'}
    ],

    backgrounds: [
        {id: 'field', name: 'Field', color: '#eef0e2', halo: {color: '#eef0e2', opacity: 0.9, shadow: null}},
        {id: 'white', name: 'White', color: '#ffffff'}
    ],

    colors: {
        ink: INK,
        coast: '#1f4e79',
        sea: '#5b93c2',
        river: WATER,
        border: INK,
        slope: '#9b7a52',
        city: INK,
        cityFill: INK,
        label: INK,
        region: '#4a5a2a',
        halo: '#ffffff',
        symbol: INK,
        marker: '#c62828',
        grid: '#20406a'
    },

    widths: {
        coast: 2.5,
        sea: 0.8,
        river: 1.5,
        border: 2.5,
        slope: 1,
        city: 2,
        halo: 4,
        grid: 1.5
    },

    // Dash, dot
    borderDash: [10, 4, 2, 4],

    seaShading: true,

    // A kilometre grid and a scale bar to go with it
    extras: {units: 'km', perUnit: 50, grid: 'square', scaleBar: true, compass: true, compassSize: 0.6, gridOpacity: 0.55},

    labels: {
        regionCase: 'upper',
        regionSpacing: '0.2em',
        regionVariant: 'normal',
        regionHalo: 7,
        shadow: null
    },

    cities: {
        capitalRadius: 6,
        townRadius: 3.5,
        fillOpacity: 1
    },

    symbols: {
        poi: {kind: 'path', transform: 'scale(1.6)', variants: [
            // Bunker
            [
                {d: 'M-11,6 L11,6 M-8,6 A8,8 0 0,1 8,6', cls: 'line'},
                {d: 'M-4,1.5 L4,1.5', cls: 'thick'}
            ],
            // Radio mast
            [
                {d: 'M0,-10 L-6,11 M0,-10 L6,11 M-4,4 L4,4 M-2,-3 L2,-3 M-7,-15 Q-10,-11 -7,-7 M7,-15 Q10,-11 7,-7', cls: 'line'}
            ],
            // Observation post
            [
                {d: 'M0,-11 L11,8 L-11,8 Z', cls: 'line'},
                {d: 'M-2.5,2 a2.5,2.5 0 1,0 5,0 a2.5,2.5 0 1,0 -5,0', cls: 'ink'}
            ],
            // Supply depot
            [
                {d: 'M-11,-7 L11,-7 L11,7 L-11,7 Z M-11,-7 L11,7', cls: 'line'}
            ]
        ]},
        wreck: {kind: 'path', transform: 'scale(1.5)', variants: [
            // The chart symbol for a wreck
            [
                {d: 'M-14,0 L14,0 M-8,-5 L-8,5 M0,-7 L0,7 M8,-5 L8,5', cls: 'line'}
            ],
            // A hull showing above the water
            [
                {d: 'M-12,-1 L12,-1 L8,5 L-8,5 Z', cls: 'ink'},
                {d: WAVES, cls: 'line'}
            ],
            // A sea mine
            [
                {d: 'M-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0', cls: 'ink'},
                {d: 'M0,-10 L0,-6 M0,6 L0,10 M-10,0 L-6,0 M6,0 L10,0 M-7,-7 L-4.5,-4.5 M7,7 L4.5,4.5 M-7,7 L-4.5,4.5 M7,-7 L4.5,-4.5', cls: 'line'}
            ]
        ]},
        // A target for the X, a hazard sign for danger
        markers: markerSymbols('mark', {
            x: {kind: 'path', transform: 'scale(1.5)', variants: [[
                {d: 'M-10,0 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0 M-15,0 L-4,0 M4,0 L15,0 M0,-15 L0,-4 M0,4 L0,15', cls: 'mark'}
            ]]},
            danger: {kind: 'path', transform: 'scale(1.5)', variants: [[
                {d: 'M0,-13 L13,10 L-13,10 Z M0,-5 L0,3 M0,6.5 L0,7', cls: 'mark'}
            ]]}
        })
    },

    parts: {
        ink: {fill: INK, stroke: 'none'},
        line: {fill: 'none', stroke: INK, 'stroke-width': 2},
        thick: {fill: 'none', stroke: INK, 'stroke-width': 3.5},
        mark: {fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5}
    },

    css: [
        'MAP .border { stroke-linecap: butt; }',
        'MAP .note-label { font-style: italic; }'
    ].join('\n')
};
