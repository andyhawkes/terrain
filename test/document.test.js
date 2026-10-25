import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MapDocument} from '../src/core/document.js';
import {derive} from '../src/core/derive.js';

var small = {npts: 1024, ncities: 6, nterrs: 3};

// A comparable summary of a map: heightmap, features and label text
function fingerprint(state) {
    var d = derive(state);
    return JSON.stringify({
        h: Array.from(state.h, function (x) {return x.toFixed(9)}),
        cities: state.cities, wrecks: state.wrecks, poi: state.poi, markers: state.markers,
        labels: d.labels.cities.map(function (l) {return [l.text, l.x, l.y]}),
        regions: d.labels.regions.map(function (l) {return [l.text, l.x, l.y]}),
        slopes: d.slopes.length
    });
}

function buildManual(doc) {
    doc.dispatch('newBlank', {npts: 1024});
    doc.dispatch('slope');
    doc.dispatch('blobs', {count: 5});
    doc.dispatch('cone', {slope: -0.5});
    doc.dispatch('roundHills');
    doc.dispatch('seaLevel', {q: 0.5});
    doc.dispatch('erode', {amount: 0.1});
    doc.dispatch('addCities', {count: 5});
    doc.dispatch('addWrecks', {count: 1});
    doc.dispatch('addPOI', {count: 2});
    return doc;
}

test('the same seed generates the same map', function () {
    var a = new MapDocument();
    a.dispatch('generate', {params: small}, 'abc123');
    var b = new MapDocument();
    b.dispatch('generate', {params: small}, 'abc123');
    assert.equal(fingerprint(a.state), fingerprint(b.state));

    var c = new MapDocument();
    c.dispatch('generate', {params: small}, 'different');
    assert.notEqual(fingerprint(a.state), fingerprint(c.state));
});

test('a hand-built map survives a save and reload', function () {
    var doc = buildManual(new MapDocument());
    var reloaded = MapDocument.fromJSON(JSON.parse(JSON.stringify(doc.toJSON())));
    assert.equal(fingerprint(reloaded.state), fingerprint(doc.state));
});

test('undo and redo move through the history', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'seed');
    var before = fingerprint(doc.state);
    var city = doc.state.cities[0];

    doc.dispatch('deleteItem', {id: city.id});
    assert.equal(doc.state.cities.length, small.ncities - 1);

    doc.undo();
    assert.equal(fingerprint(doc.state), before);
    doc.redo();
    assert.equal(doc.state.cities.length, small.ncities - 1);

    // A new step after undo discards the redo branch
    doc.undo();
    doc.dispatch('editLabel', {id: city.id, kind: 'city', text: 'Innsmouth'});
    assert.equal(doc.canRedo(), false);
    assert.equal(derive(doc.state).labels.cities[0].text, 'Innsmouth');
    assert.equal(doc.toJSON().steps.length, 2);
});

test('the first step cannot be undone', function () {
    var doc = new MapDocument();
    doc.dispatch('newBlank', {npts: 512});
    assert.equal(doc.canUndo(), false);
});

test('edits are stored on the map, not lost on redraw', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'seed');
    var wreck = doc.state.wrecks[0];
    doc.dispatch('moveItem', {id: wreck.id, pos: [0.1, 0.2]});
    doc.dispatch('addMarker', {pos: [-0.1, 0.1]});

    assert.deepEqual(doc.state.wrecks[0].pos, [0.1, 0.2]);
    assert.equal(doc.state.markers.length, 1);
    // Earlier snapshots are untouched
    assert.equal(doc.stateAt(1).wrecks[0].pos, undefined);
});

function labelOf(state, id) {
    return derive(state).labels.cities.find(function (l) {return l.id === id});
}

test('moving a label does not move its city', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'seed');
    var city = doc.state.cities[1];
    doc.dispatch('moveLabel', {id: city.id, kind: 'city', pos: [0, 0]});
    var label = labelOf(doc.state, city.id);
    assert.deepEqual([label.x, label.y], [0, 0]);
    assert.deepEqual(doc.state.cities[1], Object.assign({}, city, {labelOffset: doc.state.cities[1].labelOffset}));
    assert.equal(doc.state.cities[1].pos, undefined);
});

test('moving a city carries its label, and leaves the rest of the map alone', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'seed');
    var before = derive(doc.state);
    var city = doc.state.cities[0];
    var label = labelOf(doc.state, city.id);
    var at = doc.state.h.mesh.vxs[city.vx];

    doc.dispatch('moveItem', {id: city.id, pos: [at[0] + 0.05, at[1] - 0.02]});
    var after = derive(doc.state);
    var moved = labelOf(doc.state, city.id);
    assert.ok(Math.abs(moved.x - (label.x + 0.05)) < 1e-12);
    assert.ok(Math.abs(moved.y - (label.y - 0.02)) < 1e-12);
    assert.equal(doc.state.cities[0].vx, city.vx);
    assert.deepEqual(after.borders, before.borders);
    assert.deepEqual(after.labels.regions, before.labels.regions);
    after.labels.cities.forEach(function (l, i) {
        if (l.id === city.id) return;
        assert.deepEqual([l.x, l.y], [before.labels.cities[i].x, before.labels.cities[i].y]);
    });

    // A hand-placed label keeps its offset when the city moves again
    doc.dispatch('moveLabel', {id: city.id, kind: 'city', pos: [moved.x + 0.01, moved.y]});
    doc.dispatch('moveItem', {id: city.id, pos: [at[0], at[1]]});
    var back = labelOf(doc.state, city.id);
    assert.ok(Math.abs(back.x - (label.x + 0.01)) < 1e-12);
    assert.ok(Math.abs(back.y - label.y) < 1e-12);
});

test('old snapshots are rebuilt by replaying', function () {
    var doc = new MapDocument();
    doc.dispatch('newBlank', {npts: 512});
    for (var i = 0; i < 40; i++) doc.dispatch('blobs', {count: 1});
    var early = doc.snapshots[5];
    assert.equal(early, undefined);
    var fresh = MapDocument.fromJSON(doc.toJSON());
    assert.deepEqual(Array.from(doc.stateAt(5).h), Array.from(fresh.stateAt(5).h));
});
