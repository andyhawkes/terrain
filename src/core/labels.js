// Label placement for city and region names. Pure geometry: takes the names
// as input and returns positions in map units, so it involves no randomness.
import {leastIndex} from 'd3-array';
import {terrCenter} from './terrain.js';

// cityNames[i] / regionNames[i] name cities[i] (vertex indices) and the
// territory of capital cities[i]. avoids is a list of path lists (rivers,
// coasts, borders) that city labels should try not to cover.
// fontsizes are in SVG units; scale is SVG units per map unit.
// layout (optional) describes how the labels will be drawn:
//   measure(kind, text, size): a label's width in SVG units, where kind is
//     'capital', 'town' or 'region' and size its font size; without it,
//     widths are estimated from the number of letters
//   obstacles: boxes ([x0, y0, x1, y1], map units) labels should stay off,
//     such as the title box or compass rose
var REGION_SIZES = [1, 0.85, 0.72];

function estimate(kind, text, size) {
    return (kind === 'region' ? 0.6 : 0.65) * size * text.length;
}

export function placeLabels(h, terr, cities, nterrs, cityNames, regionNames, fontsizes, avoids, scale, layout) {
    scale = scale || 1000;
    layout = layout || {};
    var measure = layout.measure || estimate;
    var obstacles = layout.obstacles || [];
    nterrs = Math.min(nterrs, cities.length);
    var citylabels = [];
    function hits(x0, y0, x1, y1, box) {
        return x0 < box[2] && x1 > box[0] && y0 < box[3] && y1 > box[1];
    }
    function penalty(label) {
        var pen = 0;
        if (label.x0 < -0.45 * h.mesh.extent.width) pen += 100;
        if (label.x1 > 0.45 * h.mesh.extent.width) pen += 100;
        if (label.y0 < -0.45 * h.mesh.extent.height) pen += 100;
        if (label.y1 > 0.45 * h.mesh.extent.height) pen += 100;
        // Past the edge itself, the label would be cut off
        if (label.x0 < -0.5 * h.mesh.extent.width || label.x1 > 0.5 * h.mesh.extent.width ||
            label.y0 < -0.5 * h.mesh.extent.height || label.y1 > 0.5 * h.mesh.extent.height) pen += 10000;
        for (var i = 0; i < citylabels.length; i++) {
            var olabel = citylabels[i];
            if (label.x0 < olabel.x1 && label.x1 > olabel.x0 &&
                label.y0 < olabel.y1 && label.y1 > olabel.y0) {
                pen += 100;
            }
        }

        for (var i = 0; i < cities.length; i++) {
            var c = h.mesh.vxs[cities[i]];
            if (label.x0 < c[0] && label.x1 > c[0] && label.y0 < c[1] && label.y1 > c[1]) {
                pen += 100;
            }
        }
        for (var i = 0; i < obstacles.length; i++) {
            if (hits(label.x0, label.y0, label.x1, label.y1, obstacles[i])) pen += 100;
        }
        for (var i = 0; i < avoids.length; i++) {
            var avoid = avoids[i];
            for (var j = 0; j < avoid.length; j++) {
                var avpath = avoid[j];
                for (var k = 0; k < avpath.length; k++) {
                    var pt = avpath[k];
                    if (pt[0] > label.x0 && pt[0] < label.x1 && pt[1] > label.y0 && pt[1] < label.y1) {
                        pen++;
                    }
                }
            }
        }
        return pen;
    }
    for (var i = 0; i < cities.length; i++) {
        var x = h.mesh.vxs[cities[i]][0];
        var y = h.mesh.vxs[cities[i]][1];
        var text = cityNames[i];
        var size = i < nterrs ? fontsizes.city : fontsizes.town;
        var sx = measure(i < nterrs ? 'capital' : 'town', text, size) / scale;
        var sy = size/scale;
        var posslabels = [
        {
            x: x + 0.8 * sy,
            y: y + 0.3 * sy,
            align: 'start',
            x0: x + 0.7 * sy,
            y0: y - 0.6 * sy,
            x1: x + 0.7 * sy + sx,
            y1: y + 0.6 * sy
        },
        {
            x: x - 0.8 * sy,
            y: y + 0.3 * sy,
            align: 'end',
            x0: x - 0.9 * sy - sx,
            y0: y - 0.7 * sy,
            x1: x - 0.9 * sy,
            y1: y + 0.7 * sy
        },
        {
            x: x,
            y: y - 0.8 * sy,
            align: 'middle',
            x0: x - sx/2,
            y0: y - 1.9*sy,
            x1: x + sx/2,
            y1: y - 0.7 * sy
        },
        {
            x: x,
            y: y + 1.2 * sy,
            align: 'middle',
            x0: x - sx/2,
            y0: y + 0.1*sy,
            x1: x + sx/2,
            y1: y + 1.3*sy
        }
        ];
        var label = posslabels[leastIndex(posslabels, function (a, b) {return penalty(a) - penalty(b)})];
        label.text = text;
        label.size = size;
        citylabels.push(label);
    }

    // Region names go near the middle of their land, clear of towns, their
    // labels, other region names, obstacles and the map's edge. A name that
    // can't find a clear spot tries a smaller size before settling.
    var reglabels = [];
    for (var i = 0; i < nterrs; i++) {
        var city = cities[i];
        var text = regionNames[i];
        var lc = terrCenter(h, terr, city, true);
        var oc = terrCenter(h, terr, city, false);
        var placed = null;
        for (var s = 0; s < REGION_SIZES.length; s++) {
            var size = fontsizes.region * REGION_SIZES[s];
            var sy = size / scale;
            var sx = measure('region', text, size) / scale;
            var spot = bestRegionSpot(sx, sy, lc, oc, city);
            if (!placed || spot.clear || spot.score > placed.score) {
                placed = {score: spot.score, j: spot.j, sx: sx, sy: sy};
            }
            if (spot.clear) break;
        }
        reglabels.push({
            text: text,
            x: h.mesh.vxs[placed.j][0],
            y: h.mesh.vxs[placed.j][1],
            size: placed.sy,
            width: placed.sx
        });
    }

    // The best vertex to centre a region name of width sx, height sy on,
    // and whether that spot is on its own land, clear of everything it
    // should avoid
    function bestRegionSpot(sx, sy, lc, oc, city) {
        var best = 0;
        var bestscore = -Infinity;
        var bestClear = false;
        for (var j = 0; j < h.length; j++) {
            var score = 0;
            var clear = true;
            var v = h.mesh.vxs[j];
            // From the top of the capitals to just below the baseline, with
            // room for letters that hang below it and a little space
            var x0 = v[0] - sx / 2;
            var x1 = v[0] + sx / 2;
            var y0 = v[1] - 1.05 * sy;
            var y1 = v[1] + 0.3 * sy;
            score -= 3000 * Math.sqrt((v[0] - lc[0]) * (v[0] - lc[0]) + (v[1] - lc[1]) * (v[1] - lc[1]));
            score -= 1000 * Math.sqrt((v[0] - oc[0]) * (v[0] - oc[0]) + (v[1] - oc[1]) * (v[1] - oc[1]));
            // Off its own land doesn't count as clear, so a name tries a
            // smaller size before wandering into a neighbour
            if (terr[j] != city) {
                score -= 3000;
                clear = false;
            }
            for (var k = 0; k < cities.length; k++) {
                var u = h.mesh.vxs[cities[k]];
                if (Math.abs(v[0] - u[0]) < sx &&
                    Math.abs(v[1] - sy/2 - u[1]) < sy) {
                    score -= k < nterrs ? 4000 : 500;
                }
                var cl = citylabels[k];
                if (hits(x0, y0, x1, y1, [cl.x0, cl.y0, cl.x1, cl.y1])) {
                    score -= 5000;
                    clear = false;
                }
            }
            for (var k = 0; k < reglabels.length; k++) {
                var label = reglabels[k];
                // With a clear gap between names, wider side to side, so two
                // never read as one
                var gap = 2 * Math.max(sy, label.size);
                var lead = 0.5 * Math.max(sy, label.size);
                if (hits(x0, y0, x1, y1, [label.x - label.width/2 - gap, label.y - 1.05 * label.size - lead,
                    label.x + label.width/2 + gap, label.y + 0.3 * label.size + lead])) {
                    score -= 20000;
                    clear = false;
                }
            }
            for (var k = 0; k < obstacles.length; k++) {
                if (hits(x0, y0, x1, y1, obstacles[k])) {
                    score -= 20000;
                    clear = false;
                }
            }
            if (h[j] <= 0) score -= 500;
            var off = x1 > 0.5 * h.mesh.extent.width || x0 < -0.5 * h.mesh.extent.width ||
                y1 > 0.5 * h.mesh.extent.height || y0 < -0.5 * h.mesh.extent.height;
            if (x1 > 0.5 * h.mesh.extent.width) score -= 50000;
            if (x0 < -0.5 * h.mesh.extent.width) score -= 50000;
            if (y1 > 0.5 * h.mesh.extent.height) score -= 50000;
            if (y0 < -0.5 * h.mesh.extent.height) score -= 50000;
            if (off) clear = false;
            if (score > bestscore) {
                bestscore = score;
                best = j;
                bestClear = clear;
            }
        }
        return {j: best, score: bestscore, clear: bestClear};
    }

    return {cities: citylabels, regions: reglabels};
}
