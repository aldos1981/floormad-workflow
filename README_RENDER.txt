DEPLOYMENT ON RENDER.COM
========================

1. PUSH TO GITHUB
   - Create a new repository on GitHub.
   - Commit and push all files in this project folder to your GitHub repository.

2. SETUP RENDER
   - Go to https://render.com/ and sign up/login.
   - Click "New +" and select "Blueprint".
   - Connect your GitHub account and select the repository you just pushed.
   - Render will automatically detect the 'render.yaml' file and configure everything.
   - Click "Apply".

3. DONE
   - Render will build and deploy your app.
   - It will give you a URL like "https://floormad-automation.onrender.com".
   - Open that URL to use your app.

NOTES:
- The database (sqlite.db) will be reset every time Render redeploys (ephemeral filesystem).
- To keep data persistent on Render, you need to add a "Disk" (paid feature) or use an external database like PostgreSQL (Render offers a managed Postgres).
- For testing/demo purposes, the ephemeral SQLite is fine, but data vanishes on restart.
