"""Language detection, translation notes, and Indic linguistic utilities."""

from __future__ import annotations
import re
from typing import Optional


def detect_query_language(text: str) -> str:
    """Detect whether query is primarily in Hindi, Gujarati, or English.
    
    Uses Unicode range checking:
    - Devanagari (Hindi): \u0900 - \u097F
    - Gujarati: \u0A80 - \u0AFF
    Defaults to 'en' (English).
    """
    if not text:
        return "en"

    # Count script characters
    devanagari_count = len(re.findall(r"[\u0900-\u097F]", text))
    gujarati_count = len(re.findall(r"[\u0A80-\u0AFF]", text))

    if gujarati_count > 1 or (gujarati_count > devanagari_count and gujarati_count > 0):
        return "gu"
    elif devanagari_count > 1:
        return "hi"

    # Secondary check: romanized Hindi / Gujarati common keywords
    text_lower = text.lower()
    hindi_romanized = ["mausam", "kaisa", "barish", "tapman", "hoga", "aaj", "kal"]
    gujarati_romanized = ["havaman", "kevu", "varsad", "thashe", "aaje"]

    if any(w in text_lower for w in gujarati_romanized):
        return "gu"
    if any(w in text_lower for w in hindi_romanized):
        return "hi"

    return "en"


def get_language_system_prompt(language: str) -> str:
    """Return explicit multilingual grounding instruction for the generator."""
    if language == "hi":
        return (
            "You MUST respond in Hindi (हिंदी). All facts, dates, temperatures, and numbers must come strictly from the payload. "
            "Use natural Hindi phrasing while keeping standard meteorological units (e.g. °C, किमी/घंटा, hPa). "
            "Never fabricate or guess unverified numbers."
        )
    elif language == "gu":
        return (
            "You MUST respond in Gujarati (ગુજરાતી). All facts, dates, temperatures, and numbers must come strictly from the payload. "
            "Use natural Gujarati phrasing while keeping standard meteorological units (e.g. °C, કિમી/કલાક, hPa). "
            "Never fabricate or guess unverified numbers."
        )
    return (
        "Respond in clear, natural English. State verified facts using ONLY the verified payload. "
        "Never fabricate or guess unverified numbers."
    )


def assess_translation_quality(text: str, target_lang: str) -> Optional[str]:
    """Check if the translation quality is reliable or uncertain; return a limitation note if uncertain."""
    if target_lang == "en":
        return None

    if target_lang == "hi":
        dev_chars = len(re.findall(r"[\u0900-\u097F]", text))
        # If expected Hindi but fewer than 5 Devanagari characters, add caution
        if dev_chars < 5 and len(text) > 20:
            return "Translation quality note: The response may contain mixed script or partial transliteration."
    elif target_lang == "gu":
        guj_chars = len(re.findall(r"[\u0A80-\u0AFF]", text))
        if guj_chars < 5 and len(text) > 20:
            return "Translation quality note: The response may contain mixed script or partial transliteration."

    return None
