"""Pydantic models shared by calculator HTTP handlers (validate JSON in/out)."""
from pydantic import BaseModel
from typing import Optional

class ImageData(BaseModel):
    # Base64 data URL or raw base64; subject steers prompt style on the backend.
    image: str
    dict_of_vars: dict
    subject: Optional[str] = "math"  # Default to math
    # False = ask the model for final answers only (no step-by-step).
    include_steps: bool = True
