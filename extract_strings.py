import os, re, struct, sys

def extract_strings_from_dex(path, min_len=4):
    with open(path, 'rb') as f:
        data = f.read()
    # DEX string_ids: read header
    if data[:3] != b'dex':
        return []
    string_ids_size = struct.unpack_from('<I', data, 0x38)[0]
    string_ids_off = struct.unpack_from('<I', data, 0x3c)[0]
    strings = []
    for i in range(string_ids_size):
        off = struct.unpack_from('<I', data, string_ids_off + i*4)[0]
        # uleb128 length
        pos = off
        result = 0
        shift = 0
        while True:
            b = data[pos]
            pos += 1
            result |= (b & 0x7f) << shift
            if (b & 0x80) == 0:
                break
            shift += 7
        # MUTF-8 string (treat as utf-8, ignore errors)
        end = data.index(b'\x00', pos)
        raw = data[pos:end]
        try:
            s = raw.decode('utf-8', errors='replace')
        except:
            continue
        if len(s) >= min_len:
            strings.append(s)
    return strings

base = r'C:\Users\sharm\Documents\trae_projects\androidapp\base_extracted'
all_strs = []
for dex in ['classes.dex', 'classes2.dex', 'classes3.dex']:
    p = os.path.join(base, dex)
    if os.path.exists(p):
        all_strs.extend(extract_strings_from_dex(p))

# Dedupe and filter
seen = set()
unique = []
for s in all_strs:
    if s not in seen:
        seen.add(s)
        unique.append(s)

# Categories
patterns = {
    'exercise': re.compile(r'squat|push.?up|pushup|plank|lung|deadlift|sit.?up|crunch|bridge|burpee|jumping.?jack|shoulder|bicep|tricep|pull.?up|dumbbell|barbell|kettlebell', re.I),
    'workout': re.compile(r'workout|training|routine|session|plan|program|challenge', re.I),
    'bodypart': re.compile(r'chest|back|shoulder|arm|leg|abdom|core|glute|butt|thigh|calf|forearm|neck', re.I),
    'gemini': re.compile(r'gemini', re.I),
    'url': re.compile(r'https?://[^\s"\'<>]+'),
    'coach': re.compile(r'coach|form|posture|feedback|analy', re.I),
    'premium': re.compile(r'premium|pro|vip|subscribe|membership|upgrade|unlock|paid|free.?trial', re.I),
}

for name, pat in patterns.items():
    print(f'\n===== {name.upper()} =====')
    hits = sorted(set(s for s in unique if pat.search(s)))
    for h in hits[:120]:
        print(repr(h))
    if len(hits) > 120:
        print(f'... (+{len(hits)-120} more)')

print(f'\nTOTAL UNIQUE STRINGS: {len(unique)}')
