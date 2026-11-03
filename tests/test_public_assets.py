import base64
import json
import tempfile
import unittest
from pathlib import Path
from scripts.public_assets import write_logo_assets, version_static_assets


class PublicAssetsTests(unittest.TestCase):
    def test_split_logos_retain_exact_export_asset_and_content_addressed_preview(self):
        image = b'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>'
        asset = {"mime": "image/svg+xml", "width": 24, "height": 24,
                 "dataUrl": "data:image/svg+xml;base64," + base64.b64encode(image).decode()}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_logo_assets({"logos": {"apple": asset}}, root)
            index = json.loads((root / "logo-index.json").read_text())["logos"]["apple"]
            self.assertNotIn("dataUrl", index)
            self.assertEqual(json.loads((root / index["assetUrl"].removeprefix("./data/")).read_text()), asset)
            self.assertEqual((root / index["previewUrl"].removeprefix("./data/")).read_bytes(), image)
            first = index["assetUrl"]
            asset["width"] = 25
            write_logo_assets({"logos": {"apple": asset}}, root)
            self.assertNotEqual(json.loads((root / "logo-index.json").read_text())["logos"]["apple"]["assetUrl"], first)

    def test_deployment_versions_are_derived_from_real_script_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "js").mkdir()
            script = root / "js/app.js"
            script.write_text("version1")
            (root / "index.html").write_text('<script src="js/app.js?v=old"></script>')
            version_static_assets(root)
            first = (root / "index.html").read_text()
            version_static_assets(root)
            self.assertEqual(first, (root / "index.html").read_text())
            script.write_text("version2")
            version_static_assets(root)
            self.assertNotEqual(first, (root / "index.html").read_text())
