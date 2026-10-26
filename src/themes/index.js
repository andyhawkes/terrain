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
