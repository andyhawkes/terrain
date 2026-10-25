// Draws map states into SVG with D3, styled by the map's theme. Map units
// (roughly -0.5..0.5) are scaled by 1000 into SVG user units.
import * as d3 from 'd3';
import {derive} from '../core/derive.js';
import {itemPos} from '../core/steps.js';
import {getTheme, fontChoice, backgroundChoice} from '../themes/index.js';
import {themeCSS, labelText, hersheyPath, hersheyBox, dashPaths} from './theme.js';

export var SCALE = 1000;

// Layers in drawing order; each is a <g> so redraws keep the stacking order
var LAYERS = ['background', 'field', 'river', 'coast', 'border', 'slope', 'city', 'wreck', 'poi', 'marker', 'label'];

// Layers the user can switch off in the Style panel
export var TOGGLE_LAYERS = [
    ['coast', 'Coastline'], ['river', 'Rivers'], ['border', 'Borders'], ['slope', 'Slope shading'],
    ['city', 'Cities'], ['label', 'Labels'], ['wreck', 'Wrecks'], ['poi', 'Points of interest'],
    ['marker', 'Markers']
];

export function addSVG(div, id) {
    var svg = div.append('svg')
        .attr('viewBox', '-500 -500 1000 1000')
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('id', id);
    svg.append('style').attr('class', 'theme');
    svg.append('defs').attr('class', 'symbols');
    LAYERS.forEach(function (name) {
        svg.append('g').attr('class', 'layer-' + name);
    });
    return svg;
}

function layer(svg, name) {
    return svg.select('g.layer-' + name);
}

export function makeD3Path(path) {
    var p = d3.path();
    p.moveTo(SCALE*path[0][0], SCALE*path[0][1]);
    for (var i = 1; i < path.length; i++) {
        p.lineTo(SCALE*path[i][0], SCALE*path[i][1]);
    }
    return p.toString();
}

// Generic data join: one element per datum, all with the given class.
// Elements of that class but a different tag (from another theme) are dropped.
function join(svg, layerName, tag, cls, data, key) {
    var g = layer(svg, layerName);
    g.selectAll('.' + cls).filter(function () {return this.tagName !== tag}).remove();
    var sel = g.selectAll(tag + '.' + cls).data(data, key);
    sel.exit().remove();
    // Clear any temporary offset left over from dragging
    return sel.enter().append(tag).classed(cls, true).merge(sel).attr('transform', null);
}

function byId(d) {
    return d.id;
}

export function clear(svg, layerName) {
    layer(svg, layerName).selectAll('*').remove();
}

export function clearAll(svg) {
    LAYERS.forEach(function (name) {clear(svg, name)});
    showLayers(svg, []);
}

export function showLayers(svg, hidden) {
    LAYERS.forEach(function (name) {
        layer(svg, name).attr('display', hidden.indexOf(name) >= 0 ? 'none' : null);
    });
}

// --- Diagnostic drawing ---

export function visualizeVoronoi(svg, field, lo, hi) {
    if (hi == undefined) hi = d3.max(field) + 1e-9;
    if (lo == undefined) lo = d3.min(field) - 1e-9;
    var mappedvals = field.map(function (x) {return x > hi ? 1 : x < lo ? 0 : (x - lo) / (hi - lo)});
    join(svg, 'field', 'path', 'field', field.mesh.tris)
        .attr('d', makeD3Path)
        .style('fill', function (d, i) {
            return d3.interpolateViridis(mappedvals[i]);
        });
}

// --- Theme ---

// Puts the theme's stylesheet into the SVG (only when it has changed)
export function applyTheme(svg, style) {
    var theme = getTheme(style.theme);
    var font = fontChoice(theme, style);
    var background = backgroundChoice(theme, style);
    var css = themeCSS(theme, font, background, '#' + svg.attr('id'));
    var el = svg.select('style.theme');
    if (el.text() !== css) el.text(css);
    return {theme: theme, font: font, background: background};
}

function drawBackground(svg, background) {
    var g = layer(svg, 'background');
    g.selectAll('*').remove();
    if (background.color) {
        g.append('rect').attr('x', -500).attr('y', -500).attr('width', 1000).attr('height', 1000)
            .attr('fill', background.color);
    }
    if (background.image) {
        var size = 1000 * (background.imageScale || 1);
        g.append('image').attr('href', background.image)
            .attr('x', -size / 2).attr('y', -size / 2).attr('width', size).attr('height', size)
            .attr('preserveAspectRatio', 'xMidYMid slice');
    }
}

// <symbol>s for a path-based symbol set, rebuilt when the set changes.
// Each part gets its style from theme.parts directly: CSS can't reach
// inside a <use>.
function ensureSymbols(svg, kind, spec, parts) {
    var node = svg.node();
    node.__symbols = node.__symbols || {};
    if (node.__symbols[kind] === spec) return;
    node.__symbols[kind] = spec;
    var defs = svg.select('defs.symbols');
    defs.selectAll('symbol.' + kind).remove();
    spec.variants.forEach(function (partList, i) {
        var g = defs.append('symbol')
            .attr('class', kind)
            .attr('id', svg.attr('id') + '-' + kind + i)
            .attr('overflow', 'visible')
            .append('g')
            .attr('transform', spec.transform || null);
        partList.forEach(function (part) {
            var path = g.append('path').attr('d', part.d).attr('class', part.cls)
                .attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
            var style = parts[part.cls] || {};
            Object.keys(style).forEach(function (prop) {path.attr(prop, style[prop])});
        });
    });
}

// --- Map features ---

// Each item is drawn with a datum of {id, kind, pos} so the editing tools can
// work out what was clicked or dragged.
function itemData(state, list, kind) {
    return state[list].map(function (item) {
        return {id: item.id, kind: kind, pos: itemPos(state, item), item: item};
    });
}

export function drawPaths(svg, cls, paths) {
    join(svg, cls, 'path', cls, paths)
        .attr('d', makeD3Path);
}

export function drawSlopes(svg, strokes) {
    join(svg, 'slope', 'line', 'slope', strokes)
        .attr('x1', function (d) {return SCALE*d[0][0]})
        .attr('y1', function (d) {return SCALE*d[0][1]})
        .attr('x2', function (d) {return SCALE*d[1][0]})
        .attr('y2', function (d) {return SCALE*d[1][1]});
}

export function drawCities(svg, state, theme) {
    var n = state.params.nterrs;
    join(svg, 'city', 'circle', 'city', itemData(state, 'cities', 'city'), byId)
        .attr('cx', function (d) {return SCALE*d.pos[0]})
        .attr('cy', function (d) {return SCALE*d.pos[1]})
        .attr('r', function (d, i) {return i < n ? theme.cities.capitalRadius : theme.cities.townRadius});
}

// Points of interest and wrecks, drawn with the theme's symbols
function drawSymbols(svg, layerName, cls, data, spec, parts) {
    if (spec.kind === 'text') {
        join(svg, layerName, 'text', cls, data, byId)
            .attr('x', function (d) {return SCALE*d.pos[0]})
            .attr('y', function (d) {return SCALE*d.pos[1]})
            .style('font-size', spec.size + 'px')
            .style('font-family', spec.font || null)
            .style('text-anchor', 'middle')
            .text(function (d) {return spec.chars[(d.item.variant || 0) % spec.chars.length]});
        return;
    }
    ensureSymbols(svg, cls, spec, parts);
    var prefix = '#' + svg.attr('id') + '-' + cls;
    join(svg, layerName, 'use', cls, data, byId)
        .attr('x', function (d) {return SCALE*d.pos[0]})
        .attr('y', function (d) {return SCALE*d.pos[1]})
        .attr('href', function (d) {return prefix + ((d.item.variant || 0) % spec.variants.length)});
}

export function drawFeatures(svg, state, theme) {
    theme = theme || applyTheme(svg, state.style).theme;
    drawCities(svg, state, theme);
    drawSymbols(svg, 'wreck', 'wreck', itemData(state, 'wrecks', 'wreck'), theme.symbols.wreck, theme.parts);
    drawSymbols(svg, 'poi', 'poi', itemData(state, 'poi', 'poi'), theme.symbols.poi, theme.parts);
    drawMarkers(svg, state, theme);
}

// Markers of every type share a layer; each type has its own symbol
function drawMarkers(svg, state, theme) {
    var specs = theme.symbols.markers;
    Object.keys(specs).forEach(function (type) {
        ensureSymbols(svg, 'marker-' + type, specs[type], theme.parts);
    });
    var prefix = '#' + svg.attr('id') + '-marker-';
    join(svg, 'marker', 'use', 'placedMarker', itemData(state, 'markers', 'marker'), byId)
        .attr('class', function (d) {return 'placedMarker ' + markerType(d.item, specs)})
        .attr('x', function (d) {return SCALE*d.pos[0]})
        .attr('y', function (d) {return SCALE*d.pos[1]})
        .attr('href', function (d) {return prefix + markerType(d.item, specs) + '0'});
}

function markerType(marker, specs) {
    return specs[marker.type] ? marker.type : 'x';
}

var NOTE_SIZE = 24;

// City and region names, plus the user's own text notes
function labelSets(labels, font, notes) {
    return [
        {kind: 'city', dataKind: 'cityLabel', cls: 'city-label', labels: labels.cities, family: font.label,
            size: function (l) {return l.size}, anchor: function (l) {return l.align}},
        {kind: 'region', dataKind: 'regionLabel', cls: 'region-label', labels: labels.regions, family: font.region,
            size: function (l) {return SCALE*l.size}, anchor: function () {return 'middle'}},
        {kind: 'note', dataKind: 'note', cls: 'note-label', family: font.label,
            labels: notes.map(function (n) {return {id: n.id, x: n.pos[0], y: n.pos[1], text: n.text, item: n}}),
            size: function () {return NOTE_SIZE}, anchor: function () {return 'middle'}}
    ];
}

// Labels as text, or as single-stroke Hershey paths
export function drawLabels(svg, labels, notes, theme, font) {
    labelSets(labels, font, notes).forEach(function (set) {
        var data = set.labels.map(function (l) {
            return {id: l.id, kind: set.dataKind, pos: [l.x, l.y], label: l, item: l.item,
                text: labelText(theme, font, set.kind, l.text)};
        });
        if (set.family.hershey) {
            join(svg, 'label', 'path', set.cls, data, byId)
                .attr('d', function (d) {
                    return hersheyPath(set.family.hershey, d.text, SCALE*d.pos[0], SCALE*d.pos[1],
                        set.size(d.label), set.anchor(d.label));
                });
        } else {
            join(svg, 'label', 'text', set.cls, data, byId)
                .attr('x', function (d) {return SCALE*d.pos[0]})
                .attr('y', function (d) {return SCALE*d.pos[1]})
                .style('font-size', function (d) {return set.size(d.label) + 'px'})
                .style('text-anchor', function (d) {return set.anchor(d.label)})
                .text(function (d) {return d.text});
        }
    });
}

// Pen lettering has no halo, so hatching under it is left out instead.
// Boxes are in map units, with a little padding.
function hersheyLabelBoxes(labels, notes, theme, font) {
    var boxes = [];
    labelSets(labels, font, notes).forEach(function (set) {
        if (!set.family.hershey) return;
        set.labels.forEach(function (l) {
            if (!l.text) return;
            var size = set.size(l);
            var b = hersheyBox(set.family.hershey, labelText(theme, font, set.kind, l.text),
                SCALE*l.x, SCALE*l.y, size, set.anchor(l));
            var pad = 0.25 * size;
            boxes.push([(b.x0 - pad) / SCALE, (b.y0 - pad) / SCALE, (b.x1 + pad) / SCALE, (b.y1 + pad) / SCALE]);
        });
    });
    return boxes;
}

function outsideBoxes(boxes) {
    return function (stroke) {
        return !boxes.some(function (b) {
            return stroke.some(function (p) {
                return p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3];
            });
        });
    };
}

// The finished map
export function drawMap(svg, state) {
    var d = derive(state);
    var t = applyTheme(svg, state.style);
    var theme = t.theme;
    drawBackground(svg, t.background);
    drawPaths(svg, 'river', d.rivers);
    drawPaths(svg, 'coast', d.coasts);
    // Plotters ignore dash patterns, so draw each dash as its own line
    drawPaths(svg, 'border', theme.strokeOnly
        ? dashPaths(d.borders, theme.borderDash[0] / SCALE, theme.borderDash[1] / SCALE)
        : d.borders);
    var boxes = hersheyLabelBoxes(d.labels, state.notes, theme, t.font);
    drawSlopes(svg, boxes.length ? d.slopes.filter(outsideBoxes(boxes)) : d.slopes);
    drawFeatures(svg, state, theme);
    drawLabels(svg, d.labels, state.notes, theme, t.font);
    showLayers(svg, state.style.hidden);
}
