import {test} from 'node:test';
import assert from 'node:assert/strict';
import {niceNumber, columnName, squareGrid, hexGrid, scaleBar, extrasChoice} from '../src/render/extras.js';
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
