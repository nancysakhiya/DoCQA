"""
extractor.py
------------
Converts uploaded files into a list of page dicts:
  [{"page": 1, "text": "...", "source": "filename.pdf"}, ...]

Supports:
  - PDF  : PyMuPDF (fast), falls back to Tesseract OCR for scanned pages
  - DOCX : python-docx paragraph extraction
  - Images: Tesseract OCR (PNG, JPG, WEBP, TIFF)
"""

import fitz  # pymupdf
import pytesseract
from docx import Document
from PIL import Image
import io
import os
from pathlib import Path


# ── Minimum text length to consider a page "text-based" vs scanned ─────────
MIN_TEXT_LEN = 40


def extract(file_path: str, filename: str) -> list[dict]:
    """
    Main entry point. Detects file type and routes to the right extractor.
    Returns list of page dicts sorted by page number.
    """
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        return _extract_pdf(file_path, filename)
    elif ext in (".docx", ".doc"):
        return _extract_docx(file_path, filename)
    elif ext in (".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"):
        return _extract_image(file_path, filename)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


# ── PDF ─────────────────────────────────────────────────────────────────────

def _extract_pdf(file_path: str, filename: str) -> list[dict]:
    """
    Uses PyMuPDF to extract text page-by-page.
    If a page has very little text (scanned), renders it as an image
    and runs Tesseract OCR on it.
    """
    doc = fitz.open(file_path)
    pages = []

    for i, page in enumerate(doc):
        text = page.get_text("text").strip()

        # Scanned page — run OCR
        if len(text) < MIN_TEXT_LEN:
            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_bytes))
            text = pytesseract.image_to_string(img, lang="eng")
            text = text.strip()

        if text:  # skip completely blank pages
            pages.append({
                "page": i + 1,
                "text": text,
                "source": filename,
            })

    doc.close()
    return pages


# ── DOCX ────────────────────────────────────────────────────────────────────

def _extract_docx(file_path: str, filename: str) -> list[dict]:
    """
    python-docx doesn't give page numbers (Word calculates them at render time).
    We group paragraphs into pseudo-pages of ~500 words each for citation purposes.
    """
    doc = Document(file_path)
    all_text = "\n".join(
        p.text for p in doc.paragraphs if p.text.strip()
    )

    # Split into pseudo-pages (~500 words each)
    words = all_text.split()
    page_size = 500
    pages = []

    for i in range(0, len(words), page_size):
        chunk_words = words[i : i + page_size]
        pages.append({
            "page": (i // page_size) + 1,
            "text": " ".join(chunk_words),
            "source": filename,
        })

    return pages


# ── Image ───────────────────────────────────────────────────────────────────

def _extract_image(file_path: str, filename: str) -> list[dict]:
    """
    Single image = single page. Tesseract does OCR.
    """
    img = Image.open(file_path)

    # Convert to RGB if needed (RGBA, palette, etc.)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    text = pytesseract.image_to_string(img, lang="eng").strip()

    if not text:
        return []

    return [{
        "page": 1,
        "text": text,
        "source": filename,
    }]

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)