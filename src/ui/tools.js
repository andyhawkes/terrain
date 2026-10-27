// The editing tools in the left-hand strip. One tool is active at a time;
// "pointer" means no editing. Some tools show options above the map; the bar
// is always there, so the map doesn't change size when switching tools.
import * as d3 from 'd3';
import * as R from '../render/svg.js';
import {MARKER_TYPES, SYMBOL_KINDS, ROUTE_STYLES, roadsStale} from '../core/steps.js';
import {smoothLine} from '../core/roads.js';
import {getTheme} from '../themes/index.js';
import {editText, close as closeEditor} from './textEditor.js';

export var TOOLS = [
    {id: 'pointer', icon: 'arrow_selector_tool', name: 'Pointer', key: 'v',
        hint: null},
    {id: 'move', icon: 'open_with', name: 'Move', key: 'g',
        hint: 'Drag places, labels, symbols, your own text, or the points of roads and routes. A city\'s label moves with it; a label moves on its own.'},
    {id: 'label', icon: 'edit', name: 'Edit text', key: 'e',
        hint: 'Click a name or your own text to change it. Clicking a city lets you name it even if its label is hidden.'},
    {id: 'note', icon: 'title', name: 'Add text', key: 't',
        hint: 'Click the map to write something there, like "Here be dragons".'},
    {id: 'symbol', icon: 'sailing', name: 'Add symbol', key: 's',
        hint: 'Click the map to add the symbol chosen above, or click a symbol to swap it.'},
    {id: 'marker', icon: 'location_on', name: 'Add marker', key: 'm',
        hint: 'Click the map to add a marker. Choose its kind and colour above the map.'},
    {id: 'route', icon: 'route', name: 'Draw road or route', key: 'r',
        hint: 'Click along the way, then double-click or press Enter to finish (Backspace undoes a point). ' +
            'Click a route to give it the style chosen above. Move its points with the Move tool.'},
    {id: 'delete', icon: 'delete', name: 'Delete', key: 'd',
        hint: 'Click a place, symbol, marker, text, road or route to remove it. Clicking a city or region name hides the name.'}
];

var DRAGGABLE = '.layer-city .city, .layer-city .capital-symbol, .layer-wreck .wreck, .layer-poi .poi, .layer-marker .placedMarker, ' +
    '.city-label, .region-label, .note-label, .layer-extras .ornament';

var ORNAMENT_NAMES = {scaleBar: 'the scale bar', compass: 'the compass rose', title: 'the title'};

function isLabel(d) {
    return d && (d.kind === 'cityLabel' || d.kind === 'regionLabel');
}

// A short name for what an edit acted on, recorded with the step so the
// History panel can say e.g. "Move Nenonu"
function nameOf(d) {
    var named = d.kind === 'city' ? d.item.name : (d.label && d.label.text);
    if (named && d.kind !== 'note') return named;
    if (d.kind === 'note') return '“' + d.item.text + '”';
    if (d.kind === 'ornament') return ORNAMENT_NAMES[d.id];
    if (d.kind === 'marker') {
        var type = MARKER_TYPES.find(function (t) {return t.id === d.item.type});
        return (type ? type.name.toLowerCase() : 'a') + ' marker';
    }
    if ((d.kind === 'route' || d.kind === 'routeLabel') && d.item.label) return '“' + d.item.label + '”';
    return {city: 'a city', wreck: 'a wreck', poi: 'a point of interest', road: 'a road', route: 'a route'}[d.kind] || '';
}

// What clicking with the Edit text tool edits, if anything
function editable(d) {
    if (!d || d.id == null) return null;
    if (d.kind === 'cityLabel') return {kind: 'city', text: d.label.text};
    if (d.kind === 'regionLabel') return {kind: 'region', text: d.label.text};
    if (d.kind === 'note') return {kind: 'note', text: d.item.text};
    if (d.kind === 'city') return {kind: 'city', text: d.item.name};
    if (d.kind === 'ornament' && d.id === 'title') return {kind: 'title', text: d.text};
    if (d.kind === 'route' || d.kind === 'routeLabel') return {kind: 'route', text: d.item.label || ''};
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

// A preview of one of the theme's wreck or point-of-interest drawings, styled
// as on the map and fitted to the button
function symbolPreview(button, spec, parts, i) {
    var svg = button.append('svg').attr('aria-hidden', true);
    var outer = svg.append('g');
    if (spec.kind === 'text') {
        outer.append('text')
            .attr('text-anchor', 'middle')
            .attr('fill', 'currentColor').attr('stroke', 'none')
            .style('font-size', spec.size + 'px')
            .style('font-family', spec.font || null)
            .text(spec.chars[i]);
    } else {
        var g = outer.append('g').attr('transform', spec.transform || null);
        spec.variants[i].forEach(function (part) {
            var path = g.append('path').attr('d', part.d);
            var style = parts[part.cls] || {};
            Object.keys(style).forEach(function (prop) {path.attr(prop, style[prop])});
        });
    }
    var box = outer.node().getBBox();
    var side = Math.max(box.width, box.height) + 4;
    svg.attr('viewBox', [box.x + box.width / 2 - side / 2, box.y + box.height / 2 - side / 2, side, side].join(' '));
}

function variantCount(spec) {
    return spec.kind === 'text' ? spec.chars.length : spec.variants.length;
}

function isSymbol(d) {
    return d && d.id != null && SYMBOL_KINDS.some(function (k) {return k.id === d.kind});
}

// stage gets a tool-<id> class; onChange is called with the new tool
export function createTools(doc, svg, stage, strip, optionsBar, onChange) {
    var active = 'pointer';
    var markerType = 'x';
    var markerColor = MARKER_COLORS[0].color;
    var symbolKind = 'wreck';
    var symbolVariant = {wreck: 0, poi: 0};
    var lineKind = 'route';
    var routeStyle = 'dotted';
    var drawing = null;   // the road or route being drawn: {points}
    var onMap = true;     // false while the map isn't showing as it is now
    var buttons = {};
    var shown = null;
    // Handles for editing roads and routes, over the map but not part of it
    var overlay = svg.append('g').attr('class', 'edit-overlay');

    TOOLS.forEach(function (tool) {
        buttons[tool.id] = strip.append('button')
            .attr('title', tool.name + ' (' + tool.key.toUpperCase() + ')')
            .attr('aria-label', tool.name)
            .on('click', function () {set(tool.id)});
        buttons[tool.id].append('span').attr('class', 'icon').attr('aria-hidden', true).text(tool.icon);
    });

    function set(id) {
        closeEditor(true);
        drawing = null;
        active = id;
        TOOLS.forEach(function (tool) {
            buttons[tool.id].classed('active', tool.id === id).attr('aria-pressed', tool.id === id);
            stage.classed('tool-' + tool.id, tool.id === id);
        });
        bind();
        showOptions();
        roadsPrompt();
        drawOverlay();
        onChange(TOOLS.find(function (t) {return t.id === id}));
    }

    // Options above the map for the marker and symbol tools, drawn with the
    // current theme's symbols. Rebuilt when the tool or theme changes.
    function showOptions() {
        if (active === 'route') {
            if (shown && shown.key === 'route') return updateRouteOptions();
            shown = {key: 'route'};
            optionsBar.html('');
            routeOptions();
            return;
        }
        if (active !== 'marker' && active !== 'symbol') {
            shown = null;
            var tool = TOOLS.find(function (t) {return t.id === active});
            optionsBar.html('');
            optionsBar.append('span').attr('class', 'tool-options-label').text(tool.name);
            return;
        }
        var theme = getTheme(doc.state.style.theme);
        var key = active + ' ' + symbolKind;
        if (shown && shown.theme === theme && shown.key === key) {
            if (active === 'marker') updateOptions();
            else updateSymbolOptions();
            return;
        }
        shown = {theme: theme, key: key};
        optionsBar.html('');
        if (active === 'marker') markerOptions(theme);
        else symbolOptions(theme);
    }

    // Wreck or point of interest, then which drawing
    function symbolOptions(theme) {
        optionsBar.append('span').attr('class', 'tool-options-label').text('Symbol');
        SYMBOL_KINDS.forEach(function (kind) {
            optionsBar.append('button')
                .datum(kind)
                .attr('class', 'symbol-kind')
                .on('click', function () {
                    symbolKind = kind.id;
                    showOptions();
                })
                .append('span').text(kind.name);
        });
        var spec = theme.symbols[symbolKind];
        var count = variantCount(spec);
        optionsBar.append('span').attr('class', 'tool-options-label tool-options-gap').text('Style');
        var name = SYMBOL_KINDS.find(function (k) {return k.id === symbolKind}).name;
        for (var i = 0; i < count; i++) {
            var b = optionsBar.append('button')
                .datum(i)
                .attr('class', 'symbol-variant')
                .attr('title', name + ' ' + (i + 1))
                .attr('aria-label', name + ' ' + (i + 1))
                .on('click', function (event, n) {
                    symbolVariant[symbolKind] = n;
                    updateSymbolOptions();
                });
            symbolPreview(b, spec, theme.parts, i);
        }
        updateSymbolOptions();
    }

    function updateSymbolOptions() {
        var count = variantCount(getTheme(doc.state.style.theme).symbols[symbolKind]);
        var chosen = symbolVariant[symbolKind] % count;
        optionsBar.selectAll('.symbol-kind')
            .classed('active', function (k) {return k.id === symbolKind})
            .attr('aria-pressed', function (k) {return k.id === symbolKind});
        optionsBar.selectAll('.symbol-variant')
            .classed('active', function (n) {return n === chosen})
            .attr('aria-pressed', function (n) {return n === chosen});
    }

    // Road or route, then the route's style
    function routeOptions() {
        optionsBar.append('span').attr('class', 'tool-options-label').text('Draw');
        [{id: 'road', name: 'Road'}, {id: 'route', name: 'Route'}].forEach(function (kind) {
            optionsBar.append('button')
                .datum(kind)
                .attr('class', 'line-kind')
                .on('click', function () {
                    lineKind = kind.id;
                    updateRouteOptions();
                    drawOverlay();
                })
                .append('span').text(kind.name);
        });
        optionsBar.append('span').attr('class', 'tool-options-label tool-options-gap route-style-label').text('Style');
        ROUTE_STYLES.forEach(function (style) {
            optionsBar.append('button')
                .datum(style)
                .attr('class', 'route-style')
                .on('click', function () {
                    routeStyle = style.id;
                    updateRouteOptions();
                })
                .append('span').text(style.name);
        });
        updateRouteOptions();
    }

    function updateRouteOptions() {
        optionsBar.selectAll('.line-kind')
            .classed('active', function (k) {return k.id === lineKind})
            .attr('aria-pressed', function (k) {return k.id === lineKind});
        // Roads have the theme's one style
        optionsBar.selectAll('.route-style, .route-style-label').style('display', lineKind === 'route' ? null : 'none');
        optionsBar.selectAll('.route-style')
            .classed('active', function (s) {return s.id === routeStyle})
            .attr('aria-pressed', function (s) {return s.id === routeStyle});
    }

    // Marker kinds and colours
    function markerOptions(theme) {
        optionsBar.append('span').attr('class', 'tool-options-label').text('Marker');
        MARKER_TYPES.forEach(function (type) {
            var b = optionsBar.append('button')
                .datum(type)
                .attr('class', 'marker-type')
                .attr('title', type.name)
                .attr('aria-label', type.name)
                .classed('active', type.id === markerType)
                .on('click', function () {
                    markerType = type.id;
                    updateOptions();
                });
            markerPreview(b, theme.symbols.markers[type.id]);
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
        optionsBar.selectAll('.marker-type')
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

    function mapPoint(event, node) {
        var p = d3.pointer(event, node);
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
            if (target.kind === 'title') doc.dispatch('setStyle', {title: text.trim()});
            else if (target.kind === 'route') doc.dispatch('setRoute', {id: d.id, label: text, what: nameOf(d)});
            else if (target.kind === 'note' && !text) doc.dispatch('deleteItem', {id: d.id, what: nameOf(d)});
            else doc.dispatch('editLabel', {id: d.id, kind: target.kind, text: text, what: nameOf(d)});
        }, {hide: anchor === node && d.kind !== 'city' ? node : null, label: 'Edit text'});
        return true;
    }

    svg.on('click', function (event) {
        var target = event.target;
        var d = d3.select(target).datum();
        if (active === 'route') {
            if (!drawing && lineKind === 'route' && d && (d.kind === 'route' || d.kind === 'routeLabel') && d.id != null) {
                if (d.item.style !== routeStyle) {
                    doc.dispatch('setRoute', {id: d.id, style: routeStyle, what: nameOf(d)});
                }
                return;
            }
            // Clicking a place joins the line to it exactly
            var at = d && d.kind === 'city' ? d.pos.slice() : mapPoint(event, this);
            drawing = drawing || {points: []};
            drawing.points.push(at);
            drawOverlay();
        } else if (active === 'symbol') {
            var variant = symbolVariant[symbolKind] % variantCount(getTheme(doc.state.style.theme).symbols[symbolKind]);
            if (isSymbol(d)) doc.dispatch('setSymbol', {id: d.id, kind: symbolKind, variant: variant, what: nameOf(d)});
            else doc.dispatch('addSymbol', {pos: mapPoint(event, this), kind: symbolKind, variant: variant});
        } else if (active === 'marker') {
            doc.dispatch('addMarker', {pos: mapPoint(event, this), type: markerType, color: markerColor});
        } else if (active === 'note') {
            if (d && d.kind === 'note') {
                edit(d, target);
                return;
            }
            var pos = mapPoint(event, this);
            editText(stage.node(), {x: event.clientX, y: event.clientY}, '', function (text) {
                if (text) doc.dispatch('addNote', {pos: pos, text: text});
            }, {placeholder: 'Type, then press Enter', label: 'New text'});
        } else if (active === 'delete' && d && d.kind === 'ornament') {
            var off = {what: nameOf(d)};
            off[d.id] = d.id === 'title' ? '' : false;
            doc.dispatch('setStyle', off);
        } else if (active === 'delete' && d && d.id != null) {
            // Names of places are hidden; everything else is removed
            if (d.kind === 'routeLabel') doc.dispatch('setRoute', {id: d.id, label: '', what: nameOf(d)});
            else if (isLabel(d)) doc.dispatch('editLabel', {id: d.id, kind: d.kind === 'regionLabel' ? 'region' : 'city', text: '', what: nameOf(d)});
            else doc.dispatch('deleteItem', {id: d.id, what: nameOf(d)});
        } else if (active === 'label') {
            edit(d, target);
        }
    });

    // Double-click edits text without switching tools
    svg.on('dblclick', function (event) {
        if (active === 'route') {
            event.preventDefault();
            finishLine();
            return;
        }
        if (active !== 'pointer' && active !== 'move') return;
        if (edit(d3.select(event.target).datum(), event.target)) event.preventDefault();
    });

    var dragStart;
    var drag = d3.drag()
        .on('start', function (event, d) {
            // A city's label moves with it while dragging; a label moves alone
            var nodes = [this];
            if (d.kind === 'city') {
                nodes = nodes.concat(svg.selectAll('.city-label').filter(function (l) {return l.id === d.id}).nodes());
            }
            var moving = d3.selectAll(nodes);
            moving.each(function () {
                this.__dragBase = this.getAttribute('transform') || '';
            });
            dragStart = {x: event.x, y: event.y, moving: moving};
        })
        .on('drag', function (event) {
            var shift = 'translate(' + (event.x - dragStart.x) + ',' + (event.y - dragStart.y) + ') ';
            dragStart.moving.attr('transform', function () {return shift + this.__dragBase});
        })
        .on('end', function (event, d) {
            var dx = (event.x - dragStart.x) / R.SCALE;
            var dy = (event.y - dragStart.y) / R.SCALE;
            if (dx === 0 && dy === 0) return;
            var pos = [d.pos[0] + dx, d.pos[1] + dy];
            if (d.kind === 'ornament') {
                var positions = Object.assign({}, doc.state.style.positions);
                positions[d.id] = pos;
                doc.dispatch('setStyle', {positions: positions, what: nameOf(d)});
            } else if (d.kind === 'routeLabel') {
                var offset = d.item.labelOffset || [0, 0];
                doc.dispatch('moveLabel', {id: d.id, kind: 'route', offset: [offset[0] + dx, offset[1] + dy], what: nameOf(d)});
            } else if (isLabel(d)) doc.dispatch('moveLabel', {id: d.id, kind: d.kind === 'regionLabel' ? 'region' : 'city', pos: pos, what: nameOf(d)});
            else doc.dispatch('moveItem', {id: d.id, pos: pos, what: nameOf(d)});
        });

    // Call after every redraw, so newly drawn items can be dragged too
    function bind() {
        var items = svg.selectAll(DRAGGABLE);
        if (active === 'move') items.call(drag);
        else items.on('.drag', null);
    }

    // --- Roads and routes ---

    // SVG units per screen pixel, so handles are the same size on any map
    function pixel() {
        var width = svg.node().getBoundingClientRect().width;
        return width ? R.mapBox(doc.state.params)[2] / width : 1;
    }

    function lineData(state) {
        return state.roads.map(function (r) {return {id: r.id, kind: 'road', item: r}})
            .concat(state.routes.map(function (r) {return {id: r.id, kind: 'route', item: r}}));
    }

    function curve(points) {
        return R.makeD3Path(smoothLine(points, 2 / R.SCALE));
    }

    // What the tool needs over the map: wide invisible lines to click roads
    // and routes by, handles on their points for moving, and the line being
    // drawn
    function drawOverlay() {
        overlay.selectAll('*').remove();
        var state = doc.state;
        if (!onMap || !state.h) return;
        var px = pixel();
        var lines = lineData(state);
        // The route tool restyles routes when it's drawing routes
        var restyling = active === 'route' && !drawing && lineKind === 'route';
        if (active === 'delete' || restyling) {
            overlay.selectAll('path.hit-line')
                .data(restyling ? lines.filter(function (d) {return d.kind === 'route'}) : lines)
                .enter().append('path')
                .attr('class', 'hit-line')
                .attr('d', function (d) {return curve(d.item.points)})
                .style('stroke-width', 14 * px + 'px');
        }
        if (active === 'move') {
            // Small, so places and labels along the way can still be
            // dragged, and none over a place, which would hide it. A point
            // under a place shows once the place is moved off it.
            var places = svg.selectAll('.layer-city .city, .layer-wreck .wreck, .layer-poi .poi').data()
                .map(function (d) {return d.pos});
            var clear = 8 * px / R.SCALE;
            var handles = [];
            lines.forEach(function (d) {
                d.item.points.forEach(function (p, i) {
                    var covered = places.some(function (q) {return q && Math.hypot(p[0] - q[0], p[1] - q[1]) < clear});
                    if (!covered) handles.push({id: d.id, kind: d.kind, item: d.item, index: i, pos: p});
                });
            });
            overlay.append('path').attr('class', 'moving-line');
            var side = 6 * px;
            overlay.selectAll('rect.handle').data(handles).enter().append('rect')
                .attr('class', 'handle')
                .attr('x', function (d) {return R.SCALE * d.pos[0] - side / 2})
                .attr('y', function (d) {return R.SCALE * d.pos[1] - side / 2})
                .attr('width', side).attr('height', side)
                .style('stroke-width', px + 'px')
                .call(pointDrag);
        }
        if (drawing) {
            overlay.append('path').attr('class', 'drawing-line').attr('d', curve(drawing.points))
                .style('stroke-width', 2 * px + 'px');
            overlay.selectAll('circle.drawing-point').data(drawing.points).enter().append('circle')
                .attr('class', 'drawing-point')
                .attr('cx', function (p) {return R.SCALE * p[0]})
                .attr('cy', function (p) {return R.SCALE * p[1]})
                .attr('r', 4 * px)
                .style('stroke-width', 1.5 * px + 'px');
        }
    }

    // Dragging a point shows the line's new shape, then moves the point
    var pointDrag = d3.drag()
        .on('drag', function (event, d) {
            var pos = [event.x / R.SCALE, event.y / R.SCALE];
            var side = +this.getAttribute('width');
            d3.select(this).attr('x', event.x - side / 2).attr('y', event.y - side / 2);
            var points = d.item.points.slice();
            points[d.index] = pos;
            overlay.select('.moving-line').attr('d', curve(points)).style('stroke-width', 2 * pixel() + 'px');
        })
        .on('end', function (event, d) {
            var pos = [event.x / R.SCALE, event.y / R.SCALE];
            if (pos[0] === d.pos[0] && pos[1] === d.pos[1]) return;
            doc.dispatch('movePoint', {id: d.id, index: d.index, pos: pos, what: nameOf(d)});
        });

    // Ends the line being drawn, adding it if it has two points or more. A
    // double-click's own clicks add the same point twice, so repeats go.
    function finishLine() {
        if (!drawing) return;
        var near = 3 * pixel() / R.SCALE;
        var points = drawing.points.filter(function (p, i, all) {
            return !i || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > near;
        });
        drawing = null;
        drawOverlay();
        if (points.length < 2) return;
        if (lineKind === 'road') {
            doc.dispatch('addRoad', {points: points});
            return;
        }
        doc.dispatch('addRoute', {points: points, style: routeStyle});
        // Then a label, if wanted, by the end of the route
        var route = doc.state.routes[doc.state.routes.length - 1];
        var end = points[points.length - 1];
        var box = svg.node().getBoundingClientRect();
        var view = R.mapBox(doc.state.params);
        editText(stage.node(), {x: box.left + (R.SCALE * end[0] - view[0]) / view[2] * box.width,
            y: box.top + (R.SCALE * end[1] - view[1]) / view[3] * box.height + 24}, '', function (text) {
            if (text) doc.dispatch('setRoute', {id: route.id, label: text, what: 'a route'});
        }, {placeholder: 'Label (optional), then Enter', label: 'Route label'});
    }

    // Keys for the line being drawn; true if the key was used
    function key(event) {
        if (active !== 'route' || !drawing) return false;
        if (event.key === 'Enter') finishLine();
        else if (event.key === 'Escape') {
            drawing = null;
            drawOverlay();
        } else if (event.key === 'Backspace' || event.key === 'Delete') {
            drawing.points.pop();
            if (!drawing.points.length) drawing = null;
            drawOverlay();
        } else return false;
        return true;
    }

    // Call after every redraw: the marker previews follow the theme. onMap
    // says whether the map is showing as it is now (not another view, or a
    // replay), which is when roads and routes can be edited.
    function refresh(showingMap) {
        onMap = showingMap !== false;
        bind();
        showOptions();
        roadsPrompt();
        drawOverlay();
    }

    // Built roads stay put when towns move or the land changes; this offers
    // to build them again, at the end of the options bar
    function roadsPrompt() {
        optionsBar.select('.roads-prompt').remove();
        if (!onMap || !doc.state.h || !roadsStale(doc.state)) return;
        var prompt = optionsBar.append('span').attr('class', 'roads-prompt');
        prompt.append('span').attr('class', 'tool-options-label').text('The map has changed since the roads were built');
        prompt.append('button')
            .attr('title', 'Build the roads between towns again. Roads you have drawn or reshaped stay as they are.')
            .on('click', function () {doc.dispatch('joinTowns')})
            .append('span').text('Redraw roads');
    }

    function forKey(key) {
        return TOOLS.find(function (t) {return t.key === key});
    }

    set('pointer');
    return {
        set: set,
        refresh: refresh,
        key: key,
        forKey: forKey,
        get active() {return active}
    };
}
