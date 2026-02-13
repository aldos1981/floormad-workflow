DEPLOYMENT INSTRUCTIONS
=======================

1. FILES
   - main.py: The application backend (FastAPI).
   - static/: The frontend files (HTML, JS, CSS).
   - requirements.txt: Python dependencies.

2. INSTALLATION
   - Upload all files to your server or hosting environment.
   - Install dependencies:
     pip install -r requirements.txt

3. DATABASE (sqlite.db)
   - The application uses a SQLite database file named 'sqlite.db'.
   - LOCATION: It will be automatically created in the SAME directory as 'main.py' when you first run the app.
   - PERSISTENCE: 
     - If you are on a VPS/Dedicated server, the file is safe.
     - If you use a cloud platform (like Heroku, Vercel, Render), the filesystem is often ephemeral (deleted on restart). 
       In that case, you will lose data unless you mount a persistent volume or switch to an external database (PostgreSQL/MySQL).
   - PRE-EXISTING DATA:
     - If you have a local 'sqlite.db' with data you want to keep, upload it to the server in the same folder as 'main.py'.

4. RUNNING
   - Command:
     python -m uvicorn main:app --host 0.0.0.0 --port 8000
   
   - If using a process manager like PM2 or Systemd, ensure the working directory is set to this folder.

5. BRIDGE (Optional)
   - If you need PHP integration, 'bridge.php' should be placed in your public_html or relevant web directory, and configured in the app settings.
