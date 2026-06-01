// ============================================================
// shared/grader.js
// Voice Grader: validates the score, calls POST /api/grade,
// renders the result modal. Mode-agnostic (state is injected).
// ============================================================

(function (global) {
    "use strict";

    // Injected by host:
    let _getMeasures = () => [];
    let _getKey = () => ["C", "major"];
    // i18n hook. Returns either a string or, for templated keys
    // ("missing_voice", "missing_rn", "grade_fail"), a function. When given
    // extra args, the host wrapper should call the returned function and
    // return the resulting string.
    let _getString = (key) => key;
    let _getButton = () => document.getElementById("grade-btn");

    function init({ getMeasures, getKey, getString, getButton } = {}) {
        if (typeof getMeasures === "function") _getMeasures = getMeasures;
        if (typeof getKey === "function") _getKey = getKey;
        if (typeof getString === "function") _getString = getString;
        if (typeof getButton === "function") _getButton = getButton;
    }

    function buildScorePayload() {
        const key = _getKey();
        return _getMeasures().map((m) => ({
            S: m.S,
            A: m.A,
            T: m.T,
            B: m.B,
            romanNumeral: m.romanNumeral,
            key: key,
        }));
    }

    function validate() {
        const measures = _getMeasures();
        for (let i = 0; i < measures.length; i++) {
            const m = measures[i];
            if (!m.S || !m.A || !m.T || !m.B) {
                return _getString("missing_voice", i + 1);
            }
            if (!m.romanNumeral || m.romanNumeral.trim() === "") {
                return _getString("missing_rn", i + 1);
            }
        }
        return null;
    }

    async function run() {
        const validationError = validate();
        if (validationError) {
            alert(validationError);
            return;
        }

        const btn = _getButton();
        if (btn) {
            btn.disabled = true;
            btn.textContent = _getString("grading_btn");
        }

        try {
            const payload = buildScorePayload();
            const resp = await fetch("/api/grade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ score: payload }),
            });
            const data = await resp.json();

            if (!data.ok) {
                alert(_getString("grader_error") + (data.error || "Unknown error"));
                return;
            }

            displayResults(data.results);
        } catch (err) {
            alert(_getString("request_fail") + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = _getString("grade_btn");
            }
        }
    }

    function getCategoryLabel(cat) {
        return _getString("cat_" + cat);
    }

    function displayResults(results) {
        const container = document.getElementById("grade-results");
        container.innerHTML = "";

        let totalErrors = 0;
        for (const k in results) totalErrors += results[k].length;

        const summary = document.createElement("div");
        summary.className = "grade-summary " + (totalErrors === 0 ? "pass" : "fail");
        const failCats = Object.keys(results).filter((k) => results[k].length > 0).length;
        summary.textContent = totalErrors === 0
            ? _getString("grade_pass")
            : _getString("grade_fail", totalErrors, failCats);
        container.appendChild(summary);

        const categoryOrder = [
            "wb", "wn", "completion", "vr", "vc", "vg",
            "parallel", "direct", "overlap", "leap", "resolve",
        ];
        for (const cat of categoryOrder) {
            const errors = results[cat] || [];
            const section = document.createElement("div");
            section.className = "grade-category";

            const header = document.createElement("div");
            header.className = "grade-category-header";
            const badge = document.createElement("span");
            badge.className = "badge" + (errors.length === 0 ? " zero" : "");
            badge.textContent = errors.length;
            header.appendChild(badge);
            const label = document.createElement("span");
            label.textContent = getCategoryLabel(cat);
            header.appendChild(label);
            section.appendChild(header);

            if (errors.length > 0) {
                const ul = document.createElement("ul");
                ul.className = "grade-error-list";
                for (const err of errors) {
                    // err = [type, voices, measureIndex, detail]
                    const li = document.createElement("li");
                    const mTag = document.createElement("span");
                    mTag.className = "measure-tag";
                    mTag.textContent = `m.${(err[2] ?? 0) + 1}`;
                    li.appendChild(mTag);

                    if (err[1]) {
                        const vTag = document.createElement("span");
                        vTag.className = "voice-tag";
                        vTag.textContent = Array.isArray(err[1]) ? err[1].join(", ") : err[1];
                        li.appendChild(vTag);
                    }

                    const desc = document.createTextNode(
                        err[0] + (err[3] ? ` — ${err[3]}` : "")
                    );
                    li.appendChild(desc);
                    ul.appendChild(li);
                }
                section.appendChild(ul);
            }

            container.appendChild(section);
        }

        document.getElementById("grade-modal").style.display = "flex";
    }

    function bindModalClose() {
        const closeBtn = document.getElementById("grade-modal-close");
        const modal = document.getElementById("grade-modal");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                modal.style.display = "none";
            });
        }
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) modal.style.display = "none";
            });
        }
    }

    global.Grader = {
        init,
        run,
        validate,
        bindModalClose,
    };
})(window);
