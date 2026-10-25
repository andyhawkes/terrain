// Share links. A random map that hasn't been edited gets a short, readable
// link (?seed=…&cities=…&theme=…); anything else gets its steps compressed
// into the link (#map=…), so hand-built and edited maps can be shared too.
import {defaultParams, defaultStyle} from '../core/steps.js';
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
    var plain = steps[0].type === 'generate' && !style.hidden.length &&
        steps.slice(1).every(function (s) {return s.type === 'setStyle'});
    if (plain) {
        var query = new URLSearchParams({seed: steps[0].seed});
        var params = steps[0].args.params || {};
        Object.keys(PARAMS).forEach(function (key) {
            if (params[key] != null && params[key] !== defaultParams[key]) query.set(PARAMS[key], params[key]);
        });
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
    var params = {};
    Object.keys(PARAMS).forEach(function (key) {
        var n = parseInt(query.get(PARAMS[key]), 10);
        if (n >= 0) params[key] = n;
    });
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
