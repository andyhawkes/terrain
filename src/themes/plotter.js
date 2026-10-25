// Single pen lines only, for pen plotters (and for colouring in). Everything
// is a stroke: no fills, shadows or background, labels are drawn with
// single-stroke Hershey fonts, and dashed borders are real separate lines.
export default {
    id: 'plotter',
    name: 'Plotter',
    description: 'Single pen lines only: no fills, single-stroke lettering. For pen plotters, or for colouring in.',

    // Strokes only. The renderer turns dashes into separate segments and
    // skips anything filled.
    strokeOnly: true,

    // Script capitals are hard to read, so script region names keep their case
    fonts: [
        {id: 'sans', name: 'Sans', label: {hershey: 'futural'}, region: {hershey: 'futural'}},
        {id: 'mixed', name: 'Sans and script', label: {hershey: 'futural'}, region: {hershey: 'scripts'}, regionCase: 'normal'},
        {id: 'script', name: 'Script', label: {hershey: 'scripts'}, region: {hershey: 'scripts'}, regionCase: 'normal'}
    ],

    backgrounds: [
        {id: 'none', name: 'None', color: null}
    ],

    colors: {
        ink: '#000000',
        coast: '#000000',
        river: '#000000',
        border: '#000000',
        slope: '#000000',
        city: '#000000',
        cityFill: 'none',
        label: '#000000',
        region: '#000000',
        halo: 'none',
        symbol: '#000000',
        marker: '#000000'
    },

    widths: {
        coast: 2,
        river: 1.5,
        border: 1.5,
        slope: 1,
        city: 1.5,
        halo: 0,
        label: 1.5      // pen width for Hershey lettering
    },

    borderDash: [8, 8],

    labels: {
        regionCase: 'upper',
        regionSpacing: 'normal',
        regionVariant: 'normal',
        regionHalo: 0,
        shadow: null
    },

    cities: {
        capitalRadius: 9,
        townRadius: 4,
        fillOpacity: 0
    },

    symbols: {
        poi: {kind: 'path', transform: 'scale(1.6)', variants: [
            [{d: 'M-11,9 L0,-11 L11,9 Z', cls: 'line'}],
            [{d: 'M0,-12 L3.5,-3.5 12,-3.5 5,2 7.5,11 0,5.5 -7.5,11 -5,2 -12,-3.5 -3.5,-3.5 Z', cls: 'line'}],
            [{d: 'M-6,12 L-6,-12 M-6,-12 L10,-7 L-6,-1', cls: 'line'}]
        ]},
        wreck: {kind: 'path', transform: 'scale(1.5)', variants: [[
            {d: 'M-16,0 Q0,9 16,0 Z M1,0 L6,-17 M6,-17 L13,-12', cls: 'line'},
            {d: 'M-20,8 q5,-4 10,0 t10,0 t10,0 t10,0', cls: 'line'}
        ]]},
        marker: {kind: 'path', variants: [[
            {d: 'M-11,-11 L11,11 M11,-11 L-11,11', cls: 'line'}
        ]]}
    },

    css: 'MAP .line { fill: none; stroke: var(--ink); stroke-width: 1.5; }'
};
