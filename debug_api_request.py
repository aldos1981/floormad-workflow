
import requests

try:
    print("Testing GET /api/projects...")
    r = requests.get("http://127.0.0.1:8000/api/projects", timeout=5)
    print(f"Status: {r.status_code}")
    print(f"JSON: {r.json()}")
except Exception as e:
    print(f"Error: {e}")
