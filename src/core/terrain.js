// Terrain generation: mesh, heightmap operations, erosion, rivers, cities and
// territories. No DOM access, and all randomness comes from ./random.js.
import {ascending, min, max, mean, maxIndex, quantileSorted} from 'd3-array';
import {Delaunay} from 'd3-delaunay';
import PriorityQueue from 'js-priority-queue';
import {random, runif, rnorm, randomVector, randrange, shuffled, withStream} from './random.js';

export var defaultExtent = {
    width: 1,
    height: 1
};

function generatePoints(n, extent) {
    extent = extent || defaultExtent;
    var pts = [];
    for (var i = 0; i < n; i++) {
        pts.push([(random() - 0.5) * extent.width, (random() - 0.5) * extent.height]);
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
        var cells = voronoi(pts, extent);
        pts = pts.map(function (p, j) {
            // Polygons repeat their first point at the end
            var polygon = cells.cellPolygon(j);
            return polygon ? centroid(polygon.slice(0, -1)) : p;
        });
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
    return Delaunay.from(pts).voronoi([-w, -h, w, h]);
}

function clamp(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
}

// The mesh is the Voronoi diagram of the points: its vertices are the
// centres of the Delaunay triangles, and an edge joins
// the centres of two triangles that share a side, between the two points at
// that side's ends. Triangles on the outside have fewer than three
// neighbours, which marks the map's edge (see isedge).
function makeMesh(pts, extent) {
    extent = extent || defaultExtent;
    var w = extent.width/2;
    var h = extent.height/2;
    var delaunay = Delaunay.from(pts);
    var triangles = delaunay.triangles;
    var halfedges = delaunay.halfedges;
    var centres = delaunay.voronoi([-w, -h, w, h]).circumcenters;
    var count = triangles.length / 3;
    var ends = [];
    var degree = new Int32Array(count);
    for (var e = 0; e < halfedges.length; e++) {
        // Each shared side appears twice, once from each triangle
        var opposite = halfedges[e];
        if (opposite < e) continue;
        var t0 = Math.floor(e / 3);
        var t1 = Math.floor(opposite / 3);
        var next = e % 3 === 2 ? e - 2 : e + 1;
        degree[t0]++;
        degree[t1]++;
        ends.push(t0, t1, triangles[e], triangles[next]);
    }
    // Triangles near the edge can be long and thin, with centres far off the
    // map, so centres are kept on the map. Those brought to its edge can line
    // up or meet, which trislope and getTerritories allow for.
    var vxs = new Array(count);
    for (var t = 0; t < count; t++) {
        vxs[t] = [clamp(centres[2 * t], -w, w), clamp(centres[2 * t + 1], -h, h)];
    }

    // Each vertex's neighbours, all in one array: those of vertex i are
    // adj[adjStart[i]] up to adj[adjStart[i + 1]], in the order its edges
    // were found
    var adjStart = new Int32Array(count + 1);
    for (var i = 0; i < count; i++) {
        adjStart[i + 1] = adjStart[i] + degree[i];
    }
    var adj = new Int32Array(adjStart[count]);
    var filled = adjStart.slice(0, count);
    for (var k = 0; k < ends.length; k += 4) {
        adj[filled[ends[k]]++] = ends[k + 1];
        adj[filled[ends[k + 1]]++] = ends[k];
    }

    // Kept in typed arrays, which take a few MB even for big maps:
    //   sites: the points, [x, y] each
    //   vxs: vertex positions, [x, y] each
    //   adjStart, adj: each vertex's neighbours (see above)
    //   edges: four numbers per edge: its two vertices, then the indexes in
    //     sites of the points either side
    //   triangles: the three points (indexes in sites) around each vertex
    var mesh = {
        sites: pts,
        vxs: vxs,
        adjStart: adjStart,
        adj: adj,
        edges: Int32Array.from(ends),
        triangles: triangles,
        extent: extent
    }
    mesh.map = function (f) {
        var mapped = Float64Array.from(vxs, f);
        mapped.mesh = mesh;
        return mapped;
    }
    return mesh;
}

// The points around each vertex (the triangle it's the centre of), for
// drawing a field as coloured cells. Only the diagnostic views need these,
// so they're built on first use.
function meshTris(mesh) {
    if (mesh.tris) return mesh.tris;
    var tris = [];
    var t = mesh.triangles;
    for (var i = 0; i < mesh.vxs.length; i++) {
        tris.push([mesh.sites[t[3 * i]], mesh.sites[t[3 * i + 1]], mesh.sites[t[3 * i + 2]]]);
    }
    mesh.tris = tris;
    return tris;
}

function generateGoodMesh(n, extent) {
    extent = extent || defaultExtent;
    var pts = generateGoodPoints(n, extent);
    return makeMesh(pts, extent);
}
function isedge(mesh, i) {
    return mesh.adjStart[i + 1] - mesh.adjStart[i] < 3;
}

function area(mesh) {
    return mesh.extent.width * mesh.extent.height;
}

function isnearedge(mesh, i) {
    var x = mesh.vxs[i][0];
    var y = mesh.vxs[i][1];
    var w = mesh.extent.width;
    var h = mesh.extent.height;
    return x < -0.45 * w || x > 0.45 * w || y < -0.45 * h || y > 0.45 * h;
}

function neighbours(mesh, i) {
    return Array.from(mesh.adj.subarray(mesh.adjStart[i], mesh.adjStart[i + 1]));
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
    sortedh.sort(ascending);
    return quantileSorted(sortedh, q);
}

// A heightmap (or any value per vertex): a Float64Array with its mesh
// attached. Heightmaps are never changed once made, so they can be shared
// between map states.
function zero(mesh) {
    var z = new Float64Array(mesh.vxs.length);
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
    var lo = min(h);
    var hi = max(h);
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
        mounts.push([mesh.extent.width * (random() - 0.5), mesh.extent.height * (random() - 0.5)]);
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
        newh[i] = mean(nbs.map(function (j) {return h[j]}));
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
    var downs = new Int32Array(h.length);
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

// Raises every pit so water can flow off the map: each cell ends up at
// least epsilon above the next cell on its way out. A priority flood from
// the edges, lowest first, does this in one pass.
function fillSinks(h, epsilon) {
    epsilon = epsilon || 1e-5;
    var newh = zero(h.mesh);
    var done = new Uint8Array(h.length);
    var queue = new PriorityQueue({comparator: function (a, b) {return newh[a] - newh[b]}});
    for (var i = 0; i < h.length; i++) {
        if (isnearedge(h.mesh, i)) {
            newh[i] = h[i];
            done[i] = 1;
            queue.queue(i);
        }
    }
    while (queue.length) {
        var c = queue.dequeue();
        for (var j = h.mesh.adjStart[c]; j < h.mesh.adjStart[c + 1]; j++) {
            var n = h.mesh.adj[j];
            if (done[n]) continue;
            done[n] = 1;
            newh[n] = Math.max(h[n], newh[c] + epsilon);
            queue.queue(n);
        }
    }
    return newh;
}

// How much water flows through each vertex: its own share of rain plus
// everything upstream. Rivers, territories and city placement all ask for
// it, usually of the same heightmap, so the last result is kept (just one,
// so undo snapshots don't each hold a copy). Heightmaps never change, so
// it stays valid; callers must not change it.
var lastFlux = {h: null, flux: null};

function getFlux(h) {
    if (lastFlux.h === h) return lastFlux.flux;
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
    lastFlux = {h: h, flux: flux};
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
    var maxr = max(er);
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
    if (Math.abs(det) < 1e-15) return [0, 0];
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

// Best vertex for a new city, given the vertices of existing cities
function pickCity(h, cities) {
    return maxIndex(cityScore(h, cities));
}

function wreckScore(h, wrecks) {
    var score = map(getFlux(h), Math.sqrt);
    // console.log(score);
    for (var i = 0; i < h.length; i++) {
        // console.log(h[i]);
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

function pickWreck(h, wrecks) {
    return maxIndex(wreckScore(h, wrecks));
}

// Points of interest go near a random spot, so they land in the same place
// whatever the grid
function POIScore(h, poi) {
    var target = [runif(-WORLD / 2, WORLD / 2), runif(-WORLD / 2, WORLD / 2)];
    var score = map(h, function (x, i) {
        var v = h.mesh.vxs[i];
        return -Math.sqrt((v[0] - target[0]) * (v[0] - target[0]) + (v[1] - target[1]) * (v[1] - target[1]));
    });
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
function pickPOI(h, poi) {
    return maxIndex(POIScore(h, poi));
}

function contour(h, level) {
    level = level || 0;
    var edges = [];
    var e = h.mesh.edges;
    for (var k = 0; k < e.length; k += 4) {
        var v0 = e[k];
        var v1 = e[k + 1];
        if (e[k + 3] < 0) continue;
        if (isnearedge(h.mesh, v0) || isnearedge(h.mesh, v1)) continue;
        if ((h[v0] > level && h[v1] <= level) ||
            (h[v1] > level && h[v0] <= level)) {
            edges.push([h.mesh.sites[e[k + 2]], h.mesh.sites[e[k + 3]]]);
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

// cities: vertex indices; the first nterrs are capitals
function getTerritories(h, cities, nterrs) {
    var n = Math.min(nterrs, cities.length);
    var flux = getFlux(h);
    var terr = [];
    var queue = new PriorityQueue({comparator: function (a, b) {return a.score - b.score}});
    function weight(u, v) {
        // Vertices moved to the map's edge can meet
        var horiz = Math.max(distance(h.mesh, u, v), 1e-9);
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

function getBorders(h, terr) {
    var edges = [];
    var e = terr.mesh.edges;
    for (var k = 0; k < e.length; k += 4) {
        var v0 = e[k];
        var v1 = e[k + 1];
        if (e[k + 3] < 0) continue;
        if (isnearedge(terr.mesh, v0) || isnearedge(terr.mesh, v1)) continue;
        if (h[v0] < 0 || h[v1] < 0) continue;
        if (terr[v0] != terr[v1]) {
            edges.push([terr.mesh.sites[e[k + 2]], terr.mesh.sites[e[k + 3]]]);
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

// Random features are placed in a fixed square of this size around the
// middle, big enough for any map shape. A map shows the part that falls
// inside it, so maps of different shapes from one seed share features.
var WORLD = 2.12;

// Hills scattered across the world: 50 per square map unit
function worldHills(mesh) {
    var n = Math.round(50 * WORLD * WORLD);
    var hills = [];
    for (var i = 0; i < n; i++) {
        var p = [WORLD * (random() - 0.5), WORLD * (random() - 0.5)];
        // Hills further off the map than this add nothing visible to it
        if (Math.abs(p[0]) < mesh.extent.width / 2 + 0.25 && Math.abs(p[1]) < mesh.extent.height / 2 + 0.25) hills.push(p);
    }
    var r = 0.05;
    var h = zero(mesh);
    for (var i = 0; i < mesh.vxs.length; i++) {
        var v = mesh.vxs[i];
        for (var j = 0; j < hills.length; j++) {
            var dx = v[0] - hills[j][0];
            var dy = v[1] - hills[j][1];
            h[i] += Math.pow(Math.exp(-(dx * dx + dy * dy) / (2 * r * r)), 2);
        }
    }
    return h;
}

// Relaxing smooths over a few cells, so a finer grid needs more passes to
// smooth the same distance: n passes at medium detail on a square map
function smoothingPasses(mesh, n) {
    var density = mesh.vxs.length / area(mesh);
    return Math.max(1, Math.round(n * density / 16384));
}

// The grid and the terrain draw from separate streams, so the same seed
// gives the same terrain at any level of detail
function generateCoast(params) {
    var mesh = withStream('grid', function () {return generateGoodMesh(params.npts, params.extent)});
    return withStream('terrain', function () {return coastHeightmap(mesh)});
}

function coastHeightmap(mesh) {
    var h = add(
            slope(mesh, randomVector(4)),
            cone(mesh, runif(-1, -1)),
            worldHills(mesh)
            );
    var passes = smoothingPasses(mesh, 10);
    for (var i = 0; i < passes; i++) {
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


// Hatching strokes for slope shading, in map units
function slopeStrokes(h) {
    var strokes = [];
    var r = 0.25 * Math.sqrt(area(h.mesh) / h.length);
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
    return strokes;
}

// Short horizontal strokes on the sea along the coast, thinning out further
// from land, like the water-lining on old charts. width is how far out
// they go, in map units. The same number of strokes per area at any level
// of detail.
function seaStrokes(h, width) {
    var mesh = h.mesh;
    var spacing = Math.sqrt(area(mesh) / h.length);
    var maxHops = Math.max(1, Math.round(width / spacing));
    // How many cells out from the coast each sea vertex is
    var hops = new Int32Array(h.length).fill(-1);
    var frontier = [];
    for (var i = 0; i < h.length; i++) {
        if (h[i] > 0) continue;
        var nbs = neighbours(mesh, i);
        for (var j = 0; j < nbs.length; j++) {
            if (h[nbs[j]] > 0) {
                hops[i] = 0;
                frontier.push(i);
                break;
            }
        }
    }
    for (var hop = 1; hop <= maxHops && frontier.length; hop++) {
        var next = [];
        for (var k = 0; k < frontier.length; k++) {
            var nbs = neighbours(mesh, frontier[k]);
            for (var j = 0; j < nbs.length; j++) {
                var n = nbs[j];
                if (hops[n] >= 0 || h[n] > 0) continue;
                hops[n] = hop;
                next.push(n);
            }
        }
        frontier = next;
    }
    var chance = Math.min(1, 16384 / (h.length / area(mesh)));
    var strokes = [];
    for (var i = 0; i < h.length; i++) {
        if (hops[i] < 0 || isnearedge(mesh, i)) continue;
        var nearness = 1 - hops[i] / (maxHops + 1);
        if (random() > chance * nearness * nearness) continue;
        var x = mesh.vxs[i][0];
        var y = mesh.vxs[i][1];
        var l = runif(0.01, 0.02);
        strokes.push([[x - l / 2, y], [x + l / 2, y]]);
    }
    return strokes;
}

// How far each sea vertex is from the shore, in map units (land is 0)
function seaDistance(h) {
    var mesh = h.mesh;
    var dist = new Float64Array(h.length).fill(Infinity);
    var queue = new PriorityQueue({comparator: function (a, b) {return dist[a] - dist[b]}});
    for (var i = 0; i < h.length; i++) {
        if (h[i] > 0) {
            dist[i] = 0;
            continue;
        }
        var nbs = neighbours(mesh, i);
        for (var j = 0; j < nbs.length; j++) {
            if (h[nbs[j]] > 0) {
                dist[i] = 0;
                queue.queue(i);
                break;
            }
        }
    }
    while (queue.length) {
        var u = queue.dequeue();
        var nbs = neighbours(mesh, u);
        for (var j = 0; j < nbs.length; j++) {
            var v = nbs[j];
            var d = dist[u] + distance(mesh, u, v);
            if (d < dist[v]) {
                dist[v] = d;
                queue.queue(v);
            }
        }
    }
    return dist;
}

// Lines on the sea following the coast at the given distances (map units),
// like the outlines around coasts on hand-drawn maps
function coastLines(h, offsets) {
    var dist = seaDistance(h);
    var field = map(h, function (x, i) {return x > 0 ? 1 : -dist[i]});
    return offsets.map(function (offset) {
        return contour(field, -offset).map(relaxPath).map(relaxPath);
    });
}

// Mountains, hills and trees drawn as little pictures, the way hand-drawn
// maps show relief. The highest land gets mountains (bigger on higher
// peaks), so they gather into ranges; the middle ground gets hills, and
// trees grow in clumps on lower land.
// Symbols keep their distance from each other, the coast and rivers.
// spacing gives each kind's distance in SVG units, and scale is SVG units
// per map unit, so symbols are spaced the same however detailed the grid.
// Returns [{kind, x, y, size, variant}], back to front so nearer symbols
// overlap those behind.
function reliefSymbols(h, scale, spacing) {
    var mesh = h.mesh;
    var flux = getFlux(h);
    var land = [];
    var above = 0;
    for (var i = 0; i < h.length; i++) {
        if (h[i] > 0) above++;
    }
    var riverFlux = 0.01 * above / h.length;
    for (var i = 0; i < h.length; i++) {
        if (h[i] <= 0 || isnearedge(mesh, i) || flux[i] > riverFlux) continue;
        var nbs = neighbours(mesh, i);
        if (nbs.some(function (n) {return h[n] <= 0})) continue;
        land.push(i);
    }
    if (!land.length) return [];
    var heights = land.map(function (i) {return h[i]}).sort(ascending);
    var hills = quantileSorted(heights, 0.6);
    var peaks = quantileSorted(heights, 0.88);
    var top = heights[heights.length - 1];

    // Forests clump where a smooth random field is high
    var woods = [];
    for (var k = 0; k < Math.round(30 * WORLD * WORLD); k++) {
        woods.push([WORLD * (random() - 0.5), WORLD * (random() - 0.5)]);
    }
    function forest(v) {
        var f = 0;
        for (var k = 0; k < woods.length; k++) {
            var dx = v[0] - woods[k][0];
            var dy = v[1] - woods[k][1];
            f += Math.exp(-(dx * dx + dy * dy) / (2 * 0.06 * 0.06));
        }
        return f;
    }

    // Accept symbols in a random order, each far enough from those taken
    var cell = Math.max(spacing.mountain, spacing.hill, spacing.tree) / scale;
    var grid = new Map();
    var symbols = [];
    function clear(x, y, gap) {
        var cx = Math.floor(x / cell);
        var cy = Math.floor(y / cell);
        for (var gx = cx - 1; gx <= cx + 1; gx++) {
            for (var gy = cy - 1; gy <= cy + 1; gy++) {
                var near = grid.get(gx + ',' + gy);
                if (!near) continue;
                for (var n = 0; n < near.length; n++) {
                    var s = near[n];
                    var need = Math.max(gap, s.gap);
                    if ((s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < need * need) return false;
                }
            }
        }
        return true;
    }
    shuffled(land).forEach(function (i) {
        var v = mesh.vxs[i];
        var kind = h[i] >= peaks ? 'mountain' : h[i] >= hills ? 'hill' : forest(v) > 1.2 ? 'tree' : null;
        if (!kind) return;
        // Higher peaks are bigger, and every symbol varies a little
        var size = (kind === 'mountain' ? 1 + 0.5 * (h[i] - peaks) / (top - peaks || 1) : 1) * runif(0.85, 1.15);
        var gap = spacing[kind] * size / scale;
        if (!clear(v[0], v[1], gap)) return;
        var symbol = {kind: kind, x: v[0], y: v[1], size: size, variant: randrange(1000), gap: gap};
        var key = Math.floor(v[0] / cell) + ',' + Math.floor(v[1] / cell);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(symbol);
        symbols.push(symbol);
    });
    return symbols.sort(function (a, b) {return a.y - b.y}).map(function (s) {
        return {kind: s.kind, x: s.x, y: s.y, size: s.size, variant: s.variant};
    });
}

export {
    generatePoints, improvePoints, generateGoodPoints, makeMesh, generateGoodMesh, meshTris,
    isedge, isnearedge, neighbours, distance, quantile,
    zero, slope, cone, map, normalize, peaky, add, mountains, relax,
    downhill, fillSinks, getFlux, getSlope, erosionRate, erode, doErosion,
    setSeaLevel, cleanCoast, trislope, dropEdge, generateCoast, coastHeightmap,
    cityScore, wreckScore, POIScore, pickCity, pickWreck, pickPOI,
    contour, getRivers, getTerritories, getBorders, mergeSegments, relaxPath,
    terrCenter, slopeStrokes, seaStrokes, reliefSymbols, coastLines
};
