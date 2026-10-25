// Map themes. A theme is plain data describing how a map is drawn; see
// simple.js for a commented example of every field. Adding a theme means
// adding a file here, not changing the renderer.
import simple from './simple.js';
import lovecraftian from './lovecraftian.js';
import plotter from './plotter.js';

export var THEMES = [simple, lovecraftian, plotter];

export var DEFAULT_THEME = 'simple';

export function getTheme(id) {
    return THEMES.find(function (t) {return t.id === id}) || THEMES[0];
}

// The theme's font choice and background, resolving defaults
export function fontChoice(theme, style) {
    return theme.fonts.find(function (f) {return f.id === style.font}) || theme.fonts[0];
}

export function backgroundChoice(theme, style) {
    return theme.backgrounds.find(function (b) {return b.id === style.background}) || theme.backgrounds[0];
}
