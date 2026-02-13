DEPLOYMENT ON CPANEL (Shared Hosting)
=======================================

Since you cannot run terminal commands, you must use the "Setup Python App" tool in your cPanel dashboard.

STEP-BY-STEP INSTRUCTIONS:

1.  **PREPARE FILES**
    - Unzip the `dist.zip` file on your computer.
    - Confirm you have: `main.py`, `passenger_wsgi.py`, `requirements.txt`, and the `static` folder.

2.  **CREATE PYTHON APP IN CPANEL**
    - Log in to cPanel.
    - Find and click on **"Setup Python App"** (under Software section).
    - Click **"Create Application"**.
    - **Python Version**: Select the latest available (e.g., 3.11 or 3.10).
    - **Application Root**: Enter the folder name where you want the files (e.g., `floormad_app`).
    - **Application URL**: Select your domain (e.g., `floormad.com` or `floormad.com/app`).
    - Click **CREATE**.

3.  **UPLOAD FILES**
    - Go to **File Manager** in cPanel.
    - Navigate to the folder you just created (e.g., `floormad_app`).
    - **DELETE** the default `passenger_wsgi.py` created by cPanel.
    - **UPLOAD** all the files from your `dist` folder (`main.py`, `passenger_wsgi.py`, `requirements.txt`, `static/`).

4.  **INSTALL DEPENDENCIES (The most important step)**
    - Go back to the **"Setup Python App"** page in cPanel.
    - Scroll down to the "Configuration files" section.
    - In the box under "Enter requirements file", type: `requirements.txt`
    - Click **Add**.
    - Once added, a button **"Run Pip Install"** will appear. **Click it**.
    - Wait for it to say "Completed". This installs FastAPI, Uvicorn, and a2wsgi for you.

5.  **RESTART**
    - Scroll to the top of the page and click **RESTART**.

6.  **TEST**
    - Open your URL. The app should be running!

TROUBLESHOOTING:
- If you see a generic error, check the `stderr.log` in your File Manager inside the app folder.
- Ensure `passenger_wsgi.py` is the one provided in this zip, NOT the default one.
