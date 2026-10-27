import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MapDocument} from '../src/core/document.js';
import {derive} from '../src/core/derive.js';
import {getRoads, simplify, smoothLine} from '../src/core/roads.js';

var small = {npts: 1024, ncities: 6, nterrs: 3};

function generate(params, seed) {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: params}, seed || 'roads1');
    return doc;
}

test('roads are off by default and leave the rest of a random map alone', function () {
    var plain = generate(small).state;
    var roads = generate(Object.assign({roads: true}, small)).state;
    assert.equal(plain.roads.length, 0);
    assert.ok(roads.roads.length > 0);
    assert.deepEqual(Array.from(roads.h), Array.from(plain.h));
    assert.deepEqual(roads.cities, plain.cities);
    assert.deepEqual(roads.wrecks, plain.wrecks);
    assert.deepEqual(roads.poi, plain.poi);
});

test('the same seed builds the same roads', function () {
    var params = Object.assign({roads: true}, small);
    assert.deepEqual(generate(params).state.roads, generate(params).state.roads);
});

test('roads start at cities, stay on land and join up', function () {
    var state = generate({npts: 4096, ncities: 10, nterrs: 3, roads: true}, 'roads2').state;
    var h = state.h;
    var vxs = state.cities.map(function (c) {return c.vx});
    var paths = getRoads(h, vxs);
    paths.forEach(function (path) {
        assert.ok(vxs.indexOf(path[0]) >= 0, 'starts at a city');
        path.forEach(function (vx) {assert.ok(h[vx] > 0, 'on land')});
        for (var i = 1; i < path.length; i++) {
            var nbs = Array.from(h.mesh.adj.subarray(h.mesh.adjStart[path[i - 1]], h.mesh.adjStart[path[i - 1] + 1]));
            assert.ok(nbs.indexOf(path[i]) >= 0, 'steps between neighbours');
        }
    });
    // Each road after the first network's start ends on an earlier road or city
    var seen = new Set();
    paths.forEach(function (path, i) {
        path.slice(0, -1).forEach(function (vx) {seen.add(vx)});
        if (i > 0) assert.ok(seen.has(path[path.length - 1]) || vxs.indexOf(path[path.length - 1]) >= 0);
        seen.add(path[path.length - 1]);
    });
    // Kept roads are a few points each, not every vertex
    state.roads.forEach(function (road) {
        assert.ok(road.auto);
        assert.ok(road.points.length >= 2 && road.points.length < 60);
    });
});

test('labels steer clear of roads only when there are roads', function () {
    var plain = generate(small).state;
    var withRoads = generate(Object.assign({roads: true}, small)).state;
    var noRoads = Object.assign({}, withRoads, {roads: []});
    assert.deepEqual(derive(noRoads).labels, derive(plain).labels);
});

test('routes and roads are steps that undo, save and reload', function () {
    var doc = generate(small);
    var points = [[0, 0], [0.1, 0.05], [0.2, 0]];
    doc.dispatch('addRoute', {points: points, style: 'arrows', label: 'The long way'});
    doc.dispatch('addRoad', {points: [[-0.1, -0.1], [0.1, 0.1]]});
    var route = doc.state.routes[0];
    assert.deepEqual(route.points, points);
    assert.equal(route.style, 'arrows');
    assert.equal(route.label, 'The long way');

    doc.dispatch('movePoint', {id: route.id, index: 1, pos: [0.12, 0.08]});
    assert.deepEqual(doc.state.routes[0].points[1], [0.12, 0.08]);
    assert.deepEqual(points[1], [0.1, 0.05], 'the step\'s own points are left alone');
    doc.dispatch('setRoute', {id: route.id, style: 'dashed', label: ''});
    assert.equal(doc.state.routes[0].style, 'dashed');
    assert.equal(doc.state.routes[0].label, '');

    var saved = MapDocument.fromJSON(JSON.parse(JSON.stringify(doc.toJSON())));
    assert.deepEqual(saved.state.routes, doc.state.routes);
    assert.deepEqual(saved.state.roads, doc.state.roads);

    doc.dispatch('deleteItem', {id: route.id});
    assert.equal(doc.state.routes.length, 0);
    doc.undo();
    doc.undo();
    assert.equal(doc.state.routes[0].style, 'arrows');
    doc.undo();
    assert.deepEqual(doc.state.routes[0].points[1], [0.1, 0.05]);
});

test('joining towns again keeps roads drawn or reshaped by hand', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'roads1');
    doc.dispatch('addRoad', {points: [[-0.1, -0.1], [0.1, 0.1]]});
    doc.dispatch('joinTowns');
    var built = doc.state.roads.filter(function (r) {return r.auto});
    assert.ok(built.length > 0);
    doc.dispatch('movePoint', {id: built[0].id, index: 0, pos: [0, 0]});
    doc.dispatch('joinTowns');
    var roads = doc.state.roads;
    assert.equal(roads.filter(function (r) {return !r.auto}).length, 2);
    assert.equal(roads.filter(function (r) {return r.auto}).length, built.length);
});

test('line helpers', function () {
    assert.deepEqual(simplify([[0, 0], [1, 0.001], [2, 0]], 0.01), [[0, 0], [2, 0]]);
    var curve = smoothLine([[0, 0], [1, 1], [2, 0]], 0.1);
    assert.deepEqual(curve[0], [0, 0]);
    assert.deepEqual(curve[curve.length - 1], [2, 0]);
    assert.ok(curve.some(function (p) {return Math.abs(p[0] - 1) < 1e-9 && Math.abs(p[1] - 1) < 1e-9}), 'passes through its points');
});
