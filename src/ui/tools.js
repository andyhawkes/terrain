// The editing tools in the left-hand strip. One tool is active at a time;
// "pointer" means no editing. Some tools show options above the map.
import * as d3 from 'd3';
import * as R from '../render/svg.js';
import {MARKER_TYPES} from '../core/steps.js';
import {getTheme} from '../themes/index.js';
import {editText, close as closeEditor} from './textEditor.js';

export var TOOLS = [
    {id: 'pointer', icon: 'arrow_selector_tool', name: 'Pointer', key: 'v',
        hint: null},
    {id: 'move', icon: 'open_with', name: 'Move', key: 'g',
        hint: 'Drag places, labels, symbols or your own text. A city\'s label moves with it; a label moves on its own.'},
    {id: 'label', icon: 'edit', name: 'Edit text', key: 'e',
        hint: 'Click a name or your own text to change it. Clicking a city lets you name it even if its label is hidden.'},
    {id: 'note', icon: 'title', name: 'Add text', key: 't',
        hint: 'Click the map to write something there, like "Here be dragons".'},
    {id: 'marker', icon: 'location_on', name: 'Add marker', key: 'm',
        hint: 'Click the map to add a marker. Choose its kind and colour above the map.'},
    {id: 'delete', icon: 'delete', name: 'Delete', key: 'd',
        hint: 'Click a place, symbol, marker or text to remove it. Clicking a city or region name hides the name.'}
];

var DRAGGABLE = '.layer-city .city, .layer-wreck .wreck, .layer-poi .poi, .layer-marker .placedMarker, ' +
    '.city-label, .region-label, .note-label';

function isLabel(d) {
    return d && (d.kind === 'cityLabel' || d.kind === 'regionLabel');
}

// A short name for what an edit acted on, recorded with the step so the
// History panel can say e.g. "Move Nenonu"
function nameOf(d) {
    var named = d.kind === 'city' ? d.item.name : (d.label && d.label.text);
    if (named && d.kind !== 'note') return named;
    if (d.kind === 'note') return '“' + d.item.text + '”';
    if (d.kind === 'marker') {
        var type = MARKER_TYPES.find(function (t) {return t.id === d.item.type});
        return (type ? type.name.toLowerCase() : 'a') + ' marker';
    }
    return {city: 'a city', wreck: 'a wreck', poi: 'a point of interest'}[d.kind] || '';
}

// What clicking with the Edit text tool edits, if anything
function editable(d) {
    if (!d || d.id == null) return null;
    if (d.kind === 'cityLabel') return {kind: 'city', text: d.label.text};
    if (d.kind === 'regionLabel') return {kind: 'region', text: d.label.text};
    if (d.kind === 'note') return {kind: 'note', text: d.item.text};
    if (d.kind === 'city') return {kind: 'city', text: d.item.name};
    return null;
}

// Colours offered for new markers; any other can be picked with the last swatch
var MARKER_COLORS = [
    {color: '#000000', name: 'Black'},
    {color: '#c62828', name: 'Red'},
    {color: '#1e5aa8', name: 'Blue'},
    {color: '#2e7d32', name: 'Green'},
    {color: '#7b4a1e', name: 'Brown'},
    {color: '#6a1b9a', name: 'Purple'}
];

// Small previews of the current theme's marker symbols, for the options bar
function markerPreview(button, spec) {
    var svg = button.append('svg').attr('viewBox', '-16 -16 32 32').attr('aria-hidden', true);
    var g = svg.append('g').attr('transform', spec.transform || null);
    spec.variants[0].forEach(function (part) {
        g.append('path').attr('d', part.d);
    });
}

// stage gets a tool-<id> class; onChange is called with the new tool
export function createTools(doc, svg, stage, strip, optionsBar, onChange) {
    var active = 'pointer';
    var markerType = 'x';
    var markerColor = MARKER_COLORS[0].color;
    var buttons = {};
    var shownTheme = null;

    TOOLS.forEach(function (tool) {
        buttons[tool.id] = strip.append('button')
            .attr('title', tool.name + ' (' + tool.key.toUpperCase() + ')')
            .attr('aria-label', tool.name)
            .on('click', function () {set(tool.id)});
        buttons[tool.id].append('span').attr('class', 'icon').attr('aria-hidden', true).text(tool.icon);
    });

    function set(id) {
        closeEditor(true);
        active = id;
        TOOLS.forEach(function (tool) {
            buttons[tool.id].classed('active', tool.id === id).attr('aria-pressed', tool.id === id);
            stage.classed('tool-' + tool.id, tool.id === id);
        });
        bind();
        showOptions();
        onChange(TOOLS.find(function (t) {return t.id === id}));
    }

    // Marker kinds, drawn with the current theme's symbols
    function showOptions() {
        optionsBar.attr('hidden', active === 'marker' ? null : true);
        if (active !== 'marker') return;
        var theme = getTheme(doc.state.style.theme);
        if (shownTheme === theme) {
            updateOptions();
            return;
        }
        shownTheme = theme;
        optionsBar.html('');
        optionsBar.append('span').attr('class', 'tool-options-label').text('Marker');
        MARKER_TYPES.forEach(function (type) {
            var b = optionsBar.append('button')
                .datum(type)
                .attr('title', type.name)
                .classed('active', type.id === markerType)
                .on('click', function () {
                    markerType = type.id;
                    showOptions();
                });
            markerPreview(b, theme.symbols.markers[type.id]);
            b.append('span').text(type.name);
        });

        optionsBar.append('span').attr('class', 'tool-options-label tool-options-gap').text('Colour');
        var swatches = optionsBar.append('div').attr('class', 'swatches').attr('role', 'radiogroup')
            .attr('aria-label', 'Marker colour');
        MARKER_COLORS.forEach(function (c) {
            swatches.append('button')
                .datum(c)
                .attr('class', 'swatch')
                .attr('role', 'radio')
                .attr('title', c.name)
                .attr('aria-label', c.name)
                .style('background', c.color)
                .on('click', function () {
                    markerColor = c.color;
                    updateOptions();
                });
        });
        // Any other colour, via the browser's own colour picker
        var custom = swatches.append('label').attr('class', 'swatch custom').attr('title', 'Other colour');
        custom.append('input')
            .attr('type', 'color')
            .attr('aria-label', 'Other colour')
            .on('input', function () {
                markerColor = this.value;
                updateOptions();
            });
        updateOptions();
    }

    // Highlight the chosen kind and colour; previews show the colour too
    function updateOptions() {
        optionsBar.selectAll('button[title]').filter(function (d) {return d && d.id})
            .classed('active', function (t) {return t.id === markerType})
            .select('svg').style('color', markerColor);
        var preset = MARKER_COLORS.some(function (c) {return c.color === markerColor});
        optionsBar.selectAll('.swatch:not(.custom)')
            .classed('active', function (c) {return c.color === markerColor})
            .attr('aria-checked', function (c) {return c.color === markerColor});
        var custom = optionsBar.select('.swatch.custom')
            .classed('active', !preset)
            .style('background', preset ? null : markerColor);
        custom.select('input').property('value', markerColor);
    }

    function mapPoint(node) {
        var p = d3.mouse(node);
        return [p[0] / R.SCALE, p[1] / R.SCALE];
    }

    // Open the text box over an item, or at a point for new text
    function edit(d, node) {
        var target = editable(d);
        if (!target) return false;
        var anchor = node;
        if (d.kind === 'city') {
            // Edit a city's name over its label, if it has a visible one
            var label = svg.selectAll('.city-label').filter(function (l) {return l.id === d.id && l.text});
            if (!label.empty()) anchor = label.node();
        }
        editText(stage.node(), anchor.getBoundingClientRect(), target.text, function (text) {
            if (target.kind === 'note' && !text) doc.dispatch('deleteItem', {id: d.id, what: nameOf(d)});
            else doc.dispatch('editLabel', {id: d.id, kind: target.kind, text: text, what: nameOf(d)});
        }, {hide: anchor === node && d.kind !== 'city' ? node : null, label: 'Edit text'});
        return true;
    }

    svg.on('click', function () {
        var target = d3.event.target;
        var d = d3.select(target).datum();
        if (active === 'marker') {
            doc.dispatch('addMarker', {pos: mapPoint(this), type: markerType, color: markerColor});
        } else if (active === 'note') {
            if (d && d.kind === 'note') {
                edit(d, target);
                return;
            }
            var pos = mapPoint(this);
            editText(stage.node(), {x: d3.event.clientX, y: d3.event.clientY}, '', function (text) {
                if (text) doc.dispatch('addNote', {pos: pos, text: text});
            }, {placeholder: 'Type, then press Enter', label: 'New text'});
        } else if (active === 'delete' && d && d.id != null) {
            // Names of places are hidden; everything else is removed
            if (isLabel(d)) doc.dispatch('editLabel', {id: d.id, kind: d.kind === 'regionLabel' ? 'region' : 'city', text: '', what: nameOf(d)});
            else doc.dispatch('deleteItem', {id: d.id, what: nameOf(d)});
        } else if (active === 'label') {
            edit(d, target);
        }
    });

    // Double-click edits text without switching tools
    svg.on('dblclick', function () {
        if (active !== 'pointer' && active !== 'move') return;
        if (edit(d3.select(d3.event.target).datum(), d3.event.target)) d3.event.preventDefault();
    });

    var dragStart;
    var drag = d3.drag()
        .on('start', function (d) {
            // A city's label moves with it while dragging; a label moves alone
            var nodes = [this];
            if (d.kind === 'city') {
                nodes = nodes.concat(svg.selectAll('.city-label').filter(function (l) {return l.id === d.id}).nodes());
            }
            var moving = d3.selectAll(nodes);
            moving.each(function () {
                this.__dragBase = this.getAttribute('transform') || '';
            });
            dragStart = {x: d3.event.x, y: d3.event.y, moving: moving};
        })
        .on('drag', function () {
            var shift = 'translate(' + (d3.event.x - dragStart.x) + ',' + (d3.event.y - dragStart.y) + ') ';
            dragStart.moving.attr('transform', function () {return shift + this.__dragBase});
        })
        .on('end', function (d) {
            var dx = (d3.event.x - dragStart.x) / R.SCALE;
            var dy = (d3.event.y - dragStart.y) / R.SCALE;
            if (dx === 0 && dy === 0) return;
            var pos = [d.pos[0] + dx, d.pos[1] + dy];
            if (isLabel(d)) doc.dispatch('moveLabel', {id: d.id, kind: d.kind === 'regionLabel' ? 'region' : 'city', pos: pos, what: nameOf(d)});
            else doc.dispatch('moveItem', {id: d.id, pos: pos, what: nameOf(d)});
        });

    // Call after every redraw, so newly drawn items can be dragged too
    function bind() {
        var items = svg.selectAll(DRAGGABLE);
        if (active === 'move') items.call(drag);
        else items.on('.drag', null);
    }

    // Call after every redraw: the marker previews follow the theme
    function refresh() {
        bind();
        showOptions();
    }

    function forKey(key) {
        return TOOLS.find(function (t) {return t.key === key});
    }

    set('pointer');
    return {
        set: set,
        refresh: refresh,
        forKey: forKey,
        get active() {return active}
    };
}
