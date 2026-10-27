// The right-hand panel: Build (shape the current map), Style (how it's
// drawn) and History (every step, with replay).
import {THEMES, getTheme, fontChoice, backgroundChoice, ROLES, TYPE_SIZES, TYPE_CASES, TYPE_SPACINGS,
    typefaces, typography} from '../themes/index.js';
import {TOGGLE_LAYERS} from '../render/svg.js';
import {UNITS, GRIDS, COMPASS_SIZES, extrasChoice} from '../render/extras.js';
import {historyPanel} from './history.js';
import {LANGUAGES} from '../core/language.js';

var nextId = 0;

function section(body, title, intro) {
    var s = body.append('div').attr('class', 'panel-section');
    s.append('h3').text(title);
    if (intro) s.append('p').text(intro);
    return s;
}

function buttonGrid(parent, buttons) {
    var grid = parent.append('div').attr('class', 'button-grid');
    buttons.forEach(function (b) {
        grid.append('button')
            .classed('wide', !!b.wide)
            .attr('title', b.title || null)
            .text(b.text)
            .on('click', b.onClick);
    });
    return grid;
}

// "Label [n] Add" — returns nothing; calls onAdd(n)
function countRow(parent, label, initial, onAdd) {
    var id = 'ctl' + nextId++;
    var row = parent.append('div').attr('class', 'control-row');
    row.append('label').attr('for', id).text(label);
    var input = row.append('input')
        .attr('id', id)
        .attr('type', 'number')
        .attr('min', 1)
        .attr('max', 100)
        .property('value', initial);
    row.append('button').text('Add').on('click', function () {
        var n = parseInt(input.property('value'), 10);
        onAdd(n > 0 ? n : initial);
    });
}

// A slider with its value shown, plus an action button
function sliderRow(parent, label, opts, buttonText, onApply) {
    var id = 'ctl' + nextId++;
    var row = parent.append('div').attr('class', 'control-row');
    row.append('label').attr('for', id).text(label);
    var input = row.append('input')
        .attr('id', id)
        .attr('type', 'range')
        .attr('min', opts.min)
        .attr('max', opts.max)
        .attr('step', opts.step)
        .property('value', opts.value);
    var out = row.append('output').attr('for', id);
    function show() {
        out.text(opts.format(+input.property('value')));
    }
    input.on('input', show);
    show();
    row.append('button').text(buttonText).on('click', function () {
        onApply(+input.property('value'));
    });
}

function checkbox(parent, label, checked, onChange) {
    var l = parent.append('label');
    l.append('input')
        .attr('type', 'checkbox')
        .property('checked', checked)
        .on('change', function () {onChange(this.checked)});
    l.append('span').text(label);
}

function percent(x) {
    return Math.round(x * 100) + '%';
}

function buildPanel(body, ctx) {
    var act = ctx.act;

    var s = section(body, 'New terrain', 'Replace the terrain on the current grid. This clears cities and markers.');
    buttonGrid(s, [
        {text: 'Random coastline', onClick: act('randomHeightmap', {style: 'coast'})},
        {text: 'Random hills', title: 'A random heightmap before erosion', onClick: act('randomHeightmap', {style: 'uneroded'})},
        {text: 'Reset to flat', wide: true, onClick: act('flatten')}
    ]);

    s = section(body, 'Shape', 'Each button changes the heights a little. The Heightmap view shows the result best.');
    buttonGrid(s, [
        {text: 'Random slope', onClick: act('slope')},
        {text: 'Cone', title: 'Raise the middle', onClick: act('cone', {slope: -0.5})},
        {text: 'Inverted cone', title: 'Lower the middle', onClick: act('cone', {slope: 0.5})},
        {text: 'Normalize', title: 'Stretch heights to fill the full range', onClick: act('normalize')},
        {text: 'Round hills', onClick: act('roundHills')},
        {text: 'Relax', title: 'Smooth out sharp changes', onClick: act('relax')}
    ]);
    s.append('div').style('height', '8px');
    countRow(s, 'Blobs', 5, function (n) {act('blobs', {count: n})()});

    s = section(body, 'Sea and erosion');
    sliderRow(s, 'Sea level', {min: 0.05, max: 0.95, step: 0.05, value: 0.5, format: percent}, 'Set',
        function (q) {act('seaLevel', {q: q})()});
    sliderRow(s, 'Erosion', {min: 0.02, max: 0.3, step: 0.02, value: 0.1, format: function (x) {return x.toFixed(2)}}, 'Erode',
        function (amount) {act('erode', {amount: amount})()});
    buttonGrid(s, [{text: 'Clean coastlines', wide: true, title: 'Remove single-cell islands and inlets', onClick: act('cleanCoast')}]);
    s.select('.button-grid').style('margin-top', '8px');

    s = section(body, 'Places', 'New places go wherever scores best. Use the Move tool to adjust them.');
    countRow(s, 'Cities', 1, function (n) {act('addCities', {count: n})()});
    countRow(s, 'Points of interest', 1, function (n) {act('addPOI', {count: n})()});
    countRow(s, 'Wrecks', 1, function (n) {act('addWrecks', {count: n})()});
    buttonGrid(s, [{text: 'Join towns with roads', wide: true,
        title: 'Roads along the easiest ground between the cities. Building them again replaces these, but not roads you have drawn or reshaped.',
        onClick: act('joinTowns')}]).style('margin-top', '8px');

    // Renaming uses the chosen language, which then names places added later.
    // The list shows the map's own language until another is picked.
    var row = s.append('div').attr('class', 'control-row').style('margin-top', '8px');
    row.append('label').attr('for', 'renameLanguage').text('Names');
    var languageSelect = row.append('select').attr('id', 'renameLanguage').style('flex', 1);
    LANGUAGES.forEach(function (l) {
        languageSelect.append('option').attr('value', l.id).attr('title', l.hint || null).text(l.name);
    });
    row.append('button').text('Rename all').attr('title', 'Give every city and region a new name in this language')
        .on('click', function () {act('renamePlaces', {language: languageSelect.property('value')})()});
    ctx.updaters.push(function () {
        var params = ctx.doc.state.params;
        languageSelect.property('value', params && params.language || 'random');
    });
}

// The style belongs to the map, so changes are steps (and can be undone);
// update() keeps the controls in sync with whatever the map currently has.
function stylePanel(body, ctx) {
    function setStyle(changes) {
        ctx.doc.dispatch('setStyle', changes);
    }

    var s = section(body, 'Theme');
    var themeSelect = s.append('div').attr('class', 'control-row')
        .append('select').attr('id', 'themeSelect').attr('aria-label', 'Theme').style('flex', 1)
        .on('change', function () {setStyle({theme: this.value})});
    THEMES.forEach(function (t) {
        themeSelect.append('option').attr('value', t.id).text(t.name);
    });
    var themeDescription = s.append('p').style('margin', '8px 0 0');

    s = section(body, 'Lettering');
    var row = s.append('div').attr('class', 'control-row');
    row.append('label').attr('for', 'fontSelect').text('Preset');
    var fontSelect = row.append('select').attr('id', 'fontSelect')
        .on('change', function () {setStyle({font: this.value})});

    row = s.append('div').attr('class', 'control-row');
    row.append('label').attr('for', 'backgroundSelect').text('Background');
    var backgroundSelect = row.append('select').attr('id', 'backgroundSelect')
        .on('change', function () {setStyle({background: this.value})});

    // Each kind of text can be changed on its own, from the theme's fonts
    var role = ROLES[0].id;
    row = s.append('div').attr('class', 'control-row');
    row.append('label').attr('for', 'roleSelect').text('Text');
    var roleSelect = row.append('select').attr('id', 'roleSelect')
        .on('change', function () {
            role = this.value;
            showLettering(ctx.doc.state);
        });
    ROLES.forEach(function (r) {roleSelect.append('option').attr('value', r.id).text(r.name)});
    var resetButton = row.append('button').text('Reset')
        .on('click', function () {
            var type = Object.assign({}, ctx.doc.state.style.type);
            delete type[role];
            setStyle({type: type, what: 'Reset lettering'});
        });
    var typeSelects = {};
    var typeRows = {};
    [['font', 'Font'], ['size', 'Size'], ['case', 'Case'], ['spacing', 'Spacing']].forEach(function (f) {
        var r = typeRows[f[0]] = s.append('div').attr('class', 'control-row');
        r.append('label').attr('for', 'type-' + f[0]).text(f[1]);
        typeSelects[f[0]] = r.append('select').attr('id', 'type-' + f[0])
            .on('change', function () {
                var type = Object.assign({}, ctx.doc.state.style.type);
                type[role] = Object.assign({}, type[role]);
                type[role][f[0]] = this.value;
                setStyle({type: type, what: 'Change lettering'});
            });
    });

    function showLettering(state) {
        var theme = getTheme(state.style.theme);
        var r = typography(theme, state.style)[role];
        // Some themes space region names by their own amount
        var spacings = TYPE_SPACINGS.some(function (x) {return x.id === r.spacing}) ? TYPE_SPACINGS :
            TYPE_SPACINGS.concat([{id: r.spacing, name: 'Theme\u2019s own'}]);
        options(typeSelects.font, typefaces(theme), r.font);
        options(typeSelects.size, TYPE_SIZES, r.size);
        // Single-stroke lettering has no small capitals or spacing
        options(typeSelects.case, r.hershey ? TYPE_CASES.slice(0, 2) : TYPE_CASES, r.case);
        options(typeSelects.spacing, spacings, r.spacing);
        typeRows.spacing.style('display', r.hershey ? 'none' : null);
        resetButton.property('disabled', !(state.style.type || {})[role]);
    }

    s = section(body, 'Layers');
    var list = s.append('div').attr('class', 'check-list');
    var boxes = {};
    var labels = {};
    TOGGLE_LAYERS.forEach(function (l) {
        var label = labels[l[0]] = list.append('label');
        boxes[l[0]] = label.append('input')
            .attr('type', 'checkbox')
            .on('change', function () {
                var hidden = ctx.doc.state.style.hidden.filter(function (h) {return h !== l[0]});
                if (!this.checked) hidden.push(l[0]);
                setStyle({hidden: hidden});
            });
        label.append('span').text(l[1]);
    });

    // Extras drawn over the map. Inputs apply when changed (Enter or leaving
    // the field), so typing doesn't add a step per key.
    s = section(body, 'Extras', 'Drawn over the map. Drag them with the Move tool; Delete removes them.');
    row = s.append('div').attr('class', 'control-row');
    row.append('label').attr('for', 'mapWidth').text('Map width');
    var widthInput = row.append('input').attr('id', 'mapWidth').attr('type', 'number').attr('min', 1).attr('step', 'any')
        .on('change', function () {
            var width = parseFloat(this.value);
            if (width > 0) setStyle({perUnit: width / ctx.doc.state.params.extent.width});
        });
    var unitsSelect = row.append('select').attr('aria-label', 'Units')
        .on('change', function () {setStyle({units: this.value})});
    UNITS.forEach(function (u) {unitsSelect.append('option').attr('value', u.id).text(u.name)});

    row = s.append('div').attr('class', 'control-row');
    row.append('label').attr('for', 'gridSelect').text('Grid');
    var gridSelect = row.append('select').attr('id', 'gridSelect')
        .on('change', function () {setStyle({grid: this.value})});
    GRIDS.forEach(function (g) {gridSelect.append('option').attr('value', g.id).text(g.name)});

    var gridSizeRow = s.append('div').attr('class', 'control-row');
    gridSizeRow.append('label').attr('for', 'gridSize').text('Every');
    var gridSizeInput = gridSizeRow.append('input').attr('id', 'gridSize').attr('type', 'number').attr('min', 0.1).attr('step', 'any')
        .on('change', function () {
            var size = parseFloat(this.value);
            if (size > 0) setStyle({gridSize: size});
        });
    var gridSizeUnits = gridSizeRow.append('span').attr('class', 'muted');

    var extrasList = s.append('div').attr('class', 'check-list');
    var extrasBoxes = {};
    var gridLabelText;
    [['gridLabels', 'Grid labels'], ['scaleBar', 'Scale bar'], ['compass', 'Compass rose']].forEach(function (x) {
        var label = extrasList.append('label');
        extrasBoxes[x[0]] = label.append('input').attr('type', 'checkbox')
            .on('change', function () {
                var change = {};
                change[x[0]] = this.checked;
                setStyle(change);
            });
        var text = label.append('span').text(x[1]);
        if (x[0] === 'gridLabels') gridLabelText = text;
    });

    // Resizes the rose on the map while dragging; the step is added on release
    var compassRow = s.append('div').attr('class', 'control-row');
    compassRow.append('label').attr('for', 'compassSize').text('Compass size');
    var compassOutput;
    var compassInput = compassRow.append('input').attr('id', 'compassSize').attr('type', 'range')
        .attr('min', COMPASS_SIZES.min).attr('max', COMPASS_SIZES.max).attr('step', 0.25)
        .on('input', function () {
            var size = +this.value;
            compassOutput.text('×' + size);
            ctx.svg.selectAll('.layer-extras .ornament').filter(function (d) {return d.id === 'compass'})
                .attr('transform', function () {
                    return this.getAttribute('transform').replace(/ scale\([^)]*\)$/, '') + ' scale(' + size + ')';
                });
        })
        .on('change', function () {setStyle({compassSize: +this.value})});
    compassOutput = compassRow.append('output').attr('for', 'compassSize');

    row = s.append('div').attr('class', 'control-row');
    row.append('label').attr('for', 'mapTitle').text('Title');
    var titleInput = row.append('input').attr('id', 'mapTitle').attr('type', 'text').attr('placeholder', 'None')
        .style('flex', 1)
        .on('change', function () {setStyle({title: this.value.trim()})});

    function options(select, items, value) {
        var opts = select.selectAll('option').data(items, function (d) {return d.id});
        opts.exit().remove();
        opts.enter().append('option').merge(opts)
            .attr('value', function (d) {return d.id})
            .text(function (d) {return d.name});
        select.property('value', value);
        select.property('disabled', items.length < 2);
    }

    ctx.updaters.push(function (state) {
        var style = state.style;
        var theme = getTheme(style.theme);
        themeSelect.property('value', theme.id);
        themeDescription.text(theme.description);
        options(fontSelect, theme.fonts, fontChoice(theme, style).id);
        options(backgroundSelect, theme.backgrounds, backgroundChoice(theme, style).id);
        showLettering(state);
        TOGGLE_LAYERS.forEach(function (l) {
            boxes[l[0]].property('checked', style.hidden.indexOf(l[0]) < 0);
        });
        // Only some themes shade the sea, or draw hills and forests
        labels.sea.style('display', theme.seaShading ? null : 'none');
        labels.relief.style('display', theme.symbols.relief ? null : 'none');
        labels.forest.style('display', theme.symbols.relief ? null : 'none');
        labels.tint.style('display', theme.regionTints ? null : 'none');
        labels.slope.style('display', theme.slopeShading === false ? 'none' : null);

        if (!state.params) return;
        var extras = extrasChoice(theme, style, state.params);
        var round = function (x) {return Math.round(x * 100) / 100};
        if (document.activeElement !== widthInput.node()) {
            widthInput.property('value', round(extras.perUnit * state.params.extent.width));
        }
        unitsSelect.property('value', extras.units.id);
        gridSelect.property('value', extras.grid);
        gridSizeRow.style('display', extras.grid === 'none' ? 'none' : null);
        if (document.activeElement !== gridSizeInput.node()) gridSizeInput.property('value', round(extras.gridSize));
        gridSizeUnits.text(extras.units.name);
        extrasBoxes.gridLabels.property('checked', !!extras.gridLabels)
            .property('disabled', extras.grid === 'none');
        gridLabelText.text(extras.grid === 'hex' ? 'Number the hexes' : 'Label the grid edges');
        extrasBoxes.scaleBar.property('checked', !!extras.scaleBar);
        extrasBoxes.compass.property('checked', !!extras.compass);
        compassRow.style('display', extras.compass ? null : 'none');
        compassInput.property('value', extras.compassSize);
        compassOutput.text('×' + extras.compassSize);
        if (document.activeElement !== titleInput.node()) titleInput.property('value', extras.title);
    });
}

var PANELS = [
    {id: 'build', name: 'Build', build: buildPanel},
    {id: 'style', name: 'Style', build: stylePanel},
    {id: 'history', name: 'History', build: historyPanel}
];

export function createPanels(tabs, body, ctx) {
    var panes = {};
    var buttons = {};
    PANELS.forEach(function (p) {
        buttons[p.id] = tabs.append('button')
            .attr('role', 'tab')
            .text(p.name)
            .on('click', function () {show(p.id)});
        panes[p.id] = body.append('div').attr('role', 'tabpanel');
        p.build(panes[p.id], ctx);
    });
    function show(id) {
        PANELS.forEach(function (p) {
            buttons[p.id].attr('aria-selected', p.id === id);
            panes[p.id].style('display', p.id === id ? null : 'none');
        });
        update(ctx.doc.state);
    }

    function update(state) {
        ctx.updaters.forEach(function (fn) {fn(state)});
    }
    show('build');
    return {
        show: show,
        update: update
    };
}
