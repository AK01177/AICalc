from pydantic import BaseModel
from typing import Optional, Literal, Dict, List

class ImageData(BaseModel):
    image: str
    dict_of_vars: dict
    subject: Optional[str] = "math"  # Default to math, can be "math", "physics", "chemistry", "science"


class PlotRequest(BaseModel):
	expr: str
	x_min: float = -10.0
	x_max: float = 10.0
	num_points: int = 500


class PlotResponse(BaseModel):
	x: List[float]
	y: List[float]
	latex: Optional[str] = None


class SymbolicRequest(BaseModel):
	expr: str
	operation: Literal["simplify", "differentiate", "integrate", "solve", "evaluate"]
	variable: Optional[str] = None
	value_subs: Optional[Dict[str, float]] = None


class SymbolicResponse(BaseModel):
	result: str
	latex: Optional[str] = None


class UnitConvertRequest(BaseModel):
	value: float
	from_unit: str
	to_unit: str


class UnitConvertResponse(BaseModel):
	value: float
	unit: str
