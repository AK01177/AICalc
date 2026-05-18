# 🧮 AICalc - AI-Powered Calculator

Draw a math, physics, or chemistry problem on the canvas and get instant solutions powered by Google Gemini AI.

**Live Demo:** [https://ai-calc-dusky.vercel.app](https://ai-calc-dusky.vercel.app)

---

## ✨ Features

- 🎨 **Freehand Drawing Canvas** - Smooth drawing experience with perfect stroke rendering
- 🤖 **AI Problem Solving** - Uses Google Gemini 2.5 Flash to analyze and solve problems
- 📊 **Multi-Subject Support** - Math, Physics, and Chemistry problems
- 📝 **Step-by-Step Solutions** - Optional detailed explanation of each step
- 🎯 **Multiple Colors & Eraser** - Color-coded drawing with eraser tool
- 📱 **Responsive Design** - Works on desktop and mobile devices
- ⚡ **Token Tracking** - Keep track of API usage
- 🚀 **Optimized Performance** - Backend warm-up and keep-alive to minimize cold starts

---

## 🏗️ Architecture

```
AICalc/
├── calc-fe/                 # Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── App.tsx         # Main application component
│   │   ├── index.css       # Styling
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── vercel.json         # Vercel deployment config
│
└── calc-be/                 # Backend (FastAPI + Python)
    ├── apps/
    │   └── calculator/
    │       ├── route.py    # API endpoints
    │       └── utils.py    # AI logic
    ├── main.py             # FastAPI server
    ├── schema.py           # Data models
    ├── constants.py        # Configuration
    ├── requirements.txt
    ├── gunicorn_config.py  # Production server config
    ├── render.yaml         # Render deployment config
    └── Procfile            # Heroku-compatible deploy
```

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **perfect-freehand** - Smooth stroke rendering
- **KaTeX** - LaTeX math rendering
- **Deployed on Vercel** - Instant cold start

### Backend
- **FastAPI** - Modern Python web framework
- **Uvicorn** - ASGI server
- **Gunicorn** - Production-grade WSGI server
- **Google Gemini API** - AI problem solving
- **Pillow** - Image processing
- **Deployed on Render** - Free tier with optimizations

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (for frontend)
- Python 3.9+ (for backend)
- Google API Key (free from [Google AI Studio](https://aistudio.google.com/app/apikey))

### Backend Setup

```bash
cd calc-be

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo GEMINI_API_KEY=your_key_here > .env
echo SERVER_URL=localhost >> .env
echo PORT=8900 >> .env
echo ENV=dev >> .env

# Run server
python main.py
```

Backend runs on `http://localhost:8900`

### Frontend Setup

```bash
cd calc-fe

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on `http://localhost:5173`

### Optional: Point Frontend to Backend

Create `calc-fe/.env`:
```
VITE_API_BASE=http://localhost:8900
```

Without this, the Vite dev proxy will forward `/api` requests to `localhost:8900`.

---

## 📋 API Endpoints

### Health Check
```http
GET /healthz
```
Returns `{ "status": "ok", "version": "2.0.0" }`

### Calculate
```http
POST /calculate
Content-Type: application/json

{
  "image": "data:image/png;base64,...",
  "subject": "math",
  "dict_of_vars": {},
  "include_steps": true
}
```

**Response:**
```json
{
  "data": [
    {
      "expr": "2+2",
      "result": "4",
      "steps": [
        {"explanation": "Adding 2+2..."}
      ]
    }
  ],
  "usage": {
    "total_tokens": 150
  }
}
```

---

## 🌐 Deployment

### Frontend (Vercel)

The frontend is automatically deployed on every push to `main`:

```bash
git push origin main
```

Vercel config is in `calc-fe/vercel.json`

**Frontend URL:** https://ai-calc-dusky.vercel.app

### Backend (Render)

Render config is in `calc-be/render.yaml`

**Backend URL:** https://aicalc-nvif.onrender.com

### Environment Variables

**Backend** (Render Dashboard):
- `GEMINI_API_KEY` - Your Google API key
- `ENV` - Set to `prod`
- `PORT` - Auto-assigned by Render
- `SERVER_URL` - Set to `0.0.0.0`

**Frontend** (Vercel Dashboard):
- No secrets needed - API base is hardcoded in build

---

## ⚡ Performance Optimizations

### Frontend
- **Automatic Backend Warm-up** - Pings health endpoint on app load to wake up sleeping Render instance
- **Keep-Alive Ping** - Sends heartbeat every 14 minutes to prevent cold spin-down
- **Retry Logic** - Automatic retries with exponential backoff for failed requests
- **60-second Timeout** - Gives backend time to start before timing out

### Backend
- **Multi-Worker** - 4 Gunicorn workers for better concurrency
- **Preload App** - App loaded once, shared across workers
- **Reduced Logging** - Minimal logging overhead for faster startup
- **Optimized Imports** - Lazy loading of heavy dependencies

---

## 🎯 How to Use

1. **Visit** [https://ai-calc-dusky.vercel.app](https://ai-calc-dusky.vercel.app)
2. **Select Subject** - Choose Math, Physics, or Chemistry
3. **Draw Problem** - Use the canvas to draw your problem
4. **Customize** - Adjust brush size, colors, or enable step-by-step explanation
5. **Calculate** - Click the CALCULATE button
6. **View Results** - See the answer and optional steps

### Tips
- Draw clearly for better recognition
- Use the eraser tool if you make mistakes
- Enable "SHOW STEPS" for detailed explanations
- Token count tracks your API usage

---

## 🐛 Troubleshooting

### Backend Takes Too Long to Start
- **Free Tier:** First request may take 30-60 seconds as Render spins up
- **Solution:** The frontend automatically wakes up the backend on page load
- **Better Solution:** Upgrade to Render Standard ($7/month) for instant startup

### Backend Keeps Going Offline
- **Cause:** Render free tier spins down after 15 minutes of inactivity
- **Solution:** Frontend keeps it alive with periodic health checks
- **Upgrade Option:** Standard tier never spins down

### CORS Errors
- **Cause:** Backend and frontend on different domains
- **Solution:** CORS is already configured in `main.py` for both local and production
- **Check:** Verify `VITE_API_BASE` is correctly set

### Image Not Recognized
- **Cause:** Drawing is too small or unclear
- **Solution:** Draw larger and clearer
- **Debug:** Check browser console for specific errors

---

## 📚 Project Structure

```
Frontend (calc-fe):
  - React component-based architecture
  - Vite for fast builds
  - TypeScript for type safety
  - Canvas API for drawing
  - Fetch API for backend communication

Backend (calc-be):
  - FastAPI with async/await
  - Modular route + utility structure
  - Google Gemini integration
  - Image processing pipeline
  - CORS middleware for cross-origin requests
```

---

## 🔒 Security

- **API Keys:** All stored as environment variables, never committed
- **CORS:** Restricted to specific origins in production
- **Input Validation:** Image format and size validated
- **Error Handling:** No sensitive info leaked in error messages

---

## 💰 Costs

- **Frontend (Vercel):** Free
- **Backend (Render):** Free (with cold start penalty) or $7/month for instant performance
- **API:** Google Gemini free tier included

---

## 🚧 Future Improvements

- [ ] Support for handwritten equations
- [ ] Graph plotting capability
- [ ] Unit conversion
- [ ] Problem history
- [ ] Offline mode with local models
- [ ] Mobile app (React Native)
- [ ] Custom problem templates

---

## 📝 License

MIT License - Feel free to use and modify

---

## 👨‍💻 Created by

**Aryan Ranavat**

---

## 🤝 Contributing

Found a bug or have a feature request? Feel free to open an issue!

---

**Happy calculating! 🧮**
