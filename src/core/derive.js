// Layers computed from a map state (rivers, coasts, territories, labels...).
// Results are cached per heightmap / per state, since states never change.
import * as T from './terrain.js';
import {placeLabels} from './labels.js';
import {withSeed} from './random.js';
import {itemPos} from './steps.js';

var byHeightmap = new WeakMap();
// The last territories and label placement worked out for each heightmap,
// with the inputs they came from. Cities are always placed at their
// original vertex, so moving one changes neither, and renaming one only
// changes the labels. Only the last of each is kept per heightmap, so undo
// snapshots don't pile them up.
var territoriesByHeightmap = new WeakMap();
var placementByHeightmap = new WeakMap();
// Keyed by the cities list; reused while the heightmap and params match,
// so style-only changes return exactly the same result.
var byCities = new WeakMap();

function lastFor(cache, h, key, compute) {
    var last = cache.get(h);
    if (last && last.key === key) return last.value;
    var value = compute();
    cache.set(h, {key: key, value: value});
    return value;
}

// Layers that depend only on the heightmap
export function terrainLayers(h) {
    var layers = byHeightmap.get(h);
    if (!layers) {
        layers = {
            rivers: T.getRivers(h, 0.01),
            coasts: T.contour(h, 0),
            // The hatching is random, but should be the same on every redraw
            slopes: withSeed('slopes', function () {return T.slopeStrokes(h)})
        };
        byHeightmap.set(h, layers);
    }
    return layers;
}

export function derive(state) {
    var cached = byCities.get(state.cities);
    if (cached && cached.h === state.h && cached.params === state.params) return cached.d;
    var h = state.h;
    var cities = state.cities;
    var vxs = cities.map(function (c) {return c.vx});
    var nterrs = state.params.nterrs;
    var layers = terrainLayers(h);
    var placesKey = nterrs + '|' + vxs.join(',');
    var regions = lastFor(territoriesByHeightmap, h, placesKey, function () {
        var terr = T.getTerritories(h, vxs, nterrs);
        return {terr: terr, borders: T.getBorders(h, terr)};
    });
    var terr = regions.terr;
    var borders = regions.borders;
    var cityNames = cities.map(function (c) {return c.name});
    var regionNames = cities.map(function (c) {return c.regionName});
    var labelsKey = JSON.stringify([placesKey, cityNames, regionNames, state.params.fontsizes, state.params.scale]);
    var placed = lastFor(placementByHeightmap, h, labelsKey, function () {
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
    byCities.set(state.cities, {h: h, params: state.params, d: d});
    return d;
}
