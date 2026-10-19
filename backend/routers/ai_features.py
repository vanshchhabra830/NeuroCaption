import logging
import os
import json
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai

from models.schemas import TranscriptionSegment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["ai"])

class ConvertRequest(BaseModel):
    segments: List[TranscriptionSegment]

class ConvertResponse(BaseModel):
    segments: List[TranscriptionSegment]

@router.post("/convert-hinglish", response_model=ConvertResponse)
async def convert_hinglish(req: ConvertRequest):
    """
    Convert a list of Hindi transcription segments to Hinglish using Gemini 2.5 Flash.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured in the backend environment."
        )

    try:
        genai.configure(api_key=api_key)
        
        # Prepare the prompt
        prompt = (
            "Convert this Hindi SRT-like data to Hinglish (Hindi written in the English alphabet) "
            "with exact timeframes. Keep the 'id', 'start', and 'end' exactly the same. "
            "Only translate the 'text' field to Hinglish. "
            "Return the output as a clean JSON array matching the input structure."
        )
        
        input_data = [seg.model_dump() for seg in req.segments]
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            f"{prompt}\n\n{json.dumps(input_data, ensure_ascii=False)}",
            generation_config={"response_mime_type": "application/json"}
        )
        
        if not response.text:
            raise ValueError("Empty response from Gemini API.")
            
        # Parse the JSON response
        result_json = json.loads(response.text)
        translated_segments = [TranscriptionSegment(**seg) for seg in result_json]
        
        return ConvertResponse(segments=translated_segments)
        
    except Exception as exc:
        logger.exception("AI conversion failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(exc)}")
