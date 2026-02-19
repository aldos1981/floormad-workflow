"""
Pipedrive CRM Client
Handles search, create, and update operations for Person contacts.
Uses Pipedrive API v1 with API token authentication.
"""

import requests
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class PipedriveClient:
    BASE_URL = "https://api.pipedrive.com/v1"

    def __init__(self, api_token: str):
        if not api_token:
            raise ValueError("Pipedrive API token is required")
        self.api_token = api_token

    def _request(self, method: str, endpoint: str, params: dict = None, json_data: dict = None) -> Dict[str, Any]:
        """Make an authenticated request to the Pipedrive API."""
        url = f"{self.BASE_URL}/{endpoint}"
        
        # API token goes as query parameter
        if params is None:
            params = {}
        params["api_token"] = self.api_token

        try:
            response = requests.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                timeout=30
            )
            
            result = response.json()
            
            if response.status_code >= 400:
                error_msg = result.get("error", result.get("error_info", f"HTTP {response.status_code}"))
                logger.error(f"Pipedrive API error: {error_msg}")
                return {"success": False, "error": error_msg}
            
            return result

        except requests.exceptions.ConnectionError as e:
            logger.error(f"Pipedrive connection error: {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "Request timeout"}
        except Exception as e:
            logger.error(f"Pipedrive request error: {e}")
            return {"success": False, "error": str(e)}

    def search_person(self, email: str) -> Optional[Dict]:
        """
        Search for a person by email.
        Returns the person data if found, None otherwise.
        """
        if not email:
            return None

        result = self._request("GET", "persons/search", params={
            "term": email,
            "fields": "email",
            "limit": 1
        })

        if not result.get("success", False):
            logger.warning(f"Pipedrive search failed: {result.get('error', 'unknown')}")
            return None

        items = result.get("data", {}).get("items", [])
        if items:
            person = items[0].get("item", {})
            logger.info(f"Pipedrive: Found person ID {person.get('id')} for email {email}")
            return person

        logger.info(f"Pipedrive: No person found for email {email}")
        return None

    def create_person(self, name: str, email: str = None, phone: str = None, 
                      notes: str = None, postal_address: str = None,
                      custom_fields: Dict = None) -> Dict[str, Any]:
        """Create a new person in Pipedrive."""
        data = {"name": name}

        if email:
            data["email"] = [{"value": email, "primary": True, "label": "work"}]
        if phone:
            data["phone"] = [{"value": phone, "primary": True, "label": "work"}]
        
        # Standard Pipedrive fields
        if postal_address:
            # Pipedrive uses a special address format, but postal_address works as a custom field
            # Try the standard org address field first
            data["postal_address"] = postal_address
        
        # Custom fields (key = Pipedrive field hash or name)
        if custom_fields:
            data.update(custom_fields)

        result = self._request("POST", "persons", json_data=data)

        if result.get("success"):
            person = result.get("data", {})
            logger.info(f"Pipedrive: Created person ID {person.get('id')} - {name}")
            
            # Add note if provided
            if notes and person.get("id"):
                self._add_note(person["id"], notes)
            
            return {
                "success": True,
                "action": "created",
                "person_id": person.get("id"),
                "name": person.get("name"),
                "data": person
            }
        else:
            return {
                "success": False,
                "action": "create_failed",
                "error": result.get("error", "Unknown error")
            }

    def update_person(self, person_id: int, name: str = None, email: str = None,
                      phone: str = None, notes: str = None, postal_address: str = None,
                      custom_fields: Dict = None) -> Dict[str, Any]:
        """Update an existing person in Pipedrive."""
        data = {}

        if name:
            data["name"] = name
        if email:
            data["email"] = [{"value": email, "primary": True, "label": "work"}]
        if phone:
            data["phone"] = [{"value": phone, "primary": True, "label": "work"}]
        if postal_address:
            data["postal_address"] = postal_address
        if custom_fields:
            data.update(custom_fields)

        if not data and not notes:
            return {"success": True, "action": "no_update_needed", "person_id": person_id}

        result = self._request("PUT", f"persons/{person_id}", json_data=data)

        if result.get("success"):
            person = result.get("data", {})
            logger.info(f"Pipedrive: Updated person ID {person_id}")
            
            # Update note if provided
            if notes:
                self._add_note(person_id, notes)
            
            return {
                "success": True,
                "action": "updated",
                "person_id": person_id,
                "name": person.get("name"),
                "data": person
            }
        else:
            return {
                "success": False,
                "action": "update_failed",
                "error": result.get("error", "Unknown error")
            }

    def _add_note(self, person_id: int, content: str) -> Dict[str, Any]:
        """Add a note to a person."""
        result = self._request("POST", "notes", json_data={
            "content": content,
            "person_id": person_id
        })
        if result.get("success"):
            logger.info(f"Pipedrive: Added note to person {person_id}")
        return result

    def sync_person(self, name: str, email: str, phone: str = None,
                    notes: str = None, postal_address: str = None,
                    custom_fields: Dict = None) -> Dict[str, Any]:
        """
        All-in-one: Search by email, create if not found, update if exists.
        This replicates the N8N flow: Search → If → Create/Update
        """
        if not email:
            return {"success": False, "error": "Email is required for sync"}
        if not name:
            return {"success": False, "error": "Name is required for sync"}

        # Step 1: Search
        existing = self.search_person(email)

        if existing:
            # Step 2a: Update existing person
            person_id = existing.get("id")
            return self.update_person(
                person_id=person_id,
                name=name,
                email=email,
                phone=phone,
                notes=notes,
                postal_address=postal_address,
                custom_fields=custom_fields
            )
        else:
            # Step 2b: Create new person
            return self.create_person(
                name=name,
                email=email,
                phone=phone,
                notes=notes,
                postal_address=postal_address,
                custom_fields=custom_fields
            )
