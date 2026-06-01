# JSON file format

The teacher and student apps exchange data through two kinds of JSON document. Both share a single schema; only the value of `type` and which fields are typically populated differ.

## Common schema (version 1)

```jsonc
{
    "version": 1,
    "type": "assignment",                   // or "submission",
    "key": ["C", "major"],                  // tonic + mode
    "studentCanGrade": true,                // teacher's grader-permission choice
    "assignmentName": "Phrase 1 in C major",
    "studentName": "",                      // empty on assignments, filled on submissions

    "measures": [
        {
            "S": [72, "C", 0],              // [midi_pitch, letter, accidental] | null
            "A": [67, "G", 0],
            "T": [64, "E", 0],
            "B": [60, "C", 0],
            "romanNumeral": "I",
            "cadence": ""                   // optional cadence tag: "PAC" | "IAC" | "HC" | ""
        }
        // ...
    ],

    "fixedNotes": [                         // teacher-supplied solver hints
        [0, "B"]                            // [measure_index, voice]
    ]
}
```

### Field semantics

| Field | Type | Notes |
|---|---|---|
| `version` | int | Currently `1`. Importers reject any other value. |
| `type` | string | `"assignment"` (teacher export) or `"submission"` (student export). The student app does not require a specific type and treats any imported JSON as an assignment. |
| `key` | `[tonic, mode]` | `tonic` is a letter optionally followed by `#` or `b` (e.g. `"F#"`, `"Eb"`); `mode` is `"major"` or `"minor"`. |
| `studentCanGrade` | bool | If `false`, the student UI hides the Voice Grader button after import. Teachers always have the grader. |
| `assignmentName` | string | Used in the export filename and shown in the meta bar. |
| `studentName` | string | Empty on assignments; populated on submissions. The teacher app shows it after importing a submission. |
| `measures[i].S/A/T/B` | `[midi, letter, acc]` or `null` | `midi` is an integer, `letter` one of `A–G`, `acc` is `-2..2` (double-flat to double-sharp). `null` means the slot is empty. |
| `measures[i].romanNumeral` | string | Free-form; the grader and solver interpret syntax like `V65`, `viio`, `bII6` (Neapolitan), `It6` etc. See [voice_grader.py](../voice_grader.py) `parse_rn`. |
| `measures[i].cadence` | string | Optional tag. The solver reads `"PAC"`, `"IAC"`, `"HC"` to plant cadence-aware soprano anchors; the grader ignores it. |
| `fixedNotes` | `[[measure_index, voice], ...]` | Teacher-fixed slot identifiers. Empty in submissions (the schema reserves the field but students do not author solver hints). |

### Note tuple

Every voice slot is either `null` or a length-3 tuple `[midi, letter, accidental]`:

```jsonc
[60, "C", 0]    // middle C
[66, "F", 1]    // F#4
[66, "G", -1]   // Gb4 — same pitch as above, different spelling
```

The redundancy between `midi` and `letter+accidental` is intentional. It distinguishes enharmonic spellings (`F#4` vs `Gb4`) which are pitch-identical but functionally distinct in tonal harmony, while keeping playback simple (just read the `midi`). The invariant is

```
For a note (midi, letter, accidental), the spelling must agree with the pitch:
    midi % 12 == (LETTER_TO_SEMITONE[letter] + accidental) % 12
where LETTER_TO_SEMITONE = {C:0, D:2, E:4, F:5, G:7, A:9, B:11}.
```

---

## Assignment example

A 3-measure I–V–I in C major with one fixed bass note in measure 1 and a PAC tag on measure 3:

```json
{
    "version": 1,
    "type": "assignment",
    "key": ["C", "major"],
    "studentCanGrade": true,
    "assignmentName": "Phrase 1 in C major",
    "studentName": "",
    "measures": [
        {"S": null, "A": null, "T": null, "B": [48, "C", 0], "romanNumeral": "I", "cadence": ""},
        {"S": null, "A": null, "T": null, "B": null,        "romanNumeral": "V", "cadence": ""},
        {"S": null, "A": null, "T": null, "B": null,        "romanNumeral": "I", "cadence": "PAC"}
    ],
    "fixedNotes": [[0, "B"]]
}
```

A live example is in [examples/assignments/sample_assignment.json](../examples/assignments/sample_assignment.json).

---

## Submission example

The same assignment after a student fills in all four voices:

```json
{
    "version": 1,
    "type": "submission",
    "key": ["C", "major"],
    "studentCanGrade": true,
    "assignmentName": "Phrase 1 in C major",
    "studentName": "Alex Chen",
    "measures": [
        {"S": [72, "C", 0], "A": [67, "G", 0], "T": [64, "E", 0], "B": [48, "C", 0], "romanNumeral": "I", "cadence": ""},
        {"S": [71, "B", 0], "A": [67, "G", 0], "T": [62, "D", 0], "B": [43, "G", 0], "romanNumeral": "V", "cadence": ""},
        {"S": [72, "C", 0], "A": [67, "G", 0], "T": [64, "E", 0], "B": [48, "C", 0], "romanNumeral": "I", "cadence": "PAC"}
    ],
    "fixedNotes": []
}
```

A live example is in [examples/submissions/sample_submission.json](../examples/submissions/sample_submission.json).

---

## Lock rules in the student app

When the student app imports any JSON document, it walks the `measures` array and locks every non-empty field:

| Imported field | Lock effect |
|---|---|
| `measures[i].S/A/T/B` non-null | That voice slot becomes read-only; eraser, click-to-place, accidental shift, and arrow-key nudge are all blocked. |
| `measures[i].romanNumeral` non-empty | The Roman-numeral input is `readonly` and visually muted. |
| `measures[i].cadence` non-empty | The cadence input is `readonly` and visually muted. |
| `fixedNotes[]` entries | Each `[m, v]` becomes a note lock even if the voice slot itself happens to be empty (this preserves teacher-supplied solver hints across re-export). |
| any non-empty measure list | `lockedCount = true`; the student cannot insert or delete measures. |

In the teacher app, no lock is applied on import — the teacher can always edit. Solver hints (`fixedNotes`) are restored so a re-export keeps them.

---

## File naming

The export buttons follow these conventions:

- `assignment_<assignmentName>_<YYYYMMDDHHMM>.json`
- `submission_<assignmentName>_<studentName>_<YYYYMMDDHHMM>.json`

Filesystem-illegal characters in names are stripped and whitespace is collapsed to underscores; missing names fall back to `untitled` / `anonymous`.
