import os

# Get PORT from environment (Render provides this)
port = os.environ.get("PORT", "8000")

# Optimize for Render's free tier
workers = 1  # Reduced for free tier memory limits
worker_class = "uvicorn.workers.UvicornWorker"
bind = f"0.0.0.0:{port}"
timeout = 300  # Extended timeout for AI processing
keepalive = 10
max_requests = 1000
max_requests_jitter = 100
preload_app = True

# Logging
loglevel = "info"
accesslog = "-"
errorlog = "-"
