// Hand-drawn style mountains and hills for themes' relief symbols (see
// symbols.relief in simple.js), generated so each theme gets a varied set:
// broad massifs and spires, jagged ridgelines, second summits, and a dark
// side with a ragged edge. Light comes from the west, so the east faces
// are in shadow. The drawings are fixed for a theme (their own seed), not
// random per map.
//
// Each drawing sits on y = 0 and is roughly 14-26 units wide. Its parts:
//   mask: the whole shape, filled with paper so nearer ones hide those behind
//   shadow: the dark east face, filled with ink
//   ridge: the outline
//   crease: a few rock folds on the lit side
// The engraved style (options.style: 'engraved') shades the east face with
// a wash part (a see-through fill) and hatch lines instead of shadow.

// A small seeded generator, separate from the map's random numbers
function generator(seed) {
    var a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function between(rand, lo, hi) {
    return lo + rand() * (hi - lo);
}

function point(p) {
    return p[0].toFixed(1) + ',' + p[1].toFixed(1);
}

function line(points) {
    return 'M' + points.map(point).join(' L');
}

// Points from a to b with a jagged wobble across the line, ends kept
function jagged(rand, a, b, steps, wobble) {
    var points = [a];
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    for (var i = 1; i < steps; i++) {
        var t = i / steps + between(rand, -0.3, 0.3) / steps;
        var off = between(rand, -wobble, wobble);
        points.push([a[0] + dx * t - dy / length * off, a[1] + dy * t + dx / length * off]);
    }
    points.push(b);
    return points;
}

function mountain(rand) {
    var height = between(rand, 15, 26);
    // From steep spires to broad massifs
    var width = height * between(rand, 0.9, 1.5);
    var left = [-width / 2, 0];
    var right = [width / 2, 0];
    var peak = [between(rand, -0.12, 0.12) * width, -height];
    // The outline is only a little rough; the shadow's edge is ragged
    var wobble = height * 0.035;

    var west = jagged(rand, left, peak, 4, wobble);
    var east = jagged(rand, peak, right, 4, wobble);
    // Sometimes a lower second summit on one side
    if (rand() < 0.5) {
        var onWest = rand() < 0.5;
        var base = onWest ? left : right;
        var along = between(rand, 0.4, 0.55);
        var shoulder = [peak[0] + (base[0] - peak[0]) * along, -height * between(rand, 0.55, 0.75)];
        var dip = [peak[0] + (base[0] - peak[0]) * along * 0.55, -height * between(rand, 0.5, 0.6)];
        if (onWest) {
            west = jagged(rand, left, shoulder, 2, wobble).concat([dip], jagged(rand, dip, peak, 2, wobble).slice(1));
        } else {
            east = jagged(rand, peak, dip, 2, wobble).concat([shoulder], jagged(rand, shoulder, right, 2, wobble).slice(1));
        }
    }
    var outline = west.concat(east.slice(1));

    // The shadow runs down the east face to a ragged edge part-way across
    var foot = [peak[0] + width * between(rand, 0.02, 0.15), 0];
    var edge = jagged(rand, peak, foot, 6, width * 0.07);
    // Down the east ridge, then back up the ragged edge (Z closes at the peak)
    var shadow = east.concat(edge.slice().reverse().slice(0, -1));

    // Rock folds: short strokes down the lit face, inside the outline
    var creases = [];
    var count = 2 + Math.floor(rand() * 2);
    for (var i = 0; i < count; i++) {
        var t = between(rand, 0.25, 0.7);
        var start = [peak[0] + (left[0] - peak[0]) * t * 0.7, peak[1] * (1 - t)];
        var length = height * between(rand, 0.12, 0.25);
        creases.push(line([start, [start[0] - length * 0.35, start[1] + length]]));
    }

    return [
        {d: line(outline) + ' Z', cls: 'mask'},
        {d: line(shadow) + ' Z', cls: 'shadow', shade: shadow},
        {d: line(outline), cls: 'ridge'},
        {d: creases.join(' '), cls: 'crease'}
    ];
}

// A point on a quadratic curve
function quad(a, c, b, t) {
    var u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

function hill(rand) {
    var width = between(rand, 12, 22);
    var height = width * between(rand, 0.3, 0.45);
    var a = [-width / 2, 0];
    var b = [width / 2, 0];
    var c = [between(rand, -0.1, 0.1) * width, -height * 2];
    var outline = 'M' + point(a) + ' Q' + point(c) + ' ' + point(b);
    // Shade the east part of the hump, following its curve
    var shade = [];
    for (var t = 0.55; t <= 1.0001; t += 0.09) shade.push(quad(a, c, b, t));
    var inner = [];
    for (var t = 1; t >= 0.55; t -= 0.09) {
        var p = quad(a, c, b, t);
        inner.push([p[0] - width * 0.16 * Math.sin(Math.PI * (t - 0.55) / 0.45), p[1] + height * 0.25 * (1 - (t - 0.55) / 0.45)]);
    }
    var strokes = [];
    for (var i = 0; i < 2; i++) {
        var q = quad(a, c, b, between(rand, 0.2, 0.4));
        strokes.push(line([[q[0] + 1.5, q[1] + 1.5], [q[0] + 3, q[1] + height * 0.4]]));
    }
    return [
        {d: outline + ' Z', cls: 'mask'},
        {d: line(shade.concat(inner.slice(1))) + ' Z', cls: 'shadow', shade: shade.concat(inner.slice(1))},
        {d: outline, cls: 'ridge'},
        {d: strokes.join(' '), cls: 'crease'}
    ];
}

// Parallel lines across a polygon, a given distance apart, running in
// direction dir (a unit vector)
function hatch(polygon, dir, spacing) {
    var n = [-dir[1], dir[0]];
    var across = polygon.map(function (p) {return p[0] * n[0] + p[1] * n[1]});
    var lo = Math.min.apply(null, across);
    var hi = Math.max.apply(null, across);
    var lines = [];
    for (var c = lo + spacing / 2; c < hi; c += spacing) {
        var hits = [];
        for (var i = 0; i < polygon.length; i++) {
            var a = polygon[i];
            var b = polygon[(i + 1) % polygon.length];
            var da = a[0] * n[0] + a[1] * n[1] - c;
            var db = b[0] * n[0] + b[1] * n[1] - c;
            if ((da < 0) === (db < 0)) continue;
            var t = da / (da - db);
            var x = a[0] + (b[0] - a[0]) * t;
            var y = a[1] + (b[1] - a[1]) * t;
            hits.push(x * dir[0] + y * dir[1]);
        }
        hits.sort(function (p, q) {return p - q});
        for (var k = 0; k + 1 < hits.length; k += 2) {
            lines.push(line([
                [n[0] * c + dir[0] * hits[k], n[1] * c + dir[1] * hits[k]],
                [n[0] * c + dir[0] * hits[k + 1], n[1] * c + dir[1] * hits[k + 1]]
            ]));
        }
    }
    return lines.join(' ');
}

// Engraving: the dark side becomes a see-through wash crossed by hatching,
// running down the slope
var FALL = (function () {
    var x = 0.35;
    var length = Math.sqrt(x * x + 1);
    return [x / length, 1 / length];
})();

function styled(drawing, options) {
    if (!options || options.style !== 'engraved') {
        return drawing.map(function (part) {return {d: part.d, cls: part.cls}});
    }
    var parts = [];
    drawing.forEach(function (part) {
        if (part.cls !== 'shadow') {
            parts.push({d: part.d, cls: part.cls});
            return;
        }
        parts.push({d: part.d, cls: 'wash'});
        parts.push({d: hatch(part.shade, FALL, options.spacing || 1.6), cls: 'hatch'});
    });
    return parts;
}

// options: {style: 'engraved', spacing} for hatched shading (see above)
export function mountains(count, seed, options) {
    var rand = generator(seed);
    var drawings = [];
    for (var i = 0; i < count; i++) drawings.push(styled(mountain(rand), options));
    return drawings;
}

export function hills(count, seed, options) {
    var rand = generator(seed);
    var drawings = [];
    for (var i = 0; i < count; i++) drawings.push(styled(hill(rand), options));
    return drawings;
}
