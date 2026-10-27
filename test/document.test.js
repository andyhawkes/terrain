import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MapDocument, GENERATOR_VERSION} from '../src/core/document.js';
import {derive, seaShading, relief, smoothCoasts, hachureStrokes} from '../src/core/derive.js';
import {contour} from '../src/core/terrain.js';
import {itemPos, defaultStyle} from '../src/core/steps.js';

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
    assert.deepEqual(doc.state.style, Object.assign({}, defaultStyle,
        {theme: 'fantasy', font: 'cinzel', background: null, hidden: ['slope']}));
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

    // Extras carry over too, but not the old map's title or where its
    // extras were moved to
    doc.dispatch('setStyle', {grid: 'hex', title: 'Old map', positions: {compass: [0.1, 0.1]}});
    doc.dispatch('newBlank', {npts: 512});
    assert.deepEqual([doc.state.style.grid, doc.state.style.title, doc.state.style.positions], ['hex', '', {}]);
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

test('place names can use a chosen language, and random stays the default', function () {
    function names(doc) {return doc.state.cities.map(function (c) {return c.name})}
    var plain = new MapDocument();
    plain.dispatch('generate', {params: small}, 'lang');
    var random = new MapDocument();
    random.dispatch('generate', {params: Object.assign({language: 'random'}, small)}, 'lang');
    assert.deepEqual(names(random), names(plain));

    var island = new MapDocument();
    island.dispatch('generate', {params: Object.assign({language: 'island'}, small)}, 'lang');
    assert.notDeepEqual(names(island), names(plain));
    // Hawaiian-ish has no letters outside its own set
    names(island).forEach(function (n) {assert.match(n, /^[hklmnpw‘aeiou -]+$/i)});

    // Renaming in another language switches the map to it for later places
    plain.dispatch('renamePlaces', {language: 'island'});
    assert.equal(plain.state.params.language, 'island');
    plain.dispatch('addCities', {count: 1});
    names(plain).forEach(function (n) {assert.match(n, /^[hklmnpw‘aeiou -]+$/i)});

    var blank = new MapDocument();
    blank.dispatch('newBlank', {npts: 512, language: 'arctic'});
    assert.equal(blank.state.params.language, 'arctic');
});

test('maps can be square or A4-shaped, and square maps are unchanged', function () {
    var square = new MapDocument();
    square.dispatch('generate', {params: small}, 'shape');
    var plain = new MapDocument();
    plain.dispatch('generate', {params: Object.assign({shape: 'square'}, small)}, 'shape');
    assert.equal(fingerprint(square.state), fingerprint(plain.state));
    assert.deepEqual([square.state.params.extent, square.state.params.scale], [{width: 1, height: 1}, 1000]);

    var a4 = new MapDocument();
    a4.dispatch('generate', {params: {shape: 'a4-portrait', npts: 2048}}, 'shape');
    var p = a4.state.params;
    assert.deepEqual([p.extent, p.scale, p.ncities], [{width: 1.5, height: 2.12}, 700, 30]);
    // Everything stays inside the map, including labels
    var d = derive(a4.state);
    a4.state.h.mesh.vxs.forEach(function (v) {
        assert.ok(Math.abs(v[0]) <= 0.75 + 1e-9 && Math.abs(v[1]) <= 1.06 + 1e-9);
    });
    d.labels.cities.forEach(function (l) {
        assert.ok(Math.abs(l.x) < 0.75 && Math.abs(l.y) < 1.06, l.text);
    });

    var blank = new MapDocument();
    blank.dispatch('newBlank', {shape: 'a4-landscape', npts: 1024});
    assert.deepEqual(blank.state.params.extent, {width: 2.12, height: 1.5});
});

// Land or sea at points spread over the middle of a map
function landAt(state, n) {
    var vxs = state.h.mesh.vxs;
    var out = [];
    for (var a = 0; a < n; a++) {
        for (var b = 0; b < n; b++) {
            var x = (a + 0.5) / n * 0.9 - 0.45;
            var y = (b + 0.5) / n * 0.9 - 0.45;
            var best = Infinity;
            var nearest = 0;
            for (var i = 0; i < vxs.length; i++) {
                var d = (vxs[i][0] - x) * (vxs[i][0] - x) + (vxs[i][1] - y) * (vxs[i][1] - y);
                if (d < best) {
                    best = d;
                    nearest = i;
                }
            }
            out.push(state.h[nearest] > 0);
        }
    }
    return out;
}

function agreement(a, b) {
    return a.filter(function (v, i) {return v === b[i]}).length / a.length;
}

test('a seed gives the same map at any detail level or shape', function () {
    function make(params) {
        var doc = new MapDocument();
        doc.dispatch('generate', {params: Object.assign({ncities: 6, nterrs: 3}, params)}, 'same');
        return doc.state;
    }
    var low = make({npts: 1024});
    var high = make({npts: 4096});
    var wide = make({npts: 4096, shape: 'a4-landscape', ncities: 6, nterrs: 3});
    assert.ok(agreement(landAt(low, 20), landAt(high, 20)) > 0.85);
    assert.ok(agreement(landAt(high, 20), landAt(wide, 20)) > 0.75);
    // Names come from their own stream, so they don't depend on the grid
    assert.equal(low.lang.names[0], high.lang.names[0]);
    assert.equal(high.cities[0].name, wide.cities[0].name);
});

test('saved maps record the generator version, and newer ones are refused', function () {
    var doc = new MapDocument();
    doc.dispatch('newBlank', {npts: 512});
    var json = doc.toJSON();
    assert.equal(json.generator, GENERATOR_VERSION);
    json.generator = GENERATOR_VERSION + 1;
    assert.throws(function () {MapDocument.fromJSON(json)}, /newer version/);
});

test('moving or renaming a city reuses the territories it already worked out', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'reuse');
    var before = derive(doc.state);
    var city = doc.state.cities[1];
    doc.dispatch('moveItem', {id: city.id, pos: [0.2, 0.2]});
    var moved = derive(doc.state);
    assert.equal(moved.terr, before.terr);
    assert.equal(moved.borders, before.borders);
    doc.dispatch('editLabel', {id: city.id, kind: 'city', text: 'Somewhere new'});
    var renamed = derive(doc.state);
    assert.equal(renamed.terr, before.terr);
    assert.equal(renamed.labels.cities[1].text, 'Somewhere new');
    // Undoing gets the earlier labels back, positions included
    doc.undo();
    doc.undo();
    assert.deepEqual(derive(doc.state).labels, before.labels);
});

test('a long terrain history keeps fewer snapshots, and replays the same map', function () {
    var doc = new MapDocument();
    doc.dispatch('newBlank', {npts: 65536}, 'budget');
    for (var i = 0; i < 40; i++) doc.dispatch('blobs', {count: 2}, 'b' + i);
    var kept = doc.snapshots.filter(Boolean).filter(function (s) {return s.h}).length;
    // 2,000,000 vertices / about 131,000 per heightmap, plus the map's start
    assert.ok(kept <= 17, kept + ' snapshots kept');
    // Undoing far back replays from the start snapshot, giving the same map
    var expected = Array.from(doc.stateAt(5).h);
    var replay = new MapDocument();
    replay.load(doc.toJSON());
    replay.goTo(5);
    assert.deepEqual(Array.from(replay.state.h), expected);
    doc.goTo(5);
    assert.deepEqual(Array.from(doc.state.h), expected);
});

test('mountains, hills and trees go on land, spaced apart, highest ground first', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: {npts: 4096}}, 'relief');
    var h = doc.state.h;
    var spacing = {mountain: 30, hill: 18, tree: 8};
    var symbols = relief(h, 1000, spacing);
    assert.equal(relief(h, 1000, spacing), symbols);
    var kinds = new Set(symbols.map(function (s) {return s.kind}));
    assert.deepEqual(Array.from(kinds).sort(), ['hill', 'mountain', 'tree']);
    // Back to front
    for (var i = 1; i < symbols.length; i++) assert.ok(symbols[i].y >= symbols[i - 1].y);
    // None closer than the smaller of two spacings (symbols vary in size by
    // up to 15%, and their spacing with them)
    for (var i = 0; i < symbols.length; i++) {
        for (var j = i + 1; j < symbols.length; j++) {
            var a = symbols[i];
            var b = symbols[j];
            var gap = 0.85 * Math.min(spacing[a.kind], spacing[b.kind]) / 1000;
            assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= gap - 1e-9);
        }
    }
});

test('coastlines follow the grid unless a theme asks for them smoothed', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: {npts: 4096}}, 'coast');
    var h = doc.state.h;
    // What every theme draws, and labels are placed around
    assert.deepEqual(derive(doc.state).coasts, contour(h, 0));
    // Only for themes with smoothCoast
    var smooth = smoothCoasts(h);
    assert.equal(smooth.length, contour(h, 0).length);
    assert.notDeepEqual(smooth, contour(h, 0));
});

test('hachures run downhill on high ground, about as many at any detail', function () {
    function strokes(npts) {
        var doc = new MapDocument();
        doc.dispatch('generate', {params: {npts: npts}}, 'hachures');
        return {h: doc.state.h, strokes: hachureStrokes(doc.state.h, 1000, {spacing: 2.4, levels: 9})};
    }
    var low = strokes(4096);
    var high = strokes(16384);
    assert.ok(low.strokes.length > 500);
    assert.ok(Math.abs(high.strokes.length - low.strokes.length) / low.strokes.length < 0.5);
    // Mostly downhill: the end is lower than the start
    var vxs = low.h.mesh.vxs;
    function heightAt(p) {
        var best = 0;
        var bestD = Infinity;
        for (var i = 0; i < vxs.length; i++) {
            var d = Math.hypot(vxs[i][0] - p[0], vxs[i][1] - p[1]);
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        }
        return low.h[best];
    }
    var sample = low.strokes.filter(function (s, i) {return i % 25 === 0});
    var down = sample.filter(function (s) {return heightAt(s.line[1]) <= heightAt(s.line[0])});
    assert.ok(down.length / sample.length > 0.8, down.length + ' of ' + sample.length + ' run downhill');
    sample.forEach(function (s) {
        assert.ok(heightAt(s.line[1]) > 0, 'a hachure into the sea');
        assert.ok(s.weight >= 0 && s.weight <= 1);
    });
});

test('sea shading only goes on the sea, near the coast', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: {npts: 4096}}, 'sea');
    var h = doc.state.h;
    var strokes = seaShading(h);
    assert.ok(strokes.length > 50, strokes.length + ' strokes');
    assert.equal(seaShading(h), strokes);
    var vxs = h.mesh.vxs;
    strokes.forEach(function (s) {
        var mid = [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
        var nearest = 0;
        var best = Infinity;
        var nearestLand = Infinity;
        for (var i = 0; i < vxs.length; i++) {
            var d = Math.hypot(vxs[i][0] - mid[0], vxs[i][1] - mid[1]);
            if (d < best) {
                best = d;
                nearest = i;
            }
            if (h[i] > 0) nearestLand = Math.min(nearestLand, d);
        }
        assert.ok(h[nearest] <= 0, 'a stroke on land');
        assert.ok(nearestLand < 0.07, 'a stroke far out to sea');
    });
});

test('pirate and military names come from word lists, unique and repeatable', function () {
    function names(language, seed) {
        var doc = new MapDocument();
        doc.dispatch('generate', {params: Object.assign({language: language}, small, {ncities: 40, nterrs: 10})}, seed);
        return doc.state.cities.map(function (c) {return c.name}).concat(doc.state.cities.map(function (c) {return c.regionName}));
    }
    ['pirate', 'military', 'shire', 'realm'].forEach(function (language) {
        var all = names(language, 'words');
        assert.deepEqual(names(language, 'words'), all);
        assert.equal(new Set(all).size, all.length, language + ' names repeat');
        all.forEach(function (n) {assert.match(n, /^[A-Z0-9][A-Za-z0-9' -]+$/, n)});
    });
    assert.ok(names('military', 'words').some(function (n) {return /^(Hill \d{3}|Sector|Zone|Objective)/.test(n)}));
    // Shire names never borrow Tolkien's
    ['Hobbiton', 'Bywater', 'Tuckborough', 'Underhill'].forEach(function (n) {
        assert.ok(names('shire', 'words').indexOf(n) < 0);
    });
    // Kingdom names never borrow the books' or show's
    ['Winterfell', "Storm's End", 'Riverrun', 'The Reach'].forEach(function (n) {
        assert.ok(names('realm', 'words').indexOf(n) < 0);
    });
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

test('region names keep clear of each other, obstacles and the edge, on their own land', function () {
    // A wide font and a title box in the top left, to make room scarce
    var obstacle = [-0.5, -0.5, -0.1, -0.35];
    var layout = {
        key: 'test',
        measure: function (kind, text, size) {return (kind === 'region' ? 0.85 : 0.65) * size * text.length},
        obstacles: [obstacle]
    };
    ['abc123', 'k1', 'k2', 'k3'].forEach(function (seed) {
        var doc = new MapDocument();
        doc.dispatch('generate', {params: {}}, seed);
        var state = doc.state;
        var d = derive(state, layout);
        var extent = state.h.mesh.extent;
        var boxes = d.labels.regions.map(function (l) {
            return [l.x - l.width / 2, l.y - 1.05 * l.size, l.x + l.width / 2, l.y + 0.3 * l.size];
        });
        function hits(a, b) {return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]}
        boxes.forEach(function (box, i) {
            var label = d.labels.regions[i];
            var j = state.h.mesh.vxs.findIndex(function (v) {return v[0] === label.x && v[1] === label.y});
            assert.equal(d.terr[j], state.cities[i].vx, seed + ': ' + label.text + ' is on its own land');
            assert.ok(box[0] >= -extent.width / 2 && box[2] <= extent.width / 2 &&
                box[1] >= -extent.height / 2 && box[3] <= extent.height / 2, seed + ': ' + label.text + ' is on the map');
            assert.ok(!hits(box, obstacle), seed + ': ' + label.text + ' misses the obstacle');
            boxes.slice(i + 1).forEach(function (other) {
                assert.ok(!hits(box, other), seed + ': region names overlap');
            });
        });
    });
});
