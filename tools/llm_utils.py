import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Support both naming conventions
API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
client = None

if API_KEY:
    client = genai.Client(api_key=API_KEY)

def call_llm(system_prompt: str, user_prompt: str, model_name: str = "gemini-2.0-flash") -> str:
    """
    Calls the LLM with a system and user prompt.
    Returns the text response.
    """
    if not client:
        print("Error: GEMINI_API_KEY not found in .env")
        return "Error: API Key missing. Please add GEMINI_API_KEY to .env file."

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt
            )
        )
        return response.text
    except Exception as e:
        return f"Error calling LLM: {str(e)}"

# Alias for compatibility
def generate_text(system_prompt: str, user_prompt: str, model_name: str = "gemini-2.0-flash") -> str:
    return call_llm(system_prompt, user_prompt, model_name)

def generate_json(system_prompt: str, user_prompt: str, model_name: str = "gemini-2.0-flash") -> dict:
    """
    Calls the LLM and expects a JSON response.
    """
    # Force JSON mode in prompt if not present
    if "json" not in system_prompt.lower() and "json" not in user_prompt.lower():
        system_prompt += "\nRespond in JSON format."
        
    response_text = call_llm(system_prompt, user_prompt, model_name)
    
    # Strip markdown code blocks if present
    response_text = response_text.replace("```json", "").replace("```", "").strip()
    
    try:
        # Handle cases where text is before/after JSON
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start != -1 and end != -1:
            response_text = response_text[start:end]
            
        return json.loads(response_text)
    except json.JSONDecodeError:
        print(f"Failed to parse JSON from LLM response: {response_text}")
        return {}
