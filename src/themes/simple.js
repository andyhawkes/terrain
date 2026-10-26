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
    // A font can also override labels.regionCase.
    fonts: [
        {id: 'sans', name: 'Source Sans', label: '"Source Sans 3", sans-serif', region: '"Source Sans 3", sans-serif'},
        {id: 'classic', name: 'Cinzel', label: '"Cinzel", serif', region: '"Cinzel", serif'}
    ],

    // Backgrounds to choose from; the first is the default. image is drawn
    // behind the map, scaled up by imageScale and centred. halo can override
    // the label halo for this background: {color, opacity, shadow}.
    backgrounds: [
        {id: 'white', name: 'White', color: '#ffffff'},
        {id: 'cream', name: 'Cream', color: '#f7f2e4'}
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

    // Short strokes on the sea along the coast, like old charts' water-lining
    // (colour colors.sea and width widths.sea, or the coast's and 1)
    seaShading: false,

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
