import sqlite3
import json
import uuid

def test_insert():
    try:
        conn = sqlite3.connect('floormad.db')
        project_id = str(uuid.uuid4())
        
        # Test Data
        name = "Debug Project"
        description = "Testing insert"
        google_sheet_id = "test_sheet"
        service_account_json = "{}"
        smtp_config = json.dumps({"host": "smtp.test"})
        wesendit_config = json.dumps({"key": "123"})
        cron = "0 0 * * *"
        price_url = "http://test"
        locality_prompt = "prompt"
        products_config = json.dumps([])
        workflow_json = json.dumps({})
        
        print("Attempting INSERT...")
        conn.execute(
            "INSERT INTO projects (id, name, description, google_sheet_id, service_account_json, smtp_config, wesendit_config, cron_expression, price_list_url, locality_prompt, products_config, workflow_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                project_id,
                name,
                description,
                google_sheet_id,
                service_account_json,
                smtp_config,
                wesendit_config,
                cron,
                price_url,
                locality_prompt,
                products_config,
                workflow_json
            )
        )
        conn.commit()
        print("INSERT SUCCESS!")
        conn.close()
    except Exception as e:
        print(f"INSERT FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_insert()
