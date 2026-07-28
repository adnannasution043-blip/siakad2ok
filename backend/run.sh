#!/bin/bash
echo "======================================="
echo "  SIAKAD Local — JSON Mode"
echo "======================================="
echo ""
echo "Install dependencies..."
pip install -r requirements.txt -q

echo ""
echo "Starting server..."
echo ""
echo "  → Buka browser: http://localhost:8000"
echo "  → API docs    : http://localhost:8000/api/docs"
echo ""
uvicorn app.main:app --reload --port 8000
