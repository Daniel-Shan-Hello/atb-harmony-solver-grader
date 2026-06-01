// ============================================================
// student/student.js
// Student-mode entry point. Lock semantics: anything the teacher
// pre-filled is read-only; the student fills in empty slots and
// edits only what they themselves added.
// ============================================================

(function () {
    "use strict";

    const M = window.Music;

    // ──────────────────────────────────────────────
    // State (lock fields, no fixedNotes)
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
        // Locks set when an assignment is imported.
        lockedNotes: new Set(),    // "m,v"
        lockedRN: new Set(),       // measureIndex
        lockedCad: new Set(),      // measureIndex
        lockedCount: false,        // forbids insert/delete
        studentAdded: new Set(),   // "m,v" — notes the student placed
        studentCanGrade: true,     // permission inherited from imported JSON
        assignmentName: "",
        studentName: "",
        measures: [emptyMeasure(), emptyMeasure(), emptyMeasure()],
    };

    function fixedNoteKey(m, v) { return `${m},${v}`; }
    function isNoteLocked(m, v) { return state.lockedNotes.has(fixedNoteKey(m, v)); }

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
            label_acc: "临时记号：",
            acc_down_title: "降半音 (最多重降)",
            acc_up_title: "升半音 (最多重升)",
            eraser_title: "橡皮擦：点击音符删除",
            eraser_active_title: "橡皮擦已开启 — 点击空白或再次点击按钮关闭",
            play_btn: "▶ Play",
            play_loading: "加载中...",
            play_stop: "■ Stop",
            export_btn: "导出 JSON",
            grade_btn: "Voice Grader",
            grading_btn: "检测中...",
            lang_btn: "EN",
            grade_title: "Voice Grader 结果",
            role_student: "学生端",
            locked_note_msg: "此内容由作业固定，不可修改。",
            locked_count_msg: "学生端不能增删小节。",
            export_no_data: "没有可导出的内容。",
            import_only_v1: "不支持的 JSON 版本（需要 version=1）。",
            import_bad_format: "JSON 格式不正确。",
            grader_disabled_msg: "本次作业未开启 Grader 权限。",
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
            label_acc: "Accidental:",
            acc_down_title: "Flatten (max double flat)",
            acc_up_title: "Sharpen (max double sharp)",
            eraser_title: "Eraser: click a note to delete",
            eraser_active_title: "Eraser ON — click a note to delete, or click button to exit",
            play_btn: "▶ Play",
            play_loading: "Loading...",
            play_stop: "■ Stop",
            export_btn: "Export JSON",
            grade_btn: "Voice Grader",
            grading_btn: "Grading...",
            lang_btn: "中文",
            grade_title: "Voice Grader Results",
            role_student: "Student",
            locked_note_msg: "This is fixed by the assignment.",
            locked_count_msg: "Students cannot add or remove measures.",
            export_no_data: "Nothing to export.",
            import_only_v1: "Unsupported JSON version (expected version=1).",
            import_bad_format: "Bad JSON format.",
            grader_disabled_msg: "Voice Grader is disabled for this assignment.",
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
        if (roleBadge) roleBadge.textContent = t("role_student");

        document.getElementById("label-voice").textContent = t("label_voice");
        document.getElementById("label-acc").textContent = t("label_acc");
        document.getElementById("acc-down").title = t("acc_down_title");
        document.getElementById("acc-up").title = t("acc_up_title");
        document.getElementById("play-btn").textContent =
            window.Playback.isPlaying() ? t("play_stop") : t("play_btn");
        const eraserBtn = document.getElementById("eraser-btn");
        if (eraserBtn) eraserBtn.title = state.eraserMode ? t("eraser_active_title") : t("eraser_title");
        document.getElementById("import-btn").textContent = t("import_btn");
        document.getElementById("export-btn").textContent = t("export_btn");
        document.getElementById("grade-btn").textContent = t("grade_btn");
        document.getElementById("lang-btn").textContent = t("lang_btn");
        document.querySelector("#grade-modal .modal-header h3").textContent = t("grade_title");

        document.querySelector('label[for="assignment-name-input"]').textContent = t("meta_assignment_label");
        document.querySelector('label[for="student-name-input"]').textContent = t("meta_student_label");
        document.getElementById("assignment-name-input").placeholder = t("meta_assignment_placeholder");
        document.getElementById("student-name-input").placeholder = t("meta_student_placeholder");

        updateKeyDisplay();

        window.Score.setLabels(buildScoreLabels());
        window.Score.render();
    }

    function buildScoreLabels() {
        return {
            romanPlaceholder: "—",
            cadencePlaceholder: t("cadence_placeholder"),
            cadenceTitle: t("cadence_title"),
            lockedTitle: t("locked_note_msg"),
            // Student never sees insert/delete buttons, but provide labels just in case.
            getInsertTitle: () => "",
            getDeleteTitle: () => "",
        };
    }

    function toggleLang() {
        currentLang = currentLang === "zh" ? "en" : "zh";
        updateAllText();
    }

    function updateKeyDisplay() {
        const tonic = currentTonic();
        const modeLabel = state.mode === "major" ? t("mode_major") : t("mode_minor");
        document.getElementById("key-display-readonly").textContent = `${tonic} ${modeLabel}`;
    }

    // ──────────────────────────────────────────────
    // Accidental display
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
            return;
        }

        const acc = noteData[2];
        display.textContent = ACC_LABELS[String(acc)] || "♮";
        upBtn.disabled = acc >= 2;
        downBtn.disabled = acc <= -2;
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
    // Lock checks (Score callbacks)
    // ──────────────────────────────────────────────
    function canEditNote(m, v) {
        if (isNoteLocked(m, v)) {
            showToast(t("locked_note_msg"));
            return false;
        }
        return true;
    }

    // ──────────────────────────────────────────────
    // Export / Import
    // ──────────────────────────────────────────────
    function exportJSON() {
        if (!state.measures.length) {
            alert(t("export_no_data"));
            return;
        }
        const payload = {
            version: 1,
            type: "submission",
            key: currentKeyTuple(),
            studentCanGrade: state.studentCanGrade !== false,
            assignmentName: state.assignmentName || "",
            studentName: state.studentName || "",
            measures: state.measures.map((m) => ({
                S: m.S || null,
                A: m.A || null,
                T: m.T || null,
                B: m.B || null,
                romanNumeral: m.romanNumeral || "",
                cadence: m.cadence || "",
            })),
            // Submissions don't carry solver hints.
            fixedNotes: [],
        };

        const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
        const aName = window.IO.sanitizeForFilename(state.assignmentName) || "untitled";
        const sName = window.IO.sanitizeForFilename(state.studentName) || "anonymous";
        const filename = `submission_${aName}_${sName}_${stamp}.json`;
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
        state.lockedNotes = new Set();
        state.lockedRN = new Set();
        state.lockedCad = new Set();
        state.studentAdded = new Set();
        state.studentCanGrade = data.studentCanGrade !== false;

        state.assignmentName = typeof data.assignmentName === "string" ? data.assignmentName : "";
        // Only adopt a non-empty student name from the file (so importing a fresh
        // assignment doesn't blank out a name the student already typed).
        if (typeof data.studentName === "string" && data.studentName.length > 0) {
            state.studentName = data.studentName;
        }

        // Lock everything the teacher already filled.
        state.lockedCount = true;
        state.measures.forEach((m, i) => {
            ["S", "A", "T", "B"].forEach((v) => {
                if (m[v]) state.lockedNotes.add(fixedNoteKey(i, v));
            });
            if (m.romanNumeral && m.romanNumeral.trim() !== "") {
                state.lockedRN.add(i);
            }
            if (m.cadence && m.cadence.trim() !== "") {
                state.lockedCad.add(i);
            }
        });
        // Solver-hint notes are also locked for the student.
        (data.fixedNotes || []).forEach((entry) => {
            if (Array.isArray(entry) && entry.length >= 2) {
                state.lockedNotes.add(fixedNoteKey(entry[0], entry[1]));
            }
        });

        updateKeyDisplay();
        updateAccidentalDisplay();
        updateGraderVisibility();
        updateMetaBar();
        window.Score.render();
    }

    // ──────────────────────────────────────────────
    // Grader visibility (depends on imported permission)
    // ──────────────────────────────────────────────
    function updateGraderVisibility() {
        const btn = document.getElementById("grade-btn");
        if (!btn) return;
        if (state.studentCanGrade === false) btn.style.display = "none";
        else btn.style.display = "";
    }

    // ──────────────────────────────────────────────
    // Meta bar
    // ──────────────────────────────────────────────
    function updateMetaBar() {
        const aInput = document.getElementById("assignment-name-input");
        const sInput = document.getElementById("student-name-input");
        if (!aInput || !sInput) return;
        aInput.value = state.assignmentName || "";
        sInput.value = state.studentName || "";

        aInput.readOnly = true;
        aInput.classList.add("locked");
        sInput.readOnly = false;
        sInput.classList.remove("locked");
    }

    // ──────────────────────────────────────────────
    // Init
    // ──────────────────────────────────────────────
    function init() {
        try {
            window.Score.init({
                state,
                callbacks: {
                    canEditNote: canEditNote,
                    afterPlaceNote: (m, v) => {
                        state.studentAdded.add(fixedNoteKey(m, v));
                    },
                    afterEraseNote: (m, v) => {
                        state.studentAdded.delete(fixedNoteKey(m, v));
                    },
                    isRomanLocked: (m) => state.lockedRN.has(m),
                    isCadenceLocked: (m) => state.lockedCad.has(m),
                    getNoteOpts: (m, v) => ({ fixed: isNoteLocked(m, v) }),
                    showMeasureControls: () => !state.lockedCount,
                    onInsertMeasure: () => {
                        if (state.lockedCount) showToast(t("locked_count_msg"));
                    },
                    onDeleteMeasure: () => {
                        if (state.lockedCount) showToast(t("locked_count_msg"));
                    },
                    onSelectionChange: updateAccidentalDisplay,
                },
                labels: buildScoreLabels(),
            });

            window.Playback.init({
                getMeasures: () => state.measures,
                getLabel: (key) => t(key),
                getButton: () => document.getElementById("play-btn"),
                onError: (msg) => alert(msg),
            });

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

            // Accidental
            document.getElementById("acc-up").addEventListener("click", () => window.Score.changeAccidental(1));
            document.getElementById("acc-down").addEventListener("click", () => window.Score.changeAccidental(-1));
            updateAccidentalDisplay();

            // Eraser
            document.getElementById("eraser-btn").addEventListener("click", toggleEraserMode);

            // Play
            document.getElementById("play-btn").addEventListener("click", () => window.Playback.toggle());

            // Meta-bar (student name editable; assignment name locked)
            document.getElementById("student-name-input").addEventListener("input", (e) => {
                state.studentName = e.target.value;
            });

            // Export / Import
            document.getElementById("export-btn").addEventListener("click", exportJSON);
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

            // Initial paint
            updateAllText();
            updateKeyDisplay();
            updateGraderVisibility();
            updateMetaBar();
            window.Score.render();
        } catch (err) {
            console.error("Student init error:", err);
            const c = document.getElementById("score-container");
            if (c) c.textContent = "Initialization error: " + err.message;
        }
    }

    document.addEventListener("DOMContentLoaded", init);
})();
