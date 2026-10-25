// The map state and the steps that change it. A step takes a state and returns
// a new one, leaving the old state untouched so history snapshots stay valid.
// Steps run inside withSeed(), so any randomness they use is reproducible.
import * as T from './terrain.js';
import {randomVector, runif, randrange} from './random.js';
import {makeRandomLanguage, makeName} from './language.js';

export var defaultParams = {
    extent: T.defaultExtent,
    npts: 16384,
    ncities: 15,
    nwrecks: 1,
    npoi: 1,
    nterrs: 5,
    fontsizes: {
        region: 40,
        city: 25,
        town: 20,
        poi: 60
    }
};

// Upper bound for "variant" numbers, which pick a symbol from whatever set
// the renderer (and later the theme) provides.
var VARIANTS = 1000000;

export function emptyState() {
    return {
        params: defaultParams,
        h: null,
        lang: null,
        cities: [],   // {id, vx, name, regionName, labelPos?, regionLabelPos?}
        wrecks: [],   // {id, vx, variant, pos?}
        poi: [],      // {id, vx, variant, pos?}
        markers: [],  // {id, pos}
        nextId: 1
    };
}

// Lists of map items that can be moved or deleted
export var ITEM_LISTS = ['cities', 'wrecks', 'poi', 'markers'];

export function findItem(state, id) {
    for (var i = 0; i < ITEM_LISTS.length; i++) {
        var list = state[ITEM_LISTS[i]];
        for (var j = 0; j < list.length; j++) {
            if (list[j].id === id) return {list: ITEM_LISTS[i], index: j, item: list[j]};
        }
    }
    return null;
}

export function itemPos(state, item) {
    return item.pos || state.h.mesh.vxs[item.vx];
}

function nearestVertex(mesh, pos) {
    var best = 0;
    var bestd = Infinity;
    for (var i = 0; i < mesh.vxs.length; i++) {
        var v = mesh.vxs[i];
        var d = (v[0] - pos[0]) * (v[0] - pos[0]) + (v[1] - pos[1]) * (v[1] - pos[1]);
        if (d < bestd) {
            bestd = d;
            best = i;
        }
    }
    return best;
}

function vxsOf(items) {
    return items.map(function (c) {return c.vx});
}

// Copy-on-write for the naming language, which makeName mutates
function withLanguage(state) {
    return state.lang ? structuredClone(state.lang) : makeRandomLanguage();
}

function withHeightmap(state, h) {
    return Object.assign({}, state, {h: h});
}

// A new heightmap that replaces the terrain also clears what was on it
function newTerrain(state, h, params) {
    return Object.assign(emptyState(), {
        params: params || state.params,
        h: h,
        lang: state.lang,
        nextId: state.nextId
    });
}

function addCities(state, count) {
    var lang = withLanguage(state);
    var cities = state.cities.slice();
    var nextId = state.nextId;
    for (var i = 0; i < count; i++) {
        cities.push({
            id: nextId++,
            vx: T.pickCity(state.h, vxsOf(cities)),
            name: makeName(lang, 'city'),
            regionName: makeName(lang, 'region')
        });
    }
    return Object.assign({}, state, {cities: cities, lang: lang, nextId: nextId});
}

function addPlaced(state, list, pick, count) {
    var items = state[list].slice();
    var nextId = state.nextId;
    for (var i = 0; i < count; i++) {
        items.push({id: nextId++, vx: pick(state.h, vxsOf(items)), variant: randrange(VARIANTS)});
    }
    var changes = {nextId: nextId};
    changes[list] = items;
    return Object.assign({}, state, changes);
}

function mapItem(state, id, f) {
    var found = findItem(state, id);
    if (!found) return state;
    var list = state[found.list].slice();
    list[found.index] = f(Object.assign({}, found.item), found.list);
    var changes = {};
    changes[found.list] = list;
    return Object.assign({}, state, changes);
}

function uneroded(mesh) {
    var h = T.add(T.slope(mesh, randomVector(4)),
                  T.cone(mesh, runif(-1, 1)),
                  T.mountains(mesh, 50));
    h = T.peaky(h);
    h = T.fillSinks(h);
    return T.setSeaLevel(h, 0.5);
}

function count(args, fallback) {
    var n = parseInt(args.count, 10);
    return n > 0 ? n : fallback;
}

export var steps = {
    // --- Starting points ---
    newBlank: {
        label: 'New blank map',
        apply: function (state, args) {
            var params = Object.assign({}, state.params, {npts: args.npts || state.params.npts});
            var mesh = T.generateGoodMesh(params.npts, params.extent);
            return newTerrain(state, T.zero(mesh), params);
        }
    },
    generate: {
        label: 'Generate random map',
        apply: function (state, args) {
            var params = Object.assign({}, defaultParams, args.params);
            var s = Object.assign(emptyState(), {params: params});
            s.h = T.generateCoast(params);
            s.lang = makeRandomLanguage();
            s = addCities(s, params.ncities);
            s = addPlaced(s, 'wrecks', T.pickWreck, params.nwrecks);
            s = addPlaced(s, 'poi', T.pickPOI, params.npoi);
            return s;
        }
    },
    randomHeightmap: {
        label: 'Random heightmap',
        apply: function (state, args) {
            var mesh = state.h.mesh;
            var h = args.style === 'uneroded' ? uneroded(mesh) : T.coastHeightmap(mesh);
            return newTerrain(state, h);
        }
    },

    // --- Shaping the terrain ---
    flatten: {
        label: 'Reset to flat',
        apply: function (state) {
            return newTerrain(state, T.zero(state.h.mesh));
        }
    },
    slope: {
        label: 'Add random slope',
        apply: function (state) {
            return withHeightmap(state, T.add(state.h, T.slope(state.h.mesh, randomVector(4))));
        }
    },
    cone: {
        label: 'Add cone',
        apply: function (state, args) {
            return withHeightmap(state, T.add(state.h, T.cone(state.h.mesh, args.slope)));
        }
    },
    blobs: {
        label: 'Add blobs',
        apply: function (state, args) {
            return withHeightmap(state, T.add(state.h, T.mountains(state.h.mesh, count(args, 5))));
        }
    },
    normalize: {
        label: 'Normalize heightmap',
        apply: function (state) {
            return withHeightmap(state, T.normalize(state.h));
        }
    },
    roundHills: {
        label: 'Round hills',
        apply: function (state) {
            return withHeightmap(state, T.peaky(state.h));
        }
    },
    relax: {
        label: 'Relax',
        apply: function (state) {
            return withHeightmap(state, T.relax(state.h));
        }
    },
    seaLevel: {
        label: 'Set sea level',
        apply: function (state, args) {
            return withHeightmap(state, T.setSeaLevel(state.h, args.q == null ? 0.5 : args.q));
        }
    },
    erode: {
        label: 'Erode',
        apply: function (state, args) {
            return withHeightmap(state, T.doErosion(state.h, args.amount || 0.1));
        }
    },
    cleanCoast: {
        label: 'Clean coastlines',
        apply: function (state) {
            return withHeightmap(state, T.fillSinks(T.cleanCoast(state.h, 1)));
        }
    },

    // --- Features ---
    addCities: {
        label: 'Add cities',
        apply: function (state, args) {
            return addCities(state, count(args, 1));
        }
    },
    addWrecks: {
        label: 'Add wrecks',
        apply: function (state, args) {
            return addPlaced(state, 'wrecks', T.pickWreck, count(args, 1));
        }
    },
    addPOI: {
        label: 'Add points of interest',
        apply: function (state, args) {
            return addPlaced(state, 'poi', T.pickPOI, count(args, 1));
        }
    },
    renamePlaces: {
        label: 'Rename places',
        apply: function (state) {
            var lang = makeRandomLanguage();
            var cities = state.cities.map(function (c) {
                return Object.assign({}, c, {name: makeName(lang, 'city'), regionName: makeName(lang, 'region')});
            });
            return Object.assign({}, state, {cities: cities, lang: lang});
        }
    },

    // --- Editing ---
    addMarker: {
        label: 'Add marker',
        apply: function (state, args) {
            var markers = state.markers.concat([{id: state.nextId, pos: args.pos}]);
            return Object.assign({}, state, {markers: markers, nextId: state.nextId + 1});
        }
    },
    moveItem: {
        label: 'Move',
        apply: function (state, args) {
            return mapItem(state, args.id, function (item, list) {
                // Cities live on mesh vertices, because territories are
                // computed over the mesh; everything else moves freely.
                if (list === 'cities') item.vx = nearestVertex(state.h.mesh, args.pos);
                else item.pos = args.pos;
                return item;
            });
        }
    },
    deleteItem: {
        label: 'Delete',
        apply: function (state, args) {
            var found = findItem(state, args.id);
            if (!found) return state;
            var changes = {};
            changes[found.list] = state[found.list].filter(function (item) {return item.id !== args.id});
            return Object.assign({}, state, changes);
        }
    },
    // kind is 'city' or 'region'; id is the city's id
    editLabel: {
        label: 'Edit label',
        apply: function (state, args) {
            return mapItem(state, args.id, function (city) {
                city[args.kind === 'region' ? 'regionName' : 'name'] = args.text;
                return city;
            });
        }
    },
    moveLabel: {
        label: 'Move label',
        apply: function (state, args) {
            return mapItem(state, args.id, function (city) {
                city[args.kind === 'region' ? 'regionLabelPos' : 'labelPos'] = args.pos;
                return city;
            });
        }
    }
};
