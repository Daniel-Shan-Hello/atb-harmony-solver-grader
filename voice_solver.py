# definition of score, measure, and notes:
# 1. score: a list of measures
# 2. measure: a tuple constructed with four notes in the order of SATB,
#    the Roman-numeral, and the current key, which is a tuple. ex. ("C", "major")
# 3. notes: a tuple with the pitch (int, midi convention),
#    the letter (as "string"), and the accidental(-2, -1, 0, 1 ,2)

# definition of harmony_problem as dictionary:
# "score": the score of the harmony problem
# "cadences": a list of all cadences, cadence form as a tuple of measure_index and cadence type. ex (2, "PAC")
# "fixed_notes": a list of note-information that are already fixed(i.e. by the instructor)
# note information is defined as tuple of measure_index, voice, and note (definition of note defined above).
# "fixed_chords": a list of chord-information that are already fixed(i.e. by the instructor)
# chord-information is defined as a tuple of measure_index and rn ex.(2, "V")

import copy
import math
import voice_grader as vg

voice_to_index = {"S": 0, "A": 1, "T": 2, "B": 3}
index_to_voice = {0: "S", 1: "A", 2: "T", 3: "B"}

VOICE_RANGES = {
    "S": (60, 79),
    "A": (55, 74),
    "T": (48, 67),
    "B": (40, 62),
}

# Aesthetic/comfort centers. These are not hard rules.
VOICE_COMFORT_CENTERS = {
    "S": 72,   # C5
    "A": 64,   # E4
    "T": 57,   # A3
    "B": 53,   # F3
}

# Gravity weights. Fixed notes are stronger; cadence-generated soprano notes are
# slightly softer because they are structural choices made by the solver.
VOICE_GRAVITY_WEIGHTS = {
    "S": 1.00,
    "A": 0.72,
    "T": 0.72,
    "B": 0.45,
}

STRUCTURAL_STRENGTH = {
    "fixed": 1.00,
    "cadence": 0.82,
}

# Basic helpers
# input: the raw_note, the low and high boundary
# output: result_notes (a list) that lies in the boundary

def note_construction(note_raw, low, high):
    pitch_raw = note_raw[0]
    letter = note_raw[1]
    accidental = note_raw[2]
    result_notes = []
    for pitch in range(low, high + 1):
        if pitch % 12 == pitch_raw % 12:
            result_notes.append((pitch, letter, accidental))
    return result_notes


def sort_notes_by_range(notes_list, low, high):
    def get_distance(x):
        pitch = x[0]
        return max(low - pitch, 0, pitch - high)
    return sorted(notes_list, key=get_distance)


def calculate_range_penalty(pitch, low, high):
    if low <= pitch <= high:
        return 0
    if pitch > high:
        return pitch - high
    return low - pitch


def fixed_note_lookup(fixed_notes):
    result = {}
    for measure_index, voice, note in fixed_notes:
        result[(measure_index, voice)] = note
    return result


def make_structural_note(measure_index, voice, note, kind="fixed", strength=None):
    if strength is None:
        strength = STRUCTURAL_STRENGTH.get(kind, 1.0)
    return {
        "measure_index": measure_index,
        "voice": voice,
        "note": note,
        "kind": kind,
        "strength": strength,
    }


def build_structural_notes(fixed_notes, cadence_structural_notes=None):
    """Return all attractors used by the solver's gravity field.

    Fixed notes attract their own voice. Cadence-generated soprano notes are
    added as softer structural points, which means they shape the melody even
    before the cadence arrives.
    """
    result = []
    seen = set()

    for measure_index, voice, note in fixed_notes:
        key = (measure_index, voice, note, "fixed")
        if key not in seen:
            result.append(make_structural_note(measure_index, voice, note, "fixed"))
            seen.add(key)

    for item in cadence_structural_notes or []:
        measure_index, voice, note = item
        key = (measure_index, voice, note, "cadence")
        if key not in seen:
            result.append(make_structural_note(measure_index, voice, note, "cadence"))
            seen.add(key)

    return sorted(result, key=lambda x: (x["measure_index"], x["voice"], -x["strength"]))


def notes_equal(n1, n2):
    return n1 == n2


def all_errors_empty(error_dict):
    return all(len(v) == 0 for v in error_dict.values())


# Bass line generator
# input: the work_score, fixed_notes
# output: a list of possible bass line (range based on artistic), length = k

def bass_dp(work_score, k=10, structural_notes=None):
    """Generate bass-line candidates with both local smoothness and gravity.

    The old version only knew about the previous bass and comfort zone. This
    version also lets fixed bass notes act as attractors, so the line can begin
    preparing before it reaches a fixed destination.
    """
    comfort_zone = (46, 57)
    structural_notes = structural_notes or []
    beam = []  # tuple of (penalty_sum, note_list)

    def bass_gravity(pitch, measure_index):
        return voice_gravity_cost("B", pitch, measure_index, structural_notes)

    for measure_index in range(len(work_score)):
        measure = work_score[measure_index]
        rn_symbol = measure[4]
        key = measure[5]
        chord_notes = vg.chord_notes_from_rn(rn_symbol, key)
        bass_raw = chord_notes[0]
        bass_low, bass_high = VOICE_RANGES["B"]
        possible_bass = note_construction(bass_raw, bass_low, bass_high)
        if measure[3] is not None:
            if measure[3][0] < bass_low or measure[3][0] > bass_high:
                raise ValueError(f"Fixed Bass out of Range in measure: {measure_index}")
            possible_bass = [measure[3]]
        if measure_index == 0:
            possible_bass = sort_notes_by_range(possible_bass, comfort_zone[0], comfort_zone[1])
            for bass in possible_bass:
                bass_pitch = bass[0]
                range_penalty = calculate_range_penalty(bass_pitch, comfort_zone[0], comfort_zone[1])
                gravity_penalty = bass_gravity(bass_pitch, measure_index)
                beam.append((range_penalty + gravity_penalty, [bass]))
        else:
            new_beam = []
            for penalty_sum, prev_bass_notes in beam:
                prev_bass_note = prev_bass_notes[-1]
                prev_bass_pitch = prev_bass_note[0]
                for curr_bass_note in possible_bass:
                    curr_bass_pitch = curr_bass_note[0]
                    leap_penalty = abs(curr_bass_pitch - prev_bass_pitch)
                    range_penalty = calculate_range_penalty(curr_bass_pitch, comfort_zone[0], comfort_zone[1])
                    gravity_penalty = bass_gravity(curr_bass_pitch, measure_index)
                    overall_penalty = leap_penalty + range_penalty + gravity_penalty
                    new_beam.append((penalty_sum + overall_penalty, prev_bass_notes + [curr_bass_note]))
            beam = sorted(new_beam)[:k]
    return beam


# input: a list of fixed_notes and the target measure_index
# output: a tuple of fixed_notes that is nearest to measure_index, one left, one right.
# None if not exist.

def find_nearest_fixed_notes(fixed_notes, measure_index, voice=None):
    if voice is not None:
        fixed_notes = [fn for fn in fixed_notes if fn[1] == voice]
    left_candidates = [fn for fn in fixed_notes if fn[0] < measure_index]
    right_candidates = [fn for fn in fixed_notes if fn[0] > measure_index]
    left_nearest = max(left_candidates, key=lambda x: x[0]) if left_candidates else None
    right_nearest = min(right_candidates, key=lambda x: x[0]) if right_candidates else None
    return left_nearest, right_nearest


# Soprano structural points: fixed notes + cadential soprano notes
def choose_structural_soprano(work_score, measure_index, raw_note, soprano_fixed_notes):
    """Choose an actual octave for a cadential soprano pitch class.

    This follows the idea you described earlier:
    - respect range;
    - prefer comfort;
    - if nearby fixed soprano notes exist, choose an octave that points toward them;
    - otherwise pick near the soprano comfort center.
    """
    soprano_low, soprano_high = VOICE_RANGES["S"]
    candidates = note_construction(raw_note, soprano_low, soprano_high)
    left_fixed, right_fixed = find_nearest_fixed_notes(soprano_fixed_notes, measure_index, "S")

    best_cost = None
    best_soprano = None
    comfort_center = VOICE_COMFORT_CENTERS["S"]

    for cand in candidates:
        cand_midi = cand[0]
        cost = 0.0

        # Comfort still matters, but it should not completely dominate the phrase plan.
        cost += 0.35 * abs(cand_midi - comfort_center)

        # Your target-fixed-note heuristic:
        # distance / number of measures. Closer fixed points exert stronger gravity.
        if left_fixed is not None:
            left_midi = left_fixed[2][0]
            cost += abs(left_midi - cand_midi) / (measure_index - left_fixed[0])
        if right_fixed is not None:
            right_midi = right_fixed[2][0]
            cost += abs(right_midi - cand_midi) / (right_fixed[0] - measure_index)

        if left_fixed is None and right_fixed is None:
            cost += abs(cand_midi - comfort_center)

        if best_cost is None or cost < best_cost:
            best_cost = cost
            best_soprano = cand

    return best_soprano


def fix_cadence_sopranos(work_score, cadences, fixed_notes):
    """Choose cadential soprano structural points.

    PAC/IAC soprano notes are treated as semi-fixed structural points. They are
    still written into the score because cadence type is a real constraint, but
    in the gravity system they are tagged as cadence points rather than ordinary
    instructor-fixed notes.
    """
    soprano_fixed_notes = [fn for fn in fixed_notes if fn[1] == "S"]
    cadence_structural_notes = []

    for measure_index, cadence_type in cadences:
        measure = work_score[measure_index]
        rn_sym, key = measure[4], measure[5]
        chord_notes = vg.chord_notes_from_rn(rn_sym, key)

        if cadence_type == "PAC":
            soprano_raw = chord_notes[0]      # scale degree 1 / chord root
        elif cadence_type == "IAC":
            soprano_raw = chord_notes[1]      # chord third, simple default for now
        else:
            continue

        if measure[0] is not None:
            if not vg.same_pitch_class(soprano_raw, measure[0]):
                raise ValueError("the fixed note on cadence is incorrect")
            chosen = measure[0]
        else:
            chosen = choose_structural_soprano(
                work_score, measure_index, soprano_raw, soprano_fixed_notes
            )
            measure[0] = chosen

        soprano_fixed_notes.append((measure_index, "S", chosen))
        soprano_fixed_notes.sort(key=lambda t: t[0])
        cadence_structural_notes.append((measure_index, "S", chosen))

    return cadence_structural_notes


# Candidate generation
def candidate_notes_for_voice(chord_notes, voice):
    low, high = VOICE_RANGES[voice]
    result = []
    for raw_note in chord_notes:
        result.extend(note_construction(raw_note, low, high))
    # Remove duplicates. Duplicates can occur in It+6 or doubled pitch-class situations.
    result = list(dict.fromkeys(result))
    center = VOICE_COMFORT_CENTERS[voice]
    return sorted(result, key=lambda n: abs(n[0] - center))


def respects_fixed_note(measure_index, voice, candidate_note, fixed):
    required = fixed.get((measure_index, voice))
    return required is None or notes_equal(required, candidate_note)


def measure_internal_errors(measure, measure_index):
    chord_notes = vg.chord_notes_from_rn(measure[4], measure[5])
    measure_notes = [measure[0], measure[1], measure[2], measure[3]]
    errors = []

    vr_error, vc_error, vg_error = [], [], []
    wn_error, wb_error, completion_error = [], [], []

    vg.vr_checker(measure, measure_index, vr_error)
    vg.vc_checker(measure, measure_index, vc_error)
    vg.vg_checker(measure, measure_index, vg_error)
    vg.wn_checker(chord_notes, measure_notes, measure_index, wn_error)
    vg.wb_checker(chord_notes, measure_notes, measure_index, wb_error)
    vg.completion_checker(chord_notes, measure_notes, measure_index, completion_error)

    errors.extend(vr_error)
    errors.extend(vc_error)
    errors.extend(vg_error)
    errors.extend(wn_error)
    errors.extend(wb_error)
    errors.extend(completion_error)
    return errors


def generate_measure_candidates(work_score, measure_index, fixed, structural_notes, max_candidates=160):
    base_measure = work_score[measure_index]
    rn_sym, key = base_measure[4], base_measure[5]
    chord_notes = vg.chord_notes_from_rn(rn_sym, key)

    # Bass should already be fixed by bass_dp.
    B = base_measure[3]
    if B is None:
        raise ValueError(f"Bass not fixed before SAT generation in measure {measure_index}")

    S_options = [base_measure[0]] if base_measure[0] is not None else candidate_notes_for_voice(chord_notes, "S")
    A_options = [base_measure[1]] if base_measure[1] is not None else candidate_notes_for_voice(chord_notes, "A")
    T_options = [base_measure[2]] if base_measure[2] is not None else candidate_notes_for_voice(chord_notes, "T")

    candidates = []
    for S in S_options:
        if not respects_fixed_note(measure_index, "S", S, fixed):
            continue
        for A in A_options:
            if not respects_fixed_note(measure_index, "A", A, fixed):
                continue
            for T in T_options:
                if not respects_fixed_note(measure_index, "T", T, fixed):
                    continue
                if not respects_fixed_note(measure_index, "B", B, fixed):
                    continue

                candidate = [S, A, T, B, rn_sym, key]
                if measure_internal_errors(candidate, measure_index):
                    continue
                cost = vertical_aesthetic_cost(candidate, measure_index, len(work_score), structural_notes)
                candidates.append((cost, candidate))

    candidates.sort(key=lambda x: x[0])
    return [cand for _, cand in candidates[:max_candidates]]

# Rule checking between measures

def transition_errors(prev_measure, curr_measure, prev_index):
    errors = []

    overlap_error, parallel_error, direct_error, resolve_error = [], [], [], []
    vg.overlap_checker(prev_measure, curr_measure, prev_index, overlap_error)
    vg.parallel_checker(prev_measure, curr_measure, prev_index, parallel_error)
    vg.direct_checker(prev_measure, curr_measure, prev_index, direct_error)
    vg.resolve_checker(prev_measure, curr_measure, prev_index, resolve_error)

    errors.extend(overlap_error)
    errors.extend(parallel_error)
    errors.extend(direct_error)
    errors.extend(resolve_error)
    return errors


def delayed_leap_errors(path, new_measure):
    """When adding measure i, we can finally check leap resolution from i-2 -> i-1 -> i."""
    if len(path) < 2:
        return []
    temp_score = path[-2:] + [new_measure]
    leap_error = []
    vg.leap_checker(temp_score, 0, leap_error)
    return leap_error



# Aesthetic heuristic
def voice_gravity_cost(voice, pitch, measure_index, structural_notes):
    """Cost from the attractor field of fixed/semi-fixed notes.

    Every structural note in the same voice pulls the candidate pitch toward it.
    The pull is stronger when:
    - the structural note is close in time;
    - the structural note is instructor-fixed rather than solver-generated;
    - the voice has a higher gravity weight.

    Future targets are weighted a bit more than past targets because they help
    the line prepare instead of merely remember where it came from.
    """
    total = 0.0
    voice_weight = VOICE_GRAVITY_WEIGHTS[voice]

    for target in structural_notes:
        if target["voice"] != voice:
            continue
        target_index = target["measure_index"]
        target_pitch = target["note"][0]
        distance = abs(target_index - measure_index)

        if distance == 0:
            # Exact structural notes are enforced elsewhere. If this ever gets
            # called on a competing pitch at the same measure, make it very bad.
            if pitch != target_pitch:
                total += 1000.0 * target["strength"]
            continue

        future_multiplier = 1.15 if target_index > measure_index else 0.65
        pull = voice_weight * target["strength"] * future_multiplier / distance
        total += pull * abs(pitch - target_pitch)

    return total


def soprano_apex_cost(S, measure_index, n_measures):
    pitch = S[0]
    comfort = VOICE_COMFORT_CENTERS["S"]
    apex_measure = (n_measures - 1) / 2.0
    sigma = max(n_measures / 4.0, 1.0)
    apex_strength = math.exp(-abs(measure_index - apex_measure) / sigma)
    return -1.20 * apex_strength * (pitch - comfort)


COMFORT_WEIGHTS = {
    "S": 0.08,
    "A": 0.18,
    "T": 0.18,
    "B": 0.25,
}

def vertical_aesthetic_cost(measure, measure_index, n_measures, structural_notes):
    S, A, T, B, *_ = measure
    cost = 0.0

    # Individual comfort zones.
    for note, voice in [(S, "S"), (A, "A"), (T, "T"), (B, "B")]:
        cost += COMFORT_WEIGHTS[voice] * abs(note[0] - VOICE_COMFORT_CENTERS[voice])
        cost += voice_gravity_cost(voice, note[0], measure_index, structural_notes)

    # The soprano gets a phrase-level apex. This is independent from fixed-note
    # gravity: the field pulls toward targets, while the apex shapes the phrase.
    cost += soprano_apex_cost(S, measure_index, n_measures)

    # Prefer compact upper three voices, but allow expressive spacing.
    cost += 0.08 * (S[0] - A[0])
    cost += 0.15 * (A[0] - T[0])

    # Avoid extremely crowded A/T/B positions.
    if S[0] == A[0]:
        cost += 1.0
    if A[0] == T[0]:
        cost += 2.0
    if T[0] == B[0]:
        cost += 3.0

    return cost


def melodic_transition_cost(prev_measure, curr_measure):
    prev_S, prev_A, prev_T, prev_B, *_ = prev_measure
    curr_S, curr_A, curr_T, curr_B, *_ = curr_measure
    cost = 0.0

    # Soprano smoothness is important, but not so strong that it kills phrase shape.
    soprano_leap = abs(curr_S[0] - prev_S[0])
    cost += 0.3 * soprano_leap
    if soprano_leap > 7:
        cost += 4.0
    elif soprano_leap > 4:
        cost += 1.5

    # Inner voices should usually move smoothly.
    for prev, curr in [(prev_A, curr_A), (prev_T, curr_T)]:
        leap = abs(curr[0] - prev[0])
        cost += 0.55 * leap
        if leap > 5:
            cost += 2.0

    # Bass smoothness is already handled in bass_dp, but add a light preference.
    cost += 0.20 * abs(curr_B[0] - prev_B[0])

    return cost



# Main SAT solver: beam search instead of first-legal DFS
def SAT_solver(work_score, cadences, fixed_notes, beam_width=80, candidate_limit=300):
    """Fill S/A/T after bass has been chosen.

    This is intentionally not a naive DFS. It uses beam search:
    - each measure generates legal vertical sonorities;
    - transitions must pass the strict grader-style checks;
    - candidates are ranked by an aesthetic heuristic involving comfort,
      smoothness, target fixed notes, and a soft phrase apex.
    """
    fixed = fixed_note_lookup(fixed_notes)
    cadence_structural_notes = fix_cadence_sopranos(work_score, cadences, fixed_notes)
    structural_notes = build_structural_notes(fixed_notes, cadence_structural_notes)

    beam = [(0.0, [])]  # (cost, path_of_measures)
    n = len(work_score)

    for measure_index in range(n):
        measure_candidates = generate_measure_candidates(
            work_score,
            measure_index,
            fixed,
            structural_notes,
            max_candidates=candidate_limit,
        )
        if not measure_candidates:
            return False

        new_beam = []
        for prev_cost, path in beam:
            for cand in measure_candidates:
                if path:
                    if transition_errors(path[-1], cand, measure_index - 1):
                        continue
                    if delayed_leap_errors(path, cand):
                        continue
                    add_cost = melodic_transition_cost(path[-1], cand)
                else:
                    add_cost = 0.0

                add_cost += vertical_aesthetic_cost(cand, measure_index, n, structural_notes)
                new_beam.append((prev_cost + add_cost, path + [cand]))

        if not new_beam:
            return False
        new_beam.sort(key=lambda x: x[0])
        beam = new_beam[:beam_width]

    # Final safety check with the existing grader.
    for final_cost, path in beam:
        solved_score = [tuple(m) for m in path]
        errors = vg.voice_grader(solved_score)
        if all_errors_empty(errors):
            for i in range(n):
                work_score[i] = list(solved_score[i])
            return True

    return False


# input: a harmony_problem
# output: a solved score

def voice_solver(harmony_problem, bass_beam_width=80, sat_beam_width=500):
    score = harmony_problem["score"]
    cadences = harmony_problem.get("cadences", [])
    fixed_notes = harmony_problem.get("fixed_notes", [])
    fixed_chords = harmony_problem.get("fixed_chords", [])

    work_score = [list(measure) for measure in score]

    # Put in all the fixed notes.
    for fixed_note in fixed_notes:
        measure_index, voice, note = fixed_note
        voice_index = voice_to_index[voice]
        existing = work_score[measure_index][voice_index]
        if existing is not None and existing != note:
            raise ValueError(f"Conflicting fixed note in measure {measure_index}, voice {voice}")
        work_score[measure_index][voice_index] = note

    # Optional: if fixed_chords are given, override the RN of those measures.
    for measure_index, rn in fixed_chords:
        work_score[measure_index][4] = rn

    bass_structural_notes = build_structural_notes(fixed_notes, [])
    bass_beam = bass_dp(work_score, bass_beam_width, bass_structural_notes)
    best_solution = None

    for bass_penalty, bass_line in bass_beam:
        score_copy = copy.deepcopy(work_score)
        for measure_index in range(len(score_copy)):
            score_copy[measure_index][3] = bass_line[measure_index]

        result = SAT_solver(
            score_copy,
            cadences,
            fixed_notes,
            beam_width=sat_beam_width,
            candidate_limit=180,
        )
        if result is True:
            solved = [tuple(measure) for measure in score_copy]
            best_solution = solved
            break

    return best_solution


if __name__ == "__main__":
    harmony_problem = {
        "score": [
            (None, None, None, None, "I", ("C", "major")),
            (None, None, None, None, "IV", ("C", "major")),
            (None, None, None, None, "I", ("C", "major")),
            (None, None, None, None, "V", ("C", "major")),
            (None, None, None, None, "I", ("C", "major")),
        ],
        "cadences": [
            (2, "IAC"),
            (4, "PAC"),
        ],
        "fixed_notes": [],
        "fixed_chords": [],
    }

    solution = voice_solver(harmony_problem)
    print(solution)
    if solution is not None:
        print(vg.voice_grader(solution))
