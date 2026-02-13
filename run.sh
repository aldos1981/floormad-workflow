#!/bin/bash
# Install dependencies if not already installed (fast check)
python3 -c "import fastapi" 2>/dev/null || pip3 install fastapi uvicorn aiosqlite pydantic jinja2 python-multipart google-generativeai openai

# Run Server
python3 -m uvicorn main:app --reload --port 8000
