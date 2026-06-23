import os
import logging
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from apps.calculator.route import router as calculator_router
from constants import ENV, PORT, SERVER_URL

os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
logger = logging.getLogger("aicalc")

@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Server starting up...")
    yield
    logger.info("Server shutting down...")

app = FastAPI(
    title="AICalc API",
    version="2.0.0",
    lifespan=lifespan,
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"message": "Error", "data": [], "status": "error", "detail": exc.detail},
        )
    logger.exception("Unhandled exception occurred")
    detail = str(exc) if ENV == "dev" else "An unexpected error occurred. Please try again."
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "data": [], "status": "error", "detail": detail},
    )

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://ai-calc-dusky.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ENV == "dev" else origins,
    allow_credentials=True if ENV != "dev" else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.get("/healthz")
async def health():
    return {"status": "ok", "version": "2.0.0"}

app.include_router(calculator_router, prefix="/calculate")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", PORT))
    host = "0.0.0.0" if os.environ.get("PORT") else SERVER_URL
    uvicorn.run("main:app", host=host, port=port, reload=(ENV == "dev"))
