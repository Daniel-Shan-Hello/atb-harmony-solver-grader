"""Flask application factory.

Two completely separate launchers (`run_teacher.py` and `run_student.py`)
each call ``create_app(role)`` to build their own Flask instance:

* ``create_app("teacher")`` — serves the teacher UI at ``/`` plus both
  ``/api/grade`` and ``/api/solve``; loads voice_solver.
* ``create_app("student")`` — serves the student UI at ``/`` plus only
  ``/api/grade``; never touches voice_solver.

Run them on different ports (5000 / 5001) and they're independent
processes that happen to share this codebase.
"""

import importlib.util
import io
import os
import sys
import traceback

from flask import Flask, render_template, request, jsonify

if getattr(sys, "frozen", False):
    _BASE_DIR = sys._MEIPASS
else:
    _BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_module_from_file(module_name, file_path):
    """Load a Python file as a module, suppressing stdout during import.

    Registers the module in sys.modules under module_name so other modules
    can ``import module_name`` (the solver depends on this).
    """
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module  # register BEFORE exec for cross-imports
    _old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        spec.loader.exec_module(module)
    finally:
        sys.stdout = _old_stdout
    return module


# voice_grader is needed by both apps (the student runs it for self-check, the
# teacher runs it on submitted assignments). Load it once at module scope.
_vg_module = _load_module_from_file(
    "voice_grader",
    os.path.join(_BASE_DIR, "voice_grader.py"),
)
voice_grader = _vg_module.voice_grader

# voice_solver is loaded lazily inside create_app("teacher") so that the
# student app never imports it.
_voice_solver = None


def _ensure_solver():
    global _voice_solver
    if _voice_solver is None:
        vs_module = _load_module_from_file(
            "voice_solver",
            os.path.join(_BASE_DIR, "voice_solver.py"),
        )
        _voice_solver = vs_module.voice_solver
    return _voice_solver


def _parse_note(raw):
    if raw is None:
        return None
    if not (isinstance(raw, (list, tuple)) and len(raw) == 3):
        raise ValueError(f"Bad note format: {raw}")
    return (int(raw[0]), str(raw[1]), int(raw[2]))


def _parse_measure(m, idx):
    S = _parse_note(m.get("S"))
    A = _parse_note(m.get("A"))
    T = _parse_note(m.get("T"))
    B = _parse_note(m.get("B"))
    rn = m.get("romanNumeral", "") or ""
    key_raw = m.get("key", ["C", "major"])
    if not (isinstance(key_raw, (list, tuple)) and len(key_raw) == 2):
        raise ValueError(f"Measure {idx + 1}: invalid key")
    key = (str(key_raw[0]), str(key_raw[1]))
    return (S, A, T, B, rn, key)


def _measure_to_json(m):
    """Convert a solver-output measure tuple to a JSON-friendly dict.

    Defensive against any future shape change beyond the documented
    [S, A, T, B, rn, key] tuple.
    """
    if not (isinstance(m, (list, tuple)) and len(m) >= 6):
        raise ValueError(f"Bad measure shape from solver: {m!r}")
    S, A, T, B, rn, key = m[0], m[1], m[2], m[3], m[4], m[5]

    def note_to_json(n):
        if n is None:
            return None
        if not (isinstance(n, (list, tuple)) and len(n) == 3):
            raise ValueError(f"Bad note shape from solver: {n!r}")
        return [int(n[0]), str(n[1]), int(n[2])]

    if not (isinstance(key, (list, tuple)) and len(key) == 2):
        raise ValueError(f"Bad key shape from solver: {key!r}")
    return {
        "S": note_to_json(S),
        "A": note_to_json(A),
        "T": note_to_json(T),
        "B": note_to_json(B),
        "romanNumeral": str(rn) if rn is not None else "",
        "key": [str(key[0]), str(key[1])],
    }


def create_app(role):
    """Build and return a Flask app configured for the given role.

    Args:
        role: ``"teacher"`` or ``"student"``.
    """
    if role not in ("teacher", "student"):
        raise ValueError(f"Unknown role: {role!r} (expected 'teacher' or 'student')")

    app = Flask(
        __name__,
        template_folder=os.path.join(_BASE_DIR, "templates"),
        static_folder=os.path.join(_BASE_DIR, "static"),
    )
    app.config["ROLE"] = role

    template_name = "teacher.html" if role == "teacher" else "student.html"

    @app.route("/")
    def home():
        return render_template(template_name)

    @app.route("/api/grade", methods=["POST"])
    def grade():
        data = request.get_json(force=True)
        raw_score = data.get("score", [])
        try:
            score = [_parse_measure(m, i) for i, m in enumerate(raw_score)]
            results = voice_grader(score)
            serialisable = {k: [list(e) for e in errors] for k, errors in results.items()}
            return jsonify({"ok": True, "results": serialisable})
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 400

    if role == "teacher":
        solver = _ensure_solver()

        @app.route("/api/solve", methods=["POST"])
        def solve():
            data = request.get_json(force=True)
            raw_problem = data.get("harmony_problem", {})

            try:
                raw_score = raw_problem.get("score", [])
                score = [_parse_measure(m, i) for i, m in enumerate(raw_score)]

                cadences = []
                for c in raw_problem.get("cadences", []) or []:
                    if isinstance(c, (list, tuple)) and len(c) >= 2:
                        cadences.append((int(c[0]), str(c[1])))

                fixed_notes = []
                for fn in raw_problem.get("fixed_notes", []) or []:
                    if isinstance(fn, (list, tuple)) and len(fn) >= 3:
                        fixed_notes.append((int(fn[0]), str(fn[1]), _parse_note(fn[2])))

                fixed_chords = []
                for fc in raw_problem.get("fixed_chords", []) or []:
                    if isinstance(fc, (list, tuple)) and len(fc) >= 2:
                        fixed_chords.append((int(fc[0]), str(fc[1])))

                harmony_problem = {
                    "score": score,
                    "cadences": cadences,
                    "fixed_notes": fixed_notes,
                    "fixed_chords": fixed_chords,
                }
            except Exception as e:
                return jsonify({"ok": False, "error": f"Invalid input: {e}"}), 400

            try:
                solved = solver(harmony_problem)
            except Exception as e:
                traceback.print_exc()
                return jsonify({"ok": False, "error": f"Solver error: {e}"}), 500

            if solved is None:
                return jsonify({"ok": True, "solved": False, "score": None})

            try:
                if not isinstance(solved, (list, tuple)):
                    raise ValueError("Solver returned non-list output")
                json_score = [_measure_to_json(m) for m in solved]
            except Exception as e:
                traceback.print_exc()
                return jsonify({"ok": False, "error": f"Bad solver output: {e}"}), 500

            return jsonify({"ok": True, "solved": True, "score": json_score})

    return app


if __name__ == "__main__":
    print("This module is the Flask app factory.")
    print("Use `python run_teacher.py` (port 5000) or `python run_student.py` (port 5001).")
