# AICalc

AICalc is a simple drawing-based calculator. You choose a subject, draw a problem on the canvas, and the app sends the image to a FastAPI backend for an AI-generated answer.

The project is intentionally small and focused. It supports three subjects:

- Math
- Physics
- Chemistry

## What It Does

- Lets the user draw on a canvas
- Supports pen color, brush size, clear, and eraser controls
- Sends the drawing as an image to the backend
- Uses Gemini to read the image and return a structured answer
- Renders math output in the frontend with KaTeX
- Shows the AI model name and keeps a simple local token counter

## Subjects

### Math

Useful for simple handwritten expressions, equations, and arithmetic-style problems.

Examples:

- `2x + 5 = 15`
- `12 / 3 + 4`
- `x^2 + 5x + 6 = 0`

### Physics

Useful for short formula-based questions where the values are clearly written.

Examples:

- `F = ma`
- `v = d / t`
- `E = mgh`

### Chemistry

Useful for basic chemistry formula questions and simple written equations.

Examples:

- `n = m / M`
- `c = n / V`
- simple balancing or calculation prompts

## How It Works

1. Select a subject: Math, Physics, or Chemistry.
2. Draw the problem on the canvas.
3. Click Calculate.
4. The frontend sends the canvas image to the backend.
5. The backend asks Gemini to interpret the image and returns the result.

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: FastAPI, Python
- Drawing: HTML canvas with `perfect-freehand`
- AI: Google Gemini 2.5 Flash by default
- Math rendering: KaTeX

## Setup

### Backend

```bash
cd calc-be
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Create `calc-be/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Frontend

```bash
cd calc-fe
npm install
npm run dev
```

Optional frontend env file, `calc-fe/.env.local`:

```env
VITE_API_BASE=http://localhost:8900
VITE_MODEL_NAME=GEMINI 2.5 FLASH
```

If `VITE_API_BASE` is not set, the frontend uses `/api/calculate`, which works with the Vite proxy or deployment rewrite.

The frontend also displays a local token counter using the `usage.total_tokens` value returned by the backend. This is only for visibility during demos and is stored in the browser's local storage.

## API

### `POST /calculate`

Request body:

```json
{
  "image": "base64_image_string",
  "dict_of_vars": {},
  "subject": "math",
  "include_steps": false
}
```

Supported subjects:

```text
math | physics | chemistry
```

Response shape:

```json
{
  "message": "Image processed successfully",
  "data": [],
  "usage": {},
  "status": "success"
}
```

## Limitations

- Works best with clear handwriting and simple problems.
- The AI can make mistakes if the drawing is unclear.
- It is not meant to replace a full calculator or symbolic math engine.
- Chemistry and physics support is focused on simple formula-based problems.

## Why I Built This

I built this project to learn how to connect a React drawing interface with a Python API, send image data from frontend to backend, and display AI-generated math results in a clean UI.
