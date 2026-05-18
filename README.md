# AICalc

Draw a math / physics / chemistry problem on the canvas and get the answer from Gemini.

Built with **React + TypeScript + Vite** on the frontend, **FastAPI** on the backend, uses **perfect-freehand** for smooth drawing strokes, **KaTeX** for LaTeX math rendering, and the **Google Gemini 2.5 Flash** model for AI-powered problem solving.

---

## How to Run

### Backend

```bash
cd calc-be
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
python main.py
```

Create a `.env` file in `calc-be/` :

```
GEMINI_API_KEY=your_key_here
SERVER_URL=localhost
PORT=8900
ENV=dev
```

Get your free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Frontend

```bash
cd calc-fe
npm install
npm run dev
```

Optionally create `calc-fe/.env` to point directly at the backend:

```
VITE_API_BASE=http://localhost:8900
```

If not set, the frontend uses the Vite dev proxy (`/api` → `localhost:8900`).

---

## Features

- Draw on canvas, pick colors, adjust brush size
- Eraser tool
- Subject picker (math, physics, chemistry)
- Step-by-step solutions toggle
- LaTeX rendering with KaTeX
- Token counter persisted in localStorage
- Mobile responsive with bottom-sheet controls
- API key rotation on quota exhaustion

---

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

Returns `{ "message": "...", "data": [...], "usage": {...}, "status": "success" }` where each item in `data` has `expr`, `result`, and optional `steps`.

---

## Deployment

| Layer    | Platform | Config File    |
|----------|----------|----------------|
| Frontend | Vercel   | `vercel.json`  |
| Backend  | Render   | `render.yaml`  |

Vercel rewrites `/api/*` requests to the Render backend URL. Render uses `python main.py` as the start command.

---

## Limitations

- Works best with clear handwriting
- Simple problems only — not a replacement for Wolfram Alpha
- Chemistry/physics support is basic (formula-level)

---

---

# Interview Prep Guide — What You Need to Learn

> **Everything below is written so that if an interviewer asks "why did you use X?" or "how does Y work?", you can confidently answer.** Read this section carefully.

---

## 1. Project Architecture (Big Picture)

```
┌─────────────────────┐       HTTP POST        ┌──────────────────────┐
│                     │   /calculate (JSON)     │                     │
│   React Frontend    │ ──────────────────────► │   FastAPI Backend    │
│   (Vite + TS)       │                         │   (Python)           │
│                     │ ◄────────────────────── │                     │
│   localhost:5173     │    JSON response        │   localhost:8900     │
└─────────────────────┘                         └──────┬───────────────┘
                                                       │
                                                       │ Gemini API call
                                                       │ (sends image + prompt)
                                                       ▼
                                                ┌──────────────────────┐
                                                │  Google Gemini 2.5   │
                                                │  Flash (Cloud AI)    │
                                                └──────────────────────┘
```

**Interview tip:** This is a classic **client-server** architecture. The frontend is a **Single Page Application (SPA)**. The backend is a **REST API** that acts as a **middleware/proxy** between the frontend and the Gemini AI model.

### Why separate frontend and backend?

- **Security** — API keys stay on the server, never exposed to the browser.
- **Separation of concerns** — UI logic vs business logic are decoupled.
- **Independent deployment** — frontend on Vercel (CDN, fast static hosting), backend on Render (Python runtime).
- **Scalability** — can scale backend separately if needed.

---

## 2. Frontend — React + TypeScript + Vite

### 2.1 What is React?

React is a JavaScript library for building user interfaces using **components**. A component is a function that returns JSX (HTML-like syntax in JavaScript).

**Key concepts you must know:**

| Concept | What it is | Where it's used in this project |
|---------|-----------|-------------------------------|
| **useState** | State variable — when it changes, the component re-renders | `color`, `brush`, `subject`, `results`, `loading`, `error`, `showSteps`, `isEraser`, `hasContent`, `totalTokens`, `mobileControlsOpen`, `isMobile` |
| **useEffect** | Runs side-effects after render (like lifecycle methods) | Loading saved tokens from localStorage, setting up resize listener, initializing canvas |
| **useRef** | Holds a mutable reference that does NOT cause re-renders when changed | `canvasRef` (DOM element), `ctxRef` (canvas context), `pointsRef` (drawing points), `drawingRef` (is user drawing?), `snapshotRef` (canvas snapshot before current stroke) |
| **useCallback** | Memoizes a function so it isn't recreated every render | `initCanvas` function |
| **JSX** | HTML-like syntax that React compiles to `createElement` calls | The entire `return (...)` block in `App.tsx` |
| **Conditional rendering** | Show/hide UI based on state | `{loading ? "BUSY..." : "CALCULATE"}`, `{results.length > 0 && (...)}`, `{error && (...)}` |
| **Controlled components** | Form elements whose value is driven by React state | `<select value={subject}>`, `<input value={brush}>`, `<input checked={showSteps}>` |

### 2.2 Why useRef instead of useState for canvas data?

`useRef` does NOT trigger a re-render. Drawing produces dozens of events per second — if we used `useState` for `pointsRef`, React would re-render the entire component 60+ times per second and the UI would freeze. `useRef` lets us mutate data silently without React knowing.

### 2.3 What is TypeScript?

TypeScript is a superset of JavaScript that adds **static types**. It catches errors at compile time.

In this project, types are defined like:

```typescript
type CalculationResult = {
  expr: string;
  result: string;
  steps?: CalculationStep[];   // the ? means optional
};
```

**Why use TypeScript?** — Catches bugs before runtime, better IDE autocomplete, self-documenting code.

### 2.4 What is Vite?

Vite is a **build tool and dev server** for frontend projects. It replaces older tools like Webpack.

**Why Vite over Webpack?**
- Uses ES modules natively in dev → instant hot reload (no bundling needed during development)
- Much faster startup compared to Webpack
- Built-in TypeScript support, no extra config needed

**Key config (`vite.config.ts`):**

```typescript
server: {
  proxy: {
    "/api": {
      target: "http://127.0.0.1:8900",
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/api/, ""),
    },
  },
},
```

This is a **dev proxy** — any request to `localhost:5173/api/calculate` gets forwarded to `localhost:8900/calculate`. This avoids **CORS issues** during development without configuring the browser.

### 2.5 What is `import.meta.env`?

Vite's way of accessing environment variables. Only variables prefixed with `VITE_` are exposed to the browser. Example: `import.meta.env.VITE_API_BASE`.

### 2.6 Canvas API and Drawing

The HTML `<canvas>` element gives you a 2D drawing surface controlled via JavaScript.

**Key concepts:**

| Concept | Explanation |
|---------|-------------|
| `canvas.getContext("2d")` | Returns a `CanvasRenderingContext2D` object with drawing methods |
| `devicePixelRatio (DPR)` | On retina screens, DPR=2 means each CSS pixel = 2 physical pixels. We multiply canvas dimensions by DPR for crisp drawing, then scale the context back down |
| `ctx.getImageData()` / `ctx.putImageData()` | Saves/restores the raw pixel data. Used here to snapshot before each stroke so we can redraw cleanly |
| `canvas.toDataURL("image/png")` | Converts the canvas content to a base64-encoded PNG string — this is what we send to the backend |
| `ResizeObserver` | Browser API that fires when the canvas element's size changes. We use it to re-initialize and redraw |
| Pointer Events | `onPointerDown`, `onPointerMove`, `onPointerUp` — unified events that work for both mouse and touch |
| `touchAction: "none"` | CSS property that tells the browser NOT to handle touch gestures (scroll, zoom) on the canvas — we handle them ourselves |

### 2.7 What is perfect-freehand?

A library that converts raw pointer coordinates into smooth, pressure-sensitive strokes. It takes an array of `[x, y, pressure]` points and returns an **outline polygon** (array of `[x, y]` points) that we fill to create natural-looking pen strokes.

**Why not just `ctx.lineTo()`?** — `lineTo` produces constant-width lines with jagged corners. `perfect-freehand` gives variable-width, smooth, calligraphy-like strokes.

### 2.8 What is KaTeX?

KaTeX is a fast LaTeX math renderer for the web. It converts LaTeX strings like `\\frac{1}{2}` into beautifully formatted math expressions.

We use the `react-katex` wrapper: `<InlineMath math={r.result} />`.

**Why KaTeX over MathJax?** — KaTeX is faster (no re-layout flicker), renders synchronously, and has a smaller bundle size.

### 2.9 How does the frontend send data to the backend?

The `solve()` function in `App.tsx`:

1. Takes the canvas content and creates an offscreen canvas scaled down to max 768px (saves bandwidth and tokens)
2. Converts it to a base64 PNG data URL via `toDataURL()`
3. Sends a `POST` request using `fetch()` to `/calculate`
4. Parses the JSON response and updates React state (`setResults`, `setTotalTokens`)

### 2.10 What is localStorage?

`localStorage` is a browser API that stores key-value pairs persistently (survives page refresh and browser restart). Used here to persist the total token count across sessions.

```typescript
localStorage.setItem("aicalc_total_tokens", String(nextTotal));
localStorage.getItem("aicalc_total_tokens");
```

---

## 3. Backend — FastAPI (Python)

### 3.1 What is FastAPI?

FastAPI is a modern Python web framework for building APIs. It's built on top of **Starlette** (for the web layer) and **Pydantic** (for data validation).

**Why FastAPI?**
- **Automatic request validation** via Pydantic models
- **Async support** — uses `async/await` natively
- **Auto-generated docs** — visit `/docs` for Swagger UI
- **Very fast** — one of the fastest Python frameworks (comparable to Node.js)

### 3.2 File-by-file Breakdown

| File | Purpose |
|------|---------|
| `main.py` | Entry point. Creates the FastAPI app, configures CORS, registers routes, starts Uvicorn |
| `constants.py` | Loads environment variables using `python-dotenv`. Parses comma-separated API keys |
| `schema.py` | Defines the `ImageData` Pydantic model (request body schema) |
| `apps/calculator/route.py` | The `/calculate` POST endpoint. Decodes base64 image, calls `analyze_image()` |
| `apps/calculator/utils.py` | Core AI logic. Builds the prompt, calls Gemini API, parses JSON response |
| `gunicorn_config.py` | Production WSGI server config (used on Render) |
| `render.yaml` | Render deployment config (IaC — Infrastructure as Code) |
| `Procfile` | Alternative deployment config (Heroku-style) |
| `requirements.txt` | Python dependencies |

### 3.3 Key Concepts

#### CORS (Cross-Origin Resource Sharing)

Browsers block requests from one origin (e.g., `localhost:5173`) to another (e.g., `localhost:8900`) by default. CORS headers tell the browser it's okay.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ENV == "dev" else origins,  # in dev, allow all
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Interview Q: Why is `allow_origins=["*"]` dangerous in production?**
A: It allows ANY website to call your API. In production, you whitelist only your own frontend domain.

#### Pydantic Models

```python
class ImageData(BaseModel):
    image: str
    dict_of_vars: dict
    subject: Optional[str] = "math"
    include_steps: bool = True
```

FastAPI automatically validates incoming JSON against this schema. If `image` is missing, the client gets a `422 Unprocessable Entity` error without you writing any validation code.

#### Lifespan Events

```python
@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Server starting up...")
    yield
    logger.info("Server shutting down...")
```

Code before `yield` runs on startup, code after runs on shutdown. Useful for opening/closing database connections, loading ML models, etc.

#### Global Exception Handler

```python
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(status_code=500, content={...})
```

Catches any unhandled exception in any route and returns a clean JSON error instead of a raw 500 page.

### 3.4 How Does the AI Processing Work? (`utils.py`)

Step by step:

1. **Get API client** — `_get_client()` creates a `genai.Client` using the current API key
2. **Build prompt** — `_build_prompt()` creates a detailed instruction telling Gemini to:
   - Act as an exact math/physics/chemistry solver
   - Return results as a JSON array with `expr`, `result`, `assign`, `steps`
   - Use LaTeX for all math expressions
3. **Convert image** — `_image_to_png_bytes()` converts the PIL Image to raw PNG bytes
4. **Call Gemini** — Sends both the text prompt and the image to `client.models.generate_content()`
5. **Parse response** — `_parse_response()` tries three strategies:
   - `json.loads()` first (standard JSON)
   - `ast.literal_eval()` (handles Python-style dicts)
   - Regex extraction (fallback — finds `[{...}]` pattern in the text)
6. **Return results** — Normalized list of dicts with `expr`, `result`, `assign`, `steps`

#### API Key Rotation

```python
GEMINI_API_KEYS = [k.strip() for k in _raw_keys.split(",") if k.strip()]
```

Multiple API keys are stored comma-separated. If one key hits the rate limit (HTTP 429 / `RESOURCE_EXHAUSTED`), `_rotate_key()` switches to the next key and retries. This is a simple **round-robin failover** pattern.

### 3.5 What is Uvicorn?

Uvicorn is an **ASGI server** — it's the actual process that listens on a port and handles HTTP connections. FastAPI is just the framework; Uvicorn is the server that runs it.

```python
uvicorn.run("main:app", host=host, port=port, reload=(ENV == "dev"))
```

`reload=True` in dev mode means the server auto-restarts when you save a file.

### 3.6 What is Gunicorn?

Gunicorn is a **production WSGI/ASGI server** that manages multiple worker processes. In production (Render), it runs Uvicorn workers:

```
web: python -m gunicorn main:app -c gunicorn_config.py
```

**Why Gunicorn in prod but Uvicorn in dev?**
- Dev: single Uvicorn process with hot-reload is simpler
- Prod: Gunicorn manages multiple workers for reliability (auto-restart crashed workers, handle more concurrent requests)

### 3.7 What is Pillow (PIL)?

Python Imaging Library — used here to open and validate the decoded image bytes before sending to Gemini.

### 3.8 What is base64?

Base64 is an encoding that converts binary data (like an image) into ASCII text. The canvas `toDataURL()` gives us a string like `data:image/png;base64,iVBOR...`. The backend splits off the header, decodes the base64 part back to raw bytes, and opens it as a PIL Image.

---

## 4. Deployment

### 4.1 Vercel (Frontend)

Vercel is a hosting platform optimized for frontend frameworks. The `vercel.json` config:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://aicalc-nvif.onrender.com/:path*" }
  ]
}
```

The `rewrites` rule is critical — it proxies API calls from the Vercel-hosted frontend to the Render-hosted backend, avoiding CORS in production entirely.

### 4.2 Render (Backend)

Render is a cloud platform for deploying web services. The `render.yaml` config defines:
- Python runtime, free tier, Oregon region
- Build command: install dependencies
- Start command: `python main.py`
- Environment variables (including secret `GEMINI_API_KEY`)
- Health check endpoint at `/`

---

## 5. What You Must Be Able to Explain

### Frontend Questions

| Question | Key Points |
|----------|-----------|
| What is the Virtual DOM? | React keeps an in-memory copy of the DOM. On state change, it diffs old vs new virtual DOM and only updates the real DOM where needed. This is faster than direct DOM manipulation. |
| What's the difference between `useState` and `useRef`? | `useState` triggers re-render on change, `useRef` does not. Use `useRef` for values that change frequently but don't need to update the UI (like drawing coordinates). |
| What is `useEffect` cleanup? | The function returned from `useEffect` runs when the component unmounts or before the effect re-runs. Used to remove event listeners, disconnect observers, etc. |
| What is `useCallback` and why use it? | Memoizes a function reference. Without it, a new function is created every render, which can cause unnecessary re-renders in child components or infinite `useEffect` loops. |
| How does the Vite proxy work? | In dev, Vite intercepts requests to `/api/*` and forwards them to the backend. This avoids CORS because the browser thinks it's talking to the same origin. |
| What is a SPA? | Single Page Application — the browser loads one HTML page, and JavaScript handles all navigation and UI updates without full page reloads. |
| What does `StrictMode` do? | In development, React renders components twice to help detect side effects. It does nothing in production. |

### Backend Questions

| Question | Key Points |
|----------|-----------|
| What is ASGI vs WSGI? | WSGI is synchronous (one request per thread). ASGI is asynchronous (handles many concurrent requests with `async/await`). FastAPI uses ASGI. |
| What is middleware? | Code that runs before/after every request. CORS middleware adds headers to every response. You can add logging middleware, auth middleware, etc. |
| What is Pydantic? | Data validation library. You define a model class, and Pydantic ensures incoming data matches the schema, converts types, and returns clear errors. |
| What is `async/await`? | Python's concurrency model. `async def` defines a coroutine. `await` pauses it until the awaited operation completes, letting other requests be served meanwhile. |
| Why FastAPI over Flask? | Async support, automatic validation, auto docs, type hints, faster performance. Flask is simpler but lacks these out of the box. |
| What is an API key and why keep it server-side? | A secret token that authenticates your requests to Gemini. If exposed in frontend JS, anyone can steal it and use your quota. |
| What is rate limiting / 429 error? | APIs limit how many requests you can make per minute. HTTP 429 = "Too Many Requests". This project handles it by rotating to another API key. |

### General / System Design Questions

| Question | Key Points |
|----------|-----------|
| How does the data flow end to end? | User draws → canvas pixels → base64 PNG → POST to backend → backend decodes image → sends to Gemini with prompt → Gemini returns JSON text → backend parses → returns to frontend → React renders with KaTeX |
| Why not call Gemini directly from the frontend? | 1) API key would be exposed in browser. 2) No control over usage/abuse. 3) Can't add server-side validation or logging. |
| How would you add authentication? | Add a login page, use JWT tokens. Backend validates the token in a middleware before processing requests. |
| How would you add a database? | Store calculation history. Use PostgreSQL with SQLAlchemy (Python ORM). Add new routes like `GET /history`. |
| How would you handle multiple users? | Currently stateless — each request is independent. Add auth + database to tie results to user accounts. |

---

## 6. Concepts to Study (with resources)

### Must Learn (core to this project)

1. **React fundamentals** — components, JSX, props, state, hooks (`useState`, `useEffect`, `useRef`, `useCallback`)
   - [React official tutorial](https://react.dev/learn)

2. **TypeScript basics** — types, interfaces, generics, `Optional` (`?`)
   - [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/)

3. **HTML Canvas API** — `getContext("2d")`, drawing methods, `toDataURL`, devicePixelRatio
   - [MDN Canvas tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)

4. **FastAPI** — routes, request body models, middleware, async endpoints, error handling
   - [FastAPI official tutorial](https://fastapi.tiangolo.com/tutorial/)

5. **REST API concepts** — HTTP methods (GET, POST), status codes (200, 400, 422, 429, 500, 502), JSON, headers
   - [MDN HTTP overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)

6. **CORS** — what it is, why it exists, how to configure it
   - [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

7. **Environment variables** — `.env` files, why secrets shouldn't be in code, `dotenv`
   - Understand `python-dotenv` and Vite's `import.meta.env`

### Should Know (will impress interviewers)

8. **Base64 encoding** — what it is, why it increases data size by ~33%, why it's used for images in JSON

9. **Pydantic** — validation, `BaseModel`, `Optional`, default values

10. **async/await in Python** — event loop, coroutines, why it matters for I/O-bound tasks

11. **Prompt engineering** — how the prompt is structured to get structured JSON output from an LLM

12. **CSS responsiveness** — media queries, `dvh` units, mobile-first design, the retro Windows 95 styling approach used here

### Bonus (nice to have)

13. **Docker** — containerizing the backend
14. **CI/CD** — GitHub Actions for automated deployment
15. **WebSockets** — for real-time streaming of AI responses
16. **Testing** — pytest for backend, React Testing Library for frontend

---

## 7. Folder Structure Quick Reference

```
AICalc/
├── calc-be/                    # Python backend
│   ├── main.py                 # FastAPI app entry point
│   ├── constants.py            # Environment variable loader
│   ├── schema.py               # Pydantic request model
│   ├── apps/
│   │   └── calculator/
│   │       ├── route.py        # POST /calculate endpoint
│   │       └── utils.py        # Gemini API integration + response parsing
│   ├── requirements.txt        # Python dependencies
│   ├── gunicorn_config.py      # Production server config
│   ├── render.yaml             # Render deployment config
│   ├── Procfile                # Alternative deployment config
│   └── runtime.txt             # Python version (3.12.4)
│
├── calc-fe/                    # React frontend
│   ├── index.html              # Single HTML entry point
│   ├── src/
│   │   ├── main.tsx            # React bootstrap (createRoot)
│   │   ├── App.tsx             # Main component (canvas, controls, results)
│   │   └── index.css           # All styles (retro Windows 95 theme)
│   ├── package.json            # Node dependencies + scripts
│   ├── vite.config.ts          # Vite config with dev proxy
│   ├── vercel.json             # Vercel deployment config
│   └── tsconfig*.json          # TypeScript config
│
├── .gitignore
└── README.md                   # This file
```
