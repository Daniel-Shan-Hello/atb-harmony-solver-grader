// ============================================================
// teacher/teacher.js
// Teacher-mode entry point. Full feature set: editing, solver,
// fixed-note hints, key changes, assignment authoring.
// ============================================================

(function () {
    "use strict";

    const M = window.Music;

    // ──────────────────────────────────────────────
    // State (no lock fields — teacher can edit everything)
    // ──────────────────────────────────────────────
    function emptyMeasure() {
        return { S: null, A: null, T: null, B: null, romanNumeral: "", cadence: "" };
    }

    const state = {
        fifths: 0,
        mode: "major",
        selectedVoice: "S",
        selectedNote: null,
        eraserMode: false,
        fixedNotes: new Set(),     // "m,v" — solver hints
        assignmentName: "",
        studentName: "",            // populated when teacher imports a student submission
        studentCanGrade: true,      // last choice from export-confirm modal
        measures: [emptyMeasure(), emptyMeasure(), emptyMeasure()],
    };

    function fixedNoteKey(m, v) { return `${m},${v}`; }
    function isNoteFixed(m, v) { return state.fixedNotes.has(fixedNoteKey(m, v)); }

    function currentTonic() {
        const arr = state.mode === "major" ? M.MAJOR_KEYS : M.MINOR_KEYS;
        return arr[state.fifths + 7];
    }
    function currentKeyTuple() { return [currentTonic(), state.mode]; }

    // ──────────────────────────────────────────────
    // i18n
    // ──────────────────────────────────────────────
    let currentLang = "zh";

    const I18N = {
        zh: {
            label_voice: "声部：",
            label_key: "调性：",
            label_acc: "临时记号：",
            key_down_title: "减少升号 / 增加降号",
            key_up_title: "增加升号 / 减少降号",
            toggle_mode: "大/小调",
            toggle_mode_title: "切换大小调",
            acc_down_title: "降半音 (最多重降)",
            acc_up_title: "升半音 (最多重升)",
            fix_btn: "Fix",
            fix_unfix: "Unfix",
            eraser_title: "橡皮擦：点击音符删除",
            eraser_active_title: "橡皮擦已开启 — 点击空白或再次点击按钮关闭",
            play_btn: "▶ Play",
            play_loading: "加载中...",
            play_stop: "■ Stop",
            export_btn: "导出 JSON",
            grade_btn: "Voice Grader",
            grading_btn: "检测中...",
            solve_btn: "Solve",
            solving_btn: "求解中...",
            solve_no_solution: "未能找到合法解。请检查 Roman Numeral / cadence / 固定音符是否合理。",
            solve_missing_rn: (i) => `小节 ${i} 缺少 Roman Numeral，无法求解。`,
            solve_no_measures: "请先添加至少一个小节。",
            lang_btn: "EN",
            grade_title: "Voice Grader 结果",
            role_teacher: "教师端",
            export_no_data: "没有可导出的内容。",
            import_only_v1: "不支持的 JSON 版本（需要 version=1）。",
            import_bad_format: "JSON 格式不正确。",
            export_confirm_title: "导出作业",
            export_confirm_q: "此作业学生是否拥有 Grader（自检）权限？",
            export_allow: "允许",
            export_deny: "不允许",
            meta_assignment_label: "作业名称：",
            meta_student_label: "学生姓名：",
            meta_assignment_placeholder: "未命名作业",
            meta_student_placeholder: "未填写",
            mode_major: "大调",
            mode_minor: "小调",
            grade_pass: "全部检查通过！未发现错误。",
            grade_fail: (total, cats) => `发现 ${total} 个错误，分布在 ${cats} 个类别中。`,
            missing_voice: (i) => `小节 ${i} 缺少声部音符（SATB 四个声部都必须填写）`,
            missing_rn: (i) => `小节 ${i} 缺少 Roman Numeral`,
            grader_error: "Grader 错误: ",
            request_fail: "请求失败: ",
            import_btn: "导入 JSON",
            import_parse_error: "解析失败: ",
            insert_before: (i) => `在第${i}小节前插入`,
            add_measure: "添加小节",
            delete_measure: (i) => `删除第${i}小节`,
            cadence_title: "例如 PAC, IAC, HC",
            cadence_placeholder: "Cadence",
            cat_vr: "Vocal Range (音域)",
            cat_vc: "Voice Crossing (声部交叉)",
            cat_vg: "Voice Gap (声部间距)",
            cat_wn: "Wrong / Misspelled Note (错误音符)",
            cat_wb: "Wrong Bass (低音错误)",
            cat_overlap: "Voice Overlap (声部超越)",
            cat_parallel: "Parallel 5th / 8ve (平行五八度)",
            cat_direct: "Direct 5th / 8ve (直接五八度)",
            cat_leap: "Leap Errors (跳进错误)",
            cat_completion: "Chord Completion (和弦完整性)",
            cat_resolve: "Resolution (解决)",
        },
        en: {
            label_voice: "Voice:",
            label_key: "Key:",
            label_acc: "Accidental:",
            key_down_title: "More flats",
            key_up_title: "More sharps",
            toggle_mode: "Maj/min",
            toggle_mode_title: "Toggle major / minor",
            acc_down_title: "Flatten (max double flat)",
            acc_up_title: "Sharpen (max double sharp)",
            fix_btn: "Fix",
            fix_unfix: "Unfix",
            eraser_title: "Eraser: click a note to delete",
            eraser_active_title: "Eraser ON — click a note to delete, or click button to exit",
            play_btn: "▶ Play",
            play_loading: "Loading...",
            play_stop: "■ Stop",
            export_btn: "Export JSON",
            grade_btn: "Voice Grader",
            grading_btn: "Grading...",
            solve_btn: "Solve",
            solving_btn: "Solving...",
            solve_no_solution: "No valid solution found. Check Roman numerals / cadences / fixed notes.",
            solve_missing_rn: (i) => `Measure ${i} is missing a Roman Numeral; cannot solve.`,
            solve_no_measures: "Add at least one measure first.",
            lang_btn: "中文",
            grade_title: "Voice Grader Results",
            role_teacher: "Teacher",
            export_no_data: "Nothing to export.",
            import_only_v1: "Unsupported JSON version (expected version=1).",
            import_bad_format: "Bad JSON format.",
            export_confirm_title: "Export Assignment",
            export_confirm_q: "Allow students to use the Voice Grader (self-check) on this assignment?",
            export_allow: "Allow",
            export_deny: "Don't allow",
            meta_assignment_label: "Assignment Name:",
            meta_student_label: "Student Name:",
            meta_assignment_placeholder: "Untitled assignment",
            meta_student_placeholder: "Not entered",
            mode_major: "Major",
            mode_minor: "minor",
            grade_pass: "All checks passed! No errors found.",
            grade_fail: (total, cats) => `Found ${total} error(s) across ${cats} categories.`,
            missing_voice: (i) => `Measure ${i} is missing notes (all SATB parts required)`,
            missing_rn: (i) => `Measure ${i} is missing Roman Numeral`,
            grader_error: "Grader error: ",
            request_fail: "Request failed: ",
            import_btn: "Import JSON",
            import_parse_error: "Parse error: ",
            insert_before: (i) => `Insert before measure ${i}`,
            add_measure: "Add measure",
            delete_measure: (i) => `Delete measure ${i}`,
            cadence_title: "e.g. PAC, IAC, HC",
            cadence_placeholder: "Cadence",
            cat_vr: "Vocal Range",
            cat_vc: "Voice Crossing",
            cat_vg: "Voice Gap",
            cat_wn: "Wrong / Misspelled Note",
            cat_wb: "Wrong Bass",
            cat_overlap: "Voice Overlap",
            cat_parallel: "Parallel 5th / 8ve",
            cat_direct: "Direct 5th / 8ve",
            cat_leap: "Leap Errors",
            cat_completion: "Chord Completion",
            cat_resolve: "Resolution",
        },
    };

    function t(key, ...args) {
        const val = I18N[currentLang][key];
        if (typeof val === "function") return val(...args);
        return val !== undefined ? val : key;
    }

    // ──────────────────────────────────────────────
    // Toast
    // ──────────────────────────────────────────────
    let _toastTimer = null;
    function showToast(msg) {
        const el = document.getElementById("toast");
        if (!el) return;
        el.textContent = msg;
        el.style.display = "block";
        requestAnimationFrame(() => el.classList.add("show"));
        if (_toastTimer) clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => {
            el.classList.remove("show");
            setTimeout(() => { el.style.display = "none"; }, 220);
        }, 1600);
    }

    // ──────────────────────────────────────────────
    // Toolbar text refresh
    // ──────────────────────────────────────────────
    function updateAllText() {
        const roleBadge = document.getElementById("role-badge");
        if (roleBadge) roleBadge.textContent = t("role_teacher");

        document.getElementById("label-voice").textContent = t("label_voice");
        document.getElementById("label-key").textContent = t("label_key");
        document.getElementById("label-acc").textContent = t("label_acc");
        document.getElementById("key-down").title = t("key_down_title");
        document.getElementById("key-up").title = t("key_up_title");
        document.getElementById("toggle-mode").textContent = t("toggle_mode");
        document.getElementById("toggle-mode").title = t("toggle_mode_title");
        document.getElementById("acc-down").title = t("acc_down_title");
        document.getElementById("acc-up").title = t("acc_up_title");
        document.getElementById("play-btn").textContent =
            window.Playback.isPlaying() ? t("play_stop") : t("play_btn");
        const eraserBtn = document.getElementById("eraser-btn");
        if (eraserBtn) eraserBtn.title = state.eraserMode ? t("eraser_active_title") : t("eraser_title");
        updateFixButton();
        document.getElementById("import-btn").textContent = t("import_btn");
        document.getElementById("export-btn").textContent = t("export_btn");
        document.getElementById("grade-btn").textContent = t("grade_btn");
        document.getElementById("solve-btn").textContent = t("solve_btn");
        document.getElementById("lang-btn").textContent = t("lang_btn");
        document.querySelector("#grade-modal .modal-header h3").textContent = t("grade_title");

        document.getElementById("export-confirm-title").textContent = t("export_confirm_title");
        document.getElementById("export-confirm-question").textContent = t("export_confirm_q");
        document.getElementById("export-allow-btn").textContent = t("export_allow");
        document.getElementById("export-deny-btn").textContent = t("export_deny");

        document.querySelector('label[for="assignment-name-input"]').textContent = t("meta_assignment_label");
        document.querySelector('label[for="student-name-input"]').textContent = t("meta_student_label");
        document.getElementById("assignment-name-input").placeholder = t("meta_assignment_placeholder");
        document.getElementById("student-name-input").placeholder = t("meta_student_placeholder");

        updateKeyDisplay();

        // Refresh score-side labels (Roman placeholder, insert/delete tooltips).
        window.Score.setLabels(buildScoreLabels());
        window.Score.render();
    }

    function buildScoreLabels() {
        return {
            romanPlaceholder: "—",
            cadencePlaceholder: t("cadence_placeholder"),
            cadenceTitle: t("cadence_title"),
            lockedTitle: "",
            getInsertTitle: (i, total) =>
                i < total ? t("insert_before", i + 1) : t("add_measure"),
            getDeleteTitle: (oneBased) => t("delete_measure", oneBased),
        };
    }

    function toggleLang() {
        currentLang = currentLang === "zh" ? "en" : "zh";
        updateAllText();
    }

    // ──────────────────────────────────────────────
    // Key controls
    // ──────────────────────────────────────────────
    function updateKeyDisplay() {
        const tonic = currentTonic();
        const modeLabel = state.mode === "major" ? t("mode_major") : t("mode_minor");
        document.getElementById("key-display").textContent = `${tonic} ${modeLabel}`;
    }

    function changeKey(delta) {
        const newFifths = state.fifths + delta;
        if (newFifths < -7 || newFifths > 7) return;
        state.fifths = newFifths;
        updateKeyDisplay();
        window.Score.render();
    }

    function toggleMode() {
        state.mode = state.mode === "major" ? "minor" : "major";
        updateKeyDisplay();
        window.Score.render();
    }

    // ──────────────────────────────────────────────
    // Accidental display + Fix button
    // ──────────────────────────────────────────────
    const ACC_LABELS = { "-2": "𝄫", "-1": "♭", "0": "♮", "1": "♯", "2": "𝄪" };

    function updateAccidentalDisplay() {
        const noteData = window.Score.getSelectedNoteData();
        const display = document.getElementById("acc-display");
        const upBtn = document.getElementById("acc-up");
        const downBtn = document.getElementById("acc-down");

        if (!noteData) {
            display.textContent = "—";
            upBtn.disabled = true;
            downBtn.disabled = true;
            updateFixButton();
            return;
        }

        const acc = noteData[2];
        display.textContent = ACC_LABELS[String(acc)] || "♮";
        upBtn.disabled = acc >= 2;
        downBtn.disabled = acc <= -2;
        updateFixButton();
    }

    function updateFixButton() {
        const fixBtn = document.getElementById("fix-btn");
        if (!fixBtn) return;
        const nd = window.Score.getSelectedNoteData();
        if (!nd || !state.selectedNote) {
            fixBtn.disabled = true;
            fixBtn.textContent = t("fix_btn");
            fixBtn.classList.remove("fixed");
            return;
        }
        fixBtn.disabled = false;
        const fixed = isNoteFixed(state.selectedNote.measureIndex, state.selectedNote.voice);
        fixBtn.textContent = fixed ? t("fix_unfix") : t("fix_btn");
        fixBtn.classList.toggle("fixed", fixed);
    }

    function toggleNoteFixed() {
        if (!state.selectedNote) return;
        const nd = window.Score.getSelectedNoteData();
        if (!nd) return;
        const { measureIndex, voice } = state.selectedNote;
        const key = fixedNoteKey(measureIndex, voice);
        if (state.fixedNotes.has(key)) state.fixedNotes.delete(key);
        else state.fixedNotes.add(key);
        updateFixButton();
        window.Score.render();
    }

    // ──────────────────────────────────────────────
    // Eraser
    // ──────────────────────────────────────────────
    function toggleEraserMode() {
        state.eraserMode = !state.eraserMode;
        const btn = document.getElementById("eraser-btn");
        btn.classList.toggle("active", state.eraserMode);
        btn.title = state.eraserMode ? t("eraser_active_title") : t("eraser_title");
        document.getElementById("score-container").classList.toggle("eraser-cursor", state.eraserMode);
    }

    // ──────────────────────────────────────────────
    // Measure insert / delete
    // ──────────────────────────────────────────────
    function insertMeasure(atIndex) {
        state.measures.splice(atIndex, 0, emptyMeasure());
        if (state.selectedNote && state.selectedNote.measureIndex >= atIndex) {
            state.selectedNote.measureIndex++;
        }
        const next = new Set();
        state.fixedNotes.forEach((k) => {
            const [m, v] = k.split(",");
            const mi = parseInt(m, 10);
            if (mi >= atIndex) next.add(`${mi + 1},${v}`);
            else next.add(k);
        });
        state.fixedNotes = next;
        window.Score.render();
    }

    function deleteMeasure(index) {
        if (state.measures.length <= 1) return;
        if (state.selectedNote) {
            if (state.selectedNote.measureIndex === index) {
                state.selectedNote = null;
                updateAccidentalDisplay();
            } else if (state.selectedNote.measureIndex > index) {
                state.selectedNote.measureIndex--;
            }
        }
        ["S", "A", "T", "B"].forEach((v) => state.fixedNotes.delete(`${index},${v}`));
        const next = new Set();
        state.fixedNotes.forEach((k) => {
            const [m, v] = k.split(",");
            const mi = parseInt(m, 10);
            if (mi > index) next.add(`${mi - 1},${v}`);
            else next.add(k);
        });
        state.fixedNotes = next;
        state.measures.splice(index, 1);
        window.Score.render();
    }

    // ──────────────────────────────────────────────
    // Export / Import JSON
    // ──────────────────────────────────────────────
    function exportJSON() {
        if (!state.measures.length) {
            alert(t("export_no_data"));
            return;
        }
        showExportConfirmModal();
    }

    function showExportConfirmModal() {
        document.getElementById("export-confirm-modal").style.display = "flex";
    }
    function hideExportConfirmModal() {
        document.getElementById("export-confirm-modal").style.display = "none";
    }

    function doExportJSON(studentCanGrade) {
        const payload = {
            version: 1,
            type: "assignment",
            key: currentKeyTuple(),
            studentCanGrade: !!studentCanGrade,
            assignmentName: state.assignmentName || "",
            studentName: "",   // an assignment never carries a student name
            measures: state.measures.map((m) => ({
                S: m.S || null,
                A: m.A || null,
                T: m.T || null,
                B: m.B || null,
                romanNumeral: m.romanNumeral || "",
                cadence: m.cadence || "",
            })),
            fixedNotes: [...state.fixedNotes].map((k) => {
                const [mi, v] = k.split(",");
                return [parseInt(mi, 10), v];
            }),
        };
        state.studentCanGrade = !!studentCanGrade;

        const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
        const aName = window.IO.sanitizeForFilename(state.assignmentName) || "untitled";
        const filename = `assignment_${aName}_${stamp}.json`;
        window.IO.downloadJSON(payload, filename);
    }

    function importJSONFile(file) {
        window.IO.readJSONFile(
            file,
            (data) => {
                try {
                    applyImportedJSON(data);
                } catch (err) {
                    alert(t("import_parse_error") + err.message);
                }
            },
            (err) => alert(t("import_parse_error") + err.message)
        );
    }

    function applyImportedJSON(data) {
        if (!data || typeof data !== "object") throw new Error(t("import_bad_format"));
        if (data.version !== 1) throw new Error(t("import_only_v1"));
        if (!Array.isArray(data.key) || data.key.length !== 2) {
            throw new Error("key must be [tonic, mode]");
        }
        if (!Array.isArray(data.measures) || data.measures.length === 0) {
            throw new Error("measures must be a non-empty array");
        }

        const measures = data.measures.map((m, i) => {
            if (!m || typeof m !== "object") throw new Error(`Measure ${i + 1}: expected object`);
            return {
                S: window.IO.parseNoteTuple(m.S, `Measure ${i + 1} S`),
                A: window.IO.parseNoteTuple(m.A, `Measure ${i + 1} A`),
                T: window.IO.parseNoteTuple(m.T, `Measure ${i + 1} T`),
                B: window.IO.parseNoteTuple(m.B, `Measure ${i + 1} B`),
                romanNumeral: typeof m.romanNumeral === "string" ? m.romanNumeral : "",
                cadence: typeof m.cadence === "string" ? m.cadence : "",
            };
        });

        const [tonic, mode] = data.key;
        state.mode = mode === "minor" ? "minor" : "major";
        state.fifths = M.tonicToFifths(tonic, state.mode);
        state.measures = measures;
        state.selectedNote = null;
        state.fixedNotes = new Set();
        state.studentCanGrade = data.studentCanGrade !== false;
        state.assignmentName = typeof data.assignmentName === "string" ? data.assignmentName : "";
        // Teacher import: replace whatever is in the field — empty for assignments,
        // populated for student submissions.
        state.studentName = typeof data.studentName === "string" ? data.studentName : "";

        // Restore solver hints so re-export keeps them.
        (data.fixedNotes || []).forEach((entry) => {
            if (Array.isArray(entry) && entry.length >= 2) {
                state.fixedNotes.add(fixedNoteKey(entry[0], entry[1]));
            }
        });

        updateKeyDisplay();
        updateAccidentalDisplay();
        updateMetaBar();
        window.Score.render();
    }

    // ──────────────────────────────────────────────
    // Meta bar
    // ──────────────────────────────────────────────
    function updateMetaBar() {
        const aInput = document.getElementById("assignment-name-input");
        const sInput = document.getElementById("student-name-input");
        const sField = document.getElementById("student-name-field");
        if (!aInput || !sInput || !sField) return;

        aInput.value = state.assignmentName || "";
        sInput.value = state.studentName || "";

        aInput.readOnly = false;
        aInput.classList.remove("locked");
        sInput.readOnly = true;
        sInput.classList.add("locked");
        sField.style.display = state.studentName ? "" : "none";
    }

    // ──────────────────────────────────────────────
    // Solver
    // ──────────────────────────────────────────────
    function buildHarmonyProblemPayload() {
        const key = currentKeyTuple();
        const score = state.measures.map((m) => ({
            S: m.S, A: m.A, T: m.T, B: m.B,
            romanNumeral: m.romanNumeral,
            key: key,
        }));

        const cadences = [];
        state.measures.forEach((m, i) => {
            if (m.cadence && m.cadence.trim()) {
                cadences.push([i, m.cadence.trim()]);
            }
        });

        const fixed_notes = [];
        state.fixedNotes.forEach((k) => {
            const [mi, v] = k.split(",");
            const measureIndex = parseInt(mi, 10);
            const note = state.measures[measureIndex]?.[v];
            if (note && Array.isArray(note)) {
                fixed_notes.push([measureIndex, v, note]);
            }
        });

        return { score, cadences, fixed_notes, fixed_chords: [] };
    }

    function validateForSolving() {
        if (state.measures.length === 0) return t("solve_no_measures");
        for (let i = 0; i < state.measures.length; i++) {
            const m = state.measures[i];
            if (!m.romanNumeral || !m.romanNumeral.trim()) {
                return t("solve_missing_rn", i + 1);
            }
        }
        return null;
    }

    function applySolvedScore(solvedMeasures) {
        if (!Array.isArray(solvedMeasures)) return;
        const newMeasures = solvedMeasures.map((sm, i) => {
            const existing = state.measures[i] || {};
            return {
                S: sm.S || null,
                A: sm.A || null,
                T: sm.T || null,
                B: sm.B || null,
                romanNumeral: sm.romanNumeral ?? existing.romanNumeral ?? "",
                cadence: existing.cadence || "",
            };
        });
        state.measures = newMeasures;
        state.selectedNote = null;
        if (state.fixedNotes.size > 0) {
            const valid = new Set();
            state.fixedNotes.forEach((k) => {
                const [mi, v] = k.split(",");
                const idx = parseInt(mi, 10);
                if (idx >= 0 && idx < state.measures.length && state.measures[idx][v]) {
                    valid.add(k);
                }
            });
            state.fixedNotes = valid;
        }
        updateAccidentalDisplay();
        window.Score.render();
    }

    async function runSolver() {
        const validationError = validateForSolving();
        if (validationError) {
            alert(validationError);
            return;
        }
        const btn = document.getElementById("solve-btn");
        btn.disabled = true;
        btn.textContent = t("solving_btn");
        try {
            const harmony_problem = buildHarmonyProblemPayload();
            const resp = await fetch("/api/solve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ harmony_problem }),
            });
            const data = await resp.json();
            if (!data.ok) {
                alert(t("grader_error") + (data.error || "Unknown error"));
                return;
            }
            if (!data.solved || !data.score) {
                alert(t("solve_no_solution"));
                return;
            }
            applySolvedScore(data.score);
        } catch (err) {
            alert(t("request_fail") + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = t("solve_btn");
        }
    }

    // ──────────────────────────────────────────────
    // Init
    // ──────────────────────────────────────────────
    function init() {
        try {
            // Score module: full editing privileges.
            window.Score.init({
                state,
                callbacks: {
                    canEditNote: () => true,
                    afterPlaceNote: () => {},
                    afterEraseNote: (m, v) => {
                        state.fixedNotes.delete(fixedNoteKey(m, v));
                    },
                    isRomanLocked: () => false,
                    isCadenceLocked: () => false,
                    getNoteOpts: (m, v) => ({ fixed: isNoteFixed(m, v) }),
                    showMeasureControls: () => true,
                    onInsertMeasure: insertMeasure,
                    onDeleteMeasure: deleteMeasure,
                    onSelectionChange: updateAccidentalDisplay,
                },
                labels: buildScoreLabels(),
            });

            // Playback wiring.
            window.Playback.init({
                getMeasures: () => state.measures,
                getLabel: (key) => t(key),
                getButton: () => document.getElementById("play-btn"),
                onError: (msg) => alert(msg),
            });

            // Grader wiring.
            window.Grader.init({
                getMeasures: () => state.measures,
                getKey: () => currentKeyTuple(),
                getString: (key, ...args) => t(key, ...args),
                getButton: () => document.getElementById("grade-btn"),
            });
            window.Grader.bindModalClose();

            // Voice buttons
            document.querySelectorAll(".voice-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    document.querySelectorAll(".voice-btn").forEach((b) => b.classList.remove("active"));
                    btn.classList.add("active");
                    state.selectedVoice = btn.dataset.voice;
                    state.selectedNote = null;
                    if (state.eraserMode) toggleEraserMode();
                    updateAccidentalDisplay();
                    window.Score.render();
                });
            });

            // Key buttons
            document.getElementById("key-down").addEventListener("click", () => changeKey(-1));
            document.getElementById("key-up").addEventListener("click", () => changeKey(1));
            document.getElementById("toggle-mode").addEventListener("click", toggleMode);

            // Accidental
            document.getElementById("acc-up").addEventListener("click", () => window.Score.changeAccidental(1));
            document.getElementById("acc-down").addEventListener("click", () => window.Score.changeAccidental(-1));
            updateAccidentalDisplay();

            // Fix
            document.getElementById("fix-btn").addEventListener("click", toggleNoteFixed);

            // Eraser
            document.getElementById("eraser-btn").addEventListener("click", toggleEraserMode);

            // Play
            document.getElementById("play-btn").addEventListener("click", () => window.Playback.toggle());

            // Meta-bar (assignment name editable; student name read-only)
            document.getElementById("assignment-name-input").addEventListener("input", (e) => {
                state.assignmentName = e.target.value;
            });

            // Export
            document.getElementById("export-btn").addEventListener("click", exportJSON);
            document.getElementById("export-allow-btn").addEventListener("click", () => {
                hideExportConfirmModal();
                doExportJSON(true);
            });
            document.getElementById("export-deny-btn").addEventListener("click", () => {
                hideExportConfirmModal();
                doExportJSON(false);
            });
            document.getElementById("export-confirm-close").addEventListener("click", hideExportConfirmModal);
            document.getElementById("export-confirm-modal").addEventListener("click", (e) => {
                if (e.target === document.getElementById("export-confirm-modal")) hideExportConfirmModal();
            });

            // Import
            const importInput = document.getElementById("import-file");
            document.getElementById("import-btn").addEventListener("click", () => {
                importInput.value = "";
                importInput.click();
            });
            importInput.addEventListener("change", (e) => {
                const f = e.target.files && e.target.files[0];
                if (f) importJSONFile(f);
            });

            // Language toggle
            document.getElementById("lang-btn").addEventListener("click", toggleLang);

            // Grader
            document.getElementById("grade-btn").addEventListener("click", () => window.Grader.run());

            // Solver
            document.getElementById("solve-btn").addEventListener("click", runSolver);

            // Initial paint
            updateAllText();
            updateKeyDisplay();
            updateMetaBar();
            window.Score.render();
        } catch (err) {
            console.error("Teacher init error:", err);
            const c = document.getElementById("score-container");
            if (c) c.textContent = "Initialization error: " + err.message;
        }
    }

    document.addEventListener("DOMContentLoaded", init);
})();
