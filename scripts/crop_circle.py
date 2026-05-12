"""
crop_circle.py — Crop a circular region from a PNG, with circular alpha mask.

Coordinates can be specified as:
  - Normalized (0.0–1.0): fractions of image width/height (use --normalized flag)
  - Pixels: absolute pixel coordinates

The output is a square PNG sized 2r x 2r with everything outside the circle transparent.

Usage (normalized):
    python crop_circle.py --input page01_alpha.png --cx 0.5 --cy 0.5 --r 0.45 --normalized --out disc_outer.png

Usage (pixels):
    python crop_circle.py --input page01_alpha.png --cx 850 --cy 1100 --r 800 --out disc_outer.png
"""

import argparse
import math
import os
import sys

try:
    from PIL import Image, ImageDraw
    import numpy as np
except ImportError:
    print("Error: Pillow and numpy required. Run: pip install Pillow numpy")
    sys.exit(1)


def crop_circle(input_path: str, output_path: str, cx: float, cy: float, r: float, normalized: bool = False):
    """
    Extract a circular region from an image.

    Args:
        input_path: Source PNG path.
        output_path: Destination PNG path.
        cx: Center x (pixel or normalized 0–1).
        cy: Center y (pixel or normalized 0–1).
        r: Radius (pixel or normalized 0–1 relative to width).
        normalized: If True, treat cx/cy/r as fractions of image dimensions.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input not found: {input_path}")

    img = Image.open(input_path).convert("RGBA")
    w, h = img.size

    if normalized:
        cx_px = int(cx * w)
        cy_px = int(cy * h)
        r_px = int(r * w)  # radius relative to width
    else:
        cx_px = int(cx)
        cy_px = int(cy)
        r_px = int(r)

    # Bounding box for the circle
    left = cx_px - r_px
    top = cy_px - r_px
    right = cx_px + r_px
    bottom = cy_px + r_px

    # Crop the bounding square (clamp to image bounds)
    crop_left = max(0, left)
    crop_top = max(0, top)
    crop_right = min(w, right)
    crop_bottom = min(h, bottom)

    cropped = img.crop((crop_left, crop_top, crop_right, crop_bottom))

    # Create output canvas (2r x 2r) with transparent background
    size = r_px * 2
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Paste cropped region onto canvas (offset by how much we had to clamp)
    paste_x = crop_left - left
    paste_y = crop_top - top
    canvas.paste(cropped, (paste_x, paste_y))

    # Apply circular mask
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)

    canvas_data = np.array(canvas)
    mask_data = np.array(mask)

    # Multiply existing alpha with circle mask
    canvas_data[:, :, 3] = (canvas_data[:, :, 3].astype(np.uint16) * mask_data // 255).astype(np.uint8)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    result = Image.fromarray(canvas_data, "RGBA")
    result.save(output_path, "PNG")
    print(f"  Circle cropped ({size}x{size}px, center={cx_px},{cy_px} r={r_px}) -> {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Crop a circular region from a PNG with transparent mask.")
    parser.add_argument("--input", required=True, help="Input PNG path")
    parser.add_argument("--out", required=True, help="Output PNG path")
    parser.add_argument("--cx", type=float, required=True, help="Center X")
    parser.add_argument("--cy", type=float, required=True, help="Center Y")
    parser.add_argument("--r", type=float, required=True, help="Radius")
    parser.add_argument("--normalized", action="store_true",
                        help="Treat cx/cy/r as normalized fractions (0.0–1.0) of image dimensions")
    args = parser.parse_args()

    crop_circle(args.input, args.out, args.cx, args.cy, args.r, args.normalized)


if __name__ == "__main__":
    main()
