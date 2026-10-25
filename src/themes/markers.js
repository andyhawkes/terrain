// Marker shapes shared by the themes, one per marker type (see MARKER_TYPES
// in core/steps.js). All are open strokes drawn around (0, 0), so they work
// for pen plotters too. A theme wraps them with markerSymbols() and styles
// the class it gives them.

export var MARKER_SHAPES = {
    x: 'M-11,-11 L11,11 M11,-11 L-11,11',
    danger: 'M-8,0 C-10,-12 10,-12 8,0 L5,3 L5,6 L-5,6 L-5,3 Z ' +
        'M-4.5,-3 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0 M0.5,-3 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0 ' +
        'M-12,8 L12,15 M12,8 L-12,15',
    flag: 'M-6,13 L-6,-13 M-6,-13 L11,-7 L-6,-1',
    camp: 'M-13,10 L0,-11 L13,10 Z M-4,10 L0,3 L4,10',
    star: 'M0,-13 L3.8,-3.8 13,-3.8 5.5,2.2 8.2,12 0,6 -8.2,12 -5.5,2.2 -13,-3.8 -3.8,-3.8 Z'
};

// Symbol specs for every marker type. cls is the part style each shape gets
// (xCls for the X, if different); overrides replaces whole specs.
export function markerSymbols(cls, overrides, xCls) {
    var specs = {};
    Object.keys(MARKER_SHAPES).forEach(function (type) {
        specs[type] = {kind: 'path', transform: 'scale(1.5)',
            variants: [[{d: MARKER_SHAPES[type], cls: type === 'x' && xCls ? xCls : cls}]]};
    });
    return Object.assign(specs, overrides);
}
