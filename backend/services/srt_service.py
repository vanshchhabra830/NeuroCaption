"""
SRT generation service.

Converts a list of TranscriptionSegments into a properly formatted
SRT subtitle string.
"""
from typing import List

from models.schemas import TranscriptionSegment


def _format_timestamp(seconds: float) -> str:
    """Convert float seconds to SRT timestamp format HH:MM:SS,mmm."""
    ms = round(seconds * 1000)
    hours, ms = divmod(ms, 3_600_000)
    minutes, ms = divmod(ms, 60_000)
    secs, ms = divmod(ms, 1_000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def generate_srt(segments: List[TranscriptionSegment]) -> str:
    """Generate a complete SRT file string from a list of segments."""
    lines: List[str] = []
    for seg in segments:
        lines.append(str(seg.id))
        lines.append(f"{_format_timestamp(seg.start)} --> {_format_timestamp(seg.end)}")
        lines.append(seg.text)
        lines.append("")  # blank line between entries
    return "\n".join(lines)
