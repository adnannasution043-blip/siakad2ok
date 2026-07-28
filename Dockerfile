FROM python:3.11-slim

WORKDIR /app/backend

# Install deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy frontend so it can be served as static files
COPY frontend/ ../frontend/

# Railway injects PORT; fallback 8000 for local docker run
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
