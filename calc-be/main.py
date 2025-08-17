from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from apps.calculator.route import router as calculator_router
from constants import SERVER_URL, PORT, ENV

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(lifespan=lifespan)


# Configure CORS origins based on environment
allowed_origins = [
    "http://localhost:3000",  # Local development
    "http://localhost:5173",  # Vite dev server
    "https://*.vercel.app",   # Vercel deployments
    "https://*.vercel.com",   # Vercel custom domains
]

# In production, you should replace the wildcard with your specific Vercel URL
if ENV == "dev":
    allowed_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get('/')
async def root():
    return {"message": "Server is running"}

app.include_router(calculator_router, prefix="/calculate", tags=["calculate"])


if __name__ == "__main__":
    import os
    # Use Render's PORT environment variable if available, otherwise fall back to constants
    port = int(os.environ.get("PORT", PORT))
    host = "0.0.0.0" if os.environ.get("PORT") else SERVER_URL
    uvicorn.run("main:app", host=host, port=port, reload=(ENV == "dev"))
