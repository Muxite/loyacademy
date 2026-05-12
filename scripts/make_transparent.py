"""
make_transparent.py — Convert white/near-white backgrounds to transparent (RGBA).

Usage:
    python make_transparent.py --input page01.png --threshold 240 --out page01_alpha.png
"""

import argparse
import os
import sys

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Error: Pillow and numpy required. Run: pip install Pillow numpy")
    sys.exit(1)


def make_transparent(input_path: str, output_path: str, threshold: int = 240):
    """
    Convert pixels where all RGB channels are >= threshold to fully transparent.

    Args:
        input_path: Path to the input PNG.
        output_path: Path to write the output RGBA PNG.
        threshold: Pixels with R, G, B all >= this value become transparent (0-255).
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input not found: {input_path}")

    img = Image.open(input_path).convert("RGBA")
    data = np.array(img, dtype=np.uint8)

    r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]

    # Mask: pixels where all channels are "near white"
    white_mask = (r >= threshold) & (g >= threshold) & (b >= threshold)
    data[:, :, 3] = np.where(white_mask, 0, a)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    result = Image.fromarray(data, "RGBA")
    result.save(output_path, "PNG")
    print(f"  Transparent mask applied -> {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Make white backgrounds transparent in PNG images.")
    parser.add_argument("--input", required=True, help="Input PNG path")
    parser.add_argument("--out", required=True, help="Output PNG path")
    parser.add_argument("--threshold", type=int, default=240,
                        help="Pixels with all channels >= threshold become transparent (default: 240)")
    args = parser.parse_args()

    make_transparent(args.input, args.out, args.threshold)


if __name__ == "__main__":
    main()
