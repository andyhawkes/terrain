// Layers computed from a map state (rivers, coasts, territories, labels...).
// Results are cached per heightmap / per state, since states never change.
import * as T from './terrain.js';
import {placeLabels} from './labels.js';
import {withSeed} from './random.js';
import {itemPos} from './steps.js';

var byHeightmap = new WeakMap();
var byState = new WeakMap();

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
    var d = byState.get(state);
    if (d) return d;
    var h = state.h;
    var cities = state.cities;
    var vxs = cities.map(function (c) {return c.vx});
    var nterrs = state.params.nterrs;
    var layers = terrainLayers(h);
    var terr = T.getTerritories(h, vxs, nterrs);
    var borders = T.getBorders(h, terr);
    var labels = placeLabels(h, terr, vxs, nterrs,
        cities.map(function (c) {return c.name}),
        cities.map(function (c) {return c.regionName}),
        state.params.fontsizes,
        [layers.rivers, layers.coasts, borders]);
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
    d = Object.assign({terr: terr, borders: borders, labels: labels}, layers);
    byState.set(state, d);
    return d;
}
