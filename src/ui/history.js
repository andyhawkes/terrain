// The History panel: every step that built the map, in order. Click one to
// go back to it; Replay plays the current map's steps back from its start.
import {MARKER_TYPES, SYMBOL_KINDS} from '../core/steps.js';
import {getTheme} from '../themes/index.js';

function plural(n, one, many) {
    n = parseInt(n, 10) || 1;
    return n === 1 ? one : n + ' ' + many;
}

function quoted(text) {
    return '“' + (text.length > 24 ? text.slice(0, 23) + '…' : text) + '”';
}

function symbolName(kind) {
    var k = SYMBOL_KINDS.find(function (s) {return s.id === kind});
    return k ? k.name.toLowerCase() : 'a symbol';
}

var LAYER_NAMES = {coast: 'coastline', sea: 'sea shading', river: 'rivers', border: 'borders', slope: 'slope shading', city: 'cities',
    label: 'labels', wreck: 'wrecks', poi: 'points of interest', marker: 'markers'};

function describeStyle(args, previous) {
    if (args.theme) return 'Theme: ' + getTheme(args.theme).name;
    if (args.font) return 'Change lettering';
    if (args.background) return 'Change background';
    if (args.hidden) {
        var before = previous || [];
        var shown = before.filter(function (l) {return args.hidden.indexOf(l) < 0});
        var hidden = args.hidden.filter(function (l) {return before.indexOf(l) < 0});
        if (hidden.length === 1 && !shown.length) return 'Hide ' + LAYER_NAMES[hidden[0]];
        if (shown.length === 1 && !hidden.length) return 'Show ' + LAYER_NAMES[shown[0]];
        return 'Change layers';
    }
    return 'Change style';
}

// A short description of a step, plus optional detail. Steps from the editing
// tools carry a "what" argument naming the thing they changed.
export function describeStep(step, previousHidden) {
    var a = step.args || {};
    var what = a.what ? ' ' + a.what : '';
    switch (step.type) {
    case 'newBlank': return {text: 'New blank map', start: true};
    case 'generate': return {text: 'New random map', detail: 'seed ' + step.seed, start: true};
    case 'randomHeightmap': return {text: a.style === 'uneroded' ? 'Random hills' : 'Random coastline'};
    case 'flatten': return {text: 'Reset to flat'};
    case 'slope': return {text: 'Random slope'};
    case 'cone': return {text: a.slope > 0 ? 'Inverted cone' : 'Cone'};
    case 'blobs': return {text: 'Add ' + plural(a.count, 'a blob', 'blobs')};
    case 'normalize': return {text: 'Normalize heights'};
    case 'roundHills': return {text: 'Round hills'};
    case 'relax': return {text: 'Relax'};
    case 'seaLevel': return {text: 'Sea level', detail: Math.round((a.q == null ? 0.5 : a.q) * 100) + '%'};
    case 'erode': return {text: 'Erode', detail: (a.amount || 0.1).toFixed(2)};
    case 'cleanCoast': return {text: 'Clean coastlines'};
    case 'addCities': return {text: 'Add ' + plural(a.count, 'a city', 'cities')};
    case 'addPOI': return {text: 'Add ' + plural(a.count, 'a point of interest', 'points of interest')};
    case 'addWrecks': return {text: 'Add ' + plural(a.count, 'a wreck', 'wrecks')};
    case 'renamePlaces': return {text: 'Rename all places'};
    case 'setStyle': return {text: describeStyle(a, previousHidden)};
    case 'addMarker':
        var type = MARKER_TYPES.find(function (t) {return t.id === (a.type || 'x')});
        return {text: 'Add marker', detail: type ? type.name : null, color: a.color};
    case 'addSymbol': return {text: 'Add ' + symbolName(a.kind)};
    case 'setSymbol': return {text: 'Change' + what, detail: 'to ' + symbolName(a.kind) + ' ' + ((a.variant || 0) + 1)};
    case 'addNote': return {text: 'Add text', detail: quoted(a.text || '')};
    case 'moveItem': return {text: 'Move' + what};
    case 'moveLabel': return {text: 'Move label' + what};
    case 'deleteItem': return {text: 'Delete' + what};
    case 'editLabel':
        if (a.kind === 'note') return {text: 'Edit text', detail: quoted(a.text)};
        if (!a.text) return {text: 'Hide name' + what};
        return {text: 'Rename' + what, detail: 'to ' + quoted(a.text)};
    default: return {text: step.type};
    }
}

export function historyPanel(body, ctx) {
    var doc = ctx.doc;
    var head = body.append('div').attr('class', 'panel-section');
    head.append('p').text('Every change to the map, in order. Click a step to go back to it. ' +
        'Changing the map from there replaces the steps after it.');
    var replayButton = head.append('button')
        .attr('class', 'replay-button')
        .on('click', function () {ctx.toggleReplay()});
    var replayIcon = replayButton.append('span').attr('class', 'icon').attr('aria-hidden', true);
    var replayText = replayButton.append('span');

    var list = body.append('ol').attr('class', 'history-list').attr('aria-label', 'Map history');

    ctx.updaters.push(function () {
        var replaying = ctx.replayAt != null;
        replayIcon.text(replaying ? 'stop' : 'play_arrow');
        replayText.text(replaying ? 'Stop replay' : 'Replay this map');
        replayButton.property('disabled', !replaying && doc.cursor - doc.startIndex() < 2);

        // Work out descriptions, tracking hidden layers to say what changed
        var hidden = [];
        var rows = doc.steps.map(function (step, i) {
            var row = describeStep(step, hidden);
            if (step.type === 'setStyle' && step.args.hidden) hidden = step.args.hidden;
            row.index = i;
            return row;
        });
        var current = replaying ? ctx.replayAt : doc.cursor - 1;

        var items = list.selectAll('li').data(rows);
        items.exit().remove();
        var entered = items.enter().append('li');
        var button = entered.append('button').on('click', function (row) {
            ctx.stopReplay();
            doc.goTo(row.index + 1);
        });
        button.append('span').attr('class', 'history-swatch');
        button.append('span').attr('class', 'history-text');
        button.append('span').attr('class', 'history-detail');
        items = entered.merge(items);
        items
            .classed('start', function (r) {return !!r.start})
            .classed('current', function (r) {return r.index === current})
            .classed('undone', function (r) {return r.index >= doc.cursor});
        items.select('button').attr('aria-current', function (r) {return r.index === current ? 'step' : null});
        items.select('.history-swatch')
            .style('display', function (r) {return r.color ? null : 'none'})
            .style('background', function (r) {return r.color || null});
        items.select('.history-text').text(function (r) {return r.text});
        items.select('.history-detail').text(function (r) {return r.detail || ''});

        // Keep the current step in view
        var node = list.select('li.current').node();
        if (node && body.node().offsetParent) node.scrollIntoView({block: 'nearest'});
    });
}
