"""
/api/transcribe — accepts a multipart audio upload and returns
a list of timestamped Hindi caption segments.
"""
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from models.schemas import TranscriptionResponse
from services.whisper_service import transcribe as whisper_transcribe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["transcription"])

ALLOWED_CONTENT_TYPES = {
    # Audio
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mp4",
    "audio/x-m4a",
    "audio/m4a",
    "audio/ogg",
    "audio/flac",
    "audio/webm",
    # Video
    "video/mp4",
    "video/quicktime",  # .mov
    "video/x-matroska",  # .mkv
    "video/webm",
    "video/x-msvideo",  # .avi
    "video/mpeg",
    "application/octet-stream",  # generic fallback
}

MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(file: UploadFile = File(...), language: str = Form("")):
    """
    Upload an audio file and receive timestamped caption segments.

    Accepts: .mp3, .wav, .m4a
    Returns: JSON with list of segments { id, start, end, text }
    """
    # Basic content-type validation (browsers may lie, so we also check extension)
    filename = file.filename or "upload.mp4"
    extension = filename.rsplit(".", 1)[-1].lower()
    ALLOWED_EXTENSIONS = {
        # Audio
        "mp3", "wav", "m4a", "ogg", "flac", "aac", "opus", "weba",
        # Video
        "mp4", "mov", "mkv", "webm", "avi", "mpeg", "mpg",
    }
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{extension}'. Use an audio (mp3, wav, m4a, flac…) or video (mp4, mov, mkv, webm…) file.",
        )

    audio_bytes = await file.read()

    if len(audio_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum allowed size is 500 MB.",
        )

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        segments, detected_language = whisper_transcribe(audio_bytes, filename, language)
    except Exception as exc:
        logger.exception("Transcription failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(exc)}")

    return TranscriptionResponse(segments=segments, language=detected_language)
