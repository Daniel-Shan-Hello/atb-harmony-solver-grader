// ============================================================
// shared/score.js
// VexFlow rendering + click/keyboard input + Roman numeral &
// cadence inputs + insert/delete overlay buttons.
//
// Mode-agnostic: behaviour is parameterised through callbacks
// (lock checks, after-edit hooks, label getters, etc.).
// Reads state.measures / state.fifths / state.selectedVoice /
// state.selectedNote / state.eraserMode (all common to both modes).
// ============================================================

(function (global) {
    "use strict";

    if (typeof Vex === "undefined") {
        const c = document.getElementById("score-container");
        if (c) {
            c.textContent =
                "Error: VexFlow library failed to load. Check your network connection.";
        }
        throw new Error("VexFlow not loaded");
    }

    const VF = Vex.Flow;
    const { Renderer, Stave, StaveNote, Voice, Formatter, StaveConnector, Accidental } = VF;
    const Barline = VF.Barline || VF.StaveBarline || { type: { END: 3 } };

    const M = global.Music;

    // ──────────────────────────────────────────────
    // Layout constants (multi-system layout)
    // ──────────────────────────────────────────────
    const STAVE_MIN_WIDTH    = 155;
    const FIRST_STAVE_EXTRA  = 60;
    const STAVE_START_X      = 30;
    const STAVE_START_Y      = 40;
    const TREBLE_BASS_GAP    = 70;
    const BASS_OFFSET        = 140;
    const SYSTEM_SPACING     = 290;
    const RIGHT_PADDING      = 30;
    const SCORE_MAX_WIDTH    = 1100;
    const SVG_BOTTOM_PADDING = 90;

    // ──────────────────────────────────────────────
    // Module state
    // ──────────────────────────────────────────────
    let state = null;
    const callbacks = {
        canEditNote: () => true,
        afterPlaceNote: () => {},
        afterEraseNote: () => {},
        isRomanLocked: () => false,
        isCadenceLocked: () => false,
        getNoteOpts: () => ({ highlight: false, fixed: false }),
        showMeasureControls: () => true,
        onInsertMeasure: () => {},
        onDeleteMeasure: () => {},
        onSelectionChange: () => {},
    };
    let labels = {
        romanPlaceholder: "—",
        cadencePlaceholder: "Cadence",
        cadenceTitle: "e.g. PAC, IAC, HC",
        lockedTitle: "This is fixed by the assignment.",
        getInsertTitle: () => "",
        getDeleteTitle: () => "",
    };

    let layoutInfos = [];
    let systemInfos = [];
    let svgSize = { w: 0, h: 0 };
    let staveInfos = [];

    // ──────────────────────────────────────────────
    // Layout
    // ──────────────────────────────────────────────
    function getAvailableWidth() {
        const wrapper = document.getElementById("score-wrapper");
        const w = (wrapper && wrapper.clientWidth) ? wrapper.clientWidth : window.innerWidth;
        return Math.max(Math.min(w, SCORE_MAX_WIDTH + 40) - 40, 560);
    }

    function computeLayout() {
        layoutInfos = [];
        systemInfos = [];
        svgSize = { w: 0, h: 0 };

        const N = state.measures.length;
        if (N === 0) return;

        const available = getAvailableWidth();

        const capacity = Math.max(
            1,
            Math.floor(
                (available - STAVE_START_X - FIRST_STAVE_EXTRA - RIGHT_PADDING) / STAVE_MIN_WIDTH
            )
        );

        let idx = 0;
        while (idx < N) {
            const k = Math.min(capacity, N - idx);
            systemInfos.push({ startMeasure: idx, count: k, y: 0, width: 0 });
            idx += k;
        }

        systemInfos.forEach((sys, sysIdx) => {
            sys.y = STAVE_START_Y + sysIdx * SYSTEM_SPACING;
            const isLast = (sysIdx === systemInfos.length - 1);
            const shouldStretch = !isLast || sys.count > 1;

            const mwStretched =
                (available - STAVE_START_X - FIRST_STAVE_EXTRA - RIGHT_PADDING) / sys.count;
            const mw = shouldStretch ? Math.max(STAVE_MIN_WIDTH, mwStretched) : STAVE_MIN_WIDTH;

            let x = STAVE_START_X;
            for (let j = 0; j < sys.count; j++) {
                const isFirst = (j === 0);
                const w = mw + (isFirst ? FIRST_STAVE_EXTRA : 0);
                layoutInfos.push({
                    x, y: sys.y, w,
                    systemIndex: sysIdx,
                    isSystemStart: isFirst,
                });
                x += w;
            }
            sys.width = x - STAVE_START_X;
            svgSize.w = Math.max(svgSize.w, x + RIGHT_PADDING);
        });

        svgSize.h =
            STAVE_START_Y +
            (systemInfos.length - 1) * SYSTEM_SPACING +
            BASS_OFFSET + 90 + SVG_BOTTOM_PADDING;
    }

    // ──────────────────────────────────────────────
    // VexFlow rendering
    // ──────────────────────────────────────────────
    function render() {
        const container = document.getElementById("score-container");
        container.innerHTML = "";

        computeLayout();

        if (state.measures.length === 0) {
            staveInfos = [];
            container.style.width = "0px";
            container.style.height = "0px";
            updateControls();
            updateRomanInputs();
            return;
        }

        const renderer = new Renderer(container, Renderer.Backends.SVG);
        renderer.resize(svgSize.w, svgSize.h);
        const context = renderer.getContext();

        container.style.width = svgSize.w + "px";
        container.style.height = svgSize.h + "px";

        staveInfos = [];
        const keySig = M.vexKeySignature(state.fifths);
        const lastIdx = state.measures.length - 1;

        for (let i = 0; i < state.measures.length; i++) {
            const info = layoutInfos[i];
            const { x, y, w, isSystemStart, systemIndex } = info;
            const isLastInSystem =
                (i === lastIdx) ||
                (layoutInfos[i + 1] && layoutInfos[i + 1].systemIndex !== systemIndex);
            const isLastMeasure = (i === lastIdx);

            const treble = new Stave(x, y, w);
            if (isSystemStart) treble.addClef("treble").addKeySignature(keySig);
            if (isLastMeasure) treble.setEndBarType(Barline.type.END);
            treble.setContext(context).draw();

            const bassY = y + BASS_OFFSET;
            const bass = new Stave(x, bassY, w);
            if (isSystemStart) bass.addClef("bass").addKeySignature(keySig);
            if (isLastMeasure) bass.setEndBarType(Barline.type.END);
            bass.setContext(context).draw();

            if (isSystemStart) {
                const brace = new StaveConnector(treble, bass);
                brace.setType(StaveConnector.type.BRACE);
                brace.setContext(context).draw();

                const lineLeft = new StaveConnector(treble, bass);
                lineLeft.setType(StaveConnector.type.SINGLE_LEFT);
                lineLeft.setContext(context).draw();
            }

            const lineRight = new StaveConnector(treble, bass);
            lineRight.setType(
                isLastMeasure ? StaveConnector.type.BOLD_DOUBLE_RIGHT : StaveConnector.type.SINGLE_RIGHT
            );
            lineRight.setContext(context).draw();

            staveInfos.push({ treble, bass, x, y, w, systemIndex, isSystemStart, isLastInSystem });

            drawMeasureNotes(context, i, treble, bass);
        }

        updateControls();
        updateRomanInputs();
    }

    function isSelected(measureIndex, voice) {
        if (!state.selectedNote) return false;
        return state.selectedNote.measureIndex === measureIndex &&
               state.selectedNote.voice === voice;
    }

    function drawMeasureNotes(context, measureIndex, trebleStave, bassStave) {
        const m = state.measures[measureIndex];

        const mkOpts = (voice) => {
            const opts = callbacks.getNoteOpts(measureIndex, voice) || {};
            return {
                highlight: !!opts.highlight || isSelected(measureIndex, voice),
                fixed: !!opts.fixed,
            };
        };

        const trebleVoices = [];
        if (m.S || m.A) {
            if (m.S) {
                const sVoice = new Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
                const sNote = makeStaveNote(m.S, "treble", 1, mkOpts("S"));
                sVoice.addTickables([sNote]);
                trebleVoices.push(sVoice);
            }
            if (m.A) {
                const aVoice = new Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
                const aNote = makeStaveNote(m.A, "treble", -1, mkOpts("A"));
                aVoice.addTickables([aNote]);
                trebleVoices.push(aVoice);
            }
            const noteAreaWidth = trebleStave.getNoteEndX() - trebleStave.getNoteStartX() - 10;
            new Formatter().joinVoices(trebleVoices).format(trebleVoices, Math.max(noteAreaWidth, 50));
            trebleVoices.forEach(v => v.draw(context, trebleStave));
        }

        const bassVoices = [];
        if (m.T || m.B) {
            if (m.T) {
                const tVoice = new Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
                const tNote = makeStaveNote(m.T, "bass", 1, mkOpts("T"));
                tVoice.addTickables([tNote]);
                bassVoices.push(tVoice);
            }
            if (m.B) {
                const bVoice = new Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
                const bNote = makeStaveNote(m.B, "bass", -1, mkOpts("B"));
                bVoice.addTickables([bNote]);
                bassVoices.push(bVoice);
            }
            const noteAreaWidth = bassStave.getNoteEndX() - bassStave.getNoteStartX() - 10;
            new Formatter().joinVoices(bassVoices).format(bassVoices, Math.max(noteAreaWidth, 50));
            bassVoices.forEach(v => v.draw(context, bassStave));
        }
    }

    function makeStaveNote(noteData, clef, stemDir, opts) {
        opts = opts || {};
        const highlight = !!opts.highlight;
        const fixed = !!opts.fixed;
        const [midi, letter, accidental] = noteData;
        const baseSemitone = M.LETTER_TO_SEMITONE[letter.toUpperCase()];
        const octave = Math.round((midi - baseSemitone - accidental) / 12) - 1;

        const vexKey = `${letter.toLowerCase()}/${octave}`;
        const note = new StaveNote({
            keys: [vexKey],
            duration: "w",
            clef: clef,
            stem_direction: stemDir,
        });

        const accMap = M.keyAccidentalMap(state.fifths);
        const keyAcc = accMap[letter.toUpperCase()] || 0;
        if (accidental !== keyAcc) {
            let accStr;
            if (accidental === 2) accStr = "##";
            else if (accidental === 1) accStr = "#";
            else if (accidental === 0) accStr = "n";
            else if (accidental === -1) accStr = "b";
            else if (accidental === -2) accStr = "bb";
            else accStr = "n";
            note.addModifier(new Accidental(accStr));
        }

        if (fixed && highlight) {
            note.setStyle({ fillStyle: "#d63031", strokeStyle: "#0984e3" });
        } else if (fixed) {
            note.setStyle({ fillStyle: "#d63031", strokeStyle: "#d63031" });
        } else if (highlight) {
            note.setStyle({ fillStyle: "#0984e3", strokeStyle: "#0984e3" });
        }
        return note;
    }

    // ──────────────────────────────────────────────
    // Click + erase
    // ──────────────────────────────────────────────
    function findClosestNoteVoice(measureIndex, clickY) {
        const info = staveInfos[measureIndex];
        if (!info) return null;
        const m = state.measures[measureIndex];

        const trebleTop = info.treble.getYForLine(0);
        const trebleSpacing = (info.treble.getYForLine(4) - info.treble.getYForLine(0)) / 4;
        const trebleHalf = trebleSpacing / 2;
        const bassTop = info.bass.getYForLine(0);
        const bassSpacing = (info.bass.getYForLine(4) - info.bass.getYForLine(0)) / 4;
        const bassHalf = bassSpacing / 2;

        let best = null;
        let bestDist = Infinity;

        const consider = (voice, noteData, clef) => {
            if (!noteData) return;
            const [midi, letter, accidental] = noteData;
            const refLetter = clef === "treble" ? "F" : "A";
            const refOctave = clef === "treble" ? 5 : 3;
            const refIdx = M.DIATONIC_LETTERS.indexOf(refLetter);
            const refAbs = refOctave * 7 + refIdx;
            const noteIdx = M.DIATONIC_LETTERS.indexOf(letter.toUpperCase());
            const baseSemi = M.LETTER_TO_SEMITONE[letter.toUpperCase()];
            const noteOctave = Math.round((midi - baseSemi - accidental) / 12) - 1;
            const noteAbs = noteOctave * 7 + noteIdx;
            const pos = refAbs - noteAbs;
            const noteY = (clef === "treble" ? trebleTop : bassTop) +
                pos * (clef === "treble" ? trebleHalf : bassHalf);
            const dist = Math.abs(noteY - clickY);
            if (dist < bestDist) {
                bestDist = dist;
                best = voice;
            }
        };

        consider("S", m.S, "treble");
        consider("A", m.A, "treble");
        consider("T", m.T, "bass");
        consider("B", m.B, "bass");

        return bestDist < 30 ? best : null;
    }

    function eraseNote(measureIndex, voice) {
        if (!state.measures[measureIndex] || !state.measures[measureIndex][voice]) return false;
        if (!callbacks.canEditNote(measureIndex, voice)) return false;

        state.measures[measureIndex][voice] = null;
        callbacks.afterEraseNote(measureIndex, voice);

        if (state.selectedNote &&
            state.selectedNote.measureIndex === measureIndex &&
            state.selectedNote.voice === voice) {
            state.selectedNote = null;
        }
        callbacks.onSelectionChange();
        render();
        return true;
    }

    function placeNoteFromClick(mIdx, voice, clef, clickY, stave) {
        const topLineY = stave.getYForLine(0);
        const lineSpacing = (stave.getYForLine(4) - stave.getYForLine(0)) / 4;
        const halfSpace = lineSpacing / 2;

        const rawPos = (clickY - topLineY) / halfSpace;
        const pos = Math.round(rawPos);
        const clampedPos = Math.max(-6, Math.min(14, pos));

        const { letter, octave } = M.positionToNote(clef, clampedPos);
        const accMap = M.keyAccidentalMap(state.fifths);
        const accidental = accMap[letter] || 0;
        const midi = M.toMidi(letter, octave, accidental);

        state.measures[mIdx][voice] = [midi, letter, accidental];
        callbacks.afterPlaceNote(mIdx, voice);
        state.selectedNote = { measureIndex: mIdx, voice };
        callbacks.onSelectionChange();
        render();
    }

    function setupClickHandler() {
        const container = document.getElementById("score-container");
        container.addEventListener("click", (e) => {
            const svg = container.querySelector("svg");
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            let mIdx = -1;
            for (let i = 0; i < staveInfos.length; i++) {
                const info = staveInfos[i];
                if (clickX < info.x || clickX >= info.x + info.w) continue;
                const trebleTop = info.treble.getYForLine(0);
                const bassBot = info.bass.getYForLine(4);
                const yMargin = 50;
                if (clickY < trebleTop - yMargin || clickY > bassBot + yMargin) continue;
                mIdx = i;
                break;
            }
            if (mIdx < 0) return;

            // Eraser mode: nuke the closest note regardless of voice selector.
            if (state.eraserMode) {
                const targetVoice = findClosestNoteVoice(mIdx, clickY);
                if (targetVoice) eraseNote(mIdx, targetVoice);
                return;
            }

            const voice = state.selectedVoice;

            // Permission check (mode-side may show toast).
            if (!callbacks.canEditNote(mIdx, voice)) return;

            const info = staveInfos[mIdx];
            const trebleTop = info.treble.getYForLine(0);
            const trebleBot = info.treble.getYForLine(4);
            const bassTop = info.bass.getYForLine(0);
            const bassBot = info.bass.getYForLine(4);
            const trebleMargin = 35;
            const bassMargin = 35;

            let clef = null;
            if (clickY >= trebleTop - trebleMargin && clickY <= trebleBot + trebleMargin) {
                clef = "treble";
            } else if (clickY >= bassTop - bassMargin && clickY <= bassBot + bassMargin) {
                clef = "bass";
            }
            if (!clef) return;

            if ((voice === "S" || voice === "A") && clef !== "treble") return;
            if ((voice === "T" || voice === "B") && clef !== "bass") return;

            const stave = clef === "treble" ? info.treble : info.bass;
            placeNoteFromClick(mIdx, voice, clef, clickY, stave);
        });
    }

    // ──────────────────────────────────────────────
    // Keyboard handler (move + delete selected note)
    // ──────────────────────────────────────────────
    function setupKeyboardHandler() {
        document.addEventListener("keydown", (e) => {
            if (!state.selectedNote) return;
            const tag = document.activeElement && document.activeElement.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;

            if (e.key === "ArrowUp") {
                e.preventDefault();
                moveSelectedPitch(1);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                moveSelectedPitch(-1);
            } else if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                const { measureIndex, voice } = state.selectedNote;
                eraseNote(measureIndex, voice);
            }
        });
    }

    // ──────────────────────────────────────────────
    // Selection / accidental / move helpers
    // ──────────────────────────────────────────────
    function getSelectedNoteData() {
        if (!state.selectedNote) return null;
        const { measureIndex, voice } = state.selectedNote;
        if (measureIndex < 0 || measureIndex >= state.measures.length) return null;
        return state.measures[measureIndex][voice];
    }

    function changeAccidental(delta) {
        const noteData = getSelectedNoteData();
        if (!noteData) return;
        const { measureIndex, voice } = state.selectedNote;
        if (!callbacks.canEditNote(measureIndex, voice)) return;

        const newAcc = noteData[2] + delta;
        if (newAcc < -2 || newAcc > 2) return;

        noteData[2] = newAcc;
        noteData[0] = noteData[0] + delta;

        callbacks.onSelectionChange();
        render();
    }

    function moveSelectedPitch(direction) {
        const noteData = getSelectedNoteData();
        if (!noteData) return;
        const { measureIndex, voice } = state.selectedNote;
        if (!callbacks.canEditNote(measureIndex, voice)) return;

        const [midi, letter, accidental] = noteData;
        const letterIdx = M.DIATONIC_LETTERS.indexOf(letter.toUpperCase());
        const baseSemitone = M.LETTER_TO_SEMITONE[letter.toUpperCase()];
        const octave = Math.round((midi - baseSemitone - accidental) / 12) - 1;

        let newIdx = letterIdx + direction;
        let newOctave = octave;
        if (newIdx > 6) { newIdx = 0; newOctave++; }
        if (newIdx < 0) { newIdx = 6; newOctave--; }

        const newLetter = M.DIATONIC_LETTERS[newIdx];
        const newMidi = M.toMidi(newLetter, newOctave, accidental);

        noteData[0] = newMidi;
        noteData[1] = newLetter;

        callbacks.onSelectionChange();
        render();
    }

    // ──────────────────────────────────────────────
    // Insert / delete overlay
    // ──────────────────────────────────────────────
    function updateControls() {
        const overlay = document.getElementById("controls-overlay");
        overlay.innerHTML = "";

        const container = document.getElementById("score-container");
        const svgRect = container.querySelector("svg");
        if (!svgRect || state.measures.length === 0) {
            overlay.style.width = "0px";
            overlay.style.height = "0px";
            return;
        }

        if (!callbacks.showMeasureControls()) {
            overlay.style.width = svgRect.getAttribute("width") + "px";
            overlay.style.height = svgRect.getAttribute("height") + "px";
            return;
        }

        overlay.style.width = svgRect.getAttribute("width") + "px";
        overlay.style.height = svgRect.getAttribute("height") + "px";

        const containerRect = container.getBoundingClientRect();
        const wrapperRect = document.getElementById("score-wrapper").getBoundingClientRect();
        overlay.style.left = (containerRect.left - wrapperRect.left) + "px";
        overlay.style.top = (containerRect.top - wrapperRect.top) + "px";

        for (let i = 0; i <= state.measures.length; i++) {
            const insertBtn = document.createElement("button");
            insertBtn.className = "ctrl-btn insert-btn";
            insertBtn.textContent = "+";
            insertBtn.title = labels.getInsertTitle(i, state.measures.length);

            let btnX, btnY;
            if (i < state.measures.length) {
                const info = staveInfos[i];
                btnX = info.x - 12;
                btnY = info.y - 20;
            } else {
                const last = staveInfos[state.measures.length - 1];
                btnX = last.x + last.w + 4;
                btnY = last.y - 20;
            }
            insertBtn.style.left = btnX + "px";
            insertBtn.style.top = btnY + "px";

            const insertIdx = i;
            insertBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                callbacks.onInsertMeasure(insertIdx);
            });
            overlay.appendChild(insertBtn);
        }

        for (let i = 0; i < state.measures.length; i++) {
            const info = staveInfos[i];
            const delBtn = document.createElement("button");
            delBtn.className = "ctrl-btn delete-btn";
            delBtn.textContent = "×";
            delBtn.title = labels.getDeleteTitle(i + 1);
            delBtn.style.left = (info.x + info.w - 22) + "px";
            delBtn.style.top = (info.y - 18) + "px";

            const delIdx = i;
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                callbacks.onDeleteMeasure(delIdx);
            });
            overlay.appendChild(delBtn);
        }
    }

    // ──────────────────────────────────────────────
    // Roman numeral / cadence inputs
    // ──────────────────────────────────────────────
    function updateRomanInputs() {
        const container = document.getElementById("roman-numeral-container");
        container.innerHTML = "";
        if (staveInfos.length === 0) return;

        const scoreContainer = document.getElementById("score-container");
        const wrapperRect = document.getElementById("score-wrapper").getBoundingClientRect();
        const scoreRect = scoreContainer.getBoundingClientRect();
        container.style.position = "absolute";
        container.style.left = (scoreRect.left - wrapperRect.left) + "px";
        container.style.top = (scoreRect.top - wrapperRect.top) + "px";
        container.style.width = svgSize.w + "px";
        container.style.height = "0px";

        for (let i = 0; i < state.measures.length; i++) {
            const info = staveInfos[i];
            const bassBottomY = info.bass.getYForLine(4);

            const row = document.createElement("div");
            row.className = "measure-input-row";
            row.style.position = "absolute";
            row.style.left = (info.x + 10) + "px";
            row.style.width = (info.w - 20) + "px";
            row.style.top = (bassBottomY + 30) + "px";

            const romanInput = document.createElement("input");
            romanInput.type = "text";
            romanInput.className = "roman-input";
            romanInput.value = state.measures[i].romanNumeral;
            romanInput.placeholder = labels.romanPlaceholder;
            if (callbacks.isRomanLocked(i)) {
                romanInput.readOnly = true;
                romanInput.classList.add("locked");
                romanInput.title = labels.lockedTitle;
            } else {
                romanInput.addEventListener("input", (e) => {
                    state.measures[i].romanNumeral = e.target.value;
                });
            }
            romanInput.addEventListener("click", (e) => e.stopPropagation());
            row.appendChild(romanInput);

            const cadenceInput = document.createElement("input");
            cadenceInput.type = "text";
            cadenceInput.className = "cadence-input";
            cadenceInput.value = state.measures[i].cadence || "";
            cadenceInput.placeholder = labels.cadencePlaceholder;
            cadenceInput.title = labels.cadenceTitle;
            if (callbacks.isCadenceLocked(i)) {
                cadenceInput.readOnly = true;
                cadenceInput.classList.add("locked");
                cadenceInput.title = labels.lockedTitle;
            } else {
                cadenceInput.addEventListener("input", (e) => {
                    state.measures[i].cadence = e.target.value;
                });
            }
            cadenceInput.addEventListener("click", (e) => e.stopPropagation());
            row.appendChild(cadenceInput);

            container.appendChild(row);
        }
    }

    // ──────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────
    function init(opts) {
        state = opts.state;
        if (opts.callbacks) {
            Object.assign(callbacks, opts.callbacks);
        }
        if (opts.labels) {
            Object.assign(labels, opts.labels);
        }
        setupClickHandler();
        setupKeyboardHandler();

        let resizeTimer = null;
        window.addEventListener("resize", () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => render(), 120);
        });
    }

    function setLabels(newLabels) {
        Object.assign(labels, newLabels);
    }

    global.Score = {
        init,
        setLabels,
        render,
        eraseNote,
        changeAccidental,
        moveSelectedPitch,
        getSelectedNoteData,
        isSelected,
    };
})(window);
