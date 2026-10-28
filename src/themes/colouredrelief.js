// A physical atlas or video-game world map: land coloured by height, from
// green lowlands through ochre hills and grey rock to white peaks, with blue
// seas deepening offshore and light hill shading.
import {markerSymbols} from './markers.js';
export default {
    id: 'colouredrelief',
    name: 'Coloured relief',
    description: 'Land coloured by height and blue seas, like a physical atlas.',

    fonts: [
        {id: 'sans', name: 'Source Sans', label: '"Source Sans 3", sans-serif', region: '"Source Sans 3", sans-serif'},
        {id: 'condensed', name: 'Barlow Condensed', label: '"Barlow Condensed", sans-serif', region: '"Barlow Condensed", sans-serif'}
    ],

    // The fills cover the paper, so labels and the legend box get a soft
    // white halo of their own
    backgrounds: [
        {id: 'white', name: 'White', color: '#ffffff', halo: {color: '#ffffff', opacity: 0.75}, legendColor: '#ffffff'}
    ],

    fills: {
        sea: ['#b9def0', '#86bde0', '#5698cb', '#2f6fa9', '#235a8f'],
        land: ['#7fb36d', '#9fc477', '#c6cc86', '#dcc289', '#c9a06c', '#a8876a', '#9d948c', '#c4c0bb', '#f5f4f1'],
        shading: 0.35
    },

    colors: {
        ink: '#2a3036',
        coast: '#2f5f8a',
        river: '#3478b8',
        border: '#7a3f55',
        slope: '#7a7a7a',
        city: '#1f2429',
        cityFill: '#ffffff',
        label: '#1d252c',
        region: '#38434d',
        halo: '#ffffff',
        symbol: '#2a3036',
        marker: '#c0392b'
    },

    widths: {
        coast: 1.5,
        river: 1.8,
        border: 2.5,
        slope: 1,
        city: 2.5,
        halo: 4
    },

    borderDash: [7, 4],

    // The shading stands in for slope hatching
    slopeShading: false,

    roads: {lines: [{color: '#6e5136', width: 3.6}, {color: '#f4e3a8', width: 1.8}]},

    routes: {color: '#c0392b', width: 3, dotted: [0, 9], dashed: [10, 6], arrowSize: 10, arrowSpacing: 90},

    extras: {units: 'km', perUnit: 150},

    labels: {
        regionCase: 'upper',
        regionSpacing: '0.2em',
        regionVariant: 'normal',
        regionHalo: 5,
        shadow: null
    },

    cities: {
        capitalRadius: 8,
        townRadius: 4.5,
        fillOpacity: 1
    },

    symbols: {
        poi: {kind: 'path', transform: 'scale(1.5)', variants: [
            [{d: 'M-11,9 L0,-11 L11,9 Z', cls: 'solid'}],
            [{d: 'M0,-12 L3.5,-3.5 12,-3.5 5,2 7.5,11 0,5.5 -7.5,11 -5,2 -12,-3.5 -3.5,-3.5 Z', cls: 'solid'}],
            [{d: 'M-6,12 L-6,-12 M-6,-12 L10,-7 L-6,-1', cls: 'line'}]
        ]},
        wreck: {kind: 'path', transform: 'scale(1.4)', variants: [[
            {d: 'M-16,0 Q0,9 16,0 Z', cls: 'solid'},
            {d: 'M1,0 L6,-17 M6,-17 L13,-12', cls: 'line'},
            {d: 'M-20,8 q5,-4 10,0 t10,0 t10,0 t10,0', cls: 'line'}
        ], [
            {d: 'M-3,-14 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0 M0,-11 L0,12 M-7,-5 L7,-5 M-12,4 Q-10,12 0,12 Q10,12 12,4', cls: 'line'}
        ], [
            {d: 'M-12,4 L8,-14 Q15,-4 4,4 Z', cls: 'solid'},
            {d: 'M-20,8 q5,-4 10,0 t10,0 t10,0 t10,0', cls: 'line'}
        ]]},
        markers: markerSymbols('mark', null, 'markX')
    },

    parts: {
        solid: {fill: '#2a3036', stroke: '#ffffff', 'stroke-width': 1.2},
        line: {fill: 'none', stroke: '#2a3036', 'stroke-width': 2.5},
        mark: {fill: 'none', stroke: 'currentColor', 'stroke-width': 3},
        markX: {fill: 'none', stroke: 'currentColor', 'stroke-width': 4}
    },

    css: [
        'MAP .note-label { font-style: italic; fill: var(--marker); }'
    ].join('\n')
};
