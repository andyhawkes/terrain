// Old print, tentacles in the water and things best left unnamed.
import {poiSymbols, wreckSymbols, ripples} from './lovecraftian-symbols.js';

var parchment = new URL('../../images/parchment.jpg', import.meta.url).href;

// The tentacle drawings sit in a 90x65 box; this puts their base on the point
var wreckTransform = 'translate(-32.5,-45)';

export default {
    id: 'lovecraftian',
    name: 'Lovecraftian',
    description: 'Aged parchment, old type and things lurking offshore.',

    fonts: [
        {id: 'fell', name: 'IM Fell English', label: '"IM Fell English", serif', region: '"IM Fell English SC", serif'},
        {id: 'cinzel', name: 'Cinzel', label: '"Cinzel", serif', region: '"Cinzel", serif'},
        {id: 'rlyehian', name: 'R\'lyehian', label: '"Rlyehian", fantasy', region: '"Rlyehian", fantasy'},
        {id: 'rlyehianBase', name: 'R\'lyehian (plain)', label: '"RlyehianBase", fantasy', region: '"RlyehianBase", fantasy'}
    ],

    backgrounds: [
        {id: 'parchment', name: 'Parchment', color: '#efe3c8', image: parchment, imageScale: 1.5},
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
        marker: {kind: 'path', transform: 'rotate(45)', variants: [[
            {d: 'M-13.42,-4.47L-4.47,-4.47L-4.47,-13.42L4.47,-13.42L4.47,-4.47L13.42,-4.47L13.42,4.47L4.47,4.47L4.47,13.42L-4.47,13.42L-4.47,4.47L-13.42,4.47Z', cls: 'cross'}
        ]]}
    },

    css: [
        'MAP .wreck .tentacle { fill: var(--symbol); stroke: #fff; }',
        'MAP .wreck .ripples { fill: #fff; stroke: var(--symbol); }',
        'MAP .placedMarker .cross { fill: var(--marker); stroke: #fff; stroke-width: 1; }',
        'MAP .border { stroke-linecap: butt; }'
    ].join('\n')
};
