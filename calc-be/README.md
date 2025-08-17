# AI Calculator Backend

This is a FastAPI-based backend service that processes mathematical expressions from images using Google's Gemini AI.

## Features

- **Image Processing**: Analyzes mathematical expressions from uploaded images
- **Multi-Subject Support**: Handles math, physics, chemistry, and general science problems
- **Step-by-Step Solutions**: Provides detailed solution steps for complex problems
- **Variable Support**: Allows users to provide variable values for expressions
- **Error Handling**: Robust error handling and response validation

## Setup Instructions

### 1. Install Dependencies

```bash
pip install fastapi uvicorn google-generativeai pillow python-dotenv pydantic
```

### 2. Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.template .env
   ```

2. Add your Gemini API key to the `.env` file:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

   To get a Gemini API key:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account
   - Create a new API key

### 3. Run the Application

```bash
# Development mode (with auto-reload)
python main.py

# Or using uvicorn directly
uvicorn main:app --host localhost --port 8900 --reload
```

The server will start at `http://localhost:8900`

### 4. Test the API

You can test the API using the automatic documentation at:
- **Swagger UI**: `http://localhost:8900/docs`
- **ReDoc**: `http://localhost:8900/redoc`

## API Endpoints

### POST `/calculate`

Processes an image containing mathematical expressions.

**Request Body:**
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...",
  "dict_of_vars": {
    "x": 5,
    "y": 10
  },
  "subject": "math"
}
```

**Parameters:**
- `image`: Base64-encoded image string (required)
- `dict_of_vars`: Dictionary of variable values (optional)
- `subject`: Subject area - "math", "physics", "chemistry", or "science" (optional, defaults to "math")

**Response:**
```json
{
  "message": "Image processed successfully",
  "data": [
    {
      "expr": "2x + 3y",
      "result": "40",
      "assign": false
    }
  ],
  "status": "success"
}
```

## Supported Problem Types

### Mathematics
1. Simple expressions (2 + 2, 3 * 4, etc.)
2. Equations with variables (x² + 2x + 1 = 0)
3. Variable assignments (x = 4, y = 5)
4. Graphical math problems
5. Abstract concept detection

### Physics
1. Simple calculations (F = ma, E = mc², etc.)
2. Multi-variable physics equations
3. Physics variable assignments
4. Physics diagrams analysis
5. Physics word problems

### Chemistry
1. Chemical calculations (n = m/M, pH calculations, etc.)
2. Chemical equations with multiple variables
3. Chemistry variable assignments
4. Chemical diagrams analysis
5. Chemistry word problems

### General Science
1. Basic science calculations
2. Science equations with variables
3. Science variable assignments
4. Science diagrams analysis
5. Science word problems

## Error Handling

The API includes comprehensive error handling for:
- Invalid base64 image data
- Missing required parameters
- Gemini API errors
- Image processing failures
- JSON parsing errors

## Development

### Project Structure
```
calc-be/
├── apps/
│   ├── __init__.py
│   └── calculator/
│       ├── __init__.py
│       ├── route.py        # API endpoints
│       └── utils.py        # Image processing logic
├── main.py                 # FastAPI application
├── constants.py           # Configuration constants
├── schema.py              # Pydantic models
├── requirements.txt       # Dependencies
└── README.md             # This file
```

### Key Files
- `main.py`: FastAPI application entry point
- `apps/calculator/route.py`: API route handlers
- `apps/calculator/utils.py`: Gemini AI integration and image processing
- `schema.py`: Request/response models
- `constants.py`: Environment configuration

## Issues Fixed

This version fixes several issues from the original codebase:
1. ✅ Added missing `__init__.py` files for proper Python package structure
2. ✅ Removed duplicate and conflicting code in `utils.py`
3. ✅ Updated to use current Gemini model (`gemini-2.5-flash`)
4. ✅ Improved error handling in route handlers
5. ✅ Cleaned up imports and dependencies
6. ✅ Added comprehensive documentation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
