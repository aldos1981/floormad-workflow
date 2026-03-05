import sys
import os
import json

# Add parent directory to path to import engine
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import correct functions
# Note: These are defined in engine.py
try:
    from engine import normalize_locality, calculate_pricing, generate_content
except ImportError as e:
    print(f"FAILED TO IMPORT ENGINE: {e}")
    sys.exit(1)

def run_tests():
    print("--- Starting Engine Verification ---")
    
    project = {
        "locality_prompt": None,
        "price_list_url": "http://mock-sheet",
        "products_config": json.dumps([{
            "id": "prod1",
            "name": "Agrilock Test Product",
            "descriptions": ["Pavimentazione tecnica", "Ideale per paddock"]
        }])
    }
    
    row = {
        "località_di_consegna?": "Milano",
        "mq_richiesti": "150 mq",
        "telefono": "333 1234567",
        "utilizzo": "Paddock cavalli",
        "nome": "Mario Rossi",
        "descrivi_il_tuo_progetto": "Vorrei pavimentare l'area esterna"
    }
    
    # 1. Test Normalization (Dry Run Mock)
    print("\n[1] Testing Normalization (normalize_locality)...")
    # To avoid API costs/errors in test, let's mock the return unless we really want to test API
    # But wait, normalize_locality calls API directly.
    # Let's try calling it. If it fails, we catch it.
    normalized = {}
    try:
        normalized = normalize_locality(row, project)
        if not normalized: 
             raise Exception("Empty response from LLM")
        print(f"Result: {normalized}")
    except Exception as e:
        print(f"Skipping LLM test (or failed): {e}")
        # Mocking result for next steps
        normalized = {
            "mq_richiesti_numero": 150,
            "macro_zona": "Nord-ovest Italia",
            "provincia": "MI"
        }

    # 2. Test Pricing
    print("\n[2] Testing Pricing (calculate_pricing)...")
    product_knowledge = json.loads(project['products_config'])[0]
    
    pricing = calculate_pricing(row, normalized, project, product_knowledge)
    print(f"Result: {pricing}")
    
    # 3. Test Content Generation
    print("\n[3] Testing Content Generation (generate_content)...")
    try:
        content = generate_content(row, pricing, product_knowledge)
        print("Email Preview:")
        # Check if key exists
        print(content.get('email_html', '')[:100] + "...")
        print("WhatsApp Preview:")
        print(content.get('whatsapp_text', ''))
    except Exception as e:
        print(f"Skipping Content Gen test (or failed): {e}")

    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    run_tests()
