import multiprocessing
import os

port = os.environ.get("PORT", "8900")
workers = min(multiprocessing.cpu_count() * 2 + 1, 4)
worker_class = "uvicorn.workers.UvicornWorker"
bind = f"0.0.0.0:{port}"
timeout = 300
graceful_timeout = 30
keepalive = 5
max_requests = 500
max_requests_jitter = 50
preload_app = True
loglevel = "warning"
accesslog = "-"
errorlog = "-"
worker_connections = 1000