# AICalc

Draw a math/physics/chemistry problem on the canvas and get the answer from Gemini.

Built with React + Vite on the frontend, FastAPI on the backend. Uses `perfect-freehand` for smooth drawing and KaTeX to render the math output.

## How to run

### Backend

```bash
cd calc-be
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

You need a `.env` file in `calc-be/` with your Gemini key:

```
GEMINI_API_KEY=your_key_here
```

### Frontend

```bash
cd calc-fe
npm install
npm run dev
```

You can optionally create `calc-fe/.env` to point to the backend:

```
VITE_API_BASE=http://localhost:8900
```

If not set, the frontend uses the Vite proxy (`/api/calculate`).

## Features

- Draw on canvas, pick colors, adjust brush size
- Eraser tool
- Subject picker (math, physics, chemistry)
- Step-by-step solutions toggle
- LaTeX rendering with KaTeX
- Token counter (stored in localStorage)
- Mobile responsive

## API

`POST /calculate` with JSON body:

```json
{
  "image": "data:image/png;base64,...",
  "subject": "math",
  "dict_of_vars": {},
  "include_steps": true
}
```

Returns results as a JSON array with `expr`, `result`, and optional `steps`.

## Limitations

- Works best with clear handwriting
- Simple problems only — not a replacement for Wolfram Alpha
- Chemistry/physics support is basic (formula-level)
