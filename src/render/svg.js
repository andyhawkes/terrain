// Draws map states into SVG with D3, styled by the map's theme. Map units
// (centred on 0) are scaled into SVG user units by the map's scale, which
// setMapSize sets before drawing; text, lines and symbols are sized in SVG
// user units.
import * as d3 from 'd3';
import {derive, territories, fills, contours, woodland, seaShading, seaSpots, relief, coastOutlines, smoothCoasts, regionShapes, hachureStrokes, roadCurves} from '../core/derive.js';
import {smoothLine} from '../core/roads.js';
import {meshTris, EDGE} from '../core/terrain.js';
import {itemPos} from '../core/steps.js';
import {getTheme, fontChoice, backgroundChoice, typography} from '../themes/index.js';
import {themeCSS, labelText, hersheyPath, hersheyBox, dashPaths} from './theme.js';
import {extrasChoice, squareGrid, numberedGrid, hexGrid, scaleBar, defaultPosition, formatDistance, wrapLines, COMPASS_RADIUS,
    legendEntries, legendLayout, LEGEND, LEGEND_HEADING} from './extras.js';

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
var LAYERS = ['background', 'field', 'fill', 'tint', 'wood', 'contour', 'sea', 'river', 'coastLines', 'coast', 'border', 'slope', 'road', 'relief',
    'seaPicture', 'grid', 'city', 'wreck', 'poi', 'marker', 'route', 'label', 'frame', 'extras'];

// Layers only there while the map has something in them, so maps without
// roads or routes, and themes without fills, woodland, contours, sea
// pictures or a frame, draw exactly as before
var OPTIONAL_LAYERS = ['fill', 'wood', 'contour', 'road', 'route', 'seaPicture', 'frame'];

// Layers the user can switch off in the Style panel
export var TOGGLE_LAYERS = [
    ['coast', 'Coastline'], ['fill', 'Land and sea colours'], ['tint', 'Region colours'], ['sea', 'Sea shading'], ['river', 'Rivers'], ['border', 'Borders'], ['slope', 'Slope shading'],
    ['contour', 'Contours'], ['relief', 'Hills'], ['forest', 'Forests'], ['road', 'Roads'],
    ['city', 'Cities'], ['label', 'Labels'], ['wreck', 'Wrecks'], ['poi', 'Points of interest'],
    ['marker', 'Markers'], ['route', 'Routes']
];

export function addSVG(div, id) {
    var svg = div.append('svg')
        .attr('viewBox', '-500 -500 1000 1000')
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('id', id);
    svg.append('style').attr('class', 'theme');
    svg.append('defs').attr('class', 'symbols');
    LAYERS.forEach(function (name) {
        if (OPTIONAL_LAYERS.indexOf(name) < 0) svg.append('g').attr('class', 'layer-' + name);
    });
    return svg;
}

function layer(svg, name) {
    return svg.select('g.layer-' + name);
}

// An optional layer, added in its place in the stacking order if wanted
// (and returned), or taken away if not (returning null)
function optionalLayer(svg, name, wanted) {
    var g = layer(svg, name);
    if (!wanted) {
        g.remove();
        return null;
    }
    if (!g.empty()) return g;
    var after = LAYERS.slice(LAYERS.indexOf(name) + 1).find(function (n) {return !layer(svg, n).empty()});
    return svg.insert('g', after ? 'g.layer-' + after : null).attr('class', 'layer-' + name);
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
    if (OPTIONAL_LAYERS.indexOf(layerName) >= 0) {
        g.remove();
        return;
    }
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

// The lines out at sea along the coast go with the coastline, and woodland
// areas with the forests
var HIDDEN_WITH = {coastLines: 'coast', wood: 'forest'};

export function showLayers(svg, hidden) {
    LAYERS.forEach(function (name) {
        var off = hidden.indexOf(name) >= 0 || hidden.indexOf(HIDDEN_WITH[name]) >= 0;
        // Forests share the relief layer, which only goes when both are off
        if (name === 'relief') off = off && hidden.indexOf('forest') >= 0;
        layer(svg, name).attr('display', off ? 'none' : null);
    });
    showReliefKinds(svg, hidden.indexOf('relief') >= 0, hidden.indexOf('forest') >= 0);
}

// Hills (and hachures) and forests (trees and their wash) are drawn in one
// layer, so nearer symbols overlap farther ones whatever their kind, but
// each can be hidden on its own. Only touches the symbols when that changes.
function showReliefKinds(svg, hillsOff, forestOff) {
    var g = layer(svg, 'relief');
    var key = hillsOff + ' ' + forestOff;
    if (g.node().__kindsShown === key) return;
    g.node().__kindsShown = key;
    g.selectAll('use.relief, g.hachures, g.tree-wash').attr('display', function () {
        if (hillsOff === forestOff) return null;
        var forest = this.classList.contains('forest') || this.classList.contains('tree-wash');
        return (forest ? forestOff : hillsOff) ? 'none' : null;
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
    return {theme: theme, font: font, background: background, type: typography(theme, style)};
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
// inside a <use> (in most browsers: see themeCSS).
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

function cellsPath(cells) {
    return cells.map(function (c) {
        return 'M' + coord(c[0][0]) + ',' + coord(c[0][1]) + 'L' + coord(c[1][0]) + ',' + coord(c[1][1]) +
            'L' + coord(c[2][0]) + ',' + coord(c[2][1]) + 'Z';
    }).join('');
}

// Land and sea filled in colour by height, for themes that fill them,
// inside the map's margin. The sea's farthest colour covers that first, so
// there's no paper showing between the grid's edge and the margin.
function drawFills(svg, state, theme) {
    var spec = theme.fills;
    var g = optionalLayer(svg, 'fill', !!spec);
    if (!g || unchanged(svg, 'fill', [state.h, spec, SCALE])) return;
    g.selectAll('*').remove();
    g = insideMargin(svg, g, 'fill');
    if (spec.sea && spec.sea.length) {
        var w = SCALE * extent.width;
        var ht = SCALE * extent.height;
        g.append('rect').attr('x', -w / 2).attr('y', -ht / 2).attr('width', w).attr('height', ht)
            .style('fill', spec.sea[spec.sea.length - 1]).style('stroke', 'none');
    }
    fills(state.h, spec).forEach(function (group) {
        // Each cell outlined in its own colour closes the hairline gaps
        // between cells; inline, as the theme's stylesheet sets every path's
        // fill and stroke
        g.append('path').attr('class', 'fill').attr('d', cellsPath(group.tris))
            .style('fill', group.color).style('stroke', group.color).style('stroke-width', '0.8px')
            .style('stroke-linejoin', 'round');
    });
}

// A group inside layer g clipped to the map's margin, where coasts and
// rivers stop, so fills leave the same empty border
function insideMargin(svg, g, name) {
    var id = svg.attr('id') + '-' + name + '-margin';
    var w = 2 * EDGE * SCALE * extent.width;
    var ht = 2 * EDGE * SCALE * extent.height;
    g.append('clipPath').attr('id', id)
        .append('rect').attr('x', -w / 2).attr('y', -ht / 2).attr('width', w).attr('height', ht);
    return g.append('g').attr('clip-path', 'url(#' + id + ')');
}

// How far the margin, where coasts and rivers stop, reaches in from the
// map's edges: [across, down] in map units
function marginSize() {
    return [(0.5 - EDGE) * extent.width, (0.5 - EDGE) * extent.height];
}

// Where the extras go by default: inside a theme's frame, if it has one
function extrasInset(theme) {
    return theme.frame ? marginSize() : null;
}

// A decorative frame, for themes with one (see frame in simple.js): bands
// of colour around the map, the innermost on the edge of the margin, and a
// drawing in each corner
function drawFrame(svg, theme) {
    var spec = theme.frame;
    var g = optionalLayer(svg, 'frame', !!spec);
    if (!g || unchanged(svg, 'frame', [spec, SCALE, extent])) return;
    g.selectAll('*').remove();
    var m = marginSize();
    var w = SCALE * (extent.width - 2 * m[0]);
    var ht = SCALE * (extent.height - 2 * m[1]);
    // Washed bands go on first, so the ink rules stay crisp over them
    var washed = spec.bands.filter(function (b) {return b.wash});
    if (washed.length) ensureWatercolour(svg);
    var wash = washed.length ? g.append('g').attr('filter', 'url(#' + svg.attr('id') + '-watercolour)') : null;
    // Inline, as the theme's stylesheet sets every path's fill and stroke
    washed.concat(spec.bands.filter(function (b) {return !b.wash})).forEach(function (band) {
        var out = band.at + band.width / 2;
        (band.wash ? wash : g).append('rect').attr('class', 'frame-band')
            .attr('x', -w / 2 - out).attr('y', -ht / 2 - out).attr('width', w + 2 * out).attr('height', ht + 2 * out)
            .style('fill', 'none').style('stroke', band.color).style('stroke-width', band.width + 'px')
            .style('stroke-dasharray', band.dash ? band.dash.join(' ') : null);
    });
    if (spec.corner) {
        ensureSymbols(svg, 'frame-corner', spec.corner, theme.parts);
        var c = spec.width / 2;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (k) {
            g.append('use').attr('class', 'frame-corner').attr('href', '#' + svg.attr('id') + '-frame-corner0')
                .attr('x', k[0] * (w / 2 + c)).attr('y', k[1] * (ht / 2 + c));
        });
    }
}

// Boxes (map units) over a theme's frame, for labels to avoid
function frameBoxes(theme) {
    if (!theme.frame) return [];
    var m = marginSize();
    var w = extent.width / 2;
    var h = extent.height / 2;
    return [[-w, -h, w, -h + m[1]], [-w, h - m[1], w, h], [-w, -h, -w + m[0], h], [w - m[0], -h, w, h]];
}

// Sea monsters and ships out in open water, for themes with them (see
// seaPictures in simple.js), each facing in towards the middle of the map
function drawSeaPictures(svg, state, theme) {
    var spec = theme.seaPictures;
    var g = optionalLayer(svg, 'seaPicture', !!spec);
    if (!g || unchanged(svg, 'seaPicture', [state.h, spec, SCALE])) return;
    ensureSymbols(svg, 'seaPicture', spec, theme.parts);
    var m = marginSize();
    var spots = seaSpots(state.h, {count: spec.count, clearance: spec.clearance / SCALE,
        inset: Math.max(m[0], m[1]) + spec.clearance / SCALE, spacing: spec.spacing / SCALE});
    var prefix = '#' + svg.attr('id') + '-seaPicture';
    join(svg, 'seaPicture', 'use', 'sea-picture', spots.map(function (p, i) {return {id: i, pos: p}}), byId)
        .attr('href', function (d) {return prefix + (d.id % spec.variants.length)})
        .attr('transform', function (d) {
            return 'translate(' + coord(d.pos[0]) + ',' + coord(d.pos[1]) + ')' + (d.pos[0] > 0 ? ' scale(-1,1)' : '');
        });
}

// Forests as filled areas, for themes with woodland ({color, outline,
// width}): the cells under woodland, outlined like the fills, and
// optionally a line around them
function drawWoodland(svg, state, theme) {
    var spec = theme.woodland;
    var g = optionalLayer(svg, 'wood', !!spec);
    if (!g || unchanged(svg, 'wood', [state.h, spec, SCALE])) return;
    g.selectAll('*').remove();
    var wood = woodland(state.h);
    g.append('path').attr('class', 'woodland').attr('d', cellsPath(wood.tris))
        .style('fill', spec.color).style('stroke', spec.color).style('stroke-width', '0.8px')
        .style('stroke-linejoin', 'round');
    if (spec.outline) {
        g.append('path').attr('class', 'woodland-edge').attr('d', polylinePath(wood.outline))
            .style('fill', 'none').style('stroke', spec.outline).style('stroke-width', (spec.width || 1) + 'px');
    }
}

// Contour lines, for themes with contours (see simple.js): in
// colors.contour, widths.contour, and index contours in widths.contourIndex.
// With labels, index contours are numbered every so often along them,
// reading along the line, in the label font.
var CONTOUR_LABEL_SPACING = 400;
var CONTOUR_LABEL_SIZE = 9;

function drawContours(svg, state, theme, font) {
    var spec = theme.contours;
    var g = optionalLayer(svg, 'contour', !!spec);
    var labelFont = spec && spec.labels && typeof font.label === 'string' ? font.label : null;
    if (!g || unchanged(svg, 'contour', [state.h, spec, labelFont, SCALE])) return;
    g.selectAll('*').remove();
    var color = theme.colors.contour || theme.colors.ink;
    var width = theme.widths.contour || 1;
    var levels = contours(state.h, spec);
    [false, true].forEach(function (index) {
        var lines = [];
        levels.forEach(function (l) {
            if (l.index === index) lines = lines.concat(l.lines);
        });
        if (!lines.length) return;
        g.append('path').attr('class', index ? 'contour contour-index' : 'contour')
            .attr('d', polylinePath(lines))
            .style('fill', 'none').style('stroke', color)
            .style('stroke-width', (index ? theme.widths.contourIndex || 2 * width : width) + 'px')
            .style('stroke-linejoin', 'round');
    });
    if (!labelFont) return;
    var placed = [];
    levels.forEach(function (l) {
        if (!l.index) return;
        l.lines.forEach(function (line) {
            contourLabelSpots(line, placed).forEach(function (spot) {
                g.append('text').attr('class', 'contour-label')
                    .attr('transform', 'translate(' + spot.x.toFixed(1) + ',' + spot.y.toFixed(1) + ') rotate(' +
                        spot.angle.toFixed(1) + ')')
                    .attr('dy', '0.35em')
                    .style('font-family', labelFont).style('font-size', CONTOUR_LABEL_SIZE + 'px')
                    .style('text-anchor', 'middle').style('fill', color).style('stroke-width', '3px')
                    .text(l.height);
            });
        });
    });
}

// Where to number a contour (in SVG units): every so often along it, each
// turned to read along the line without being upside down, and kept apart
// from labels already placed
function contourLabelSpots(line, placed) {
    var pts = line.map(function (p) {return [coord(p[0]), coord(p[1])]});
    var dist = [0];
    for (var i = 1; i < pts.length; i++) {
        dist.push(dist[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    var length = dist[dist.length - 1];
    var spots = [];
    if (length < CONTOUR_LABEL_SPACING / 3) return spots;
    var w = EDGE * SCALE * extent.width - 10;
    var ht = EDGE * SCALE * extent.height - 10;
    var j = 0;
    for (var at = Math.min(length / 2, CONTOUR_LABEL_SPACING / 2); at < length; at += CONTOUR_LABEL_SPACING) {
        while (dist[j + 1] < at) j++;
        // The direction over a short stretch, as the line is jagged
        var a = pts[Math.max(0, j - 2)];
        var b = pts[Math.min(pts.length - 1, j + 3)];
        var t = (at - dist[j]) / (dist[j + 1] - dist[j] || 1);
        var x = pts[j][0] + t * (pts[j + 1][0] - pts[j][0]);
        var y = pts[j][1] + t * (pts[j + 1][1] - pts[j][1]);
        if (Math.abs(x) > w || Math.abs(y) > ht) continue;
        if (placed.some(function (p) {return Math.hypot(p[0] - x, p[1] - y) < 60})) continue;
        var angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        placed.push([x, y]);
        spots.push({x: x, y: y, angle: angle});
    }
    return spots;
}

// Each region's land washed in a colour, for themes that tint regions. The
// layer as a whole is see-through, so where cells meet they don't show
// darker; each cell is outlined in its own colour to close the hairline
// gaps between them. With watercolour, a filter roughens the edges and
// makes the colour uneven, like pigment. With edge, each region is coloured
// strongly along its borders and coast, fading to a light wash inside, as
// old atlases were coloured by hand.
function drawTints(svg, state, d, theme) {
    var spec = theme.regionTints;
    var capitals = state.cities.slice(0, state.params.nterrs).map(function (c) {return c.vx});
    if (unchanged(svg, 'tint', [state.h, d.terr, spec, capitals.join(','), SCALE])) return;
    var g = layer(svg, 'tint');
    g.selectAll('*').remove();
    if (!spec) return;
    if (spec.watercolour) ensureWatercolour(svg);
    if (spec.edge) ensureEdgeColour(svg, spec.edge);
    // Inside a frame, the colour stops at the plate's edge
    if (theme.frame) g = insideMargin(svg, g, 'tint');
    var wash = g.append('g').attr('opacity', spec.opacity)
        .attr('filter', spec.watercolour ? 'url(#' + svg.attr('id') + '-watercolour)' : null);
    regionShapes(state.h, d.terr, capitals).forEach(function (cells, k) {
        var color = spec.colors[k % spec.colors.length];
        wash.append('path').attr('class', 'region-tint')
            .attr('d', cellsPath(cells))
            // Inline, as the theme's stylesheet sets every path's fill and stroke
            .style('fill', color).style('stroke', color).style('stroke-width', '0.8px').style('stroke-linejoin', 'round')
            .attr('filter', spec.edge ? 'url(#' + svg.attr('id') + '-edge)' : null);
    });
}

// A shape's colour kept strong in a band along its outline (edge.width,
// SVG units), softening inwards to edge.inside of its strength
function ensureEdgeColour(svg, edge) {
    var id = svg.attr('id') + '-edge';
    var defs = svg.select('defs.symbols');
    defs.select('#' + id).remove();
    var f = defs.append('filter').attr('id', id).attr('x', '-2%').attr('y', '-2%').attr('width', '104%').attr('height', '104%');
    f.append('feMorphology').attr('in', 'SourceAlpha').attr('operator', 'erode').attr('radius', edge.width).attr('result', 'eroded');
    f.append('feGaussianBlur').attr('in', 'eroded').attr('stdDeviation', edge.width / 2).attr('result', 'inner');
    f.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'inner').attr('operator', 'out').attr('result', 'band');
    f.append('feComponentTransfer').attr('in', 'SourceGraphic').attr('result', 'wash')
        .append('feFuncA').attr('type', 'linear').attr('slope', edge.inside);
    var merge = f.append('feMerge');
    merge.append('feMergeNode').attr('in', 'wash');
    merge.append('feMergeNode').attr('in', 'band');
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

// Which drawing a relief symbol uses. A spec with climate ({cold: [...],
// warm: [...]}, lists of variant numbers) picks from one list or the other
// by how cold the spot is, blurring the change-over a little.
function reliefVariant(spec, d) {
    if (!spec.climate) return d.variant % spec.variants.length;
    var cold = d.cold + ((d.variant % 100) / 100 - 0.5) * 0.3 > 0.5;
    var group = cold ? spec.climate.cold : spec.climate.warm;
    return group[d.variant % group.length];
}

// Mountains, hills and trees, for themes with relief symbols. They're left
// out around cities, so places stay clear.
var CITY_CLEARANCE = 16;

function drawRelief(svg, state, theme) {
    var spec = theme.symbols.relief;
    var roads = state.roads || [];
    if (unchanged(svg, 'relief', [state.h, spec, state.cities, roads, SCALE])) return;
    if (!spec) {
        clear(svg, 'relief');
        return;
    }
    // A theme can leave a kind out, e.g. mountains drawn with hachures
    var kinds = ['mountain', 'hill', 'tree'].filter(function (kind) {return spec[kind]});
    kinds.forEach(function (kind) {ensureSymbols(svg, 'relief-' + kind, spec[kind], theme.parts)});
    var places = state.cities.map(function (c) {return itemPos(state, c)});
    var near = CITY_CLEARANCE / SCALE;
    var onRoad = roads.length ? nearRoads(roadCurves(roads, SCALE), ROAD_CLEARANCE / SCALE) : null;
    var symbols = relief(state.h, SCALE, spec.spacing).filter(function (s) {
        return spec[s.kind] && !places.some(function (p) {
            return Math.abs(p[0] - s.x) < near && Math.abs(p[1] - s.y) < near;
        }) && !(onRoad && onRoad(s.x, s.y));
    });
    layer(svg, 'relief').node().__kindsShown = null;
    drawTreeWash(svg, spec.treeWash, symbols);
    drawHachures(svg, state.h, spec.hachures);
    var prefix = '#' + svg.attr('id') + '-relief-';
    // Drawn in order, back to front, so no key: nearer symbols overlap
    join(svg, 'relief', 'use', 'relief', symbols)
        .classed('forest', function (d) {return d.kind === 'tree'})
        .attr('href', function (d) {return prefix + d.kind + reliefVariant(spec[d.kind], d)})
        .attr('transform', function (d) {
            return 'translate(' + coord(d.x) + ',' + coord(d.y) + ') scale(' + d.size.toFixed(2) + ')';
        });
}

// Symbols are left off roads too. A drawing stands on its spot, so it would
// hide a road running just behind (above) it as well as one through it.
var ROAD_CLEARANCE = 8;

function nearRoads(lines, near) {
    var cells = new Map();
    function key(x, y) {
        return Math.floor(x / near) + ',' + Math.floor(y / near);
    }
    lines.forEach(function (line) {
        line.forEach(function (p) {
            var k = key(p[0], p[1]);
            if (!cells.has(k)) cells.set(k, []);
            cells.get(k).push(p);
        });
    });
    return function (x, y) {
        for (var cx = Math.floor((x - near) / near); cx <= Math.floor((x + near) / near); cx++) {
            for (var cy = Math.floor((y - 2 * near) / near); cy <= Math.floor((y + near / 2) / near); cy++) {
                var pts = cells.get(cx + ',' + cy);
                if (pts && pts.some(function (p) {
                    return Math.abs(p[0] - x) < near && p[1] > y - 2 * near && p[1] < y + near / 2;
                })) return true;
            }
        }
        return false;
    };
}

// Hachures on the high ground, for themes with hachures ({spacing, levels,
// widths}: widths are three stroke widths, light to heavy). Part of the
// relief layer, under the trees and over the forest wash.
function drawHachures(svg, h, options) {
    var g = layer(svg, 'relief');
    g.selectAll('g.hachures').remove();
    if (!options) return;
    var paths = [[], [], []];
    hachureStrokes(h, SCALE, {spacing: options.spacing, levels: options.levels}).forEach(function (s) {
        var k = s.weight > 0.66 ? 2 : s.weight > 0.33 ? 1 : 0;
        paths[k].push('M' + coord(s.line[0][0]) + ',' + coord(s.line[0][1]) + 'L' + coord(s.line[1][0]) + ',' + coord(s.line[1][1]));
    });
    var group = g.insert('g', 'use').attr('class', 'hachures');
    paths.forEach(function (d, k) {
        group.append('path').attr('class', 'hachure').attr('d', d.join(''))
            .style('stroke-width', options.widths[k] + 'px');
    });
}

// A soft watercolour wash under forests, for themes with treeWash
// ({color, opacity, radius}, radius in SVG units): a blob under each tree,
// run together by the watercolour filter. It's part of the relief layer,
// under the trees, so it hides with them.
function drawTreeWash(svg, wash, symbols) {
    var g = layer(svg, 'relief');
    g.selectAll('g.tree-wash').remove();
    if (!wash) return;
    ensureWatercolour(svg);
    var r = wash.radius;
    var blobs = symbols.filter(function (s) {return s.kind === 'tree'}).map(function (s) {
        // Centred a little above the tree's base
        return 'M' + (coord(s.x) - r) + ',' + (coord(s.y) - r / 2) + 'a' + r + ',' + r + ' 0 1,0 ' + 2 * r + ',0' +
            'a' + r + ',' + r + ' 0 1,0 ' + -2 * r + ',0';
    }).join('');
    g.insert('g', ':first-child').attr('class', 'tree-wash').attr('opacity', wash.opacity)
        .attr('filter', 'url(#' + svg.attr('id') + '-watercolour)')
        .append('path').attr('d', blobs)
        .style('fill', wash.color).style('stroke', 'none');
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

// --- Roads and routes ---

// For a theme that doesn't style them (see roads and routes in simple.js)
var ROAD_STYLE = {lines: [{color: '#8a7a66', width: 2}]};
var ROUTE_STYLE = {color: '#c62828', width: 2.5, dotted: [0, 8], dashed: [10, 6], arrowSize: 9, arrowSpacing: 90};

// A road line's colour 'paper' is the background's
function paperColor(background) {
    return background.color || (background.halo && background.halo.color) || '#ffffff';
}

// Lines drawn with inline styles: the theme's stylesheet sets every path's
// stroke, and only maps with roads or routes should change
function strokeStyle(path, color, width, dash, theme) {
    return path.style('stroke', color).style('stroke-width', width + 'px')
        .style('stroke-dasharray', dash && !theme.strokeOnly ? dash.join(' ') : null)
        .style('stroke-linejoin', 'round');
}

// Plotters ignore dash patterns, so dashes become lines of their own (a
// dot, being a dash of no length, becomes a short one)
function penDashes(lines, dash, theme) {
    if (!dash || !theme.strokeOnly) return lines;
    return dashPaths(lines, Math.max(dash[0], 1.5) / SCALE, dash[1] / SCALE);
}

// Each line of the road style is drawn over every road before the next, so
// the middle of a cased road runs unbroken through junctions
function drawRoads(svg, state, theme, background) {
    var roads = state.roads || [];
    var spec = theme.roads || ROAD_STYLE;
    var g = optionalLayer(svg, 'road', roads.length > 0);
    if (!g || unchanged(svg, 'road', [roads, spec, background, SCALE])) return;
    g.selectAll('*').remove();
    var lines = roadCurves(roads, SCALE);
    spec.lines.forEach(function (line) {
        var color = line.color === 'paper' ? paperColor(background) : line.color;
        strokeStyle(g.append('path').attr('class', 'road').attr('d', polylinePath(penDashes(lines, line.dash, theme))),
            color, line.width, line.dash, theme);
    });
}

// Where a route's label goes: above the middle of the route, as a note
// would be placed (so plotter lettering clears the hatching the same way),
// unless it has been moved from there
function routeLabels(state) {
    return (state.routes || []).filter(function (r) {return r.label}).map(function (route) {
        var mid = alongLine(smoothLine(route.points, 2 / SCALE), 0.5);
        var offset = route.labelOffset || [0, 0];
        return {id: route.id, pos: [mid.at[0] + offset[0], mid.at[1] - 12 / SCALE + offset[1]], text: route.label};
    });
}

// The point a fraction of the way along a line, and the way it's heading
function alongLine(line, fraction) {
    var total = lineLength(line);
    return pointAt(line, fraction * total);
}

function lineLength(line) {
    var total = 0;
    for (var i = 1; i < line.length; i++) total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    return total;
}

function pointAt(line, distance) {
    for (var i = 1; i < line.length; i++) {
        var a = line[i - 1];
        var b = line[i];
        var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (distance <= len || i === line.length - 1) {
            var t = len ? Math.min(1, distance / len) : 0;
            return {at: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
                dir: len ? [(b[0] - a[0]) / len, (b[1] - a[1]) / len] : [1, 0]};
        }
        distance -= len;
    }
    return {at: line[0], dir: [1, 0]};
}

// Open arrowheads along a route, the last at its end
function arrowheads(line, spec) {
    var size = spec.arrowSize / SCALE;
    var spacing = spec.arrowSpacing / SCALE;
    var total = lineLength(line);
    var at = [];
    for (var d = spacing; d < total - spacing / 2; d += spacing) at.push(d);
    at.push(total);
    return at.map(function (d) {
        var p = pointAt(line, d);
        var back = [-p.dir[0] * size, -p.dir[1] * size];
        var side = [-p.dir[1] * size * 0.55, p.dir[0] * size * 0.55];
        return [[p.at[0] + back[0] + side[0], p.at[1] + back[1] + side[1]], p.at,
            [p.at[0] + back[0] - side[0], p.at[1] + back[1] - side[1]]];
    });
}

// Routes the user has drawn: dotted, dashed or with arrows, in the theme's
// route colour, each with its label if it has one
function drawRoutes(svg, state, theme, type) {
    var routes = state.routes || [];
    var spec = theme.routes || ROUTE_STYLE;
    var g = optionalLayer(svg, 'route', routes.length > 0);
    if (!g || unchanged(svg, 'route', [routes, spec, SCALE, theme.strokeOnly, JSON.stringify(type.note)])) return;
    g.selectAll('*').remove();
    var labels = routeLabels(state);
    routes.forEach(function (route) {
        var line = smoothLine(route.points, 2 / SCALE);
        var dash = route.style === 'dotted' ? spec.dotted : route.style === 'dashed' ? spec.dashed : null;
        // The route's data goes to its parts, for the editing tools
        var group = g.append('g').attr('class', 'route').datum({id: route.id, kind: 'route', item: route});
        strokeStyle(group.append('path').attr('class', 'route-line').attr('d', polylinePath(penDashes([line], dash, theme))),
            spec.color, spec.width, dash, theme);
        if (route.style === 'arrows') {
            strokeStyle(group.append('path').attr('class', 'route-arrows').attr('d', polylinePath(arrowheads(line, spec))),
                spec.color, spec.width, null, theme);
        }
        var label = labels.find(function (l) {return l.id === route.id});
        if (label) {
            var text = appendText(group, type.note, 'note-label route-label', label.text, SCALE * label.pos[0], SCALE * label.pos[1],
                NOTE_SIZE * type.note.scale, 'middle');
            text.style(type.note.hershey ? 'stroke' : 'fill', spec.color)
                .datum({id: route.id, kind: 'routeLabel', item: route, pos: label.pos});
        }
    });
}

// City and region names, plus the user's own text notes. role gives each
// label's lettering (see typography in themes/index.js).
function labelSets(labels, type, notes) {
    return [
        {dataKind: 'cityLabel', cls: 'city-label', labels: labels.cities,
            role: function (l) {return l.capital ? type.capital : type.town},
            size: function (l) {return l.size}, anchor: function (l) {return l.align}},
        {dataKind: 'regionLabel', cls: 'region-label', labels: labels.regions,
            role: function () {return type.region},
            size: function (l) {return SCALE*l.size}, anchor: function () {return 'middle'}},
        {dataKind: 'note', cls: 'note-label', role: function () {return type.note},
            labels: notes.map(function (n) {return {id: n.id, x: n.pos[0], y: n.pos[1], text: n.text, item: n}}),
            size: function () {return NOTE_SIZE * type.note.scale}, anchor: function () {return 'middle'}}
    ];
}

// What a role changes from the theme's stylesheet, set on its text. Left
// off when nothing is changed, so those maps draw as they always have.
var LETTERING = ['font-family', 'font-variant', 'letter-spacing', 'translate'];

function lettering(selection, role) {
    LETTERING.forEach(function (name) {
        selection.style(name, function (d) {return (typeof role === 'function' ? role(d) : role).inline[name] || null});
    });
    return selection;
}

// Labels as text, or as single-stroke Hershey paths. A theme's fonts are
// all one or the other, so a set is drawn one way.
export function drawLabels(svg, labels, notes, type) {
    labelSets(labels, type, notes).forEach(function (set) {
        var data = set.labels.map(function (l) {
            var role = set.role(l);
            return {id: l.id, kind: set.dataKind, pos: [l.x, l.y], label: l, item: l.item, role: role,
                text: labelText(role, l.text)};
        });
        if (set.role({}).hershey) {
            join(svg, 'label', 'path', set.cls, data, byId)
                .attr('d', function (d) {
                    return hersheyPath(d.role.family.hershey, d.text, SCALE*d.pos[0], SCALE*d.pos[1],
                        set.size(d.label), set.anchor(d.label));
                });
        } else {
            var text = join(svg, 'label', 'text', set.cls, data, byId)
                .attr('x', function (d) {return SCALE*d.pos[0]})
                .attr('y', function (d) {return SCALE*d.pos[1]})
                .style('font-size', function (d) {return set.size(d.label) + 'px'})
                .style('text-anchor', function (d) {return set.anchor(d.label)})
                .text(function (d) {return d.text});
            lettering(text, function (d) {return d.role});
        }
    });
}

// Pen lettering has no halo, so hatching under it is left out instead.
// Boxes are in map units, with a little padding.
function hersheyLabelBoxes(labels, notes, type) {
    var boxes = [];
    labelSets(labels, type, notes).forEach(function (set) {
        set.labels.forEach(function (l) {
            var role = set.role(l);
            if (!l.text || !role.hershey) return;
            var size = set.size(l);
            var b = hersheyBox(role.family.hershey, labelText(role, l.text),
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

// --- Fitting labels to how they're drawn ---

var measuring = null;

// Font families named in CSS, for checking they've loaded
function fontsLoaded(families) {
    if (typeof document === 'undefined' || !document.fonts) return true;
    return families.every(function (family) {
        return typeof family !== 'string' || document.fonts.check('20px ' + family);
    });
}

// Measures labels as their roles draw them (kind is a role id): font,
// letter case, small capitals and letter spacing, or Hershey glyph widths.
// Returns null where there's no canvas to measure with (e.g. in Node).
function labelMeasurer(type) {
    if (typeof document === 'undefined') return null;
    measuring = measuring || document.createElement('canvas').getContext('2d');
    return function (kind, text, size) {
        var role = type[kind];
        var shown = labelText(role, text);
        if (role.hershey) {
            var b = hersheyBox(role.family.hershey, shown, 0, 0, size, 'start');
            return b.x1 - b.x0;
        }
        measuring.font = size + 'px ' + role.family;
        measuring.fontVariantCaps = role.case === 'small-caps' ? 'small-caps' : 'normal';
        var width = measuring.measureText(shown).width;
        var spacing = role.spacing === 'normal' ? 0 : parseFloat(role.spacing);
        return width + spacing * size * shown.length;
    };
}

// Boxes (map units) around the extras that are showing, for labels to avoid
function extrasBoxes(state, theme, type, measure) {
    var extras = extrasChoice(theme, state.style, state.params);
    var extent = state.params.extent;
    var boxes = [];
    var inset = extrasInset(theme);
    var at = function (id) {return extras.positions[id] || defaultPosition(id, extent, SCALE, extras.compassSize, inset)};
    if (extras.compass) {
        var c = at('compass');
        var r = COMPASS_RADIUS * extras.compassSize / SCALE;
        boxes.push([c[0] - r, c[1] - r, c[0] + r, c[1] + r]);
    }
    if (extras.scaleBar) {
        var p = at('scaleBar');
        var bar = scaleBar(extent, extras.perUnit);
        boxes.push([p[0] - 20 / SCALE, p[1] - 12 / SCALE, p[0] + bar.mapLength + 40 / SCALE,
            p[1] + (10 + SCALE_TEXT * type.scale.scale) / SCALE]);
    }
    if (extras.title) {
        var q = at('title');
        var size = TITLE_SIZE * type.title.scale;
        var width = measure ? measure('title', extras.title, size) : 0.6 * size * extras.title.length;
        var maxWidth = SCALE * extent.width / 2 - 2 * TITLE_PAD;
        var lines = Math.max(1, Math.ceil(width / maxWidth));
        // A cartouche's scrolls reach out at the sides and below
        var out = theme.cartouche ? CARTOUCHE_REACH / SCALE : 0;
        boxes.push([q[0] - out, q[1], q[0] + (Math.min(width, maxWidth) + 2 * TITLE_PAD) / SCALE + out,
            q[1] + (2 * TITLE_PAD + (lines - 1) * 1.2 * size + size) / SCALE + out]);
    }
    var legend = extras.legend && legendFor(state, theme, extras, type, measure);
    if (legend) {
        var l = at('legend');
        boxes.push([l[0] + legend.layout.x / SCALE, l[1] + legend.layout.y / SCALE, l[0], l[1]]);
    }
    return boxes.concat(frameBoxes(theme));
}

// How this map's labels will be drawn, so they can be placed to fit (see
// placeLabels). Until the theme's fonts have loaded, labels are placed for
// the fallback font; main.js redraws when fonts load, placing them again.
function labelLayout(state, theme, font, type) {
    var measure = labelMeasurer(type);
    var placed = ['region', 'capital', 'town', 'title'];
    var ready = fontsLoaded(placed.map(function (id) {return type[id].family}));
    var signature = placed.map(function (id) {
        var r = type[id];
        return [r.font, r.case, r.spacing, r.size].join(' ');
    });
    var fs = state.params.fontsizes;
    return {
        key: theme.id + '|' + font.id + '|' + (measure ? 'measured' : 'estimated') + '|' + ready + '|' + signature.join('|'),
        measure: measure,
        fontsizes: Object.assign({}, fs, {region: fs.region * type.region.scale,
            city: fs.city * type.capital.scale, town: fs.town * type.town.scale}),
        obstacles: extrasBoxes(state, theme, type, measure)
    };
}

// The finished map
export function drawMap(svg, state) {
    var t = applyTheme(svg, state.style);
    var theme = t.theme;
    var d = derive(state, labelLayout(state, theme, t.font, t.type));
    drawBackground(svg, t.background);
    drawFills(svg, state, theme);
    drawTints(svg, state, d, theme);
    drawWoodland(svg, state, theme);
    drawContours(svg, state, theme, t.font);
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
    drawRoads(svg, state, theme, t.background);
    // Hershey lettering is drawn with hatching cleared from under it
    var routeNotes = routeLabels(state);
    var boxes = hersheyLabelBoxes(d.labels, routeNotes.length ? state.notes.concat(routeNotes) : state.notes, t.type);
    // A theme can draw relief with symbols instead of hatching
    var hatching = theme.slopeShading !== false;
    drawSlopes(svg, function () {
        if (!hatching) return [];
        return boxes.length ? d.slopes.filter(outsideBoxes(boxes)) : d.slopes;
    }, [d.slopes, boxes.length ? JSON.stringify(boxes) : '', hatching]);
    drawRelief(svg, state, theme);
    drawSeaPictures(svg, state, theme);
    drawFeatures(svg, state, theme);
    drawRoutes(svg, state, theme, t.type);
    drawLabels(svg, d.labels, state.notes, t.type);
    drawFrame(svg, theme);
    drawExtras(svg, state, theme, t.type, t.background);
    showLayers(svg, state.style.hidden);
}

// --- Extras: grid, scale bar, compass rose, title (see extras.js) ---

// A line of text in a role's lettering, as <text> or as Hershey strokes.
// size is in SVG units, x and y in SVG units too.
function appendText(g, role, cls, text, x, y, size, anchor) {
    text = labelText(role, text);
    if (role.hershey) {
        return g.append('path').attr('class', cls)
            .attr('d', hersheyPath(role.family.hershey, text, x, y, size, anchor));
    }
    return lettering(g.append('text').attr('class', cls)
        .attr('x', x).attr('y', y)
        .style('font-size', size + 'px')
        .style('text-anchor', anchor)
        .text(text), role);
}

function polylinePath(lines) {
    return lines.map(function (line) {
        return line.map(function (p, i) {
            return (i ? 'L' : 'M') + coord(p[0]) + ',' + coord(p[1]);
        }).join('');
    }).join('');
}

function drawGrid(svg, extras, extent, type) {
    var role = type.grid;
    if (unchanged(svg, 'grid', [extras.grid, extras.gridSize, extras.perUnit, extras.gridLabels,
        extent, JSON.stringify(role)])) return;
    var g = layer(svg, 'grid');
    g.selectAll('*').remove();
    if (extras.grid === 'none') return;
    var size = extras.gridSize / extras.perUnit;
    if (extras.grid === 'hex') {
        var hex = hexGrid(extent, size);
        g.append('path').attr('class', 'grid').attr('d', polylinePath(hex.lines));
        if (extras.gridLabels) {
            var labelSize = Math.min(10, SCALE * size * 0.18) * role.scale;
            hex.labels.forEach(function (l) {
                appendText(g, role, 'grid-label hex-label', l.text, SCALE * l.x, SCALE * l.y + labelSize / 2,
                    labelSize, 'middle');
            });
        }
        return;
    }
    if (extras.grid === 'numbered') {
        var survey = numberedGrid(extent, size, extras.perUnit);
        g.append('path').attr('class', 'grid').attr('d', polylinePath(survey.lines));
        if (!extras.gridLabels) return;
        // Each number on its line, just inside the edge
        var numberSize = 12 * role.scale;
        survey.eastings.forEach(function (c) {
            appendText(g, role, 'grid-label', c.text, SCALE * c.x, -SCALE * extent.height / 2 + numberSize + 4,
                numberSize, 'middle');
        });
        survey.northings.forEach(function (r) {
            appendText(g, role, 'grid-label', r.text, -SCALE * extent.width / 2 + 6, SCALE * r.y + numberSize / 3,
                numberSize, 'start');
        });
        return;
    }
    var grid = squareGrid(extent, size);
    g.append('path').attr('class', 'grid').attr('d', polylinePath(grid.lines));
    if (extras.gridLabels) {
        var edgeSize = 14 * role.scale;
        var top = -SCALE * extent.height / 2;
        var left = -SCALE * extent.width / 2;
        grid.columns.forEach(function (c) {
            appendText(g, role, 'grid-label', c.text, SCALE * c.x, top + edgeSize + 6, edgeSize, 'middle');
        });
        grid.rows.forEach(function (r) {
            appendText(g, role, 'grid-label', r.text, left + 8, SCALE * r.y + edgeSize / 2, edgeSize, 'start');
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
    scaleBar: function (g, extras, extent, type) {
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
            var size = SCALE_TEXT * type.scale.scale;
            appendText(g, type.scale, 'extras-label', text, SCALE * m.x, 3 + size, size, 'middle');
        });
    },
    // Scaled to the chosen size, keeping its lines the same weight
    // The N is lettered like the title
    compass: function (g, extras, extent, type, theme) {
        if (theme.compassRose) return ornateCompass(g, theme.compassRose);
        g.append('path').attr('class', 'extras-line')
            .attr('d', 'M-30,0a30,30 0 1,0 60,0a30,30 0 1,0 -60,0M-24,0a24,24 0 1,0 48,0a24,24 0 1,0 -48,0');
        var points = compassPoints(46, 24, 7);
        g.append('path').attr('class', 'extras-paper').attr('d', points.light);
        g.append('path').attr('class', 'extras-fill').attr('d', points.dark);
        appendText(g, type.title, 'extras-label compass-north', 'N', 0, -52, 16, 'middle');
        g.selectAll('path').attr('vector-effect', 'non-scaling-stroke');
    },
    // The box fits the title, up to half the map's width; longer titles wrap
    title: function (g, extras, extent, type, theme) {
        var maxWidth = SCALE * extent.width / 2;
        var role = type.title;
        var cartouche = theme.cartouche;
        layoutTitle(g, extras.title, role, maxWidth, cartouche);
        // Text is measured in whatever font is showing, so measure again
        // once the theme's own font has loaded
        if (!role.hershey && typeof document !== 'undefined' && document.fonts) {
            document.fonts.load(TITLE_SIZE * role.scale + 'px ' + role.family, extras.title).then(function () {
                if (g.node().isConnected) layoutTitle(g, extras.title, role, maxWidth, cartouche);
            });
        }
    }
};

// Drawn by drawLegend, which needs more of the map than the others
ORNAMENTS.legend = null;

var TITLE_SIZE = 30;
var CARTOUCHE_REACH = 26;
var TITLE_PAD = 14;
var SCALE_TEXT = 14;

// Draws the title box with its top-left corner at (0, 0), or a cartouche
// for themes with one
function layoutTitle(g, title, role, maxWidth, cartouche) {
    g.selectAll('*').remove();
    title = labelText(role, title);
    var size = TITLE_SIZE * role.scale;
    var pad = TITLE_PAD;
    var probe = role.hershey ? null :
        lettering(g.append('text').attr('class', 'title-text').style('font-size', size + 'px'), role);
    var wrapped = wrapLines(title, function (text) {
        if (role.hershey) {
            var b = hersheyBox(role.family.hershey, text, 0, 0, size, 'start');
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
    if (cartouche) {
        drawCartouche(g, width, height, cartouche);
    } else {
        g.append('rect').attr('class', 'extras-paper')
            .attr('x', 0).attr('y', 0).attr('width', width).attr('height', height);
        g.append('rect').attr('class', 'extras-line')
            .attr('x', 4).attr('y', 4).attr('width', width - 8).attr('height', height - 8);
    }
    wrapped.lines.forEach(function (line, i) {
        appendText(g, role, 'title-text', line, width / 2, pad + 0.8 * size + i * lineHeight, size, 'middle');
    });
}

// --- Ornate extras, for themes that ask for them ---

// A path through points given as [x, y] pairs, closed
function closed(points) {
    return 'M' + points.map(function (p) {return p.map(function (v) {return Math.round(v * 100) / 100}).join(',')}).join('L') + 'Z';
}

// A filled shape in its own colours: inline, as the theme's stylesheet
// sets every path's fill and stroke
function shape(g, d, fill, stroke, width) {
    return g.append('path').attr('class', 'ornate').attr('d', d)
        .style('fill', fill || 'none').style('stroke', stroke || 'none')
        .style('stroke-width', stroke ? (width || 1) + 'px' : null).style('stroke-linejoin', 'round');
}

// Where an ornament's shapes go. With wash ({wash: opacity}), colour is
// laid on as a watercolour wash under crisp ink lines, as an engraving was
// coloured by hand; otherwise each shape is drawn as it is.
function paints(g, c) {
    if (!c.wash) return {g: g, c: c};
    var svg = d3.select(g.node().ownerSVGElement);
    ensureFineWash(svg);
    return {c: c, color: g.append('g').attr('opacity', c.wash).attr('filter', 'url(#' + svg.attr('id') + '-finewash)'),
        ink: g.append('g')};
}

// A shape drawn with paints: its colours washed, its ink lines crisp
function paint(p, d, fill, stroke, width) {
    if (p.g) return shape(p.g, d, fill, stroke, width);
    var ink = stroke === p.c.ink;
    if ((fill && fill !== 'none') || (stroke && !ink)) shape(p.color, d, fill, ink ? null : stroke, width);
    return ink ? shape(p.ink, d, 'none', stroke, width) : null;
}

// A gentler watercolour than ensureWatercolour's, for small drawings: the
// colour wanders a little past the lines and lies unevenly
function ensureFineWash(svg) {
    var id = svg.attr('id') + '-finewash';
    var defs = svg.select('defs.symbols');
    if (!defs.select('#' + id).empty()) return;
    var f = defs.append('filter').attr('id', id).attr('x', '-10%').attr('y', '-10%').attr('width', '120%').attr('height', '120%');
    f.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', 0.12).attr('numOctaves', 2)
        .attr('seed', 5).attr('result', 'edges');
    f.append('feDisplacementMap').attr('in', 'SourceGraphic').attr('in2', 'edges').attr('scale', 2.5)
        .attr('xChannelSelector', 'R').attr('yChannelSelector', 'G').attr('result', 'rough');
    f.append('feGaussianBlur').attr('in', 'rough').attr('stdDeviation', 0.35).attr('result', 'soft');
    f.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', 0.05).attr('numOctaves', 2)
        .attr('seed', 9).attr('result', 'pigment');
    f.append('feColorMatrix').attr('in', 'pigment').attr('type', 'matrix')
        .attr('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.8 0.55').attr('result', 'blotches');
    f.append('feComposite').attr('in', 'soft').attr('in2', 'blotches').attr('operator', 'in');
}

// One point of a compass rose, halved down its length: the left half and
// the right, at angle a (radians clockwise from north)
function rosePoint(a, length, width) {
    var tip = [Math.sin(a) * length, -Math.cos(a) * length];
    var l = [Math.sin(a - Math.PI / 2) * width, -Math.cos(a - Math.PI / 2) * width];
    var r = [Math.sin(a + Math.PI / 2) * width, -Math.cos(a + Math.PI / 2) * width];
    return {left: closed([[0, 0], tip, l]), right: closed([[0, 0], tip, r])};
}

// A fleur-de-lis standing on (0, 0), about 18 high, for north
var FLEUR = 'M0,-18C3,-13 4,-8 1.6,-3L-1.6,-3C-4,-8 -3,-13 0,-18Z' +
    'M1.4,-3.2C2.6,-9 9.5,-11.5 9.6,-6.2C9.7,-3.6 7.2,-2.8 6,-4.4C7.1,-5.4 6.2,-7.2 4.6,-6.1C3.4,-5.2 2.9,-4 2.9,-3.2Z' +
    'M-1.4,-3.2C-2.6,-9 -9.5,-11.5 -9.6,-6.2C-9.7,-3.6 -7.2,-2.8 -6,-4.4C-7.1,-5.4 -6.2,-7.2 -4.6,-6.1C-3.4,-5.2 -2.9,-4 -2.9,-3.2Z' +
    'M-4.5,-3.2L4.5,-3.2L4.5,-0.8L-4.5,-0.8Z M-1.6,-0.8L1.6,-0.8L0,3Z';

// An ornate compass rose ({gold, red, blue, paper, ink}): thirty-two
// points in four sizes inside a gold ring of degree marks, a fleur-de-lis
// for north and a cross for east. It reaches as far as the plain rose, and
// unlike it, its lines grow with it, as a painted rose's would.
function ornateCompass(g, c) {
    var ring = function (r) {return 'M' + -r + ',0a' + r + ',' + r + ' 0 1,0 ' + 2 * r + ',0a' + r + ',' + r + ' 0 1,0 ' + -2 * r + ',0'};
    var p = paints(g, c);
    paint(p, ring(44), c.paper, c.ink, 1);
    paint(p, ring(40), 'none', c.gold, 6);
    paint(p, ring(37), 'none', c.ink, 0.8);
    var ticks = [];
    for (var i = 0; i < 32; i++) {
        var a = i * Math.PI / 16;
        var r0 = i % 4 ? 41.5 : 37;
        ticks.push('M' + (Math.sin(a) * r0).toFixed(2) + ',' + (-Math.cos(a) * r0).toFixed(2) +
            'L' + (Math.sin(a) * 44).toFixed(2) + ',' + (-Math.cos(a) * 44).toFixed(2));
    }
    paint(p, ticks.join(''), 'none', c.ink, 0.8);
    // Smallest first, so the larger points lie over them. Each size but
    // the largest fills the gaps between the larger ones. Washed, each size
    // is painted over the last, hiding its lines.
    var sizes = [
        {every: 32, length: 30, width: 3, colors: [c.gold, c.paper]},
        {every: 16, length: 38, width: 5, colors: [c.ink, c.paper]},
        {every: 8, length: 46, width: 7, colors: [c.blue, c.paper]},
        {every: 4, length: 56, width: 9, colors: [c.red, c.gold]}
    ];
    sizes.forEach(function (size) {
        var q = paints(g, c);
        for (var k = 0; k < size.every; k++) {
            if (size.every > 4 && k % 2 === 0) continue;
            var pt = rosePoint(k * 2 * Math.PI / size.every, size.length, size.width);
            paint(q, pt.left, size.colors[0], c.ink, 0.7);
            paint(q, pt.right, size.colors[1], c.ink, 0.7);
        }
    });
    p = paints(g, c);
    paint(p, ring(5), c.gold, c.ink, 0.8);
    paint(p, ring(1.8), c.red, null);
    var fleur = g.append('g').attr('transform', 'translate(0,-55) scale(0.85)');
    paint(paints(fleur, c), FLEUR, c.gold, c.ink, 0.8);
    paint(p, 'M57,-1.2L65,-1.2L65,-4.5L67.4,-4.5L67.4,-1.2L70.5,-1.2L70.5,1.2L67.4,1.2L67.4,4.5L65,4.5L65,1.2L57,1.2Z',
        c.red, c.ink, 0.6);
}

// A title cartouche ({paper, gold, ink, scroll, cloth}) around a box width
// by height with its top-left corner at (0, 0): a panel with hollowed
// corners, framed in gold, with scrolls curling out at the sides (in
// scroll), a cloth swag hanging below (in cloth) and a scallop shell on
// top; without scroll and cloth, gold scrolls and a drop below
function drawCartouche(g, width, height, c) {
    var w = width;
    var h = height;
    var panel = function (k, r) {
        return 'M' + (k + r) + ',' + k + 'L' + (w - k - r) + ',' + k + 'A' + r + ',' + r + ' 0 0,0 ' + (w - k) + ',' + (k + r) +
            'L' + (w - k) + ',' + (h - k - r) + 'A' + r + ',' + r + ' 0 0,0 ' + (w - k - r) + ',' + (h - k) +
            'L' + (k + r) + ',' + (h - k) + 'A' + r + ',' + r + ' 0 0,0 ' + k + ',' + (h - k - r) +
            'L' + k + ',' + (k + r) + 'A' + r + ',' + r + ' 0 0,0 ' + (k + r) + ',' + k + 'Z';
    };
    var m = h / 2;
    // A scroll at the left side, mirrored for the right
    var scroll = function (x, dir) {
        var X = function (v) {return x + dir * v};
        return 'M' + X(0) + ',' + (m - 14) + 'C' + X(-16) + ',' + (m - 18) + ' ' + X(-26) + ',' + (m - 4) + ' ' + X(-20) + ',' + (m + 6) +
            'C' + X(-15) + ',' + (m + 13) + ' ' + X(-5) + ',' + (m + 9) + ' ' + X(-8) + ',' + (m + 2) +
            'C' + X(-10) + ',' + (m - 3) + ' ' + X(-16) + ',' + (m + 1) + ' ' + X(-13) + ',' + (m + 4) +
            'C' + X(-18) + ',' + (m + 1) + ' ' + X(-15) + ',' + (m - 8) + ' ' + X(-7) + ',' + (m - 6) +
            'C' + X(-2) + ',' + (m - 5) + ' ' + X(0) + ',' + (m - 1) + ' ' + X(0) + ',' + (m + 2) + 'Z' +
            'M' + X(0) + ',' + (m + 14) + 'C' + X(-10) + ',' + (m + 16) + ' ' + X(-14) + ',' + (m + 22) + ' ' + X(-8) + ',' + (m + 26) +
            'C' + X(-4) + ',' + (m + 22) + ' ' + X(-2) + ',' + (m + 19) + ' ' + X(0) + ',' + (m + 19) + 'Z';
    };
    var p = paints(g, c);
    var cx = w / 2;
    if (c.cloth) {
        // A swag of cloth caught up at the panel's lower corners, its folds
        // drawn in
        var hang = 25;
        var half = Math.min(w / 2 - 12, 70);
        var x0 = cx - half;
        var x1 = cx + half;
        paint(p, 'M' + x0 + ',' + (h - 6) + 'Q' + cx + ',' + (h + 2.2 * hang) + ' ' + x1 + ',' + (h - 6) +
            'Q' + cx + ',' + (h + 0.9 * hang) + ' ' + x0 + ',' + (h - 6) + 'Z', c.cloth, c.ink, 0.8);
        paint(p, 'M' + (cx - half * 0.6) + ',' + (h + 0.55 * hang) + 'Q' + cx + ',' + (h + 1.5 * hang) + ' ' + (cx + half * 0.6) + ',' + (h + 0.55 * hang) +
            'M' + (cx - half * 0.35) + ',' + (h + 0.85 * hang) + 'Q' + cx + ',' + (h + 1.35 * hang) + ' ' + (cx + half * 0.35) + ',' + (h + 0.85 * hang),
            'none', c.ink, 0.5);
        // Tassels where it's caught up
        paint(p, 'M' + x0 + ',' + (h - 4) + 'l-2.5,12l5,0Z M' + x1 + ',' + (h - 4) + 'l-2.5,12l5,0Z', c.gold, c.ink, 0.6);
    }
    paint(p, scroll(0, 1) + scroll(w, -1), c.scroll || c.gold, c.ink, 0.9);
    if (!c.cloth) paint(p, 'M' + (cx - 18) + ',' + h + 'C' + (cx - 10) + ',' + (h + 4) + ' ' + (cx - 6) + ',' + (h + 14) + ' ' + cx + ',' + (h + 18) +
        'C' + (cx + 6) + ',' + (h + 14) + ' ' + (cx + 10) + ',' + (h + 4) + ' ' + (cx + 18) + ',' + h + 'Z', c.gold, c.ink, 0.9);
    // The panel covers the scrolls' inner ends, and whatever is under it
    shape(g, panel(0, 10), c.paper, null);
    p = paints(g, c);
    paint(p, panel(0, 10), c.paper, c.ink, 1);
    paint(p, panel(3, 8), 'none', c.gold, 3);
    paint(p, panel(6.5, 6), 'none', c.ink, 0.7);
    if (c.cloth) {
        // A scallop shell on the panel's top edge, with ribs fanning out
        var r = 17;
        var shell = 'M' + (cx - r) + ',' + 2;
        for (var k = 1; k <= 7; k++) {
            var a = Math.PI * (1 - k / 7);
            var b = Math.PI * (1 - (k - 0.5) / 7);
            shell += 'Q' + (cx + Math.cos(b) * r * 1.12).toFixed(2) + ',' + (2 - Math.sin(b) * r * 1.12).toFixed(2) + ' ' +
                (cx + Math.cos(a) * r).toFixed(2) + ',' + (2 - Math.sin(a) * r).toFixed(2);
        }
        shell += 'L' + (cx + 4) + ',' + 6 + 'L' + (cx - 4) + ',' + 6 + 'Z';
        var ribs = '';
        for (var i = 1; i < 7; i++) {
            var t = Math.PI * (1 - i / 7);
            ribs += 'M' + cx + ',' + 4 + 'L' + (cx + Math.cos(t) * r * 0.92).toFixed(2) + ',' + (2 - Math.sin(t) * r * 0.92).toFixed(2);
        }
        var q = paints(g, c);
        paint(q, shell, c.cloth, c.ink, 0.8);
        paint(q, ribs, 'none', c.ink, 0.5);
    }
}

function drawExtras(svg, state, theme, type, background) {
    var extras = extrasChoice(theme, state.style, state.params);
    var extent = state.params.extent;
    drawGrid(svg, extras, extent, type);
    // A legend with nothing to list isn't drawn
    var legend = extras.legend && legendFor(state, theme, extras, type, null);
    var shown = Object.keys(ORNAMENTS).filter(function (id) {
        return id === 'title' ? !!extras.title : id === 'legend' ? !!legend : extras[id];
    });
    var data = shown.map(function (id) {
        return {id: id, kind: 'ornament', text: id === 'title' ? extras.title : null,
            pos: extras.positions[id] || defaultPosition(id, extent, SCALE, extras.compassSize, extrasInset(theme)),
            scale: id === 'compass' ? extras.compassSize : 1};
    });
    var groups = join(svg, 'extras', 'g', 'ornament', data, function (d) {return d.id})
        .attr('transform', function (d) {
            return 'translate(' + coord(d.pos[0]) + ',' + coord(d.pos[1]) + ')' + (d.scale !== 1 ? ' scale(' + d.scale + ')' : '');
        });
    groups.each(function (d) {
        var g = d3.select(this);
        if (d.id === 'legend') {
            drawLegend(g, legend, {svg: svg, theme: theme, type: type, background: background, datum: d});
            return;
        }
        g.selectAll('*').remove();
        ORNAMENTS[d.id](g, extras, extent, type, theme);
    });
}

// --- Legend: a key to what's on the map (see legendEntries) ---

// The legend's entries and heading, and where they go (null if there's
// nothing to list). measure gives text widths, or null to estimate them.
function legendFor(state, theme, extras, type, measure) {
    var entries = legendEntries(state, theme, extras.legendNames, territories(state).borders.length > 0);
    if (!entries.length) return null;
    var heading = extras.legendNames.heading == null ? LEGEND_HEADING : extras.legendNames.heading;
    measure = measure || function (role, text, size) {return 0.6 * size * text.length};
    return {entries: entries, heading: heading,
        layout: legendLayout(entries, heading, measure, {text: type.legend.scale, heading: type.legendTitle.scale})};
}

// Measures text as it's drawn on the map, in a role's lettering
function textMeasurer(g, type) {
    return function (roleId, text, size) {
        var role = type[roleId];
        text = labelText(role, text);
        if (role.hershey) {
            var b = hersheyBox(role.family.hershey, text, 0, 0, size, 'start');
            return b.x1 - b.x0;
        }
        var probe = lettering(g.append('text').style('font-size', size + 'px').text(text), role);
        // Not laid out (e.g. the map is hidden): an estimate
        var width = probe.node().getComputedTextLength() || 0.6 * size * text.length;
        probe.remove();
        return width;
    };
}

// Only redrawn when what it shows has changed, as it measures its text
// and symbols. Drawn with its bottom-right corner at (0, 0).
function drawLegend(g, legend, ctx) {
    var key = JSON.stringify([legend.entries, legend.heading, ctx.theme.id, ctx.background.id,
        ctx.type.legend, ctx.type.legendTitle]);
    var node = g.node();
    if (node.__legendKey === key) return;
    node.__legendKey = key;
    layoutLegend(g, legend, ctx);
    // Measure again once the theme's own fonts have loaded
    var families = [ctx.type.legend, ctx.type.legendTitle].filter(function (r) {return !r.hershey}).map(function (r) {return r.family});
    if (families.length && typeof document !== 'undefined' && document.fonts) {
        Promise.all(families.map(function (f) {return document.fonts.load(LEGEND.text + 'px ' + f)})).then(function () {
            if (node.isConnected && node.__legendKey === key) layoutLegend(g, legend, ctx);
        });
    }
}

function layoutLegend(g, legend, ctx) {
    g.selectAll('*').remove();
    var type = ctx.type;
    var layout = legendLayout(legend.entries, legend.heading, textMeasurer(g, type),
        {text: type.legend.scale, heading: type.legendTitle.scale});
    // Inline, as the stylesheet sets the fill of every extras-paper
    g.append('rect').attr('class', 'extras-paper')
        .attr('x', layout.x).attr('y', layout.y).attr('width', layout.width).attr('height', layout.height)
        .style('fill', ctx.background.legendColor || null);
    g.append('rect').attr('class', 'extras-line')
        .attr('x', layout.x + 4).attr('y', layout.y + 4).attr('width', layout.width - 8).attr('height', layout.height - 8);
    // Each entry's parts say which entry they are, for renaming and hiding
    var named = function (entry, text) {return Object.assign({}, ctx.datum, {entry: entry, text: text})};
    if (layout.heading) {
        appendText(g, type.legendTitle, 'title-text legend-heading', legend.heading, layout.heading.x, layout.heading.y,
            layout.headingSize, 'middle').datum(named('heading', legend.heading));
    }
    layout.rows.forEach(function (row) {
        var e = row.entry;
        var r = g.append('g').attr('class', 'legend-entry').datum(named(e.key, e.name));
        var swatch = r.append('g').attr('transform', 'translate(' + row.swatch.join(',') + ')').append('g');
        legendSwatch(swatch, e, ctx);
        var label = appendText(r, type.legend, 'extras-label legend-label', e.name, row.text[0], row.text[1], layout.textSize, 'start');
        // The label halo matches a box in its own colour
        if (ctx.background.legendColor && !type.legend.hershey) label.style('stroke', ctx.background.legendColor);
    });
}

// A line across the swatch, as a path, split into dashes for plotters
function swatchLine(dash, theme) {
    var half = LEGEND.swatch[0] / 2 - 2;
    var lines = [[[-half, 0], [half, 0]]];
    if (dash && theme.strokeOnly) lines = dashPaths(lines, Math.max(dash[0], 1.5), dash[1]);
    return lines.map(function (l) {return 'M' + l[0].join(',') + 'L' + l[1].join(',')}).join('');
}

// Draws an entry's swatch around (0, 0) the way the map draws it
function legendSwatch(g, e, ctx) {
    var theme = ctx.theme;
    var prefix = '#' + ctx.svg.attr('id') + '-';
    if (e.kind === 'capital' || e.kind === 'town') {
        if (e.kind === 'capital' && theme.symbols.capital) {
            g.append('use').attr('class', 'capital-symbol').attr('href', prefix + 'capital0');
            return fitSwatch(g);
        }
        g.append('circle').attr('class', 'city')
            .attr('r', e.kind === 'capital' ? theme.cities.capitalRadius : theme.cities.townRadius);
    } else if (e.kind === 'poi' || e.kind === 'wreck') {
        var spec = theme.symbols[e.kind];
        if (spec.kind === 'text') {
            g.append('text').attr('class', e.kind).attr('y', 8)
                .style('font-size', Math.min(spec.size, 28) + 'px').style('font-family', spec.font || null)
                .style('text-anchor', 'middle').text(spec.chars[e.variant]);
        } else {
            g.append('use').attr('class', e.kind).attr('href', prefix + e.kind + e.variant);
        }
        fitSwatch(g);
    } else if (e.kind === 'marker') {
        g.append('use').attr('class', 'placedMarker ' + e.type).attr('color', e.color)
            .attr('href', prefix + 'marker-' + e.type + '0');
        fitSwatch(g);
    } else if (e.kind === 'road') {
        (theme.roads || ROAD_STYLE).lines.forEach(function (line) {
            var color = line.color === 'paper' ? paperColor(ctx.background) : line.color;
            strokeStyle(g.append('path').attr('d', swatchLine(line.dash, theme)), color, line.width, line.dash, theme);
        });
    } else if (e.kind === 'route') {
        var route = theme.routes || ROUTE_STYLE;
        var dash = e.style === 'dotted' ? route.dotted : e.style === 'dashed' ? route.dashed : null;
        strokeStyle(g.append('path').attr('d', swatchLine(dash, theme)), route.color, route.width, dash, theme);
        if (e.style === 'arrows') {
            var x = LEGEND.swatch[0] / 2 - 2;
            var a = route.arrowSize;
            strokeStyle(g.append('path').attr('d', 'M' + (x - a) + ',' + (-0.55 * a) + 'L' + x + ',0L' + (x - a) + ',' + 0.55 * a),
                route.color, route.width, null, theme);
        }
    } else if (e.kind === 'border') {
        g.append('path').attr('class', 'border').attr('d', swatchLine(theme.strokeOnly ? theme.borderDash : null, theme));
    } else if (e.kind === 'region') {
        var w = LEGEND.swatch[0] - 6;
        var h = LEGEND.swatch[1] - 4;
        g.append('rect').attr('x', -w / 2).attr('y', -h / 2).attr('width', w).attr('height', h)
            .attr('opacity', e.opacity)
            .style('fill', e.color).style('stroke', e.color).style('stroke-width', '0.8px');
    }
}

// Shrinks a symbol to fit its swatch (never enlarging it) and centres it.
// Where it can't be measured (the map is hidden), a typical size.
function fitSwatch(g) {
    var box = null;
    try {
        box = g.node().getBBox();
    } catch (e) {
        box = null;
    }
    var w = LEGEND.swatch[0];
    var h = LEGEND.swatch[1] + 4;
    if (!box || !box.width || !box.height) {
        g.attr('transform', 'scale(0.6)');
        return;
    }
    var k = Math.min(1, w / box.width, h / box.height);
    var cx = box.x + box.width / 2;
    var cy = box.y + box.height / 2;
    g.attr('transform', 'translate(' + (-cx * k) + ',' + (-cy * k) + ') scale(' + k + ')');
}
