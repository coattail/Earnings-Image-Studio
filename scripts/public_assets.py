"""Small, content-addressed browser assets; canonical source files stay intact."""
import base64
import hashlib
import json
from pathlib import Path


def write_logo_assets(catalog, data_dir: Path):
    assets_dir = data_dir / "logos"
    assets_dir.mkdir(parents=True, exist_ok=True)
    logos = {}
    for key, asset in catalog.get("logos", {}).items():
        data_url = asset.get("dataUrl", "")
        if not data_url.startswith("data:image/") or ";base64," not in data_url:
            logos[key] = asset
            continue
        encoded = json.dumps(asset, ensure_ascii=False, separators=(",", ":")).encode()
        digest = hashlib.sha256(encoded).hexdigest()[:16]
        extension = {"image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}.get(asset.get("mime"))
        if not extension:
            logos[key] = asset
            continue
        stem = f"{digest}"
        (assets_dir / f"{stem}.json").write_bytes(encoded)
        (assets_dir / f"{stem}.{extension}").write_bytes(base64.b64decode(data_url.split(",", 1)[1]))
        logos[key] = {k: v for k, v in asset.items() if k != "dataUrl"}
        logos[key].update(assetUrl=f"./data/logos/{stem}.json", previewUrl=f"./data/logos/{stem}.{extension}")
    (data_dir / "logo-index.json").write_text(json.dumps({"logos": logos}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def version_static_assets(dist_dir: Path):
    """Cache-bust by content on every deployment, including automated ones."""
    import re
    index_path = dist_dir / "index.html"
    html = index_path.read_text(encoding="utf-8")

    def version(match):
        filename = match[1]
        digest = hashlib.sha256((dist_dir / filename).read_bytes()).hexdigest()[:16]
        return f'"{filename}?v={digest}"'

    html = re.sub(r'"((?:js/[^"?]+\.js|style\.css))(?:\?[^\"]*)?"', version, html)
    index_path.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    # Some hosts publish the repository root directly, without a build command.
    # Keep the same generated assets there as in the GitHub Pages artifact.
    data_dir = Path(__file__).resolve().parents[1] / "data"
    write_logo_assets(json.loads((data_dir / "logo-catalog.json").read_text(encoding="utf-8")), data_dir)
    version_static_assets(data_dir.parent)
