// A map document: the ordered list of steps that builds a map, with a cursor
// for undo/redo. The state after each step is cached; older snapshots are
// dropped to save memory and rebuilt by replaying when needed.
import {steps, emptyState} from './steps.js';
import {withSeed, newSeed} from './random.js';

// Snapshots kept: those of the last KEEP_SNAPSHOTS steps, but holding at
// most HEIGHTMAP_BUDGET heightmap vertices between them (steps that only
// add or move things share their heightmap, so they cost little). A big
// map keeps fewer terrain snapshots, e.g. 15 for A4 High, and undoing
// past them replays from the nearest earlier one. The snapshot after the
// current map's first step is always kept, so that's the furthest a
// replay goes back.
var KEEP_SNAPSHOTS = 30;
var HEIGHTMAP_BUDGET = 2000000;
var MIN_HEIGHTMAPS = 4;
// The file format: how steps are stored
export var FORMAT_VERSION = 1;
// How steps turn into maps. Saved maps only hold steps and seeds, so a
// change that makes the same steps give a different map (e.g. drawing
// random numbers in a different order) needs a new version here. Maps
// record the version they were made with; one made by an older version
// could then be replayed the old way. History:
//   1: one random stream per step
//   2: generation stages draw from their own streams (see withStream), so
//      a seed gives the same map at any detail level or shape
//   3: the grid is built with d3-delaunay instead of d3-voronoi
//   4: random maps have roads unless params.roads is false (share links
//      from version 3 and before open without them)
export var GENERATOR_VERSION = 4;

// Throws if saved map data needs a newer generator than this one
export function checkGenerator(json) {
    if ((json.generator || 1) > GENERATOR_VERSION) {
        throw new Error('This map was made with a newer version of the map maker.');
    }
}

function applyStep(state, step) {
    var def = steps[step.type];
    if (!def) throw new Error('Unknown step type: ' + step.type);
    return withSeed(step.seed, function () {
        return def.apply(state, step.args || {});
    });
}

export class MapDocument {
    constructor() {
        this.steps = [];
        this.snapshots = [emptyState()];
        this.cursor = 0;
        this.listeners = [];
    }

    get state() {
        return this.stateAt(this.cursor);
    }

    stateAt(i) {
        if (this.snapshots[i]) return this.snapshots[i];
        var j = i;
        while (!this.snapshots[j]) j--;
        var state = this.snapshots[j];
        for (; j < i; j++) {
            state = applyStep(state, this.steps[j]);
            this.snapshots[j + 1] = state;
        }
        return state;
    }

    // Run a new step. Anything that had been undone is discarded.
    dispatch(type, args, seed) {
        var step = {type: type, args: args || {}, seed: seed == null ? newSeed() : String(seed)};
        var state = applyStep(this.state, step);
        this.steps.length = this.cursor;
        this.snapshots.length = this.cursor + 1;
        this.steps.push(step);
        this.cursor++;
        this.snapshots[this.cursor] = state;
        this.prune();
        this.emit();
        return state;
    }

    prune() {
        var current = this.snapshots[this.cursor];
        var vertices = current && current.h ? current.h.length : 0;
        var limit = Math.max(MIN_HEIGHTMAPS, Math.floor(HEIGHTMAP_BUDGET / (vertices || 1)));
        var heightmaps = new Set(current && current.h ? [current.h] : []);
        var start = this.startIndex() + 1;
        for (var i = this.cursor - 1; i >= 1; i--) {
            var state = this.snapshots[i];
            if (!state || i === start) continue;
            var keep = i >= this.cursor - KEEP_SNAPSHOTS;
            if (keep && state.h && !heightmaps.has(state.h)) {
                if (heightmaps.size < limit) heightmaps.add(state.h);
                else keep = false;
            }
            if (!keep) delete this.snapshots[i];
        }
    }

    // The first step must start a map, so it can't be undone
    canUndo() {
        return this.cursor > 1;
    }

    canRedo() {
        return this.cursor < this.steps.length;
    }

    undo() {
        if (!this.canUndo()) return;
        this.cursor--;
        this.emit();
    }

    redo() {
        if (!this.canRedo()) return;
        this.cursor++;
        this.emit();
    }

    // Jump to the map as it was after the first n steps (undoing or redoing
    // everything in between). Like undo, it can't go before the first step.
    goTo(n) {
        n = Math.max(1, Math.min(this.steps.length, n));
        if (n === this.cursor) return;
        this.cursor = n;
        this.emit();
        // A long jump back replays and keeps every step on the way
        this.prune();
    }

    // Where the current map starts: the index of the last step before the
    // cursor that made a new map (later steps build on it)
    startIndex() {
        for (var i = this.cursor - 1; i > 0; i--) {
            var type = this.steps[i].type;
            if (type === 'generate' || type === 'newBlank') return i;
        }
        return 0;
    }

    // True if there's anything for clearHistory to forget
    canClear() {
        return this.startIndex() > 0 || this.cursor < this.steps.length;
    }

    // Forget earlier maps and undone steps, keeping the current map's own
    // steps (it's built from them, so they can't go). Like a saved map, the
    // style carried over from earlier maps goes into the start step. The
    // snapshots are kept, so nothing is replayed.
    clearHistory() {
        if (!this.canClear()) return;
        var start = this.startIndex();
        var json = this.toJSON({currentMap: true});
        this.snapshots = [emptyState()].concat(this.snapshots.slice(start + 1, this.cursor + 1));
        this.steps = json.steps;
        this.cursor = this.steps.length;
        this.emit();
    }

    subscribe(fn) {
        this.listeners.push(fn);
    }

    emit() {
        var state = this.state;
        this.listeners.forEach(function (fn) {fn(state)});
    }

    // options.currentMap: only the current map's steps, from its start
    // options.keepRedo: include undone steps, plus where the cursor is
    toJSON(options) {
        options = options || {};
        var start = options.currentMap ? this.startIndex() : 0;
        var end = options.keepRedo ? this.steps.length : this.cursor;
        var steps = this.steps.slice(start, end);
        if (start > 0) {
            // The style carried over from earlier maps goes into the start step
            var first = steps[0];
            var style = this.stateAt(start + 1).style;
            steps[0] = Object.assign({}, first, {args: Object.assign({}, first.args, {style: style})});
        }
        var json = {version: FORMAT_VERSION, generator: GENERATOR_VERSION, steps: steps};
        if (options.keepRedo) json.cursor = this.cursor - start;
        return json;
    }

    // Replace this document's history with a saved one
    load(json) {
        if (!json || json.version !== FORMAT_VERSION || !Array.isArray(json.steps) || !json.steps.length) {
            throw new Error('This is not a map file this version can open.');
        }
        checkGenerator(json);
        var loaded = new MapDocument();
        loaded.steps = json.steps.slice();
        loaded.cursor = json.cursor > 0 ? Math.min(json.cursor, loaded.steps.length) : loaded.steps.length;
        loaded.state; // replay, throwing before anything here changes
        loaded.prune();
        this.steps = loaded.steps;
        this.snapshots = loaded.snapshots;
        this.cursor = loaded.cursor;
        this.emit();
    }

    static fromJSON(json) {
        var doc = new MapDocument();
        doc.load(json);
        return doc;
    }
}
