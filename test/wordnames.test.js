import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MapDocument} from '../src/core/document.js';
import {placeSetting, RIVER_LIMIT} from '../src/core/terrain.js';

var SEA = /\b(Cove|Bay|Point|Key|Inlet|Sands|Shoals|Lagoon)$/;
var WATER = /^Port |\b(Cove|Bay|Point|Key|Inlet|Sands|Shoals|Lagoon|Harbour|Landing|Haven|Wharf|Creek|Quay)$/;

// Every pirate town named on a few maps, with where it is
function pirateTowns(step) {
    var towns = [];
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach(function (seed) {
        var doc = new MapDocument();
        doc.dispatch('generate', {params: {npts: 1024, ncities: 20, nterrs: 3, language: 'pirate'}}, seed);
        if (step) doc.dispatch(step);
        doc.state.cities.forEach(function (c) {
            towns.push({name: c.name, setting: placeSetting(doc.state.h, c.vx, RIVER_LIMIT)});
        });
    });
    return towns;
}

[null, 'renamePlaces'].forEach(function (step) {
    test('pirate towns are only named for water beside water' + (step ? ', when renamed' : ''), function () {
        var towns = pirateTowns(step);
        towns.forEach(function (t) {
            if (t.setting === 'inland') assert.doesNotMatch(t.name, WATER, t.name + ' is inland');
            if (t.setting === 'river') assert.doesNotMatch(t.name, SEA, t.name + ' is on a river');
        });
        // There are towns of each kind, and those by the sea can still be harbours
        assert.ok(towns.some(function (t) {return t.setting === 'inland'}));
        assert.ok(towns.some(function (t) {return t.setting === 'river' && WATER.test(t.name)}));
        assert.ok(towns.some(function (t) {return t.setting === 'coast' && SEA.test(t.name)}));
    });
});
