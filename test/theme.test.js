import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashPaths, hersheyPath, hersheyWidth} from '../src/render/theme.js';
import {THEMES} from '../src/themes/index.js';
import {MARKER_TYPES} from '../src/core/steps.js';

test('dashes become separate segments of the right length', function () {
    var dashes = dashPaths([[[0, 0], [10, 0]]], 2, 1);
    assert.deepEqual(dashes.map(function (d) {return [d[0][0], d[d.length - 1][0]]}),
        [[0, 2], [3, 5], [6, 8], [9, 10]]);
    // Dashes carry on across corners
    dashes = dashPaths([[[0, 0], [1, 0], [1, 3]]], 2, 1);
    assert.deepEqual(dashes[0], [[0, 0], [1, 0], [1, 1]]);
});

test('Hershey text handles accents and alignment', function () {
    assert.equal(hersheyWidth('futural', 'Érsk·ö'), hersheyWidth('futural', 'Ersk-o'));
    var start = hersheyPath('futural', 'Ab', 0, 0, 30, 'start');
    var end = hersheyPath('futural', 'Ab', 0, 0, 30, 'end');
    var xs = function (d) {return d.match(/-?\d+\.\d+(?=,)/g).map(Number)};
    assert.ok(Math.min.apply(null, xs(start)) >= 0);
    assert.ok(Math.max.apply(null, xs(end)) <= 0);
});

test('every theme has what the renderer needs', function () {
    THEMES.forEach(function (theme) {
        ['id', 'name', 'description', 'fonts', 'backgrounds', 'colors', 'widths', 'borderDash', 'labels', 'cities', 'symbols']
            .forEach(function (key) {assert.ok(theme[key], theme.id + ' is missing ' + key)});
        // Each theme styles its own roads and routes
        assert.ok(theme.roads && theme.roads.lines.length, theme.id + ' road style');
        ['color', 'width', 'dotted', 'dashed', 'arrowSize', 'arrowSpacing'].forEach(function (key) {
            assert.ok(theme.routes && theme.routes[key] != null, theme.id + ' route ' + key);
        });
        ['poi', 'wreck'].forEach(function (kind) {
            var spec = theme.symbols[kind];
            assert.ok(spec.kind === 'text' ? spec.chars.length : spec.variants.length, theme.id + ' ' + kind);
        });
        // Markers of different types share a layer, so they must all be paths
        MARKER_TYPES.forEach(function (type) {
            var spec = theme.symbols.markers[type.id];
            assert.ok(spec && spec.kind === 'path' && spec.variants.length, theme.id + ' marker ' + type.id);
        });
        // Symbol parts are styled from theme.parts, not CSS, so every part needs one
        var relief = theme.symbols.relief;
        var specs = [theme.symbols.poi, theme.symbols.wreck].concat(Object.values(theme.symbols.markers))
            // A theme can leave relief kinds out (e.g. hachures for mountains)
            .concat(relief ? [relief.mountain, relief.hill, relief.tree].filter(Boolean) : [])
            .concat(theme.symbols.capital ? [theme.symbols.capital] : []);
        specs.filter(function (spec) {return spec.kind === 'path'}).forEach(function (spec) {
            spec.variants.forEach(function (parts) {
                parts.forEach(function (part) {
                    assert.ok(theme.parts && theme.parts[part.cls], theme.id + ' has no style for part ' + part.cls);
                });
            });
        });
    });
});
