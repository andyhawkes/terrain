// The right-hand panel: Build (shape the current map), Style (how it's
// drawn) and Advanced (the mesh demo).
import {meshDemo} from './views.js';

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
    buttonGrid(s, [{text: 'Rename all places', wide: true, onClick: act('renamePlaces')}]);
    s.select('.button-grid').style('margin-top', '8px');
}

var LAYERS = [
    ['coast', 'Coastline'], ['river', 'Rivers'], ['border', 'Borders'], ['slope', 'Slope shading'],
    ['city', 'Cities'], ['label', 'Labels'], ['wreck', 'Wrecks'], ['poi', 'Points of interest'],
    ['marker', 'Markers']
];

var FONTS = [
    ['default', 'Default (Cinzel)'], ['fantasy', 'Fantasy'], ['cursive', 'Cursive'],
    ['monospace', 'Monospace'], ['rlyehian', 'R\'lyehian'], ['cthulhu', 'R\'lyehian base']
];

function stylePanel(body, ctx) {
    var svg = ctx.svg;
    var s = section(body, 'Labels');
    var row = s.append('div').attr('class', 'control-row');
    row.append('label').attr('for', 'labelFont').text('Font');
    var select = row.append('select').attr('id', 'labelFont');
    FONTS.forEach(function (f) {
        select.append('option').attr('value', f[0]).text(f[1]);
    });
    select.on('change', function () {
        var value = this.value;
        FONTS.forEach(function (f) {svg.classed('labelStyle_' + f[0], f[0] === value)});
    });
    s.append('p').style('margin', '8px 0 0').text('Fonts other than the default may not survive PNG export.');

    s = section(body, 'Background');
    checkbox(s.append('div').attr('class', 'check-list'), 'Parchment', false, function (on) {
        svg.classed('parchment', on);
    });

    s = section(body, 'Layers');
    var list = s.append('div').attr('class', 'check-list');
    LAYERS.forEach(function (l) {
        checkbox(list, l[1], true, function (on) {svg.classed('hide-' + l[0], !on)});
    });
}

function advancedPanel(body, ctx) {
    var s = section(body, 'Mesh demo',
        'How the map grid is built: random points, spread out evenly, then joined into a mesh. This doesn\'t change your map.');
    var id = 'ctl' + nextId++;
    var row = s.append('div').attr('class', 'control-row');
    row.append('label').attr('for', id).text('Points');
    var input = row.append('input').attr('id', id).attr('type', 'number').attr('min', 16).property('value', 4096)
        .style('width', '6em');
    var cornersButton;
    function show() {
        cornersButton.text(meshDemo.showCorners ? 'Show original points' : 'Show Voronoi corners');
        ctx.setView('mesh');
    }
    buttonGrid(s, [
        {text: 'New points', onClick: function () {
            meshDemo.generate(parseInt(input.property('value'), 10) || 4096);
            meshDemo.showCorners = false;
            show();
        }},
        {text: 'Improve points', title: 'Move each point to the centre of its cell', onClick: function () {
            meshDemo.improve();
            show();
        }},
        {text: 'Show Voronoi corners', wide: true, onClick: function () {
            meshDemo.showCorners = !meshDemo.showCorners;
            show();
        }}
    ]);
    cornersButton = s.selectAll('.button-grid button').filter(function (d, i) {return i === 2});

    s = section(body, 'Map history');
    ctx.historyInfo = s.append('p');
}

var PANELS = [
    {id: 'build', name: 'Build', build: buildPanel},
    {id: 'style', name: 'Style', build: stylePanel},
    {id: 'advanced', name: 'Advanced', build: advancedPanel}
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
    }
    show('build');
    return {show: show};
}
