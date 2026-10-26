import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MapDocument} from '../src/core/document.js';
import {derive} from '../src/core/derive.js';
import {itemPos} from '../src/core/steps.js';

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

test('the style is part of the map: undoable, saved, and kept for new maps', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'seed');
    var before = derive(doc.state);
    doc.dispatch('setStyle', {theme: 'fantasy', font: 'cinzel'});
    doc.dispatch('setStyle', {hidden: ['slope']});
    assert.deepEqual(doc.state.style, {theme: 'fantasy', font: 'cinzel', background: null, hidden: ['slope']});
    // Style changes don't recompute territories and labels
    assert.equal(derive(doc.state), before);

    // Changing theme resets choices that belong to the old theme
    doc.dispatch('setStyle', {theme: 'plotter'});
    assert.equal(doc.state.style.font, null);
    doc.undo();
    assert.equal(doc.state.style.theme, 'fantasy');

    var reloaded = MapDocument.fromJSON(doc.toJSON());
    assert.deepEqual(reloaded.state.style, doc.state.style);

    doc.dispatch('generate', {params: small}, 'other');
    assert.equal(doc.state.style.theme, 'fantasy');
    doc.dispatch('newBlank', {npts: 512});
    assert.equal(doc.state.style.theme, 'fantasy');
});

test('markers have types, and notes can be added, edited, moved and deleted', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'seed');
    doc.dispatch('addMarker', {pos: [0, 0]});
    doc.dispatch('addMarker', {pos: [0.1, 0], type: 'danger', color: '#1e5aa8'});
    assert.deepEqual(doc.state.markers.map(function (m) {return [m.type, m.color]}), [['x', null], ['danger', '#1e5aa8']]);

    doc.dispatch('addNote', {pos: [0.2, 0.2], text: 'Here be dragons'});
    var note = doc.state.notes[0];
    doc.dispatch('editLabel', {id: note.id, kind: 'note', text: 'Dig here'});
    doc.dispatch('moveItem', {id: note.id, pos: [0.3, 0.3]});
    assert.deepEqual(doc.state.notes[0], {id: note.id, pos: [0.3, 0.3], text: 'Dig here'});
    doc.dispatch('deleteItem', {id: note.id});
    assert.equal(doc.state.notes.length, 0);
});

test('wrecks and points of interest can be added by hand and have their symbol changed', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'seed');
    var generated = doc.state.wrecks[0];
    var before = derive(doc.state);

    doc.dispatch('addSymbol', {kind: 'poi', pos: [0.1, 0.2], variant: 2});
    var poi = doc.state.poi[doc.state.poi.length - 1];
    assert.deepEqual([poi.pos, poi.variant], [[0.1, 0.2], 2]);

    // Same kind: only the drawing changes
    doc.dispatch('setSymbol', {id: generated.id, kind: 'wreck', variant: 1});
    assert.deepEqual(doc.state.wrecks[0], Object.assign({}, generated, {variant: 1}));

    // Other kind: the item moves list, keeping its id and where it was drawn
    var at = itemPos(doc.state, generated);
    doc.dispatch('setSymbol', {id: generated.id, kind: 'poi', variant: 0});
    assert.equal(doc.state.wrecks.length, 0);
    var moved = doc.state.poi[doc.state.poi.length - 1];
    assert.deepEqual([moved.id, moved.pos, moved.variant], [generated.id, at, 0]);

    // None of this touches the terrain or labels
    var after = derive(doc.state);
    assert.deepEqual(after.labels, before.labels);
    assert.equal(after.terr, before.terr);

    var copy = MapDocument.fromJSON(JSON.parse(JSON.stringify(doc.toJSON())));
    assert.equal(fingerprint(copy.state), fingerprint(doc.state));
});

test('jumping through the history', function () {
    var doc = new MapDocument();
    doc.dispatch('newBlank', {npts: 512});
    doc.dispatch('blobs', {count: 3});
    doc.dispatch('seaLevel', {q: 0.5});
    doc.dispatch('generate', {params: small}, 'second');
    doc.dispatch('addMarker', {pos: [0, 0]});
    var afterBlobs = doc.stateAt(2);

    doc.goTo(2);
    assert.equal(doc.state, afterBlobs);
    assert.equal(doc.canRedo(), true);
    assert.equal(doc.startIndex(), 0);
    doc.goTo(0);
    assert.equal(doc.cursor, 1, 'cannot go before the first step');
    doc.goTo(99);
    assert.equal(doc.cursor, 5);
    assert.equal(doc.startIndex(), 3, 'the second map starts at its generate step');
});

test('the current map can be saved on its own, with its undo history', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'first');
    doc.dispatch('setStyle', {theme: 'fantasy'});
    doc.dispatch('addMarker', {pos: [0, 0]});
    doc.dispatch('newBlank', {npts: 1024});
    doc.dispatch('blobs', {count: 5});
    doc.dispatch('seaLevel', {q: 0.4});
    doc.dispatch('addCities', {count: 3});
    var city = doc.state.cities[1];
    doc.dispatch('moveItem', {id: city.id, pos: [0.1, 0.1]});
    doc.dispatch('editLabel', {id: city.id, kind: 'city', text: 'Innsmouth'});
    doc.undo();

    var json = JSON.parse(JSON.stringify(doc.toJSON({currentMap: true, keepRedo: true})));
    assert.equal(json.steps.length, 6);
    assert.equal(json.steps[0].type, 'newBlank');
    assert.equal(json.steps[0].args.style.theme, 'fantasy', 'the style travels with the map');
    assert.equal(json.cursor, 5);

    var copy = MapDocument.fromJSON(json);
    assert.equal(fingerprint(copy.state), fingerprint(doc.state));
    assert.deepEqual(copy.state.style, doc.state.style);
    copy.redo();
    doc.redo();
    assert.equal(fingerprint(copy.state), fingerprint(doc.state));
    assert.equal(copy.state.cities[1].name, 'Innsmouth');
});
