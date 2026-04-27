import base64
import json
import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import generate_logo_catalog  # noqa: E402


CATALOG_PATH = ROOT_DIR / "data" / "logo-catalog.json"


def load_logo_catalog() -> dict[str, dict]:
    payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return payload["logos"]


def load_logo_catalog_payload() -> dict:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def decode_png_asset(asset: dict) -> tuple[int, int, bytearray]:
    raw = base64.b64decode(asset["dataUrl"].split(",", 1)[1])
    decoded = generate_logo_catalog._decode_png_rgba(raw)
    if decoded is None:
        raise AssertionError("Expected decodable PNG asset.")
    return decoded


def decode_data_url_payload(asset: dict) -> bytes:
    return base64.b64decode(asset["dataUrl"].split(",", 1)[1])


def edge_alpha_stats(asset: dict) -> dict[str, float]:
    width, height, rgba = decode_png_asset(asset)
    total = 0
    transparent = 0
    opaque = 0
    opaque_white = 0

    def visit(x: int, y: int) -> None:
        nonlocal total, transparent, opaque, opaque_white
        offset = (y * width + x) * 4
        red = rgba[offset]
        green = rgba[offset + 1]
        blue = rgba[offset + 2]
        alpha = rgba[offset + 3]
        total += 1
        if alpha <= 10:
            transparent += 1
        if alpha >= 245:
            opaque += 1
            if red >= 240 and green >= 240 and blue >= 240:
                opaque_white += 1

    for x in range(width):
        visit(x, 0)
        if height > 1:
            visit(x, height - 1)
    for y in range(1, max(height - 1, 1)):
        visit(0, y)
        if width > 1:
            visit(width - 1, y)

    return {
        "transparent_ratio": transparent / max(total, 1),
        "opaque_ratio": opaque / max(total, 1),
        "opaque_white_ratio": opaque_white / max(opaque, 1),
    }


class LogoCatalogTransparencyTests(unittest.TestCase):
    def test_logo_catalog_has_no_unresolved_logo_failures(self) -> None:
        payload = load_logo_catalog_payload()

        self.assertEqual(payload.get("failures") or {}, {})

    def test_logo_catalog_sources_are_portable_project_or_web_urls(self) -> None:
        for company_id, asset in load_logo_catalog().items():
            with self.subTest(company_id=company_id):
                source_url = str(asset.get("sourceUrl") or "")
                self.assertFalse(source_url.startswith("/Users/"), "Logo catalog should not depend on a local user path.")
                self.assertNotIn("/Downloads/", source_url, "Logo catalog should not depend on a local Downloads path.")

    def test_normalize_mime_does_not_treat_html_error_page_as_svg(self) -> None:
        payload = b"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html><body>503 backend fetch failed</body></html>
"""

        self.assertEqual(
            generate_logo_catalog._normalize_mime("application/octet-stream", payload),
            "text/html",
        )

    def test_mastercard_uses_user_uploaded_transparent_logo_asset(self) -> None:
        asset = load_logo_catalog()["mastercard"]
        stats = edge_alpha_stats(asset)

        self.assertEqual(asset["mime"], "image/png")
        self.assertEqual(asset["sourceType"], "user-uploaded")
        self.assertTrue(asset["transparentBackground"])
        self.assertEqual(asset["sourceUrl"], "assets/logos/mastercard-uploaded-transparent.png")
        self.assertGreaterEqual(
            stats["transparent_ratio"],
            0.9,
            "Mastercard uploaded logo should keep a transparent outer background.",
        )
        self.assertGreater(
            asset["visualStats"]["opaquePixelRatio"],
            0.2,
            "Mastercard uploaded logo should remain visibly rendered after transparency handling.",
        )

    def test_jd_png_logo_edges_are_mostly_transparent(self) -> None:
        asset = load_logo_catalog()["jd"]
        stats = edge_alpha_stats(asset)

        self.assertEqual(asset["mime"], "image/png")
        self.assertGreaterEqual(
            stats["transparent_ratio"],
            0.9,
            "JD logo should have transparent outer edges after normalization.",
        )
        self.assertLessEqual(
            stats["opaque_white_ratio"],
            0.1,
            "JD logo edge should no longer be dominated by opaque white background pixels.",
        )

    def test_alibaba_uses_logo_asset_with_transparent_background(self) -> None:
        asset = load_logo_catalog()["alibaba"]
        payload = decode_data_url_payload(asset).decode("utf-8", errors="ignore").lower()

        self.assertTrue(asset["transparentBackground"])
        self.assertRegex(
            asset["sourceUrl"].lower(),
            r"(logo|alibaba-logo|resource-logos|simple-icons)",
            "Alibaba should resolve to an explicit logo asset rather than an unrelated promotional image.",
        )
        self.assertIn("<svg", payload)
        self.assertNotIn("<html", payload)

    def test_amd_uses_user_uploaded_transparent_logo_asset(self) -> None:
        asset = load_logo_catalog()["amd"]
        stats = edge_alpha_stats(asset)

        self.assertEqual(asset["mime"], "image/png")
        self.assertEqual(asset["sourceType"], "user-uploaded")
        self.assertTrue(asset["transparentBackground"])
        self.assertEqual(asset["sourceUrl"], "assets/logos/amd-uploaded-transparent.png")
        self.assertGreaterEqual(
            stats["transparent_ratio"],
            0.65,
            "AMD uploaded logo should retain a transparent background after processing.",
        )
        self.assertLessEqual(
            stats["opaque_white_ratio"],
            0.05,
            "AMD logo edges should not be an opaque white rectangle.",
        )
        self.assertGreater(
            asset["visualStats"]["opaquePixelRatio"],
            0.2,
            "AMD logo should remain visibly rendered after transparency handling.",
        )


if __name__ == "__main__":
    unittest.main()
