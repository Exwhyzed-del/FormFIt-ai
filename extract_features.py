import os, re, struct

def extract_strings_from_dex(path, min_len=3):
    with open(path, 'rb') as f:
        data = f.read()
    if data[:3] != b'dex':
        return []
    string_ids_size = struct.unpack_from('<I', data, 0x38)[0]
    string_ids_off = struct.unpack_from('<I', data, 0x3c)[0]
    strings = []
    for i in range(string_ids_size):
        off = struct.unpack_from('<I', data, string_ids_off + i*4)[0]
        pos = off
        result = 0; shift = 0
        while True:
            b = data[pos]; pos += 1
            result |= (b & 0x7f) << shift
            if (b & 0x80) == 0: break
            shift += 7
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

seen = set(); unique = []
for s in all_strs:
    if s not in seen:
        seen.add(s); unique.append(s)

# Filter to likely app-content strings (human-readable, not class names / signatures)
def looks_like_content(s):
    # Exclude JVM signatures, class paths, protobuf, etc.
    if re.match(r'^[A-Za-z0-9_$/<>;()\[\].]+$', s):
        return False
    # Exclude paths
    if s.startswith('/') or s.startswith('http') and ' ' not in s:
        pass
    # Must contain a space or be a short word that looks like UI text
    return len(s) >= 3 and not s.startswith('Lcom/') and not s.startswith('Landroid/') and not s.startswith('Lkotlin/') and not s.startswith('Landroidx/') and not s.startswith('Lcom/google/') and not s.startswith('Ljava/')

content = [s for s in unique if looks_like_content(s)]

# Keywords to find
keywords = [
    r'\bsquat', r'\bpush.?up', r'\bplank', r'\blunge', r'\bdeadlift', r'\bsit.?up',
    r'\bcrunch', r'\bbridge', r'\bburpee', r'\bjump', r'\bshoulder', r'\bbicep',
    r'\btricep', r'\bpull.?up', r'\bdumbbell', r'\bbarbell', r'\bkettlebell',
    r'\bchest', r'\bback\b', r'\barm', r'\bleg', r'\babdom', r'\bcore', r'\bglute',
    r'\bworkout', r'\btraining', r'\broutine', r'\bprogram', r'\bchallenge',
    r'\brep\b', r'\bset\b', r'\bduration', r'\brest', r'\bcalorie', r'\bcalories',
    r'\bweight', r'\bbmi', r'\bbmr', r'\bgoal', r'\bmuscle', r'\bfat', r'\bcardio',
    r'\bstrength', r'\bhiit', r'\bflexibility', r'\bmobility',
    r'\bcoach', r'\bform', r'\bposture', r'\bfeedback', r'\banaly', r'\bscore',
    r'\bcamera', r'\blive', r'\brealtime', r'\bdetect',
    r'\bprofile', r'\bhistory', r'\bprogress', r'\bstreak', r'\bday\b',
    r'\bpremium', r'\bpro\b', r'\bsubscribe', r'\bupgrade', r'\bunlock',
    r'\bhome\b', r'\bstart', r'\bbegin', r'\bfinish', r'\bcomplete',
]

kw_re = re.compile('|'.join(keywords), re.I)
hits = sorted(set(s for s in content if kw_re.search(s) and len(s) < 200))
for h in hits:
    print(repr(h))
print(f'\n--- {len(hits)} content hits ---')
