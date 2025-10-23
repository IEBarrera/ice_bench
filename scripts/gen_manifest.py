"""Generate bench_1/manifest.json by walking the bench_1 directory.

Rules:
- For each top-level category (folder) find subfolders named system_###.
- For each system folder, collect .xyz files.
- Prefer files that end with "_high.xyz" and "_low.xyz" (pair them as [high, low]).
- If those specific endings are absent, pick the first two .xyz files lexicographically.
- If fewer than 2 .xyz files are present, skip that system (and print a warning).
- Write output JSON with structure: { category: { system: [path_to_a, path_to_b] } }

Paths are written relative to the project root (this script assumes it's run from project root).
"""

import os
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # project root (../)
BENCH = ROOT / 'bench_1'
OUT = BENCH / 'manifest.json'

def find_categories(bench_dir: Path):
    return sorted([p for p in bench_dir.iterdir() if p.is_dir()])

def find_system_dirs(cat_dir: Path):
    # system_xxx directories
    return sorted([p for p in cat_dir.iterdir() if p.is_dir() and p.name.startswith('system_')])

def collect_xyz_files(system_dir: Path):
    return sorted([p for p in system_dir.iterdir() if p.is_file() and p.suffix.lower()=='.xyz'])


def choose_pair(xyz_files):
    # xyz_files: list[Path]
    if not xyz_files or len(xyz_files) < 2:
        return None
    high = None
    low = None
    for p in xyz_files:
        name = p.name.lower()
        if name.endswith('_high.xyz') and high is None:
            high = p
        elif name.endswith('_low.xyz') and low is None:
            low = p
    if high and low:
        return [str(high.as_posix()), str(low.as_posix())]
    # fallback: first two
    return [str(xyz_files[0].as_posix()), str(xyz_files[1].as_posix())]


def main():
    if not BENCH.exists():
        print('bench_1 directory not found at', BENCH)
        return
    manifest = {}
    categories = find_categories(BENCH)
    for cat in categories:
        cat_name = cat.name
        manifest[cat_name] = {}
        systems = find_system_dirs(cat)
        for sysdir in systems:
            xyzs = collect_xyz_files(sysdir)
            pair = choose_pair(xyzs)
            if pair is None:
                print(f'Warning: skipping {cat_name}/{sysdir.name} — found <2 .xyz files ({len(xyzs)})')
                continue
            # make paths relative to project root, using posix style
            rel = [os.path.relpath(p, ROOT).replace('\\','/') for p in pair]
            manifest[cat_name][sysdir.name] = rel
    # write pretty JSON
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print('Wrote manifest with', sum(len(v) for v in manifest.values()), 'systems to', OUT)


if __name__ == '__main__':
    main()
