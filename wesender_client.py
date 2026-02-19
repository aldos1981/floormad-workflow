import requests
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class WeSenderClient:
    """
    Client for WaSenderAPI (WhatsApp).
    Docs: https://wasenderapi.com
    
    Endpoint: POST https://wasenderapi.com/api/send-message
    Auth: Bearer token
    Payload: { "to": "+1234567890", "text": "Hello!" }
    """
    
    DEFAULT_API_URL = "https://wasenderapi.com/api/send-message"

    def __init__(self, api_key: str, api_url: Optional[str] = None):
        self.api_key = api_key
        self.api_url = api_url.rstrip('/') if api_url else self.DEFAULT_API_URL
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def send_message(self, phone: str, message: str) -> Dict[str, Any]:
        """
        Send a WhatsApp text message.
        
        Args:
            phone: Recipient phone number with international code (e.g. +393331234567).
            message: The text message content.
            
        Returns:
            Dict with success status and API response data.
        """
        payload = {
            "to": phone,
            "text": message
        }
        
        try:
            logger.info(f"Sending WhatsApp message to {phone} via WaSenderAPI...")
            response = requests.post(
                self.api_url, 
                json=payload, 
                headers=self.headers, 
                timeout=15
            )
            response.raise_for_status()
            
            return {
                "success": True, 
                "data": response.json() if response.content else {},
                "status_code": response.status_code
            }
            
        except requests.RequestException as e:
            logger.error(f"WaSenderAPI Error: {str(e)}")
            error_details = {"error": str(e)}
            if hasattr(e, 'response') and e.response is not None:
                error_details["status_code"] = e.response.status_code
                try:
                    error_details["response_text"] = e.response.text
                except:
                    pass
            return {"success": False, "details": error_details}
