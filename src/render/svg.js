// Draws map states into SVG with D3. Map units (roughly -0.5..0.5) are scaled
// by 1000 into SVG user units.
import * as d3 from 'd3';
import {derive, terrainLayers} from '../core/derive.js';
import {itemPos} from '../core/steps.js';
import {poiSymbols, wreckSymbols, ripples} from './markers.js';

export var SCALE = 1000;

// Layers in drawing order; each is a <g> so redraws keep the stacking order
var LAYERS = ['field', 'points', 'river', 'coast', 'border', 'slope', 'city', 'wreck', 'poi', 'marker', 'label'];

export function addSVG(div, id) {
    var svg = div.append('svg')
        .attr('viewBox', '-500 -500 1000 1000')
        .attr('id', id);
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

// Generic data join: one element per datum, all with the given class
function join(svg, layerName, tag, cls, data, key) {
    var sel = layer(svg, layerName).selectAll(tag + '.' + cls).data(data, key);
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
}

export function visualizePoints(svg, pts) {
    join(svg, 'points', 'circle', 'point', pts)
        .attr('cx', function (d) {return SCALE*d[0]})
        .attr('cy', function (d) {return SCALE*d[1]})
        .attr('r', 100 / Math.sqrt(pts.length));
}

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

// Each item is drawn with a datum of {id, kind, pos} so the editing tools can
// work out what was clicked or dragged.
function itemData(state, list, kind) {
    return state[list].map(function (item) {
        return {id: item.id, kind: kind, pos: itemPos(state, item), item: item};
    });
}

export function drawCities(svg, state) {
    var n = state.params.nterrs;
    join(svg, 'city', 'circle', 'city', itemData(state, 'cities', 'city'), byId)
        .attr('cx', function (d) {return SCALE*d.pos[0]})
        .attr('cy', function (d) {return SCALE*d.pos[1]})
        .attr('r', function (d, i) {return i >= n ? 4 : 10});
}

// <symbol>s for wrecks, defined inside each SVG so exports are self-contained
function ensureWreckSymbols(svg) {
    if (!svg.select('defs.wrecks').empty()) return;
    var defs = svg.insert('defs', ':first-child').attr('class', 'wrecks');
    wreckSymbols.forEach(function (w, i) {
        var symbol = defs.append('symbol')
            .attr('width', 90)
            .attr('height', 65)
            .attr('id', svg.attr('id') + '-wreck' + i);
        symbol.append('path').attr('d', w).attr('class', 'wreck');
        symbol.append('path').attr('d', ripples).attr('class', 'ripples');
    });
}

export function drawWrecks(svg, state) {
    ensureWreckSymbols(svg);
    var prefix = '#' + svg.attr('id') + '-wreck';
    join(svg, 'wreck', 'use', 'wreck', itemData(state, 'wrecks', 'wreck'), byId)
        .attr('x', function (d) {return SCALE*d.pos[0] - 32.5})
        .attr('y', function (d) {return SCALE*d.pos[1] - 45})
        .attr('href', function (d) {return prefix + (d.item.variant % wreckSymbols.length)});
}

export function drawPOI(svg, state) {
    var symbols = Array.from(poiSymbols);
    join(svg, 'poi', 'text', 'poi', itemData(state, 'poi', 'poi'), byId)
        .attr('x', function (d) {return SCALE*d.pos[0]})
        .attr('y', function (d) {return SCALE*d.pos[1]})
        .style('font-size', state.params.fontsizes.poi)
        .style('text-anchor', 'middle')
        .text(function (d) {return symbols[d.item.variant % symbols.length]});
}

var cross = d3.symbol().type(d3.symbolCross).size(400);

export function drawMarkers(svg, state) {
    join(svg, 'marker', 'path', 'placedMarker', itemData(state, 'markers', 'marker'), byId)
        .attr('d', cross)
        .attr('transform', function (d) {
            return 'translate(' + SCALE*d.pos[0] + ',' + SCALE*d.pos[1] + ') rotate(45)';
        });
}

export function drawLabels(svg, labels) {
    var data = labels.cities.map(function (l) {
        return {id: l.id, kind: 'cityLabel', pos: [l.x, l.y], label: l};
    });
    join(svg, 'label', 'text', 'city', data, byId)
        .attr('x', function (d) {return SCALE*d.pos[0]})
        .attr('y', function (d) {return SCALE*d.pos[1]})
        .style('font-size', function (d) {return d.label.size})
        .style('text-anchor', function (d) {return d.label.align})
        .text(function (d) {return d.label.text});

    data = labels.regions.map(function (l) {
        return {id: l.id, kind: 'regionLabel', pos: [l.x, l.y], label: l};
    });
    join(svg, 'label', 'text', 'region', data, byId)
        .attr('x', function (d) {return SCALE*d.pos[0]})
        .attr('y', function (d) {return SCALE*d.pos[1]})
        .style('font-size', function (d) {return SCALE*d.label.size})
        .style('text-anchor', 'middle')
        .text(function (d) {return d.label.text});
}

export function drawFeatures(svg, state) {
    drawCities(svg, state);
    drawWrecks(svg, state);
    drawPOI(svg, state);
    drawMarkers(svg, state);
}

// The finished map
export function drawMap(svg, state) {
    var d = derive(state);
    drawPaths(svg, 'river', d.rivers);
    drawPaths(svg, 'coast', d.coasts);
    drawPaths(svg, 'border', d.borders);
    drawSlopes(svg, d.slopes);
    drawFeatures(svg, state);
    drawLabels(svg, d.labels);
}

export {terrainLayers};
