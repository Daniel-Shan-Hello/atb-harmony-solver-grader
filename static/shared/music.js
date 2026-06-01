// ============================================================
// shared/music.js
// Pure music-theory constants and pitch math. Zero DOM, zero
// state references — safe to call from anywhere.
// ============================================================

(function (global) {
    "use strict";

    // Circle-of-fifths tonics: index = fifths + 7  (range -7 … +7 → 0 … 14)
    const MAJOR_KEYS = ["Cb","Gb","Db","Ab","Eb","Bb","F","C","G","D","A","E","B","F#","C#"];
    const MINOR_KEYS = ["Ab","Eb","Bb","F","C","G","D","A","E","B","F#","C#","G#","D#","A#"];

    // VexFlow accepts the major-key letter for key signatures.
    function vexKeySignature(fifths) {
        return MAJOR_KEYS[fifths + 7];
    }

    // Order in which key-signature accidentals appear.
    const SHARP_ORDER = ["F","C","G","D","A","E","B"];
    const FLAT_ORDER  = ["B","E","A","D","G","C","F"];

    // Returns a map: letterUpperCase -> accidental offset (-1 or +1)
    function keyAccidentalMap(fifths) {
        const map = {};
        if (fifths > 0) {
            for (let i = 0; i < fifths; i++) map[SHARP_ORDER[i]] = 1;
        } else if (fifths < 0) {
            for (let i = 0; i < -fifths; i++) map[FLAT_ORDER[i]] = -1;
        }
        return map;
    }

    const DIATONIC_LETTERS = ["C","D","E","F","G","A","B"]; // 0-6
    const LETTER_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

    // Given clef and staff-line position (0 = top line, positive = downward),
    // return { letter, octave }.
    function positionToNote(clef, pos) {
        let refLetter, refOctave;
        if (clef === "treble") {
            refLetter = "F"; refOctave = 5; // pos 0 = top line F5
        } else {
            refLetter = "A"; refOctave = 3; // pos 0 = top line A3
        }
        const refIdx = DIATONIC_LETTERS.indexOf(refLetter);
        const refAbsolute = refOctave * 7 + refIdx;
        const newAbsolute = refAbsolute - pos;
        const newOctave = Math.floor(newAbsolute / 7);
        const newIdx = ((newAbsolute % 7) + 7) % 7;
        return { letter: DIATONIC_LETTERS[newIdx], octave: newOctave };
    }

    // letter + octave + accidental -> MIDI pitch
    function toMidi(letter, octave, accidental) {
        return (octave + 1) * 12 + LETTER_TO_SEMITONE[letter] + accidental;
    }

    // Tonic ("C", "F#", "Eb"…) + mode -> fifths (-7 … +7)
    function tonicToFifths(tonic, mode) {
        const arr = mode === "major" ? MAJOR_KEYS : MINOR_KEYS;
        const idx = arr.indexOf(tonic);
        return idx === -1 ? 0 : idx - 7;
    }

    global.Music = {
        MAJOR_KEYS,
        MINOR_KEYS,
        SHARP_ORDER,
        FLAT_ORDER,
        DIATONIC_LETTERS,
        LETTER_TO_SEMITONE,
        vexKeySignature,
        keyAccidentalMap,
        positionToNote,
        toMidi,
        tonicToFifths,
    };
})(window);
