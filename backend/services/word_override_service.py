"""
Word override service.

Applies a user-defined replacement dictionary to caption text.
Replacements are applied longest-key-first to avoid partial word collisions.
"""
from typing import Dict, List

from models.schemas import TranscriptionSegment


def apply_overrides(
    segments: List[TranscriptionSegment],
    word_overrides: Dict[str, str],
) -> List[TranscriptionSegment]:
    """
    Return a new list of segments with all word overrides applied.
    Original segment objects are not mutated.
    """
    if not word_overrides:
        return segments

    # Sort by key length descending so longer phrases match before substrings
    sorted_overrides = sorted(word_overrides.items(), key=lambda kv: len(kv[0]), reverse=True)

    result: List[TranscriptionSegment] = []
    for seg in segments:
        text = seg.text
        for original, replacement in sorted_overrides:
            text = text.replace(original, replacement)
        result.append(seg.model_copy(update={"text": text}))

    return result
