#!/usr/bin/env python3
import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


OUT_DIR = Path("public/images/ads/2026-05-08")
SIZE = "1024x1024"
QUALITY = "high"
MODELS = ["gpt-image-2", "gpt-image-1"]

COMMON_STYLE = (
    "Clean modern Japanese real estate advertising banner, photo-realistic. "
    "Use a navy blue (#1e3a5f) and warm yellow (#f4c842) accent palette. "
    "Render all Japanese text crisply, large, bold sans-serif (Noto Sans JP feel), correctly spelled, perfectly legible. "
    "Compose a clear visual hierarchy: large headline at top, supporting copy below, yellow circular badge for the price, small logo bottom-right. "
    "Bottom right small text reads 'MADOA  神戸の窓ガラス専門店'. "
    "Do NOT add any other random text, scribbles, watermarks, or sign mockups beyond what is specified. "
)

SETS = [
    (
        "set1-subsidy-1080.png",
        "Advertising banner image, 1:1. Background: bright modern Japanese living room after window renovation, large window with inner second window installed, soft morning sunlight, warm wood floor, beige curtains, no people. "
        "Top half overlaid Japanese headline in bold navy on a soft cream band: 「窓を変えれば、家が変わる。」 "
        "Below the headline, smaller line in dark gray: 「先進的窓リノベ2026 対応」 "
        "On the right side place a bright yellow circular sunburst badge with bold navy text 「最大100万円 補助金」 (two lines, big numerals). "
        "Bottom-left small green pill button with white text 「LINEで30秒見積もり」 (no LINE logo). "
        "Bottom-right tiny dark gray text 「MADOA  神戸の窓ガラス専門店」.",
    ),
    (
        "set2-condensation-1080.png",
        "Advertising banner image, 1:1. Background: Japanese home window with heavy condensation droplets and frost on a cold winter morning, a woman's hand (only hand visible) wiping the wet glass with a cloth, cool blue tone, photo-realistic. "
        "Top overlay band: bold white-on-navy headline 「結露と底冷え、窓1枚で変わります。」 (two lines, clean kerning). "
        "Sub-line beneath in lighter weight: 「補助金で実質半額以下、神戸50年の窓専門店。」 "
        "Bottom-right yellow circular badge with bold navy text 「最大100万円」. "
        "Bottom-left small green pill 「LINEで写真1枚 相談」. "
        "Tiny logo bottom-right corner 「MADOA」.",
    ),
    (
        "set3-energy-1080.png",
        "Advertising banner image, 1:1. Background: modern Japanese living room in winter, family silhouette from behind relaxing under blanket, warm cozy interior, energy-efficient double window glowing with afternoon sun. "
        "Bottom band overlay (cream color) with bold navy Japanese headline 「電気代、上がり続けるのに、窓はそのままですか。」 (two lines). "
        "Above the band, top-right bright yellow badge with bold navy text 「最大100万円 補助金」. "
        "Below headline a thin yellow underline accent, and small dark text 「神戸の窓専門 MADOA / 創業50年 年間700件」. "
        "Bottom-right tiny logo 「MADOA  神戸の窓ガラス専門店」.",
    ),
    (
        "set4-emergency-1080.png",
        "Advertising banner image, 1:1. Background: a modern Japanese glass repair worker in CONTEMPORARY INDUSTRIAL WORKWEAR — navy blue zip-up work jacket and matching work pants (Workman / Tora style, like a Japanese construction site outfit), reflective stripes on sleeves, sturdy tool belt with hand tools, white hard-hat safety helmet, work gloves, safety boots. He is measuring a broken window frame with a tape measure, focused expression, late afternoon natural light on a residential exterior, photo-realistic. "
        "Wardrobe must be MODERN CONSTRUCTION / GLAZIER WORKWEAR. STRICTLY DO NOT depict: samue (作務衣), traditional Japanese craftsman robe, hakama, yukata, kimono, monk-style robe, happi coat, or any traditional Japanese garment. No traditional patterns, no obi. Outfit must look like 2020s Japanese construction worker uniform from brands like Workman. "
        "Top overlay: thick yellow diagonal banner ribbon with bold black Japanese text 「緊急対応」. "
        "Main headline in bold white-on-navy box, two lines: 「窓が割れた。」「その日のうちに、駆けつけます。」 "
        "Sub-line in smaller white text: 「ガラス交換 見積無料・出張費無料  神戸全域対応」. "
        "Bottom-left bright green pill button with white text 「LINEで今すぐ相談」. "
        "Bottom-right small logo 「MADOA  神戸の窓ガラス専門店  創業50年」.",
    ),
    (
        "set5-line-1080.png",
        "Advertising banner image, 1:1. Background: warm interior, close-up of a hand holding a smartphone in front of a sunlit Japanese home window, shallow depth of field, soft photo-realistic. "
        "Right-side vertical band overlay (cream color) with bold navy Japanese headline 「写真1枚で、30秒見積もり。」 (two lines). "
        "Below headline smaller copy: 「LINEで送るだけ。神戸の窓専門 MADOA がすぐお返事します。」 "
        "Top-left yellow circular badge with bold navy text 「補助金 最大100万円」. "
        "Bottom-right big green pill button with white text 「LINEで相談する」 (no LINE icon). "
        "Tiny corner logo 「MADOA  創業50年」.",
    ),
]


def load_api_key() -> str | None:
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        return key

    env_path = Path.home() / ".claude.env"
    if not env_path.exists():
        return None

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "OPENAI_API_KEY" not in line:
            continue
        _, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        if value.startswith("op://"):
            try:
                result = subprocess.run(
                    ["op", "read", value],
                    check=True,
                    capture_output=True,
                    text=True,
                )
                return result.stdout.strip()
            except Exception as exc:
                print(f"Failed to read OPENAI_API_KEY via op: {exc}", file=sys.stderr)
                return None
        return value
    return None


def post_generation(api_key: str, model: str, prompt: str) -> dict:
    payload = {
        "model": model,
        "prompt": prompt,
        "size": SIZE,
        "quality": QUALITY,
        "n": 1,
        "output_format": "png",
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def error_message(exc: urllib.error.HTTPError) -> str:
    try:
        body = exc.read().decode("utf-8")
        parsed = json.loads(body)
        return parsed.get("error", {}).get("message") or body
    except Exception:
        return str(exc)


def generate_one(api_key: str, filename: str, prompt: str, preferred_model: str | None) -> str | None:
    final_prompt = COMMON_STYLE + prompt
    models = [preferred_model] if preferred_model else MODELS
    if preferred_model is None:
        models = MODELS

    last_error = None
    for model in models:
        if model is None:
            continue
        try:
            print(f"Generating {filename} with {model}...")
            response = post_generation(api_key, model, final_prompt)
            b64 = response["data"][0]["b64_json"]
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            (OUT_DIR / filename).write_bytes(base64.b64decode(b64))
            print(f"Saved {OUT_DIR / filename}")
            return model
        except urllib.error.HTTPError as exc:
            last_error = error_message(exc)
            print(f"ERROR {filename} with {model}: {last_error}", file=sys.stderr)
            if model == "gpt-image-2" and (
                "model" in last_error.lower()
                or "does not exist" in last_error.lower()
                or "not found" in last_error.lower()
                or "unsupported" in last_error.lower()
                or exc.code in {400, 404}
            ):
                continue
            break
        except Exception as exc:
            last_error = str(exc)
            print(f"ERROR {filename} with {model}: {last_error}", file=sys.stderr)
            break

    print(f"FAILED {filename}: {last_error}", file=sys.stderr)
    return preferred_model


def main() -> int:
    api_key = load_api_key()
    if not api_key:
        print(
            "OPENAI_API_KEY is not set, and no OPENAI_API_KEY entry was found/readable in ~/.claude.env.",
            file=sys.stderr,
        )
        return 2

    chosen_model = None
    for filename, prompt in SETS:
        used_model = generate_one(api_key, filename, prompt, chosen_model)
        if chosen_model is None and used_model in MODELS:
            chosen_model = used_model

    print("\nResult files:")
    for path in sorted(OUT_DIR.glob("set*-1080.png")):
        print(f"{path.name}\t{path.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
