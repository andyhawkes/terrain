// Share links. A random map that hasn't been edited gets a short, readable
// link (?seed=…&cities=…&theme=…); anything else gets its steps compressed
// into the link (#map=…), so hand-built and edited maps can be shared too.
import {defaultParams, defaultStyle, newParams} from '../core/steps.js';
import {GENERATOR_VERSION, checkGenerator} from '../core/document.js';
import {resolveSeed} from '../core/random.js';

// Link parameter names for the generation settings
var PARAMS = {npts: 'detail', nterrs: 'territories', ncities: 'cities', npoi: 'poi', nwrecks: 'wrecks'};
var STYLE = ['theme', 'font', 'background'];

function base() {
    return location.origin + location.pathname;
}

function toBase64Url(bytes) {
    var s = '';
    bytes.forEach(function (b) {s += String.fromCharCode(b)});
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
    var s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, function (c) {return c.charCodeAt(0)});
}

async function compress(text) {
    var stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompress(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
}

export async function shareLink(doc) {
    var json = doc.toJSON({currentMap: true});
    var steps = json.steps;
    var style = doc.state.style;
    // Seed links only carry the theme, font and background, so maps with
    // extras (grid, scale bar...) or changed lettering get the full link
    var extras = ['units', 'perUnit', 'grid', 'gridSize', 'gridLabels', 'scaleBar', 'compass', 'compassSize'];
    var plain = steps[0].type === 'generate' && !style.hidden.length && !style.title &&
        !Object.keys(style.positions || {}).length && !Object.keys(style.type || {}).length &&
        extras.every(function (k) {return style[k] == null}) &&
        steps.slice(1).every(function (s) {return s.type === 'setStyle'});
    if (plain) {
        // v: the generator version, so a later version can recreate the same map
        var query = new URLSearchParams({seed: steps[0].seed, v: GENERATOR_VERSION});
        // Only settings that differ from the shape's defaults go in the link
        var params = steps[0].args.params || {};
        var defaults = newParams({shape: params.shape});
        if (defaults.shape !== defaultParams.shape) query.set('shape', defaults.shape);
        Object.keys(PARAMS).forEach(function (key) {
            if (params[key] != null && params[key] !== defaults[key]) query.set(PARAMS[key], params[key]);
        });
        if (params.language && params.language !== defaultParams.language) query.set('names', params.language);
        if (params.roads === false) query.set('roads', 0);
        STYLE.forEach(function (key) {
            if (style[key] && style[key] !== defaultStyle[key]) query.set(key, style[key]);
        });
        return base() + '?' + query.toString();
    }
    return base() + '#map=' + toBase64Url(await compress(JSON.stringify(json)));
}

// What the page's own link asks for: {seed, params, style}, {json}, or null
export async function readLink() {
    var hash = location.hash.match(/^#map=(.+)$/);
    if (hash) return {json: JSON.parse(await decompress(fromBase64Url(hash[1])))};
    var query = new URLSearchParams(location.search);
    if (!query.has('seed')) return null;
    var version = parseInt(query.get('v'), 10) || 1;
    checkGenerator({generator: version});
    var params = {};
    Object.keys(PARAMS).forEach(function (key) {
        var n = parseInt(query.get(PARAMS[key]), 10);
        if (n >= 0) params[key] = n;
    });
    if (query.get('names')) params.language = query.get('names');
    // Roads were off unless asked for before version 4
    if (query.has('roads')) params.roads = query.get('roads') === '1';
    else if (version < 4) params.roads = false;
    if (query.get('shape')) params.shape = query.get('shape');
    var style = Object.assign({}, defaultStyle);
    STYLE.forEach(function (key) {
        if (query.get(key)) style[key] = query.get(key);
    });
    return {seed: resolveSeed(query.get('seed')), params: params, style: style};
}

// Take the link out of the address bar once it's been opened, so a reload
// shows the autosaved map rather than opening the link again
export function clearLink() {
    history.replaceState(null, '', base());
}
