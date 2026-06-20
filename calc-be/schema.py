from pydantic import BaseModel, Field
from typing import Literal

class ImageData(BaseModel):
    image: str = Field(..., max_length=15_000_000)
    dict_of_vars: dict = Field(default_factory=dict)
    subject: Literal["math", "physics", "chemistry"] = "math"
    include_steps: bool = True

