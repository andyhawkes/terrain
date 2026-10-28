// A modern survey map: brown contours, blue water with the sea filled,
// green woodland, a numbered kilometre grid and plain humanist lettering.
import {markerSymbols} from './markers.js';
export default {
    id: 'surveyor',
    name: 'Surveyor',
    description: 'A modern survey map: contours, woodland and a numbered kilometre grid.',

    fonts: [
        {id: 'fira', name: 'Fira Sans', label: '"Fira Sans", sans-serif', region: '"Fira Sans", sans-serif'},
        {id: 'sans', name: 'Source Sans', label: '"Source Sans 3", sans-serif', region: '"Source Sans 3", sans-serif'}
    ],

    backgrounds: [
        {id: 'white', name: 'White', color: '#ffffff', paper: '#ffffff'}
    ],

    // A flat sea and white land
    fills: {sea: ['#c6e5f3'], land: ['#ffffff']},

    woodland: {color: '#cfe6b4'},

    // The highest point stands for 600 m: a contour every 25 m, and every
    // 100 m a heavier one with its height on it
    contours: {interval: 25, top: 600, index: 4, smooth: 3, labels: true},

    colors: {
        ink: '#1f1f1f',
        coast: '#1f7fbd',
        river: '#1f7fbd',
        border: '#8b5a9c',
        slope: '#a3a3a3',
        contour: '#c0803f',
        grid: '#2f7fc1',
        city: '#3b3b3b',
        cityFill: '#f3c98b',
        label: '#1a1a1a',
        region: '#3d3d3d',
        halo: '#ffffff',
        symbol: '#1f1f1f',
        marker: '#d6262c'
    },

    widths: {
        coast: 1.4,
        river: 1.6,
        border: 2,
        slope: 1,
        contour: 0.6,
        contourIndex: 1.2,
        grid: 0.8,
        city: 1.5,
        halo: 4
    },

    // Dash and dot, like an administrative boundary
    borderDash: [9, 3, 2, 3],

    // The contours show the relief
    slopeShading: false,

    // A cased road in survey red
    roads: {lines: [{color: '#4a3b30', width: 4.2}, {color: '#e8584f', width: 2.6}]},

    routes: {color: '#d6262c', width: 3, dotted: [0, 9], dashed: [10, 6], arrowSize: 10, arrowSpacing: 90},

    // About a 1:50,000 sheet: 40 km across, with a line every 5 km
    extras: {units: 'km', perUnit: 40, grid: 'numbered', gridLabels: true, scaleBar: true, gridOpacity: 0.6},

    labels: {
        regionCase: 'upper',
        regionSpacing: '0.25em',
        regionVariant: 'normal',
        regionHalo: 5,
        shadow: null
    },

    cities: {
        capitalRadius: 7,
        townRadius: 4,
        fillOpacity: 1
    },

    // Survey symbols: church, triangulation pillar, castle, viewpoint and
    // campsite, the last two in tourist blue
    symbols: {
        poi: {kind: 'path', transform: 'scale(1.2)', variants: [
            [{d: 'M-4.5,2 a4.5,4.5 0 1,0 9,0 a4.5,4.5 0 1,0 -9,0', cls: 'solid'},
                {d: 'M0,-2.5 L0,-13 M-4,-9 L4,-9', cls: 'line'}],
            [{d: 'M-9,7 L0,-9 L9,7 Z', cls: 'blueLine'},
                {d: 'M-2,2 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0', cls: 'blue'}],
            [{d: 'M-9,8 L-9,-7 L-5.5,-7 L-5.5,-3.5 L-2,-3.5 L-2,-7 L2,-7 L2,-3.5 L5.5,-3.5 L5.5,-7 L9,-7 L9,8 Z', cls: 'solid'}],
            [{d: 'M0,6 L0,-10 M0,6 L-8,-6 M0,6 L8,-6 M0,6 L-11,1 M0,6 L11,1', cls: 'blueLine'}],
            [{d: 'M-11,8 L0,-10 L11,8 Z', cls: 'blue'}, {d: 'M-3,8 L0,2 L3,8 Z', cls: 'paper'}]
        ]},
        wreck: {kind: 'path', transform: 'scale(1.2)', variants: [[
            {d: 'M-16,0 Q0,9 16,0 Z', cls: 'solid'},
            {d: 'M1,0 L6,-17 M6,-17 L13,-12', cls: 'line'}
        ], [
            {d: 'M-12,4 L8,-14 Q15,-4 4,4 Z', cls: 'solid'}
        ]]},
        markers: markerSymbols('mark', null, 'markX')
    },

    parts: {
        solid: {fill: '#1f1f1f', stroke: 'none'},
        line: {fill: 'none', stroke: '#1f1f1f', 'stroke-width': 2},
        blue: {fill: '#1f6fb5', stroke: 'none'},
        blueLine: {fill: 'none', stroke: '#1f6fb5', 'stroke-width': 2},
        // The tent's doorway, in the paper's colour
        paper: {fill: 'currentColor', stroke: 'none'},
        mark: {fill: 'none', stroke: 'currentColor', 'stroke-width': 3},
        markX: {fill: 'none', stroke: 'currentColor', 'stroke-width': 4}
    },

    css: [
        'MAP .note-label { font-style: italic; fill: var(--marker); }'
    ].join('\n')
};
