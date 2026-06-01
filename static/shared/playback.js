// ============================================================
// shared/playback.js
// SoundFont-based piano playback. Mode-agnostic: the host wires
// in a getter for the current measures and getters for button labels.
// ============================================================

(function (global) {
    "use strict";

    let _audioContext = null;
    let _pianoPlayer = null;
    let _playTimeoutId = null;
    let _isPlaying = false;

    // Injected by host:
    let _getMeasures = () => [];
    let _getLabel = (key) => key;          // "play_btn" | "play_loading" | "play_stop"
    let _getButton = () => document.getElementById("play-btn");
    let _onError = (msg) => alert(msg);

    function init({ getMeasures, getLabel, getButton, onError } = {}) {
        if (typeof getMeasures === "function") _getMeasures = getMeasures;
        if (typeof getLabel === "function") _getLabel = getLabel;
        if (typeof getButton === "function") _getButton = getButton;
        if (typeof onError === "function") _onError = onError;
    }

    function collectPlayableNotes() {
        const chords = [];
        const measures = _getMeasures();
        for (const m of measures) {
            const notes = [m.S, m.A, m.T, m.B]
                .filter((n) => n && Array.isArray(n))
                .map((n) => n[0]);
            if (notes.length > 0) chords.push(notes);
        }
        return chords;
    }

    async function start() {
        const chords = collectPlayableNotes();
        if (chords.length === 0) return;

        const btn = _getButton();
        if (btn) {
            btn.disabled = true;
            btn.textContent = _getLabel("play_loading");
        }

        if (!_audioContext) {
            _audioContext = new (global.AudioContext || global.webkitAudioContext)();
        }
        await _audioContext.resume();

        const Soundfont = global.Soundfont;
        if (!Soundfont) {
            if (btn) {
                btn.textContent = _getLabel("play_btn");
                btn.disabled = false;
            }
            _onError("Piano library not loaded.");
            return;
        }

        try {
            if (!_pianoPlayer) {
                _pianoPlayer = await Soundfont.instrument(_audioContext, "acoustic_grand_piano", {
                    soundfont: "MusyngKite",
                    nameToUrl: (name) => `/static/vendor/soundfont/${name}-mp3.js`,
                });
            }

            const SEC_PER_MEASURE = 2;
            const now = _audioContext.currentTime;

            for (let i = 0; i < chords.length; i++) {
                const when = now + i * SEC_PER_MEASURE;
                chords[i].forEach((midi) => {
                    _pianoPlayer.play(midi, when, { duration: SEC_PER_MEASURE * 0.85 });
                });
            }

            _isPlaying = true;
            if (btn) {
                btn.textContent = _getLabel("play_stop");
                btn.disabled = false;
            }

            _playTimeoutId = setTimeout(() => {
                _isPlaying = false;
                if (btn) btn.textContent = _getLabel("play_btn");
            }, chords.length * SEC_PER_MEASURE * 1000);
        } catch (err) {
            console.error("Playback error:", err);
            if (btn) {
                btn.textContent = _getLabel("play_btn");
                btn.disabled = false;
            }
        }
    }

    function stop() {
        if (_playTimeoutId) {
            clearTimeout(_playTimeoutId);
            _playTimeoutId = null;
        }
        _isPlaying = false;
        if (_pianoPlayer) _pianoPlayer.stop();
        const btn = _getButton();
        if (btn) btn.textContent = _getLabel("play_btn");
    }

    function toggle() {
        if (_isPlaying) stop();
        else start();
    }

    function isPlaying() {
        return _isPlaying;
    }

    global.Playback = {
        init,
        start,
        stop,
        toggle,
        isPlaying,
    };
})(window);
