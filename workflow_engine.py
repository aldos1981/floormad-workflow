import json
import logging
import re
from typing import Dict, Any, List, Optional
import google.generativeai as genai

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WorkflowEngine:
    def __init__(self, workflow_data: Dict[str, Any], context: Dict[str, Any] = None, api_key: str = None):
        """
        Initialize the engine with Drawflow JSON data and initial context.
        :param workflow_data: The 'drawflow' JSON object exported from the frontend.
        :param context: Initial data (e.g., from a Webhook or Cron).
        :param api_key: Google API Key for AI operations.
        """
        self.workflow_data = workflow_data
        self.context = context or {}
        self.api_key = api_key
        self.nodes = self._extract_nodes()
        self.execution_log = []

        if self.api_key:
            genai.configure(api_key=self.api_key)

    def _extract_nodes(self) -> Dict[str, Any]:
        """
        Extracts a flat dictionary of nodes from the nested Drawflow structure.
        """
        try:
            # Drawflow structure: { "drawflow": { "Home": { "data": { ... nodes ... } } } }
            # Or sometimes directly the 'Home' data if pre-processed.
            if "drawflow" in self.workflow_data:
                return self.workflow_data["drawflow"]["Home"]["data"]
            elif "Home" in self.workflow_data:
                 return self.workflow_data["Home"]["data"]
            else:
                 # Fallback if it's already the inner data objects
                 return self.workflow_data
        except KeyError:
            logger.error("Invalid Drawflow JSON structure")
            return {}

    def find_trigger_node(self) -> Optional[str]:
        """Finds the ID of the Trigger node."""
        for node_id, node in self.nodes.items():
            if node.get("name") == "TRIGGER":
                return node_id
        return None

    def get_next_nodes(self, node_id: str) -> List[str]:
        """Returns a list of node IDs connected to the output of the given node."""
        node = self.nodes.get(node_id)
        if not node:
            return []
        
        next_ids = []
        outputs = node.get("outputs", {})
        for output_name, output_data in outputs.items():
            connections = output_data.get("connections", [])
            for conn in connections:
                next_ids.append(conn["node"])
        return next_ids

    def run(self):
        """
        Main execution loop. Starts at Trigger and traverses the graph.
        """
        logger.info("Starting Workflow Execution")
        start_node_id = self.find_trigger_node()
        
        if not start_node_id:
            logger.error("No Trigger Node found")
            return {"status": "error", "message": "No Trigger Node found"}

        # Queue for execution: [(node_id, input_data)]
        # Initial input check - if context provided, use it.
        queue = [(start_node_id, self.context)]
        
        results = {}

        while queue:
            current_node_id, input_data = queue.pop(0) # BFS traversal
            node = self.nodes.get(current_node_id)
            
            if not node:
                continue

            logger.info(f"Executing Node: {node.get('name')} ({current_node_id})")
            
            # Execute Node Logic
            try:
                output_data = self.execute_node(node, input_data)
                results[current_node_id] = output_data
                self.execution_log.append({
                    "node_id": current_node_id,
                    "type": node.get("name"),
                    "status": "success",
                    "output": str(output_data)[:200] + "..." if output_data else "None"
                })
            except Exception as e:
                logger.error(f"Error executing node {current_node_id}: {e}")
                self.execution_log.append({
                    "node_id": current_node_id,
                    "type": node.get("name"),
                    "status": "error",
                    "error": str(e)
                })
                # Decide: Continue or Stop? For now, stop on error.
                return {"status": "failed", "log": self.execution_log}

            # Propagate to next nodes
            next_nodes = self.get_next_nodes(current_node_id)
            for next_id in next_nodes:
                # Pass output_data as input to next node
                # Merge with existing context if robust, but for now linear pass
                queue.append((next_id, output_data))

        return {"status": "completed", "log": self.execution_log, "final_context": results}

    def execute_node(self, node: Dict[str, Any], input_data: Any) -> Any:
        """
        Dispatches execution to specific handlers based on node type.
        """
        node_type = node.get("name")
        config = node.get("data", {}).get("config", {})

        if node_type == "TRIGGER":
            return self.execute_trigger(config, input_data)
        elif node_type == "AI_COMPLETION":
            return self.execute_ai(config, input_data)
        elif node_type == "GOOGLE_SHEET":
            # For now, just pass through or log
            return input_data 
        elif node_type == "SEND_EMAIL":
            return self.execute_email(config, input_data)
        else:
            # Pass-through for unknown nodes
            return input_data

    def execute_trigger(self, config: Dict[str, Any], input_data: Any) -> Any:
        """
        Trigger node usually just passes context or sets initial state.
        """
        logger.info(f"Trigger Config: {config}")
        # If manual trigger, input_data might be empty.
        # Normalize Data
        return {
            "source": "trigger",
            "data": input_data,
            "timestamp": "now"
        }

    def execute_ai(self, config: Dict[str, Any], input_data: Any) -> Any:
        """
        Calls Google Gemini API.
        """
        if not self.api_key:
            raise ValueError("No Google API Key provided for AI Node")

        system_prompt = config.get("system_prompt", "You are a helpful assistant.")
        user_prompt_template = config.get("user_prompt", "") # Optional additional user prompt
        schema_instruction = config.get("schema_instruction", "")
        html_template = config.get("html_template", "")
        temperature = float(config.get("temperature", 0.3))

        # Construct Prompt
        # We start with the input_data (context from previous nodes)
        context_str = json.dumps(input_data, indent=2)

        full_prompt = f"""
        {system_prompt}

        DATA CONTEXT:
        {context_str}

        INSTRUCTIONS:
        {schema_instruction}
        
        IMPORTANT: Return ONLY valid JSON matching the schema instruction. 
        Do not include markdown formatting like ```json ... ```.
        """
        
        logger.info("Calling Gemini API...")
        model = genai.GenerativeModel('gemini-2.0-flash') # Using latest efficient model
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=temperature,
                response_mime_type="application/json"
            )
        )
        
        try:
            ai_output = json.loads(response.text)
        except json.JSONDecodeError:
            # Fallback cleanup
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            try:
                ai_output = json.loads(clean_text)
            except:
                ai_output = {"raw_output": response.text, "error": "Failed to parse JSON"}

        # Apply HTML Template if exists
        if html_template and isinstance(ai_output, dict):
            # Simple variable substitution
            # e.g. {{greeting}} -> ai_output['greeting']
            rendered_html = html_template
            for key, val in ai_output.items():
                if isinstance(val, str):
                   rendered_html = rendered_html.replace(f"{{{{{key}}}}}", val)
            
            ai_output["_html_rendered"] = rendered_html

        return ai_output

    def execute_email(self, config: Dict[str, Any], input_data: Any) -> Any:
        # Mock email execution
        logger.info(f"Sending Email with data: {input_data}")
        return {"status": "sent", "recipient": config.get("email_to")}

