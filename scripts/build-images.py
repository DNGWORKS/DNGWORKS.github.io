#!/usr/bin/env python3
"""
Prepare the site's raster assets.

Reads originals from src/images/ and writes responsive WebP variants into
assets/images/, plus an srcset manifest the page builder reads. Run it after
adding or replacing a photograph:

    python3 scripts/build-images.py

Requires Pillow (pip install Pillow). The published site needs none of this
at runtime; the output is committed.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "images"
OUT = ROOT / "assets" / "images"
MANIFEST = ROOT / "content" / "image-manifest.json"

# Widths chosen against the layouts that use these images: a gallery tile at
# roughly a third of a 1440 shell, a card at half, and a lead image at full.
WIDTHS = [480, 768, 1200]
QUALITY = 78
QUALITY_LEAD = 82


def variants_for(relative: Path) -> list[int]:
    """The hero poster is a full-bleed background and needs retina width."""
    if relative.parts[0] == "hero":
        return [768, 1200, 1800]
    return WIDTHS


def process(path: Path) -> tuple[str, dict] | None:
    relative = path.relative_to(SRC)
    with Image.open(path) as image:
        image = image.convert("RGB")
        source_width, source_height = image.size

        entries = []
        for width in variants_for(relative):
            if width > source_width:
                continue
            height = round(source_height * width / source_width)
            target = OUT / relative.parent / f"{relative.stem}-{width}.webp"
            target.parent.mkdir(parents=True, exist_ok=True)
            resized = image.resize((width, height), Image.LANCZOS)
            resized.save(
                target,
                "WEBP",
                quality=QUALITY_LEAD if relative.parts[0] == "insights" else QUALITY,
                method=6,
            )
            entries.append({"width": width, "path": f"/assets/images/{relative.parent.as_posix()}/{relative.stem}-{width}.webp"})

        if not entries:
            # Image smaller than the narrowest variant: emit it once at size.
            target = OUT / relative.parent / f"{relative.stem}-{source_width}.webp"
            target.parent.mkdir(parents=True, exist_ok=True)
            image.save(target, "WEBP", quality=QUALITY, method=6)
            entries.append({
                "width": source_width,
                "path": f"/assets/images/{relative.parent.as_posix()}/{relative.stem}-{source_width}.webp",
            })

    key = f"/assets/images/{relative.parent.as_posix()}/{relative.stem}"
    largest = entries[-1]
    return key, {
        "src": largest["path"],
        "width": largest["width"],
        "aspect": round(source_width / source_height, 4),
        "srcset": ", ".join(f"{e['path']} {e['width']}w" for e in entries),
    }


def main() -> None:
    if not SRC.exists():
        sys.exit(f"no source directory at {SRC}")

    manifest: dict[str, dict] = {}
    count = 0
    total = 0

    for path in sorted(SRC.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        result = process(path)
        if result is None:
            continue
        key, value = result
        manifest[key] = value
        count += 1

    for path in OUT.rglob("*.webp"):
        total += path.stat().st_size

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"processed {count} source images")
    print(f"output    {len(list(OUT.rglob('*.webp')))} webp files, {total / 1024 / 1024:.1f} MB")
    print(f"manifest  {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
