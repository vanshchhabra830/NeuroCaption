from pydantic import BaseModel
from typing import Dict, List


class TranscriptionSegment(BaseModel):
    id: int
    start: float
    end: float
    text: str


class TranscriptionResponse(BaseModel):
    segments: List[TranscriptionSegment]
    language: str = "hi"


class ExportRequest(BaseModel):
    segments: List[TranscriptionSegment]
    word_overrides: Dict[str, str] = {}


class ExportResponse(BaseModel):
    srt_content: str
