import base64
import json
import tempfile
import unittest
from pathlib import Path
from scripts.public_assets import write_logo_assets, version_static_assets, validate_frontend_assets, INLINE_LOGO_TOTAL_BYTES


class PublicAssetsTests(unittest.TestCase):
    def test_root_and_built_sites_use_the_same_canonical_logo_assets(self):
        data = Path(__file__).resolve().parents[1] / 'data'
        with tempfile.TemporaryDirectory() as directory:
            generated = Path(directory)
            write_logo_assets(json.loads((data / 'logo-catalog.json').read_text()), generated)
            self.assertEqual((data / 'logo-index.json').read_bytes(), (generated / 'logo-index.json').read_bytes())
            for file in (generated / 'logos').iterdir():
                self.assertEqual((data / 'logos' / file.name).read_bytes(), file.read_bytes())

    def test_split_logos_retain_exact_export_asset_and_content_addressed_preview(self):
        image = b'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><!--' + b'x' * 3000 + b'--></svg>'
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

    def test_small_inline_logos_avoid_a_second_fetch_with_a_bounded_total_budget(self):
        asset = {'mime':'image/svg+xml','width':24,'height':24,'dataUrl':'data:image/svg+xml;base64,' + base64.b64encode(b'<svg><!--'+b'x'*700+b'--></svg>').decode()}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_logo_assets({'logos':{str(i):asset for i in range(40)}}, root)
            logos = json.loads((root/'logo-index.json').read_text())['logos']
            inline = [a for a in logos.values() if a.get('dataUrl')]
            self.assertGreater(len(inline),0)
            self.assertLess(len(inline),40)
            self.assertLessEqual(sum(len(json.dumps(asset,separators=(',',':')).encode()) for a in inline),INLINE_LOGO_TOTAL_BYTES)
            self.assertEqual(logos['0']['dataUrl'],asset['dataUrl'])
            self.assertTrue(logos['39']['assetUrl'])

    def test_checked_in_frontend_matches_sources_and_rejects_a_stale_or_modified_bundle(self):
        import shutil
        source = Path(__file__).resolve().parents[1]
        validate_frontend_assets(source)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('js','assets'):
                shutil.copytree(source/name,root/name)
            for name in ('index.html','package.json','scripts/build_frontend.cjs'):
                (root/name).parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(source/name,root/name)
            validate_frontend_assets(root)
            script = root/'js/app-02-sankey.js'
            original = script.read_bytes()
            script.write_bytes(original+b'\n// changed')
            with self.assertRaisesRegex(ValueError,'stale'):
                validate_frontend_assets(root)
            script.write_bytes(original)
            bundle = root/json.loads((root/'assets/frontend-manifest.json').read_text())['bundle']
            bundle.write_bytes(bundle.read_bytes()+b'\n// modified')
            with self.assertRaisesRegex(ValueError,'content'):
                validate_frontend_assets(root)

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
