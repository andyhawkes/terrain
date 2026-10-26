// Draws map states into SVG with D3, styled by the map's theme. Map units
// (centred on 0) are scaled into SVG user units by the map's scale, which
// setMapSize sets before drawing; text, lines and symbols are sized in SVG
// user units.
import * as d3 from 'd3';
import {derive, seaShading, relief, coastOutlines, smoothCoasts, regionShapes} from '../core/derive.js';
import {meshTris} from '../core/terrain.js';
import {itemPos} from '../core/steps.js';
import {getTheme, fontChoice, backgroundChoice} from '../themes/index.js';
import {themeCSS, labelText, hersheyPath, hersheyBox, dashPaths} from './theme.js';
import {extrasChoice, squareGrid, hexGrid, scaleBar, defaultPosition, formatDistance, wrapLines} from './extras.js';

export var SCALE = 1000;
var extent = {width: 1, height: 1};

// The SVG's drawing area for a map: [x, y, width, height] in SVG units
export function mapBox(params) {
    var scale = params.scale || 1000;
    var e = params.extent || extent;
    return [-scale * e.width / 2, -scale * e.height / 2, scale * e.width, scale * e.height];
}

// Fits the SVG to a map's shape. Returns true if the size changed, in which
// case everything needs redrawing.
export function setMapSize(svg, params) {
    var scale = params.scale || 1000;
    var e = params.extent || extent;
    var changed = scale !== SCALE || e.width !== extent.width || e.height !== extent.height;
    SCALE = scale;
    extent = e;
    var box = mapBox(params);
    if (svg.attr('viewBox') !== box.join(' ')) {
        svg.attr('viewBox', box.join(' ')).style('--map-ratio', box[2] / box[3]);
    }
    return changed;
}

// Layers in drawing order; each is a <g> so redraws keep the stacking order
var LAYERS = ['background', 'field', 'tint', 'sea', 'river', 'coastLines', 'coast', 'border', 'slope', 'relief', 'grid', 'city', 'wreck', 'poi', 'marker',
    'label', 'extras'];

// Layers the user can switch off in the Style panel
export var TOGGLE_LAYERS = [
    ['coast', 'Coastline'], ['tint', 'Region colours'], ['sea', 'Sea shading'], ['river', 'Rivers'], ['border', 'Borders'], ['slope', 'Slope shading'],
    ['relief', 'Hills and forests'],
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

// True if a layer was last drawn from the same things (compared by
// identity: map data never changes once made), so it can be left as is.
// Otherwise remembers them for next time.
function unchanged(svg, layerName, keys) {
    var node = layer(svg, layerName).node();
    var last = node.__drawnFrom;
    node.__drawnFrom = keys;
    return !!last && last.length === keys.length && last.every(function (k, i) {return k === keys[i]});
}

export function clear(svg, layerName) {
    var g = layer(svg, layerName);
    g.selectAll('*').remove();
    g.node().__drawnFrom = null;
    g.node().__mesh = null;
}

// keep: names of layers to leave as they are
export function clearAll(svg, keep) {
    LAYERS.forEach(function (name) {
        if (!keep || keep.indexOf(name) < 0) clear(svg, name);
    });
    showLayers(svg, []);
}

// The lines out at sea along the coast go with the coastline
var HIDDEN_WITH = {coastLines: 'coast'};

export function showLayers(svg, hidden) {
    LAYERS.forEach(function (name) {
        var off = hidden.indexOf(name) >= 0 || hidden.indexOf(HIDDEN_WITH[name]) >= 0;
        layer(svg, name).attr('display', off ? 'none' : null);
    });
}

// --- Diagnostic drawing ---

export function visualizeVoronoi(svg, field, lo, hi) {
    if (unchanged(svg, 'field', [field, lo, hi])) return;
    if (hi == undefined) hi = d3.max(field) + 1e-9;
    if (lo == undefined) lo = d3.min(field) - 1e-9;
    var mappedvals = field.map(function (x) {return x > hi ? 1 : x < lo ? 0 : (x - lo) / (hi - lo)});
    // The cells only need drawing again for a different grid; otherwise
    // just their colours change
    var g = layer(svg, 'field');
    var cells = g.node().__mesh === field.mesh ? g.selectAll('path.field')
        : join(svg, 'field', 'path', 'field', meshTris(field.mesh)).attr('d', makeD3Path);
    g.node().__mesh = field.mesh;
    cells.style('fill', function (d, i) {
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
    if (unchanged(svg, 'background', [background])) return;
    var g = layer(svg, 'background');
    g.selectAll('*').remove();
    var w = SCALE * extent.width;
    var h = SCALE * extent.height;
    if (background.color) {
        g.append('rect').attr('x', -w / 2).attr('y', -h / 2).attr('width', w).attr('height', h)
            .attr('fill', background.color);
    }
    if (background.image) {
        // Scaled from the map's longer side, so it covers any shape
        var size = Math.max(w, h) * (background.imageScale || 1);
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

// keys say what the paths are made from, if not the paths themselves (see
// unchanged); then paths can be a function, only called if they're needed
export function drawPaths(svg, cls, paths, keys) {
    if (unchanged(svg, cls, keys || [paths])) return;
    if (typeof paths === 'function') paths = paths();
    join(svg, cls, 'path', cls, paths)
        .attr('d', makeD3Path);
}

function coord(x) {
    return Math.round(SCALE * x * 100) / 100;
}

// Short strokes (slope hatching, sea shading) go in one path: there can be
// tens of thousands, and one element is far quicker to draw and redraw
// than one each. keys and strokes work as for drawPaths.
export function drawSlopes(svg, strokes, keys) {
    drawStrokes(svg, 'slope', strokes, keys);
}

function drawStrokes(svg, layerName, strokes, keys) {
    if (unchanged(svg, layerName, keys || [strokes])) return;
    if (typeof strokes === 'function') strokes = strokes();
    var d = strokes.map(function (s) {
        return 'M' + coord(s[0][0]) + ',' + coord(s[0][1]) + 'L' + coord(s[1][0]) + ',' + coord(s[1][1]);
    }).join('');
    join(svg, layerName, 'path', layerName, d ? [d] : [])
        .attr('d', function (d) {return d})
        .attr('fill', 'none');
}

// Towns are circles. Capitals are too, unless the theme has a symbol for
// them (symbols.capital), such as a castle.
export function drawCities(svg, state, theme) {
    var n = state.params.nterrs;
    var spec = theme.symbols.capital;
    var cities = itemData(state, 'cities', 'city');
    cities.forEach(function (d, i) {d.capital = i < n});
    var dots = spec ? cities.filter(function (d) {return !d.capital}) : cities;
    join(svg, 'city', 'circle', 'city', dots, byId)
        .attr('cx', function (d) {return SCALE*d.pos[0]})
        .attr('cy', function (d) {return SCALE*d.pos[1]})
        .attr('r', function (d) {return d.capital ? theme.cities.capitalRadius : theme.cities.townRadius});
    if (spec) ensureSymbols(svg, 'capital', spec, theme.parts);
    var prefix = '#' + svg.attr('id') + '-capital';
    join(svg, 'city', 'use', 'capital-symbol', spec ? cities.filter(function (d) {return d.capital}) : [], byId)
        .attr('x', function (d) {return SCALE*d.pos[0]})
        .attr('y', function (d) {return SCALE*d.pos[1]})
        .attr('href', function (d) {return prefix + (d.id % spec.variants.length)});
}

// Each region's land washed in a colour, for themes that tint regions. The
// layer as a whole is see-through, so where cells meet they don't show
// darker; each cell is outlined in its own colour to close the hairline
// gaps between them. With watercolour, a filter roughens the edges and
// makes the colour uneven, like pigment.
function drawTints(svg, state, d, theme) {
    var spec = theme.regionTints;
    var capitals = state.cities.slice(0, state.params.nterrs).map(function (c) {return c.vx});
    if (unchanged(svg, 'tint', [state.h, d.terr, spec, capitals.join(','), SCALE])) return;
    var g = layer(svg, 'tint');
    g.selectAll('*').remove();
    if (!spec) return;
    if (spec.watercolour) ensureWatercolour(svg);
    var wash = g.append('g').attr('opacity', spec.opacity)
        .attr('filter', spec.watercolour ? 'url(#' + svg.attr('id') + '-watercolour)' : null);
    regionShapes(state.h, d.terr, capitals).forEach(function (cells, k) {
        var color = spec.colors[k % spec.colors.length];
        wash.append('path').attr('class', 'region-tint')
            .attr('d', cells.map(function (c) {
                return 'M' + coord(c[0][0]) + ',' + coord(c[0][1]) + 'L' + coord(c[1][0]) + ',' + coord(c[1][1]) +
                    'L' + coord(c[2][0]) + ',' + coord(c[2][1]) + 'Z';
            }).join(''))
            // Inline, as the theme's stylesheet sets every path's fill and stroke
            .style('fill', color).style('stroke', color).style('stroke-width', '0.8px').style('stroke-linejoin', 'round');
    });
}

// Rough edges and uneven colour, like a watercolour wash
function ensureWatercolour(svg) {
    var id = svg.attr('id') + '-watercolour';
    var defs = svg.select('defs.symbols');
    if (!defs.select('#' + id).empty()) return;
    var f = defs.append('filter').attr('id', id).attr('x', '-5%').attr('y', '-5%').attr('width', '110%').attr('height', '110%');
    f.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', 0.035).attr('numOctaves', 3)
        .attr('seed', 3).attr('result', 'edges');
    f.append('feDisplacementMap').attr('in', 'SourceGraphic').attr('in2', 'edges').attr('scale', 9)
        .attr('xChannelSelector', 'R').attr('yChannelSelector', 'G').attr('result', 'rough');
    f.append('feGaussianBlur').attr('in', 'rough').attr('stdDeviation', 1.2).attr('result', 'soft');
    f.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', 0.012).attr('numOctaves', 2)
        .attr('seed', 8).attr('result', 'pigment');
    // Pigment strength between about 55% and 100%
    f.append('feColorMatrix').attr('in', 'pigment').attr('type', 'matrix')
        .attr('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0.45').attr('result', 'blotches');
    f.append('feComposite').attr('in', 'soft').attr('in2', 'blotches').attr('operator', 'in');
}

// Lines out at sea following the coast, for themes that draw them
function drawCoastLines(svg, h, theme) {
    var lines = theme.coastLines || [];
    if (unchanged(svg, 'coastLines', [h, lines, SCALE])) return;
    var outlines = lines.length ? coastOutlines(h, lines.map(function (l) {return l.offset / SCALE})) : [];
    var data = [];
    outlines.forEach(function (paths, i) {
        paths.forEach(function (path) {data.push({path: path, width: lines[i].width})});
    });
    join(svg, 'coastLines', 'path', 'coast-line', data)
        .attr('d', function (d) {return makeD3Path(d.path)})
        .attr('stroke-width', function (d) {return d.width});
}

// Mountains, hills and trees, for themes with relief symbols. They're left
// out around cities, so places stay clear.
var CITY_CLEARANCE = 16;

function drawRelief(svg, state, theme) {
    var spec = theme.symbols.relief;
    if (unchanged(svg, 'relief', [state.h, spec, state.cities, SCALE])) return;
    if (!spec) {
        clear(svg, 'relief');
        return;
    }
    var kinds = ['mountain', 'hill', 'tree'];
    kinds.forEach(function (kind) {ensureSymbols(svg, 'relief-' + kind, spec[kind], theme.parts)});
    var places = state.cities.map(function (c) {return itemPos(state, c)});
    var near = CITY_CLEARANCE / SCALE;
    var symbols = relief(state.h, SCALE, spec.spacing).filter(function (s) {
        return !places.some(function (p) {
            return Math.abs(p[0] - s.x) < near && Math.abs(p[1] - s.y) < near;
        });
    });
    var prefix = '#' + svg.attr('id') + '-relief-';
    // Drawn in order, back to front, so no key: nearer symbols overlap
    join(svg, 'relief', 'use', 'relief', symbols)
        .attr('href', function (d) {return prefix + d.kind + (d.variant % spec[d.kind].variants.length)})
        .attr('transform', function (d) {
            return 'translate(' + coord(d.x) + ',' + coord(d.y) + ') scale(' + d.size.toFixed(2) + ')';
        });
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
        // Marker symbols draw in currentColor, so this sets each one's colour
        .attr('color', function (d) {return d.item.color || theme.colors.marker})
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
    drawTints(svg, state, d, theme);
    drawStrokes(svg, 'sea', function () {
        return theme.seaShading ? seaShading(state.h) : [];
    }, [state.h, !!theme.seaShading]);
    drawPaths(svg, 'river', d.rivers);
    drawCoastLines(svg, state.h, theme);
    drawPaths(svg, 'coast', theme.smoothCoast ? smoothCoasts(state.h) : d.coasts);
    // Plotters ignore dash patterns, so draw each dash as its own line
    var dash = theme.strokeOnly ? theme.borderDash : [];
    drawPaths(svg, 'border', function () {
        return theme.strokeOnly ? dashPaths(d.borders, dash[0] / SCALE, dash[1] / SCALE) : d.borders;
    }, [d.borders, dash[0], dash[1]]);
    // Hershey lettering is drawn with hatching cleared from under it
    var boxes = hersheyLabelBoxes(d.labels, state.notes, theme, t.font);
    // A theme can draw relief with symbols instead of hatching
    var hatching = theme.slopeShading !== false;
    drawSlopes(svg, function () {
        if (!hatching) return [];
        return boxes.length ? d.slopes.filter(outsideBoxes(boxes)) : d.slopes;
    }, [d.slopes, boxes.length ? JSON.stringify(boxes) : '', hatching]);
    drawRelief(svg, state, theme);
    drawFeatures(svg, state, theme);
    drawLabels(svg, d.labels, state.notes, theme, t.font);
    drawExtras(svg, state, theme, t.font);
    showLayers(svg, state.style.hidden);
}

// --- Extras: grid, scale bar, compass rose, title (see extras.js) ---

// A line of text, as <text> or as Hershey strokes. size is in SVG units,
// x and y in SVG units too.
function appendText(g, family, cls, text, x, y, size, anchor) {
    if (family.hershey) {
        return g.append('path').attr('class', cls)
            .attr('d', hersheyPath(family.hershey, text, x, y, size, anchor));
    }
    return g.append('text').attr('class', cls)
        .attr('x', x).attr('y', y)
        .style('font-size', size + 'px')
        .style('text-anchor', anchor)
        .text(text);
}

function polylinePath(lines) {
    return lines.map(function (line) {
        return line.map(function (p, i) {
            return (i ? 'L' : 'M') + coord(p[0]) + ',' + coord(p[1]);
        }).join('');
    }).join('');
}

function drawGrid(svg, extras, extent, font) {
    if (unchanged(svg, 'grid', [extras.grid, extras.gridSize, extras.perUnit, extras.gridLabels,
        extent, font])) return;
    var g = layer(svg, 'grid');
    g.selectAll('*').remove();
    if (extras.grid === 'none') return;
    var size = extras.gridSize / extras.perUnit;
    if (extras.grid === 'hex') {
        var hex = hexGrid(extent, size);
        g.append('path').attr('class', 'grid').attr('d', polylinePath(hex.lines));
        if (extras.gridLabels) {
            var labelSize = Math.min(10, SCALE * size * 0.18);
            hex.labels.forEach(function (l) {
                appendText(g, font.label, 'grid-label hex-label', l.text, SCALE * l.x, SCALE * l.y + labelSize / 2,
                    labelSize, 'middle');
            });
        }
        return;
    }
    var grid = squareGrid(extent, size);
    g.append('path').attr('class', 'grid').attr('d', polylinePath(grid.lines));
    if (extras.gridLabels) {
        var edgeSize = 14;
        var top = -SCALE * extent.height / 2;
        var left = -SCALE * extent.width / 2;
        grid.columns.forEach(function (c) {
            appendText(g, font.label, 'grid-label', c.text, SCALE * c.x, top + edgeSize + 6, edgeSize, 'middle');
        });
        grid.rows.forEach(function (r) {
            appendText(g, font.label, 'grid-label', r.text, left + 8, SCALE * r.y + edgeSize / 2, edgeSize, 'start');
        });
    }
}

// The 8-point star of a compass rose: each point is two triangles, one dark
// and one light, like the classic printed rose
function compassPoints(long, short, width) {
    var dark = [];
    var light = [];
    for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        var len = i % 2 ? short : long;
        var w = i % 2 ? width * 0.7 : width;
        var tip = [Math.sin(a) * len, -Math.cos(a) * len];
        var l = [Math.sin(a - Math.PI / 2) * w, -Math.cos(a - Math.PI / 2) * w];
        var r = [Math.sin(a + Math.PI / 2) * w, -Math.cos(a + Math.PI / 2) * w];
        dark.push('M0,0L' + tip.join(',') + 'L' + l.join(',') + 'Z');
        light.push('M0,0L' + tip.join(',') + 'L' + r.join(',') + 'Z');
    }
    return {dark: dark.join(''), light: light.join('')};
}

var ORNAMENTS = {
    scaleBar: function (g, extras, extent, font) {
        var bar = scaleBar(extent, extras.perUnit);
        var length = SCALE * bar.mapLength;
        var parts = bar.marks.length - 1;
        for (var i = 0; i < parts; i++) {
            g.append('rect').attr('class', i % 2 ? 'extras-paper' : 'extras-fill')
                .attr('x', length * i / parts).attr('y', -8)
                .attr('width', length / parts).attr('height', 8);
        }
        bar.marks.forEach(function (m, i) {
            var text = formatDistance(m.value) + (i === parts ? ' ' + extras.units.name : '');
            appendText(g, font.label, 'extras-label', text, SCALE * m.x, 17, 14, 'middle');
        });
    },
    // Scaled to the chosen size, keeping its lines the same weight
    compass: function (g, extras, extent, font) {
        g.append('path').attr('class', 'extras-line')
            .attr('d', 'M-30,0a30,30 0 1,0 60,0a30,30 0 1,0 -60,0M-24,0a24,24 0 1,0 48,0a24,24 0 1,0 -48,0');
        var points = compassPoints(46, 24, 7);
        g.append('path').attr('class', 'extras-paper').attr('d', points.light);
        g.append('path').attr('class', 'extras-fill').attr('d', points.dark);
        appendText(g, font.region, 'extras-label compass-north', 'N', 0, -52, 16, 'middle');
        g.selectAll('path').attr('vector-effect', 'non-scaling-stroke');
    },
    // The box fits the title, up to half the map's width; longer titles wrap
    title: function (g, extras, extent, font) {
        var maxWidth = SCALE * extent.width / 2;
        layoutTitle(g, extras.title, font.region, maxWidth);
        // Text is measured in whatever font is showing, so measure again
        // once the theme's own font has loaded
        if (!font.region.hershey && typeof document !== 'undefined' && document.fonts) {
            document.fonts.load(TITLE_SIZE + 'px ' + font.region, extras.title).then(function () {
                if (g.node().isConnected) layoutTitle(g, extras.title, font.region, maxWidth);
            });
        }
    }
};

var TITLE_SIZE = 30;
var TITLE_PAD = 14;

// Draws the title box with its top-left corner at (0, 0)
function layoutTitle(g, title, family, maxWidth) {
    g.selectAll('*').remove();
    var size = TITLE_SIZE;
    var pad = TITLE_PAD;
    var probe = family.hershey ? null : g.append('text').attr('class', 'title-text').style('font-size', size + 'px');
    var wrapped = wrapLines(title, function (text) {
        if (family.hershey) {
            var b = hersheyBox(family.hershey, text, 0, 0, size, 'start');
            return b.x1 - b.x0;
        }
        probe.text(text);
        // Not laid out (e.g. the map is hidden): an estimate
        return probe.node().getComputedTextLength() || 0.6 * size * text.length;
    }, maxWidth - 2 * pad);
    if (probe) probe.remove();
    var lineHeight = 1.2 * size;
    var width = Math.max.apply(null, wrapped.widths.concat([size])) + 2 * pad;
    var height = 2 * pad + (wrapped.lines.length - 1) * lineHeight + size;
    g.append('rect').attr('class', 'extras-paper')
        .attr('x', 0).attr('y', 0).attr('width', width).attr('height', height);
    g.append('rect').attr('class', 'extras-line')
        .attr('x', 4).attr('y', 4).attr('width', width - 8).attr('height', height - 8);
    wrapped.lines.forEach(function (line, i) {
        appendText(g, family, 'title-text', line, width / 2, pad + 0.8 * size + i * lineHeight, size, 'middle');
    });
}

function drawExtras(svg, state, theme, font) {
    var extras = extrasChoice(theme, state.style, state.params);
    var extent = state.params.extent;
    drawGrid(svg, extras, extent, font);
    var shown = Object.keys(ORNAMENTS).filter(function (id) {
        return id === 'title' ? !!extras.title : extras[id];
    });
    var data = shown.map(function (id) {
        return {id: id, kind: 'ornament', text: id === 'title' ? extras.title : null,
            pos: extras.positions[id] || defaultPosition(id, extent, SCALE, extras.compassSize),
            scale: id === 'compass' ? extras.compassSize : 1};
    });
    var groups = join(svg, 'extras', 'g', 'ornament', data, function (d) {return d.id})
        .attr('transform', function (d) {
            return 'translate(' + coord(d.pos[0]) + ',' + coord(d.pos[1]) + ')' + (d.scale !== 1 ? ' scale(' + d.scale + ')' : '');
        });
    groups.each(function (d) {
        var g = d3.select(this);
        g.selectAll('*').remove();
        ORNAMENTS[d.id](g, extras, extent, font);
    });
}
