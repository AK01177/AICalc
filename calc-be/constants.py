from dotenv import load_dotenv
import os

load_dotenv()

SERVER_URL = os.getenv('SERVER_URL', 'localhost')
PORT = os.getenv('PORT', '8900')
ENV = os.getenv('ENV', 'dev')

_raw_keys = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEYS = [k.strip() for k in _raw_keys.split(",") if k.strip()]
GEMINI_API_KEY = GEMINI_API_KEYS[0] if GEMINI_API_KEYS else None
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip() or None
