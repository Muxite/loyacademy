"""
crop_rect.py — Crop a rectangular region from a PNG.

Coordinates can be normalised (0.0–1.0) or pixels.

Usage (normalised):
    python crop_rect.py --input page02.png --x 0.0 --y 0.38 --w 1.0 --h 0.08 --normalized --out strip_julian.png

Usage (pixels):
    python crop_rect.py --input page02.png --x 0 --y 1256 --w 4678 --h 265 --out strip_julian.png
"""

import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow required. Run: pip install Pillow")
    sys.exit(1)


def crop_rect(input_path: str, output_path: str,
              x: float, y: float, w: float, h: float,
              normalized: bool = False,
              make_transparent: bool = False, threshold: int = 240):
    """
    Crop a rectangular region from a PNG.

    Args:
        input_path:        Source PNG.
        output_path:       Destination PNG.
        x, y:             Top-left corner (normalized or pixels).
        w, h:             Width and height (normalized or pixels).
        normalized:       If True, treat x/y/w/h as fractions of image dimensions.
        make_transparent: Also apply white→transparent on the cropped region.
        threshold:        White threshold for transparency (0–255).
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input not found: {input_path}")

    img = Image.open(input_path).convert("RGBA")
    iw, ih = img.size

    if normalized:
        x_px = int(x * iw)
        y_px = int(y * ih)
        w_px = int(w * iw)
        h_px = int(h * ih)
    else:
        x_px, y_px, w_px, h_px = int(x), int(y), int(w), int(h)

    # Clamp to image bounds
    x0 = max(0, x_px)
    y0 = max(0, y_px)
    x1 = min(iw, x_px + w_px)
    y1 = min(ih, y_px + h_px)

    cropped = img.crop((x0, y0, x1, y1))

    if make_transparent:
        import numpy as np
        data = np.array(cropped, dtype=np.uint8)
        r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
        mask = (r >= threshold) & (g >= threshold) & (b >= threshold)
        data[:, :, 3] = np.where(mask, 0, data[:, :, 3])
        from PIL import Image as PILImage
        cropped = PILImage.fromarray(data, "RGBA")

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    cropped.save(output_path, "PNG")
    print(f"  Rect crop ({x0},{y0})→({x1},{y1}) = {x1-x0}x{y1-y0}px -> {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Crop a rectangular region from a PNG.")
    parser.add_argument("--input",      required=True,  help="Input PNG path")
    parser.add_argument("--out",        required=True,  help="Output PNG path")
    parser.add_argument("--x",          type=float, required=True, help="Left edge")
    parser.add_argument("--y",          type=float, required=True, help="Top edge")
    parser.add_argument("--w",          type=float, required=True, help="Width")
    parser.add_argument("--h",          type=float, required=True, help="Height")
    parser.add_argument("--normalized", action="store_true", help="Use 0–1 fractions")
    parser.add_argument("--transparent", action="store_true", help="White→transparent")
    parser.add_argument("--threshold", type=int, default=240, help="White threshold (default 240)")
    args = parser.parse_args()

    crop_rect(args.input, args.out, args.x, args.y, args.w, args.h,
              args.normalized, args.transparent, args.threshold)


if __name__ == "__main__":
    main()
