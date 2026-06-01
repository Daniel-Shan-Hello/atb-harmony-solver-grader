import re
#definition of score, measure, and notes:
#1. score: a list of measures
#2. measure: a tuple constructed with four notes in the order of SATB,
#   the Roman-numeral, and the current key, which is a tuple. ex. ("C", "major")
#3. notes: a tuple with the pitch (int, midi convention), 
# the letter (as "string"), and the accidental(-2, -1, 0, 1 ,2)

#definition of harmony_problem as dictionary:
#"score": the score of the harmony problem
#"cadences": a list of all cadences, cadence form as a tuple of measure_index and cadence type. ex (2, "PAC")
#"fixed_notes": a list of note-information that are already fixed(i.e. by the instructor)
#note information is defined as tuple of measure_index, voice, and note (definition of note defined above).
#"fixed_chords": a list of chord-information that are already fixed(i.e. by the instructor)
#chord-information is defined as a tuple of measure_index and rn ex.(2, "V")

def vr_checker(measure, measure_index, vr_error):
    S, A, T, B, *_ = measure
    if S[0] < 60 or S[0] > 79:
        vr_error.append(("vocal_range", ("S",), measure_index, None))
    if A[0] < 55 or A[0] > 74:
        vr_error.append(("vocal_range", ("A",), measure_index, None))
    if T[0] < 48 or T[0] > 67:
        vr_error.append(("vocal_range", ("T",), measure_index, None))
    if B[0] < 40 or B[0] > 62:
        vr_error.append(("vocal_range", ("B",), measure_index, None))

def vc_checker(measure, measure_index, vc_errors):
    S, A, T, B, *_ = measure
    voices = [S, A, T, B]
    names  = ["S", "A", "T", "B"]
    for upper, lower in [(0, 1), (1, 2), (2, 3)]:
        if voices[upper][0] < voices[lower][0]:
            vc_errors.append(("voice_crossing", (names[upper], names[lower]), measure_index, None))

def vg_checker(measure, measure_index, vg_errors):
    S, A, T, B, *_ = measure
    voices = [S, A, T, B]
    names  = ["S", "A", "T", "B"]
    for upper, lower in [(0, 1), (1, 2)]:
        if voices[upper][0] - voices[lower][0] > 12:
            vg_errors.append(("voice_gap", (names[upper], names[lower]), measure_index, None))

def parallel_checker(measure, next_measure, measure_index, parallel_error):
    S, A, T, B, *_ = measure
    S_n, A_n, T_n, B_n, *_ = next_measure
    voices = [S, A, T, B]
    voices_n = [S_n, A_n, T_n, B_n]
    names  = ["S", "A", "T", "B"]
    for i in range(4):
        for j in range(i+1, 4):
            transformed_interval = interval_transform(voices[i], voices[j])
            transformed_interval_n = interval_transform(voices_n[i], voices_n[j])
            if transformed_interval == 7:
                if transformed_interval_n == 7:
                    parallel_error.append(("parallel_perfect", (names[i], names[j]), measure_index, "P5"))
            if transformed_interval == 0:
                if transformed_interval_n == 0:
                    parallel_error.append(("parallel_perfect", (names[i], names[j]), measure_index, "P8"))
        
def direct_checker(measure, next_measure, measure_index, direct_error):
    S, A, T, B, *_ = measure
    S_n, A_n, T_n, B_n, *_ = next_measure
    transformed_interval_n = interval_transform(S_n, B_n)
    if abs(S_n[0] - S[0]) >= 3:
        if transformed_interval_n == 7:
            if (S_n[0]- S[0]) * (B_n[0] - B[0]) > 0: #similar motion
                direct_error.append(("direct_perfect", ("S", "B"), measure_index, "P5"))
        if transformed_interval_n == 0:
            if (S_n[0]- S[0]) * (B_n[0] - B[0]) > 0:
                direct_error.append(("direct_perfect", ("S", "B"), measure_index, "P8"))

def overlap_checker(measure, next_measure, measure_index, overlap_error):
    S, A, T, B, *_ = measure
    S_n, A_n, T_n, B_n, *_ = next_measure
    voices = [S, A, T, B]
    voices_n = [S_n, A_n, T_n, B_n]
    names  = ["S", "A", "T", "B"]
    for upper, lower in [(0, 1), (1, 2), (2, 3)]:
        if voices_n[upper][0] < voices[lower][0]  or voices_n[lower][0] > voices[upper][0]:
            overlap_error.append(("overlap", (names[upper], names[lower]), measure_index, None))

def interval_transform(note_1, note_2):
    #limit the interval within an octave
    return abs(note_1[0] - note_2[0]) % 12

LETTER_TO_STEP = {"C":0, "D":1, "E":2, "F":3, "G":4, "A":5, "B":6}
NATURAL_PC = {"C":0, "D":2, "E":4, "F":5, "G":7, "A":9, "B":11}
BASE_SEMITONES = {1:0, 2:2, 3:4, 4:5, 5:7, 6:9, 7:11}
PERFECT_NUMBERS = {1, 4, 5, 8}

# dim = -2, minor = -1, perfect = 0, major = 1, aug = 2
def pitch_class_from_spelling(name, acc):
    return (NATURAL_PC[name] + acc) % 12

def diatonic_number(name1, name2):
    i1 = LETTER_TO_STEP[name1]
    i2 = LETTER_TO_STEP[name2]
    return (i2 - i1) % 7 + 1

def interval_quality_mod12(note_1, note_2):
    _, name1, acc1 = note_1
    _, name2, acc2 = note_2
    num = diatonic_number(name1, name2)
    base = BASE_SEMITONES[num]

    # actual semitones implied by spelling (mod12)
    pc1 = pitch_class_from_spelling(name1, acc1)
    pc2 = pitch_class_from_spelling(name2, acc2)
    actual = (pc2 - pc1) % 12

    diff = actual - base

    if num in PERFECT_NUMBERS:
        if diff == 0: q = 0
        elif diff > 0: q =2
        else: q = -2
    else:
        # M baseline
        if diff == 0:      q = 1
        elif diff == -1:   q = -1
        elif diff > 0:     q = 2
        else:              q = -2
    return (q, num)

def validate_note(note):
    midi, name, acc = note
    return (midi % 12) == pitch_class_from_spelling(name, acc)

def is_neapolitan_b2_to_7_exception(v, v1, rn, rn_n, key):
    if rn != "bII6":
        return False

    if not rn_n.startswith("V"):
        return False

    key_symbol, key_quality = key
    tonic_pitch = key_midi_num[key_symbol]

    flat_2_pc = (tonic_pitch + 1) % 12
    leading_tone_pc = (tonic_pitch - 1) % 12

    return (
        v[0] % 12 == flat_2_pc and
        v1[0] % 12 == leading_tone_pc and
        v1[0] - v[0] == -2
    )

def leap_checker(score, measure_index, leap_error):
    S, A, T, B, rn, key = score[measure_index]
    S_n, A_n, T_n, B_n, rn_n, key_n = score[measure_index + 1]

    voices   = [S, A, T, B]
    voices_n = [S_n, A_n, T_n, B_n]
    names    = ["S", "A", "T", "B"]

    has_n2 = (measure_index < len(score) - 2)
    if has_n2:
        S_n2, A_n2, T_n2, B_n2, *_ = score[measure_index + 2]
        voices_n2 = [S_n2, A_n2, T_n2, B_n2]

    for i in range(4):
        v  = voices[i]
        v1 = voices_n[i]
        name = names[i]
        semi = v1[0] - v[0]
        abs_semi = abs(semi)
        (quantity, interval) = interval_quality_mod12(v, v1)
        # No augmented leaps, BUT allow chromatic step (1 semitone)
        if quantity == 2 and abs_semi > 1:
            if not is_neapolitan_b2_to_7_exception(v, v1, rn, rn_n, key):
                leap_error.append(("augmented leap", (name,), measure_index, interval))
        # If no v2, edge case checks
        if not has_n2:
            if quantity == -2:
                leap_error.append(("diminished_leap_not_resolve", (name,), measure_index, interval))
            if abs_semi > 7 and not (name == "B" and abs_semi == 12):
                leap_error.append(("huge_leap_not_resolve", (name,), measure_index, abs_semi))
            continue

        v2 = voices_n2[i]
        semi2 = v2[0] - v1[0]

        (_, interval_n) = interval_quality_mod12(v1, v2)
        opposite = (semi2 != 0) and ((semi2 > 0) != (semi > 0))
        step_ok = (abs(semi2) == 1) or (interval_n == 2)   # allow chromatic step OR diatonic 2nd

        # Diminished leaps must be followed by step opposite
        if quantity == -2:
            if (not step_ok) or (not opposite):
                leap_error.append(("diminished_leap_not_resolve", (name,), measure_index, interval))

        # Leaps larger than P5 must go back by step opposite (except bass octave)
        if abs_semi > 7 and not (name == "B" and abs_semi == 12):
            if (not step_ok) or (not opposite):
                leap_error.append(("huge_leap_not_resolve", (name,), measure_index, abs_semi))


ROMAN_TO_DEGREE = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7}

def create_rn_dict(degree= None, quality=None, is_Neapolitan=False, aug_sixth=None, 
                    is_seventh = False, inversion = None, secondary_to = None):
    return {"degree": degree, "quality": quality, "is_Neapolitan": is_Neapolitan, "aug_sixth": aug_sixth,
             "is_seventh": is_seventh, "inversion":inversion, "secondary_to":secondary_to}

#Input: A roman Numeral. ex V7
#Output: a dictionary of informations
#form of dictionary:
# rninfo = {degree: 1, quality: "maj", is_Neapolitan: False, augmented_sixth: None
#              is_seventh: False, inversion: "6", secondary_to: None}


def parse_rn(rn):
    s = rn.strip()
    aug_type = None
    aug_sixth_m = re.fullmatch(r"(It6|Fr43|Ger65)", s)
    if aug_sixth_m:
        token = aug_sixth_m.group(1)   # "It6" or "Fr43" or "Ger65"
        aug_type = token[:2]           # -> "It" / "Fr" / "Ge"
        if aug_type == "Ge":           # fix "Ger"
            aug_type = "Ger"
        return create_rn_dict(aug_sixth=aug_type)
    inv = None
    inv_m = re.search(r"(64|65|43|42|6|7)$", s)
    if inv_m:
        inv = inv_m.group(1)
        s = s[: -len(inv)]
    is_seventh = inv in ("7", "65", "43", "42")
    
    quality = None
    if "ø" in s:
        quality = "hdim"
        s = s.replace("ø", "")
    
    if "o" in s or "°" in s:
        quality = "dim" if quality is None else quality
        s = s.replace("o", "").replace("°", "")
    if "+" in s:
        quality = "aug"
        s = s.replace("+", "")

    #Modal Mixture III, VI, Neapolitan Chord
    if s.startswith('b'):
        s = s[1:]
        degree = ROMAN_TO_DEGREE[s.upper()]
        if degree in (3, 6):
            quality = 'maj'
        else: #Neapolitan
            return create_rn_dict(degree = 2, quality = 'maj', is_Neapolitan= True, inversion = inv)
    degree = ROMAN_TO_DEGREE[s.upper()]
    if quality == None:
        if s.isupper():
            quality = 'dom' if degree == 5 else 'maj'
        else: 
            quality = 'min'
    return create_rn_dict(degree= degree, quality = quality,
                          is_seventh = is_seventh, inversion = inv, 
                         secondary_to = None)

def parse_harmony_symbol(sym):
    s = sym.strip()
    if "/" not in s:
        return parse_rn(s)

    base_str, target_str = s.split("/", 1)

    if "/" in target_str:
        raise ValueError("Nested secondary not supported")
    
    base = parse_rn(base_str)
    target = parse_rn(target_str)

    # ---- constraint checks ----
    
    if base.get("aug_sixth") is not None or base.get("is_Neapolitan"):
        raise ValueError(f"Secondary not allowed on special chord: {sym}")

    if target["quality"] not in ("maj", "min", "dom"):
        raise ValueError(f"Secondary base must be maj/min: {sym}")

    if target.get("aug_sixth") is not None:
        raise ValueError(f"Secondary target must be diatonic RN (no special chords): {sym}")

    if target["is_seventh"]:
        raise ValueError(f"Secondary target cannot be a seventh chord: {sym}")

    # attach
    base["secondary_to"] = target
    return base


inversion_token = ("64", "65", "43", "42", "6", "7")

#This function took in a tuple of notes, and place the bass 
# note to the first of the tuple according to inversion, return tuple
def chord_inversion_converter(notes, inversion):
    if inversion in ("65","43","42") and len(notes) != 4:
        raise ValueError("Seventh inversion applied to triad")
    notes = list(notes)
    if inversion == "6":
        bass = notes.pop(1)
        notes.insert(0, bass)
    elif inversion == "7":
        notes = notes
    elif inversion == "64":
        bass = notes.pop(2)
        notes.insert(0, bass)
    elif inversion == "65":
        bass = notes.pop(1)
        notes.insert(0, bass)
    elif inversion == "43":
        bass = notes.pop(2)
        notes.insert(0, bass)
    elif inversion == "42":
        bass = notes.pop(3)
        notes.insert(0, bass)
    return tuple(notes)

key_midi_num = {"C": 60, "B#":60, "C#":61, "Db":61, "D": 62, "D#": 63, "Eb" : 63,
                 "E": 64, "Fb":64, "E#": 65, "F": 65, "F#": 66, "Gb": 66, "G": 67, "G#": 68,
                 "Ab": 68, "A": 69, "A#": 70, "Bb": 70, "B":71}

chord_relative_pitchs = {"maj": (0, 4, 7, 11), "dom": (0, 4, 7, 10), "min": (0, 3, 7, 10), "aug": (0, 4, 8), "dim": (0, 3, 6, 9), "hdim": (0, 3, 6, 10)}

scale_relative_pitchs = {"major": (0, 2, 4, 5, 7, 9, 11), "minor": (0, 2, 3, 5, 7,8, 11)}
letters = ('C', 'D', 'E', 'F', 'G', 'A', 'B')

#This function get the letter of the target pitch
def target_letter(prev_letter, interval):
    index = letters.index(prev_letter)
    return letters[(index + interval -1) % 7]

#this function takes in the letter of a note with the actual pitch, and calculate the accidental
def accidental_calculater(letter, actual_pitch):
    base_pc = NATURAL_PC[letter]
    actual_pc = actual_pitch % 12

    # difference in pitch classes, choose the closest representative in [-6, +6]
    diff = (actual_pc - base_pc + 6) % 12 - 6

    # In your system, accidentals only allowed -2..2
    if diff < -2 or diff > 2:
        raise ValueError(f"Accidental out of range for {letter}: need {diff}, actual_pitch={actual_pitch}")
    return diff
    

#Input: Roman Numeral Symbol and the current Key
#Output: A tuple of notes, with the bass note as the first element. The midi value starts with C4 (60)
def chord_notes_from_rn(sym, key):
    chord_info = parse_harmony_symbol(sym)
    (key, key_quality) = key
    degree = chord_info["degree"]
    key_letter = key[0]
    key_midi_int = key_midi_num[key]
    scale_relative_pitches = scale_relative_pitchs[key_quality]

    root_position_bass_pitch = None
    root_position_bass_letter = None

    #special check for Neapolitan chord:
    if chord_info["is_Neapolitan"] == True:
        root_position_bass_pitch = key_midi_int + 1
        root_position_bass_letter = target_letter(key_letter, 2)
    
    #special check for modal mixture 3, 6
    if key_quality == "major" and degree in (3, 6) and chord_info["quality"] == "maj":
        if degree == 3:
            root_position_bass_pitch = key_midi_int + 3
            root_position_bass_letter = target_letter(key_letter, 3)
        elif degree == 6:
            root_position_bass_pitch = key_midi_int + 8
            root_position_bass_letter = target_letter(key_letter, 6)
    
    #special check for augmented sixth: direct return
    aug_sixth = chord_info["aug_sixth"]
    if aug_sixth != None:
        aug_six_bass_pitch = key_midi_int + 8
        aug_six_bass_letter = target_letter(key_letter, 6)
        aug_six_bass_accidental = accidental_calculater(aug_six_bass_letter, aug_six_bass_pitch)
        aug_six_bass_note = (aug_six_bass_pitch, aug_six_bass_letter, aug_six_bass_accidental)

        aug_six_leading_tone_pitch = key_midi_int + 6
        aug_six_leading_tone_letter = target_letter(key_letter, 4)
        aug_six_leading_tone_accidental = accidental_calculater(aug_six_leading_tone_letter, aug_six_leading_tone_pitch)
        aug_six_leading_tone_note = (aug_six_leading_tone_pitch, aug_six_leading_tone_letter, aug_six_leading_tone_accidental)

        aug_six_third_pitch = key_midi_int
        aug_six_third_letter = key_letter
        aug_six_third_accidental = accidental_calculater(key_letter,key_midi_int)
        aug_six_third_note = (aug_six_third_pitch, aug_six_third_letter, aug_six_third_accidental)

        if aug_sixth == "It": 
            return (aug_six_bass_note, aug_six_third_note, aug_six_leading_tone_note)
        else:
            if aug_sixth == "Fr":
                aug_six_extra_pitch =  key_midi_int + 2
                aug_six_extra_letter = target_letter(key_letter, 2)
                aug_six_extra_accidental = accidental_calculater(aug_six_extra_letter,aug_six_extra_pitch)
                aug_six_extra_note = (aug_six_extra_pitch, aug_six_extra_letter, aug_six_extra_accidental)
            elif aug_sixth == "Ger":
                aug_six_extra_pitch =  key_midi_int + 3
                aug_six_extra_letter = target_letter(key_letter, 3)
                aug_six_extra_accidental = accidental_calculater(aug_six_extra_letter, aug_six_extra_pitch)
                aug_six_extra_note = (aug_six_extra_pitch, aug_six_extra_letter, aug_six_extra_accidental)
            return (aug_six_bass_note, aug_six_third_note, aug_six_leading_tone_note, aug_six_extra_note)
    
    #Normal Cases:

    #switch to the temporary key if it is a secondary chord
    secondary_to = chord_info["secondary_to"]
    if secondary_to != None:
        #special check for Neapolitan chord:
        if secondary_to["is_Neapolitan"] == True:
            key_midi_int += 1
            key_letter = target_letter(key_letter, 2)
        #special check for Modal mixture 3:
        elif key_quality == "major" and secondary_to["quality"] == "maj" and secondary_to['degree'] == 3:
            key_midi_int += 3
            key_letter = target_letter(key_letter, 3)
        #special check for Modal mixture 6:
        elif key_quality == "major" and secondary_to["quality"] == "maj" and secondary_to['degree'] == 6:
            key_midi_int += 8
            key_letter = target_letter(key_letter, 6)
        
        #General cases:
        else:
            secondary_degree = secondary_to["degree"]
            key_midi_int += scale_relative_pitches[secondary_degree -1]
            key_letter = target_letter(key_letter, secondary_degree)
    
    chord_notes = []
    if root_position_bass_pitch == None: 
        root_position_bass_pitch = key_midi_int + scale_relative_pitches[degree - 1]
    if root_position_bass_letter == None:
        root_position_bass_letter = target_letter(key_letter, degree)
    root_position_bass_accidental = accidental_calculater(root_position_bass_letter, root_position_bass_pitch)
    #create the bass note: 
    root_position_bass_note = ( root_position_bass_pitch, root_position_bass_letter, root_position_bass_accidental)
    chord_notes.append(root_position_bass_note)

    #create other notes:
    chord_quality = chord_info["quality"]
    chord_relative_steps = chord_relative_pitchs[chord_quality]
    chord_relative_steps = chord_relative_steps[1:]
    intervals = [3, 5, 7]

    is_seventh = chord_info["is_seventh"]
    if is_seventh == False:
        chord_relative_steps = tuple(list(chord_relative_steps)[:2])
        intervals = intervals[:2]
    for i in range(len(chord_relative_steps)):
        note_pitch = root_position_bass_pitch + chord_relative_steps[i]
        note_letter = target_letter(root_position_bass_letter, intervals[i])
        note_accidental = accidental_calculater(note_letter, note_pitch)
        note = (note_pitch, note_letter, note_accidental)
        chord_notes.append(note)
    
    inversion = chord_info["inversion"]
    chord_notes = chord_inversion_converter(chord_notes, inversion)
    return chord_notes

def same_pitch_class(note_1, note_2):
    return note_1[0] % 12 == note_2[0] % 12

def completion_checker(chord_notes, measure_notes, measure_index, completion_error):
    for note_i in chord_notes:
        found = False
        for note_j in measure_notes: 
            if same_pitch_class(note_i, note_j):
                found = True
                break
        if not found:
            completion_error.append(("missing note from chord", None, measure_index, f'missing: {note_i[1:]}'))

def wb_checker(chord_notes, measure_notes, measure_index, wb_error):
    if not same_pitch_class(chord_notes[0], measure_notes[3]):
        wb_error.append(("wrong bass", "B", measure_index, f'expected bass: {chord_notes[0][1:]}'))

def wn_checker(chord_notes, measure_notes, measure_index, wn_error):
    names = ["S", "A", "T", "B"]
    for i in range(4):
        note_i = measure_notes[i]
        found = False
        for note_j in chord_notes:
            if same_pitch_class(note_i, note_j):
                found = True
                #if same_pitch_class = True, but spelling incorrect
                if note_i[1:] != note_j[1:]:
                    wn_error.append(("incorrect spelling of note", names[i], measure_index, f'expected spelling: {note_j[1:]}'))
                break
        if not found:
            wn_error.append(("incorrect note", names[i], measure_index, f'incorrect note: {note_i[1:]}'))

def resolve_checker(measure, next_measure, measure_index, resolve_error):
    rn_symbol, key = measure[4], measure[5]
    chord_notes = chord_notes_from_rn(rn_symbol, key)
    (key_symbol, key_quality) = key
    key_pitch = key_midi_num[key_symbol]
    chord_info = parse_harmony_symbol(rn_symbol)
    S, A, T, B, *_ = measure
    S_n, A_n, T_n, B_n, *_ = next_measure
    voices = [S, A, T, B]
    voices_n = [S_n, A_n, T_n, B_n]
    names = ["S", "A", "T", "B"]
    #calculate the temp_key_pitch (if it is secondary dominant chord)
    temp_key_pitch = key_pitch
    if chord_info["secondary_to"] != None:
        #special check for Neapolitan chord:
        if chord_info["secondary_to"]["is_Neapolitan"] == True:
            temp_key_pitch += 1
        #special check for modal mixture 3, 6
        elif chord_info["secondary_to"]['degree'] in [3, 6] and chord_info["secondary_to"]["quality"] == "maj":
            if chord_info["secondary_to"]['degree'] == 3:
                temp_key_pitch += 3
            elif chord_info["secondary_to"]['degree'] == 6:
                temp_key_pitch += 8
        else:
            temp_degree = chord_info["secondary_to"]['degree']
            temp_key_pitch += scale_relative_pitchs[key_quality][temp_degree - 1]

    #the seventh of seventh chord must resolve down by step
    if chord_info["is_seventh"] == True:
        if len(chord_notes) < 4:  raise ValueError("This is not a seventh chord")
        chord_quality = chord_info["quality"]
        seventh_relative_pitch = chord_relative_pitchs[chord_quality][3]
        chord_root_pitch  = temp_key_pitch + scale_relative_pitchs[key_quality][chord_info['degree'] - 1]
        seventh_pitch = chord_root_pitch + seventh_relative_pitch
        for i in range(4):
            voice = voices[i]
            voice_n = voices_n[i]
            #from SATB, check the seventh note
            if voice[0] % 12 == seventh_pitch % 12:
                if voice[0] - voice_n[0] not in [1, 2]:
                    resolve_error.append(("seventh should resolve down by step", names[i], measure_index, None))

    #b6 and #4 of aug_sixth should resolve to 5
    if chord_info['aug_sixth'] != None:
        flat_sixth_pitch = temp_key_pitch + 8
        sharp_fourth_pitch = temp_key_pitch + 6
        fifth_pitch = temp_key_pitch + 7
        for i in range(4):
            voice = voices[i]
            voice_n = voices_n[i]
            #from SATB, check the seventh note
            if voice[0] % 12 == flat_sixth_pitch % 12:
                if voice[0] - voice_n[0] != 1 or voice_n[0] % 12 != fifth_pitch % 12:
                    resolve_error.append(("aug_sixth chord doesn't resolve", names[i], measure_index, "b6 need to resolve to 5"))
            if voice[0] % 12 == sharp_fourth_pitch % 12 :
                if voice_n[0] - voice[0] != 1 or voice_n[0] % 12 != fifth_pitch % 12:
                    resolve_error.append(("aug_sixth chord doesn't resolve", names[i], measure_index, "#4 need to resolve to 5"))
    
    #in soprano, leading tone should resolve back to tonic (in the current key)
    if S[0] % 12 == (temp_key_pitch - 1) % 12:
        if S_n[0] % 12 != temp_key_pitch % 12:
            resolve_error.append(("leading tone in soprano should resolve", "S", measure_index, None))
    
    #for 64 chord, the fourth relative to bass must resolve down by step
    if chord_info['inversion'] == '64':
        chord_bass_pitch = chord_notes[0][0]
        fourth_pitch = chord_bass_pitch + 5
        #only check through SAT
        for i in range(3):
            voice = voices[i]
            voice_n = voices_n[i]
            if voice[0] % 12 == fourth_pitch % 12:
                if voice[0] - voice_n[0] not in [1, 2]:
                    resolve_error.append(("in 64 chords, the fourth need to resolve down by step", names[i], measure_index, None))

def voice_grader(score):
    vr_error = [] #vocal range error
    vc_error = [] #voice crossing error
    vg_error = [] #voice gap error
    wn_error = [] #note not included in a chord
    wb_error = [] #with incorrect bass note
    overlap_error = [] #voice overlap_error
    parallel_error = [] #parallel fifth/eighth error
    direct_error = [] #direct fifth/eighth error
    leap_error = []
    completion_error = [] #missing note error
    resolve_error = [] #is leading tone/ dissonance resolved
    for measure_index in range(len(score)):
        measure = score[measure_index]
        S, A, T, B, rn_symbol, key = measure
        for note in [S, A, T, B]:
            if not validate_note(note):
                print(f'spelling_mismatch in measure {measure_index}')
        chord_notes = chord_notes_from_rn(rn_symbol, key)
        measure_notes= [S, A, T, B]
        #errors within this measure
        completion_checker(chord_notes, measure_notes, measure_index, completion_error)
        vr_checker(measure, measure_index, vr_error)
        vc_checker(measure, measure_index, vc_error)
        vg_checker(measure, measure_index, vg_error)
        wn_checker(chord_notes, measure_notes, measure_index, wn_error)
        wb_checker(chord_notes, measure_notes, measure_index, wb_error)
        if measure_index != len(score) - 1: #not the last measure
            next_measure = score[measure_index + 1]
            #errors that require to check the next measure
            overlap_checker(measure, next_measure, measure_index, overlap_error)
            parallel_checker(measure, next_measure, measure_index, parallel_error)
            direct_checker(measure, next_measure, measure_index, direct_error)
            resolve_checker(measure, next_measure, measure_index, resolve_error)
            leap_checker(score, measure_index, leap_error)

    return {
        "vr": vr_error,
        "vc": vc_error,
        "vg": vg_error,
        "wn": wn_error,
        "wb": wb_error,
        "overlap": overlap_error,
        "parallel": parallel_error,
        "direct": direct_error,
        "leap": leap_error,
        "completion": completion_error,
        "resolve": resolve_error
    }

