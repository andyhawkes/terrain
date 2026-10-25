// Old print, tentacles in the water and things best left unnamed.
import {poiSymbols, wreckSymbols, ripples} from './fantasy-symbols.js';
import {markerSymbols} from './markers.js';

var parchment = new URL('../../images/parchment.jpg', import.meta.url).href;

// The tentacle drawings sit in a 90x65 box; this puts their base on the point
var wreckTransform = 'translate(-32.5,-45)';

export default {
    id: 'fantasy',
    name: 'Fantasy',
    description: 'Aged parchment, old type and things lurking offshore.',

    fonts: [
        {id: 'fell', name: 'IM Fell English', label: '"IM Fell English", serif', region: '"IM Fell English SC", serif'},
        {id: 'cinzel', name: 'Cinzel', label: '"Cinzel", serif', region: '"Cinzel", serif'},
        {id: 'rlyehian', name: 'R\'lyehian', label: '"Rlyehian", fantasy', region: '"Rlyehian", fantasy'},
        {id: 'rlyehianBase', name: 'R\'lyehian (plain)', label: '"RlyehianBase", fantasy', region: '"RlyehianBase", fantasy'}
    ],

    backgrounds: [
        // A white halo looks like stickers on parchment, so use the paper's
        // own (slightly lighter) tone instead
        {id: 'parchment', name: 'Parchment', color: '#efe3c8', image: parchment, imageScale: 1.5,
            halo: {color: '#e8d7b8', opacity: 0.85, shadow: null}},
        {id: 'plain', name: 'Plain', color: '#ffffff'}
    ],

    colors: {
        ink: '#000000',
        coast: '#000033',
        river: '#000066',
        border: '#660000',
        slope: '#333333',
        city: '#333333',
        cityFill: '#333333',
        label: '#000000',
        region: '#660000',
        halo: '#ffffff',
        symbol: '#000000',
        marker: '#cc0000'
    },

    widths: {
        coast: 4,
        river: 2,
        border: 5,
        slope: 1,
        city: 5,
        halo: 5
    },

    borderDash: [4, 4],

    labels: {
        regionCase: 'normal',
        regionSpacing: 'normal',
        regionVariant: 'small-caps',
        regionHalo: 10,
        shadow: '3px 3px 2px #fff'
    },

    cities: {
        capitalRadius: 10,
        townRadius: 4,
        fillOpacity: 0.25
    },

    symbols: {
        poi: {kind: 'text', chars: Array.from(poiSymbols), size: 60, font: 'sans-serif'},
        wreck: {kind: 'path', transform: wreckTransform, variants: wreckSymbols.map(function (d) {
            return [{d: d, cls: 'tentacle'}, {d: ripples, cls: 'ripples'}];
        })},
        // The treasure X is the original solid red cross
        markers: markerSymbols('mark', {
            x: {kind: 'path', transform: 'rotate(45) scale(1.3)', variants: [[
                {d: 'M-13.42,-4.47L-4.47,-4.47L-4.47,-13.42L4.47,-13.42L4.47,-4.47L13.42,-4.47L13.42,4.47L4.47,4.47L4.47,13.42L-4.47,13.42L-4.47,4.47L-13.42,4.47Z', cls: 'cross'}
            ]]}
        })
    },

    parts: {
        tentacle: {fill: '#000000', stroke: '#ffffff'},
        ripples: {fill: '#ffffff', stroke: '#000000'},
        cross: {fill: '#cc0000', stroke: '#ffffff', 'stroke-width': 1},
        mark: {fill: 'none', stroke: '#cc0000', 'stroke-width': 3}
    },

    css: [
        'MAP .note-label { font-style: italic; }',
        'MAP .border { stroke-linecap: butt; }'
    ].join('\n')
};
