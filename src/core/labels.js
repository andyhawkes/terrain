// Label placement for city and region names. Pure geometry: takes the names
// as input and returns positions in map units, so it involves no randomness.
import {leastIndex} from 'd3-array';
import {terrCenter} from './terrain.js';

// cityNames[i] / regionNames[i] name cities[i] (vertex indices) and the
// territory of capital cities[i]. avoids is a list of path lists (rivers,
// coasts, borders) that city labels should try not to cover.
// fontsizes are in SVG units; scale is SVG units per map unit
export function placeLabels(h, terr, cities, nterrs, cityNames, regionNames, fontsizes, avoids, scale) {
    scale = scale || 1000;
    nterrs = Math.min(nterrs, cities.length);
    var citylabels = [];
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
        var sx = 0.65 * size/scale * text.length;
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

    var reglabels = [];
    for (var i = 0; i < nterrs; i++) {
        var city = cities[i];
        var text = regionNames[i];
        var sy = fontsizes.region / scale;
        var sx = 0.6 * text.length * sy;
        var lc = terrCenter(h, terr, city, true);
        var oc = terrCenter(h, terr, city, false);
        var best = 0;
        var bestscore = -999999;
        for (var j = 0; j < h.length; j++) {
            var score = 0;
            var v = h.mesh.vxs[j];
            score -= 3000 * Math.sqrt((v[0] - lc[0]) * (v[0] - lc[0]) + (v[1] - lc[1]) * (v[1] - lc[1]));
            score -= 1000 * Math.sqrt((v[0] - oc[0]) * (v[0] - oc[0]) + (v[1] - oc[1]) * (v[1] - oc[1]));
            if (terr[j] != city) score -= 3000;
            for (var k = 0; k < cities.length; k++) {
                var u = h.mesh.vxs[cities[k]];
                if (Math.abs(v[0] - u[0]) < sx &&
                    Math.abs(v[1] - sy/2 - u[1]) < sy) {
                    score -= k < nterrs ? 4000 : 500;
                }
                if (v[0] - sx/2 < citylabels[k].x1 &&
                    v[0] + sx/2 > citylabels[k].x0 &&
                    v[1] - sy < citylabels[k].y1 &&
                    v[1] > citylabels[k].y0) {
                    score -= 5000;
                }
            }
            for (var k = 0; k < reglabels.length; k++) {
                var label = reglabels[k];
                if (v[0] - sx/2 < label.x + label.width/2 &&
                    v[0] + sx/2 > label.x - label.width/2 &&
                    v[1] - sy < label.y &&
                    v[1] > label.y - label.size) {
                    score -= 20000;
                }
            }
            if (h[j] <= 0) score -= 500;
            if (v[0] + sx/2 > 0.5 * h.mesh.extent.width) score -= 50000;
            if (v[0] - sx/2 < -0.5 * h.mesh.extent.width) score -= 50000;
            if (v[1] > 0.5 * h.mesh.extent.height) score -= 50000;
            if (v[1] - sy < -0.5 * h.mesh.extent.height) score -= 50000;
            if (score > bestscore) {
                bestscore = score;
                best = j;
            }
        }
        reglabels.push({
            text: text,
            x: h.mesh.vxs[best][0],
            y: h.mesh.vxs[best][1],
            size: sy,
            width: sx
        });
    }
    return {cities: citylabels, regions: reglabels};
}
