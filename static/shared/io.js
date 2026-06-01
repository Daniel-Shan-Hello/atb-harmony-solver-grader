// ============================================================
// shared/io.js
// JSON file download + upload utilities. No state, no DOM globals.
// ============================================================

(function (global) {
    "use strict";

    // Strip filesystem-illegal characters and squash whitespace for use
    // as part of a download filename.
    function sanitizeForFilename(s) {
        return (s || "")
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
            .replace(/\s+/g, "_")
            .trim();
    }

    // Trigger a browser download of the given JSON-serialisable payload.
    function downloadJSON(payload, filename) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    // Read a user-selected File as JSON, calling onParsed with the parsed
    // object on success or onError(err) on any failure (parse or I/O).
    function readJSONFile(file, onParsed, onError) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                onParsed(data);
            } catch (err) {
                if (onError) onError(err);
            }
        };
        reader.onerror = () => {
            if (onError) onError(new Error("FileReader error"));
        };
        reader.readAsText(file);
    }

    // Validate a JSON note tuple (or null/undefined). Throws on bad shape.
    function parseNoteTuple(n, label) {
        if (n === null || n === undefined) return null;
        if (!Array.isArray(n) || n.length !== 3) {
            throw new Error(`${label}: expected [midi, letter, accidental] or null`);
        }
        return [n[0], n[1], n[2]];
    }

    global.IO = {
        sanitizeForFilename,
        downloadJSON,
        readJSONFile,
        parseNoteTuple,
    };
})(window);
