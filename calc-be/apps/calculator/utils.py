from __future__ import annotations

import asyncio
import json
import logging
import re
from io import BytesIO
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types
from PIL import Image

from constants import GEMINI_API_KEYS, GEMINI_MODEL

logger = logging.getLogger("aicalc.utils")

_key_index = 0
_genai_client: Optional[genai.Client] = None
_key_lock = asyncio.Lock()

_DEFAULT_MODEL_NAME = "gemini-2.5-flash"
_resolved_model_name: str = GEMINI_MODEL or _DEFAULT_MODEL_NAME


async def _gemini_pal() -> Optional[genai.Client]:
    global _genai_client, _key_index
    if not GEMINI_API_KEYS:
        logger.error("No GEMINI_API_KEYS found in environment!")
        return None
    async with _key_lock:
        if _genai_client is None:
            key = GEMINI_API_KEYS[_key_index]
            _genai_client = genai.Client(api_key=key)
            masked_key = key[:4] + "..." + key[-4:] if len(key) > 8 else "****"
            logger.info(">>> Using Gemini API Key #%d [%s]", _key_index + 1, masked_key)
        return _genai_client


async def _key_shuffle():
    global _genai_client, _key_index
    async with _key_lock:
        if len(GEMINI_API_KEYS) > 1:
            old_idx = _key_index
            _key_index = (_key_index + 1) % len(GEMINI_API_KEYS)
            _genai_client = None
            logger.warning("!!! QUOTA EXHAUSTED on Key #%d. Rotating to Key #%d...", old_idx + 1, _key_index + 1)
            return True
        logger.error("!!! QUOTA EXHAUSTED and no more keys available to rotate.")
        return False


def _realm_prompt(subject: str) -> str:
    label = subject.lower() if subject else "math"
    return (
        f"You are an exact {label} solver. Be extremely precise. "
        "Provide final numerical results, simplified expressions, or exact constants (pi, e). "
        "Use valid LaTeX for all mathematical expressions and results. "
        "For equations, return one dict per variable with 'assign': True."
    )


def _spell_prompt(
    subject: str, dict_of_vars: Dict[str, Any], *, include_steps: bool = True
) -> str:
    vars_json = json.dumps(dict_of_vars or {}, ensure_ascii=False)
    if include_steps:
        steps_rule = "Provide a concise 'steps' array where each item has an 'explanation' field using LaTeX for math."
    else:
        steps_rule = "Do NOT include a 'steps' array in your response. Return only 'expr', 'result', and 'assign'."
    return (
        f"Variables: {vars_json}. {steps_rule} "
        "FORMAT: JSON array: [{'expr': 'LaTeX string', 'result': 'LaTeX string', 'assign': bool, 'steps': []}]. "
        "No prose or markdown. Always use LaTeX for math symbols. Do not include LaTeX delimiters like $ or $$. " + _realm_prompt(subject)
    )


_FENCE_RE = re.compile(r"^```[a-zA-Z]*\n?|\n?```$", re.MULTILINE)
_ARRAY_RE = re.compile(r"\[\s*\{.*?\}\s*\]", re.DOTALL)


def _png_blob(img: Image.Image) -> bytes:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _pluck_text(response: Any) -> str:
    try:
        if getattr(response, "text", None):
            return response.text
        for candidate in getattr(response, "candidates", []) or []:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) if content else None
            if parts:
                return "".join(getattr(p, "text", "") or "" for p in parts)
    except Exception:
        logger.exception("Failed to extract text from Gemini response")
    return ""


def _parse_loot(text: str) -> Optional[List[Any]]:
    if not text:
        return None
    cleaned = _FENCE_RE.sub("", text).strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return [parsed]
    except (json.JSONDecodeError, ValueError):
        pass
    matches = _ARRAY_RE.findall(text)
    if matches:
        try:
            return json.loads(matches[0])
        except (json.JSONDecodeError, ValueError):
            pass
    return None


async def read_skribbl(
    img: Image.Image,
    dict_of_vars: Optional[Dict[str, Any]] = None,
    subject: str = "math",
    *,
    include_steps: bool = True,
) -> Dict[str, Any]:
    client = await _gemini_pal()
    if not client:
        return {"results": [{"expr": "Error", "result": "No API key", "assign": False}], "usage": {}}

    png_bytes = _png_blob(img)
    usage_dict: Dict[str, Any] = {}
    last_raw_text = ""

    for key_attempt in range(len(GEMINI_API_KEYS)):
        key_rotated = False

        for parse_attempt in range(2):
            prompt = _spell_prompt(subject, dict_of_vars or {}, include_steps=include_steps)
            if parse_attempt > 0:
                prompt += "\n\nCRITICAL: Return ONLY a valid JSON array. No explanations, no markdown, no text before or after. Start with [ and end with ]."
                logger.warning(">>> Parse failure detected, retrying with stricter prompt (attempt %d)", parse_attempt)

            try:
                response = await client.aio.models.generate_content(
                    model=_resolved_model_name,
                    contents=[prompt, types.Part.from_bytes(data=png_bytes, mime_type="image/png")],
                )
            except Exception as e:
                err_msg = str(e)
                if ("429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg) and key_attempt < len(GEMINI_API_KEYS) - 1:
                    if await _key_shuffle():
                        client = await _gemini_pal()
                        key_rotated = True
                        break
                logger.exception("Gemini API call failed")
                raise RuntimeError(f"Gemini API call failed: {err_msg}") from e

            text = _pluck_text(response)
            usage = getattr(response, "usage_metadata", None)
            usage_dict = {
                "prompt_tokens": getattr(usage, "prompt_token_count", 0),
                "completion_tokens": getattr(usage, "candidates_token_count", 0),
                "total_tokens": getattr(usage, "total_token_count", 0),
            }

            if not text:
                return {"results": [], "usage": usage_dict}

            parsed = _parse_loot(text)
            if parsed is not None:
                normalized = []
                for item in parsed:
                    if isinstance(item, dict) and "expr" in item and "result" in item:
                        item.setdefault("assign", False)
                        if include_steps:
                            item.setdefault("steps", [])
                        normalized.append(item)
                return {"results": normalized, "usage": usage_dict}

            last_raw_text = text
        else:
            logger.error(">>> Parse failed even with strict prompt. Raw response: %s", last_raw_text[:200])
            raise RuntimeError("Parse error: AI output invalid")

        if key_rotated:
            continue

    raise RuntimeError("All API keys exhausted")
