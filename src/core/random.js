// Seeded randomness. Core code calls random()/runif()/rnorm() etc., which draw
// from the "current" generator. Steps wrap their work in withSeed() so the
// same seed always reproduces the same result.

function hashSeed(seed) {
    // xmur3 string hash -> 32-bit unsigned int
    var str = String(seed);
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
}

function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeContext(next) {
    return {next: next, z2: null};
}

// Unseeded fallback, so code called outside withSeed() still works.
var current = makeContext(Math.random);

export function withSeed(seed, fn) {
    var prev = current;
    current = makeContext(mulberry32(hashSeed(seed)));
    try {
        return fn();
    } finally {
        current = prev;
    }
}

// "today" stands for today's date, so everyone gets the same map of the day
export function resolveSeed(seed, date) {
    if (String(seed).trim().toLowerCase() !== 'today') return seed;
    var d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// A fresh, unpredictable seed for steps the user didn't seed themselves.
export function newSeed() {
    return Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
}

export function random() {
    return current.next();
}

export function runif(lo, hi) {
    return lo + random() * (hi - lo);
}

export function rnorm() {
    if (current.z2 != null) {
        var tmp = current.z2;
        current.z2 = null;
        return tmp;
    }
    var x1 = 0;
    var x2 = 0;
    var w = 2.0;
    while (w >= 1) {
        x1 = runif(-1, 1);
        x2 = runif(-1, 1);
        w = x1 * x1 + x2 * x2;
    }
    w = Math.sqrt(-2 * Math.log(w) / w);
    current.z2 = x2 * w;
    return x1 * w;
}

export function randomVector(scale) {
    return [scale * rnorm(), scale * rnorm()];
}

export function randrange(lo, hi) {
    if (hi == undefined) {
        hi = lo;
        lo = 0;
    }
    return Math.floor(random() * (hi - lo)) + lo;
}

export function choose(list, exponent) {
    exponent = exponent || 1;
    return list[Math.floor(Math.pow(random(), exponent) * list.length)];
}

export function shuffled(list) {
    var newlist = [];
    for (var i = 0; i < list.length; i++) {
        newlist.push(list[i]);
    }
    for (var i = list.length - 1; i > 0; i--) {
        var tmp = newlist[i];
        var j = randrange(i);
        newlist[i] = newlist[j];
        newlist[j] = tmp;
    }
    return newlist;
}
