// UI wiring. Every tab is a different view of one shared map document; the
// buttons dispatch steps, and the active view redraws when the map changes.
import * as d3 from 'd3';
import {saveSvg, saveSvgAsPng} from 'save-svg-as-png';
import {MapDocument} from './core/document.js';
import {defaultParams} from './core/steps.js';
import {newSeed} from './core/random.js';
import * as T from './core/terrain.js';
import {derive, terrainLayers} from './core/derive.js';
import * as R from './render/svg.js';

var doc = new MapDocument();
var activeTab = '#quick';
var views = {};

function run(type, args) {
    return function () {
        doc.dispatch(type, args);
    };
}

function button(div, text, onClick) {
    return div.append('button').text(text).on('click', onClick);
}

// A button whose label flips between two states
function toggle(div, labels, initial, onChange) {
    var on = initial;
    var but = div.append('button')
        .text(labels[on ? 1 : 0])
        .on('click', function () {
            on = !on;
            but.text(labels[on ? 1 : 0]);
            onChange(on);
            redraw();
        });
    return but;
}

function redraw() {
    var view = views[activeTab];
    if (view && doc.state.h) view(doc.state);
    updateHistoryButtons();
}

doc.subscribe(redraw);

// --- Quick start ---

var quickDiv = d3.select('div#quick');

button(quickDiv, 'Generate new random map', function () {
    doc.dispatch('generate', {params: defaultParams});
    goToTab('#final');
});

button(quickDiv, 'Start a blank map', function () {
    doc.dispatch('newBlank', {npts: readSettings().npts});
    goToTab('#prim');
});

quickDiv.append('h3').text('Custom settings');

var settingFields = [
    {id: 'seed', label: 'Seed (random)'},
    {id: 'npts', label: 'Grid points (' + defaultParams.npts + ')'},
    {id: 'nterrs', label: 'Territories (' + defaultParams.nterrs + ')'},
    {id: 'ncities', label: 'Cities (' + defaultParams.ncities + ')'},
    {id: 'nwrecks', label: 'Wrecks (' + defaultParams.nwrecks + ')'},
    {id: 'npoi', label: 'Points of interest (' + defaultParams.npoi + ')'}
];

settingFields.forEach(function (f) {
    quickDiv.append('input')
        .attr('id', f.id)
        .attr('type', f.id === 'seed' ? 'text' : 'number')
        .attr('min', f.id === 'npts' ? 256 : 0)
        .attr('placeholder', f.label)
        .attr('title', f.label);
});

// Read the custom settings, falling back to defaults for empty fields
function readSettings() {
    var params = Object.assign({}, defaultParams);
    settingFields.forEach(function (f) {
        if (f.id === 'seed') return;
        var n = parseInt(d3.select('#' + f.id).property('value'), 10);
        if (n >= 0) params[f.id] = n;
    });
    return params;
}

button(quickDiv, 'Generate map from settings', function () {
    var seed = d3.select('#seed').property('value').trim();
    doc.dispatch('generate', {params: readSettings()}, seed || newSeed());
    goToTab('#final');
});

button(quickDiv, 'Reset to defaults', function () {
    settingFields.forEach(function (f) {
        d3.select('#' + f.id).property('value', '');
    });
});

// --- Map mesh (a standalone demo of how the mesh is built) ---

var meshDiv = d3.select('div#mesh');
var meshSVG = R.addSVG(meshDiv, 'meshSVG');
var meshPts = null;
var meshVxs = null;
var meshDual = false;

function meshDraw() {
    if (!meshPts) return;
    if (meshDual && !meshVxs) {
        meshVxs = T.makeMesh(meshPts).vxs;
    }
    R.visualizePoints(meshSVG, meshDual ? meshVxs : meshPts);
}

meshDiv.append('input')
    .attr('id', 'gridPoints')
    .attr('type', 'number')
    .attr('placeholder', 'Points (' + defaultParams.npts + ')');

button(meshDiv, 'Generate map mesh', function () {
    var n = parseInt(d3.select('#gridPoints').property('value'), 10);
    meshDual = false;
    vorBut.text('Show Voronoi corners');
    meshVxs = null;
    meshPts = T.generatePoints(n > 0 ? n : defaultParams.npts);
    meshDraw();
});

button(meshDiv, 'Improve mesh', function () {
    if (!meshPts) return;
    meshPts = T.improvePoints(meshPts);
    meshVxs = null;
    meshDraw();
});

var vorBut = button(meshDiv, 'Show Voronoi corners', function () {
    meshDual = !meshDual;
    vorBut.text(meshDual ? 'Show original points' : 'Show Voronoi corners');
    meshDraw();
});

// --- Rough outline ---

var primDiv = d3.select('div#prim');
var primSVG = R.addSVG(primDiv, 'primSVG');

views['#prim'] = function (state) {
    R.visualizeVoronoi(primSVG, state.h, -1, 1);
    R.drawPaths(primSVG, 'coast', terrainLayers(state.h).coasts);
};

button(primDiv, 'Reset to flat', run('flatten'));
button(primDiv, 'Add random slope', run('slope'));
button(primDiv, 'Add cone', run('cone', {slope: -0.5}));
button(primDiv, 'Add inverted cone', run('cone', {slope: 0.5}));
button(primDiv, 'Add 5 blobs', run('blobs', {count: 5}));
button(primDiv, 'Add 10 blobs', run('blobs', {count: 10}));
button(primDiv, 'Normalize heightmap', run('normalize'));
button(primDiv, 'Round hills', run('roundHills'));
button(primDiv, 'Relax', run('relax'));
button(primDiv, 'Set sea level to median', run('seaLevel', {q: 0.5}));

// --- Erosion ---

var erodeDiv = d3.select('div#erode');
var erodeSVG = R.addSVG(erodeDiv, 'erodeSVG');
var erodeViewErosion = false;

views['#erode'] = function (state) {
    if (erodeViewErosion) {
        R.visualizeVoronoi(erodeSVG, T.erosionRate(state.h));
    } else {
        R.visualizeVoronoi(erodeSVG, state.h, 0, 1);
    }
    R.drawPaths(erodeSVG, 'coast', terrainLayers(state.h).coasts);
};

button(erodeDiv, 'Generate random heightmap', run('randomHeightmap', {style: 'uneroded'}));
button(erodeDiv, 'Erode', run('erode', {amount: 0.1}));
button(erodeDiv, 'Set sea level to median', run('seaLevel', {q: 0.5}));
button(erodeDiv, 'Clean coastlines', run('cleanCoast'));
toggle(erodeDiv, ['Show erosion rate', 'Show heightmap'], false, function (on) {
    erodeViewErosion = on;
});

// --- Terrain ---

var physDiv = d3.select('div#phys');
var physSVG = R.addSVG(physDiv, 'physSVG');
var physView = {coast: false, rivers: false, slope: false, height: true};

views['#phys'] = function (state) {
    var layers = terrainLayers(state.h);
    if (physView.height) {
        R.visualizeVoronoi(physSVG, state.h, 0);
    } else {
        R.clear(physSVG, 'field');
    }
    R.drawPaths(physSVG, 'coast', physView.coast ? layers.coasts : []);
    R.drawPaths(physSVG, 'river', physView.rivers ? layers.rivers : []);
    R.drawSlopes(physSVG, physView.slope ? layers.slopes : []);
};

button(physDiv, 'Generate random heightmap', run('randomHeightmap', {style: 'coast'}));
toggle(physDiv, ['Show coastline', 'Hide coastline'], false, function (on) {physView.coast = on});
toggle(physDiv, ['Show rivers', 'Hide rivers'], false, function (on) {physView.rivers = on});
toggle(physDiv, ['Show slope shading', 'Hide slope shading'], false, function (on) {physView.slope = on});
toggle(physDiv, ['Hide heightmap', 'Show heightmap'], false, function (on) {physView.height = !on});

// --- Cities & borders ---

var cityDiv = d3.select('div#city');
var citySVG = R.addSVG(cityDiv, 'citySVG');
var cityViewTerritories = false;

views['#city'] = function (state) {
    var d = derive(state);
    if (cityViewTerritories) {
        R.visualizeVoronoi(citySVG, d.terr);
    } else {
        var score = T.cityScore(state.h, state.cities.map(function (c) {return c.vx}));
        R.visualizeVoronoi(citySVG, score, d3.max(score) - 0.5);
    }
    R.drawPaths(citySVG, 'coast', d.coasts);
    R.drawPaths(citySVG, 'river', d.rivers);
    R.drawPaths(citySVG, 'border', d.borders);
    R.drawSlopes(citySVG, d.slopes);
    R.drawFeatures(citySVG, state);
};

button(cityDiv, 'Add new city', run('addCities', {count: 1}));
button(cityDiv, 'Add 5 cities', run('addCities', {count: 5}));
button(cityDiv, 'Add 10 cities', run('addCities', {count: 10}));
button(cityDiv, 'Add new point of interest', run('addPOI', {count: 1}));
button(cityDiv, 'Add new wreck', run('addWrecks', {count: 1}));
toggle(cityDiv, ['Show territories', 'Show city location scores'], false, function (on) {
    cityViewTerritories = on;
});

// --- Final map ---

var finalDiv = d3.select('div#final');
var finalMapDiv = d3.select('div#finalMap');
var finalSVG = R.addSVG(finalMapDiv, 'finalMapSVG');
var editControlsDiv = d3.select('div#editControls');
var seedNote = finalDiv.insert('p', '#finalMap').attr('class', 'seedNote');

views['#final'] = function (state) {
    R.drawMap(finalSVG, state);
    bindDragging();
    var start = currentStartStep();
    seedNote.text(start && start.type === 'generate' ? 'Seed: ' + start.seed : '');
};

// The step that started the current map (later steps build on it)
function currentStartStep() {
    for (var i = doc.cursor - 1; i >= 0; i--) {
        var type = doc.steps[i].type;
        if (type === 'generate' || type === 'newBlank') return doc.steps[i];
    }
    return null;
}

// Editing tools: at most one is active at a time
var tools = {
    label: {icon: 'text_fields', title: 'Edit labels', cls: 'editable'},
    delete: {icon: 'delete_forever', title: 'Delete markers or hide labels', cls: 'deleteMode'},
    marker: {icon: 'add_location', title: 'Add treasure markers', cls: 'clickableMode'},
    move: {icon: 'arrows_output', title: 'Move markers and labels', cls: 'dragableMode'}
};
var activeTool = null;

Object.keys(tools).forEach(function (name) {
    var tool = tools[name];
    tool.button = editControlsDiv.append('button')
        .text(tool.icon)
        .attr('title', tool.title)
        .attr('class', 'material-symbols-outlined')
        .on('click', function () {
            setTool(activeTool === name ? null : name);
        });
});

function setTool(name) {
    activeTool = name;
    Object.keys(tools).forEach(function (n) {
        tools[n].button.classed('active', n === name);
        finalMapDiv.classed(tools[n].cls, n === name);
    });
    bindDragging();
}

var undoBut = editControlsDiv.append('button')
    .text('undo')
    .attr('title', 'Undo (Ctrl/Cmd+Z)')
    .attr('class', 'material-symbols-outlined')
    .on('click', function () {doc.undo()});

var redoBut = editControlsDiv.append('button')
    .text('redo')
    .attr('title', 'Redo (Ctrl/Cmd+Shift+Z)')
    .attr('class', 'material-symbols-outlined')
    .on('click', function () {doc.redo()});

function updateHistoryButtons() {
    undoBut.property('disabled', !doc.canUndo());
    redoBut.property('disabled', !doc.canRedo());
}

var parchmentBut = editControlsDiv.append('button')
    .text('map')
    .attr('title', 'Parchment background')
    .attr('class', 'material-symbols-outlined')
    .on('click', function () {
        var on = !finalMapDiv.classed('parchment');
        finalMapDiv.classed('parchment', on);
        parchmentBut.classed('active', on);
    });

function labelKind(d) {
    return d.kind === 'regionLabel' ? 'region' : 'city';
}

function isLabel(d) {
    return d && (d.kind === 'cityLabel' || d.kind === 'regionLabel');
}

finalSVG.on('click', function () {
    var d = d3.select(d3.event.target).datum();
    if (activeTool === 'marker') {
        var p = d3.mouse(this);
        doc.dispatch('addMarker', {pos: [p[0] / R.SCALE, p[1] / R.SCALE]});
    } else if (activeTool === 'delete' && d && d.id != null) {
        // Deleting a label hides it; deleting a marker or city removes it
        if (isLabel(d)) doc.dispatch('editLabel', {id: d.id, kind: labelKind(d), text: ''});
        else doc.dispatch('deleteItem', {id: d.id});
    } else if (activeTool === 'label' && isLabel(d)) {
        var text = prompt('Label text', d.label.text);
        if (text != null && text !== d.label.text) {
            doc.dispatch('editLabel', {id: d.id, kind: labelKind(d), text: text});
        }
    }
});

var dragStart;

var dragHandler = d3.drag()
    .on('start', function () {
        var el = d3.select(this);
        dragStart = {x: d3.event.x, y: d3.event.y, transform: el.attr('transform') || ''};
    })
    .on('drag', function () {
        var dx = d3.event.x - dragStart.x;
        var dy = d3.event.y - dragStart.y;
        d3.select(this).attr('transform', 'translate(' + dx + ',' + dy + ') ' + dragStart.transform);
    })
    .on('end', function (d) {
        var dx = (d3.event.x - dragStart.x) / R.SCALE;
        var dy = (d3.event.y - dragStart.y) / R.SCALE;
        if (dx === 0 && dy === 0) return;
        var pos = [d.pos[0] + dx, d.pos[1] + dy];
        if (isLabel(d)) doc.dispatch('moveLabel', {id: d.id, kind: labelKind(d), pos: pos});
        else doc.dispatch('moveItem', {id: d.id, pos: pos});
    });

// Re-applied after every redraw, so newly drawn items can be dragged too
function bindDragging() {
    var draggable = finalSVG.selectAll('circle.city, use.wreck, text.poi, path.placedMarker, text.city, text.region');
    if (activeTool === 'move') {
        draggable.call(dragHandler);
    } else {
        draggable.on('.drag', null);
    }
}

button(finalDiv, 'Rename places', run('renamePlaces'));

var labelStyles = ['fantasy', 'cursive', 'monospace', 'rlyehian', 'cthulhu'];
var styleSelect = finalDiv.append('select')
    .attr('name', 'labelStyle')
    .attr('id', 'labelStyle')
    .on('change', function () {
        finalSVG.attr('class', 'labelStyle_' + this.value);
    });
styleSelect.append('option')
    .attr('value', 'default')
    .text('default font');
labelStyles.forEach(function (style) {
    styleSelect.append('option')
        .attr('value', style)
        .text(style + ' font');
});

button(finalDiv, 'Download as PNG', function () {
    saveSvgAsPng(finalSVG.node(), 'map.png', {left: -500, top: -500});
});

button(finalDiv, 'Download as SVG', function () {
    saveSvg(finalSVG.node(), 'map.svg', {left: -500, top: -500});
});

// --- Keyboard shortcuts ---

document.addEventListener('keydown', function (event) {
    if (event.target.closest && event.target.closest('input, select, textarea')) return;
    var mod = event.metaKey || event.ctrlKey;
    var key = event.key.toLowerCase();
    if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) doc.redo();
        else doc.undo();
    } else if (mod && key === 'y') {
        event.preventDefault();
        doc.redo();
    } else if (event.key === 'Escape') {
        setTool(null);
    }
});

// --- Navigation ---

var navLinks = document.querySelectorAll('nav a');

navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
        event.preventDefault();
        goToTab(link.getAttribute('href'));
    });
});

function goToTab(target) {
    activeTab = target;
    document.querySelectorAll('.example').forEach(function (el) {
        el.classList.toggle('active', '#' + el.id === target);
    });
    navLinks.forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('href') === target);
    });
    redraw();
}

// Start with a random map, after the page has had a chance to paint
updateHistoryButtons();
setTimeout(function () {
    doc.dispatch('generate', {params: defaultParams});
}, 0);
