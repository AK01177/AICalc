from pydantic import BaseModel
from typing import Optional

class ImageData(BaseModel):
    image: str
    dict_of_vars: dict
    subject: Optional[str] = "math"  # Default to math, can be "math", "physics", "chemistry", "science"
