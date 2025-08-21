from fastapi import APIRouter
import base64
import binascii
from io import BytesIO
from apps.calculator.utils import analyze_image
from schema import ImageData, PlotRequest, PlotResponse, SymbolicRequest, SymbolicResponse, UnitConvertRequest, UnitConvertResponse
from PIL import Image

router = APIRouter()

# Support both trailing and non-trailing slash
@router.post("")
@router.post("/")
async def run(data: ImageData):
    try:
        # Validate input data
        if not data.image:
            return {"message": "No image data provided", "data": [], "status": "error"}
        
        # Handle base64 image data
        if "," in data.image:
            image_data = base64.b64decode(data.image.split(",")[1])  # Assumes data:image/png;base64,<data>
        else:
            image_data = base64.b64decode(data.image)  # Handle plain base64
            
        image_bytes = BytesIO(image_data)
        image = Image.open(image_bytes)
        
        # Get subject from data, default to "math" if not provided
        subject = data.subject if data.subject else "math"
        dict_of_vars = data.dict_of_vars if data.dict_of_vars else {}
        
        print(f"Processing image for subject: {subject}")
        print(f"Variables provided: {dict_of_vars}")
        
        responses = analyze_image(image, dict_of_vars=dict_of_vars, subject=subject)
        
        if not responses:
            return {"message": "No results found", "data": [], "status": "warning"}
        
        result_data = []
        for response in responses:
            if isinstance(response, dict):
                result_data.append(response)
            else:
                print(f"Warning: Skipping non-dict response: {response}")
        
        print(f'Successfully processed {len(result_data)} responses')
        return {"message": "Image processed successfully", "data": result_data, "status": "success"}
        
    except binascii.Error as e:
        print(f"Base64 decode error: {e}")
        return {"message": "Invalid base64 image data", "data": [], "status": "error"}
    except Exception as e:
        print(f"Error in route: {e}")
        return {"message": f"Error processing image: {str(e)}", "data": [], "status": "error"}


# New math endpoints
@router.post("/plot", response_model=PlotResponse)
async def plot_expression(req: PlotRequest):
    try:
        import numpy as np
        from sympy import symbols, lambdify, latex
        from sympy.parsing.sympy_parser import (
            parse_expr,
            standard_transformations,
            implicit_multiplication_application,
            convert_xor,
        )
        x = symbols('x')
        expr = parse_expr(
            req.expr,
            transformations=(
                standard_transformations
                + (
                    implicit_multiplication_application,
                    convert_xor,
                )
            ),
        )
        x_vals = np.linspace(req.x_min, req.x_max, max(2, req.num_points))
        f = lambdify(x, expr, modules=['numpy'])
        y_vals = f(x_vals)
        # Ensure lists for JSON serialization
        x_list = [float(v) for v in x_vals.tolist()]
        y_list = [float(v) for v in np.asarray(y_vals).tolist()]
        return PlotResponse(x=x_list, y=y_list, latex=latex(expr))
    except Exception as e:
        raise e


@router.post("/symbolic", response_model=SymbolicResponse)
async def symbolic_operation(req: SymbolicRequest):
    try:
        from sympy import symbols, simplify, diff, integrate, solveset, S, latex
        from sympy.parsing.sympy_parser import (
            parse_expr,
            standard_transformations,
            implicit_multiplication_application,
            convert_xor,
        )
        sym_expr = parse_expr(
            req.expr,
            transformations=(
                standard_transformations
                + (
                    implicit_multiplication_application,
                    convert_xor,
                )
            ),
        )
        var = symbols(req.variable) if req.variable else None
        if req.value_subs:
            subs_map = {symbols(k): v for k, v in req.value_subs.items()}
            sym_expr = sym_expr.subs(subs_map)

        if req.operation == "simplify":
            result = simplify(sym_expr)
        elif req.operation == "differentiate":
            if var is None:
                raise ValueError("variable is required for differentiation")
            result = diff(sym_expr, var)
        elif req.operation == "integrate":
            if var is None:
                raise ValueError("variable is required for integration")
            result = integrate(sym_expr, var)
        elif req.operation == "solve":
            if var is None:
                raise ValueError("variable is required for solve")
            result = solveset(sym_expr, var, domain=S.Complexes)
        elif req.operation == "evaluate":
            result = sym_expr.evalf()
        else:
            raise ValueError("Unsupported operation")

        return SymbolicResponse(result=str(result), latex=latex(result))
    except Exception as e:
        raise e


@router.post("/units/convert", response_model=UnitConvertResponse)
async def convert_units(req: UnitConvertRequest):
    try:
        from pint import UnitRegistry
        ureg = UnitRegistry()
        qty = req.value * ureg(req.from_unit)
        converted = qty.to(req.to_unit)
        return UnitConvertResponse(value=float(converted.magnitude), unit=str(converted.units))
    except Exception as e:
        raise e
