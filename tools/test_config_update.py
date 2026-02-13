import requests
import json
import uuid

BASE_URL = "http://127.0.0.1:8000"

# Mock Data
project_payload = {
    "name": "Config Test Project",
    "google_sheet_id": "test_sheet_id",
    "service_account_json": "{}"
}

products_config = [
    {
        "id": str(uuid.uuid4()),
        "name": "Test Product A",
        "descriptions": ["Feature 1", "Feature 2"]
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Test Product B",
        "descriptions": ["Spec X", "Spec Y"]
    }
]

def test_config_workflow():
    # 1. Create Project
    print("Creating project...")
    res = requests.post(f"{BASE_URL}/api/projects", json=project_payload)
    if res.status_code != 200:
        print(f"Failed to create project: {res.text}")
        return
    
    project_id = res.json()["id"]
    print(f"Project created: {project_id}")

    # 2. Update Project with Products
    print("Updating project config...")
    update_payload = {
        "products_config": products_config,
        "cron_expression": "*/30 * * * *"
    }
    res = requests.put(f"{BASE_URL}/api/projects/{project_id}", json=update_payload)
    if res.status_code != 200:
        print(f"Failed to update project: {res.text}")
        return
    print("Project updated.")

    # 3. Verify Retrieval
    print("Retrieving project...")
    res = requests.get(f"{BASE_URL}/api/projects/{project_id}")
    if res.status_code != 200:
        print(f"Failed to get project: {res.text}")
        return
    
    data = res.json()
    saved_config = json.loads(data["products_config"])
    
    print("\n--- Verification ---")
    print(f"Cron: {data['cron_expression']} (Expected: */30 * * * *)")
    print(f"Products Count: {len(saved_config)} (Expected: 2)")
    print(f"Product 1 Name: {saved_config[0]['name']} (Expected: Test Product A)")
    
    if len(saved_config) == 2 and saved_config[0]['name'] == "Test Product A":
        print("\nSUCCESS: Configuration saved and retrieved correctly!")
    else:
        print("\nFAILURE: Data mismatch.")

    # Cleanup
    requests.delete(f"{BASE_URL}/api/projects/{project_id}")

if __name__ == "__main__":
    try:
        test_config_workflow()
    except Exception as e:
        print(f"Test failed (is server running?): {e}")
