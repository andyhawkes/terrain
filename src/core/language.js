// Place-name generation, from https://github.com/mewo2/naming-language/
import {random, choose, randrange, shuffled} from './random.js';
import {hasWordNames, makeWordName} from './wordnames.js';

function join(list, sep) {
    if (list.length == 0) return '';
    sep = sep || '';
    var s = list[0];
    for (var i = 1; i < list.length; i++) {
        s += sep;
        s += list[i];
    }
    return s;
}

function capitalize(word) {
    return word[0].toUpperCase() + word.slice(1);
}

function spell(lang, syll) {
    if (lang.noortho) return syll;
    var s = '';
    for (var i = 0; i < syll.length; i++) {
        var c = syll[i];
        s += lang.cortho[c] || lang.vortho[c] || defaultOrtho[c] || c;
    }
    return s;
}

function makeSyllable(lang) {
    while (true) {
        var syll = "";
        for (var i = 0; i < lang.structure.length; i++) {
            var ptype = lang.structure[i];
            if (lang.structure[i+1] == '?') {
                i++;
                if (random() < 0.5) {
                    continue;
                }
            }
            syll += choose(lang.phonemes[ptype], lang.exponent);
        }
        var bad = false;
        for (var i = 0; i < lang.restricts.length; i++) {
            if (lang.restricts[i].test(syll)) {
                bad = true;
                break;
            }
        }
        if (bad) continue;
        return spell(lang, syll);
    }
}

function getMorpheme(lang, key) {
    if (lang.nomorph) {
        return makeSyllable(lang);
    }
    key = key || '';
    var list = lang.morphemes[key] || [];
    var extras = 10;
    if (key) extras = 1;
    while (true) {
        var n = randrange(list.length + extras);
        if (list[n]) return list[n];
        var morph = makeSyllable(lang);
        var bad = false;
        for (var k in lang.morphemes) {
            if (lang.morphemes[k].includes(morph)) {
                bad = true;
                break;
            }
        }
        if (bad) continue;
        list.push(morph);
        lang.morphemes[key] = list;
        return morph;
    }
}

function makeWord(lang, key) {
    var nsylls = randrange(lang.minsyll, lang.maxsyll + 1);
    var w = '';
    var keys = [];
    keys[randrange(nsylls)] = key;
    for (var i = 0; i < nsylls; i++) {
        w += getMorpheme(lang, keys[i]);
    }
    return w;
}

function getWord(lang, key) {
    key = key || '';
    var ws = lang.words[key] || [];
    var extras = 3;
    if (key) extras = 2;
    while (true) {
        var n = randrange(ws.length + extras);
        var w = ws[n];
        if (w) {
            return w;
        }
        w = makeWord(lang, key);
        var bad = false;
        for (var k in lang.words) {
            if (lang.words[k].includes(w)) {
                bad = true;
                break;
            }
        }
        if (bad) continue;
        ws.push(w);
        lang.words[key] = ws;
        return w;
    }
}
// setting is where the place is, for word-list names (see makeWordName)
export function makeName(lang, key, setting) {
    if (lang.wordStyle) return makeWordName(lang, key, setting);
    key = key || '';
    lang.genitive = lang.genitive || getMorpheme(lang, 'of');
    lang.definite = lang.definite || getMorpheme(lang, 'the');
    while (true) {
        var name = null;
        if (random() < 0.5) {
            name = capitalize(getWord(lang, key));
        } else {
            var w1 = capitalize(getWord(lang, random() < 0.6 ? key : ''));
            var w2 = capitalize(getWord(lang, random() < 0.6 ? key : ''));
            if (w1 == w2) continue;
            if (random() > 0.5) {
                name = join([w1, w2], lang.joiner);
            } else {
                name = join([w1, lang.genitive, w2], lang.joiner);
            }
        }
        if (random() < 0.1) {
            name = join([lang.definite, name], lang.joiner);
        }

        if ((name.length < lang.minchar) || (name.length > lang.maxchar)) continue;
        var used = false;
        for (var i = 0; i < lang.names.length; i++) {
            var name2 = lang.names[i];
            if ((name.indexOf(name2) != -1) || (name2.indexOf(name) != -1)) {
                used = true;
                break;
            }
        }
        if (used) continue;
        lang.names.push(name);
        return name;
    }
}

function makeBasicLanguage() {
    return {
        phonemes: {
            C: "ptkmnls",
            V: "aeiou",
            S: "s",
            F: "mn",
            L: "rl"
        },
        structure: "CVC",
        exponent: 2,
        restricts: [],
        cortho: {},
        vortho: {},
        noortho: true,
        nomorph: true,
        nowordpool: true,
        minsyll: 1,
        maxsyll: 1,
        morphemes: {},
        words: {},
        names: [],
        joiner: ' ',
        maxchar: 12,
        minchar: 5
    };
}

function makeOrthoLanguage() {
    var lang = makeBasicLanguage();
    lang.noortho = false;
    return lang;
}

function makeRandomLanguage() {
    var lang = makeBasicLanguage();
    lang.noortho = false;
    lang.nomorph = false;
    lang.nowordpool = false;
    lang.phonemes.C = shuffled(choose(consets, 2).C);
    lang.phonemes.V = shuffled(choose(vowsets, 2).V);
    lang.phonemes.L = shuffled(choose(lsets, 2).L);
    lang.phonemes.S = shuffled(choose(ssets, 2).S);
    lang.phonemes.F = shuffled(choose(fsets, 2).F);
    lang.structure = choose(syllstructs);
    lang.restricts = ressets[2].res;
    lang.cortho = choose(corthsets, 2).orth;
    lang.vortho = choose(vorthsets, 2).orth;
    lang.minsyll = randrange(1, 3);
    if (lang.structure.length < 3) lang.minsyll++;
    lang.maxsyll = randrange(lang.minsyll + 1, 7);
    lang.joiner = choose("' ~ - · ");
    return lang;
}
// Named languages for place names. Each fixes the sounds and spelling;
// anything it leaves out is chosen at random, as for "random". Fields:
// C, V, L, S, F: sound sets (letters, or IPA spelled out by the orthography)
// structure: syllable shape; cortho/vortho: spelling set names; restricts:
// index into ressets; minsyll/maxsyll: syllables per word; joiner: between words
export var LANGUAGES = [
    {id: 'random', name: 'Random', hint: 'A new made-up language for each map'},
    {id: 'plain', name: 'Plain', hint: 'Short, simple names',
        C: 'ptkbdgmnlrsvw', V: 'aeiou', structure: 'CVC?', cortho: 'Default', vortho: 'Ácutes',
        minsyll: 2, maxsyll: 3, joiner: ' '},
    {id: 'english', name: 'English-ish', C: 'ptkbdgmnlrsʃʧwh', V: 'aeiou', L: 'rl',
        structure: 'C?L?VC', cortho: 'Default', vortho: 'Ácutes', minsyll: 1, maxsyll: 2, joiner: ' '},
    {id: 'germanic', name: 'Germanic', C: 'ptkbdgmnlrsʃʧxvh', V: 'aeiouAOU', L: 'r',
        structure: 'C?L?VC', cortho: 'German', vortho: 'Ümlauts', minsyll: 1, maxsyll: 3, joiner: '-'},
    {id: 'slavic', name: 'Slavic', C: 'ptkbdgmnlrszʃʒʧv', V: 'aeiou', L: 'r',
        structure: 'CL?VC', cortho: 'Slavic', vortho: 'Ácutes', minsyll: 2, maxsyll: 4, joiner: ' '},
    {id: 'french', name: 'French-ish', C: 'ptkbdgmnlrsʃʒv', V: 'aeiouAEI', L: 'rl',
        structure: 'CVC?', cortho: 'French', vortho: 'Ácutes', minsyll: 2, maxsyll: 3, joiner: '-'},
    {id: 'welsh', name: 'Welsh-ish', C: 'ptkbdgmnlrsʃʧ', V: 'aeiouAEIOU', L: 'rl', F: 'mnŋ',
        structure: 'CVF?', cortho: 'Default', vortho: 'Welsh', minsyll: 2, maxsyll: 4, joiner: ' '},
    {id: 'island', name: 'Hawaiian-ish', hint: 'Soft, open syllables', C: 'hklmnpwʔ', V: 'aeiou',
        structure: 'CV', cortho: 'Default', vortho: 'Ácutes', minsyll: 2, maxsyll: 5, joiner: '-'},
    {id: 'arctic', name: 'Greenlandic-ish', C: 'ptkqvsgrmnŋlj', V: 'aiu', F: 'sk',
        structure: 'CVF?', cortho: 'Default', vortho: 'Doubles', minsyll: 2, maxsyll: 4, joiner: ' '},
    {id: 'desert', name: 'Arabic-ish', C: 'tksʃdbqɣxmnlrwj', V: 'aiuAI', L: 'wj',
        structure: 'CVC', cortho: 'Default', vortho: 'Ácutes', minsyll: 1, maxsyll: 3, joiner: ' '},
    // Names from English word lists (see wordnames.js), not made-up sounds
    {id: 'pirate', name: 'Pirate names', hint: 'Port Blackwater, Dead Man\'s Cove, the Bone Isles', words: true},
    {id: 'military', name: 'Military codenames', hint: 'Objective Granite, Hill 312, Sector Kilo', words: true},
    {id: 'shire', name: 'Shire names', hint: 'Bramblecombe, Little Thistleby, the Barley Downs', words: true},
    {id: 'realm', name: 'Kingdom names', hint: 'Stormhold, Ravenwatch Keep, the Frozen Marches', words: true}
];

function byName(sets, name) {
    return sets.find(function (s) {return s.name === name});
}

// A language by id (see LANGUAGES); unknown ids give a random one
export function makeLanguage(id) {
    var preset = LANGUAGES.find(function (l) {return l.id === id});
    if (!preset || preset.id === 'random') return makeRandomLanguage();
    if (preset.words && hasWordNames(preset.id)) return {wordStyle: preset.id, names: []};
    var lang = makeBasicLanguage();
    lang.noortho = false;
    lang.nomorph = false;
    lang.nowordpool = false;
    lang.phonemes.C = shuffled(preset.C || choose(consets, 2).C);
    lang.phonemes.V = shuffled(preset.V || choose(vowsets, 2).V);
    lang.phonemes.L = shuffled(preset.L || choose(lsets, 2).L);
    lang.phonemes.S = shuffled(preset.S || choose(ssets, 2).S);
    lang.phonemes.F = shuffled(preset.F || choose(fsets, 2).F);
    lang.structure = preset.structure || choose(syllstructs);
    lang.restricts = ressets[preset.restricts == null ? 2 : preset.restricts].res;
    lang.cortho = (preset.cortho ? byName(corthsets, preset.cortho) : choose(corthsets, 2)).orth;
    lang.vortho = (preset.vortho ? byName(vorthsets, preset.vortho) : choose(vorthsets, 2)).orth;
    lang.minsyll = preset.minsyll || randrange(1, 3);
    lang.maxsyll = preset.maxsyll || randrange(lang.minsyll + 1, 7);
    lang.joiner = preset.joiner || choose("' ~ - · ");
    return lang;
}

var defaultOrtho = {
    'ʃ': 'sh',
    'ʒ': 'zh',
    'ʧ': 'ch',
    'ʤ': 'j',
    'ŋ': 'ng',
    'j': 'y',
    'x': 'kh',
    'ɣ': 'gh',
    'ʔ': '‘',
    A: "á",
    E: "é",
    I: "í",
    O: "ó",
    U: "ú"
};

var corthsets = [
    {
        name: "Default",
        orth: {}
    },
    {
        name: "Slavic",
        orth: {
            'ʃ': 'š',
            'ʒ': 'ž',
            'ʧ': 'č',
            'ʤ': 'ǧ',
            'j': 'j'
        }
    },
    {
        name: "German",
        orth: {
            'ʃ': 'sch',
            'ʒ': 'zh',
            'ʧ': 'tsch',
            'ʤ': 'dz',
            'j': 'j',
            'x': 'ch'
        }
    },
    {
        name: "French",
        orth: {
            'ʃ': 'ch',
            'ʒ': 'j',
            'ʧ': 'tch',
            'ʤ': 'dj',
            'x': 'kh'
        }
    },
    {
        name: "Chinese (pinyin)",
        orth: {
            'ʃ': 'x',
            'ʧ': 'q',
            'ʤ': 'j',
        }
    }
];

var vorthsets = [
    {
        name: "Ácutes",
        orth: {}
    },
    {
        name: "Ümlauts",
        orth: {
            A: "ä",
            E: "ë",
            I: "ï",
            O: "ö",
            U: "ü"
        }
    },
    {
        name: "Welsh",
        orth: {
            A: "â",
            E: "ê",
            I: "y",
            O: "ô",
            U: "w"
        }
    },
    {
        name: "Diphthongs",
        orth: {
            A: "au",
            E: "ei",
            I: "ie",
            O: "ou",
            U: "oo"
        }
    },
    {
        name: "Doubles",
        orth: {
            A: "aa",
            E: "ee",
            I: "ii",
            O: "oo",
            U: "uu"
        }
    }
];

var consets = [
    {
        name: "Minimal",
        C: "ptkmnls"
    },
    {
        name: "English-ish",
        C: "ptkbdgmnlrsʃzʒʧ"
    },
    {
        name: "Pirahã (very simple)",
        C: "ptkmnh"
    },
    {
        name: "Hawaiian-ish",
        C: "hklmnpwʔ"
    },
    {
        name: "Greenlandic-ish",
        C: "ptkqvsgrmnŋlj"
    },
    {
        name: "Arabic-ish",
        C: "tksʃdbqɣxmnlrwj"
    },
    {
        name: "Arabic-lite",
        C: "tkdgmnsʃ"
    },
    {
        name: "English-lite",
        C: "ptkbdgmnszʒʧhjw"
    }
];

var ssets = [
    {
        name: "Just s",
        S: "s"
    },
    {
        name: "s ʃ",
        S: "sʃ"
    },
    {
        name: "s ʃ f",
        S: "sʃf"
    }
];

var lsets = [
    {
        name: "r l",
        L: "rl"
    },
    {
        name: "Just r",
        L: "r"
    },
    {
        name: "Just l",
        L: "l"
    },
    {
        name: "w j",
        L: "wj"
    },
    {
        name: "r l w j",
        L: "rlwj"
    }
];

var fsets = [
    {
        name: "m n",
        F: "mn"
    },
    {
        name: "s k",
        F: "sk"
    },
    {
        name: "m n ŋ",
        F: "mnŋ"
    },
    {
        name: "s ʃ z ʒ",
        F: "sʃzʒ"
    }
];

var vowsets = [
    {
        name: "Standard 5-vowel",
        V: "aeiou"
    },
    {
        name: "3-vowel a i u",
        V: "aiu"
    },
    {
        name: "Extra A E I",
        V: "aeiouAEI"
    },
    {
        name: "Extra U",
        V: "aeiouU"
    },
    {
        name: "5-vowel a i u A I",
        V: "aiuAI"
    },
    {
        name: "3-vowel e o u",
        V: "eou"
    },
    {
        name: "Extra A O U",
        V: "aeiouAOU"
    }
];

var syllstructs = [
    "CVC",
    "CVV?C",
    "CVVC?", "CVC?", "CV", "VC", "CVF", "C?VC", "CVF?",
    "CL?VC", "CL?VF", "S?CVC", "S?CVF", "S?CVC?",
    "C?VF", "C?VC?", "C?VF?", "C?L?VC", "VC",
    "CVL?C?", "C?VL?C", "C?VLC?"];

var ressets = [
    {
        name: "None",
        res: []
    },
    {
        name: "Double sounds",
        res: [/(.)\1/]
    },
    {
        name: "Doubles and hard clusters",
        res: [/[sʃf][sʃ]/, /(.)\1/, /[rl][rl]/]
    }
];

