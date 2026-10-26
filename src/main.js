// The editor: one map document, shown in one map view, changed by the tools
// on the left and the panels on the right.
import './fonts.js';
import * as d3 from 'd3';
import {saveSvg, saveSvgAsPng} from 'save-svg-as-png';
import {MapDocument, checkGenerator} from './core/document.js';
import {defaultParams, SHAPES, getShape} from './core/steps.js';
import {LANGUAGES} from './core/language.js';
import {newSeed, resolveSeed} from './core/random.js';
import {shareLink, readLink, clearLink} from './ui/share.js';
import * as R from './render/svg.js';
import {VIEWS, viewInfo, renderView} from './ui/views.js';
import {createTools, TOOLS} from './ui/tools.js';
import {createPanels} from './ui/panels.js';
import {describeStep} from './ui/history.js';
import {getTheme, fontChoice} from './themes/index.js';

var doc = new MapDocument();
var view = 'map';
var stage = d3.select('#stage');
var svg = R.addSVG(d3.select('#mapFrame'), 'mapSVG');
var statusbar = d3.select('#statusbar');
var strip = d3.select('#toolstrip');

// --- Drawing ---

// Draws the current map, or during a replay the step being shown
function render() {
    renderView(svg, view, replaying() ? doc.stateAt(panelCtx.replayAt + 1) : doc.state);
    tools.refresh();
    panels.update(doc.state);
    updateChrome();
}

// Labels are placed to fit the theme's fonts, so draw again once fonts
// arrive (placement only reruns if the lettering has changed)
if (document.fonts) {
    document.fonts.addEventListener('loadingdone', function () {
        if (doc.state.h) render();
    });
}

// Any change to the map ends a replay
doc.subscribe(function () {
    cancelReplay();
    render();
});

// --- Replay: play the current map's steps back from its start ---

var REPLAY_DELAY = 700;
var replayTimer = null;

function replaying() {
    return panelCtx.replayAt != null;
}

function startReplay() {
    var start = doc.startIndex();
    panelCtx.replayAt = start;
    stage.classed('replaying', true);
    showFrame(start);
}

function showFrame(start) {
    var i = panelCtx.replayAt;
    statusText = 'Replaying: step ' + (i - start + 1) + ' of ' + (doc.cursor - start) +
        ', ' + describeStep(doc.steps[i]).text.toLowerCase() + '. Esc to stop.';
    render();
    replayTimer = setTimeout(function () {
        if (panelCtx.replayAt + 1 >= doc.cursor) {
            stopReplay();
        } else {
            panelCtx.replayAt++;
            showFrame(start);
        }
    }, REPLAY_DELAY);
}

function cancelReplay() {
    if (!replaying()) return;
    clearTimeout(replayTimer);
    panelCtx.replayAt = null;
    statusText = null;
    stage.classed('replaying', false);
}

function stopReplay() {
    if (!replaying()) return;
    cancelReplay();
    render();
}

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

tools = createTools(doc, svg, stage, strip, d3.select('#toolOptions'), updateStatus);

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
    // The buttons say which step they'll undo or redo
    undoButton.property('disabled', !doc.canUndo())
        .attr('title', 'Undo' + (doc.canUndo() ? ': ' + describeStep(doc.steps[doc.cursor - 1]).text : '') +
            ' (' + (isMac ? '⌘Z' : 'Ctrl+Z') + ')');
    redoButton.property('disabled', !doc.canRedo())
        .attr('title', 'Redo' + (doc.canRedo() ? ': ' + describeStep(doc.steps[doc.cursor]).text : '') +
            ' (' + (isMac ? '⇧⌘Z' : 'Ctrl+Shift+Z') + ')');
    var start = currentStartStep();
    mapInfo.html('');
    if (start && start.type === 'generate') {
        mapInfo.append('span').text('Seed ');
        mapInfo.append('code').attr('title', 'Use this seed to generate the same map again').text(start.seed);
    } else if (start) {
        mapInfo.append('span').text('Hand-built map');
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

// Names for each shape's three detail levels
var detailNames = ['Low (fast)', 'Medium', 'High (slow)'];

var settings = [
    {id: 'nterrs', label: 'Territories'},
    {id: 'ncities', label: 'Cities and towns'},
    {id: 'npoi', label: 'Points of interest'},
    {id: 'nwrecks', label: 'Wrecks'}
];

var detailSection = newMap.append('section');
var grid = detailSection.append('div').attr('class', 'form-grid').style('margin-bottom', 0);
grid.append('label').attr('for', 'shape').text('Shape');
var shapeSelect = grid.append('select').attr('id', 'shape').on('change', function () {
    showShape(getShape(this.value));
});
SHAPES.forEach(function (s) {
    shapeSelect.append('option').attr('value', s.id).text(s.name);
});
grid.append('small').attr('class', 'field-hint').text('A4 maps fit the page with a border, with text sized for print');
grid.append('label').attr('for', 'npts').text('Detail');
var detailSelect = grid.append('select').attr('id', 'npts');

grid.append('label').attr('for', 'language').text('Place names');
var languageSelect = grid.append('select').attr('id', 'language');
LANGUAGES.forEach(function (l) {
    languageSelect.append('option').attr('value', l.id).attr('title', l.hint || null).text(l.name);
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

// Each shape has its own detail levels and default numbers of places
function showShape(shape) {
    var options = detailSelect.selectAll('option').data(shape.detail);
    options.enter().append('option').merge(options)
        .attr('value', function (n) {return n})
        .text(function (n, i) {return detailNames[i]});
    detailSelect.property('value', shape.detail[1]);
    settings.forEach(function (f) {
        d3.select('#' + f.id).property('value', shape.counts[f.id]);
    });
}

function resetSettings() {
    shapeSelect.property('value', defaultParams.shape);
    showShape(getShape(defaultParams.shape));
    languageSelect.property('value', defaultParams.language);
    d3.select('#seed').property('value', '');
}
resetSettings();

function readSettings() {
    var params = {shape: shapeSelect.property('value'), npts: +detailSelect.property('value'),
        language: languageSelect.property('value')};
    settings.forEach(function (f) {
        var n = parseInt(d3.select('#' + f.id).property('value'), 10);
        params[f.id] = n >= 0 ? n : defaultParams[f.id];
    });
    return params;
}

var buttons = random.append('div').attr('class', 'button-row');
buttons.append('button').text('Reset').on('click', resetSettings);
function generate(seed) {
    newMap.node().hidePopover();
    setView('map');
    act('generate', {params: readSettings()}, seed)();
}

// Under the seed field
grid.insert('small', 'label[for=nterrs]').attr('class', 'field-hint').text('Type "today" for the map of the day');

// Everyone who picks the map of the day (with the same settings) gets the same map
buttons.append('button').text('Map of the day').attr('title', 'A map seeded with today\'s date')
    .on('click', function () {generate(resolveSeed('today'))});
buttons.append('button').attr('class', 'primary').text('Generate').on('click', function () {
    // The seed is used once; the top bar shows it afterwards
    var seed = d3.select('#seed').property('value').trim();
    d3.select('#seed').property('value', '');
    generate(seed ? resolveSeed(seed) : newSeed());
});

var blank = newMap.append('section');
blank.append('h2').text('Blank map');
blank.append('p').text('Start with flat land and shape it yourself with the Build tools.');
blank.append('div').attr('class', 'button-row')
    .append('button').text('Start blank').on('click', function () {
        newMap.node().hidePopover();
        setView('heightmap');
        panels.show('build');
        act('newBlank', {shape: shapeSelect.property('value'), npts: +detailSelect.property('value'),
            language: languageSelect.property('value')})();
    });

// Export: always the finished map, whatever view is showing

var exportMenu = d3.select('#exportMenu');
// PNGs are drawn at twice the SVG size: about 280 dpi printed across A4

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
    var box = R.mapBox(doc.state.params);
    var opts = Object.assign({fonts: exportFonts(doc.state.style), excludeUnusedCss: true,
        left: box[0], top: box[1], width: box[2], height: box[3]}, options);
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
    // Just the current map: earlier maps in this session's history stay out
    var blob = new Blob([JSON.stringify(doc.toJSON({currentMap: true}))], {type: 'application/json'});
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

var panelCtx = {act: act, doc: doc, svg: svg, setView: setView, updaters: [], replayAt: null,
    stopReplay: stopReplay,
    toggleReplay: function () {
        if (replaying()) stopReplay();
        else startReplay();
    }};
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
        if (replaying()) stopReplay();
        else tools.set('pointer');
    } else if (!mod && !event.altKey && tools.forKey(key)) {
        tools.set(tools.forKey(key).id);
    }
});

// --- Share ---

var sharePanel = d3.select('#sharePanel');
sharePanel.append('h2').text('Share this map');
var shareNote = sharePanel.append('p');
var shareRow = sharePanel.append('div').attr('class', 'share-row');
var shareInput = shareRow.append('input').attr('type', 'text').attr('readonly', true)
    .attr('aria-label', 'Link to this map')
    .on('focus', function () {this.select()});
var copyButton = shareRow.append('button').attr('class', 'primary').text('Copy')
    .on('click', function () {
        shareInput.node().select();
        navigator.clipboard.writeText(shareInput.property('value')).then(function () {
            copyButton.text('Copied');
        }, function () {
            copyButton.text('Press ⌘C / Ctrl+C');
        });
    });

sharePanel.node().addEventListener('beforetoggle', function (event) {
    if (event.newState !== 'open') return;
    copyButton.text('Copy');
    shareInput.property('value', '');
    shareLink(doc).then(function (link) {
        shareInput.property('value', link);
        shareNote.text(link.indexOf('#map=') >= 0
            ? 'This link contains the whole map, including your changes. Anyone who opens it gets their own copy.'
            : 'This link recreates the map from its seed and settings. Anyone who opens it gets their own copy.');
        shareInput.node().focus();
    });
});

// --- Autosave: the current map, with its undo history, kept in this browser ---

var AUTOSAVE_KEY = 'terrain.autosave.v1';
var autosaveTimer = null;

doc.subscribe(function () {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosave, 500);
});

function autosave() {
    try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc.toJSON({currentMap: true, keepRedo: true})));
    } catch (e) {
        // Storage can be full or switched off; the map just isn't kept
    }
}

function restoreAutosave() {
    try {
        var saved = localStorage.getItem(AUTOSAVE_KEY);
        if (!saved) return false;
        doc.load(JSON.parse(saved));
        return true;
    } catch (e) {
        return false;
    }
}

// Open a shared link on top of whatever is already here, so the previous
// map is still in the history
function openLink(link) {
    if (link.json) {
        var steps = link.json.steps || [];
        if (!steps.length || ['generate', 'newBlank'].indexOf(steps[0].type) < 0) throw new Error('Not a map link');
        checkGenerator(link.json);
        steps.forEach(function (step) {doc.dispatch(step.type, step.args, step.seed)});
    } else {
        doc.dispatch('generate', {params: link.params, style: link.style}, link.seed);
    }
}

// Start: open a shared link, or the autosaved map, or a new random map.
// Runs after the page has had a chance to paint. Small screens only get a
// notice (see editor.css), so the map waits until the window is big enough.
updateChrome();
statusText = 'Loading…';
updateStatus();
var smallScreen = window.matchMedia('(max-width: 759px), (max-height: 499px)');
if (smallScreen.matches) {
    smallScreen.addEventListener('change', function waitForRoom() {
        if (smallScreen.matches) return;
        smallScreen.removeEventListener('change', waitForRoom);
        setTimeout(start, 20);
    });
} else {
    setTimeout(start, 20);
}

function start() {
    var restored = restoreAutosave();
    readLink().then(function (link) {
        if (link) {
            openLink(link);
            setView('map');
            clearLink();
        } else if (!restored) {
            doc.dispatch('generate', {params: defaultParams});
        }
    }).catch(function (e) {
        clearLink();
        alert('Couldn\'t open that link: ' + e.message);
        if (!restored) doc.dispatch('generate', {params: defaultParams});
    }).finally(function () {
        statusText = null;
        updateStatus();
    });
}
