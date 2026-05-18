import os

port = os.environ.get("PORT", "8900")
workers = 4  # Increased from 1 for better concurrency
worker_class = "uvicorn.workers.UvicornWorker"
bind = f"0.0.0.0:{port}"
timeout = 300
keepalive = 5
max_requests = 500
preload_app = True  # Load app once, share across workers
loglevel = "warning"  # Reduced from "info" for faster startup
accesslog = "-"
errorlog = "-"
worker_connections = 1000  # Handle more concurrent connections

