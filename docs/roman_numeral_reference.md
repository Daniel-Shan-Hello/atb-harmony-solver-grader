# Supported Roman Numerals

This note lists all the available Roman Numerals that can be successfully parsed by the Voice Grader (`voice_grader.py`):

## Symbol structure

A Roman-numeral symbol is built from up to five optional parts, in this order:

​```
[b][Roman numeral][quality modifier][inversion][/target]
​```

For example: `V` (just the Roman numeral), `V7` (with inversion), `bIII6` (with `b` prefix and inversion), `viiø43` (with quality modifier and inversion), `V65/ii` (a full secondary chord).

| Part | Examples | Meaning |
|---|---|---|
| `b` | `bII`, `bIII`, `bVI` | Lowered scale degree: Neapolitan (`bII`) or modal mixture (`bIII`, `bVI`) |
| Roman numeral | `I`–`VII`, `i`–`vii` | Uppercase = major (dominant quality for `V`); lowercase = minor |
| Quality modifier | `°` or `o`, `ø`, `+` | Overrides case default: diminished, half-diminished, augmented |
| Inversion | `6`, `64` / `7`, `65`, `43`, `42` | Triad inversion / seventh-chord root and inversion |
| `/target` | `/V`, `/ii`, `/IV` | Secondary chord targeting another scale degree |

Most well-formed combinations of these parts are parsed, but the recommended input set is listed below.

**Case convention**: uppercase = major triad (or dominant quality for `V`); lowercase = minor. Quality modifiers override the case default.

**Inversion encoding**: `6` / `64` are triadic inversions; `7` / `65` / `43` / `42` add a seventh and indicate inversion. Any well-formed combination of the parts above is parsed — for example `V65/ii`, `bIII6`, `viiø43`, `III+6`.

---

## Special chords

Three chord types have non-standard syntax:

**Neapolitan**: `bII` or `bII6`. Tagged separately from ordinary `b`-prefix chords so the resolve checker can enforce its characteristic voice-leading (b2 → 7).

**Modal mixture**: `bIII` and `bVI`, with optional inversion or seventh (e.g. `bVI6`, `bIII7`). Only these two degrees are recognized as modal mixture in major keys.

**Augmented sixth**: only three exact forms are recognized — `It6`, `Fr43`, `Ger65`. No inversions, no alternate spellings.

---

## Secondary chords

Format: `base/target`. The base can be any standard chord; the target follows these restrictions:

- Quality must be `maj`, `min`, or `dom` — so no diminished, half-diminished, augmented, or augmented-sixth targets
- Cannot be a seventh chord (`V/V7` is invalid)
- Nested secondaries (`V/V/V`) are not supported

The **Neapolitan** is supported as a secondary target: `V/bII`, `V7/bII`, and `viio7/bII` all resolve correctly, treating bII as a temporary tonic raised by a semitone. This enables progressions like `V7/bII → bII6 → ...`.

Typical bases are dominants (`V`, `V7` and inversions) and secondary leading-tone chords (`vii°`, `vii°7`, `viiø7` and inversions). Typical targets are `ii`, `iii`, `IV`, `V`, `vi`, and the modal-mixture chords `bIII`, `bVI`.

---

## Limitations

- **Augmented-sixth chords have no inversions** — only `It6`, `Fr43`, `Ger65`.
- **No augmented seventh chords** — `+` combined with `7` still produces a triad.
- **`b` prefix is only meaningful for `bII`, `bIII`, `bVI`.** Other forms (`bV`, `bVII`) are silently parsed as Neapolitan.
- **Half-diminished requires the `ø` glyph** — no ASCII fallback.