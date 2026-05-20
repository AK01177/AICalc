from __future__ import annotations

import asyncio
import base64
import binascii
import logging
from io import BytesIO

from fastapi import APIRouter, HTTPException
from PIL import Image, UnidentifiedImageError

from apps.calculator.utils import analyze_image
from schema import ImageData

logger = logging.getLogger("aicalc.route")
router = APIRouter()


def _decode_image(data_url: str) -> Image.Image:
    if not data_url:
        raise HTTPException(status_code=400, detail="No image data provided")

    payload = data_url.split(",", 1)[1] if "," in data_url else data_url
    try:
        raw = base64.b64decode(payload)
    except (binascii.Error, ValueError) as e:
        logger.warning("Base64 decode failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid base64 image data") from e

    try:
        return Image.open(BytesIO(raw))
    except UnidentifiedImageError as e:
        logger.warning("Unidentified image data: %s", e)
        raise HTTPException(status_code=400, detail="Unsupported image format") from e


@router.post("")
@router.post("/")
async def calculate(data: ImageData):
    image = _decode_image(data.image)
    subject = (data.subject or "math").lower()
    dict_of_vars = data.dict_of_vars or {}

    logger.info(
        "Analyzing image | subject=%s | vars=%d | steps=%s",
        subject,
        len(dict_of_vars),
        data.include_steps,
    )

    try:
        data_out = await asyncio.to_thread(
            analyze_image,
            image,
            dict_of_vars=dict_of_vars,
            subject=subject,
            include_steps=data.include_steps,
        )
        responses = data_out.get("results", [])
        usage = data_out.get("usage", {})
    except Exception as e:
        logger.exception("AI analysis failed")
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}") from e

    if not responses:
        return {"message": "No results found", "data": [], "usage": usage, "status": "warning"}

    result_data = [r for r in responses if isinstance(r, dict)]
    logger.info("Returning %d results | tokens=%d", len(result_data), usage.get("total_tokens", 0))
    return {
        "message": "Image processed successfully",
        "data": result_data,
        "usage": usage,
        "status": "success",
    }

