import {test} from 'node:test';
import assert from 'node:assert/strict';
import {THEMES, getTheme, typography, typefaces, fontChoice} from '../src/themes/index.js';
import {MapDocument} from '../src/core/document.js';
import {derive} from '../src/core/derive.js';
import {defaultStyle} from '../src/core/steps.js';
import {themeCSS} from '../src/render/theme.js';

var small = {npts: 1024, ncities: 6, nterrs: 3};

function styleFor(theme, font, type) {
    return Object.assign({}, defaultStyle, {theme: theme, font: font || null, type: type || {}});
}

test('with nothing changed, every role follows the preset and adds no CSS', function () {
    THEMES.forEach(function (theme) {
        theme.fonts.forEach(function (preset) {
            var type = typography(theme, styleFor(theme.id, preset.id));
            Object.keys(type).forEach(function (id) {
                assert.deepEqual(type[id].inline, {}, theme.id + '/' + preset.id + ' ' + id);
                assert.equal(type[id].scale, 1);
            });
            assert.deepEqual(type.region.family, preset.region);
            assert.deepEqual(type.title.family, preset.region);
            assert.deepEqual(type.town.family, preset.label);
            var upper = (preset.regionCase || theme.labels.regionCase) === 'upper';
            assert.equal(type.region.case === 'upper', upper, theme.id + '/' + preset.id);
        });
    });
});

test('a theme offers the fonts its presets use', function () {
    var names = typefaces(getTheme('fantasy')).map(function (f) {return f.name});
    assert.deepEqual(names, ['IM Fell English SC', 'IM Fell English', 'Cinzel', 'R\'lyehian', 'R\'lyehian (plain)']);
    assert.deepEqual(typefaces(getTheme('plotter')).map(function (f) {return f.id}), ['hershey-futural', 'hershey-scripts']);
});

test('changes to a role show as CSS on that role only', function () {
    var theme = getTheme('fantasy');
    var type = typography(theme, styleFor('fantasy', null, {
        town: {font: 'Rlyehian', size: 'large', case: 'upper', spacing: '0.1em'},
        region: {case: 'normal'}
    }));
    assert.deepEqual(type.town.inline, {'font-family': '"Rlyehian", fantasy', 'letter-spacing': '0.1em',
        translate: '0 -0.76em'});
    assert.equal(type.town.scale, 1.25);
    assert.equal(type.town.case, 'upper');
    // Fantasy's region names are in small capitals by default
    assert.deepEqual(type.region.inline, {'font-variant': 'normal'});
    assert.deepEqual(type.capital.inline, {});
    // A font that hangs low, in a preset that doesn't: raised; and back
    type = typography(theme, styleFor('fantasy', 'rlyehian', {town: {font: 'IM Fell English'}}));
    assert.equal(type.town.inline.translate, 'none');
});

test('single-stroke lettering has no small capitals or spacing', function () {
    var type = typography(getTheme('plotter'), styleFor('plotter', null,
        {town: {case: 'small-caps', spacing: '0.2em', font: 'hershey-scripts'}}));
    assert.equal(type.town.case, 'upper');
    assert.equal(type.town.spacing, 'normal');
    assert.deepEqual(type.town.family, {hershey: 'scripts'});
});

test('changing theme or preset keeps lettering sizes only', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'seed');
    doc.dispatch('setStyle', {type: {town: {size: 'large', font: 'Cinzel'}, region: {case: 'upper'}}});
    doc.dispatch('setStyle', {background: 'cream'});
    assert.deepEqual(Object.keys(doc.state.style.type), ['town', 'region']);
    doc.dispatch('setStyle', {font: 'classic'});
    assert.deepEqual(doc.state.style.type, {town: {size: 'large'}});
    doc.undo();
    doc.dispatch('setStyle', {theme: 'pirate'});
    assert.deepEqual(doc.state.style.type, {town: {size: 'large'}});
    // Maps saved before lettering roles have no type
    var theme = getTheme('simple');
    var old = Object.assign({}, defaultStyle);
    delete old.type;
    assert.equal(typography(theme, old).town.family, fontChoice(theme, old).label);
});

test('labels are placed at the lettering\'s size', function () {
    var doc = new MapDocument();
    doc.dispatch('generate', {params: small}, 'seed');
    var fs = doc.state.params.fontsizes;
    var plain = derive(doc.state, {key: 'plain'});
    var big = derive(doc.state, {key: 'big', fontsizes: Object.assign({}, fs, {town: fs.town * 1.6})});
    var towns = function (d) {return d.labels.cities.filter(function (l) {return !l.capital})};
    assert.ok(towns(plain).length > 0);
    towns(plain).forEach(function (l, i) {
        assert.equal(towns(big)[i].size, 1.6 * l.size);
    });
    assert.deepEqual(plain.labels.cities.map(function (l) {return l.capital}),
        [true, true, true, false, false, false]);
});

test('your own text is lettered in the theme\'s label font', function () {
    THEMES.forEach(function (theme) {
        var font = fontChoice(theme, defaultStyle);
        if (typeof font.label !== 'string') return;
        var css = themeCSS(theme, font, theme.backgrounds[0], '#map');
        assert.match(css, /#map text\.note-label \{ font-family: /, theme.id);
    });
});
