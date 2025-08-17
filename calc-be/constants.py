from dotenv import load_dotenv
import os
load_dotenv()

# Use environment variables with fallbacks for local development
SERVER_URL = os.getenv('SERVER_URL', 'localhost')
PORT = os.getenv('PORT', '8900')
ENV = os.getenv('ENV', 'dev')

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
