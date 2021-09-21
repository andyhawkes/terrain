"use strict";

function runif(lo, hi) {
    return lo + Math.random() * (hi - lo);
}

var rnorm = (function () {
    var z2 = null;
    function rnorm() {
        if (z2 != null) {
            var tmp = z2;
            z2 = null;
            return tmp;
        }
        var x1 = 0;
        var x2 = 0;
        var w = 2.0;
        while (w >= 1) {
            x1 = runif(-1, 1);
            x2 = runif(-1, 1);
            w = x1 * x1 + x2 * x2;
        }
        w = Math.sqrt(-2 * Math.log(w) / w);
        z2 = x2 * w;
        return x1 * w;
    }
    return rnorm;
})();

function randomVector(scale) {
    return [scale * rnorm(), scale * rnorm()];
}

var defaultExtent = {
    width: 1,
    height: 1
};

function generatePoints(n, extent) {
    extent = extent || defaultExtent;
    var pts = [];
    for (var i = 0; i < n; i++) {
        pts.push([(Math.random() - 0.5) * extent.width, (Math.random() - 0.5) * extent.height]);
    }
    return pts;
}

function centroid(pts) {
    var x = 0;
    var y = 0;
    for (var i = 0; i < pts.length; i++) {
        x += pts[i][0];
        y += pts[i][1];
    }
    return [x/pts.length, y/pts.length];
}

function improvePoints(pts, n, extent) {
    n = n || 1;
    extent = extent || defaultExtent;
    for (var i = 0; i < n; i++) {
        pts = voronoi(pts, extent)
            .polygons(pts)
            .map(centroid);
    }
    return pts;
}

function generateGoodPoints(n, extent) {
    extent = extent || defaultExtent;
    var pts = generatePoints(n, extent);
    pts = pts.sort(function (a, b) {
        return a[0] - b[0];
    });
    return improvePoints(pts, 1, extent);
}

function voronoi(pts, extent) {
    extent = extent || defaultExtent;
    var w = extent.width/2;
    var h = extent.height/2;
    return d3.voronoi().extent([[-w, -h], [w, h]])(pts);
}

function makeMesh(pts, extent) {
    extent = extent || defaultExtent;
    var vor = voronoi(pts, extent);
    var vxs = [];
    var vxids = {};
    var adj = [];
    var edges = [];
    var tris = [];
    for (var i = 0; i < vor.edges.length; i++) {
        var e = vor.edges[i];
        if (e == undefined) continue;
        var e0 = vxids[e[0]];
        var e1 = vxids[e[1]];
        if (e0 == undefined) {
            e0 = vxs.length;
            vxids[e[0]] = e0;
            vxs.push(e[0]);
        }
        if (e1 == undefined) {
            e1 = vxs.length;
            vxids[e[1]] = e1;
            vxs.push(e[1]);
        }
        adj[e0] = adj[e0] || [];
        adj[e0].push(e1);
        adj[e1] = adj[e1] || [];
        adj[e1].push(e0);
        edges.push([e0, e1, e.left, e.right]);
        tris[e0] = tris[e0] || [];
        if (!tris[e0].includes(e.left)) tris[e0].push(e.left);
        if (e.right && !tris[e0].includes(e.right)) tris[e0].push(e.right);
        tris[e1] = tris[e1] || [];
        if (!tris[e1].includes(e.left)) tris[e1].push(e.left);
        if (e.right && !tris[e1].includes(e.right)) tris[e1].push(e.right);
    }

    var mesh = {
        pts: pts,
        vor: vor,
        vxs: vxs,
        adj: adj,
        tris: tris,
        edges: edges,
        extent: extent
    }
    mesh.map = function (f) {
        var mapped = vxs.map(f);
        mapped.mesh = mesh;
        return mapped;
    }
    return mesh;
}

function generateGoodMesh(n, extent) {
    extent = extent || defaultExtent;
    var pts = generateGoodPoints(n, extent);
    return makeMesh(pts, extent);
}
function isedge(mesh, i) {
    return (mesh.adj[i].length < 3);
}

function isnearedge(mesh, i) {
    var x = mesh.vxs[i][0];
    var y = mesh.vxs[i][1];
    var w = mesh.extent.width;
    var h = mesh.extent.height;
    return x < -0.45 * w || x > 0.45 * w || y < -0.45 * h || y > 0.45 * h;
}

function neighbours(mesh, i) {
    var onbs = mesh.adj[i];
    var nbs = [];
    for (var i = 0; i < onbs.length; i++) {
        nbs.push(onbs[i]);
    }
    return nbs;
}

function distance(mesh, i, j) {
    var p = mesh.vxs[i];
    var q = mesh.vxs[j];
    return Math.sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]));
}

function quantile(h, q) {
    var sortedh = [];
    for (var i = 0; i < h.length; i++) {
        sortedh[i] = h[i];
    }
    sortedh.sort(d3.ascending);
    return d3.quantile(sortedh, q);
}

function zero(mesh) {
    var z = [];
    for (var i = 0; i < mesh.vxs.length; i++) {
        z[i] = 0;
    }
    z.mesh = mesh;
    return z;
}

function slope(mesh, direction) {
    return mesh.map(function (x) {
        return x[0] * direction[0] + x[1] * direction[1];
    });
}

function cone(mesh, slope) {
    return mesh.map(function (x) {
        return Math.pow(x[0] * x[0] + x[1] * x[1], 0.5) * slope;
    });
}

function map(h, f) {
    var newh = h.map(f);
    newh.mesh = h.mesh;
    return newh;
}

function normalize(h) {
    var lo = d3.min(h);
    var hi = d3.max(h);
    return map(h, function (x) {return (x - lo) / (hi - lo)});
}

function peaky(h) {
    return map(normalize(h), Math.sqrt);
}

function add() {
    var n = arguments[0].length;
    var newvals = zero(arguments[0].mesh);
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < arguments.length; j++) {
            newvals[i] += arguments[j][i];
        }
    }
    return newvals;
}

function mountains(mesh, n, r) {
    r = r || 0.05;
    var mounts = [];
    for (var i = 0; i < n; i++) {
        mounts.push([mesh.extent.width * (Math.random() - 0.5), mesh.extent.height * (Math.random() - 0.5)]);
    }
    var newvals = zero(mesh);
    for (var i = 0; i < mesh.vxs.length; i++) {
        var p = mesh.vxs[i];
        for (var j = 0; j < n; j++) {
            var m = mounts[j];
            newvals[i] += Math.pow(Math.exp(-((p[0] - m[0]) * (p[0] - m[0]) + (p[1] - m[1]) * (p[1] - m[1])) / (2 * r * r)), 2);
        }
    }
    return newvals;
}

function relax(h) {
    var newh = zero(h.mesh);
    for (var i = 0; i < h.length; i++) {
        var nbs = neighbours(h.mesh, i);
        if (nbs.length < 3) {
            newh[i] = 0;
            continue;
        }
        newh[i] = d3.mean(nbs.map(function (j) {return h[j]}));
    }
    return newh;
}

function downhill(h) {
    if (h.downhill) return h.downhill;
    function downfrom(i) {
        if (isedge(h.mesh, i)) return -2;
        var best = -1;
        var besth = h[i];
        var nbs = neighbours(h.mesh, i);
        for (var j = 0; j < nbs.length; j++) {
            if (h[nbs[j]] < besth) {
                besth = h[nbs[j]];
                best = nbs[j];
            }
        }
        return best;
    }
    var downs = [];
    for (var i = 0; i < h.length; i++) {
        downs[i] = downfrom(i);
    }
    h.downhill = downs;
    return downs;
}

function findSinks(h) {
    var dh = downhill(h);
    var sinks = [];
    for (var i = 0; i < dh.length; i++) {
        var node = i;
        while (true) {
            if (isedge(h.mesh, node)) {
                sinks[i] = -2;
                break;
            }
            if (dh[node] == -1) {
                sinks[i] = node;
                break;
            }
            node = dh[node];
        }
    }
}

function fillSinks(h, epsilon) {
    epsilon = epsilon || 1e-5;
    var infinity = 999999;
    var newh = zero(h.mesh);
    for (var i = 0; i < h.length; i++) {
        if (isnearedge(h.mesh, i)) {
            newh[i] = h[i];
        } else {
            newh[i] = infinity;
        }
    }
    while (true) {
        var changed = false;
        for (var i = 0; i < h.length; i++) {
            if (newh[i] == h[i]) continue;
            var nbs = neighbours(h.mesh, i);
            for (var j = 0; j < nbs.length; j++) {
                if (h[i] >= newh[nbs[j]] + epsilon) {
                    newh[i] = h[i];
                    changed = true;
                    break;
                }
                var oh = newh[nbs[j]] + epsilon;
                if ((newh[i] > oh) && (oh > h[i])) {
                    newh[i] = oh;
                    changed = true;
                }
            }
        }
        if (!changed) return newh;
    }
}

function getFlux(h) {
    var dh = downhill(h);
    var idxs = [];
    var flux = zero(h.mesh); 
    for (var i = 0; i < h.length; i++) {
        idxs[i] = i;
        flux[i] = 1/h.length;
    }
    idxs.sort(function (a, b) {
        return h[b] - h[a];
    });
    for (var i = 0; i < h.length; i++) {
        var j = idxs[i];
        if (dh[j] >= 0) {
            flux[dh[j]] += flux[j];
        }
    }
    return flux;
}

function getSlope(h) {
    var dh = downhill(h);
    var slope = zero(h.mesh);
    for (var i = 0; i < h.length; i++) {
        var s = trislope(h, i);
        slope[i] = Math.sqrt(s[0] * s[0] + s[1] * s[1]);
        continue;
        if (dh[i] < 0) {
            slope[i] = 0;
        } else {
            slope[i] = (h[i] - h[dh[i]]) / distance(h.mesh, i, dh[i]);
        }
    }
    return slope;
}

function erosionRate(h) {
    var flux = getFlux(h);
    var slope = getSlope(h);
    var newh = zero(h.mesh);
    for (var i = 0; i < h.length; i++) {
        var river = Math.sqrt(flux[i]) * slope[i];
        var creep = slope[i] * slope[i];
        var total = 1000 * river + creep;
        total = total > 200 ? 200 : total;
        newh[i] = total;
    }
    return newh;
}

function erode(h, amount) {
    var er = erosionRate(h);
    var newh = zero(h.mesh);
    var maxr = d3.max(er);
    for (var i = 0; i < h.length; i++) {
        newh[i] = h[i] - amount * (er[i] / maxr);
    }
    return newh;
}

function doErosion(h, amount, n) {
    n = n || 1;
    h = fillSinks(h);
    for (var i = 0; i < n; i++) {
        h = erode(h, amount);
        h = fillSinks(h);
    }
    return h;
}

function setSeaLevel(h, q) {
    var newh = zero(h.mesh);
    var delta = quantile(h, q);
    for (var i = 0; i < h.length; i++) {
        newh[i] = h[i] - delta;
    }
    return newh;
}

function cleanCoast(h, iters) {
    for (var iter = 0; iter < iters; iter++) {
        var changed = 0;
        var newh = zero(h.mesh);
        for (var i = 0; i < h.length; i++) {
            newh[i] = h[i];
            var nbs = neighbours(h.mesh, i);
            if (h[i] <= 0 || nbs.length != 3) continue;
            var count = 0;
            var best = -999999;
            for (var j = 0; j < nbs.length; j++) {
                if (h[nbs[j]] > 0) {
                    count++;
                } else if (h[nbs[j]] > best) {
                    best = h[nbs[j]];    
                }
            }
            if (count > 1) continue;
            newh[i] = best / 2;
            changed++;
        }
        h = newh;
        newh = zero(h.mesh);
        for (var i = 0; i < h.length; i++) {
            newh[i] = h[i];
            var nbs = neighbours(h.mesh, i);
            if (h[i] > 0 || nbs.length != 3) continue;
            var count = 0;
            var best = 999999;
            for (var j = 0; j < nbs.length; j++) {
                if (h[nbs[j]] <= 0) {
                    count++;
                } else if (h[nbs[j]] < best) {
                    best = h[nbs[j]];
                }
            }
            if (count > 1) continue;
            newh[i] = best / 2;
            changed++;
        }
        h = newh;
    }
    return h;
}

function trislope(h, i) {
    var nbs = neighbours(h.mesh, i);
    if (nbs.length != 3) return [0,0];
    var p0 = h.mesh.vxs[nbs[0]];
    var p1 = h.mesh.vxs[nbs[1]];
    var p2 = h.mesh.vxs[nbs[2]];

    var x1 = p1[0] - p0[0];
    var x2 = p2[0] - p0[0];
    var y1 = p1[1] - p0[1];
    var y2 = p2[1] - p0[1];

    var det = x1 * y2 - x2 * y1;
    var h1 = h[nbs[1]] - h[nbs[0]];
    var h2 = h[nbs[2]] - h[nbs[0]];

    return [(y2 * h1 - y1 * h2) / det,
            (-x2 * h1 + x1 * h2) / det];
}

function cityScore(h, cities) {
    var score = map(getFlux(h), Math.sqrt);
    for (var i = 0; i < h.length; i++) {
        if (h[i] <= 0 || isnearedge(h.mesh, i)) {
            score[i] = -999999;
            continue;
        }
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vxs[i][0]) - h.mesh.extent.width/2)
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vxs[i][1]) - h.mesh.extent.height/2)
        for (var j = 0; j < cities.length; j++) {
            score[i] -= 0.02 / (distance(h.mesh, cities[j], i) + 1e-9);
        }
    }
    return score;
}

function placeCity(render) {
    render.cities = render.cities || [];
    var score = cityScore(render.h, render.cities);
    var newcity = d3.scan(score, d3.descending);
    render.cities.push(newcity);
}

function placeCities(render) {
    var params = render.params;
    var h = render.h;
    var n = params.ncities;
    for (var i = 0; i < n; i++) {
        placeCity(render);
    }
}

function placeMultipleCities(render, count) {
    if (!count) return false;
    var n = count;
    for (var i = 0; i < n; i++) {
        placeCity(render);
    }
}

function wreckScore(h, wrecks) {
    var score = map(getFlux(h), Math.sqrt);
    for (var i = 0; i < h.length; i++) {
        if (h[i] >= 0 || isnearedge(h.mesh, i)) {
            score[i] = -999999;
            continue;
        }
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vxs[i][0]) - h.mesh.extent.width / 2)
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vxs[i][1]) - h.mesh.extent.height / 2)
        for (var j = 0; j < wrecks.length; j++) {
            score[i] -= 0.02 / (distance(h.mesh, wrecks[j], i) + 1e-9);
        }
    }
    return score;
}

function placeWreck(render) {
    render.wrecks = render.wrecks || [];
    var score = wreckScore(render.h, render.wrecks);
    var newwreck = d3.scan(score, d3.descending);
    render.wrecks.push(newwreck);
}

function placeWrecks(render) {
    var params = render.params;
    var h = render.h;
    var n = params.nwrecks;
    for (var i = 0; i < n; i++) {
        placeWreck(render);
    }
}

function POIScore(h, poi) {
    var score = map(getFlux(h), Math.sqrt);
    for (var i = 0; i < h.length; i++) {
        if (h[i] <= 0 || isnearedge(h.mesh, i)) {
            score[i] = -999999;
            continue;
        }
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vxs[i][0]) - h.mesh.extent.width / 2)
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vxs[i][1]) - h.mesh.extent.height / 2)
        for (var j = 0; j < poi.length; j++) {
            score[i] -= 0.02 / (distance(h.mesh, poi[j], i) + 1e-9);
        }
    }
    return score;
}
function placePOI(render) {
    render.poi = render.poi || [];
    var score = POIScore(render.h, render.poi);
    var newPOI = d3.scan(score, d3.descending);
    render.poi.push(newPOI);
}

function placePOIS(render) {
    var params = render.params;
    var h = render.h;
    var n = params.npoi;
    for (var i = 0; i < n; i++) {
        placePOI(render);
    }
}

function contour(h, level) {
    level = level || 0;
    var edges = [];
    for (var i = 0; i < h.mesh.edges.length; i++) {
        var e = h.mesh.edges[i];
        if (e[3] == undefined) continue;
        if (isnearedge(h.mesh, e[0]) || isnearedge(h.mesh, e[1])) continue;
        if ((h[e[0]] > level && h[e[1]] <= level) ||
            (h[e[1]] > level && h[e[0]] <= level)) {
            edges.push([e[2], e[3]]);
        }
    }
    return mergeSegments(edges);
}

function getRivers(h, limit) {
    var dh = downhill(h);
    var flux = getFlux(h);
    var links = [];
    var above = 0;
    for (var i = 0; i < h.length; i++) {
        if (h[i] > 0) above++;
    }
    limit *= above / h.length;
    for (var i = 0; i < dh.length; i++) {
        if (isnearedge(h.mesh, i)) continue;
        if (flux[i] > limit && h[i] > 0 && dh[i] >= 0) {
            var up = h.mesh.vxs[i];
            var down = h.mesh.vxs[dh[i]];
            if (h[dh[i]] > 0) {
                links.push([up, down]);
            } else {
                links.push([up, [(up[0] + down[0])/2, (up[1] + down[1])/2]]);
            }
        }
    }
    return mergeSegments(links).map(relaxPath);
}

function getTerritories(render) {
    var h = render.h;
    var cities = render.cities;
    var n = render.params.nterrs;
    if (n > render.cities.length) n = render.cities.length;
    var flux = getFlux(h);
    var terr = [];
    var queue = new PriorityQueue({comparator: function (a, b) {return a.score - b.score}});
    function weight(u, v) {
        var horiz = distance(h.mesh, u, v);
        var vert = h[v] - h[u];
        if (vert > 0) vert /= 10;
        var diff = 1 + 0.25 * Math.pow(vert/horiz, 2);
        diff += 100 * Math.sqrt(flux[u]);
        if (h[u] <= 0) diff = 100;
        if ((h[u] > 0) != (h[v] > 0)) return 1000;
        return horiz * diff;
    }
    for (var i = 0; i < n; i++) {
        terr[cities[i]] = cities[i];
        var nbs = neighbours(h.mesh, cities[i]);
        for (var j = 0; j < nbs.length; j++) {
            queue.queue({
                score: weight(cities[i], nbs[j]),
                city: cities[i],
                vx: nbs[j]
            });
        }
    }
    while (queue.length) {
        var u = queue.dequeue();
        if (terr[u.vx] != undefined) continue;
        terr[u.vx] = u.city;
        var nbs = neighbours(h.mesh, u.vx);
        for (var i = 0; i < nbs.length; i++) {
            var v = nbs[i];
            if (terr[v] != undefined) continue;
            var newdist = weight(u.vx, v);
            queue.queue({
                score: u.score + newdist,
                city: u.city,
                vx: v
            });
        }
    }
    terr.mesh = h.mesh;
    return terr;
}

function getBorders(render) {
    var terr = render.terr;
    var h = render.h;
    var edges = [];
    for (var i = 0; i < terr.mesh.edges.length; i++) {
        var e = terr.mesh.edges[i];
        if (e[3] == undefined) continue;
        if (isnearedge(terr.mesh, e[0]) || isnearedge(terr.mesh, e[1])) continue;
        if (h[e[0]] < 0 || h[e[1]] < 0) continue;
        if (terr[e[0]] != terr[e[1]]) {
            edges.push([e[2], e[3]]);
        }
    }
    return mergeSegments(edges).map(relaxPath);
}

function mergeSegments(segs) {
    var adj = {};
    for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        var a0 = adj[seg[0]] || [];
        var a1 = adj[seg[1]] || [];
        a0.push(seg[1]);
        a1.push(seg[0]);
        adj[seg[0]] = a0;
        adj[seg[1]] = a1;
    }
    var done = [];
    var paths = [];
    var path = null;
    while (true) {
        if (path == null) {
            for (var i = 0; i < segs.length; i++) {
                if (done[i]) continue;
                done[i] = true;
                path = [segs[i][0], segs[i][1]];
                break;
            }
            if (path == null) break;
        }
        var changed = false;
        for (var i = 0; i < segs.length; i++) {
            if (done[i]) continue;
            if (adj[path[0]].length == 2 && segs[i][0] == path[0]) {
                path.unshift(segs[i][1]);
            } else if (adj[path[0]].length == 2 && segs[i][1] == path[0]) {
                path.unshift(segs[i][0]);
            } else if (adj[path[path.length - 1]].length == 2 && segs[i][0] == path[path.length - 1]) {
                path.push(segs[i][1]);
            } else if (adj[path[path.length - 1]].length == 2 && segs[i][1] == path[path.length - 1]) {
                path.push(segs[i][0]);
            } else {
                continue;
            }
            done[i] = true;
            changed = true;
            break;
        }
        if (!changed) {
            paths.push(path);
            path = null;
        }
    }
    return paths;
}

function relaxPath(path) {
    var newpath = [path[0]];
    for (var i = 1; i < path.length - 1; i++) {
        var newpt = [0.25 * path[i-1][0] + 0.5 * path[i][0] + 0.25 * path[i+1][0],
                     0.25 * path[i-1][1] + 0.5 * path[i][1] + 0.25 * path[i+1][1]];
        newpath.push(newpt);
    }
    newpath.push(path[path.length - 1]);
    return newpath;
}
function visualizePoints(svg, pts) {
    var circle = svg.selectAll('circle').data(pts);
    circle.enter()
        .append('circle');
    circle.exit().remove();
    d3.selectAll('circle')
        .attr('cx', function (d) {return 1000*d[0]})
        .attr('cy', function (d) {return 1000*d[1]})
        .attr('r', 100 / Math.sqrt(pts.length));
}

function makeD3Path(path) {
    var p = d3.path();
    p.moveTo(1000*path[0][0], 1000*path[0][1]);
    for (var i = 1; i < path.length; i++) {
        p.lineTo(1000*path[i][0], 1000*path[i][1]);
    }
    return p.toString();
}

function visualizeVoronoi(svg, field, lo, hi) {
    if (hi == undefined) hi = d3.max(field) + 1e-9;
    if (lo == undefined) lo = d3.min(field) - 1e-9;
    var mappedvals = field.map(function (x) {return x > hi ? 1 : x < lo ? 0 : (x - lo) / (hi - lo)});
    var tris = svg.selectAll('path.field').data(field.mesh.tris)
    tris.enter()
        .append('path')
        .classed('field', true);
    
    tris.exit()
        .remove();

    svg.selectAll('path.field')
        .attr('d', makeD3Path)
        .style('fill', function (d, i) {
            return d3.interpolateViridis(mappedvals[i]);
        });
}

function visualizeDownhill(h) {
    var links = getRivers(h, 0.01);
    drawPaths('river', links);
}

function drawPaths(svg, cls, paths) {
    var paths = svg.selectAll('path.' + cls).data(paths)
    paths.enter()
            .append('path')
            .classed(cls, true)
    paths.exit()
            .remove();
    svg.selectAll('path.' + cls)
        .attr('d', makeD3Path);
}

function visualizeSlopes(svg, render) {
    var h = render.h;
    var strokes = [];
    var r = 0.25 / Math.sqrt(h.length);
    for (var i = 0; i < h.length; i++) {
        if (h[i] <= 0 || isnearedge(h.mesh, i)) continue;
        var nbs = neighbours(h.mesh, i);
        nbs.push(i);
        var s = 0;
        var s2 = 0;
        for (var j = 0; j < nbs.length; j++) {
            var slopes = trislope(h, nbs[j]);
            s += slopes[0] / 10;
            s2 += slopes[1];
        }
        s /= nbs.length;
        s2 /= nbs.length;
        if (Math.abs(s) < runif(0.1, 0.4)) continue;
        var l = r * runif(1, 2) * (1 - 0.2 * Math.pow(Math.atan(s), 2)) * Math.exp(s2/100);
        var x = h.mesh.vxs[i][0];
        var y = h.mesh.vxs[i][1];
        if (Math.abs(l*s) > 2 * r) {
            var n = Math.floor(Math.abs(l*s/r));
            l /= n;
            if (n > 4) n = 4;
            for (var j = 0; j < n; j++) {
                var u = rnorm() * r;
                var v = rnorm() * r;
                strokes.push([[x+u-l, y+v+l*s], [x+u+l, y+v-l*s]]);
            }
        } else {
            strokes.push([[x-l, y+l*s], [x+l, y-l*s]]);
        }
    }
    var lines = svg.selectAll('line.slope').data(strokes)
    lines.enter()
            .append('line')
            .classed('slope', true);
    lines.exit()
            .remove();
    svg.selectAll('line.slope')
        .attr('x1', function (d) {return 1000*d[0][0]})
        .attr('y1', function (d) {return 1000*d[0][1]})
        .attr('x2', function (d) {return 1000*d[1][0]})
        .attr('y2', function (d) {return 1000*d[1][1]})
}

function visualizeContour(h, level) {
    level = level || 0;
    var links = contour(h, level);
    drawPaths('coast', links);
}

function visualizeBorders(h, cities, n) {
    var links = getBorders(h, getTerritories(h, cities, n));
    drawPaths('border', links);
}

function visualizeCities(svg, render) {
    var cities = render.cities;
    var h = render.h;
    var n = render.params.nterrs;

    var circs = svg.selectAll('circle.city').data(cities);
    circs.enter()
            .append('circle')
            .classed('city', true);
    circs.exit()
            .remove();
    svg.selectAll('circle.city')
        .attr('cx', function (d) {return 1000*h.mesh.vxs[d][0]})
        .attr('cy', function (d) {return 1000*h.mesh.vxs[d][1]})
        .attr('r', function (d, i) {return i >= n ? 4 : 10})
        .style('fill', 'white')
        .style('stroke-width', 5)
        .style('stroke-linecap', 'round')
        .style('stroke', 'black')
        .raise();
}

function createSVGsymbols() {
    // variable for the namespace 
    const svgns = "http://www.w3.org/2000/svg";
    let svgDOM = document.getElementById("finalMapSVG");
    // make a new symbol for each wreckSymbol

    wreckSymbols.forEach(function (w,i) {
        console.log(i);
        let newSymbol = document.createElementNS(svgns, "symbol");
        newSymbol.setAttribute("width", "90");
        newSymbol.setAttribute("height", "65");
        newSymbol.setAttribute("id", 'wreck' + i);

        let path = document.createElementNS(svgns, "path");
        path.setAttribute("d", w);
        path.setAttribute('class', 'wreck');
        newSymbol.appendChild(path);

        let path2 = document.createElementNS(svgns, "path");
        path2.setAttribute("d", ripples);
        path2.setAttribute('class', 'ripples');
        newSymbol.appendChild(path2);

        // append the new symbol to the svg
        svgDOM.appendChild(newSymbol);
    });

}

function visualizeWrecks(svg, render) {
    var wrecks = render.wrecks;
    var h = render.h;

    // var circs = svg.selectAll('circle.wreck').data(wrecks);
    // circs.enter()
    //     .append('circle')
    //     .classed('wreck', true);
    // circs.exit()
    //     .remove();
    // svg.selectAll('circle.wreck')
    //     .attr('cx', function (d) { return 1000 * h.mesh.vxs[d][0] })
    //     .attr('cy', function (d) { return 1000 * h.mesh.vxs[d][1] })
    //     .attr('r', 4)
    //     .style('fill', 'white')
    //     .style('stroke-width', 5)
    //     .style('stroke-linecap', 'round')
    //     .style('stroke', 'red')
    //     .raise();

    var uses = svg.selectAll('use.wreck').data(wrecks);
    uses.enter()
        .append('use')
        .classed('wreck', true);
    uses.exit()
        .remove();
    svg.selectAll('use.wreck')
        .attr('x', function (d) { return (1000 * h.mesh.vxs[d][0] ) - 32.5 })
        .attr('y', function (d) { return (1000 * h.mesh.vxs[d][1] ) - 45 })
        .attr('href', function () { return '#wreck' + Math.floor( Math.random() * wreckSymbols.length)} )
        // .attr('href', function () { return '#wreck1' })
        .raise();
}

function visualizePOI(svg, render) {
    var poi = render.poi;
    var h = render.h;
    var n = render.params.nterrs;

    var circs = svg.selectAll('circle.poi').data(poi);
    circs.enter()
        .append('circle')
        .classed('poi', true);
    circs.exit()
        .remove();
    svg.selectAll('circle.poi')
        .attr('cx', function (d) { return 1000 * h.mesh.vxs[d][0] })
        .attr('cy', function (d) { return 1000 * h.mesh.vxs[d][1] })
        .attr('r', function (d, i) { return i >= n ? 4 : 10 })
        .style('fill', 'white')
        .style('stroke-width', 5)
        .style('stroke-linecap', 'round')
        .style('stroke', 'red')
        .raise();
}

function dropEdge(h, p) {
    p = p || 4
    var newh = zero(h.mesh);
    for (var i = 0; i < h.length; i++) {
        var v = h.mesh.vxs[i];
        var x = 2.4*v[0] / h.mesh.extent.width;
        var y = 2.4*v[1] / h.mesh.extent.height;
        newh[i] = h[i] - Math.exp(10*(Math.pow(Math.pow(x, p) + Math.pow(y, p), 1/p) - 1));
    }
    return newh;
}

function generateCoast(params) {
    var mesh = generateGoodMesh(params.npts, params.extent);
    var h = add(
            slope(mesh, randomVector(4)),
            cone(mesh, runif(-1, -1)),
            mountains(mesh, 50)
            );
    for (var i = 0; i < 10; i++) {
        h = relax(h);
    }
    h = peaky(h);
    h = doErosion(h, runif(0, 0.1), 5);
    h = setSeaLevel(h, runif(0.2, 0.6));
    h = fillSinks(h);
    h = cleanCoast(h, 3);
    return h;
}

function terrCenter(h, terr, city, landOnly) {
    var x = 0;
    var y = 0;
    var n = 0;
    for (var i = 0; i < terr.length; i++) {
        if (terr[i] != city) continue;
        if (landOnly && h[i] <= 0) continue;
        x += terr.mesh.vxs[i][0];
        y += terr.mesh.vxs[i][1];
        n++;
    }
    return [x/n, y/n];
}

function drawLabels(svg, render) {
    var params = render.params;
    var h = render.h;
    var terr = render.terr;
    var cities = render.cities;
    var nterrs = render.params.nterrs;
    var avoids = [render.rivers, render.coasts, render.borders];
    var lang = makeRandomLanguage();
    var citylabels = [];
    function penalty(label) {
        var pen = 0;
        if (label.x0 < -0.45 * h.mesh.extent.width) pen += 100;
        if (label.x1 > 0.45 * h.mesh.extent.width) pen += 100;
        if (label.y0 < -0.45 * h.mesh.extent.height) pen += 100;
        if (label.y1 > 0.45 * h.mesh.extent.height) pen += 100;
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
        var text = makeName(lang, 'city');
        var size = i < nterrs ? params.fontsizes.city : params.fontsizes.town;
        var sx = 0.65 * size/1000 * text.length;
        var sy = size/1000;
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
        var label = posslabels[d3.scan(posslabels, function (a, b) {return penalty(a) - penalty(b)})];
        label.text = text;
        label.size = size;
        citylabels.push(label);
    }
    var texts = svg.selectAll('text.city').data(citylabels);
    texts.enter()
        .append('text')
        .classed('city', true);
    texts.exit()
        .remove();
    svg.selectAll('text.city')
        .attr('x', function (d) {return 1000*d.x})
        .attr('y', function (d) {return 1000*d.y})
        .style('font-size', function (d) {return d.size})
        .style('text-anchor', function (d) {return d.align})
        .text(function (d) {return d.text})
        .raise();

    var reglabels = [];
    for (var i = 0; i < nterrs; i++) {
        var city = cities[i];
        var text = makeName(lang, 'region');
        var sy = params.fontsizes.region / 1000;
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
            size:sy, 
            width:sx
        });
    }
    texts = svg.selectAll('text.region').data(reglabels);
    texts.enter()
        .append('text')
        .classed('region', true);
    texts.exit()
        .remove();
    svg.selectAll('text.region')
        .attr('x', function (d) {return 1000*d.x})
        .attr('y', function (d) {return 1000*d.y})
        .style('font-size', function (d) {return 1000*d.size})
        .style('text-anchor', 'middle')
        .text(function (d) {return d.text})
        .raise();
}

function drawMap(svg, render) {
    render.rivers = getRivers(render.h, 0.01);
    render.coasts = contour(render.h, 0);
    render.terr = getTerritories(render);
    render.borders = getBorders(render);
    drawPaths(svg, 'river', render.rivers);
    drawPaths(svg, 'coast', render.coasts);
    drawPaths(svg, 'border', render.borders);
    visualizeSlopes(svg, render);
    visualizeCities(svg, render);
    visualizeWrecks(svg, render);
    // visualizePOI(svg, render);
    drawLabels(svg, render);
}

function doMap(svg, params) {
    var render = {
        params: params
    };
    var width = svg.attr('width');
    svg.attr('height', width * params.extent.height / params.extent.width);
    svg.attr('viewBox', -1000 * params.extent.width/2 + ' ' + 
                        -1000 * params.extent.height/2 + ' ' + 
                        1000 * params.extent.width + ' ' + 
                        1000 * params.extent.height);
    svg.selectAll().remove();
    render.h = params.generator(params);
    placeCities(render);
    placeWrecks(render);
    // placePOI(render);
    drawMap(svg, render);
}

var defaultParams = {
    extent: defaultExtent,
    generator: generateCoast,
    // npts: 16384,
    npts: 65536,
    ncities: 15,
    nwrecks: 1,
    // npoi: 5,
    nterrs: 5,
    fontsizes: {
        region: 40,
        city: 25,
        town: 20
    }
}

var poiSymbols = ['🛕', '🛖', '⚒', '🛡', '⚔', '🗡', '🏹', '⛏', '🪓', '⚖', '☠', '☤', '⚚', '☥', '♕', '♖', '♘', '♛', '♜', '♞', '⚐', '⚑', '⚓'];

var wreckSymbols = [];
//Tentacles v1
wreckSymbols.push("M35.908 6.01c-2.647.742-4.899 2.948-5.2 5.107l-.14.93.371-1.022c.999-2.694 4.574-4.435 7.64-3.762 2.39.534 4.062 2.694 4.062 5.27 0 1.162-.766 3.344-1.671 4.76l-.836 1.3-1.602.14c-5.875.488-12.074 5.387-14.837 11.748-.975 2.183-.998 2.786-.093 1.417 1.672-2.531 5.317-5.573 8.243-6.873 1.184-.51 3.761-1.23 4.435-1.254.139 0-.093.883-.558 2.02-.766 1.858-.836 2.23-.812 4.25 0 3.435 1.23 6.152 4.341 9.774l1.51 1.765-.674.65c-.627.603-.72.627-1.695.394-.557-.139-2.763-.418-4.875-.627-2.136-.185-4.365-.464-4.946-.58-2.275-.51-3.808-1.463-4.992-3.088-.859-1.207-.859-.86.023.673 1.58 2.763 3.344 3.6 11.68 5.433l2.251.511-.65.836c-1.16 1.463-2.298 3.367-2.949 4.945-.348.813-.65 1.51-.696 1.556-.023.023-.627-.209-1.323-.534-3.367-1.532-8.034-.743-12.05 1.997-.93.65-1.974 1.323-2.322 1.509-.813.418-3.251.418-4.226 0-1.602-.65-3.761-3.97-4.319-6.617-.487-2.345.14-4.156 1.835-5.317 2.112-1.44 5.479.58 5.758 3.436.116 1.37-.302 2.183-1.417 2.693l-.743.349.697-.14c2.182-.44 3.065-2.321 2.322-4.875-.511-1.788-2.461-3.831-4.133-4.273-3.135-.882-6.548 1.022-7.871 4.365-.766 1.95-.72 5.503.116 8.034.79 2.415 2.066 4.504 3.576 5.944l1.207 1.137H21.86l1.927-.975c2.438-1.23 4.203-1.44 5.503-.65.464.279.998.766 1.207 1.068l.348.557 8.754-.046 8.73-.07.07-1.695c.069-1.973-.442-5.317-1.115-7.058-.325-.882-.395-1.277-.21-1.509.442-.51.628-.348 1.139 1.022.789 2.043 1.393 5.316 1.393 7.43 0 1.903 0 1.926.58 1.926.441 0 .58-.116.58-.464 0-.673 1.022-1.625 1.742-1.625s1.741.952 1.741 1.625c0 .79.627.534.79-.348.232-1.208-.256-5.201-.929-7.5-.604-2.112-1.834-4.945-2.67-6.106l-.464-.673.835-1.393c2.23-3.669 3.135-6.687 3.135-10.379 0-2.856-.441-4.736-1.649-7.058-1.625-3.135-4.62-5.619-8.126-6.757l-1.532-.487.603-1.417c.511-1.23.604-1.74.604-3.97 0-2.902-.348-3.993-1.834-5.642-1.58-1.741-4.551-2.484-7.105-1.788zm7.662 5.92a.233.233 0 0 1-.232.232.25.25 0 0 1-.232-.232c0-.14.116-.232.232-.232.14 0 .232.093.232.232zm-.116 2.53c.07.117.023.28-.116.372-.116.07-.232-.023-.232-.209 0-.418.139-.487.348-.162zm-.58 1.65a.233.233 0 0 1-.233.231.25.25 0 0 1-.232-.232c0-.139.116-.232.232-.232.14 0 .232.093.232.232zm-.465 1.508c0 .186-.209.349-.464.349s-.465-.163-.465-.349.21-.348.465-.348.464.163.464.348zm-4.249 6.757c.163.418-.395.882-.72.557-.255-.255-.023-.929.325-.929.14 0 .302.163.395.372zm4.272.441c3.483 1.788 5.015 5.015 4.063 8.707-.394 1.509-1.09 2.902-1.973 3.947l-.488.58-1.764-1.857c-2.299-2.438-3.413-4.597-3.39-6.664 0-2.182 1.207-5.293 2.043-5.293.186 0 .86.255 1.51.58zm-4.76 1.532c.07.14-.023.418-.232.627-.348.349-.394.349-.743 0-.44-.44-.255-.882.372-.882.232 0 .51.116.604.255zm-.487 2.763c0 .697-.813.93-1.277.349-.232-.279-.232-.418 0-.697.464-.58 1.277-.348 1.277.348zm.604 2.787c.859.464.418 1.857-.604 1.857-.279 0-.604-.116-.766-.279-.58-.58-.186-1.81.603-1.81.163 0 .511.115.767.232zm1.787 3.76c.163.163.28.488.28.767s-.117.604-.28.766c-.162.163-.487.279-.766.279-.278 0-.603-.116-.766-.279-.162-.162-.279-.487-.279-.766s.117-.604.28-.766c.162-.163.487-.279.765-.279.279 0 .604.116.766.279zm3.065 3.321c.21.256.14.488-.348 1.161-.743.952-1.138 1.022-1.648.232-.349-.534-.349-.627 0-1.16.44-.65 1.532-.79 1.996-.233zm8.01 8.498c.21.65-.557 1.695-1.323 1.788-.325.046-.72-.116-.929-.349-.371-.394-.348-.487.418-1.416.674-.812.906-.929 1.254-.743.232.14.51.465.58.72zm-21.476 4.806c.952.79-.348 1.672-1.765 1.207-.952-.325-1.137-.812-.487-1.277.673-.464 1.625-.44 2.252.07zm23.45.047c.255.255.464.673.464.928 0 .604-.789 1.393-1.44 1.393-1.16 0-1.764-1.462-.951-2.368.488-.557 1.347-.534 1.927.046zm-27.165.928c0 .418-1.254 1.184-1.834 1.115-.465-.047-.604-.21-.604-.65 0-.465.163-.627.813-.836.812-.279 1.625-.093 1.625.371zm7.406.093c.21.21.256.557.163.952-.14.557-.232.627-.882.488-1.254-.256-2.113-1.486-1.277-1.858.44-.186 1.625.07 1.996.418zm11.818 4.388-.07 2.136-.464-.928c-.534-1.115-.603-3.785-.116-4.876l.302-.697.21 1.115c.115.627.162 2.09.138 3.25zm-23.543-3.18c.952.37.116 1.485-1.114 1.485-.836 0-.813-.812.046-1.253.767-.418.627-.395 1.068-.233zm10.17 1.09c.905.465 1.486.93 1.555 1.208.07.441.047.441-.348.07-.79-.697-2.74-1.556-3.924-1.695-1.323-.163-3.041.255-6.686 1.602-2.253.836-4.25 1.068-5.317.65-.233-.093.464-.163 1.509-.163 1.579 0 2.182-.116 3.529-.673 3.575-1.486 4.597-1.765 6.431-1.765 1.556 0 1.95.093 3.25.767zm-13.443.744c.023.116-.233.255-.58.301-.372.047-.651-.023-.651-.162 0-.464 1.138-.604 1.23-.14zm-1.95.72c.324.278-.442.023-.813-.28-.418-.324-.418-.324.139-.069.325.14.627.302.673.348z");

// Tentacles 1 reversed
wreckSymbols.push("m47.21021,0.23205c2.60796,0.742 4.82674,2.948 5.1233,5.107l0.13793,0.93l-0.36553,-1.022c-0.98525,-2.694 -4.50653,-4.435 -7.52731,-3.762c-2.35475,0.534 -4.00208,2.694 -4.00208,5.27c0,1.162 0.7547,3.344 1.64537,4.76l0.82465,1.3l1.57837,0.14c5.78834,0.488 11.89591,5.387 14.61815,11.748c0.96062,2.183 0.98328,2.786 0.09163,1.417c-1.64734,-2.53 -5.23857,-5.573 -8.12141,-6.873c-1.16654,-0.51 -3.70552,-1.23 -4.36958,-1.254c-0.13793,0 0.09163,0.883 0.54977,2.02c0.7547,1.858 0.82367,2.23 0.80002,4.25c0,3.435 -1.21186,6.152 -4.27697,9.774l-1.48773,1.765l0.66406,0.65c0.61775,0.603 0.70938,0.627 1.67,0.394c0.54878,-0.139 2.72224,-0.418 4.80309,-0.627c2.10449,-0.185 4.30062,-0.464 4.87305,-0.58c2.24144,-0.51 3.75183,-1.463 4.91837,-3.088c0.84633,-1.207 0.84633,-0.86 -0.02266,0.673c-1.55669,2.763 -3.29468,3.6 -11.50772,5.433l-2.2178,0.511l0.64041,0.836c1.14289,1.463 2.2641,3.367 2.9055,4.945c0.34287,0.813 0.64041,1.51 0.68573,1.556c0.02266,0.023 0.61775,-0.209 1.30349,-0.534c3.31734,-1.532 7.9155,-0.743 11.87226,1.997c0.91628,0.65 1.94488,1.323 2.28775,1.51c0.80101,0.417 3.20206,0.417 4.16367,0c1.57837,-0.65 3.70454,-3.97 4.25529,-6.618c0.47982,-2.345 -0.13793,-4.156 -1.80793,-5.317c-2.08085,-1.44 -5.39917,0.58 -5.67307,3.436c-0.11429,1.37 0.29755,2.183 1.3961,2.693l0.73204,0.35l-0.68672,-0.14c-2.14981,-0.44 -3.01979,-2.322 -2.28775,-4.876c0.50248,-1.788 2.42371,-3.83 4.07204,-4.273c3.08876,-0.882 6.45142,1.022 7.75392,4.365c0.75569,1.95 0.70938,5.503 -0.1133,8.034c-0.77835,2.415 -2.03553,4.504 -3.52325,5.944l-1.1892,1.137l-11.34515,0l-1.89858,-0.975c-2.40204,-1.23 -4.141,-1.44 -5.42183,-0.65c-0.45716,0.28 -0.98328,0.766 -1.1892,1.068l-0.34287,0.557l-8.62488,-0.046l-8.60123,-0.07l-0.06897,-1.695c-0.06897,-1.973 0.43548,-5.317 1.09855,-7.058c0.32021,-0.882 0.38917,-1.277 0.2069,-1.509c-0.43548,-0.51 -0.61874,-0.348 -1.12318,1.022c-0.77638,2.043 -1.37147,5.316 -1.37147,7.43c0,1.903 0,1.926 -0.57144,1.926c-0.4345,0 -0.57144,-0.116 -0.57144,-0.464c0,-0.673 -1.00693,-1.625 -1.71631,-1.625s-1.71532,0.952 -1.71532,1.625c0,0.79 -0.61775,0.534 -0.77835,-0.348c-0.22858,-1.208 0.25222,-5.2 0.9153,-7.5c0.59509,-2.112 1.80695,-4.945 2.63062,-6.106l0.45716,-0.673l-0.82268,-1.393c-2.19711,-3.669 -3.08876,-6.687 -3.08876,-10.379c0,-2.856 0.43351,-4.736 1.62468,-7.058c1.60103,-3.135 4.55185,-5.619 8.00614,-6.757l1.5094,-0.487l-0.59411,-1.417c-0.50346,-1.23 -0.96653,-2.368 -0.96653,-4.598c0,-2.902 0.71431,-3.365 2.1774,-5.014c1.55768,-1.74 4.48584,-2.484 7.00217,-1.788l-0.00099,0.001l-0.00099,0zm-7.54898,5.92a-0.22956,0.233 0 0 1 0.22858,0.232a-0.24631,0.25 0 0 1 0.22858,-0.232c0,-0.14 -0.11429,-0.232 -0.22858,-0.232c-0.13793,0 -0.22858,0.093 -0.22858,0.232zm0.11429,2.53c-0.06897,0.117 -0.02266,0.28 0.11429,0.372c0.11429,0.07 0.22858,-0.023 0.22858,-0.209c0,-0.418 -0.13793,-0.487 -0.34287,-0.162l0,-0.001zm0.57144,1.65a-0.22956,0.233 0 0 1 0.22956,0.231a-0.24631,0.25 0 0 1 0.22858,-0.232c0,-0.139 -0.11429,-0.232 -0.22858,-0.232c-0.13793,0 -0.22858,0.093 -0.22858,0.232l-0.00099,0.001zm0.45814,1.508c0,0.186 0.20592,0.35 0.45716,0.35s0.45814,-0.164 0.45814,-0.35s-0.2069,-0.348 -0.45814,-0.348s-0.45716,0.163 -0.45716,0.348zm4.18633,6.757c-0.1606,0.418 0.38917,0.882 0.70938,0.557c0.25124,-0.255 0.02266,-0.929 -0.32021,-0.929c-0.13793,0 -0.29755,0.163 -0.38917,0.372zm-4.20899,0.441c-3.43162,1.788 -4.94103,5.015 -4.00307,8.707c0.38819,1.51 1.07392,2.902 1.9439,3.947l0.4808,0.58l1.73798,-1.857c2.26509,-2.438 3.36266,-4.597 3.34,-6.664c0,-2.182 -1.1892,-5.293 -2.01287,-5.293c-0.18326,0 -0.84731,0.255 -1.48773,0.58l0.00099,0zm4.68979,1.532c-0.06897,0.14 0.02266,0.418 0.22858,0.627c0.34287,0.35 0.38819,0.35 0.73204,0c0.43351,-0.44 0.25124,-0.882 -0.36651,-0.882c-0.22858,0 -0.50248,0.116 -0.59509,0.255l0.00099,0zm0.47982,2.763c0,0.697 0.80101,0.93 1.25816,0.35c0.22858,-0.28 0.22858,-0.419 0,-0.698c-0.45716,-0.58 -1.25816,-0.348 -1.25816,0.348zm-0.59509,2.787c-0.84731,0.464 -0.41183,1.857 0.59509,1.857c0.27488,0 0.59509,-0.116 0.7547,-0.279c0.57144,-0.58 0.18326,-1.81 -0.59411,-1.81c-0.1606,0 -0.50346,0.115 -0.75569,0.232zm-1.76064,3.76c-0.1606,0.163 -0.27587,0.488 -0.27587,0.767s0.11527,0.604 0.27587,0.766c0.15961,0.163 0.47982,0.28 0.7547,0.28c0.2739,0 0.59411,-0.117 0.7547,-0.28c0.15961,-0.162 0.27488,-0.487 0.27488,-0.766s-0.11527,-0.604 -0.27587,-0.766c-0.15961,-0.163 -0.47982,-0.279 -0.75372,-0.279c-0.27587,0 -0.59509,0.116 -0.7547,0.28l0,-0.002zm-3.01979,3.321c-0.2069,0.256 -0.13793,0.488 0.34287,1.161c0.73204,0.952 1.12121,1.022 1.62369,0.232c0.34385,-0.534 0.34385,-0.627 0,-1.16c-0.43351,-0.65 -1.5094,-0.79 -1.96656,-0.233zm-7.89185,8.498c-0.2069,0.65 0.54878,1.695 1.30349,1.788c0.32021,0.046 0.70938,-0.116 0.9153,-0.349c0.36454,-0.394 0.34287,-0.487 -0.41183,-1.416c-0.66406,-0.812 -0.89264,-0.929 -1.2355,-0.743c-0.22858,0.14 -0.50248,0.465 -0.57144,0.72zm21.15922,4.806c-0.93796,0.79 0.34287,1.672 1.73897,1.207c0.93796,-0.325 1.12023,-0.812 0.47982,-1.277c-0.66307,-0.464 -1.60103,-0.44 -2.21878,0.07zm-23.10411,0.047c-0.25124,0.255 -0.45716,0.673 -0.45716,0.928c0,0.604 0.77736,1.393 1.41876,1.393c1.14289,0 1.73798,-1.462 0.93599,-2.368c-0.47982,-0.557 -1.32615,-0.534 -1.89759,0.046l0,0.001zm26.76431,0.928c0,0.418 1.2355,1.184 1.80695,1.115c0.45814,-0.047 0.59509,-0.21 0.59509,-0.65c0,-0.465 -0.1606,-0.627 -0.80101,-0.836c-0.80002,-0.279 -1.60103,-0.093 -1.60103,0.371zm-7.29676,0.093c-0.2069,0.21 -0.25222,0.557 -0.1606,0.952c0.13793,0.557 0.22858,0.627 0.86899,0.488c1.2355,-0.256 2.08183,-1.486 1.25816,-1.858c-0.43351,-0.186 -1.60103,0.07 -1.96656,0.418zm-11.64368,4.388l0.06897,2.136l0.45716,-0.928c0.52612,-1.115 0.59411,-3.785 0.11429,-4.876l-0.29755,-0.697l-0.2069,1.115c-0.1133,0.627 -0.15961,2.09 -0.13596,3.25zm23.19573,-3.18c-0.93796,0.37 -0.11429,1.485 1.09757,1.485c0.82367,0 0.80101,-0.812 -0.04532,-1.253c-0.75569,-0.418 -0.61775,-0.395 -1.05225,-0.233l0,0.001zm-10.01999,1.09c-0.89165,0.465 -1.46408,0.93 -1.53206,1.208c-0.06897,0.441 -0.04631,0.441 0.34287,0.07c0.77835,-0.697 2.69958,-1.556 3.86612,-1.695c1.30349,-0.163 2.99516,0.255 6.58738,1.602c2.21977,0.836 4.18731,1.068 5.23857,0.65c0.22956,-0.093 -0.45716,-0.163 -1.48773,-0.163c-1.55472,0 -2.14883,-0.116 -3.47596,-0.673c-3.52227,-1.486 -4.52919,-1.765 -6.33614,-1.765c-1.53305,0 -1.92124,0.093 -3.20206,0.767l-0.00099,0l0,-0.001zm13.24471,0.744c-0.02266,0.116 0.22956,0.255 0.57144,0.301c0.36651,0.047 0.64041,-0.023 0.64041,-0.162c0,-0.464 -1.12023,-0.604 -1.21186,-0.14l0,0.001zm1.92124,0.72c-0.31922,0.278 0.43548,0.023 0.80101,-0.28c0.41183,-0.324 0.41183,-0.324 -0.13793,-0.069c-0.31922,0.14 -0.61677,0.302 -0.66209,0.348l-0.00099,0.001z")

//Tentacles v2
wreckSymbols.push("M18.266 13.69c-4.608 1.174-8.713 5.007-10.158 9.51-1.802 5.613-.147 12.4 5.257 21.699.9 1.55 2.094 3.77 2.66 4.922l1.026 2.094-.712.23c-3.268 1.132-5.53 3.687-5.927 6.745L10.264 60l1.13-.063 1.132-.063.147-1.005c.167-1.236.837-2.64 1.57-3.31.503-.44.482-.418-.104.336-.775.984-1.299 2.367-1.299 3.393 0 1.005.482.796.67-.314.084-.461.273-1.11.44-1.445.712-1.34 3.351-3.142 3.75-2.535.397.608-.482 3.75-1.215 4.378-.168.125-.294.314-.294.419s2.681.188 5.949.188h5.927l1.717-3.686c1.906-4.105 2.89-5.886 4.336-7.813 2.325-3.079 5.739-4.859 8.755-4.524 1.32.147 3.142.754 3.812 1.257.21.168-.147.084-.796-.21-5.32-2.387-10.284.42-14.054 7.96-1.215 2.43-3.079 6.576-3.079 6.828 0 .125.482.188 1.09.146l1.088-.063.482-1.235c.252-.67.524-1.278.566-1.32.063-.063.9.23 1.864.65 2.618 1.13 4.545 1.507 6.179 1.214 1.759-.293 2.89-1.047 3.434-2.283 1.069-2.409-.418-4.817-3.225-5.194l-.9-.126 1.11.398c1.864.67 2.68 1.76 2.492 3.33-.23 2.158-2.493 3.1-5.404 2.241-.942-.272-3.54-1.508-4.545-2.136-.377-.251.084-1.424.587-1.57.523-.147 1.277-1.383 1.214-2.032-.063-.713.21-1.09 1.131-1.508.65-.315 1.718-1.634 1.299-1.634-.084 0-.021-.126.105-.293.125-.147.628-.336 1.089-.42.565-.083 1.089-.376 1.592-.858.418-.398.858-.733.984-.754.984-.063 2.01-.168 2.576-.293.524-.126.796-.042 1.236.293.335.272.859.44 1.34.44 1.55 0 3.498 2.325 4.294 5.11.293 1.006.356 1.802.272 3.875l-.104 2.64.712-1.467c2.22-4.713 1.508-9.781-1.885-13.174-1.257-1.236-3.603-2.64-4.42-2.64-.21 0-.293-.104-.23-.209.063-.125.293-.21.482-.21.754 0 3.037-1.298 4.147-2.324 2.052-1.948 3.016-4.252 3.016-7.226 0-3.854-2.095-7.289-5.404-8.839-1.068-.502-1.445-.565-3.414-.565-2.115 0-2.262.02-3.77.775-3.435 1.696-5.362 4.88-4.587 7.603.335 1.193 1.655 2.722 2.64 3.037 1.57.523 3.832.083 4.649-.901.147-.168-.147-.105-.733.189-1.843.942-3.854.44-4.943-1.215-1.445-2.241-.084-5.237 3.12-6.765 1.048-.524 1.509-.608 3.017-.629 1.592 0 1.906.063 2.911.629 1.278.712 2.325 1.885 2.995 3.372.712 1.57.65 3.958-.126 5.697-.67 1.445-1.8 2.597-3.141 3.204-.482.21-1.927.482-3.205.629-1.885.209-2.304.314-2.22.565.105.251-.105.272-1.34.147-1.131-.105-1.844-.042-3.289.293-1.005.251-1.969.524-2.136.607-.168.084 1.13.147 2.89.126l3.205-.042-3.142.168c-3.498.188-5.152.586-6.89 1.675-1.404.9-3.352 2.786-4.462 4.336-.524.733-.963 1.32-1.005 1.32-.042 0-.398-.587-.817-1.32-.398-.712-1.78-2.912-3.058-4.86-2.493-3.832-4.252-7.163-5.153-9.843-.44-1.32-.565-2.095-.586-3.666-.021-1.843.02-2.094.67-3.393.9-1.822 2.89-3.707 4.587-4.356 1.55-.587 4.042-.524 5.55.167 1.194.524 2.954 2.116 3.624 3.288 1.32 2.304 1.76 5.844.922 7.583-.86 1.78-3.268 3.204-5.404 3.204-2.158 0-2.681-1.403-1.487-3.98l.628-1.36-.628.732c-2.053 2.388-1.927 4.922.293 5.76 1.403.545 4.021.356 5.613-.356 1.403-.65 2.932-1.99 3.645-3.226.754-1.298 1.193-3.623 1.026-5.508-.42-4.44-2.283-7.812-5.509-9.928-2.262-1.508-3.497-1.885-6.43-1.948-1.382-.042-2.848.021-3.267.126zm-3.393 6.263c-2.262 2.095-3.184 4.818-3.016 8.923.167 3.896 1.11 6.89 3.414 10.807 3.749 6.41 6.723 13.929 5.739 14.536-.126.063-.21-.084-.21-.356-.02-1.613-3.1-9.09-5.194-12.567-2.241-3.749-3.351-6.535-3.959-9.907-.398-2.366-.272-5.32.335-7.247.545-1.738 1.864-3.728 2.995-4.566 1.236-.921 1.215-.795-.104.377zm1.32.943c0 .335-.378.65-.566.46-.168-.167.104-.753.356-.753.105 0 .21.125.21.293zm-1.676 2.01c0 .231-.126.42-.294.42-.377 0-.607-.336-.44-.629.231-.377.734-.23.734.21zm-.985 2.011c.189.21-.084.713-.398.713-.167 0-.293-.189-.293-.42 0-.397.398-.565.691-.293zm.147 2.702c.544.65-.377 1.487-.985.9-.25-.25-.272-.418-.083-.774.293-.524.712-.566 1.068-.126zm.607 2.912c.356.419.042.963-.523.963-.608 0-.86-.503-.503-.942.335-.398.712-.398 1.026-.021zm36.046.335c0 .23-.083.419-.21.419-.104 0-.209-.189-.209-.42s.105-.418.21-.418c.126 0 .21.188.21.419zm-.21 1.99c0 .293-.083.523-.209.523-.23 0-.293-.691-.062-.9.23-.23.272-.168.272.376zm-34.893.356c.44.628.084 1.256-.67 1.172-.629-.062-.88-.816-.461-1.34.356-.419.754-.356 1.13.168zm34.266 1.403c0 .46-.315.733-.629.544-.146-.083-.146-.272 0-.544.293-.524.629-.524.629 0zm-32.57 1.696c.314.356.335.503.147.964-.21.419-.377.523-.922.46-.837-.083-1.173-.586-.837-1.298.293-.67 1.068-.733 1.612-.126zm31.103.084c0 .335-.565.608-.858.42-.273-.168.188-.713.565-.713.168 0 .293.126.293.293zm-2.157 1.11c.126.356-.628.712-1.005.461-.252-.168-.23-.251.125-.503.44-.335.775-.314.88.042zm-2.555.691c0 .377-1.09.566-1.403.252-.357-.356.041-.691.733-.629.418.042.67.168.67.377zm1.717.754c-.063.063-.251.084-.398.021-.167-.062-.104-.125.126-.125.23-.021.356.042.272.104zm-.921.23c-.147.043-.44.043-.629 0-.21-.062-.083-.104.252-.104.356 0 .502.042.377.105zm-1.99.21c-.44.042-1.194.042-1.676 0-.502-.042-.146-.084.775-.084s1.32.042.901.084zm-23.04 1.09c.084.586-.293 1.068-.879 1.068-.628 0-.963-.377-.963-1.09 0-1.152 1.675-1.13 1.843.021zm2.367 3.602c.377.712-.062 1.445-.858 1.445-.461 0-.692-.126-.86-.503-.334-.733.064-1.382.86-1.382.419 0 .69.147.858.44zm1.76 4.105c-.084.21-.252.628-.356.943-.314.9-1.215.628-1.215-.356 0-.608.398-.943 1.11-.943.503 0 .586.063.46.356zm-6.598 4.985c0 .168-.084.314-.188.314-.273 0-.461-.335-.294-.503.23-.23.482-.125.482.189zm-1.57.712c.146.251-.252.503-.524.335-.23-.146-.084-.523.21-.523.104 0 .23.083.313.188zm-1.488 1.173a.365.365 0 0 1-.21.46c-.397.147-.586-.041-.44-.46.168-.398.483-.398.65 0zm-1.005 1.969c-.189.293-.691.293-.859.02-.084-.125-.02-.376.126-.544.23-.272.293-.272.565 0 .168.168.23.398.168.524zm-.545 1.403c.23.251.21.377-.063.67-.335.315-.377.315-.712 0-.272-.293-.293-.419-.062-.67.146-.188.335-.335.418-.335.084 0 .273.147.42.335z");
//Dolphin
// wreckSymbols.push("M30.516 15.794c-1.089.402-2.082.939-3.083 1.417-.34.163-.728.422-1.045.5-.805.202-2.066-.15-3.093-.186-2.567-.091-4.229.097-6.339.416-.987.148-2.01.287-2.876.541-.74.218-1.59.703-2.418 1.111-1.31.645-2.201 1.253-3.222 2.03-1.706 1.3-2.78 2.936-4.029 4.733-.545.784-1.33 1.953-1.37 2.881C2.32 30.331 1.223 31 .948 32.6c.385.937 1.381.104 1.982-.208.496-.259 1.03-.568 1.47-.692 2.288-.644 5.476.277 7.703-.313.79-.21 1.473-.632 2.258-.811.744-.17 1.314.131 1.845.36.282.123.58.288.835.42 1.66.857 3.318 1.766 5.546 2.108 1.788.275 3.341-.249 4.795-.532.369-.072.845-.045 1.125-.36-1.16-.262-2.123-.71-3.334-1.186-1.592-.626-2.828-1.05-3.429-2.306.712-.187 1.537-.049 2.279.081.81.142 1.613.274 2.39.402 3.28.54 5.75 1.447 8.247 2.623 1.213.57 2.331 1.366 3.36 2.033 2.105 1.369 3.903 3.068 5.598 4.92.768.837 1.453 1.887 2.285 2.887.364.438.73.926 1.118 1.466.372.513.939 1.142 1.017 1.59.089.496-.174 1.04-.307 1.581-.229.941-.398 1.95-.321 2.917.1 1.25.38 2.466.965 3.413.254-.226.358-.624.489-.988.641-.82 1.495-1.64 1.516-3.005 1.754.906 5.159.83 7.203.807.615-.007 1.241.058 1.75-.181-1.074-.623-1.862-1.41-2.795-2.214-1.412-1.215-2.58-2.239-4.662-2.889-.675-.21-1.447-.324-1.817-.715-.284-.298-.37-.96-.515-1.597a68.325 68.325 0 0 0-1.342-5.001c-1.35-4.359-3.41-8.233-6.151-11.241-1.39-1.526-3.048-2.768-4.837-4.15-.305-.479-.878-1.125-.996-1.856-.121-.752.097-1.412.562-1.918 1.017-.742 2.615-.824 3.306-1.935-.903-.65-2.024-.84-3.124-.947-2.377-.23-4.603-.051-6.446.631z");

var ripples = "m0,54.717l90,0m-80,2.262l70,0m-60,2.261l50,0m-40,2.261l30,0m-20,2.261l10,0";