// Extras drawn over the map: a square or hex grid, a scale bar, a compass
// rose and a title box. This works out what to draw, in map units; svg.js
// draws it. Which extras are shown is part of the map's style (see
// defaultStyle in core/steps.js), with defaults from the theme.

export var UNITS = [
    {id: 'miles', name: 'miles', one: 'mile'},
    {id: 'km', name: 'km', one: 'km'},
    {id: 'leagues', name: 'leagues', one: 'league'}
];

export var GRIDS = [
    {id: 'none', name: 'None'},
    {id: 'square', name: 'Square'},
    {id: 'hex', name: 'Hex'}
];

var DEFAULTS = {units: 'miles', perUnit: 100, grid: 'none', gridLabels: true, scaleBar: false, compass: false};

// The extras for a map: the style's choices, falling back to the theme's
function pick(value, fallback) {
    return value == null ? fallback : value;
}

export function extrasChoice(theme, style, params) {
    var t = Object.assign({}, DEFAULTS, theme.extras);
    var e = params.extent;
    var units = UNITS.find(function (u) {return u.id === pick(style.units, t.units)}) || UNITS[0];
    var perUnit = pick(style.perUnit, t.perUnit);
    return {
        units: units,
        perUnit: perUnit,
        grid: pick(style.grid, t.grid),
        // About eight squares across the map's shorter side, unless chosen
        gridSize: style.gridSize || niceNumber(perUnit * Math.min(e.width, e.height) / 8),
        gridLabels: pick(style.gridLabels, t.gridLabels),
        scaleBar: pick(style.scaleBar, t.scaleBar),
        compass: pick(style.compass, t.compass),
        title: style.title || '',
        positions: style.positions || {}
    };
}

// The nearest of 1, 2, 2.5, 5, 10, 20, 25, 50... at or below x
export function niceNumber(x) {
    if (!(x > 0)) return 1;
    var power = Math.pow(10, Math.floor(Math.log10(x)));
    var steps = [1, 2, 2.5, 5, 10];
    var best = power;
    steps.forEach(function (s) {
        if (s * power <= x * 1.0000001) best = s * power;
    });
    return best;
}

// Distances for display: no trailing zeros, at most two decimals
export function formatDistance(x) {
    return String(Math.round(x * 100) / 100);
}

// Column names for a lettered grid: A..Z, then AA, AB...
export function columnName(i) {
    var name = '';
    i++;
    while (i > 0) {
        var rem = (i - 1) % 26;
        name = String.fromCharCode(65 + rem) + name;
        i = Math.floor((i - 1) / 26);
    }
    return name;
}

function pad2(n) {
    return n < 10 ? '0' + n : String(n);
}

// A square grid from the top-left corner. size is in map units. Returns line
// segments, plus labels for the columns (along the top) and rows (down the
// left side), each placed in the middle of its square.
export function squareGrid(extent, size) {
    var left = -extent.width / 2;
    var top = -extent.height / 2;
    var lines = [];
    var columns = [];
    var rows = [];
    for (var i = 0, x = left; x < -left + 1e-9; i++, x = left + i * size) {
        if (i > 0 && x < -left - 1e-9) lines.push([[x, top], [x, -top]]);
        if (x + size / 2 < -left) columns.push({x: x + size / 2, text: columnName(i)});
    }
    for (var j = 0, y = top; y < -top + 1e-9; j++, y = top + j * size) {
        if (j > 0 && y < -top - 1e-9) lines.push([[left, y], [-left, y]]);
        if (y + size / 2 < -top) rows.push({y: y + size / 2, text: String(j + 1)});
    }
    return {lines: lines, columns: columns, rows: rows};
}

// Flat-topped hexes, size across from flat side to flat side (in map
// units), in columns from the top-left corner with every other column half
// a hex lower. Each hex adds only its top three sides, so no side is drawn
// twice; hexes are added a little past the edges to fill them. Labels are
// "column row" numbers, 0101 at the top left, near the top of each hex.
export function hexGrid(extent, size) {
    var r = size / Math.sqrt(3);
    var left = -extent.width / 2;
    var top = -extent.height / 2;
    var lines = [];
    var labels = [];
    var cols = Math.ceil(extent.width / (1.5 * r)) + 2;
    var rows = Math.ceil(extent.height / size) + 2;
    for (var c = -1; c < cols; c++) {
        // The first column sits just inside the left edge
        var cx = left + r + c * 1.5 * r;
        for (var row = -1; row < rows; row++) {
            var cy = top + size / 2 + row * size + (c % 2 !== 0 ? size / 2 : 0);
            var corner = function (deg) {
                var a = deg * Math.PI / 180;
                return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
            };
            lines.push([corner(180), corner(240), corner(300), corner(360)]);
            var inside = cx - r / 2 > left && cx + r / 2 < -left && cy - size / 2 >= top - 1e-9 && cy + size / 2 <= -top + 1e-9;
            if (inside && c >= 0 && row >= 0) labels.push({x: cx, y: cy - size * 0.32, text: pad2(c + 1) + pad2(row + 1)});
        }
    }
    return {lines: lines, labels: labels};
}

// A scale bar about a fifth of the map's width: its length in units, in
// map units, and where its marks go
export function scaleBar(extent, perUnit) {
    var length = niceNumber(perUnit * extent.width / 5);
    var mapLength = length / perUnit;
    var parts = length % 4 === 0 || length < 4 ? 4 : length % 5 === 0 ? 5 : 2;
    var marks = [];
    for (var i = 0; i <= parts; i++) marks.push({x: mapLength * i / parts, value: length * i / parts});
    return {length: length, mapLength: mapLength, marks: marks};
}

// Default places for the movable extras, inside the map's edges
export function defaultPosition(id, extent) {
    var w = extent.width / 2;
    var h = extent.height / 2;
    return {
        scaleBar: [-w + 0.07, h - 0.06],
        compass: [w - 0.1, -h + 0.12],
        title: [-w + 0.05, -h + 0.07]
    }[id];
}
