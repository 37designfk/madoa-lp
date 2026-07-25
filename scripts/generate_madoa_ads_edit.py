#!/usr/bin/env python3
"""MADOA メタ広告バナー生成 (実写ベース + 文字焼き込み版)

各セットの実写写真を OpenAI Images Edit API (gpt-image-1) に渡して、
文字・黄色バッジ・CTAボタンを焼き込んだ広告バナーに加工する。
"""
import base64
import io
import os
import subprocess
import sys
import urllib.request
import json
from pathlib import Path

from PIL import Image

OUT_DIR = Path("public/images/ads/2026-05-08")
SRC_DIR = Path("public/images/subsidy")
SIZE = "1024x1024"
MODEL = "gpt-image-2"  # edit endpoint も同じモデル名で受理される想定。ダメなら gpt-image-1
ENDPOINT = "https://api.openai.com/v1/images/edits"

COMMON_STYLE = (
    "Keep the original photo as the base, preserve the people and scene exactly. "
    "Overlay clean modern Japanese advertising banner typography with a navy blue (#1e3a5f) and warm yellow (#f4c842) palette. "
    "Render all Japanese text crisply, large, bold sans-serif (Noto Sans JP feel), perfectly legible, correctly spelled. "
    "Bottom-right tiny dark text 'MADOA  神戸の窓ガラス専門店'. "
    "Do NOT alter clothes, faces, or scenery of the base photo unless necessary for text legibility. "
)

SETS = [
    (
        "set1-subsidy-1080.png",
        "staff.jpg",
        "Top-left overlay band (semi-transparent cream): bold navy Japanese headline 「窓を変えれば、家が変わる。」 (two lines). "
        "Just below the headline in dark gray: 「先進的窓リノベ2026 対応・神戸50年の窓専門店」. "
        "Top-right large yellow circular sunburst badge with bold navy text 「最大100万円 補助金」 (two lines). "
        "Bottom-left bright green pill button with white text 「LINEで30秒見積もり」. ",
    ),
    (
        "set2-condensation-1080.png",
        "flow-04.jpg",
        "Top overlay band (navy with 70% opacity): bold white Japanese headline 「結露と底冷え、窓1枚で変わります。」 (two lines). "
        "Sub-line beneath in lighter weight white: 「補助金で実質半額以下、神戸50年の窓専門店。」 "
        "Bottom-right large yellow circular badge with bold navy text 「最大100万円」. "
        "Bottom-left bright green pill button with white text 「LINEで写真1枚 相談」. ",
    ),
    (
        "set3-energy-1080.png",
        "flow-03.jpg",
        "Bottom overlay band (cream): bold navy Japanese headline 「電気代、上がり続けるのに、窓はそのままですか。」 (two lines). "
        "Top-right large yellow circular badge with bold navy text 「最大100万円 補助金」 (two lines). "
        "Below the headline a thin yellow underline accent, small dark text 「神戸の窓専門 MADOA / 創業50年 年間700件」. ",
    ),
    (
        "set4-emergency-1080.png",
        "flow-02.jpg",
        "Top-left thick yellow diagonal banner ribbon with bold black Japanese text 「緊急対応」. "
        "Main headline in bold white text on navy box, two lines: 「窓が割れた。」「その日のうちに、駆けつけます。」 "
        "Sub-line in smaller white text: 「ガラス交換 見積無料・出張費無料  神戸全域対応」. "
        "Bottom-left bright green pill button with white text 「LINEで今すぐ相談」. ",
    ),
    (
        "set5-line-1080.png",
        "flow-01.jpg",
        "Right-side vertical band overlay (cream color): bold navy Japanese headline 「写真1枚で、30秒見積もり。」 (two lines). "
        "Below headline smaller copy: 「LINEで送るだけ。神戸の窓専門 MADOA がすぐお返事します。」 "
        "Top-left yellow circular badge with bold navy text 「補助金 最大100万円」. "
        "Bottom-right big green pill button with white text 「LINEで相談する」. ",
    ),
]


def load_api_key() -> str | None:
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        return key
    try:
        result = subprocess.run(
            ["op", "read", "op://Claude Code/OpenAI/api_key"],
            check=True, capture_output=True, text=True,
        )
        return result.stdout.strip()
    except Exception:
        return None


def to_square_png_bytes(src_path: Path, size: int = 1024) -> bytes:
    img = Image.open(src_path).convert("RGB")
    w, h = img.size
    # center crop to square
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img = img.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def edit_image(api_key: str, image_bytes: bytes, prompt: str, model: str) -> bytes:
    boundary = "----madoa-boundary-zZz9"
    parts = []
    def field(name, value):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode())
    def file_field(name, filename, content):
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\"\r\nContent-Type: image/png\r\n\r\n".encode()
            + content + b"\r\n"
        )
    field("model", model)
    field("prompt", prompt)
    field("size", SIZE)
    field("n", "1")
    file_field("image", "base.png", image_bytes)
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)

    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.loads(resp.read().decode())
    b64 = data["data"][0]["b64_json"]
    return base64.b64decode(b64)


def main():
    api_key = load_api_key()
    if not api_key:
        print("ERROR: OPENAI_API_KEY not found", file=sys.stderr)
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    full_style_prefix = COMMON_STYLE

    results = []
    for out_name, src_name, set_prompt in SETS:
        src = SRC_DIR / src_name
        if not src.exists():
            print(f"SKIP {out_name}: source {src} missing")
            continue
        print(f"Generating {out_name} from {src_name} with {MODEL}...")
        try:
            img_bytes = to_square_png_bytes(src)
            prompt = full_style_prefix + set_prompt
            png = edit_image(api_key, img_bytes, prompt, MODEL)
            out_path = OUT_DIR / out_name
            out_path.write_bytes(png)
            results.append((out_name, len(png)))
            print(f"Saved {out_path}")
        except urllib.error.HTTPError as e:  # type: ignore
            body = e.read().decode("utf-8", errors="ignore")
            print(f"HTTPError for {out_name}: {e.code} {body[:300]}", file=sys.stderr)
        except Exception as exc:
            print(f"Failed {out_name}: {exc}", file=sys.stderr)

    print("\nResult files:")
    for name, size in results:
        print(f"{name}\t{size} bytes")


if __name__ == "__main__":
    import urllib.error  # noqa
    main()
