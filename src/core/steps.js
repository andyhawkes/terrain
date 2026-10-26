// The map state and the steps that change it. A step takes a state and returns
// a new one, leaving the old state untouched so history snapshots stay valid.
// Steps run inside withSeed(), so any randomness they use is reproducible.
import * as T from './terrain.js';
import {randomVector, runif, randrange, withStream} from './random.js';
import {makeLanguage, makeName} from './language.js';

export var defaultParams = {
    shape: 'square',
    extent: T.defaultExtent,
    scale: 1000,  // SVG units per map unit (see SHAPES)
    npts: 16384,
    ncities: 15,
    nwrecks: 1,
    npoi: 1,
    nterrs: 5,
    language: 'random',  // an id from LANGUAGES, for place names
    fontsizes: {
        region: 40,
        city: 25,
        town: 20,
        poi: 60
    }
};

// Map shapes. extent is the size of the world in map units; scale is how
// many SVG units each map unit is drawn at. Text, lines and symbols have
// fixed sizes in SVG units, so the A4 shapes use a smaller scale: printed
// on A4 with a border, everything comes out the same size as on a square
// map printed across A4, but there's about three times as much world.
// detail lists the grid sizes offered (low, medium, high); bigger maps get
// more points but not proportionally more, to stay quick enough to edit.
// counts are the default numbers of places for a random map.
export var SHAPES = [
    {id: 'square', name: 'Square', extent: {width: 1, height: 1}, scale: 1000,
        detail: [4096, 16384, 65536], counts: {ncities: 15, nterrs: 5, npoi: 1, nwrecks: 1}},
    {id: 'a4-landscape', name: 'A4 landscape', extent: {width: 2.12, height: 1.5}, scale: 700,
        detail: [16384, 32768, 65536], counts: {ncities: 30, nterrs: 8, npoi: 2, nwrecks: 2}},
    {id: 'a4-portrait', name: 'A4 portrait', extent: {width: 1.5, height: 2.12}, scale: 700,
        detail: [16384, 32768, 65536], counts: {ncities: 30, nterrs: 8, npoi: 2, nwrecks: 2}}
];

export function getShape(id) {
    return SHAPES.find(function (s) {return s.id === id}) || SHAPES[0];
}

// Settings for a new map: defaults, then the shape's, then those given
export function newParams(given) {
    var shape = getShape(given && given.shape);
    var params = Object.assign({}, defaultParams, shape.counts, {npts: shape.detail[1]}, given);
    return Object.assign(params, {shape: shape.id, extent: shape.extent, scale: shape.scale});
}

// How the map is drawn: a theme id plus the user's choices within it.
// font and background are ids from the theme (null means its default);
// hidden lists layers that are switched off.
export var defaultStyle = {
    theme: 'simple',
    font: null,
    background: null,
    hidden: []
};

// Upper bound for "variant" numbers, which pick a symbol from whatever set
// the renderer (and later the theme) provides.
var VARIANTS = 1000000;

export function emptyState() {
    return {
        params: defaultParams,
        style: defaultStyle,
        h: null,
        lang: null,
        // vx is the mesh vertex an item was placed on; pos, if set, is where it
        // has been moved to. Territories are always computed from vx.
        cities: [],   // {id, vx, name, regionName, pos?, labelOffset?, regionLabelPos?}
        wrecks: [],   // {id, vx, variant, pos?}
        poi: [],      // {id, vx, variant, pos?}
        markers: [],  // {id, pos, type, color}; type is a marker type id (see MARKER_TYPES)
        notes: [],    // {id, pos, text}: free text placed on the map
        nextId: 1
    };
}

// Kinds of marker the user can place. Each theme draws them its own way.
export var MARKER_TYPES = [
    {id: 'x', name: 'X marks the spot'},
    {id: 'danger', name: 'Danger'},
    {id: 'flag', name: 'Flag'},
    {id: 'camp', name: 'Camp'},
    {id: 'star', name: 'Landmark'}
];

// Kinds of symbol the user can place, and the list each kind is kept in.
// Which drawing a symbol uses is its variant, counted within the theme's set.
export var SYMBOL_KINDS = [
    {id: 'wreck', list: 'wrecks', name: 'Wreck'},
    {id: 'poi', list: 'poi', name: 'Point of interest'}
];

function symbolKind(id) {
    return SYMBOL_KINDS.find(function (k) {return k.id === id}) || SYMBOL_KINDS[0];
}

// Lists of map items that can be moved or deleted
export var ITEM_LISTS = ['cities', 'wrecks', 'poi', 'markers', 'notes'];

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

function vxsOf(items) {
    return items.map(function (c) {return c.vx});
}

// Copy-on-write for the naming language, which makeName mutates
function withLanguage(state) {
    return state.lang ? structuredClone(state.lang) : makeLanguage(state.params.language);
}

function withHeightmap(state, h) {
    return Object.assign({}, state, {h: h});
}

// A new heightmap that replaces the terrain also clears what was on it
function newTerrain(state, h, params) {
    return Object.assign(emptyState(), {
        params: params || state.params,
        style: state.style,
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
    // A new map depends on nothing before it except the style, which carries
    // over (or is given in args.style when a map is saved on its own). That
    // way one map's steps can be saved, shared and replayed by themselves.
    newBlank: {
        label: 'New blank map',
        apply: function (state, args) {
            var params = newParams({shape: args.shape, language: args.language || defaultParams.language});
            if (args.npts) params.npts = args.npts;
            var mesh = T.generateGoodMesh(params.npts, params.extent);
            return Object.assign(emptyState(), {params: params, style: args.style || state.style, h: T.zero(mesh)});
        }
    },
    generate: {
        label: 'Generate random map',
        apply: function (state, args) {
            var params = newParams(args.params);
            var s = Object.assign(emptyState(), {params: params, style: args.style || state.style});
            // Each stage has its own random stream (see withStream), so
            // changing the detail, shape or counts changes only what it must
            s.h = T.generateCoast(params);
            s = withStream('names', function () {
                s.lang = makeLanguage(params.language);
                return addCities(s, params.ncities);
            });
            s = withStream('wrecks', function () {return addPlaced(s, 'wrecks', T.pickWreck, params.nwrecks)});
            s = withStream('poi', function () {return addPlaced(s, 'poi', T.pickPOI, params.npoi)});
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
    // Names every place afresh, in args.language if given (which then
    // becomes the map's language for places added later)
    renamePlaces: {
        label: 'Rename places',
        apply: function (state, args) {
            var params = args.language ? Object.assign({}, state.params, {language: args.language}) : state.params;
            var lang = makeLanguage(params.language);
            var cities = state.cities.map(function (c) {
                return Object.assign({}, c, {name: makeName(lang, 'city'), regionName: makeName(lang, 'region')});
            });
            return Object.assign({}, state, {cities: cities, lang: lang, params: params});
        }
    },

    // --- Style ---
    // Merges the given fields into the style; changing theme resets the
    // font and background to that theme's defaults.
    setStyle: {
        label: 'Change style',
        apply: function (state, args) {
            var style = Object.assign({}, state.style, args);
            if (args.theme && args.theme !== state.style.theme) {
                if (!('font' in args)) style.font = null;
                if (!('background' in args)) style.background = null;
            }
            return Object.assign({}, state, {style: style});
        }
    },

    // --- Editing ---
    addMarker: {
        label: 'Add marker',
        apply: function (state, args) {
            var markers = state.markers.concat([{id: state.nextId, pos: args.pos, type: args.type || 'x',
                color: args.color || null}]);
            return Object.assign({}, state, {markers: markers, nextId: state.nextId + 1});
        }
    },
    // A wreck or point of interest placed by hand, rather than by the terrain
    addSymbol: {
        label: 'Add symbol',
        apply: function (state, args) {
            var list = symbolKind(args.kind).list;
            var changes = {nextId: state.nextId + 1};
            changes[list] = state[list].concat([{id: state.nextId, vx: null, pos: args.pos, variant: args.variant || 0}]);
            return Object.assign({}, state, changes);
        }
    },
    // Swaps the drawing used for a wreck or point of interest. Changing its
    // kind moves it to the other list, keeping its id and position.
    setSymbol: {
        label: 'Change symbol',
        apply: function (state, args) {
            var found = findItem(state, args.id);
            if (!found || !SYMBOL_KINDS.some(function (k) {return k.list === found.list})) return state;
            var item = Object.assign({}, found.item, {variant: args.variant || 0});
            var list = args.kind ? symbolKind(args.kind).list : found.list;
            if (list !== found.list) item.pos = itemPos(state, found.item);
            var changes = {};
            changes[found.list] = state[found.list].filter(function (i) {return i.id !== args.id});
            if (list === found.list) changes[list] = state[list].map(function (i) {return i.id === args.id ? item : i});
            else changes[list] = state[list].concat([item]);
            return Object.assign({}, state, changes);
        }
    },
    addNote: {
        label: 'Add text',
        apply: function (state, args) {
            var notes = state.notes.concat([{id: state.nextId, pos: args.pos, text: args.text}]);
            return Object.assign({}, state, {notes: notes, nextId: state.nextId + 1});
        }
    },
    // Moving an item only moves its marker: the terrain, territories and
    // other labels stay as they are. A city's label moves with it.
    moveItem: {
        label: 'Move',
        apply: function (state, args) {
            return mapItem(state, args.id, function (item) {
                item.pos = args.pos;
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
    // kind is 'city' or 'region' (id is the city's id), or 'note'
    editLabel: {
        label: 'Edit text',
        apply: function (state, args) {
            return mapItem(state, args.id, function (item) {
                var field = {region: 'regionName', note: 'text'}[args.kind] || 'name';
                item[field] = args.text;
                return item;
            });
        }
    },
    // Moving a label never moves what it labels. City labels are stored as an
    // offset from the city, so they follow it if the city moves later.
    moveLabel: {
        label: 'Move label',
        apply: function (state, args) {
            return mapItem(state, args.id, function (city) {
                if (args.kind === 'region') {
                    city.regionLabelPos = args.pos;
                } else {
                    var at = itemPos(state, city);
                    city.labelOffset = [args.pos[0] - at[0], args.pos[1] - at[1]];
                }
                return city;
            });
        }
    }
};
