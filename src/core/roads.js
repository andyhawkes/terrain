// Roads between cities, and the line geometry shared by roads and routes.
// No randomness: the same heightmap and cities always give the same roads.
import PriorityQueue from 'js-priority-queue';
import {getFlux, neighbours, distance, isnearedge} from './terrain.js';

// Roads joining cities (vertex indices) along the easiest ground, using the
// cost-of-travel idea of getTerritories. Cities join the network one at a
// time, the cheapest to reach first, each by the easiest way to any road
// already built, so roads merge rather than run side by side. Climbs cost
// more the steeper they are; following a river or crossing one costs extra;
// the sea and the map's margin can't be crossed. A city on another island starts a network of
// its own. Returns paths of vertex indices, each from a city to where it
// meets the network.
export function getRoads(h, cities) {
    var mesh = h.mesh;
    var n = h.length;
    var flux = getFlux(h);
    // The same threshold rivers are drawn at (see getRivers)
    var land = 0;
    for (var i = 0; i < n; i++) {
        if (h[i] > 0) land++;
    }
    var river = 0.01 * land / n;
    function cost(u, v) {
        if (h[v] <= 0 || isnearedge(mesh, v)) return Infinity;
        var horiz = Math.max(distance(mesh, u, v), 1e-9);
        var grade = (h[v] - h[u]) / horiz;
        var c = horiz * (1 + 20 * grade * grade + 2 * h[v]);
        if (flux[v] > river) c += 2 * horiz + (flux[u] > river ? 0 : 0.02);
        return c;
    }

    var dist = new Float64Array(n).fill(Infinity);
    var prev = new Int32Array(n).fill(-1);
    var queue = new PriorityQueue({comparator: function (a, b) {return a.d - b.d || a.vx - b.vx}});
    function source(vx) {
        dist[vx] = 0;
        prev[vx] = -1;
        queue.queue({d: 0, vx: vx});
    }
    // Dijkstra's algorithm, picking up from where it left off: new roads
    // only make places nearer, so earlier distances are corrected as it goes
    function spread() {
        while (queue.length) {
            var u = queue.dequeue();
            if (u.d > dist[u.vx]) continue;
            var nbs = neighbours(mesh, u.vx);
            for (var j = 0; j < nbs.length; j++) {
                var v = nbs[j];
                var d = u.d + cost(u.vx, v);
                if (d < dist[v]) {
                    dist[v] = d;
                    prev[v] = u.vx;
                    queue.queue({d: d, vx: v});
                }
            }
        }
    }

    var joined = cities.map(function () {return false});
    var roads = [];
    for (var k = 0; k < cities.length; k++) {
        var best = -1;
        for (var c = 0; c < cities.length; c++) {
            if (!joined[c] && (best < 0 || dist[cities[c]] < dist[cities[best]])) best = c;
        }
        joined[best] = true;
        var vx = cities[best];
        if (dist[vx] === Infinity) {
            // Out of reach of every road so far
            source(vx);
        } else {
            var path = [vx];
            while (dist[path[path.length - 1]] > 0) path.push(prev[path[path.length - 1]]);
            if (path.length > 1) roads.push(path);
            path.forEach(source);
        }
        spread();
    }
    return roads;
}

// Roads as lines in map units, ready to keep and edit: smoothed off the
// grid, then thinned to the points that matter. Each road ends exactly on
// the road it joins. start, if given, gives where each road's city now is.
export function roadLines(h, roads, start) {
    var lines = [];
    roads.forEach(function (road, i) {
        var pts = road.map(function (vx) {return h.mesh.vxs[vx]});
        pts = simplify(relax(relax(pts)), 0.003);
        if (start && start[i]) pts[0] = start[i].slice();
        var end = pts[pts.length - 1];
        var snapped = nearestOn(lines, end);
        if (snapped) pts[pts.length - 1] = snapped;
        lines.push(pts.map(function (p) {return [round(p[0]), round(p[1])]}));
    });
    return lines;
}

// Points are kept to a tenth of an SVG unit, so saved maps stay small
function round(x) {
    return Math.round(x * 10000) / 10000;
}

function relax(path) {
    var out = [path[0]];
    for (var i = 1; i < path.length - 1; i++) {
        out.push([0.25 * path[i - 1][0] + 0.5 * path[i][0] + 0.25 * path[i + 1][0],
            0.25 * path[i - 1][1] + 0.5 * path[i][1] + 0.25 * path[i + 1][1]]);
    }
    if (path.length > 1) out.push(path[path.length - 1]);
    return out;
}

// Douglas-Peucker: drop points within tolerance of the line through the rest
export function simplify(path, tolerance) {
    if (path.length < 3) return path.slice();
    var keep = new Uint8Array(path.length);
    keep[0] = keep[path.length - 1] = 1;
    var stack = [[0, path.length - 1]];
    while (stack.length) {
        var span = stack.pop();
        var far = -1;
        var farDist = tolerance;
        for (var i = span[0] + 1; i < span[1]; i++) {
            var d = segmentDistance(path[i], path[span[0]], path[span[1]]).d;
            if (d > farDist) {
                far = i;
                farDist = d;
            }
        }
        if (far >= 0) {
            keep[far] = 1;
            stack.push([span[0], far], [far, span[1]]);
        }
    }
    return path.filter(function (p, i) {return keep[i]});
}

function segmentDistance(p, a, b) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len = dx * dx + dy * dy;
    var t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
    var q = [a[0] + t * dx, a[1] + t * dy];
    return {d: Math.hypot(p[0] - q[0], p[1] - q[1]), at: q};
}

// The nearest point to p on any of the lines, or null if there are none
function nearestOn(lines, p) {
    var best = null;
    lines.forEach(function (line) {
        for (var i = 1; i < line.length; i++) {
            var s = segmentDistance(p, line[i - 1], line[i]);
            if (!best || s.d < best.d) best = s;
        }
    });
    return best && best.at;
}

// A smooth curve through a line's points (centripetal Catmull-Rom), as a
// polyline with points about step apart. Roads and routes are kept as a
// few points and drawn this way, so they can be edited by those points.
export function smoothLine(points, step) {
    if (points.length < 3) return points.slice();
    var out = [points[0]];
    for (var i = 0; i < points.length - 1; i++) {
        var p0 = points[Math.max(0, i - 1)];
        var p1 = points[i];
        var p2 = points[i + 1];
        var p3 = points[Math.min(points.length - 1, i + 2)];
        var n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
        for (var j = 1; j <= n; j++) out.push(catmullRom(p0, p1, p2, p3, j / n));
    }
    return out;
}

function catmullRom(p0, p1, p2, p3, t) {
    // Knot spacing from the square root of each segment's length
    function knot(a, b) {
        return Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])), 1e-6);
    }
    var t1 = knot(p0, p1);
    var t2 = t1 + knot(p1, p2);
    var t3 = t2 + knot(p2, p3);
    var u = t1 + t * (t2 - t1);
    function lerp(a, b, ta, tb) {
        var w = (u - ta) / (tb - ta);
        return [a[0] + w * (b[0] - a[0]), a[1] + w * (b[1] - a[1])];
    }
    var a1 = lerp(p0, p1, 0, t1);
    var a2 = lerp(p1, p2, t1, t2);
    var a3 = lerp(p2, p3, t2, t3);
    var b1 = lerp(a1, a2, 0, t2);
    var b2 = lerp(a2, a3, t1, t3);
    return lerp(b1, b2, t1, t2);
}
