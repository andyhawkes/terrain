// What the map area shows: the finished map, or one of the diagnostic views
// of the same map that explain how it was made.
import * as d3 from 'd3';
import * as T from '../core/terrain.js';
import {derive, terrainLayers} from '../core/derive.js';
import * as R from '../render/svg.js';

export var VIEWS = [
    {id: 'map', name: 'Map', hint: 'The finished map.'},
    {id: 'heightmap', name: 'Heightmap', hint: 'Land and sea heights. Useful while shaping terrain from a blank start.'},
    {id: 'erosion', name: 'Erosion rate', hint: 'Where erosion will cut deepest: along rivers and steep slopes.'},
    {id: 'cityScore', name: 'City scores', hint: 'How attractive each spot is for the next city. Brighter is better.'},
    {id: 'territories', name: 'Territories', hint: 'Which capital each part of the map belongs to.'}
];

export function viewInfo(id) {
    return VIEWS.find(function (v) {return v.id === id});
}

function drawPolitical(svg, state, d) {
    R.drawPaths(svg, 'coast', d.coasts);
    R.drawPaths(svg, 'river', d.rivers);
    R.drawPaths(svg, 'border', d.borders);
    R.drawSlopes(svg, d.slopes);
    R.drawFeatures(svg, state);
}

var draw = {
    map: function (svg, state) {
        R.drawMap(svg, state);
    },
    heightmap: function (svg, state) {
        R.visualizeVoronoi(svg, state.h, -1, 1);
        R.drawPaths(svg, 'coast', terrainLayers(state.h).coasts);
    },
    erosion: function (svg, state) {
        R.visualizeVoronoi(svg, T.erosionRate(state.h));
        R.drawPaths(svg, 'coast', terrainLayers(state.h).coasts);
    },
    cityScore: function (svg, state) {
        var score = T.cityScore(state.h, state.cities.map(function (c) {return c.vx}));
        R.visualizeVoronoi(svg, score, d3.max(score) - 0.5);
        drawPolitical(svg, state, derive(state));
    },
    territories: function (svg, state) {
        var d = derive(state);
        R.visualizeVoronoi(svg, d.terr);
        drawPolitical(svg, state, d);
    }
};

var shown = null;

export function renderView(svg, view, state) {
    if (view !== shown) {
        R.clearAll(svg);
        shown = view;
    }
    if (state.h) draw[view](svg, state);
}
