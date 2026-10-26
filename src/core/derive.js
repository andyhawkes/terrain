// Layers computed from a map state (rivers, coasts, territories, labels...).
// Results are cached for recent heightmaps, since states never change.
import * as T from './terrain.js';
import {placeLabels} from './labels.js';
import {withSeed} from './random.js';
import {itemPos} from './steps.js';

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
            rivers: T.getRivers(h, 0.01),
            coasts: T.contour(h, 0),
            // The hatching is random, but should be the same on every redraw
            slopes: withSeed('slopes', function () {return T.slopeStrokes(h)})
        };
    }
    return entry.layers;
}

// Everything drawn from a map state. The same state, or one that differs
// only in style, gets exactly the same result.
export function derive(state) {
    var h = state.h;
    var entry = cacheFor(h);
    var cached = entry.derived;
    if (cached && cached.cities === state.cities && cached.params === state.params) return cached.d;
    var cities = state.cities;
    var vxs = cities.map(function (c) {return c.vx});
    var nterrs = state.params.nterrs;
    var layers = terrainLayers(h);
    var placesKey = nterrs + '|' + vxs.join(',');
    var regions = lastFor(entry, 'territories', placesKey, function () {
        var terr = T.getTerritories(h, vxs, nterrs);
        return {terr: terr, borders: T.getBorders(h, terr)};
    });
    var terr = regions.terr;
    var borders = regions.borders;
    var cityNames = cities.map(function (c) {return c.name});
    var regionNames = cities.map(function (c) {return c.regionName});
    var labelsKey = JSON.stringify([placesKey, cityNames, regionNames, state.params.fontsizes, state.params.scale]);
    var placed = lastFor(entry, 'placement', labelsKey, function () {
        return placeLabels(h, terr, vxs, nterrs, cityNames, regionNames, state.params.fontsizes,
            [layers.rivers, layers.coasts, borders], state.params.scale);
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
    entry.derived = {cities: state.cities, params: state.params, d: d};
    return d;
}
