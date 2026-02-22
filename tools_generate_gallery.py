#!/usr/bin/env python3
"""Generate gallery.json by scanning assets_v8/galeria_auto for images.

TURBO mode (recommended): put all images into:
  assets_v8/galeria_auto/

and name them with a category prefix:
  ECU_*, IMMO_*, ELV_*, DIAG_*, PCB_*
Supported separators after prefix: underscore (_), dash (-), space.

Compatibility:
- If you still keep subfolders like assets_v8/galeria_auto/ECU/, those will work too.
- Output paths are relative POSIX so it works on GitHub Pages.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GAL_DIR = ROOT / "assets_v8" / "galeria_auto"
OUT = ROOT / "gallery.json"

CATEGORIES = ["ECU", "IMMO", "ELV", "DIAG", "PCB"]
EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# Match e.g. ECU_123.jpg, ecu-foo.png, IMMO bar.webp
PREFIX_RE = re.compile(r"^(ECU|IMMO|ELV|DIAG|PCB)[_\-\s]", re.IGNORECASE)

def posix(p: Path) -> str:
    return p.as_posix()

def detect_category(file_path: Path) -> str | None:
    """Detect category from subfolder OR filename prefix."""
    # Subfolder compatibility (assets_v8/galeria_auto/ECU/xxx.jpg)
    parts_upper = [p.upper() for p in file_path.parts]
    for c in CATEGORIES:
        if c in parts_upper:
            return c

    # Turbo: filename prefix
    m = PREFIX_RE.match(file_path.name)
    if not m:
        return None
    return m.group(1).upper()


def humanize_title(filename: str, cat: str) -> str:
    """Derive a human-friendly title from a filename.

    Supported patterns:
    - TURBO:  ECU_xxx__Twoj opis.jpg  -> 'Twoj opis'
    - TURBO:  IMMO-xxx__Dopisanie klucza.webp -> 'Dopisanie klucza'
    - If no '__' is provided, use the remaining name without prefix.
    - For subfolder mode (assets_v8/galeria_auto/ECU/...), we also accept optional 'ECU_' prefix but it's not required.
    """
    name = filename.rsplit('.', 1)[0]

    # Strip leading category prefix if present
    # Examples: 'ECU_test__Opis' -> 'test__Opis'
    prefix_re = re.compile(rf"^({cat})[\s_\-]+", re.IGNORECASE)
    name2 = prefix_re.sub('', name).strip()

    # Prefer explicit description after '__'
    if '__' in name2:
        _, desc = name2.split('__', 1)
        title = desc.strip()
    else:
        title = name2.strip()

    # Cleanup: underscores to spaces, multiple spaces
    title = title.replace('_', ' ')
    title = re.sub(r"\s+", " ", title).strip()

    return title

def make_item(rel_posix: str, title: str) -> dict[str, str]:
    return {"src": rel_posix, "title": title, "desc": ""}
def main() -> None:
    data: dict[str, list[dict[str, str]]] = {c: [] for c in CATEGORIES}
    if not GAL_DIR.exists():
        OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"WARNING: {GAL_DIR} not found. Wrote empty {OUT}.")
        return

    files = []
    for f in GAL_DIR.rglob("*"):
        if f.is_file() and f.suffix.lower() in EXT:
            files.append(f)

    # stable ordering
    files.sort(key=lambda x: x.name.lower())

    ignored = 0
    for f in files:
        cat = detect_category(f)
        if not cat:
            ignored += 1
            continue
        rel = f.relative_to(ROOT)
        data[cat].append(make_item(posix(rel), humanize_title(f.name, cat)))

    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"OK: wrote {OUT} with counts: "
        + ", ".join(f"{c}={len(data[c])}" for c in CATEGORIES)
        + (f" (ignored={ignored} non-matching files)" if ignored else "")
    )

if __name__ == "__main__":
    main()
