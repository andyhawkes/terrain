// Extras drawn over the map: a square or hex grid, a scale bar, a compass
// rose, a title box and a legend. This works out what to draw, in map units; svg.js
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
    {id: 'numbered', name: 'Numbered'},
    {id: 'hex', name: 'Hex'}
];

import {MARKER_TYPES, ROUTE_STYLES} from '../core/steps.js';

var DEFAULTS = {units: 'miles', perUnit: 100, grid: 'none', gridLabels: true, scaleBar: false, compass: false,
    compassSize: 1, legend: false};

// The compass rose can go from subtle to a feature of the map
export var COMPASS_SIZES = {min: 0.5, max: 6};

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
        compassSize: Math.min(COMPASS_SIZES.max, Math.max(COMPASS_SIZES.min, pick(style.compassSize, t.compassSize))),
        title: style.title || '',
        legend: pick(style.legend, t.legend),
        legendNames: style.legendNames || {},
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

// A survey grid: the square grid's lines, numbered by their distance in
// units (perUnit to a map unit) from the bottom-left corner, eastings along
// the top for the lines across and northings down the left for the lines
// up, two digits at least, like a national grid
export function numberedGrid(extent, size, perUnit) {
    var left = -extent.width / 2;
    var bottom = extent.height / 2;
    var lines = squareGrid(extent, size).lines;
    var number = function (map) {
        var n = Math.round(map * perUnit * 100) / 100;
        return n < 10 && n === Math.round(n) ? '0' + n : formatDistance(n);
    };
    var eastings = [];
    var northings = [];
    lines.forEach(function (l) {
        if (l[0][0] === l[1][0]) eastings.push({x: l[0][0], text: number(l[0][0] - left)});
        else northings.push({y: l[0][1], text: number(bottom - l[0][1])});
    });
    return {lines: lines, eastings: eastings, northings: northings};
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

// The compass rose reaches this far from its centre, in SVG units at
// normal size (its N sits above the top point)
export var COMPASS_RADIUS = 70;

// Default places for the movable extras, inside the map's edges. scale is
// SVG units per map unit; a bigger compass rose sits further in, so it
// stays on the map. inset ([across, down] in map units) moves them all in
// further, inside a theme's frame.
export function defaultPosition(id, extent, scale, compassSize, inset) {
    var w = extent.width / 2 - (inset ? inset[0] : 0);
    var h = extent.height / 2 - (inset ? inset[1] : 0);
    var reach = COMPASS_RADIUS * (compassSize || 1) / (scale || 1000);
    return {
        scaleBar: [-w + 0.07, h - 0.06],
        compass: [w - 0.03 - reach, -h + 0.03 + reach],
        // The title box's top-left corner
        title: [-w + 0.04, -h + 0.04],
        // The legend's bottom-right corner, so it grows away from the edges
        legend: [w - 0.04, h - 0.04]
    }[id];
}

// Splits text into lines no wider than maxWidth, breaking between words
// (a word longer than that gets a line to itself). measure gives a line's
// width. Returns the lines and their widths.
export function wrapLines(text, measure, maxWidth) {
    var words = text.trim().split(/\s+/).filter(Boolean);
    var lines = [];
    var line = '';
    words.forEach(function (word) {
        var longer = line ? line + ' ' + word : word;
        if (line && measure(longer) > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = longer;
        }
    });
    if (line) lines.push(line);
    return {lines: lines, widths: lines.map(measure)};
}

// --- Legend ---

// How many drawings a symbol set has
function variantCount(spec) {
    return (spec.kind === 'text' ? spec.chars : spec.variants).length;
}

// What the legend lists: only what's on the map and showing, in order
// (places, symbols, markers, roads, routes, borders, region colours).
// Each entry has a key that the map's own names for entries are kept by
// (legendNames, where '' leaves an entry out), and what its swatch draws.
// hasBorders says whether any borders were drawn.
export function legendEntries(state, theme, names, hasBorders) {
    var hidden = state.style.hidden || [];
    var shown = function (layer) {return hidden.indexOf(layer) < 0};
    var entries = [];
    var add = function (entry) {
        if (entries.some(function (e) {return e.key === entry.key})) return;
        entries.push(entry);
    };
    var capitals = state.cities.slice(0, state.params.nterrs);
    if (shown('city')) {
        if (capitals.length) add({key: 'capital', kind: 'capital', name: 'Capital'});
        if (state.cities.length > capitals.length) add({key: 'town', kind: 'town', name: 'Town'});
    }
    [['poi', 'poi', 'Point of interest'], ['wreck', 'wrecks', 'Wreck']].forEach(function (s) {
        if (!shown(s[0])) return;
        var count = variantCount(theme.symbols[s[0]]);
        state[s[1]].forEach(function (item) {
            var variant = (item.variant || 0) % count;
            add({key: s[0] + ':' + variant, kind: s[0], variant: variant, name: s[2]});
        });
    });
    if (shown('marker')) {
        state.markers.forEach(function (m) {
            var type = MARKER_TYPES.find(function (t) {return t.id === m.type}) || MARKER_TYPES[0];
            var color = m.color || theme.colors.marker;
            // Markers of one type in different colours often mean different things
            add({key: 'marker:' + type.id + ':' + color, kind: 'marker', type: type.id, color: color, name: type.name});
        });
    }
    if (shown('road') && (state.roads || []).length) add({key: 'road', kind: 'road', name: 'Road'});
    if (shown('route')) {
        (state.routes || []).forEach(function (r) {
            var style = ROUTE_STYLES.find(function (s) {return s.id === r.style}) || ROUTE_STYLES[0];
            add({key: 'route:' + style.id, kind: 'route', style: style.id,
                name: style.id === 'arrows' ? 'Route' : style.name + ' route'});
        });
    }
    if (shown('border') && hasBorders) add({key: 'border', kind: 'border', name: 'Border'});
    if (theme.regionTints && shown('tint')) {
        var colors = theme.regionTints.colors;
        capitals.forEach(function (c, k) {
            add({key: 'region:' + c.id, kind: 'region', color: colors[k % colors.length],
                opacity: theme.regionTints.opacity, name: c.regionName || 'Region ' + (k + 1)});
        });
    }
    return entries.map(function (e) {
        return names[e.key] == null ? e : Object.assign({}, e, {name: names[e.key]});
    }).filter(function (e) {return e.name !== ''});
}

export var LEGEND_HEADING = 'Legend';
export var LEGEND = {text: 15, heading: 20, pad: 12, swatch: [36, 22], gap: 10, row: 26};

// Where everything in a legend goes, in SVG units, with its bottom-right
// corner at (0, 0). sizes are the scales of the entries' and heading's
// lettering; measure(role, text, size) gives a line's width.
export function legendLayout(entries, heading, measure, sizes) {
    var L = LEGEND;
    var text = L.text * sizes.text;
    var headingSize = L.heading * sizes.heading;
    var row = Math.max(L.row, 1.6 * text);
    var textX = L.pad + L.swatch[0] + L.gap;
    var widest = Math.max.apply(null, [0].concat(entries.map(function (e) {return measure('legend', e.name, text)})));
    var headingWidth = heading ? measure('legendTitle', heading, headingSize) : 0;
    var width = Math.max(textX + widest, L.pad + headingWidth) + L.pad;
    var top = L.pad + (heading ? 1.4 * headingSize : 0);
    var height = top + entries.length * row + L.pad;
    return {
        width: width,
        height: height,
        x: -width,
        y: -height,
        textSize: text,
        headingSize: headingSize,
        heading: heading ? {x: -width / 2, y: -height + L.pad + 0.8 * headingSize} : null,
        rows: entries.map(function (e, i) {
            var cy = -height + top + (i + 0.5) * row;
            return {entry: e, swatch: [-width + L.pad + L.swatch[0] / 2, cy], text: [-width + textX, cy + 0.35 * text]};
        })
    };
}
