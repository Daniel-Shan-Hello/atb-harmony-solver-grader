# Solver design

This note describes how [voice_solver.py](../voice_solver.py) generates an SATB realisation of a Roman-numeral skeleton. The tone is "research-prototype write-up", not a paper. All line numbers refer to [voice_solver.py](../voice_solver.py); the constraint oracle lives in [voice_grader.py](../voice_grader.py).

## 1. Problem definition

Input is a `harmony_problem` dict:

```python
{
    "score": [(S, A, T, B, romanNumeral, key), ...],   # any of S/A/T/B may be None
    "cadences": [(measure_index, "PAC" | "IAC" | "HC"), ...],
    "fixed_notes": [(measure_index, voice, (midi, letter, accidental)), ...],
    "fixed_chords": [(measure_index, romanNumeral), ...],   # rare, overrides RN
}
```

Output is a list of fully populated measure tuples (every voice is a non-`None` `(midi, letter, accidental)`). If no realisation is found, the solver returns `None`.

## 2. Two-stage decomposition

Searching all four voices simultaneously is combinatorially expensive: the chord realisation lattice is wide, the transition lattice is wider, and the part-writing rules cross-couple voices. Instead the solver decomposes the problem in time and in voice:

1. **Bass first.** [bass_dp](../voice_solver.py) (line 139) generates a bass line via beam search across measures. The bass alone is one-dimensional and admits a clean local cost (range, leap, gravity from fixed bass notes), so a small beam (`k = 80` by  in practice) usually contains a good line.
2. **SAT second.** For each candidate bass line, [SAT_solver](../voice_solver.py) (line 501) fills soprano / alto / tenor by another beam search across measures. Each beam state is a complete *path* of measures up to position `i`; transitions to position `i+1` are gated by the grader's transition rules.

Pseudocode:

```text
bass_beam = bass_dp(score)                              # ~80 lines
for (penalty, bass_line) in bass_beam:
    score' = score with bass filled
    if SAT_solver(score') succeeds:
        return score'
return None
```

This is "first feasible" at the bass level, but ranked by aesthetic + structural cost at the SAT level.

## 3. Structural-note attraction field

Some pitches are *given*: instructor-fixed notes from the assignment, plus solver-generated cadential soprano anchors (see §4). These are aggregated into a list of "structural notes":

```python
target = {
    "voice":          "S" | "A" | "T" | "B",
    "measure_index":  int,
    "note":           (midi, letter, accidental),
    "kind":           "fixed" | "cadence",
    "strength":       1.00 if kind=="fixed" else 0.82,
}
```

The cost function [voice_gravity_cost](../voice_solver.py) (line 393) makes every structural note exert a soft pull on every candidate pitch in the same voice:

```text
pull(voice, candidate, target) =
    VOICE_GRAVITY_WEIGHTS[voice]
  * STRUCTURAL_STRENGTH[target.kind]
  * future_multiplier(target, candidate.measure_index)
  / |target.measure_index - candidate.measure_index|
  * |candidate.pitch - target.pitch|
```

Two design decisions are worth flagging:

- **Future targets count more than past targets** (`future_multiplier = 1.15` vs `0.65`, line 422). Intuition: an upcoming fixed note should bend the line *toward* itself in advance; a past fixed note has already been satisfied and doesn't need to keep dragging the line back.
- **Per-voice gravity weights** (line 40): soprano = 1.00, alto/tenor = 0.72, bass = 0.45. The soprano is the most exposed line and benefits most from cadence/structural anchors; the bass already has its own dedicated DP and only needs a light gravity term to prefer routes that lead toward fixed bass arrivals.

The result is that the search behaves less like "fill in a slot" and more like "draw lines that pass through the given anchors".

## 4. Cadence-aware soprano planning

Before SAT search begins, [fix_cadence_sopranos](../voice_solver.py) (line 246) walks the cadence list and chooses concrete soprano pitches at each cadence point. The choice is delegated to [choose_structural_soprano](../voice_solver.py) (line 203), which:

- Restricts to pitches inside the soprano range (`VOICE_RANGES["S"] = (60, 79)`).
- Prefers an octave near the soprano comfort centre (`VOICE_COMFORT_CENTERS["S"] = 72`, with weight 0.35).
- If there are nearby instructor-fixed soprano notes, it prefers the octave that lies closest to them (so the cadential anchor extends a coherent line rather than jumping registers).

Cadence types map to scale-degree targets via standard tonal practice:
- **PAC / IAC**: tonic (with PAC requiring `do` in the soprano, IAC accepting third (mi), a future extension would allow chord fifth (sol)),
- **HC**: scale-degree 2, 5, or 7 over the dominant.

These chosen sopranos are added to the structural-note list with `strength = 0.82` (slightly weaker than instructor-fixed notes, since they are solver-generated). They then influence every other soprano choice through the gravity field of §3.

## 5. Phrase apex heuristic

[soprano_apex_cost](../voice_solver.py) (line 429) softly rewards a single melodic high point near the phrase's structural midpoint:

```python
apex_measure = (n_measures - 1) / 2.0
sigma = max(n_measures / 4.0, 1.0)
apex_strength = exp(-|measure_index - apex_measure| / sigma)
return -1.20 * apex_strength * (pitch - comfort_center)
```

The cost is *negative* near the apex (i.e. higher pitches there are cheaper) and falls off Gaussian-like toward the phrase boundaries. This is independent of the gravity field: the field pulls toward specific targets, while the apex shapes the overall phrase contour.

## 6. Aesthetic costs

In addition to the gravity field and the apex term, [vertical_aesthetic_cost](../voice_solver.py) (line 445) and [melodic_transition_cost](../voice_solver.py) (line 473) contribute:

- **Comfort zones.** Each voice has a centre pitch (`VOICE_COMFORT_CENTERS`); deviation is penalised with a small per-voice weight (`COMFORT_WEIGHTS`, line 438). Bass gets the strongest comfort weight, soprano the weakest, because the soprano needs freedom to reach the apex.
- **Vertical spacing.** Mild preference for compact upper voices (`0.08·(S−A) + 0.15·(A−T)`); hard penalties for unison stacking (`S=A`, `A=T`, `T=B`).
- **Melodic smoothness.** Per-voice leap penalties (soprano weight 0.3 with extra penalty above 4-semitone leaps; alto/tenor weight 0.55 with penalty above 5; bass already has its own leap term in `bass_dp` so it only adds a light 0.20 term here).
- **Range hard cuts.** [VOICE_RANGES](../voice_solver.py) (line 23) provides absolute clamps: S 60–79, A 55–74, T 48–67, B 40–62.

## 7. Grader as constraint oracle

The solver imports the grader directly (`import voice_grader as vg`, line 18) and reuses it during search:

- [chord_notes_from_rn](../voice_grader.py) parses `romanNumeral` strings (including secondary dominants, Neapolitan `bII`, augmented sixths, etc.) into the set of legal chord pitches per voice.
- [measure_internal_errors](../voice_solver.py) (line 303) and [transition_errors](../voice_solver.py) (line 365) call grader checks (`vc_checker`, `vg_checker`, `parallel_checker`, `direct_checker`, `overlap_checker`, `wb_checker`, `wn_checker`, `completion_checker`, `resolve_checker`) directly. Any candidate that produces an error in any category is dropped from the beam.

Practically this means: **the solver and the student-facing grader use exactly the same rule code.** A student's submission can only fail checks that, in principle, the solver would also fail. This rules out a class of pedagogical mismatches where automated feedback contradicts the supplied reference solution.

## 8. Limitations

- **No melodic contour beyond apex.** The soprano gets a single Gaussian apex term plus per-leap smoothness and gravity from anchors, but no model of phrase arch, sequential repetition, or motivic coherence.
- **Cadence inference is manual.** The user tags cadence locations explicitly. There is no automatic detection of cadential candidates from the Roman-numeral skeleton.
- **No corpus prior.** Every weight in the cost function is hand-tuned. A natural extension would learn voicing and motion preferences from a Bach-chorale or other tonal corpus.
- **First-feasible at the bass level.** The bass beam returns up to `k` candidates, but the outer loop returns the *first* bass line whose SAT search succeeds. This is fast in practice but does not always pick the best joint bass+SAT score.
- **Greedy beam pruning.** The SAT beam keeps the top `beam_width` paths per measure (default 500). Very tight rule conjunctions can in principle prune all paths; in that case the solver returns `None` and the teacher UI surfaces "no valid solution".
