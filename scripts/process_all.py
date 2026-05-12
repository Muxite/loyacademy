"""
process_all.py — Master runner that processes all PDFs defined in pdf_config.json.

Reads pdf_config.json, then for each tool:
  1. Extracts the specified pages to PNG at the configured DPI.
  2. Optionally applies white-to-transparent conversion.
  3. Optionally applies a circular crop/mask.

Outputs go into {output_base}/{tool_id}/{role}.png

Usage:
    python process_all.py
    python process_all.py --config pdf_config.json
    python process_all.py --tool bmi          # process only one tool
    python process_all.py --dpi 600           # override DPI for all
"""

import argparse
import json
import os
import sys
import tempfile

# Fix Windows console encoding for Thai filenames
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Import sibling scripts
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from extract_pages import extract_pages
from make_transparent import make_transparent
from crop_circle import crop_circle
from crop_rect import crop_rect


def process_tool(tool: dict, output_base: str, dpi_override: int = None):
    tool_id = tool["id"]
    pdf_path = os.path.abspath(os.path.join(script_dir, tool["pdf"]))
    out_dir = os.path.abspath(os.path.join(script_dir, output_base, tool_id))
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n[{tool_id}] Processing '{pdf_path}'")

    for page_cfg in tool["pages"]:
        page_num = page_cfg["page"]
        role = page_cfg["role"]
        dpi = dpi_override or page_cfg.get("dpi", 400)
        do_transparent = page_cfg.get("make_transparent", False)
        threshold = page_cfg.get("transparent_threshold", 240)
        circle_cfg = page_cfg.get("circle", None)
        rect_cfg   = page_cfg.get("rect", None)

        print(f"  Page {page_num} -> role={role}, dpi={dpi}")

        with tempfile.TemporaryDirectory() as tmp:
            # Step 1: Extract page to PNG
            raw_paths = extract_pages(pdf_path, [page_num], dpi, tmp, name_prefix="raw")
            if not raw_paths:
                print(f"  Warning: No output for page {page_num}, skipping.")
                continue
            current_path = raw_paths[0]

            # Step 2: White -> transparent
            if do_transparent:
                alpha_path = os.path.join(tmp, "alpha.png")
                make_transparent(current_path, alpha_path, threshold)
                current_path = alpha_path

            # Step 3a: Rectangular crop (for sliding strips)
            if rect_cfg:
                rect_path = os.path.join(tmp, "rect.png")
                crop_rect(
                    current_path, rect_path,
                    x=rect_cfg["x"], y=rect_cfg["y"],
                    w=rect_cfg["w"], h=rect_cfg["h"],
                    normalized=True,
                    make_transparent=rect_cfg.get("make_transparent", do_transparent),
                    threshold=threshold,
                )
                current_path = rect_path

            # Step 3b: Circular crop (for rotating discs)
            elif circle_cfg:
                circ_path = os.path.join(tmp, "circle.png")
                crop_circle(
                    current_path, circ_path,
                    cx=circle_cfg["cx"],
                    cy=circle_cfg["cy"],
                    r=circle_cfg["r"],
                    normalized=True
                )
                current_path = circ_path

            # Copy final result to output dir
            import shutil
            final_path = os.path.join(out_dir, f"{role}.png")
            shutil.copy2(current_path, final_path)
            size = os.path.getsize(final_path) / 1024
            print(f"  -> {final_path} ({size:.0f} KB)")

    print(f"[{tool_id}] Done.")


def main():
    parser = argparse.ArgumentParser(description="Process all PDFs defined in pdf_config.json.")
    parser.add_argument("--config", default=os.path.join(script_dir, "pdf_config.json"),
                        help="Path to pdf_config.json (default: same dir as this script)")
    parser.add_argument("--tool", default=None, help="Process only this tool ID")
    parser.add_argument("--dpi", type=int, default=None, help="Override DPI for all pages")
    args = parser.parse_args()

    config_path = os.path.abspath(args.config)
    if not os.path.exists(config_path):
        print(f"Error: Config not found: {config_path}")
        sys.exit(1)

    with open(config_path, encoding="utf-8") as f:
        config = json.load(f)

    output_base = config.get("output_base", "../loyacademy-web/public/assets")
    tools = config["tools"]

    if args.tool:
        tools = [t for t in tools if t["id"] == args.tool]
        if not tools:
            print(f"Error: Tool '{args.tool}' not found in config.")
            sys.exit(1)

    print(f"Processing {len(tools)} tool(s) from: {config_path}")
    print(f"Output base: {os.path.abspath(os.path.join(script_dir, output_base))}")

    for tool in tools:
        try:
            process_tool(tool, output_base, dpi_override=args.dpi)
        except Exception as e:
            print(f"  ERROR processing {tool['id']}: {e}")

    print("\nAll done.")


if __name__ == "__main__":
    main()
