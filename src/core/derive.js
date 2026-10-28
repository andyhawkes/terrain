// Layers computed from a map state (rivers, coasts, territories, labels...).
// Results are cached for recent heightmaps, since states never change.
import * as T from './terrain.js';
import {placeLabels} from './labels.js';
import {withSeed} from './random.js';
import {itemPos} from './steps.js';
import {smoothLine} from './roads.js';

// What's worked out from a heightmap is kept for the most recently used
// heightmaps only: up to RECENT_VERTICES vertices' worth (7 for A4 High,
// 10 at most), enough to step back and forth through recent terrain
// changes. Keeping it for every undo snapshot added several MB each on big
// maps (slope hatching especially); going back further works it out again.
var RECENT_VERTICES = 1000000;
var recent = [];

function cacheFor(h) {
    for (var i = 0; i < recent.length; i++) {
        if (recent[i].h === h) {
            var found = recent.splice(i, 1)[0];
            recent.unshift(found);
            return found;
        }
    }
    var entry = {h: h};
    recent.unshift(entry);
    var limit = Math.min(10, Math.max(3, Math.floor(RECENT_VERTICES / h.length)));
    recent.length = Math.min(recent.length, limit);
    return entry;
}

// Territories and label placement are kept with the inputs they came from,
// the last of each per heightmap. Cities are always placed at their
// original vertex, so moving one changes neither, and renaming one only
// changes the labels.
function lastFor(entry, name, key, compute) {
    var last = entry[name];
    if (last && last.key === key) return last.value;
    var value = compute();
    entry[name] = {key: key, value: value};
    return value;
}

// Layers that depend only on the heightmap
export function terrainLayers(h) {
    var entry = cacheFor(h);
    if (!entry.layers) {
        entry.layers = {
            rivers: T.getRivers(h, T.RIVER_LIMIT),
            coasts: T.contour(h, 0),
            // The hatching is random, but should be the same on every redraw
            slopes: withSeed('slopes', function () {return T.slopeStrokes(h)})
        };
    }
    return entry.layers;
}

// Sea shading along the coast, for themes that draw it (see seaShading in
// simple.js)
export function seaShading(h) {
    var entry = cacheFor(h);
    if (!entry.sea) entry.sea = withSeed('sea', function () {return T.seaStrokes(h, 0.05)});
    return entry.sea;
}

// The coastline smoothed once, so it doesn't follow every corner of the
// grid, for themes that ask for it (see smoothCoast in simple.js). Only
// drawing uses it: labels are placed around the coastline as it is.
export function smoothCoasts(h) {
    var entry = cacheFor(h);
    if (!entry.smoothCoasts) entry.smoothCoasts = terrainLayers(h).coasts.map(T.relaxPath);
    return entry.smoothCoasts;
}

// The land of each territory, as the grid's triangles, for themes that
// colour regions (see regionTints in simple.js). terr maps each vertex to its
// capital's vertex; capitals lists those, in territory order.
export function regionShapes(h, terr, capitals) {
    var entry = cacheFor(h);
    var key = capitals.join(',');
    if (entry.regions && entry.regions.terr === terr && entry.regions.key === key) return entry.regions.shapes;
    var tris = T.meshTris(h.mesh);
    var shapes = capitals.map(function () {return []});
    for (var i = 0; i < h.length; i++) {
        if (h[i] <= 0) continue;
        var k = capitals.indexOf(terr[i]);
        if (k >= 0) shapes[k].push(tris[i]);
    }
    entry.regions = {terr: terr, key: key, shapes: shapes};
    return shapes;
}

// Land and sea coloured by height, for themes that fill them (see fills in
// simple.js), as the grid's triangles grouped by colour
export function fills(h, spec) {
    var entry = cacheFor(h);
    var key = JSON.stringify(spec);
    if (!entry.fills || entry.fills.key !== key) {
        var tris = T.meshTris(h.mesh);
        entry.fills = {key: key, groups: T.heightFills(h, spec).map(function (g) {
            return {color: g.color, tris: g.cells.map(function (i) {return tris[i]})};
        })};
    }
    return entry.fills.groups;
}

// Contour lines at regular heights, for themes that draw them (see
// contours in simple.js)
export function contours(h, spec) {
    var entry = cacheFor(h);
    var key = [spec.interval, spec.top, spec.index, spec.smooth].join(' ');
    if (!entry.contours || entry.contours.key !== key) {
        entry.contours = {key: key, levels: T.contourLevels(h, spec)};
    }
    return entry.contours.levels;
}

// Forests as areas, for themes that draw them (see woodland in simple.js):
// the grid's triangles under woodland, and the line around them. The
// forest field comes from the same seed as relief's trees, so the two agree.
export function woodland(h) {
    var entry = cacheFor(h);
    if (!entry.woodland) {
        var cells = withSeed('relief', function () {return T.woodlandCells(h)});
        var tris = T.meshTris(h.mesh);
        // The outline is the contour of a field that's 1 in the woods
        var inside = new Float64Array(h.length);
        cells.forEach(function (i) {inside[i] = 1});
        inside.mesh = h.mesh;
        entry.woodland = {
            tris: cells.map(function (i) {return tris[i]}),
            outline: T.linkSegments(T.contourSegments(inside, 0.5))
        };
    }
    return entry.woodland;
}

// Spots out at sea for pictures, for themes that draw them (see
// seaPictures in simple.js)
export function seaSpots(h, options) {
    var entry = cacheFor(h);
    var key = JSON.stringify(options);
    if (!entry.seaSpots || entry.seaSpots.key !== key) {
        entry.seaSpots = {key: key, spots: T.seaSpots(h, options)};
    }
    return entry.seaSpots.spots;
}

// Lines following the coast out at sea, for themes that draw them (see
// coastLines in simple.js); offsets are in map units
export function coastOutlines(h, offsets) {
    var entry = cacheFor(h);
    var key = offsets.join(' ');
    if (!entry.coastLines || entry.coastLines.key !== key) {
        entry.coastLines = {key: key, lines: T.coastLines(h, offsets)};
    }
    return entry.coastLines.lines;
}

// Hachures on the high ground, for themes that draw them (see
// symbols.relief.hachures in simple.js)
export function hachureStrokes(h, scale, options) {
    var entry = cacheFor(h);
    var key = scale + ' ' + JSON.stringify(options);
    if (!entry.hachures || entry.hachures.key !== key) {
        entry.hachures = {key: key, strokes: T.hachures(h, scale, options)};
    }
    return entry.hachures.strokes;
}

// Mountain, hill and tree symbols, for themes that draw relief that way
// (see symbols.relief in simple.js). spacing is in SVG units, so it's part
// of what's cached.
export function relief(h, scale, spacing) {
    var entry = cacheFor(h);
    var key = scale + ' ' + JSON.stringify(spacing);
    if (!entry.relief || entry.relief.key !== key) {
        entry.relief = {key: key, symbols: withSeed('relief', function () {return T.reliefSymbols(h, scale, spacing)})};
    }
    return entry.relief.symbols;
}

// Roads as drawn: smooth curves through their points, about two SVG units
// apart. Kept for the last list of roads, which only changes when they do.
var lastRoads = {roads: null, lines: null};

export function roadCurves(roads, scale) {
    if (lastRoads.roads !== roads || lastRoads.scale !== scale) {
        lastRoads = {roads: roads, scale: scale, lines: roads.map(function (r) {return smoothLine(r.points, 2 / scale)})};
    }
    return lastRoads.lines;
}

// Which region each cell is in, and the borders between them. Cached for
// the places they're worked out from, so the legend can ask before labels
// are placed (see derive).
export function territories(state) {
    var h = state.h;
    var vxs = state.cities.map(function (c) {return c.vx});
    var nterrs = state.params.nterrs;
    return lastFor(cacheFor(h), 'territories', nterrs + '|' + vxs.join(','), function () {
        var terr = T.getTerritories(h, vxs, nterrs);
        return {terr: terr, borders: T.getBorders(h, terr)};
    });
}

// Everything drawn from a map state. layout (optional, see placeLabels)
// says how labels will be drawn, so they can be placed to fit: key names it
// (e.g. the theme and lettering), for caching. The same state with the same
// layout gets exactly the same result.
export function derive(state, layout) {
    var h = state.h;
    var entry = cacheFor(h);
    var layoutKey = layout ? layout.key + '|' + JSON.stringify(layout.obstacles || []) : '';
    var cached = entry.derived;
    var roads = state.roads || [];
    if (cached && cached.cities === state.cities && cached.params === state.params && cached.roads === roads &&
        cached.layoutKey === layoutKey) {
        return cached.d;
    }
    var cities = state.cities;
    var vxs = cities.map(function (c) {return c.vx});
    var nterrs = state.params.nterrs;
    var layers = terrainLayers(h);
    var placesKey = nterrs + '|' + vxs.join(',');
    var regions = territories(state);
    var terr = regions.terr;
    var borders = regions.borders;
    var cityNames = cities.map(function (c) {return c.name});
    var regionNames = cities.map(function (c) {return c.regionName});
    // The layout can scale the lettering (see typography in themes/index.js)
    var fontsizes = layout && layout.fontsizes || state.params.fontsizes;
    // Labels keep off roads too, when there are any
    var avoids = [layers.rivers, layers.coasts, borders];
    var roadPoints = roads.map(function (r) {return r.points});
    // Thinned to about a grid cell apart, so a road counts for about as
    // much as a river
    if (roads.length) {
        avoids.push(roadCurves(roads, state.params.scale).map(function (line) {
            return line.filter(function (p, i) {return i % 4 === 0});
        }));
    }
    var labelsKey = JSON.stringify([placesKey, cityNames, regionNames, fontsizes, state.params.scale, layoutKey]
        .concat(roads.length ? [roadPoints] : []));
    var placed = lastFor(entry, 'placement', labelsKey, function () {
        return placeLabels(h, terr, vxs, nterrs, cityNames, regionNames, fontsizes,
            avoids, state.params.scale, layout);
    });
    // Copies, so placing labels for this state leaves the cached ones alone
    var labels = {
        cities: placed.cities.map(function (l) {return Object.assign({}, l)}),
        regions: placed.regions.map(function (l) {return Object.assign({}, l)})
    };
    // Labels are placed around each city's original vertex, so moving a city
    // doesn't reshuffle the other labels. The chosen placement becomes an
    // offset that travels with the city, unless the label was moved by hand.
    labels.cities.forEach(function (label, i) {
        var city = cities[i];
        var vx = h.mesh.vxs[city.vx];
        var offset = city.labelOffset || [label.x - vx[0], label.y - vx[1]];
        var at = itemPos(state, city);
        label.id = city.id;
        label.capital = i < nterrs;
        label.x = at[0] + offset[0];
        label.y = at[1] + offset[1];
    });
    labels.regions.forEach(function (label, i) {
        label.id = cities[i].id;
        if (cities[i].regionLabelPos) {
            label.x = cities[i].regionLabelPos[0];
            label.y = cities[i].regionLabelPos[1];
        }
    });
    var d = Object.assign({terr: terr, borders: borders, labels: labels}, layers);
    entry.derived = {cities: state.cities, params: state.params, roads: roads, layoutKey: layoutKey, d: d};
    return d;
}
