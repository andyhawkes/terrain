// Turns a theme (src/themes/) into what the SVG renderer needs: a stylesheet
// scoped to the map, single-stroke Hershey lettering, and dashed lines split
// into separate strokes for plotters.
import hershey from './fonts/hershey.json' with {type: 'json'};

// The map's stylesheet. It lives inside the SVG, so exports carry it along.
// A background can adjust the label halo to suit it (see fantasy.js).
export function themeCSS(theme, font, background, scope) {
    var c = theme.colors;
    var w = theme.widths;
    var l = theme.labels;
    var h = Object.assign({color: c.halo, opacity: 1, shadow: l.shadow}, background.halo);
    var halo = h.color === 'none' || !w.halo ? 'stroke: none;' :
        'stroke: ' + h.color + '; stroke-opacity: ' + h.opacity + '; stroke-width: ' + w.halo +
        'px; stroke-linejoin: round; paint-order: stroke;';
    var rules = [
        'S { --ink: ' + c.ink + '; --symbol: ' + c.symbol + '; --marker: ' + c.marker + '; }',
        'S path, S line, S circle { fill: none; stroke: ' + c.ink + '; stroke-linecap: round; }',
        'S .coast { stroke: ' + c.coast + '; stroke-width: ' + w.coast + 'px; }',
        'S .river { stroke: ' + c.river + '; stroke-width: ' + w.river + 'px; }',
        'S .border { stroke: ' + c.border + '; stroke-width: ' + w.border + 'px;' +
            (theme.strokeOnly ? '' : ' stroke-dasharray: ' + theme.borderDash.join(' ') + ';') + ' }',
        'S .slope { stroke: ' + c.slope + '; stroke-width: ' + w.slope + 'px; }',
        'S .coast-line { stroke: ' + c.coast + '; fill: none; }',
        'S .sea { stroke: ' + (c.sea || c.coast) + '; stroke-width: ' + (w.sea || 1) + 'px; }',
        'S circle.city { fill: ' + c.cityFill + '; fill-opacity: ' + theme.cities.fillOpacity +
            '; stroke: ' + c.city + '; stroke-width: ' + w.city + 'px; }',
        'S text { ' + halo + (h.shadow ? ' filter: drop-shadow(' + h.shadow + ');' : '') + ' }',
        typeof font.label === 'string' ?
            'S text.city-label { font-family: ' + font.label + '; fill: ' + c.label + '; }' : '',
        typeof font.region === 'string' ?
            'S text.region-label { font-family: ' + font.region + '; fill: ' + c.region +
            '; font-variant: ' + l.regionVariant + '; letter-spacing: ' + l.regionSpacing +
            ';' + (w.halo ? ' stroke-width: ' + l.regionHalo + 'px;' : '') + ' }' : '',
        'S path.city-label, S path.region-label { fill: none; stroke-width: ' + (w.label || 1.5) + 'px; stroke-linejoin: round; }',
        'S path.city-label { stroke: ' + c.label + '; }',
        'S path.region-label { stroke: ' + c.region + '; }',
        'S text.poi { fill: var(--symbol); stroke: none; filter: none; }',
        // A background can set the fill for symbol parts drawn in currentColor
        // (see underhill.js); markers set their own colour
        background.paper ? 'S .relief, S .poi, S .wreck { color: ' + background.paper + '; }' : '',
        // Fonts that hang below the baseline are raised (translate adds to
        // any transform, such as a label being dragged)
        font.rise ? 'S text.city-label, S text.region-label, S text.note-label, S text.grid-label, ' +
            'S text.extras-label, S text.title-text { translate: 0 -' + font.rise + 'em; }' : '',
        // Extras: grid, scale bar, compass rose, title box
        'S .grid { stroke: ' + (c.grid || c.ink) + '; stroke-width: ' + (w.grid || 1) + 'px; stroke-opacity: ' +
            (theme.extras && theme.extras.gridOpacity || 0.45) + '; }',
        'S .grid-label { fill: ' + (c.grid || c.ink) + '; stroke-width: 3px; }',
        'S path.grid-label { fill: none; stroke: ' + (c.grid || c.ink) + '; stroke-width: 1px; }',
        typeof font.label === 'string' ? 'S text.grid-label, S text.extras-label { font-family: ' + font.label + '; }' : '',
        typeof font.region === 'string' ? 'S text.title-text, S text.compass-north { font-family: ' + font.region + '; }' : '',
        'S text.extras-label { fill: ' + c.label + '; }',
        'S text.title-text { fill: ' + c.region + '; stroke: none; }',
        'S path.extras-label, S path.title-text { fill: none; stroke: ' + c.label + '; stroke-width: 1.5px; }',
        'S .extras-line { fill: none; stroke: ' + c.ink + '; stroke-width: 1.5px; }',
        'S .extras-fill { fill: ' + (theme.strokeOnly ? 'none' : c.ink) + '; stroke: ' + c.ink + '; stroke-width: 1.5px; }',
        'S .extras-paper { fill: ' + (theme.strokeOnly ? 'none' : h.color === 'none' ? '#ffffff' : h.color) +
            '; stroke: ' + c.ink + '; stroke-width: 1.5px; }',
        theme.css || ''
    ];
    return rules.join('\n').replace(/\bS\b/g, scope).replace(/\bMAP\b/g, scope);
}

// Region names may be shown in capitals, set by the theme or its font
export function labelText(theme, font, kind, text) {
    var regionCase = font.regionCase || theme.labels.regionCase;
    return kind === 'region' && regionCase === 'upper' ? text.toUpperCase() : text;
}

// --- Hershey single-stroke lettering ---

// Glyph coordinates: x from 0 to 2*o, capitals from y=1 to the baseline at 22
var BASELINE = 22;
var CAP_HEIGHT = 21;
var SPACE = 10;

// Hershey fonts only cover ASCII: drop accents and swap a few characters
function toAscii(text) {
    return text.normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[‘’ʔ]/g, '\'')
        .replace(/[·]/g, '-')
        .replace(/[^\x20-\x7e]/g, '');
}

function glyph(font, ch) {
    return font.chars[ch.charCodeAt(0) - 33];
}

export function hersheyWidth(fontName, text) {
    var font = hershey[fontName];
    var width = 0;
    Array.from(toAscii(text)).forEach(function (ch) {
        var g = ch === ' ' ? null : glyph(font, ch);
        width += g ? 2 * g.o : SPACE;
    });
    return width;
}

// The box a line of Hershey text covers, in the same units as hersheyPath
export function hersheyBox(fontName, text, x, y, size, anchor) {
    var width = hersheyWidth(fontName, text) * 0.7 * size / CAP_HEIGHT;
    var left = x - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
    return {x0: left, x1: left + width, y0: y - 0.8 * size, y1: y + 0.3 * size};
}

// An SVG path drawing text at (x, y) on the baseline, with the given font
// size (capitals are about 0.7 of it) and text-anchor style alignment
export function hersheyPath(fontName, text, x, y, size, anchor) {
    var font = hershey[fontName];
    var scale = 0.7 * size / CAP_HEIGHT;
    var width = hersheyWidth(fontName, text) * scale;
    var left = x - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
    var cursor = 0;
    var parts = [];
    Array.from(toAscii(text)).forEach(function (ch) {
        var g = ch === ' ' ? null : glyph(font, ch);
        if (!g) {
            cursor += SPACE;
            return;
        }
        var dx = cursor;
        parts.push(g.d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, function (m, gx, gy) {
            return (left + (dx + +gx) * scale).toFixed(2) + ',' + (y + (+gy - BASELINE) * scale).toFixed(2);
        }));
        cursor += 2 * g.o;
    });
    return parts.join(' ');
}

// --- Dashes as separate strokes ---

// Split polylines (lists of [x, y]) into dash segments of the given lengths
export function dashPaths(paths, dash, gap) {
    var out = [];
    paths.forEach(function (path) {
        var on = true;
        var left = dash;
        var current = [path[0]];
        for (var i = 1; i < path.length; i++) {
            var a = path[i - 1];
            var b = path[i];
            var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            var t = 0;
            while (len - t > left) {
                t += left;
                var p = [a[0] + (b[0] - a[0]) * t / len, a[1] + (b[1] - a[1]) * t / len];
                if (on) {
                    current.push(p);
                    out.push(current);
                } else {
                    current = [p];
                }
                on = !on;
                left = on ? dash : gap;
            }
            left -= len - t;
            if (on) current.push(b);
        }
        if (on && current.length > 1) out.push(current);
    });
    return out;
}
