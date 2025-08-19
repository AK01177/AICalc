from fastapi import APIRouter
import base64
import binascii
from io import BytesIO
from apps.calculator.utils import analyze_image
from schema import ImageData
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
