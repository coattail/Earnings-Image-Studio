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
SIMPLE_ICON_URL = "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/{slug}.svg"

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
    "alibaba": (
        "alibaba.com",
        "alibabagroup.com",
        "assets.alibabagroup.com",
        "data.alibabagroup.com",
        "static.alibabagroup.com",
    ),
    "jnj": ("johnsonandjohnson.com", "jnj-content-lab2.brightspotcdn.com"),
}

OVERRIDE_LOGO_SOURCES: dict[str, dict[str, Any]] = {
    "alibaba": {
        "url": "https://static.alibabagroup.com/static/c33a2ec2-de56-429a-b279-2d6211a83108.png",
        "official": True,
    },
    "alphabet": {
        "url": "https://www.gstatic.com/images/branding/productlogos/googleg/v6/192px.svg",
    },
    "amazon": {
        "url": "https://assets.aboutamazon.com/48/8c/1bc5933b414d82435b08581f742d/logo-1.svg",
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
        "url": "https://cdn.worldvectorlogo.com/logos/lilly.svg",
    },
    "exxon": {
        "url": "https://corporate.exxonmobil.com/-/media/global/icons/logos/em-default-img-2880-1620.png",
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
        "url": "https://ir.jd.com/sites/g/files/knoqqb53391/themes/site/nir_pid834/client/images/main-logo.png",
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

FALLBACK_CANDIDATE_URLS = (
    "https://{domain}/apple-touch-icon.png",
    "https://www.{domain}/apple-touch-icon.png",
    "https://{domain}/apple-touch-icon-precomposed.png",
    "https://www.{domain}/apple-touch-icon-precomposed.png",
    "https://www.google.com/s2/favicons?domain_url=https://{domain}&sz=256",
)

LOGO_HINT_KEYWORDS = ("logo", "brand", "wordmark", "logotype")
NEGATIVE_LOGO_URL_KEYWORDS = (
    "og-image",
    "ogimage",
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
    "default-img",
    "defaultimage",
)

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
}


def _request_bytes(url: str) -> tuple[bytes, str]:
    request = urllib.request.Request(url, headers=REQUEST_HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            content_type = response.headers.get_content_type() or "application/octet-stream"
            return response.read(), content_type
    except Exception:
        curl = subprocess.run(
            ["curl", "--http1.1", "-L", "-sS", "--max-time", "40", url],
            check=True,
            capture_output=True,
        )
        return curl.stdout, "application/octet-stream"


def _request_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={**REQUEST_HEADERS, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"},
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="ignore")
    except Exception:
        curl = subprocess.run(
            ["curl", "--http1.1", "-L", "-sS", "--max-time", "40", url],
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


def _normalize_mime(content_type: str, payload: bytes) -> str:
    if payload.startswith(b"<svg") or payload.lstrip().startswith(b"<?xml"):
        return "image/svg+xml"
    if payload.startswith(b"\x89PNG"):
        return "image/png"
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
    payload = _apply_svg_fill(payload, fill)
    mime = _normalize_mime(content_type, payload)
    dimensions = _svg_dimensions(payload) if mime == "image/svg+xml" else _png_dimensions(payload)
    png_visual_stats = _png_visual_stats(payload) if mime == "image/png" else None
    is_transparent = mime == "image/svg+xml" or (mime == "image/png" and _png_has_transparency(payload))
    is_official = _is_official_host(url, domain, _extra_official_hosts(company_id, domain)) if official_override is None else official_override
    if mime not in ("image/svg+xml", "image/png"):
        return None
    if mime != "image/svg+xml" and not _raster_is_crisp(dimensions):
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
    elif source_type == "discovered":
        score += 55
        reasons.append("discovered")
    elif source_type == "fallback-favicon":
        score -= 60
        reasons.append("favicon-fallback")

    if any(keyword in path_and_query for keyword in LOGO_HINT_KEYWORDS):
        score += 65
        reasons.append("logo-keyword")
    if any(keyword in path_and_query for keyword in NEGATIVE_LOGO_URL_KEYWORDS):
        score -= 220
        reasons.append("marketing-image-keyword")
    if mime != "image/svg+xml" and not transparent:
        score -= 180
        reasons.append("opaque-raster")
    if mime == "image/png" and sample_unique_colors > 96 and not transparent:
        score -= 140
        reasons.append("photo-like-color-diversity")
    if mime == "image/png" and transparent and near_white_visible_ratio >= 0.72 and average_visible_luminance >= 232:
        score -= 260
        reasons.append("light-bg-invisible")
    if mime == "image/svg+xml" and candidate.get("containsEmbeddedRaster"):
        score -= 100
        reasons.append("embedded-raster-svg")

    if 1.2 <= aspect_ratio <= 9:
        score += 20
        reasons.append("logo-like-aspect-ratio")
    if width * height < 4096:
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
    candidate_specs.extend(
        {"url": template.format(domain=domain), "source_type": "fallback-favicon"}
        for template in FALLBACK_CANDIDATE_URLS
    )

    seen_urls: set[str] = set()
    for spec in candidate_specs:
        url = spec["url"]
        if url in seen_urls:
            continue
        seen_urls.add(url)
        try:
            resolved = _resolve_logo_source(
                url,
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
            last_error = f"unsupported image type or dimensions: {url}"
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
