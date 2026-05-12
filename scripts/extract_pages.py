"""
extract_pages.py — Render specific PDF pages to high-resolution PNG files.

Usage:
    python extract_pages.py --pdf "../pdf/BMI 2.cdr.pdf" --pages 1,2 --dpi 400 --out ../output/bmi/
    python extract_pages.py --pdf "../pdf/BMI 2.cdr.pdf" --pages 1 --dpi 400 --out ../output/bmi/ --name background
"""

import argparse
import os
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Error: PyMuPDF not installed. Run: pip install pymupdf")
    sys.exit(1)


def extract_pages(pdf_path: str, pages: list[int], dpi: int, out_dir: str, name_prefix: str = None):
    """
    Render specified pages of a PDF to PNG at the given DPI.

    Args:
        pdf_path: Path to the PDF file.
        pages: 1-based list of page numbers to render.
        dpi: Dots per inch for rendering (higher = better quality).
        out_dir: Directory to write PNG files into.
        name_prefix: Optional name override (used when extracting a single page with a role name).

    Returns:
        List of output file paths.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    os.makedirs(out_dir, exist_ok=True)

    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    output_paths = []

    # PyMuPDF matrix for desired DPI (base is 72 DPI)
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)

    for page_num in pages:
        if page_num < 1 or page_num > total_pages:
            print(f"Warning: Page {page_num} out of range (PDF has {total_pages} pages). Skipping.")
            continue

        page = doc[page_num - 1]  # 0-indexed
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)

        if name_prefix and len(pages) == 1:
            filename = f"{name_prefix}.png"
        else:
            filename = f"page{page_num:02d}.png"

        out_path = os.path.join(out_dir, filename)
        pixmap.save(out_path)
        output_paths.append(out_path)
        print(f"  Saved page {page_num} -> {out_path} ({pixmap.width}x{pixmap.height}px)")

    doc.close()
    return output_paths


def main():
    parser = argparse.ArgumentParser(description="Extract PDF pages to PNG at high DPI.")
    parser.add_argument("--pdf", required=True, help="Path to the PDF file")
    parser.add_argument("--pages", required=True, help="Comma-separated 1-based page numbers, e.g. 1,2,3")
    parser.add_argument("--dpi", type=int, default=400, help="Render DPI (default: 400)")
    parser.add_argument("--out", required=True, help="Output directory")
    parser.add_argument("--name", default=None, help="Output filename prefix (without .png) for single-page extract")
    args = parser.parse_args()

    pages = [int(p.strip()) for p in args.pages.split(",")]
    extract_pages(args.pdf, pages, args.dpi, args.out, args.name)


if __name__ == "__main__":
    main()
