#!/usr/bin/env node
// Generates a map from a seed without a browser, and prints its layers as JSON.
// Usage: npm run generate -- [--seed abc|today] [--npts 16384] [--ncities 15] [--nterrs 5]
//                           [--nwrecks 1] [--npoi 1] [--language random|english|…]
//                           [--shape square|a4-landscape|a4-portrait] [--out map.json]
import {writeFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {MapDocument} from '../src/core/document.js';
import {derive} from '../src/core/derive.js';
import {itemPos} from '../src/core/steps.js';
import {newSeed, resolveSeed} from '../src/core/random.js';

var numeric = ['npts', 'ncities', 'nterrs', 'nwrecks', 'npoi'];
var options = {seed: {type: 'string'}, out: {type: 'string'}, language: {type: 'string'}, shape: {type: 'string'}};
numeric.forEach(function (name) {options[name] = {type: 'string'}});
var args = parseArgs({options: options}).values;

var params = {};
numeric.forEach(function (name) {
    if (args[name] != null) params[name] = parseInt(args[name], 10);
});
if (args.language) params.language = args.language;
if (args.shape) params.shape = args.shape;
var seed = args.seed ? resolveSeed(args.seed) : newSeed();

var doc = new MapDocument();
doc.dispatch('generate', {params: params}, seed);
var state = doc.state;
var d = derive(state);

function points(list) {
    return state[list].map(function (item) {
        return Object.assign({id: item.id, pos: itemPos(state, item)}, item.variant != null ? {variant: item.variant} : {});
    });
}

var output = {
    seed: seed,
    document: doc.toJSON(),
    extent: state.params.extent,
    scale: state.params.scale,  // SVG units per map unit, which text sizes assume
    layers: {
        coasts: d.coasts,
        rivers: d.rivers,
        borders: d.borders,
        slopes: d.slopes,
        cities: state.cities.map(function (c, i) {
            return {id: c.id, pos: itemPos(state, c), capital: i < state.params.nterrs, name: c.name};
        }),
        wrecks: points('wrecks'),
        poi: points('poi'),
        labels: d.labels
    }
};

var json = JSON.stringify(output);
if (args.out) {
    writeFileSync(args.out, json);
    console.error('Wrote ' + args.out + ' (seed ' + seed + ')');
} else {
    process.stdout.write(json + '\n');
}
