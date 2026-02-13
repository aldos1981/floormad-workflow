import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)

def call_llm(system_prompt: str, user_prompt: str, model_name: str = "gemini-2.0-flash") -> str:
    """
    Calls the LLM with a system and user prompt.
    Returns the text response.
    """
    if not API_KEY:
        return "Error: GOOGLE_API_KEY not found in .env"

    try:
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt
        )
        response = model.generate_content(user_prompt)
        return response.text
    except Exception as e:
        return f"Error calling LLM: {str(e)}"

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
        return json.loads(response_text)
    except json.JSONDecodeError:
        print(f"Failed to parse JSON from LLM response: {response_text}")
        return {}
