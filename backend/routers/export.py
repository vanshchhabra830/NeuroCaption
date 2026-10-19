"""
/api/export — accepts edited segments + word overrides and returns
a downloadable .srt file.
"""
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from models.schemas import ExportRequest
from services.srt_service import generate_srt
from services.word_override_service import apply_overrides

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["export"])


@router.post("/export")
async def export_srt(payload: ExportRequest):
    """
    Apply word overrides to segments and return an SRT file for download.

    Body: { segments: [...], word_overrides: { "है": "हैं", ... } }
    Returns: SRT file as attachment.
    """
    if not payload.segments:
        raise HTTPException(status_code=400, detail="No segments provided for export.")

    try:
        processed_segments = apply_overrides(payload.segments, payload.word_overrides)
        srt_content = generate_srt(processed_segments)
    except Exception as exc:
        logger.exception("SRT export failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(exc)}")

    return Response(
        content=srt_content.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="captions.srt"'},
    )
