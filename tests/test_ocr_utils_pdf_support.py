import platform
import re
import sys
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import ocr_utils  # noqa: E402


def _build_single_page_text_pdf(text: str) -> bytes:
    stream = f"BT /F1 36 Tf 72 720 Td ({text}) Tj ET".encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode("ascii"))
        pdf.extend(body)
        pdf.extend(b"\nendobj\n")
    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode("ascii"))
    pdf.extend(f"startxref\n{xref_offset}\n%%EOF\n".encode("ascii"))
    return bytes(pdf)


@unittest.skipUnless(platform.system() == "Darwin", "Vision OCR PDF support requires macOS")
class OcrUtilsPdfSupportTests(unittest.TestCase):
    def test_pdf_page_ocr_extracts_text(self) -> None:
        pdf_bytes = _build_single_page_text_pdf("HELLO 123")

        page_map = ocr_utils.ocr_pdf_pages_bytes(pdf_bytes, page_numbers=[1])

        self.assertIn(1, page_map)
        normalized = re.sub(r"\s+", " ", page_map[1]).upper()
        self.assertIn("HELLO", normalized)
        self.assertIn("123", normalized)

    def test_pdf_page_ocr_structured_extracts_observations(self) -> None:
        pdf_bytes = _build_single_page_text_pdf("ALPHA 456")

        page_map = ocr_utils.ocr_pdf_pages_bytes_structured(pdf_bytes, page_numbers=[1])

        self.assertIn(1, page_map)
        texts = " ".join(str(item.get("text") or "") for item in page_map[1]).upper()
        self.assertIn("ALPHA", texts)
        self.assertIn("456", texts)


if __name__ == "__main__":
    unittest.main()
