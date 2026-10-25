// The editing tools in the left-hand strip. One tool is active at a time;
// "pointer" means no editing.
import * as d3 from 'd3';
import * as R from '../render/svg.js';

export var TOOLS = [
    {id: 'pointer', icon: 'arrow_selector_tool', name: 'Pointer', key: 'v',
        hint: null},
    {id: 'move', icon: 'open_with', name: 'Move', key: 'g',
        hint: 'Drag cities, labels, wrecks, points of interest or markers. A city\'s label moves with it; a label moves on its own.'},
    {id: 'label', icon: 'text_fields', name: 'Edit labels', key: 't',
        hint: 'Click a city or region name to change it.'},
    {id: 'marker', icon: 'close', name: 'Add marker', key: 'm',
        hint: 'Click the map to add an X marker.'},
    {id: 'delete', icon: 'delete', name: 'Delete', key: 'd',
        hint: 'Click a marker or city to remove it, or a label to hide it.'}
];

var DRAGGABLE = '.layer-city .city, .layer-wreck .wreck, .layer-poi .poi, .layer-marker .placedMarker, .city-label, .region-label';

function labelKind(d) {
    return d.kind === 'regionLabel' ? 'region' : 'city';
}

function isLabel(d) {
    return d && (d.kind === 'cityLabel' || d.kind === 'regionLabel');
}

// stage gets a tool-<id> class; onChange is called with the new tool
export function createTools(doc, svg, stage, strip, onChange) {
    var active = 'pointer';
    var buttons = {};

    TOOLS.forEach(function (tool) {
        buttons[tool.id] = strip.append('button')
            .attr('title', tool.name + ' (' + tool.key.toUpperCase() + ')')
            .attr('aria-label', tool.name)
            .on('click', function () {set(tool.id)});
        buttons[tool.id].append('span').attr('class', 'icon').attr('aria-hidden', true).text(tool.icon);
    });

    function set(id) {
        active = id;
        TOOLS.forEach(function (tool) {
            buttons[tool.id].classed('active', tool.id === id).attr('aria-pressed', tool.id === id);
            stage.classed('tool-' + tool.id, tool.id === id);
        });
        bind();
        onChange(TOOLS.find(function (t) {return t.id === id}));
    }

    svg.on('click', function () {
        var d = d3.select(d3.event.target).datum();
        if (active === 'marker') {
            var p = d3.mouse(this);
            doc.dispatch('addMarker', {pos: [p[0] / R.SCALE, p[1] / R.SCALE]});
        } else if (active === 'delete' && d && d.id != null) {
            if (isLabel(d)) doc.dispatch('editLabel', {id: d.id, kind: labelKind(d), text: ''});
            else doc.dispatch('deleteItem', {id: d.id});
        } else if (active === 'label' && isLabel(d)) {
            var text = prompt('Label text', d.label.text);
            if (text != null && text !== d.label.text) {
                doc.dispatch('editLabel', {id: d.id, kind: labelKind(d), text: text});
            }
        }
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
            if (isLabel(d)) doc.dispatch('moveLabel', {id: d.id, kind: labelKind(d), pos: pos});
            else doc.dispatch('moveItem', {id: d.id, pos: pos});
        });

    // Call after every redraw, so newly drawn items can be dragged too
    function bind() {
        var items = svg.selectAll(DRAGGABLE);
        if (active === 'move') items.call(drag);
        else items.on('.drag', null);
    }

    function forKey(key) {
        return TOOLS.find(function (t) {return t.key === key});
    }

    set('pointer');
    return {
        set: set,
        bind: bind,
        forKey: forKey,
        get active() {return active}
    };
}
