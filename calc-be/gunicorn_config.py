import os

port = os.environ.get("PORT", "8900")
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
bind = f"0.0.0.0:{port}"
timeout = 300
keepalive = 5
max_requests = 500
preload_app = True
loglevel = "warning"
accesslog = "-"
errorlog = "-"
worker_connections = 1000

