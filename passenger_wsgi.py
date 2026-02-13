import os
import sys

# Add the project directory to the sys.path
sys.path.insert(0, os.path.dirname(__file__))

# Import the FastAPI app
from main import app

# Import the adapter
# If your cPanel doesn't install a2wsgi, you might need to bundle it or use a simpler adapter.
# But "Setup Python App" usually handles requirements.txt.
try:
    from a2wsgi import ASGIMiddleware
    application = ASGIMiddleware(app)
except ImportError:
    # Fallback if a2wsgi isn't installed - this simple adapter might work for basic GET requests but websockets won't
    # Better to rely on a2wsgi
    print("CRITICAL: a2wsgi module not found. Please install it via pip or requirements.txt")
    application = None
