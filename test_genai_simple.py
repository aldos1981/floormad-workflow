
import google.generativeai as genai
import os
import sys

api_key = "AIzaSyCcUSjnkXMxMhSiYsFubvudkxFKTcDFUmw"

print(f"Testing Gemini API with key: {api_key[:10]}...")

try:
    genai.configure(api_key=api_key)
    
    print("Listing available models:")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name}")
    except Exception as e:
        print(f"Error listing models: {e}")
    
    print("\nAttempting generation with gemini-2.0-flash...")
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content("Hello")
        print("SUCCESS with gemini-2.0-flash!")
        print(response.text)
    except Exception as e:
        print(f"Failed with gemini-2.0-flash: {e}")
        
    print("\nAttempting generation with gemini-1.5-flash...")
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content("Hello")
        print("SUCCESS with gemini-1.5-flash!")
        print(response.text)
    except Exception as e:
        print(f"Failed with gemini-1.5-flash: {e}")

except Exception as e:
    print("FATAL FAILURE")
    print(e)
    import traceback
    traceback.print_exc()
