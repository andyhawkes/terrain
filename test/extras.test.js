import {test} from 'node:test';
import assert from 'node:assert/strict';
import {niceNumber, columnName, squareGrid, hexGrid, scaleBar, extrasChoice, wrapLines} from '../src/render/extras.js';
import {defaultStyle} from '../src/core/steps.js';
import {getTheme} from '../src/themes/index.js';

var square = {width: 1, height: 1};

test('grid sizes and scale bars use round numbers', function () {
    assert.deepEqual([7, 12.5, 26, 0.3, 100].map(niceNumber), [5, 10, 25, 0.25, 100]);
    var bar = scaleBar(square, 100);
    assert.equal(bar.length, 20);
    assert.equal(bar.mapLength, 0.2);
    assert.deepEqual(bar.marks.map(function (m) {return m.value}), [0, 5, 10, 15, 20]);
});

test('a square grid has lettered columns and numbered rows', function () {
    var grid = squareGrid(square, 0.125);
    assert.equal(grid.columns.map(function (c) {return c.text}).join(''), 'ABCDEFGH');
    assert.deepEqual(grid.rows.map(function (r) {return r.text}), ['1', '2', '3', '4', '5', '6', '7', '8']);
    // Inner lines only: the map's edge is its frame
    assert.equal(grid.lines.length, 14);
    assert.deepEqual([columnName(25), columnName(26), columnName(27)], ['Z', 'AA', 'AB']);
});

test('a hex grid draws each side once and numbers whole hexes', function () {
    var grid = hexGrid(square, 0.1);
    var sides = new Set();
    grid.lines.forEach(function (line) {
        for (var i = 1; i < line.length; i++) {
            var key = [line[i - 1], line[i]].map(function (p) {return p.map(function (v) {return v.toFixed(6)}).join(',')})
                .sort().join(' ');
            assert.ok(!sides.has(key), 'a side drawn twice');
            sides.add(key);
        }
    });
    assert.equal(grid.labels[0].text, '0101');
    var names = grid.labels.map(function (l) {return l.text});
    assert.equal(new Set(names).size, names.length);
    grid.labels.forEach(function (l) {
        assert.ok(Math.abs(l.x) < 0.5 && Math.abs(l.y) < 0.5, l.text + ' is outside the map');
    });
});

test('extras follow the theme until the map sets its own', function () {
    var params = {extent: square};
    var simple = extrasChoice(getTheme('simple'), defaultStyle, params);
    assert.deepEqual([simple.units.id, simple.perUnit, simple.grid, simple.compass], ['miles', 100, 'none', false]);
    var pirate = extrasChoice(getTheme('pirate'), defaultStyle, params);
    assert.deepEqual([pirate.units.id, pirate.compass], ['leagues', true]);
    // Set on the map, they stay whatever the theme
    var style = Object.assign({}, defaultStyle, {compass: false, grid: 'hex', gridSize: 6});
    var chosen = extrasChoice(getTheme('pirate'), style, params);
    assert.deepEqual([chosen.compass, chosen.grid, chosen.gridSize], [false, 'hex', 6]);
    // The compass rose's size is kept within limits
    assert.equal(simple.compassSize, 1);
    var huge = extrasChoice(getTheme('simple'), Object.assign({}, defaultStyle, {compassSize: 50}), params);
    assert.equal(huge.compassSize, 6);
    // Older maps without these fields get the defaults
    var old = extrasChoice(getTheme('simple'), {theme: 'simple', hidden: []}, params);
    assert.deepEqual([old.grid, old.title, old.positions], ['none', '', {}]);
});

test('long titles wrap between words, and short ones stay on one line', function () {
    // Ten units per character
    function measure(text) {return 10 * text.length}
    assert.deepEqual(wrapLines('Isles of Woe', measure, 200).lines, ['Isles of Woe']);
    var wrapped = wrapLines('The Kingdom of the Seven Shattered Isles', measure, 200);
    assert.deepEqual(wrapped.lines, ['The Kingdom of the', 'Seven Shattered', 'Isles']);
    assert.deepEqual(wrapped.widths, [180, 150, 50]);
    // A word too long for any line gets one to itself
    assert.deepEqual(wrapLines('A Supercalifragilistic Bay', measure, 100).lines, ['A', 'Supercalifragilistic', 'Bay']);
    assert.deepEqual(wrapLines('  ', measure, 100).lines, []);
});

test('the legend lists only what the map has, under its own names', async function () {
    var {legendEntries, legendLayout} = await import('../src/render/extras.js');
    var theme = getTheme('throneish');
    var state = {
        params: {nterrs: 2},
        style: {hidden: []},
        cities: [{id: 1, regionName: 'Redgarden Vale'}, {id: 2, regionName: 'The Silent Reach'}, {id: 3}],
        wrecks: [],
        poi: [{id: 4, variant: 0}, {id: 5, variant: theme.symbols.poi.variants.length}],
        markers: [{id: 6, type: 'flag', color: '#c62828'}, {id: 7, type: 'flag', color: '#1e5aa8'}],
        roads: [],
        routes: [{id: 8, style: 'dotted'}, {id: 9, style: 'dotted'}]
    };
    var keys = function (entries) {return entries.map(function (e) {return e.key})};
    // Two points of interest with the same drawing are one entry; flags in
    // different colours are two
    assert.deepEqual(keys(legendEntries(state, theme, {}, true)),
        ['capital', 'town', 'poi:0', 'marker:flag:#c62828', 'marker:flag:#1e5aa8', 'route:dotted', 'border',
            'region:1', 'region:2']);
    var regions = legendEntries(state, theme, {}, false).filter(function (e) {return e.kind === 'region'});
    assert.deepEqual(regions.map(function (e) {return e.name}), ['Redgarden Vale', 'The Silent Reach']);
    // Renamed, left out, and hidden layers
    var named = legendEntries(state, theme, {'poi:0': 'Dragon lair', town: ''}, false);
    assert.equal(named.find(function (e) {return e.key === 'poi:0'}).name, 'Dragon lair');
    assert.ok(!named.some(function (e) {return e.key === 'town'}));
    var hidden = Object.assign({}, state, {style: {hidden: ['city', 'marker', 'tint']}});
    assert.deepEqual(keys(legendEntries(hidden, theme, {}, false)), ['poi:0', 'route:dotted']);
    // Themes without region colours don't list regions
    assert.ok(!legendEntries(state, getTheme('simple'), {}, false).some(function (e) {return e.kind === 'region'}));

    // Laid out to fit its longest line, with its bottom-right corner at (0, 0)
    var entries = legendEntries(state, getTheme('simple'), {}, false);
    function measure(role, text, size) {return text.length * size / 2}
    var layout = legendLayout(entries, 'Legend', measure, {text: 1, heading: 1});
    assert.equal(layout.x, -layout.width);
    assert.equal(layout.y, -layout.height);
    assert.equal(layout.rows.length, entries.length);
    var last = layout.rows[layout.rows.length - 1];
    assert.ok(last.swatch[1] < 0 && last.swatch[1] > -layout.height);
    var longest = Math.max.apply(null, entries.map(function (e) {return measure('scale', e.name, 15)}));
    assert.ok(Math.abs(last.text[0] + longest - (-12)) < 1e-9, 'the widest name ends a margin inside the box');
    assert.ok(legendLayout(entries, '', measure, {text: 1, heading: 1}).height < layout.height);
    // Entries and heading are measured in their own lettering roles
    var roles = new Set();
    legendLayout(entries, 'Legend', function (role, text, size) {roles.add(role); return 10}, {text: 1, heading: 1});
    assert.deepEqual([...roles].sort(), ['legend', 'legendTitle']);
    var {typography} = await import('../src/themes/index.js');
    var type = typography(getTheme('simple'), Object.assign({}, defaultStyle, {type: {legendTitle: {font: 'Cinzel', size: 'large'}}}));
    assert.equal(type.legendTitle.font, 'Cinzel');
    assert.equal(type.legendTitle.inline['font-family'], '"Cinzel", serif');
    assert.equal(type.title.font, 'Source Sans 3');
    assert.equal(type.legendTitle.scale, 1.25);
    assert.equal(type.legend.family, type.scale.family);
});
