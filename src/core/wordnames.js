// Place names made from English word lists and patterns, rather than the
// made-up languages in language.js: pirate names and military codenames.
// Each style has patterns for towns ('city') and for regions; a pattern is
// a function that picks words with the seeded random functions. Patterns
// marked with coast() or water() only name towns in those settings.
import {choose, randrange} from './random.js';

var PIRATE = {
    adjectives: ['Black', 'Red', 'Dead', 'Rum', 'Bloody', 'Grim', 'Salt', 'Rotten', 'Gold', 'Silver',
        'Hollow', 'Broken', 'Drowned', 'Lucky', 'Crooked', 'Ghost', 'Bone', 'Iron', 'Sunken', 'Howling',
        'Smugglers\'', 'Cursed', 'Thieves\'', 'Hangman\'s', 'Scurvy'],
    things: ['Skull', 'Cutlass', 'Anchor', 'Gallows', 'Parrot', 'Kraken', 'Doubloon', 'Powder', 'Keel',
        'Gull', 'Barnacle', 'Bilge', 'Lantern', 'Plank', 'Shark', 'Serpent', 'Crow', 'Cannon', 'Compass',
        'Mermaid', 'Lobster', 'Turtle', 'Pelican', 'Tortoise'],
    // Places on the sea, on a river, and anywhere
    shores: ['Cove', 'Bay', 'Point', 'Key', 'Inlet', 'Sands', 'Shoals', 'Lagoon'],
    harbours: ['Harbour', 'Landing', 'Haven', 'Wharf', 'Creek', 'Quay'],
    towns: ['Rock', 'Hollow', 'Hideout', 'Lookout', 'Gulch', 'Den', 'Crossing', 'Rest'],
    owners: ['Dead Man\'s', 'Mad Jack\'s', 'Old Peg\'s', 'Captain Crow\'s', 'the Widow\'s', 'the Admiral\'s',
        'One-Eye\'s', 'Long Tom\'s', 'Black Sal\'s', 'the Bosun\'s', 'Lady Grey\'s', 'Jolly Ned\'s'],
    // For "Port Blackwater" and the like
    starts: ['Black', 'Red', 'Salt', 'Gold', 'Silver', 'Rum', 'Grim', 'Iron', 'Bone', 'Grey', 'Gull', 'Dead',
        'Crook', 'Storm', 'Wreck'],
    endings: ['water', 'wick', 'haven', 'reef', 'mouth', 'brook', 'marsh', 'gate', 'tide', 'hollow'],
    regions: ['Isles', 'Coast', 'Reach', 'Shallows', 'Keys', 'Archipelago', 'Banks', 'Straits', 'Shore',
        'Islands', 'Waters', 'Main']
};

var MILITARY = {
    codewords: ['Granite', 'Anvil', 'Falcon', 'Viper', 'Hammer', 'Iron', 'Cobalt', 'Raven', 'Thunder',
        'Summit', 'Badger', 'Bastion', 'Copper', 'Dagger', 'Ember', 'Flint', 'Glacier', 'Harrier',
        'Jackal', 'Kestrel', 'Lancer', 'Mantis', 'Nomad', 'Onyx', 'Phoenix', 'Quarry', 'Rampart',
        'Sabre', 'Talon', 'Vanguard', 'Warden', 'Zephyr', 'Basalt', 'Cinder', 'Gauntlet', 'Hornet'],
    alphabet: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India',
        'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra',
        'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'],
    sites: ['Objective', 'Camp', 'FOB', 'Firebase', 'LZ', 'Outpost', 'Depot'],
    areas: ['Sector', 'Zone', 'Area', 'District']
};

// English village names, the gentle storybook kind
var SHIRE = {
    firsts: ['Bramble', 'Thistle', 'Bracken', 'Clover', 'Honey', 'Apple', 'Barley', 'Mossy', 'Puddle',
        'Nettle', 'Badger', 'Otter', 'Fern', 'Hazel', 'Burrow', 'Sorrel', 'Teasel', 'Mallow', 'Tansy',
        'Cob', 'Mill', 'Brook', 'Oak', 'Ash', 'Elder', 'Rowan', 'Tumble', 'Sunny', 'Chestnut', 'Bumble',
        'Mole', 'Wren', 'Thrush', 'Fox', 'Crab', 'Plum', 'Pudding', 'Butter', 'Cherry', 'Hedge', 'Dimble'],
    endings: ['bottom', 'by', 'combe', 'ford', 'hollow', 'bury', 'wich', 'well', 'dale', 'ley', 'stead',
        'worth', 'wick', 'thorpe', 'field', 'mead', 'burrow', 'end', 'cote', 'den', 'hay', 'brook'],
    villageWords: ['Green', 'Cross', 'End', 'Mill', 'Bridge', 'Hill'],
    sizes: ['Little', 'Great', 'Nether', 'Upper', 'Lower', 'Long', 'Old'],
    regionAdjectives: ['Green', 'Far', 'Long', 'White', 'Golden', 'Barley', 'Bramble', 'Hazel', 'Sunny',
        'Quiet', 'Hollow', 'Rolling', 'Misty', 'Thistle', 'Apple'],
    regionWords: ['Downs', 'Wolds', 'Fields', 'Hills', 'Marsh', 'Vale', 'Dales', 'Meads', 'Woods', 'Heath', 'Leas'],
    // Tolkien's own places, which aren't ours to use
    avoid: ['Hobbiton', 'Bywater', 'Tuckborough', 'Michel Delving', 'Frogmorton', 'Waymeet', 'Overhill',
        'Underhill', 'Bucklebury', 'Crickhollow', 'Stock', 'Bree', 'Buckland', 'Longbottom', 'Hardbottle',
        'Needlehole', 'Nobottle', 'Greenholm', 'Whitfurrows', 'Little Delving', 'Budgeford', 'Oatbarton',
        'Deephallow', 'Rushey', 'Willowbottom', 'Pincup', 'Long Cleeve', 'Tighfield', 'Bindbole',
        'Woody End', 'The White Downs', 'The Far Downs', 'The Green Hills']
};

// A first part and an ending that sit well together: no "Brambleend" or
// "Brookbrook"
function village() {
    for (;;) {
        var first = choose(SHIRE.firsts);
        var ending = choose(SHIRE.endings);
        var clash = first.slice(-1) === ending[0] || first.toLowerCase().indexOf(ending) >= 0;
        if (!clash) return first + ending;
    }
}

// Castles and kingdoms: hard, old compounds
var REALM = {
    firsts: ['Storm', 'Iron', 'Winter', 'High', 'Red', 'Raven', 'Eagle', 'Grey', 'Black', 'Wolf', 'Dragon',
        'Sun', 'Frost', 'Thorn', 'Bitter', 'Salt', 'Stone', 'Silver', 'Gold', 'Night', 'Ash', 'Bone',
        'Bright', 'Dusk', 'Ember', 'Crow', 'Hawk', 'Blood', 'Shadow', 'Wind', 'Cold', 'Gull', 'Oak', 'Rose'],
    seconds: ['hold', 'fell', 'watch', 'keep', 'garden', 'gate', 'rock', 'spire', 'reach',
        'crag', 'march', 'wall', 'holt', 'burgh', 'mark', 'tor', 'hall', 'moor', 'hollow'],
    // For towns on the sea or a river
    waterSeconds: ['haven', 'mere', 'ford', 'bridge', 'mouth'],
    keeps: ['Keep', 'Hall', 'Tower', 'Castle', 'Fort', 'Watch'],
    adjectives: ['Broken', 'Frozen', 'Sunken', 'Burning', 'Silent', 'Golden', 'Iron', 'Red', 'Black', 'Grey',
        'Shattered', 'Crimson', 'Hollow', 'Bitter', 'Western', 'Eastern', 'Northern', 'Southern'],
    lands: ['Reach', 'Marches', 'Wastes', 'Vale', 'Isles', 'Coast', 'Mountains', 'Moors', 'Barrens', 'Fens',
        'Kingdom', 'Dominion', 'Wilds', 'Downs'],
    // Places from the books and the show, which aren't ours to use
    avoid: ['Winterfell', 'Casterly Rock', 'Riverrun', 'Highgarden', "Storm's End", "King's Landing",
        'Dragonstone', 'Sunspear', 'The Eyrie', 'Pyke', 'Harrenhal', 'Oldtown', 'Lannisport', 'White Harbor',
        'Moat Cailin', 'The Dreadfort', 'Castle Black', 'Eastwatch', 'Bear Island', 'Deepwood Motte',
        'Last Hearth', 'Karhold', 'Starfall', 'Horn Hill', 'Hightower', 'Greywater Watch', 'Seagard',
        'The Twins', 'Brightwater Keep', 'Ashford', 'Bitterbridge', 'Raventree Hall', 'Stoney Sept',
        'Oldstones', 'Stormlands', 'The Stormlands', 'Westerlands', 'The Westerlands', 'The Reach',
        'The Vale', 'Riverlands', 'The Riverlands', 'Crownlands', 'The Crownlands', 'Iron Islands',
        'The Iron Islands', 'Dorne', 'Westeros', 'Essos', 'The North', 'Nightfort', 'Shadow Tower',
        'Ironrath', 'Goldengrove', 'Crakehall', 'Blackhaven', 'Stonehelm', 'Griffin\'s Roost', 'Evenfall Hall',
        'Ironoaks', 'Redfort', 'Gulltown', 'Wolfswood', 'Frostfangs', 'Oxcross', 'Silverhill', 'Goldtooth']
};

// Marks a pattern as only for towns beside the sea, or beside the sea or a
// river (see placeSetting in terrain.js)
function coast(pattern) {
    pattern.fits = ['coast'];
    return pattern;
}

function water(pattern) {
    pattern.fits = ['coast', 'river'];
    return pattern;
}

var STYLES = {
    pirate: {
        city: [
            water(function () {return 'Port ' + choose(PIRATE.starts) + choose(PIRATE.endings)}),
            coast(function () {return choose(PIRATE.things) + ' ' + choose(PIRATE.shores)}),
            coast(function () {return choose(PIRATE.adjectives) + ' ' + choose(PIRATE.shores)}),
            water(function () {return choose(PIRATE.owners) + ' ' + choose(PIRATE.harbours)}),
            water(function () {return choose(PIRATE.adjectives) + ' ' + choose(PIRATE.harbours)}),
            function () {return choose(PIRATE.things) + ' ' + choose(PIRATE.towns)},
            function () {return choose(PIRATE.owners) + ' ' + choose(PIRATE.towns)},
            function () {return choose(PIRATE.adjectives) + ' ' + choose(PIRATE.towns)}
        ],
        region: [
            function () {return 'The ' + choose(PIRATE.adjectives) + ' ' + choose(PIRATE.regions)},
            function () {return choose(PIRATE.things) + ' ' + choose(PIRATE.regions)},
            function () {return choose(PIRATE.owners) + ' ' + choose(PIRATE.regions)}
        ]
    },
    shire: {
        city: [
            village,
            village,
            village,
            village,
            function () {return choose(SHIRE.sizes) + ' ' + village()},
            function () {return choose(SHIRE.sizes) + ' ' + village()},
            function () {return village() + ' ' + choose(SHIRE.villageWords)},
            function () {return village() + '-under-Hill'}
        ],
        region: [
            function () {return 'The ' + choose(SHIRE.regionAdjectives) + ' ' + choose(SHIRE.regionWords)},
            function () {return village() + ' ' + choose(SHIRE.regionWords)},
            function () {return choose(SHIRE.firsts) + 'shire'}
        ],
        avoid: SHIRE.avoid
    },
    realm: {
        city: [
            function () {return choose(REALM.firsts) + choose(REALM.seconds)},
            function () {return choose(REALM.firsts) + choose(REALM.seconds)},
            water(function () {return choose(REALM.firsts) + choose(REALM.waterSeconds)}),
            function () {return choose(REALM.firsts) + choose(REALM.seconds) + ' ' + choose(REALM.keeps)},
            function () {return choose(REALM.firsts) + "'s " + choose(['End', 'Rest', 'Watch', 'Gate'])}
        ],
        region: [
            function () {return 'The ' + choose(REALM.adjectives) + ' ' + choose(REALM.lands)},
            function () {return 'The ' + choose(REALM.firsts) + 'lands'},
            function () {return choose(REALM.firsts) + choose(REALM.seconds) + ' ' + choose(['Vale', 'Reach', 'Marches'])}
        ],
        avoid: REALM.avoid
    },
    military: {
        city: [
            function () {return choose(MILITARY.sites) + ' ' + choose(MILITARY.codewords)},
            function () {return 'Hill ' + randrange(100, 1000)},
            function () {return 'Checkpoint ' + choose(MILITARY.alphabet)},
            function () {return 'Objective ' + choose(MILITARY.codewords)}
        ],
        region: [
            function () {return choose(MILITARY.areas) + ' ' + choose(MILITARY.alphabet)},
            function () {return 'Zone ' + choose(MILITARY.codewords)}
        ]
    }
};

// "the Widow's Cove" starts a name as "The Widow's Cove"
function capitalized(name) {
    return name[0].toUpperCase() + name.slice(1);
}

export function hasWordNames(id) {
    return !!STYLES[id];
}

// A new name in a style that hasn't been used yet (lang.names lists those
// that have). key is 'city' or 'region'; setting, if given, is where the
// place is ('coast', 'river' or 'inland'), and leaves out patterns that
// don't fit it.
export function makeWordName(lang, key, setting) {
    var patterns = STYLES[lang.wordStyle][key === 'region' ? 'region' : 'city'].filter(function (p) {
        return !setting || !p.fits || p.fits.indexOf(setting) >= 0;
    });
    for (var tries = 0; tries < 200; tries++) {
        var name = capitalized(choose(patterns)());
        var avoid = STYLES[lang.wordStyle].avoid || [];
        if (lang.names.indexOf(name) < 0 && avoid.indexOf(name) < 0) {
            lang.names.push(name);
            return name;
        }
    }
    // Every combination tried is taken: number one
    var base = capitalized(choose(patterns)());
    for (var n = 2; lang.names.indexOf(base + ' ' + n) >= 0; n++);
    lang.names.push(base + ' ' + n);
    return base + ' ' + n;
}
