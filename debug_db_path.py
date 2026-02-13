
import os
import sqlite3

print("CWD:", os.getcwd())
print("DB Path:", os.path.abspath("floormad.db"))

conn = sqlite3.connect("floormad.db")
c = conn.cursor()
try:
    c.execute("SELECT count(*) FROM projects")
    print("Project Count:", c.fetchone()[0])
    
    rows = c.execute("SELECT id, name FROM projects").fetchall()
    for r in rows:
        print(f"- {r[0]}: {r[1]}")
        
except Exception as e:
    print("Error:", e)
conn.close()
