// Map themes. A theme is plain data describing how a map is drawn; see
// simple.js for a commented example of every field. Adding a theme means
// adding a file here, not changing the renderer.
import simple from './simple.js';
import fantasy from './fantasy.js';
import plotter from './plotter.js';
import pirate from './pirate.js';
import military from './military.js';
import underhill from './underhill.js';
import throneish from './throneish.js';

export var THEMES = [simple, fantasy, pirate, military, underhill, throneish, plotter];

// Old theme ids, so earlier map files still open with the right look
var RENAMED = {lovecraftian: 'fantasy'};

export var DEFAULT_THEME = 'simple';

export function getTheme(id) {
    id = RENAMED[id] || id;
    return THEMES.find(function (t) {return t.id === id}) || THEMES[0];
}

// The theme's font choice and background, resolving defaults
export function fontChoice(theme, style) {
    return theme.fonts.find(function (f) {return f.id === style.font}) || theme.fonts[0];
}

export function backgroundChoice(theme, style) {
    return theme.backgrounds.find(function (b) {return b.id === style.background}) || theme.backgrounds[0];
}

// --- Lettering roles ---
// Each kind of text on the map has its own font, size, case and spacing.
// The theme's chosen preset (theme.fonts) gives the defaults: regions and
// the title take its region font, the rest its label font. style.type holds
// only what has been changed, e.g. {town: {size: 'large'}}.
export var ROLES = [
    {id: 'region', name: 'Regions', from: 'region'},
    {id: 'capital', name: 'Capitals', from: 'label'},
    {id: 'town', name: 'Towns', from: 'label'},
    {id: 'note', name: 'Your text', from: 'label'},
    {id: 'title', name: 'Title', from: 'region'},
    {id: 'grid', name: 'Grid labels', from: 'label'},
    {id: 'scale', name: 'Scale bar', from: 'label'},
    {id: 'legendTitle', name: 'Legend title', from: 'region'},
    {id: 'legend', name: 'Legend entries', from: 'label'}
];

export var TYPE_SIZES = [
    {id: 'small', name: 'Small', scale: 0.8},
    {id: 'medium', name: 'Medium', scale: 1},
    {id: 'large', name: 'Large', scale: 1.25},
    {id: 'larger', name: 'Extra large', scale: 1.6}
];

export var TYPE_CASES = [
    {id: 'normal', name: 'As written'},
    {id: 'upper', name: 'Capitals'},
    {id: 'small-caps', name: 'Small capitals'}
];

export var TYPE_SPACINGS = [
    {id: 'normal', name: 'None'},
    {id: '0.05em', name: 'Slight'},
    {id: '0.1em', name: 'Wide'},
    {id: '0.2em', name: 'Wider'}
];

function familyId(family) {
    return typeof family === 'string' ? family.split(',')[0].replace(/["']/g, '').trim() : 'hershey-' + family.hershey;
}

function sameFamily(a, b) {
    return familyId(a) === familyId(b);
}

// The fonts a theme offers for any role: every family its presets use.
// A family that is a preset on its own takes that preset's name.
export function typefaces(theme) {
    var list = [];
    theme.fonts.forEach(function (preset) {
        [preset.region, preset.label].forEach(function (family) {
            var id = familyId(family);
            if (list.some(function (f) {return f.id === id})) return;
            var own = theme.fonts.find(function (p) {return sameFamily(p.label, family) && sameFamily(p.region, family)});
            list.push({id: id, name: own ? own.name : id, family: family, rise: own && own.rise || 0});
        });
    });
    return list;
}

// How each role is lettered: {family, font, hershey, case, spacing, size,
// scale, rise, inline}. inline holds the CSS that differs from the theme's
// stylesheet, so a map with nothing changed draws exactly as before.
export function typography(theme, style) {
    var preset = fontChoice(theme, style);
    var faces = typefaces(theme);
    var l = theme.labels;
    var chosen = style.type || {};
    var regionCase = (preset.regionCase || l.regionCase) === 'upper' ? 'upper' :
        l.regionVariant === 'small-caps' ? 'small-caps' : 'normal';
    var roles = {};
    ROLES.forEach(function (role) {
        var c = chosen[role.id] || {};
        var region = role.id === 'region';
        var base = faces.find(function (f) {return sameFamily(f.family, preset[role.from])});
        var face = faces.find(function (f) {return f.id === c.font}) || base;
        var hershey = !!face.family.hershey;
        var defaultCase = region ? regionCase : 'normal';
        var defaultSpacing = region ? l.regionSpacing || 'normal' : 'normal';
        var kase = c.case || defaultCase;
        // Single-stroke lettering has no small capitals or spacing
        if (hershey && kase === 'small-caps') kase = 'upper';
        var spacing = hershey ? 'normal' : c.spacing || defaultSpacing;
        var size = TYPE_SIZES.find(function (s) {return s.id === c.size}) || TYPE_SIZES[1];
        var rise = preset.rise || 0;
        var inline = {};
        if (face !== base) inline['font-family'] = face.family;
        if (kase !== defaultCase && (kase === 'small-caps' || defaultCase === 'small-caps')) {
            inline['font-variant'] = kase === 'small-caps' ? 'small-caps' : 'normal';
        }
        if (spacing !== defaultSpacing) inline['letter-spacing'] = spacing;
        if (face.rise !== rise) inline.translate = face.rise ? '0 -' + face.rise + 'em' : 'none';
        roles[role.id] = {family: face.family, font: face.id, hershey: hershey, case: kase, spacing: spacing,
            size: size.id, scale: size.scale, rise: face.rise, inline: inline};
    });
    return roles;
}
