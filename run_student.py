"""Student launcher — Grader only (Solver not loaded).

Run:  python run_student.py
URL:  http://127.0.0.1:5001/

This script doubles as the PyInstaller entry point for HarmonyStudent.exe.
"""

import threading
import time
import webbrowser

from app import create_app

PORT = 5001
URL = f"http://127.0.0.1:{PORT}/"


def _open_browser():
    time.sleep(1.2)
    try:
        webbrowser.open(URL)
    except Exception:
        pass


if __name__ == "__main__":
    print("SATB Harmony  -  Student mode")
    print(f"Server: {URL}")
    print("Close this window (or press Ctrl+C) to stop.")
    print()
    threading.Thread(target=_open_browser, daemon=True).start()
    create_app("student").run(
        host="127.0.0.1",
        port=PORT,
        debug=False,
        use_reloader=False,
    )
