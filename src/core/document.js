// A map document: the ordered list of steps that builds a map, with a cursor
// for undo/redo. The state after each step is cached; older snapshots are
// dropped to save memory and rebuilt by replaying when needed.
import {steps, emptyState} from './steps.js';
import {withSeed, newSeed} from './random.js';

var KEEP_SNAPSHOTS = 30;
export var FORMAT_VERSION = 1;

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
        for (var i = 1; i < this.cursor - KEEP_SNAPSHOTS; i++) {
            delete this.snapshots[i];
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

    subscribe(fn) {
        this.listeners.push(fn);
    }

    emit() {
        var state = this.state;
        this.listeners.forEach(function (fn) {fn(state)});
    }

    toJSON() {
        return {version: FORMAT_VERSION, steps: this.steps.slice(0, this.cursor)};
    }

    // Replace this document's history with a saved one
    load(json) {
        if (!json || json.version !== FORMAT_VERSION || !Array.isArray(json.steps) || !json.steps.length) {
            throw new Error('This is not a map file this version can open.');
        }
        var loaded = new MapDocument();
        loaded.steps = json.steps.slice();
        loaded.cursor = loaded.steps.length;
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
