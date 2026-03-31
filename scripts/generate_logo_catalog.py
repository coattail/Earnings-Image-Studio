from __future__ import annotations

import base64
import html
import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT_DIR / "data" / "logo-catalog.json"
DATASET_PATH = ROOT_DIR / "data" / "earnings-dataset.json"
SIMPLE_ICON_URL = "https://cdn.jsdelivr.net/npm/simple-icons/icons/{slug}.svg"

COMPANY_DOMAINS: dict[str, str] = {
    "nvidia": "nvidia.com",
    "apple": "apple.com",
    "alphabet": "abc.xyz",
    "microsoft": "microsoft.com",
    "amazon": "amazon.com",
    "tsmc": "tsmc.com",
    "meta": "meta.com",
    "broadcom": "broadcom.com",
    "tesla": "tesla.com",
    "berkshire": "berkshirehathaway.com",
    "walmart": "walmart.com",
    "eli-lilly": "lilly.com",
    "jpmorgan": "jpmorganchase.com",
    "exxon": "exxonmobil.com",
    "visa": "visa.com",
    "jnj": "jnj.com",
    "asml": "asml.com",
    "oracle": "oracle.com",
    "micron": "micron.com",
    "costco": "costco.com",
    "mastercard": "mastercard.com",
    "abbvie": "abbvie.com",
    "netflix": "netflix.com",
    "chevron": "chevron.com",
    "palantir": "palantir.com",
    "procter-gamble": "pg.com",
    "bank-of-america": "bankofamerica.com",
    "home-depot": "homedepot.com",
    "coca-cola": "coca-colacompany.com",
    "caterpillar": "caterpillar.com",
    "tencent": "tencent.com",
    "alibaba": "alibabagroup.com",
    "jd": "jd.com",
    "netease": "netease.com",
    "xiaomi": "xiaomi.com",
    "byd": "byd.com",
    "meituan": "meituan.com",
}

OFFICIAL_HOST_ALIASES: dict[str, tuple[str, ...]] = {
    "alphabet": ("google.com", "www.google.com", "gstatic.com", "www.gstatic.com"),
    "alibaba": (
        "alibaba.com",
        "alibabagroup.com",
        "assets.alibabagroup.com",
        "data.alibabagroup.com",
        "static.alibabagroup.com",
    ),
    "amazon": ("aboutamazon.com", "www.aboutamazon.com", "assets.aboutamazon.com"),
    "eli-lilly": ("delivery-p137454-e1438138.adobeaemcloud.com",),
    "jnj": ("johnsonandjohnson.com", "jnj-content-lab2.brightspotcdn.com"),
    "meituan": ("p0.meituan.net", "s3plus.meituan.net"),
}

OVERRIDE_LOGO_SOURCES: dict[str, dict[str, Any]] = {
    "alibaba": {
        "url": SIMPLE_ICON_URL.format(slug="alibabadotcom"),
        "fill": "#FF6A00",
    },
    "alphabet": {
        "url": "https://www.gstatic.com/images/branding/productlogos/googleg/v6/192px.svg",
        "official": True,
    },
    "amazon": {
        "url": "https://assets.aboutamazon.com/48/8c/1bc5933b414d82435b08581f742d/logo-1.svg",
        "official": True,
    },
    "apple": {
        "url": SIMPLE_ICON_URL.format(slug="apple"),
        "fill": "#6B7280",
    },
    "asml": {
        "url": "https://cdn.worldvectorlogo.com/logos/asml.svg",
    },
    "bank-of-america": {
        "url": SIMPLE_ICON_URL.format(slug="bankofamerica"),
        "fill": "#C41230",
    },
    "berkshire": {
        "url": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Berkshire%20Hathaway.svg",
    },
    "broadcom": {
        "url": SIMPLE_ICON_URL.format(slug="broadcom"),
        "fill": "#C62828",
    },
    "caterpillar": {
        "url": SIMPLE_ICON_URL.format(slug="caterpillar"),
        "fill": "#111827",
    },
    "chevron": {
        "url": "https://cdn.worldvectorlogo.com/logos/chevron.svg",
    },
    "coca-cola": {
        "url": SIMPLE_ICON_URL.format(slug="cocacola"),
        "fill": "#F40009",
    },
    "costco": {
        "url": "https://cdn.worldvectorlogo.com/logos/costco-wholesale.svg",
    },
    "eli-lilly": {
        "url": "https://delivery-p137454-e1438138.adobeaemcloud.com/adobe/assets/urn:aaid:aem:2843cade-80ee-42b6-b285-a1450fef6b77/renditions/original/as/LillyLogo_RGB_Red_v3.svg?assetname=LillyLogo_RGB_Red_v3.svg",
        "official": True,
    },
    "exxon": {
        "url": "https://corporate.exxonmobil.com/-/media/global/icons/footer/sites/logo-exxonmobil-main.svg",
        "official": True,
    },
    "jnj": {
        "url": "https://jnj-content-lab2.brightspotcdn.com/ac/25/bd2078f54d5992dd486ed26140ce/johnson-johnson-logo.svg",
    },
    "jpmorgan": {
        "url": "https://www.jpmorganchase.com/content/dam/jpmorganchase/images/logos/jpmc-logo.svg",
    },
    "meta": {
        "url": SIMPLE_ICON_URL.format(slug="meta"),
        "fill": "#0866FF",
    },
    "microsoft": {
        "url": "https://uhf.microsoft.com/images/microsoft/RE1Mu3b.png",
        "official": True,
    },
    "mastercard": {
        "url": SIMPLE_ICON_URL.format(slug="mastercard"),
        "fill": "#EB001B",
    },
    "micron": {
        "url": "https://cdn.worldvectorlogo.com/logos/micron.svg",
    },
    "netease": {
        "url": "https://ir.netease.com/sites/g/files/knoqqb53596/themes/site/nir_pid158/client/images/NetEase-logo.png",
        "official": True,
    },
    "netflix": {
        "url": SIMPLE_ICON_URL.format(slug="netflix"),
        "fill": "#E50914",
    },
    "nvidia": {
        "url": SIMPLE_ICON_URL.format(slug="nvidia"),
        "fill": "#76B900",
    },
    "palantir": {
        "url": SIMPLE_ICON_URL.format(slug="palantir"),
        "fill": "#111827",
    },
    "procter-gamble": {
        "url": "https://images.ctfassets.net/oggad6svuzkv/6eWEFfxHDZrqJ2DGt1NqpQ/0919f47f4215e2e27fb754a821a5e685/PG_logo_OGtransparent.png",
    },
    "tesla": {
        "url": SIMPLE_ICON_URL.format(slug="tesla"),
        "fill": "#CC0000",
    },
    "visa": {
        "url": SIMPLE_ICON_URL.format(slug="visa"),
        "fill": "#1434CB",
    },
    "walmart": {
        "url": "https://brandcenter.walmart.com/content/brand/us/en/home/brand-identity/spark/_jcr_content/root/container/footer_copy_copy/logo.coreimg.svg/1740780744169/spark.svg",
    },
    "tencent": {
        "url": "https://www.tencent.com/img/index/tencent_logo.png",
        "official": True,
    },
    "home-depot": {
        "url": "https://cdn.worldvectorlogo.com/logos/the-home-depot.svg",
    },
    "oracle": {
        "url": "https://cdn.worldvectorlogo.com/logos/oracle.svg",
    },
    "tsmc": {
        "url": "https://cdn.worldvectorlogo.com/logos/tsmc.svg",
    },
    "abbvie": {
        "url": SIMPLE_ICON_URL.format(slug="abbvie"),
        "fill": "#071D49",
    },
    "xiaomi": {
        "url": "https://i01.appmifile.com/webfile/globalimg/mobile/logo/mi.png",
        "official": True,
    },
    "jd": {
        "url": "https://img14.360buyimg.com/imagetools/jfs/t1/265960/38/828/10287/676565f6Fcdb37884/072d830437959819.png",
        "official": True,
    },
    "meituan": {
        "page_url": "https://www.meituan.com/",
        "symbol_id": "wk-meituan",
        "official": True,
    },
}

OFFICIAL_DISCOVERY_PAGE_URLS = (
    "https://www.{domain}/",
    "https://{domain}/",
    "https://www.{domain}/about",
    "https://{domain}/about",
    "https://www.{domain}/about.html",
    "https://{domain}/about.html",
    "https://www.{domain}/en-us/",
    "https://{domain}/en-us/",
    "https://www.{domain}/investors",
    "https://{domain}/investors",
    "https://www.{domain}/investors.html",
    "https://{domain}/investors.html",
    "https://ir.{domain}/",
)

OFFICIAL_CANDIDATE_URLS = (
    "https://{domain}/logo.svg",
    "https://www.{domain}/logo.svg",
    "https://{domain}/logo.png",
    "https://www.{domain}/logo.png",
    "https://{domain}/assets/logo.svg",
    "https://www.{domain}/assets/logo.svg",
    "https://{domain}/assets/logo.png",
    "https://www.{domain}/assets/logo.png",
    "https://{domain}/img/logo.svg",
    "https://www.{domain}/img/logo.svg",
    "https://{domain}/img/logo.png",
    "https://www.{domain}/img/logo.png",
)

LOGO_HINT_KEYWORDS = ("logo", "brand", "wordmark", "logotype")
NEGATIVE_LOGO_URL_KEYWORDS = (
    "og-image",
    "ogimage",
    "earnings",
    "quarter",
    "report",
    "hero",
    "banner",
    "cover",
    "thumbnail",
    "thumb",
    "article",
    "news",
    "press",
    "media",
    "social",
    "share",
    "campaign",
    "event",
    "olympic",
    "games",
    "campus",
    "launch",
    "launches",
    "customer",
    "customers",
    "default-img",
    "defaultimage",
    "favicon",
    "fileicon",
    "fileiconsvg",
)

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    "Accept": "image/svg+xml,image/png,image/*;q=0.8,*/*;q=0.5",
}


def _request_headers_for_url(url: str, *, text_mode: bool = False) -> dict[str, str]:
    if text_mode:
        return {**REQUEST_HEADERS, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"}
    path = urllib.parse.urlparse(url).path.lower()
    if path.endswith(".svg"):
        accept = "image/svg+xml,image/*;q=0.8,*/*;q=0.5"
    elif path.endswith(".png"):
        accept = "image/png,image/*;q=0.8,*/*;q=0.5"
    else:
        accept = REQUEST_HEADERS["Accept"]
    return {**REQUEST_HEADERS, "Accept": accept}


def _request_bytes(url: str) -> tuple[bytes, str]:
    request_headers = _request_headers_for_url(url)
    request = urllib.request.Request(url, headers=request_headers)
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            content_type = response.headers.get_content_type() or "application/octet-stream"
            return response.read(), content_type
    except Exception:
        curl = subprocess.run(
            ["curl", "--http1.1", "-L", "-sS", "--max-time", "40", "-H", f"Accept: {request_headers['Accept']}", url],
            check=True,
            capture_output=True,
        )
        return curl.stdout, "application/octet-stream"


def _request_text(url: str) -> str:
    request_headers = _request_headers_for_url(url, text_mode=True)
    request = urllib.request.Request(
        url,
        headers=request_headers,
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="ignore")
    except Exception:
        curl = subprocess.run(
            ["curl", "--http1.1", "-L", "-sS", "--max-time", "40", "-H", f"Accept: {request_headers['Accept']}", url],
            check=True,
            capture_output=True,
        )
        return curl.stdout.decode("utf-8", errors="ignore")


def _png_dimensions(data: bytes) -> tuple[int, int] | None:
    if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) < 24:
        return None
    return (
        int.from_bytes(data[16:20], "big"),
        int.from_bytes(data[20:24], "big"),
    )


def _text_sniff_prefix(payload: bytes, limit: int = 4096) -> str:
    return payload[:limit].decode("utf-8", errors="ignore").lstrip("\ufeff \t\r\n\0").lower()


def _looks_like_svg_payload(payload: bytes) -> bool:
    prefix = _text_sniff_prefix(payload)
    return bool(re.search(r"<svg\b", prefix))


def _looks_like_html_payload(payload: bytes) -> bool:
    prefix = _text_sniff_prefix(payload)
    return bool(re.search(r"<!doctype\s+html\b|<html\b|<body\b|<head\b|<title\b", prefix))


def _normalize_mime(content_type: str, payload: bytes) -> str:
    if payload.startswith(b"\x89PNG"):
        return "image/png"
    if _looks_like_svg_payload(payload):
        return "image/svg+xml"
    if _looks_like_html_payload(payload):
        return "text/html"
    return content_type or "application/octet-stream"


def _png_chunks(payload: bytes) -> list[tuple[bytes, bytes]]:
    if not payload.startswith(b"\x89PNG\r\n\x1a\n"):
        return []
    offset = 8
    chunks: list[tuple[bytes, bytes]] = []
    while offset + 8 <= len(payload):
        chunk_length = int.from_bytes(payload[offset : offset + 4], "big")
        chunk_type = payload[offset + 4 : offset + 8]
        data_start = offset + 8
        data_end = data_start + chunk_length
        if data_end + 4 > len(payload):
            return []
        chunks.append((chunk_type, payload[data_start:data_end]))
        offset = data_end + 4
        if chunk_type == b"IEND":
            break
    return chunks


def _apply_svg_fill(payload: bytes, fill: str | None) -> bytes:
    if not fill:
        return payload
    text = payload.decode("utf-8", errors="ignore")
    if "<svg" not in text:
        return payload
    if re.search(r"<svg[^>]+fill=", text):
        return payload
    text = re.sub(r"<svg(\s+)", f'<svg fill="{fill}"\\1', text, count=1)
    return text.encode("utf-8")


def _png_has_transparency(data: bytes) -> bool:
    stats = _png_visual_stats(data)
    if stats is not None:
        return bool(stats.get("hasTransparency"))
    if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) < 26:
        return False
    color_type = data[25]
    if color_type not in (4, 6):
        return False
    offset = 8
    while offset + 8 <= len(data):
        chunk_length = int.from_bytes(data[offset : offset + 4], "big")
        chunk_type = data[offset + 4 : offset + 8]
        offset += 8
        if offset + chunk_length + 4 > len(data):
            break
        if chunk_type == b"tRNS":
            return True
        offset += chunk_length + 4
        if chunk_type == b"IEND":
            break
    return False


def _paeth_predictor(left: int, up: int, up_left: int) -> int:
    predictor = left + up - up_left
    left_distance = abs(predictor - left)
    up_distance = abs(predictor - up)
    up_left_distance = abs(predictor - up_left)
    if left_distance <= up_distance and left_distance <= up_left_distance:
        return left
    if up_distance <= up_left_distance:
        return up
    return up_left


def _decode_png_rgba(payload: bytes) -> tuple[int, int, bytearray] | None:
    dimensions = _png_dimensions(payload)
    if dimensions is None:
        return None
    width, height = dimensions
    chunks = _png_chunks(payload)
    if not chunks:
        return None
    ihdr = next((chunk for chunk_type, chunk in chunks if chunk_type == b"IHDR"), None)
    if ihdr is None or len(ihdr) < 13:
        return None
    bit_depth = ihdr[8]
    color_type = ihdr[9]
    interlace_method = ihdr[12]
    if bit_depth != 8 or interlace_method != 0 or color_type not in (2, 6):
        return None
    bytes_per_pixel = 4 if color_type == 6 else 3
    compressed = b"".join(chunk for chunk_type, chunk in chunks if chunk_type == b"IDAT")
    if not compressed:
        return None
    try:
        raw = zlib.decompress(compressed)
    except zlib.error:
        return None
    row_size = width * bytes_per_pixel
    if len(raw) < height * (row_size + 1):
        return None

    rgba = bytearray(width * height * 4)
    position = 0
    previous_row = bytearray(row_size)
    for y in range(height):
        filter_type = raw[position]
        position += 1
        current_row = bytearray(raw[position : position + row_size])
        position += row_size
        if len(current_row) != row_size:
            return None
        if filter_type == 1:
            for index in range(row_size):
                current_row[index] = (current_row[index] + (current_row[index - bytes_per_pixel] if index >= bytes_per_pixel else 0)) & 0xFF
        elif filter_type == 2:
            for index in range(row_size):
                current_row[index] = (current_row[index] + previous_row[index]) & 0xFF
        elif filter_type == 3:
            for index in range(row_size):
                left = current_row[index - bytes_per_pixel] if index >= bytes_per_pixel else 0
                current_row[index] = (current_row[index] + ((left + previous_row[index]) // 2)) & 0xFF
        elif filter_type == 4:
            for index in range(row_size):
                left = current_row[index - bytes_per_pixel] if index >= bytes_per_pixel else 0
                up = previous_row[index]
                up_left = previous_row[index - bytes_per_pixel] if index >= bytes_per_pixel else 0
                current_row[index] = (current_row[index] + _paeth_predictor(left, up, up_left)) & 0xFF
        previous_row = current_row

        for x in range(width):
            src_offset = x * bytes_per_pixel
            dst_offset = (y * width + x) * 4
            rgba[dst_offset] = current_row[src_offset]
            rgba[dst_offset + 1] = current_row[src_offset + 1]
            rgba[dst_offset + 2] = current_row[src_offset + 2]
            rgba[dst_offset + 3] = current_row[src_offset + 3] if color_type == 6 else 255
    return width, height, rgba


def _encode_png_rgba(width: int, height: int, rgba: bytes) -> bytes:
    stride = width * 4
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])
    compressed = zlib.compress(bytes(raw), level=9)

    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        checksum = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return len(data).to_bytes(4, "big") + chunk_type + data + checksum.to_bytes(4, "big")

    ihdr = (
        width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + bytes([8, 6, 0, 0, 0])
    )
    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            _chunk(b"IHDR", ihdr),
            _chunk(b"IDAT", compressed),
            _chunk(b"IEND", b""),
        ]
    )


def _is_neutral_background_pixel(red: int, green: int, blue: int) -> bool:
    return max(red, green, blue) - min(red, green, blue) <= 22


def _detect_logo_background_rgba(rgba: bytearray, width: int, height: int) -> dict[str, Any] | None:
    samples: list[tuple[int, int, int, int, int]] = []

    def _push_sample(x: int, y: int) -> None:
        offset = (y * width + x) * 4
        if rgba[offset + 3] < 245:
            return
        samples.append((x, y, rgba[offset], rgba[offset + 1], rgba[offset + 2]))

    for x in range(width):
        for y in range(height):
            if rgba[(y * width + x) * 4 + 3] >= 245:
                _push_sample(x, y)
                break
        for y in range(height - 1, -1, -1):
            if rgba[(y * width + x) * 4 + 3] >= 245:
                _push_sample(x, y)
                break
    for y in range(height):
        for x in range(width):
            if rgba[(y * width + x) * 4 + 3] >= 245:
                _push_sample(x, y)
                break
        for x in range(width - 1, -1, -1):
            if rgba[(y * width + x) * 4 + 3] >= 245:
                _push_sample(x, y)
                break

    neutral_samples = []
    for x, y, red, green, blue in samples:
        if not _is_neutral_background_pixel(red, green, blue):
            continue
        luminance = (red + green + blue) / 3
        if luminance < 18 or luminance > 236:
            neutral_samples.append((x, y, red, green, blue))
    if len(neutral_samples) < 12:
        return None
    red = round(sum(item[2] for item in neutral_samples) / len(neutral_samples))
    green = round(sum(item[3] for item in neutral_samples) / len(neutral_samples))
    blue = round(sum(item[4] for item in neutral_samples) / len(neutral_samples))
    if not _is_neutral_background_pixel(red, green, blue):
        return None
    stable_samples = [
        (x, y)
        for x, y, sample_red, sample_green, sample_blue in neutral_samples
        if abs(sample_red - red) <= 18 and abs(sample_green - green) <= 18 and abs(sample_blue - blue) <= 18
    ]
    if len(stable_samples) < 8:
        return None
    return {"red": red, "green": green, "blue": blue, "seeds": stable_samples}


def _remove_edge_background_rgba(rgba: bytes, width: int, height: int, background: dict[str, Any]) -> bytes | None:
    data = bytearray(rgba)
    visited = bytearray(width * height)
    queue = list(background.get("seeds") or [])
    queue_index = 0
    tolerance = 26
    removed = 0

    def _matches_background(point_index: int) -> bool:
        pixel_index = point_index * 4
        if data[pixel_index + 3] < 20:
            return False
        return (
            abs(data[pixel_index] - background["red"]) <= tolerance
            and abs(data[pixel_index + 1] - background["green"]) <= tolerance
            and abs(data[pixel_index + 2] - background["blue"]) <= tolerance
        )

    while queue_index < len(queue):
        x, y = queue[queue_index]
        queue_index += 1
        if not (0 <= x < width and 0 <= y < height):
            continue
        point_index = y * width + x
        if visited[point_index]:
            continue
        visited[point_index] = 1
        if not _matches_background(point_index):
            continue
        pixel_index = point_index * 4
        data[pixel_index + 3] = 0
        removed += 1
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    if removed < width * height * 0.04:
        return None
    return bytes(data)


def _opaque_bounds_rgba(rgba: bytes, width: int, height: int, alpha_threshold: int = 10) -> dict[str, int] | None:
    min_x = width
    min_y = height
    max_x = -1
    max_y = -1
    for y in range(height):
        for x in range(width):
            offset = (y * width + x) * 4
            if rgba[offset + 3] < alpha_threshold:
                continue
            if x < min_x:
                min_x = x
            if y < min_y:
                min_y = y
            if x > max_x:
                max_x = x
            if y > max_y:
                max_y = y
    if max_x < min_x or max_y < min_y:
        return None
    return {
        "left": min_x,
        "top": min_y,
        "right": max_x,
        "bottom": max_y,
        "width": max_x - min_x + 1,
        "height": max_y - min_y + 1,
    }


def _crop_rgba(rgba: bytes, width: int, height: int, left: int, top: int, crop_width: int, crop_height: int) -> bytes:
    result = bytearray(crop_width * crop_height * 4)
    source_stride = width * 4
    target_stride = crop_width * 4
    for row in range(crop_height):
        source_start = ((top + row) * width + left) * 4
        source_end = source_start + target_stride
        target_start = row * target_stride
        result[target_start : target_start + target_stride] = rgba[source_start:source_end]
    return bytes(result)


def _normalize_png_payload(payload: bytes) -> tuple[bytes, dict[str, Any]]:
    decoded = _decode_png_rgba(payload)
    if decoded is None:
        return payload, {"normalized": False}
    width, height, rgba = decoded
    background = _detect_logo_background_rgba(rgba, width, height)
    transparent_rgba = _remove_edge_background_rgba(rgba, width, height, background) if background else None
    normalized_rgba = transparent_rgba or bytes(rgba)
    bounds = _opaque_bounds_rgba(normalized_rgba, width, height)
    if bounds is None:
        if transparent_rgba is None:
            return payload, {"normalized": False}
        return _encode_png_rgba(width, height, normalized_rgba), {
            "normalized": True,
            "backgroundRemoved": True,
            "cropped": False,
        }

    trim_padding = max(1, round(min(width, height) * 0.012))
    crop_left = max(bounds["left"] - trim_padding, 0)
    crop_top = max(bounds["top"] - trim_padding, 0)
    crop_right = min(bounds["right"] + trim_padding, width - 1)
    crop_bottom = min(bounds["bottom"] + trim_padding, height - 1)
    crop_width = crop_right - crop_left + 1
    crop_height = crop_bottom - crop_top + 1
    if transparent_rgba is None and crop_width >= width - 2 and crop_height >= height - 2:
        return payload, {"normalized": False}
    cropped_rgba = _crop_rgba(normalized_rgba, width, height, crop_left, crop_top, crop_width, crop_height)
    return _encode_png_rgba(crop_width, crop_height, cropped_rgba), {
        "normalized": True,
        "backgroundRemoved": transparent_rgba is not None,
        "cropped": crop_width != width or crop_height != height,
    }


def _png_visual_stats(payload: bytes) -> dict[str, Any] | None:
    dimensions = _png_dimensions(payload)
    if dimensions is None:
        return None
    width, height = dimensions
    chunks = _png_chunks(payload)
    if not chunks:
        return None
    ihdr = next((chunk for chunk_type, chunk in chunks if chunk_type == b"IHDR"), None)
    if ihdr is None or len(ihdr) < 13:
        return None
    bit_depth = ihdr[8]
    color_type = ihdr[9]
    interlace_method = ihdr[12]
    if bit_depth != 8 or interlace_method != 0 or color_type not in (2, 6):
        return None
    bytes_per_pixel = 4 if color_type == 6 else 3
    compressed = b"".join(chunk for chunk_type, chunk in chunks if chunk_type == b"IDAT")
    if not compressed:
        return None
    try:
        raw = zlib.decompress(compressed)
    except zlib.error:
        return None
    row_size = width * bytes_per_pixel
    expected_min_length = height * (row_size + 1)
    if len(raw) < expected_min_length:
        return None

    sample_step_x = max(width // 48, 1)
    sample_step_y = max(height // 48, 1)
    sample_colors: set[tuple[int, ...]] = set()
    sampled_visible_pixels = 0
    sampled_visible_luminance_total = 0
    sampled_near_white_visible_pixels = 0
    sampled_near_black_visible_pixels = 0
    opaque_pixels = 0
    transparent_pixels = 0
    semi_transparent_pixels = 0
    position = 0
    previous_row = bytearray(row_size)

    for y in range(height):
        filter_type = raw[position]
        position += 1
        current_row = bytearray(raw[position : position + row_size])
        position += row_size
        if len(current_row) != row_size:
            return None
        if filter_type == 1:
            for index in range(row_size):
                current_row[index] = (current_row[index] + (current_row[index - bytes_per_pixel] if index >= bytes_per_pixel else 0)) & 0xFF
        elif filter_type == 2:
            for index in range(row_size):
                current_row[index] = (current_row[index] + previous_row[index]) & 0xFF
        elif filter_type == 3:
            for index in range(row_size):
                left = current_row[index - bytes_per_pixel] if index >= bytes_per_pixel else 0
                current_row[index] = (current_row[index] + ((left + previous_row[index]) // 2)) & 0xFF
        elif filter_type == 4:
            for index in range(row_size):
                left = current_row[index - bytes_per_pixel] if index >= bytes_per_pixel else 0
                up = previous_row[index]
                up_left = previous_row[index - bytes_per_pixel] if index >= bytes_per_pixel else 0
                current_row[index] = (current_row[index] + _paeth_predictor(left, up, up_left)) & 0xFF
        previous_row = current_row

        for x in range(width):
            pixel_offset = x * bytes_per_pixel
            alpha = 255
            if color_type == 6:
                alpha = current_row[pixel_offset + 3]
                if alpha == 0:
                    transparent_pixels += 1
                elif alpha == 255:
                    opaque_pixels += 1
                else:
                    semi_transparent_pixels += 1
            if y % sample_step_y == 0 and x % sample_step_x == 0:
                sample_colors.add(tuple(current_row[pixel_offset : pixel_offset + bytes_per_pixel]))
                if alpha >= 20:
                    red = current_row[pixel_offset]
                    green = current_row[pixel_offset + 1]
                    blue = current_row[pixel_offset + 2]
                    luminance = (red + green + blue) / 3
                    sampled_visible_pixels += 1
                    sampled_visible_luminance_total += luminance
                    if luminance >= 242:
                        sampled_near_white_visible_pixels += 1
                    elif luminance <= 28:
                        sampled_near_black_visible_pixels += 1

    total_pixels = max(width * height, 1)
    non_opaque_ratio = (transparent_pixels + semi_transparent_pixels) / total_pixels
    sampled_visible_pixel_count = max(sampled_visible_pixels, 1)
    return {
        "sampleUniqueColors": len(sample_colors),
        "transparentPixelRatio": round(transparent_pixels / total_pixels, 4),
        "semiTransparentPixelRatio": round(semi_transparent_pixels / total_pixels, 4),
        "opaquePixelRatio": round(opaque_pixels / total_pixels, 4),
        "averageVisibleLuminance": round(sampled_visible_luminance_total / sampled_visible_pixel_count, 1) if sampled_visible_pixels else None,
        "nearWhiteVisibleRatio": round(sampled_near_white_visible_pixels / sampled_visible_pixel_count, 4) if sampled_visible_pixels else None,
        "nearBlackVisibleRatio": round(sampled_near_black_visible_pixels / sampled_visible_pixel_count, 4) if sampled_visible_pixels else None,
        "hasTransparency": non_opaque_ratio > 0.001,
    }


def _svg_dimensions(payload: bytes) -> tuple[int, int] | None:
    text = payload.decode("utf-8", errors="ignore")
    view_box_match = re.search(r'viewBox\s*=\s*["\']\s*[0-9.]+\s+[0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["\']', text)
    if view_box_match:
      return (max(int(float(view_box_match.group(1))), 1), max(int(float(view_box_match.group(2))), 1))
    size_match = re.search(r'width\s*=\s*["\']([0-9.]+)', text)
    height_match = re.search(r'height\s*=\s*["\']([0-9.]+)', text)
    if size_match and height_match:
      return (max(int(float(size_match.group(1))), 1), max(int(float(height_match.group(1))), 1))
    return None


def _svg_contains_embedded_raster(payload: bytes) -> bool:
    text = payload.decode("utf-8", errors="ignore").lower()
    return "<image" in text or "data:image/" in text


def _extra_official_hosts(company_id: str, domain: str) -> tuple[str, ...]:
    hosts = list(OFFICIAL_HOST_ALIASES.get(company_id, ()))
    normalized_domain = domain.lower()
    if normalized_domain not in hosts:
        hosts.append(normalized_domain)
    return tuple(dict.fromkeys(hosts))


def _is_official_host(url: str, domain: str, extra_hosts: tuple[str, ...] = ()) -> bool:
    host = urllib.parse.urlparse(url).netloc.lower()
    normalized_domain = domain.lower()
    if host == normalized_domain or host.endswith(f".{normalized_domain}"):
        return True
    return any(host == item.lower() or host.endswith(f".{item.lower()}") for item in extra_hosts)


def _raster_is_crisp(dimensions: tuple[int, int] | None) -> bool:
    if dimensions is None:
        return False
    width, height = dimensions
    return max(width, height) >= 120 and width * height >= 6000


def _looks_like_logo_url(url: str, company_id: str, domain: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    path = urllib.parse.unquote(parsed.path.lower())
    query = urllib.parse.unquote(parsed.query.lower())
    company_tokens = {
        company_id.lower(),
        company_id.lower().replace("-", ""),
        company_id.lower().split("-")[0],
        domain.lower().split(".")[0],
    }
    path_haystack = f"{path} {query}"
    host_haystack = parsed.netloc.lower()
    if any(keyword in path_haystack for keyword in LOGO_HINT_KEYWORDS):
        return True
    if any(token and token in path_haystack for token in company_tokens):
        return True
    return any(keyword in host_haystack for keyword in LOGO_HINT_KEYWORDS)


def _extract_official_logo_urls(company_id: str, domain: str) -> list[str]:
    discovered: list[str] = []
    seen: set[str] = set()
    extra_hosts = _extra_official_hosts(company_id, domain)
    for template in OFFICIAL_DISCOVERY_PAGE_URLS:
        page_url = template.format(domain=domain)
        try:
            html_text = _request_text(page_url)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, UnicodeDecodeError, subprocess.CalledProcessError):
            continue
        html_text = html_text.replace("\\/", "/")
        raw_values = re.findall(r'(?i)(?:src|href|content)=["\']([^"\']+)["\']', html_text)
        raw_values.extend(re.findall(r'https?://[^"\'>\s]+|/[^"\'>\s]+', html_text))
        for raw_value in raw_values:
            candidate = html.unescape(raw_value).strip()
            if not candidate or candidate.startswith("data:"):
                continue
            try:
                absolute_url = urllib.parse.urljoin(page_url, candidate)
            except ValueError:
                continue
            parsed = urllib.parse.urlparse(absolute_url)
            path = urllib.parse.unquote(parsed.path.lower())
            if parsed.scheme not in ("http", "https"):
                continue
            if absolute_url in seen:
                continue
            if not _is_official_host(absolute_url, domain, extra_hosts):
                continue
            if not re.search(r"\.(svg|png|webp|jpg|jpeg)$", path):
                continue
            if not _looks_like_logo_url(absolute_url, company_id, domain):
                continue
            seen.add(absolute_url)
            discovered.append(absolute_url)
    return discovered


def _resolve_symbol_logo_source(
    page_url: str,
    symbol_id: str,
    company_id: str,
    domain: str,
    *,
    official_override: bool | None = None,
    source_type: str,
) -> dict[str, Any] | None:
    html_text = _request_text(page_url).replace("\\/", "/")
    symbol_match = re.search(
        rf"<symbol[^>]+id=[\"']{re.escape(symbol_id)}[\"'][^>]*viewBox=[\"']([^\"']+)[\"'][^>]*>(.*?)</symbol>",
        html_text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not symbol_match:
        return None
    view_box = symbol_match.group(1).strip()
    inner_markup = symbol_match.group(2).strip()
    payload = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{html.escape(view_box, quote=True)}">'
        f"{inner_markup}</svg>"
    ).encode("utf-8")
    dimensions = _svg_dimensions(payload)
    is_official = _is_official_host(page_url, domain, _extra_official_hosts(company_id, domain)) if official_override is None else official_override
    return {
        "sourceUrl": f"{page_url}#symbol:{symbol_id}",
        "mime": "image/svg+xml",
        "dataUrl": f"data:image/svg+xml;base64,{base64.b64encode(payload).decode('ascii')}",
        "width": dimensions[0] if dimensions else 64,
        "height": dimensions[1] if dimensions else 64,
        "officialSource": is_official,
        "transparentBackground": True,
        "sourceType": source_type,
        "visualStats": {},
        "containsEmbeddedRaster": _svg_contains_embedded_raster(payload),
        "normalization": {"normalized": True, "source": "inline-symbol"},
    }


def _resolve_logo_source(
    url: str,
    company_id: str,
    domain: str,
    *,
    fill: str | None = None,
    official_override: bool | None = None,
    source_type: str,
) -> dict[str, Any] | None:
    payload, content_type = _request_bytes(url)
    mime = _normalize_mime(content_type, payload)
    if mime == "text/html":
        return None
    payload = _apply_svg_fill(payload, fill)
    is_official = _is_official_host(url, domain, _extra_official_hosts(company_id, domain)) if official_override is None else official_override
    if mime not in ("image/svg+xml", "image/png"):
        return None
    original_dimensions = _svg_dimensions(payload) if mime == "image/svg+xml" else _png_dimensions(payload)
    normalization: dict[str, Any] = {"normalized": False}
    if mime == "image/png":
        payload, normalization = _normalize_png_payload(payload)
    dimensions = _svg_dimensions(payload) if mime == "image/svg+xml" else _png_dimensions(payload)
    png_visual_stats = _png_visual_stats(payload) if mime == "image/png" else None
    is_transparent = mime == "image/svg+xml" or (mime == "image/png" and _png_has_transparency(payload))
    if mime != "image/svg+xml" and not _raster_is_crisp(original_dimensions or dimensions):
        return None

    return {
        "sourceUrl": url,
        "mime": mime,
        "dataUrl": f"data:{mime};base64,{base64.b64encode(payload).decode('ascii')}",
        "width": dimensions[0] if dimensions else 64,
        "height": dimensions[1] if dimensions else 64,
        "officialSource": is_official,
        "transparentBackground": is_transparent,
        "sourceType": source_type,
        "visualStats": png_visual_stats or {},
        "containsEmbeddedRaster": _svg_contains_embedded_raster(payload) if mime == "image/svg+xml" else False,
        "normalization": normalization,
    }


def _score_logo_candidate(candidate: dict[str, Any]) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    mime = str(candidate.get("mime") or "").lower()
    url = str(candidate.get("sourceUrl") or "")
    path_and_query = urllib.parse.unquote(f"{urllib.parse.urlparse(url).path} {urllib.parse.urlparse(url).query}".lower())
    width = int(candidate.get("width") or 64)
    height = int(candidate.get("height") or 64)
    transparent = bool(candidate.get("transparentBackground"))
    official = bool(candidate.get("officialSource"))
    source_type = str(candidate.get("sourceType") or "")
    visual_stats = candidate.get("visualStats") or {}
    sample_unique_colors = int(visual_stats.get("sampleUniqueColors") or 0)
    average_visible_luminance = float(visual_stats.get("averageVisibleLuminance") or 0)
    near_white_visible_ratio = float(visual_stats.get("nearWhiteVisibleRatio") or 0)
    aspect_ratio = width / max(height, 1)
    raster_area = width * height
    has_logo_hint = any(keyword in path_and_query for keyword in LOGO_HINT_KEYWORDS)

    if official:
        score += 320
        reasons.append("official-host")
    if mime == "image/svg+xml":
        score += 220
        reasons.append("vector")
    if transparent:
        score += 150
        reasons.append("transparent")
    if source_type == "override":
        score += 80
        reasons.append("manual-override")
    elif source_type == "official-inline":
        score += 95
        reasons.append("official-inline")
    elif source_type == "discovered":
        score += 55
        reasons.append("discovered")
    elif source_type == "fallback-favicon":
        score -= 60
        reasons.append("favicon-fallback")

    if has_logo_hint:
        score += 65
        reasons.append("logo-keyword")
    if any(keyword in path_and_query for keyword in NEGATIVE_LOGO_URL_KEYWORDS):
        score -= 220
        reasons.append("marketing-image-keyword")
    if "s2/favicons" in path_and_query:
        score -= 320
        reasons.append("google-favicon")
    if mime != "image/svg+xml" and not transparent:
        score -= 180
        reasons.append("opaque-raster")
    if mime == "image/png" and source_type == "discovered" and not has_logo_hint and raster_area >= 120000:
        score -= 180
        reasons.append("large-discovered-raster-without-logo-hint")
    if mime == "image/png" and sample_unique_colors > 96 and not transparent:
        score -= 140
        reasons.append("photo-like-color-diversity")
    if mime == "image/png" and source_type == "discovered" and not has_logo_hint and sample_unique_colors > 48:
        score -= 120
        reasons.append("photo-like-discovered-raster")
    if mime == "image/png" and transparent and near_white_visible_ratio >= 0.72 and average_visible_luminance >= 232:
        score -= 260
        reasons.append("light-bg-invisible")
    if mime == "image/svg+xml" and candidate.get("containsEmbeddedRaster"):
        score -= 100
        reasons.append("embedded-raster-svg")

    if 1.2 <= aspect_ratio <= 9:
        score += 20
        reasons.append("logo-like-aspect-ratio")
    if mime != "image/svg+xml" and width * height < 4096:
        score -= 80
        reasons.append("too-small")

    return score, reasons


def _load_brand_colors() -> dict[str, str]:
    if not DATASET_PATH.exists():
        return {}
    payload = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    return {
        company.get("id"): company.get("brand", {}).get("primary", "#111827")
        for company in payload.get("companies", [])
    }


def _select_logo(company_id: str, domain: str) -> dict[str, Any]:
    last_error: str | None = None
    resolved_candidates: list[dict[str, Any]] = []
    override_source = OVERRIDE_LOGO_SOURCES.get(company_id)
    candidate_specs: list[dict[str, Any]] = []
    if override_source:
        if override_source.get("page_url") and override_source.get("symbol_id"):
            candidate_specs.append(
                {
                    "page_url": override_source["page_url"],
                    "symbol_id": override_source["symbol_id"],
                    "official_override": override_source.get("official"),
                    "source_type": "official-inline",
                }
            )
        elif override_source.get("url"):
            candidate_specs.append(
                {
                    "url": override_source["url"],
                    "fill": override_source.get("fill"),
                    "official_override": override_source.get("official"),
                    "source_type": "override",
                }
            )

    candidate_specs.extend(
        {"url": url, "source_type": "discovered"}
        for url in _extract_official_logo_urls(company_id, domain)
    )
    candidate_specs.extend(
        {"url": template.format(domain=domain), "source_type": "discovered"}
        for template in OFFICIAL_CANDIDATE_URLS
    )
    seen_sources: set[str] = set()
    for spec in candidate_specs:
        source_key = spec.get("url") or f"{spec.get('page_url')}#symbol:{spec.get('symbol_id')}"
        if source_key in seen_sources:
            continue
        seen_sources.add(source_key)
        try:
            if spec.get("page_url") and spec.get("symbol_id"):
                resolved = _resolve_symbol_logo_source(
                    spec["page_url"],
                    spec["symbol_id"],
                    company_id,
                    domain,
                    official_override=spec.get("official_override"),
                    source_type=spec["source_type"],
                )
            else:
                resolved = _resolve_logo_source(
                    spec["url"],
                    company_id,
                    domain,
                    fill=spec.get("fill"),
                    official_override=spec.get("official_override"),
                    source_type=spec["source_type"],
                )
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, subprocess.CalledProcessError) as exc:
            last_error = str(exc)
            continue
        if resolved is None:
            last_error = f"unsupported image type or dimensions: {source_key}"
            continue
        score, reasons = _score_logo_candidate(resolved)
        resolved["selectionScore"] = score
        resolved["selectionReasons"] = reasons
        resolved_candidates.append(resolved)

    if not resolved_candidates:
        raise RuntimeError(last_error or "no usable logo asset found")
    best_candidate = max(resolved_candidates, key=lambda item: (int(item.get("selectionScore") or 0), bool(item.get("officialSource")), bool(item.get("transparentBackground"))))
    best_candidate["candidateCount"] = len(resolved_candidates)
    return best_candidate


def main() -> int:
    brand_colors = _load_brand_colors()
    existing_catalog: dict[str, Any] = {}
    if OUTPUT_PATH.exists():
        try:
            existing_payload = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
            if isinstance(existing_payload.get("logos"), dict):
                existing_catalog = existing_payload["logos"]
        except Exception:
            existing_catalog = {}
    catalog: dict[str, Any] = {}
    failures: dict[str, str] = {}
    for company_id, domain in COMPANY_DOMAINS.items():
        try:
            if company_id in OVERRIDE_LOGO_SOURCES and "fill_from_brand" in OVERRIDE_LOGO_SOURCES[company_id]:
                OVERRIDE_LOGO_SOURCES[company_id]["fill"] = brand_colors.get(company_id, "#111827")
            catalog[company_id] = {
                "domain": domain,
                **_select_logo(company_id, domain),
            }
            print(f"[ok] {company_id} <- {catalog[company_id]['sourceUrl']}", flush=True)
        except Exception as exc:  # noqa: BLE001
            if company_id in existing_catalog:
                catalog[company_id] = existing_catalog[company_id]
                failures[company_id] = f"{exc} (kept previous cached asset)"
                print(f"[warn] {company_id}: {exc} -> kept previous cached asset", flush=True)
            else:
                failures[company_id] = str(exc)
                print(f"[warn] {company_id}: {exc}", flush=True)

    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "logos": catalog,
        "failures": failures,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[done] wrote {OUTPUT_PATH}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
