"""
Whisper service — loads the model once at startup and exposes a
transcribe() function used by the router.

Uses faster-whisper (CTranslate2 backend) with fp16 (float16) for
significantly faster inference on CUDA compared to openai-whisper.

IMPORTANT: load_model() must be called explicitly (from the FastAPI
lifespan handler), NOT at module import time. Importing this module
alone is safe and costs zero GPU memory.
"""
import logging
import os
import tempfile
from pathlib import Path
from typing import List, Tuple

from models.schemas import TranscriptionSegment

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MODEL_NAME    = "large-v2"
_DEVICE       = "cuda"
_COMPUTE_TYPE = "int8_float16"     # fp16 — requires CTranslate2 CUDA 12 build

_CACHE_DIR = Path(__file__).resolve().parent.parent / "models_cache"

# Module-level handle — populated by load_model(), never at import time.
_model = None


# ---------------------------------------------------------------------------
# Internal helper: register CUDA 12 bin dir so Windows finds cublas64_12.dll
# ---------------------------------------------------------------------------
def _register_cuda_dlls() -> None:
    cuda_bins = [
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.0\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.1\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.2\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.3\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin",
    ]
    for path in cuda_bins:
        if Path(path).is_dir():
            os.add_dll_directory(path)  # type: ignore[attr-defined]
            logger.info("Registered CUDA DLL directory: %s", path)
            return
    logger.warning("No CUDA 12 bin directory found — cublas64_12.dll may be missing.")


# ---------------------------------------------------------------------------
# Public: called ONCE from the FastAPI lifespan (worker process only)
# ---------------------------------------------------------------------------
def load_model() -> None:
    """Load the Whisper model into GPU memory. Call this from app lifespan."""
    global _model
    if _model is not None:
        logger.warning("load_model() called more than once — skipping.")
        return

    _register_cuda_dlls()

    # Import here so the heavy CUDA initialisation only happens in the worker.
    from faster_whisper import WhisperModel  # noqa: PLC0415

    _CACHE_DIR.mkdir(exist_ok=True)

    logger.info(
        "Loading faster-whisper '%s' on %s with compute_type=%s…",
        MODEL_NAME, _DEVICE, _COMPUTE_TYPE,
    )
    _model = WhisperModel(
        MODEL_NAME,
        device=_DEVICE,
        compute_type=_COMPUTE_TYPE,
        download_root=str(_CACHE_DIR),
    )
    logger.info(
        "faster-whisper model loaded — device=%s, compute_type=%s.",
        _DEVICE, _COMPUTE_TYPE,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def transcribe(audio_bytes: bytes, filename: str, language: str = "") -> Tuple[List[TranscriptionSegment], str]:
    """
    Transcribe raw audio bytes with faster-whisper.

    Parameters
    ----------
    audio_bytes : bytes
        Raw audio data as uploaded by the client.
    filename : str
        Original filename — used only to infer the correct file extension
        so that ffmpeg can decode the stream correctly.
    language : str
        The language code (e.g., 'hi', 'en'). If empty, Whisper auto-detects.

    Returns
    -------
    Tuple[List[TranscriptionSegment], str]
        A tuple of (Timestamped caption segments, detected language code).
    """
    if _model is None:
        raise RuntimeError("Whisper model is not loaded. Was load_model() called?")

    suffix = os.path.splitext(filename)[-1] or ".mp3"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        logger.info("Starting transcription for '%s'…", filename)
        segments_iter, info = _model.transcribe(
            tmp_path,
            language=language if language else None,
            task="transcribe",
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )
        logger.info(
            "Detected language '%s' (probability %.2f).",
            info.language, info.language_probability,
        )

        segments: List[TranscriptionSegment] = []
        for idx, seg in enumerate(segments_iter, start=1):
            segments.append(
                TranscriptionSegment(
                    id=idx,
                    start=round(seg.start, 3),
                    end=round(seg.end, 3),
                    text=seg.text.strip(),
                )
            )
    finally:
        os.unlink(tmp_path)

    logger.info("Transcription complete — %d segments produced.", len(segments))
    return segments, info.language
