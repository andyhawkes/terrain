// The editor: one map document, shown in one map view, changed by the tools
// on the left and the panels on the right.
import './fonts.js';
import * as d3 from 'd3';
import {saveSvg, saveSvgAsPng} from 'save-svg-as-png';
import {MapDocument} from './core/document.js';
import {defaultParams} from './core/steps.js';
import {newSeed} from './core/random.js';
import * as R from './render/svg.js';
import {VIEWS, viewInfo, renderView} from './ui/views.js';
import {createTools, TOOLS} from './ui/tools.js';
import {createPanels} from './ui/panels.js';
import {getTheme, fontChoice} from './themes/index.js';

var doc = new MapDocument();
var view = 'map';
var stage = d3.select('#stage');
var svg = R.addSVG(d3.select('#mapFrame'), 'mapSVG');
var statusbar = d3.select('#statusbar');
var strip = d3.select('#toolstrip');

// --- Drawing ---

function render() {
    renderView(svg, view, doc.state);
    tools.bind();
    panels.update(doc.state);
    updateChrome();
}

doc.subscribe(render);

function setView(id) {
    view = id;
    viewSelect.property('value', id);
    render();
}

// Run a step after giving the browser a moment to show that it's busy
function act(type, args, seed) {
    return function () {
        stage.classed('busy', true);
        statusText = 'Working…';
        updateStatus();
        setTimeout(function () {
            try {
                doc.dispatch(type, args, seed);
            } finally {
                stage.classed('busy', false);
                statusText = null;
                updateStatus();
            }
        }, 20);
    };
}

// --- Status bar: tool hint or view description, plus the view picker ---

var statusText = null;
var tools = null;
var statusMessage = statusbar.append('span').attr('class', 'status-message');
var viewPicker = statusbar.append('label').attr('class', 'view-picker');
viewPicker.append('span').text('View');
var viewSelect = viewPicker.append('select').attr('id', 'viewSelect')
    .on('change', function () {setView(this.value)});
VIEWS.forEach(function (v) {
    viewSelect.append('option').attr('value', v.id).text(v.name);
});

function updateStatus() {
    statusMessage.html('');
    if (statusText) {
        statusMessage.text(statusText);
        return;
    }
    var tool = TOOLS.find(function (t) {return t.id === (tools ? tools.active : 'pointer')});
    if (tool.hint) {
        statusMessage.append('strong').text(tool.name + ': ');
        statusMessage.append('span').text(tool.hint + ' Esc to stop.');
    } else {
        statusMessage.append('strong').text(viewInfo(view).name + ' view: ');
        statusMessage.append('span').text(viewInfo(view).hint);
    }
}

// --- Tools and history ---

tools = createTools(doc, svg, stage, strip, updateStatus);

strip.append('hr');

function historyButton(icon, name, key, onClick) {
    var b = strip.append('button')
        .attr('title', name + ' (' + key + ')')
        .attr('aria-label', name)
        .on('click', onClick);
    b.append('span').attr('class', 'icon').attr('aria-hidden', true).text(icon);
    return b;
}

var isMac = /Mac|iPhone|iPad/.test(navigator.platform);
var undoButton = historyButton('undo', 'Undo', isMac ? '⌘Z' : 'Ctrl+Z', function () {doc.undo()});
var redoButton = historyButton('redo', 'Redo', isMac ? '⇧⌘Z' : 'Ctrl+Shift+Z', function () {doc.redo()});

// --- Top bar ---

var mapInfo = d3.select('#mapInfo');

// The step that started the current map (later steps build on it)
function currentStartStep() {
    for (var i = doc.cursor - 1; i >= 0; i--) {
        var type = doc.steps[i].type;
        if (type === 'generate' || type === 'newBlank') return doc.steps[i];
    }
    return null;
}

function updateChrome() {
    undoButton.property('disabled', !doc.canUndo());
    redoButton.property('disabled', !doc.canRedo());
    var start = currentStartStep();
    mapInfo.html('');
    if (start && start.type === 'generate') {
        mapInfo.append('span').text('Seed ');
        mapInfo.append('code').attr('title', 'Use this seed to generate the same map again').text(start.seed);
    } else if (start) {
        mapInfo.append('span').text('Hand-built map');
    }
    if (panelCtx && panelCtx.historyInfo) {
        panelCtx.historyInfo.text(doc.cursor + ' steps so far' +
            (doc.canRedo() ? ', plus ' + (doc.steps.length - doc.cursor) + ' undone' : '') + '.');
    }
    updateStatus();
}

// Popovers open just below the button that opened them
d3.selectAll('.popover').each(function () {
    var pop = this;
    pop.addEventListener('beforetoggle', function (event) {
        if (event.newState !== 'open') return;
        var opener = document.querySelector('[popovertarget="' + pop.id + '"]');
        var r = opener.getBoundingClientRect();
        pop.style.top = (r.bottom + 6) + 'px';
        pop.style.left = r.left + 'px';
    });
});

// New map

var newMap = d3.select('#newMapPanel');

var detailLevels = [
    [4096, 'Low (fast)'],
    [16384, 'Medium'],
    [65536, 'High (slow)']
];

var settings = [
    {id: 'nterrs', label: 'Territories'},
    {id: 'ncities', label: 'Cities and towns'},
    {id: 'npoi', label: 'Points of interest'},
    {id: 'nwrecks', label: 'Wrecks'}
];

var detailSection = newMap.append('section');
var grid = detailSection.append('div').attr('class', 'form-grid').style('margin-bottom', 0);
grid.append('label').attr('for', 'npts').text('Detail');
var detailSelect = grid.append('select').attr('id', 'npts');
detailLevels.forEach(function (d) {
    detailSelect.append('option').attr('value', d[0]).text(d[1]);
});

var random = newMap.append('section');
random.append('h2').text('Random map');
random.append('p').text('Coastline, rivers, cities and names, all from one seed.');
grid = random.append('div').attr('class', 'form-grid');
grid.append('label').attr('for', 'seed').text('Seed');
grid.append('input').attr('id', 'seed').attr('type', 'text').attr('placeholder', 'Random');
settings.forEach(function (f) {
    grid.append('label').attr('for', f.id).text(f.label);
    grid.append('input').attr('id', f.id).attr('type', 'number').attr('min', 0).attr('max', 200);
});

function resetSettings() {
    detailSelect.property('value', defaultParams.npts);
    d3.select('#seed').property('value', '');
    settings.forEach(function (f) {
        d3.select('#' + f.id).property('value', defaultParams[f.id]);
    });
}
resetSettings();

function readSettings() {
    var params = {npts: +detailSelect.property('value')};
    settings.forEach(function (f) {
        var n = parseInt(d3.select('#' + f.id).property('value'), 10);
        params[f.id] = n >= 0 ? n : defaultParams[f.id];
    });
    return params;
}

var buttons = random.append('div').attr('class', 'button-row');
buttons.append('button').text('Reset').on('click', resetSettings);
buttons.append('button').attr('class', 'primary').text('Generate').on('click', function () {
    // The seed is used once; the top bar shows it afterwards
    var seed = d3.select('#seed').property('value').trim();
    d3.select('#seed').property('value', '');
    newMap.node().hidePopover();
    setView('map');
    act('generate', {params: readSettings()}, seed || newSeed())();
});

var blank = newMap.append('section');
blank.append('h2').text('Blank map');
blank.append('p').text('Start with flat land and shape it yourself with the Build tools.');
blank.append('div').attr('class', 'button-row')
    .append('button').text('Start blank').on('click', function () {
        newMap.node().hidePopover();
        setView('heightmap');
        panels.show('build');
        act('newBlank', {npts: +detailSelect.property('value')})();
    });

// Export: always the finished map, whatever view is showing

var exportMenu = d3.select('#exportMenu');
var exportOptions = {left: -500, top: -500, width: 1000, height: 1000, excludeUnusedCss: true};

// The @font-face rules for the fonts the current theme uses, for embedding.
// (Left to itself the exporter would embed every font on the page.)
function exportFonts(style) {
    var theme = getTheme(style.theme);
    var font = fontChoice(theme, style);
    var families = [font.label, font.region, theme.symbols.poi.font]
        .filter(function (f) {return typeof f === 'string'})
        .join(',').split(',')
        .map(function (f) {return f.trim().replace(/^["']|["']$/g, '')});
    var fonts = [];
    Array.from(document.styleSheets).forEach(function (sheet) {
        var rules;
        try {
            rules = sheet.cssRules;
        } catch (e) {
            return; // stylesheets from other origins can't be read
        }
        Array.from(rules).forEach(function (rule) {
            if (!(rule instanceof CSSFontFaceRule)) return;
            var family = rule.style.getPropertyValue('font-family').replace(/^["']|["']$/g, '');
            var url = rule.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/);
            if (families.indexOf(family) < 0 || !url) return;
            var href = new URL(url[1], sheet.href || location.href).href;
            fonts.push({text: rule.cssText, url: href,
                format: /\.woff2/.test(href) ? 'font/woff2' : /\.woff/.test(href) ? 'font/woff' : 'font/ttf'});
        });
    });
    return fonts;
}

function exportMap(save, name, options) {
    exportMenu.node().hidePopover();
    var previous = view;
    if (view !== 'map') setView('map');
    var opts = Object.assign({fonts: exportFonts(doc.state.style)}, exportOptions, options);
    save(svg.node(), name, opts).finally(function () {
        if (previous !== 'map') setView(previous);
    });
}

function fileName(ext) {
    var start = currentStartStep();
    return 'map' + (start && start.type === 'generate' ? '-' + start.seed : '') + '.' + ext;
}

[
    ['image', 'PNG image', function () {exportMap(saveSvgAsPng, fileName('png'), {scale: 2})}],
    ['draw', 'SVG drawing', function () {exportMap(saveSvg, fileName('svg'))}]
].forEach(function (item) {
    var b = exportMenu.append('button').on('click', item[2]);
    b.append('span').attr('class', 'icon').attr('aria-hidden', true).text(item[0]);
    b.append('span').text(item[1]);
});

// Save and open: a map file is its list of steps

d3.select('#saveButton').on('click', function () {
    var blob = new Blob([JSON.stringify(doc.toJSON())], {type: 'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName('json');
    a.click();
    setTimeout(function () {URL.revokeObjectURL(a.href)}, 1000);
});

var openFile = d3.select('#openFile');
d3.select('#openButton').on('click', function () {openFile.node().click()});
openFile.on('change', function () {
    var file = this.files[0];
    this.value = '';
    if (!file) return;
    file.text().then(function (text) {
        statusText = 'Opening ' + file.name + '…';
        updateStatus();
        setTimeout(function () {
            try {
                doc.load(JSON.parse(text));
                setView('map');
            } catch (e) {
                alert('Couldn\'t open ' + file.name + ': ' + e.message);
            } finally {
                statusText = null;
                updateStatus();
            }
        }, 20);
    });
});

// --- Side panel ---

var panelCtx = {act: act, doc: doc, svg: svg, setView: setView, updaters: []};
var panels = createPanels(d3.select('#panelTabs'), d3.select('#panelBody'), panelCtx);

// --- Keyboard shortcuts ---

document.addEventListener('keydown', function (event) {
    var target = event.target;
    if (target.closest && target.closest('input, select, textarea, [popover]')) return;
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
        tools.set('pointer');
    } else if (!mod && !event.altKey && tools.forKey(key)) {
        tools.set(tools.forKey(key).id);
    }
});

// Start with a random map, after the page has had a chance to paint
updateChrome();
act('generate', {params: defaultParams})();
