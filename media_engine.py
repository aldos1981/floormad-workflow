import os
import shutil
import json
import traceback
from datetime import datetime
from fastapi import UploadFile
from database import get_db_connection

# Directory to store project uploads
UPLOAD_DIR = "uploads"

def ensure_project_dir(project_id):
    path = os.path.join(UPLOAD_DIR, project_id)
    os.makedirs(path, exist_ok=True)
    return path

def get_media_files(project_id):
    """
    Returns a list of files in the project's upload directory.
    """
    path = ensure_project_dir(project_id)
    files = []
    
    # Check for metadata file (stores AI summaries)
    meta_path = os.path.join(path, "metadata.json")
    metadata = {}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, 'r') as f:
                metadata = json.load(f)
        except:
            pass

    for filename in os.listdir(path):
        if filename == "metadata.json" or filename.startswith('.'):
            continue
            
        file_path = os.path.join(path, filename)
        if os.path.isfile(file_path):
            stats = os.stat(file_path)
            ext = os.path.splitext(filename)[1].lower()
            
            # Determine Icon Type
            icon = "📄"
            if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                icon = "🖼️"
            elif ext in ['.pdf']:
                icon = "📕"
            elif ext in ['.csv', '.xlsx', '.xls']:
                icon = "📊"
            elif ext in ['.doc', '.docx', '.txt', '.md']:
                icon = "📝"
            elif ext in ['.mp4', '.mov']:
                icon = "🎬"

            meta = metadata.get(filename, {})
            
            files.append({
                "name": filename,
                "size": stats.st_size,
                "modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
                "icon": icon,
                "type": ext,
                "url": f"/api/projects/{project_id}/media/file/{filename}", # Verify if we need specific route or static
                "ai_summary": meta.get('summary', ''),
                "ai_status": meta.get('status', 'raw') # raw, processing, done, error
            })
            
    # Sort by recent modified
    files.sort(key=lambda x: x['modified'], reverse=True)
    return files

async def save_uploaded_file(project_id, file: UploadFile):
    path = ensure_project_dir(project_id)
    file_path = os.path.join(path, file.filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Trigger AI Processing (Async or immediate?)
        # For now, immediate simple processing or queue
        summary = await process_file_with_ai(project_id, file.filename, file_path)
        
        return {
            "success": True, 
            "message": "File uploaded", 
            "filename": file.filename,
            "ai_summary": summary
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

def delete_media_file(project_id, filename):
    path = ensure_project_dir(project_id)
    file_path = os.path.join(path, filename)
    
    if os.path.exists(file_path):
        os.remove(file_path)
        
        # Update metadata
        meta_path = os.path.join(path, "metadata.json")
        if os.path.exists(meta_path):
            try:
                with open(meta_path, 'r') as f:
                    data = json.load(f)
                if filename in data:
                    del data[filename]
                    with open(meta_path, 'w') as f:
                        json.dump(data, f)
            except:
                pass
                
        return {"success": True, "message": "File deleted"}
    return {"success": False, "message": "File not found"}

async def process_file_with_ai(project_id, filename, file_path):
    """
    Attempts to read the file and generate a summary using the configured AI.
    Updates uploads/{project_id}/metadata.json with the result.
    """
    from tools.llm_utils import call_llm
    
    # 1. Read Content
    content = ""
    ext = os.path.splitext(filename)[1].lower()
    
    try:
        if ext in ['.txt', '.md', '.csv', '.json', '.xml']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read(10000) # Limit chars
        elif ext == '.pdf':
            # Basic PDF reader if available, else skip
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                content = ""
                for page in reader.pages[:5]: # First 5 pages maximum
                    content += page.extract_text() + "\n"
            except ImportError:
                 content = "[PDF content not readable - pypdf not installed]"
            except Exception as e:
                content = f"[PDF Error: {str(e)}]"
        else:
            return "Format not supported for AI summary"

        if not content or len(content) < 10:
            return "No text content found"

        # 2. Call AI
        # We need the project's specific key if possible, but tools.llm_utils uses global or env
        # Assuming global key is set in settings or env for now.
        
        system_prompt = "You are a helpful assistant. Summarize this document in 2-3 sentences max."
        user_prompt = f"File: {filename}\nContent:\n{content[:5000]}"
        
        summary = call_llm(system_prompt, user_prompt)
        
        # 3. Save Metadata
        path = os.path.dirname(file_path)
        meta_path = os.path.join(path, "metadata.json")
        
        data = {}
        if os.path.exists(meta_path):
            with open(meta_path, 'r') as f:
                try:
                    data = json.load(f)
                except: pass
        
        data[filename] = {
            "summary": summary,
            "status": "done",
            "last_processed": datetime.now().isoformat()
        }
        
        with open(meta_path, 'w') as f:
            json.dump(data, f, indent=2)
            
        return summary

    except Exception as e:
        print(f"AI Process Error: {e}")
        return f"Error processing file: {str(e)}"
