# AICalc - AI-Powered Calculator

Draw math, physics, or chemistry problems and get instant AI solutions.

**Live:** [https://ai-calc-dusky.vercel.app](https://ai-calc-dusky.vercel.app) | **Backend:** https://aicalc-nvif.onrender.com

---

## Overview

| Aspect | Details |
|--------|---------|
| **Purpose** | Draw problem → Get AI solution + steps |
| **Model** | Google Gemini 2.5 Flash |
| **Subjects** | Math, Physics, Chemistry |
| **Frontend** | React 18 + TypeScript + Vite (v5.4.0) + perfect-freehand + react-katex |
| **Backend** | FastAPI + Uvicorn + Gunicorn (Python 3.9+) |
| **Input** | Base64 image (PNG) |
| **Output** | JSON: expr, result, steps[], assign flag, token usage |
| **Deployment** | Frontend: Vercel | Backend: Render |

---

## Project Structure

```
calc-fe/                  # Frontend v3.0.0
├── src/
│   ├── App.tsx         # Canvas, drawing, text mode, text boxes, drag/resize/delete, solve
│   ├── index.css       # Windows 95 UI, text box styles, responsive mobile
│   ├── main.tsx        # React entry point
│   └── vite-env.d.ts   # Vite type definitions
├── package.json        # React 18.3.1, KaTeX 0.16.45, perfect-freehand 1.2.3
├── vite.config.ts      # Proxy: /api → localhost:8900, React plugin
├── tsconfig.json       # TypeScript config
└── vercel.json         # Vercel deployment

calc-be/                  # Backend v2.0.0
├── main.py             # FastAPI app, CORS, /healthz, /calculate routes
├── apps/calculator/
│   ├── route.py        # POST /calculate endpoint, base64 decode, request validation
│   └── utils.py        # Gemini API calls, prompt building, response parsing, key rotation
├── schema.py           # ImageData model (image, subject, dict_of_vars, include_steps)
├── constants.py        # Env config: GEMINI_API_KEYS, PORT, ENV, SERVER_URL, GEMINI_MODEL
├── requirements.txt    # FastAPI, Pillow, google-genai, pydantic, uvicorn, gunicorn
├── gunicorn_config.py  # 4 workers, preload app, optimized logging
├── render.yaml         # Render deployment config
└── Procfile            # Heroku-compatible (if needed)
```

---

## Features

- **Canvas Drawing**: Freehand with perfect-freehand (smooth strokes)
- **Text Mode**: Add, drag, resize, and edit text boxes on canvas; baked into image before solving
- **Colors**: 6 swatches (#000080, #000000, #ff0000, #008000, #800080, #808080)
- **Eraser**: Clear individual strokes
- **Step-by-Step**: Toggle for detailed explanation or final answer only
- **Token Tracking**: Cumulative usage stored in localStorage
- **Mobile Responsive**: Adaptive UI for ≤768px
- **Windows 95 UI**: Retro-style interface with proper visual feedback
- **Backend Warmup**: Auto-ping health endpoint on load + 14-min keep-alive
- **Retry Logic**: 2x retry on timeout/error before failing
- **Multi-Key Support**: Key rotation on quota exhaustion
- **CORS**: Configured for local dev and production URLs

---

## Setup

**Prerequisites:** Node.js 18+, Python 3.9+, Google API Key

### Backend
```bash
cd calc-be
python -m venv venv && source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
echo GEMINI_API_KEY=your_key > .env && echo SERVER_URL=localhost >> .env && echo PORT=8900 >> .env && echo ENV=dev >> .env
python main.py  # http://localhost:8900
```

### Frontend
```bash
cd calc-fe
npm install
npm run dev  # http://localhost:5173
```

Set `VITE_API_BASE=http://localhost:8900` in `.env` if dev proxy fails.

---

## API Endpoints

**Health Check:**
```
GET /healthz → { "status": "ok", "version": "2.0.0" }
```

**Calculate:**
```
POST /calculate
{
  "image": "data:image/png;base64,...",
  "subject": "math" | "physics" | "chemistry",
  "dict_of_vars": {},
  "include_steps": true
}

→ {
  "message": "Image processed successfully",
  "status": "success",
  "data": [
    {
      "expr": "LaTeX expr",
      "result": "LaTeX result",
      "steps": [{"explanation": "..."}],
      "assign": false
    }
  ],
  "usage": { "prompt_tokens": N, "completion_tokens": N, "total_tokens": N }
}
```

---

## Deployment

| Platform | URL | Config | Auto Deploy |
|----------|-----|--------|------------|
| **Frontend** | https://ai-calc-dusky.vercel.app | calc-fe/vercel.json | Push to main |
| **Backend** | https://aicalc-nvif.onrender.com | calc-be/render.yaml | Push to main |

**Env Vars (Backend - Render):**
- `GEMINI_API_KEY`: Your Google API key (supports comma-separated for rotation)
- `GEMINI_MODEL`: Override model (default: gemini-2.5-flash)
- `ENV`: prod or dev
- `PORT`: Auto-assigned by Render
- `SERVER_URL`: 0.0.0.0

---

## Technical Details

**Frontend (App.tsx):**
- Canvas state: points, drawing, eraser mode, text mode, text boxes
- Subjects: ["math", "physics", "chemistry"]
- Colors: 6 swatches (#000080, #000000, #ff0000, #008000, #800080, #808080)
- Brush size: 1-15
- **Text Mode Features:**
  - Create text boxes via click (isTextMode enabled)
  - Drag via header (grab cursor, active=grabbing)
  - Resize via corner handle (se-resize cursor)
  - Delete via close button (✕)
  - Contenteditable input with placeholder "Type here..."
  - Text boxes baked into canvas before solving (Share Tech Mono font, 14px)
- Results display with KaTeX math rendering
- Token tracking in localStorage
- Retry logic: 2x attempts with exponential backoff
- Model display: `VITE_MODEL_NAME` env var or "GEMINI 2.5 FLASH"
- **UI:** Windows 95-style buttons, text boxes with blue gradient headers, responsive (240px desktop | mobile bottom drawer)

**Backend (utils.py):**
- Image → PNG bytes → Gemini API call
- Prompt engineering: subject-specific directives, LaTeX requirement, JSON format
- Response parsing: json.loads, ast.literal_eval, regex fallback
- Error handling: 429 quota exhaustion triggers key rotation
- Token counting: prompt_tokens, completion_tokens, total_tokens

**Schema (schema.py):**
```python
class ImageData(BaseModel):
    image: str
    dict_of_vars: dict
    subject: Optional[str] = "math"
    include_steps: bool = True
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Backend slow (30-60s) | Render free tier cold start | Frontend auto-warms on load; upgrade for instant start |
| Backend offline | Free tier 15-min auto-spindown | Frontend 14-min keep-alive pings health endpoint |
| CORS errors | Different domains | Already configured for localhost + production URLs |
| Image not recognized | Small/unclear drawing | Draw larger, clearer lines |
| 429 quota error | API key limit hit | Add comma-separated keys; auto-rotates |

---

## Performance Optimizations

**Frontend:**
- Health ping on app load (60s timeout)
- 14-min heartbeat to prevent spindown
- Retry logic with exponential backoff
- localStorage for token persistence

**Backend:**
- 4 Gunicorn workers
- App preload (shared across workers)
- Minimal logging
- Lazy imports

---

## Development

**Build Frontend:**
```bash
cd calc-fe && npm run build
```

**Type Check:**
```bash
npm run type-check
```

**Lint:**
```bash
npm run lint && npm run lint:fix
```

---

## Files Reference

| File | Purpose |
|------|---------|
| calc-be/main.py | FastAPI app init, CORS, /healthz, /calculate router |
| calc-be/apps/calculator/route.py | POST /calculate, image decode (base64→PNG), Gemini API call |
| calc-be/apps/calculator/utils.py | analyze_image(), prompt builder, response parser, key rotation, token usage |
| calc-be/schema.py | ImageData Pydantic model (image, subject, dict_of_vars, include_steps) |
| calc-be/constants.py | Env config loading (GEMINI_API_KEYS, PORT, ENV, SERVER_URL, GEMINI_MODEL) |
| calc-fe/src/App.tsx | Canvas, drawing, text mode, text boxes, drag/resize, solve logic, UI controls |
| calc-fe/src/index.css | Windows 95 UI theme, text box styling, responsive mobile layout |
| calc-fe/vite.config.ts | Vite proxy (/api → localhost:8900) + React plugin |
| calc-fe/package.json | React 18.3.1, KaTeX 0.16.45, perfect-freehand 1.2.3, TypeScript 5.5.3

---

## License & Author

MIT License | Created by Aryan Ranavat
