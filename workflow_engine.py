import json
import logging
import re
from typing import Dict, Any, List, Optional
# New SDK imports will be handled locally or lazily to avoid circular issues if any,
# but we can import standard types here if needed.
# from google import genai 

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
        self.client = None # Lazy init for Google GenAI Client

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

    def get_next_nodes_by_output(self, node_id: str) -> Dict[str, List[str]]:
        """Returns connections grouped by output port name (e.g., output_1, output_2).
        Used for conditional branching in CONDITION nodes."""
        node = self.nodes.get(node_id)
        if not node:
            return {}
        
        result = {}
        outputs = node.get("outputs", {})
        for output_name, output_data in outputs.items():
            connections = output_data.get("connections", [])
            result[output_name] = [conn["node"] for conn in connections]
        return result

    async def run(self, status_callback=None):
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
        
        # 1. OPTIMIZATION: Filter Reachable Nodes from Trigger
        reachable_ids = self._get_reachable_nodes(start_node_id)
        logger.info(f"Reachable Nodes: {len(reachable_ids)} / {len(self.nodes)}")
        
        queue = [(start_node_id, self.context)]
        
        results = {}  # node_id -> output_data
        accumulated_context = {}  # FLAT dict of ALL collected JSON fields

        while queue:
            current_node_id, input_data = queue.pop(0) # BFS traversal
            node = self.nodes.get(current_node_id)
            
            if not node:
                continue

            # Notify Start
            if status_callback:
                await status_callback(current_node_id, "running", f"Starting {node.get('name')}...")

            # 2. FEATURE: Skip Disabled Nodes
            config = node.get("data", {}).get("config", {})
            if config.get("disabled"):
                logger.info(f"Skipping Disabled Node: {node.get('name')} ({current_node_id})")
                self.execution_log.append({
                     "node_id": current_node_id,
                     "type": node.get("name"),
                     "status": "skipped",
                     "message": "Node is disabled"
                })
                if status_callback:
                    await status_callback(current_node_id, "skipped", "Node disabled")
                continue
            
            # 3. SAFETY: Skip Unreachable
            if current_node_id not in reachable_ids:
                 continue

            logger.info(f"Executing Node: {node.get('name')} ({current_node_id})")
            
            # Build merged context for node execution
            merged_context = {**results, **accumulated_context}
            
            # Execute Node Logic
            try:
                output_data = self.execute_node(node, input_data, merged_context)
                results[current_node_id] = output_data
                
                # === FLAT MERGE: Expand dict fields into accumulated_context ===
                # IMPORTANT: Only store SIMPLE values to avoid circular references
                node_name = config.get("node_name", "")
                output_var = config.get("output_var", "")
                
                if isinstance(output_data, dict):
                    # Flat-merge all dict keys into context (only non-dict values to prevent recursion)
                    for key, val in output_data.items():
                        if key.startswith('_'):  # skip internal keys
                            continue
                        # Store simple values directly  
                        if isinstance(val, (str, int, float, bool)) or val is None:
                            accumulated_context[key] = val
                        elif isinstance(val, (list, dict)):
                            # Deep copy to prevent circular refs
                            try:
                                accumulated_context[key] = json.loads(json.dumps(val, default=str))
                            except:
                                accumulated_context[key] = str(val)
                    
                    # Store a serializable summary under node_name for {{node_name.field}} access
                    if node_name:
                        try:
                            accumulated_context[node_name] = json.loads(json.dumps(output_data, default=str))
                        except:
                            accumulated_context[node_name] = str(output_data)
                    if output_var and output_var != node_name:
                        try:
                            accumulated_context[output_var] = json.loads(json.dumps(output_data, default=str))
                        except:
                            accumulated_context[output_var] = str(output_data)
                            
                elif isinstance(output_data, str) and output_data:
                    # String outputs: store under output_var or node_name
                    if output_var:
                        accumulated_context[output_var] = output_data
                    elif node_name:
                        accumulated_context[node_name] = output_data
                    # Also store as 'content' if no other 'content' exists yet
                    if 'content' not in accumulated_context:
                        accumulated_context['content'] = output_data
                
                # Build context snapshot for this node (user-visible fields only)
                ctx_keys = [k for k in accumulated_context.keys() if not k.isdigit()]
                
                self.execution_log.append({
                    "node_id": current_node_id,
                    "type": node.get("name"),
                    "node_name": node_name or output_var or "",
                    "status": "success",
                    "output": str(output_data)[:200] + ("..." if output_data and len(str(output_data)) > 200 else ""),
                    "context_keys": ctx_keys
                })
                if status_callback:
                    await status_callback(current_node_id, "completed", "Success")

            except Exception as e:
                logger.error(f"Error executing node {current_node_id}: {e}")
                self.execution_log.append({
                    "node_id": current_node_id,
                    "type": node.get("name"),
                    "status": "error",
                    "error": str(e)
                })
                if status_callback:
                    await status_callback(current_node_id, "error", str(e))
                return {"status": "failed", "log": self.execution_log, "final_context": accumulated_context}

            # Propagate to next nodes — pass accumulated context as input
            node_type = node.get("name")
            
            if node_type == "CONDITION" and isinstance(output_data, dict) and "_branch" in output_data:
                # CONDITIONAL ROUTING: only follow the matching output branch
                branch = output_data["_branch"]  # "output_1" (TRUE) or "output_2" (FALSE)
                outputs_by_port = self.get_next_nodes_by_output(current_node_id)
                branch_nodes = outputs_by_port.get(branch, [])
                other_branch = "output_2" if branch == "output_1" else "output_1"
                skipped_nodes = outputs_by_port.get(other_branch, [])
                
                logger.info(f"[CONDITION] Branch '{branch}' → executing {len(branch_nodes)} nodes, skipping {len(skipped_nodes)} nodes")
                
                for next_id in branch_nodes:
                    queue.append((next_id, accumulated_context))
                
                # Mark skipped branch nodes
                for skip_id in skipped_nodes:
                    skip_node = self.nodes.get(skip_id)
                    if skip_node and status_callback:
                        await status_callback(skip_id, "skipped", f"Condition was {output_data.get('result', '?')}")
            else:
                # Normal flow: send to all connected outputs
                next_nodes = self.get_next_nodes(current_node_id)
                for next_id in next_nodes:
                    queue.append((next_id, accumulated_context))

        return {"status": "completed", "log": self.execution_log, "final_context": accumulated_context}

    def execute_node(self, node: Dict[str, Any], input_data: Any, execution_context: Dict[str, Any] = None) -> Any:
        """
        Dispatches execution to specific handlers based on node type.
        """
        node_type = node.get("name")
        config = node.get("data", {}).get("config", {})

        if node_type == "TRIGGER":
            return self.execute_trigger(config, input_data)
        elif node_type == "AI_COMPLETION":
            return self.execute_ai(config, input_data, execution_context)
        elif node_type == "GOOGLE_SHEET":
            return self.execute_google_sheet(config, input_data)
        elif node_type == "SEND_EMAIL":
            return self.execute_email(config, input_data, execution_context)
        elif node_type == "SEND_WHATSAPP":
            return self.execute_whatsapp(config, input_data, execution_context)
        elif node_type == "HTML_TEMPLATE":
            return self.execute_html_template(config, input_data, execution_context)
        elif node_type == "KNOWLEDGE":
            return self.execute_knowledge(config, input_data)
        elif node_type == "HTML_PREVIEW":
            # HTML_PREVIEW is a display-only node, pass through the source variable
            source_var = config.get("source_var", "html_content")
            if execution_context and source_var in execution_context:
                return execution_context[source_var]
            return input_data
        elif node_type == "PIPEDRIVE":
            return self.execute_pipedrive(config, input_data, execution_context)
        elif node_type == "CONDITION":
            return self.execute_condition(config, input_data, execution_context)
        elif node_type == "DELAY":
            return self.execute_delay(config, input_data)
        elif node_type == "HTTP_REQUEST":
            return self.execute_http_request(config, input_data, execution_context)
        elif node_type == "NOTE":
            # NOTE is display-only, just pass through
            return input_data
        elif node_type == "FILTER":
            return self.execute_filter(config, input_data, execution_context)
        elif node_type == "LOOP":
            # LOOP is handled specially in the run() method, pass through here
            return input_data
        else:
            # Pass-through for unknown nodes
            return input_data

    def _get_reachable_nodes(self, start_id: str) -> set:
        """
        BFS Traversal to find all nodes connected to Trigger.
        """
        visited = set()
        queue = [start_id]
        
        while queue:
            node_id = queue.pop(0)
            if node_id in visited:
                continue
            
            visited.add(node_id)
            
            # Get next nodes
            next_nodes = self.get_next_nodes(node_id)
            for next_id in next_nodes:
                if next_id not in visited:
                    queue.append(next_id)
                    
        return visited

    def execute_google_sheet(self, config: Dict[str, Any], input_data: Any) -> Any:
        """
        Pure data reader: fetches rows from Google Sheet, applies filter,
        runs post-process updates, and returns raw row data.
        No business logic — all intelligence lives in workflow AI nodes.
        """
        logger.info("Executing Google Sheet Node")
        
        project = self.context.get('project')
        if not project:
            return {"error": "No project context found"}

        from engine import get_google_sheets_service, fetch_pending_requests, update_sheet_cell, get_next_counter

        try:
            # 1. Connect to Google Sheets
            service = get_google_sheets_service(
                service_account_json=project.get('service_account_json'),
                oauth_creds=project.get('oauth_credentials'),
                project_id=project.get('id')
            )
            
            # 2. Override project sheet_id / range with node config if set
            effective_project = dict(project)
            if config.get('sheet_id'):
                effective_project['google_sheet_id'] = config['sheet_id']
                logger.info(f"Using node-config sheet_id: {config['sheet_id']}")
            if config.get('sheet_range'):
                effective_project['google_sheet_range'] = config['sheet_range']
                logger.info(f"Using node-config sheet_range: {config['sheet_range']}")
            
            # 3. Extract Filter Config from Node Config
            filter_config = {}
            if config.get('filter_column'):
                filter_config['column'] = config.get('filter_column')
            if 'filter_value' in config:
                filter_config['value'] = config.get('filter_value')
            
            logger.info(f"Sheet ID: {effective_project.get('google_sheet_id')}, Range: {effective_project.get('google_sheet_range')}, Filter: {filter_config}")
            
            # 4. Fetch rows
            rows = fetch_pending_requests(effective_project, service, filter_config)
            
            if not rows:
                logger.info("No pending rows found.")
                return {"_status": "no_data"}

            # VALIDATION: Skip rows where all important fields are empty
            # Common contact fields that should have real data
            important_fields = ['nome', 'name', 'email', 'telefono', 'phone', 'cognome', 'surname', 'azienda', 'company', 'indirizzo', 'address']
            
            valid_rows = []
            for r in rows:
                # Check if at least ONE important field has real content
                has_data = False
                for field in important_fields:
                    val = r.get(field, '')
                    if val and str(val).strip() and str(val).strip() not in ['', 'None', 'null', 'undefined']:
                        has_data = True
                        break
                
                # Fallback: check if ANY non-internal field has content (excluding status columns)
                if not has_data:
                    skip_keys = {'_row_number', 'stato', 'status', 'data', 'date', 'timestamp', 'n_preventivo', 'numero'}
                    for k, v in r.items():
                        if k.startswith('_') or k.lower() in skip_keys:
                            continue
                        if v and str(v).strip() and len(str(v).strip()) > 1:
                            has_data = True
                            break
                
                if has_data:
                    valid_rows.append(r)
                else:
                    logger.info(f"Skipping empty row #{r.get('_row_number')} — no meaningful data")
            
            if not valid_rows:
                logger.info("All rows were empty/invalid. No data to process.")
                return {"_status": "no_data"}
            
            rows = valid_rows

            # Process the FIRST pending row
            row = rows[0]
            logger.info(f"Processing Row #{row.get('_row_number')}: {list(row.keys())}")

            # 5. Post-process: Update row and auto-counter
            sheet_id = effective_project.get('google_sheet_id')
            sheet_range = effective_project.get('google_sheet_range', 'Foglio1!A:AZ')
            row_num = row.get('_row_number')
            
            # IMPORTANT: Get raw headers from the sheet (including empty columns)
            # to ensure correct column-letter mapping for writes.
            # row.keys() skips empty headers, causing column index mismatch.
            try:
                sheet_name = sheet_range.split('!')[0] if '!' in sheet_range else 'Foglio1'
                hdr_result = service.values().get(
                    spreadsheetId=sheet_id,
                    range=f"{sheet_name}!1:1"
                ).execute()
                raw_headers = [str(h).strip() for h in hdr_result.get('values', [[]])[0]]
                logger.info(f"[POST-PROCESS] Raw headers ({len(raw_headers)}): {raw_headers}")
            except Exception as hdr_err:
                logger.warning(f"[POST-PROCESS] Could not read raw headers: {hdr_err}, falling back to row keys")
                raw_headers = [k for k in row.keys() if not k.startswith('_')]
            
            logger.info(f"[POST-PROCESS] config keys: {list(config.keys())}")
            
            # 5a. Auto-Counter
            if config.get('counter_column'):
                counter_col = config['counter_column']
                logger.info(f"[COUNTER] Getting next value for column '{counter_col}'...")
                next_num = get_next_counter(service, sheet_id, sheet_range, counter_col, headers=raw_headers)
                
                logger.info(f"[COUNTER] Writing {next_num} to row {row_num}, column '{counter_col}'...")
                update_sheet_cell(service, sheet_id, sheet_range, row_num, counter_col, next_num, headers=raw_headers)
                
                row[counter_col] = str(next_num)
                logger.info(f"Auto-counter: {counter_col} = {next_num}")
            
            # 5b. Update Status Column
            if config.get('update_column') and config.get('update_value'):
                update_col = config['update_column']
                update_val = config['update_value']
                
                logger.info(f"[UPDATE] Writing '{update_val}' to row {row_num}, column '{update_col}'...")
                update_sheet_cell(service, sheet_id, sheet_range, row_num, update_col, update_val, headers=raw_headers)
                
                row[update_col] = update_val
                logger.info(f"Post-process update: {update_col} = {update_val}")
            
            # 6. Return raw row data (flat dict — all columns from the sheet)
            # Remove internal keys for clean output
            output = {k: v for k, v in row.items() if not k.startswith('_')}
            output['_row_number'] = row_num
            logger.info(f"Sheet node output keys: {list(output.keys())}")
            return output

        except Exception as e:
            logger.error(f"Google Sheets Node Error: {e}")
            return {"error": str(e)}

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

    def execute_ai(self, config: Dict[str, Any], input_data: Any, execution_context: Dict[str, Any] = None) -> Any:
        """
        Calls Google Gemini API.
        """
        from google import genai
        from google.genai import types

        if not self.api_key:
            raise ValueError("No Google API Key provided for AI Node")
            
        # Instantiate Client if not present
        if not hasattr(self, 'client') or not self.client:
             self.client = genai.Client(api_key=self.api_key)

        # Resolve Variables in Prompts
        system_prompt = self._resolve_variables(config.get("system_prompt", "You are a helpful assistant."), execution_context)
        user_prompt_template = self._resolve_variables(config.get("user_prompt", ""), execution_context) 
        
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

        HTML TEMPLATE (For Reference):
        {html_template}
        
        IMPORTANT: Return ONLY valid JSON matching the schema instruction. 
        Do not include format markers like ```json.
        """
        
        logger.info("Calling Gemini API...")
        model_name = config.get('model', 'gemini-2.5-flash')
        # Map specific UI values to API models if needed, or use directly
        logger.info(f"Calling Gemini API with model: {model_name}")
        
        response = self.client.models.generate_content(
            model=model_name,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=temperature,
                response_mime_type="application/json"
            )
        )
        
        try:
            # 1. Clean Markdown Code Blocks
            clean_text = response.text
            if "```" in clean_text:
                # Regex to extract content between ```json ... ``` or just ``` ... ```
                match = re.search(r"```(?:json)?\s*(.*?)```", clean_text, re.DOTALL)
                if match:
                    clean_text = match.group(1).strip()
            
            # 2. Attempt Parse
            ai_output = json.loads(clean_text)
            
        except json.JSONDecodeError:
             # 3. Fallback: Try to find start/end braces if there's extra text
            try:
                match = re.search(r"(\{.*\})", response.text, re.DOTALL)
                if match:
                    ai_output = json.loads(match.group(1))
                else:
                    raise ValueError("No JSON object found")
            except Exception as e:
                logger.error(f"Failed to parse AI output: {e}\nRaw: {response.text}")
                ai_output = {"raw_output": response.text, "error": f"Failed to parse JSON: {str(e)}"}

        
        # Apply HTML Template if exists
        if html_template and isinstance(ai_output, dict):
            # Simple variable substitution: {{key}} -> ai_output[key]
            rendered_html = html_template
            
            # Replace known content keys first
            if "content" in ai_output:
                 rendered_html = rendered_html.replace("{{content}}", ai_output["content"])
            
            # Replace all other keys
            for key, val in ai_output.items():
                if isinstance(val, str):
                   rendered_html = rendered_html.replace(f"{{{{{key}}}}}", val)
            
            ai_output["_html_rendered"] = rendered_html
        elif isinstance(ai_output, dict) and "content" in ai_output:
            ai_output["_html_rendered"] = ai_output["content"]

        return ai_output


    # --- HTML_TEMPLATE NODE ---
    def execute_html_template(self, config: Dict[str, Any], input_data: Any, execution_context: Dict[str, Any] = None) -> Any:
        """
        HTML Template node: holds static/dynamic text or HTML content.
        Resolves {{variables}} from execution context (previous node outputs).
        The output is stored under the node's output_var for subsequent nodes.
        """
        logger.info("Executing HTML Template Node")
        
        # Get the template content from config
        template = config.get("html_template", "") or config.get("template", "")
        output_var = config.get("output_var", "html_content")
        
        # Resolve variables in the template using execution context
        resolved = self._resolve_variables(template, execution_context) if execution_context else template
        
        logger.info(f"HTML Template resolved ({len(resolved)} chars), output_var: {output_var}")
        
        return resolved

    # --- KNOWLEDGE NODE ---
    def execute_knowledge(self, config: Dict[str, Any], input_data: Any) -> Any:
        """
        Knowledge node: provides static text or parsed file content as context.
        Returns the knowledge_text which is stored under the node's output_var
        for subsequent AI nodes to reference.
        """
        logger.info("Executing Knowledge Node")
        
        knowledge_text = config.get("knowledge_text", "")
        output_var = config.get("output_var", "knowledge_text")
        
        if not knowledge_text:
            logger.warning("Knowledge node has no text content")
            return ""
        
        logger.info(f"Knowledge node output ({len(knowledge_text)} chars), output_var: {output_var}")
        
        return knowledge_text
    
    def execute_email(self, config: Dict[str, Any], input_data: Any, execution_context: Dict[str, Any] = None) -> Any:
        # Real Email Execution
        import smtplib
        import json
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from email.utils import formatdate, make_msgid

        # Resolve Subject, Body, AND RECIPIENT
        subject = self._resolve_variables(config.get('subject', 'Preventivo Agrilock'), execution_context)
        
        # ... (lines 823-905 skipped for brevity in replacement, sticking to block) ...
        # I need to be careful with the context. let's just replace the block where msg is created.
        
        # ... actually, I should just modify the block where msg is created.
        
        # Let's target the definition of execute_email to include imports if needed, 
        # or just add them inside the method since it has local imports.
        
        # Redoing the plan: I will replace the block starting from `msg = MIMEMultipart()` 
        # but I also need the imports. The imports are at the top of the method.


        # Resolve Subject, Body, AND RECIPIENT
        subject = self._resolve_variables(config.get('subject', 'Preventivo Agrilock'), execution_context)
        
        # Resolve 'To' field (could be variable)
        raw_to = config.get('email_to', '') or config.get('to_field', '') # Config key might vary based on frontend update
        recipient = self._resolve_variables(raw_to, execution_context)
        
        # VALIDATION: Check for fake/placeholder email addresses
        if recipient:
            import re
            recipient_clean = str(recipient).strip().lower()
            
            # Fake email patterns
            fake_email_domains = ['example.com', 'example.org', 'test.com', 'test.it', 'fake.com', 'placeholder.com', 'noreply.com']
            fake_email_prefixes = ['test@', 'example@', 'fake@', 'placeholder@', 'noemail@', 'no-email@', 'nessuna@']
            
            is_fake_email = False
            for domain in fake_email_domains:
                if recipient_clean.endswith('@' + domain):
                    is_fake_email = True
                    break
            for prefix in fake_email_prefixes:
                if recipient_clean.startswith(prefix):
                    is_fake_email = True
                    break
            
            # Basic format check
            if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', recipient_clean):
                logger.warning(f"[Email] ❌ SKIPPED: Invalid email format: {recipient}")
                return {"status": "skipped", "reason": f"Invalid email format: {recipient}"}
            
            if is_fake_email:
                logger.warning(f"[Email] ❌ SKIPPED: Fake/placeholder email detected: {recipient}")
                return {"status": "skipped", "reason": f"Fake/placeholder email: {recipient}"}
        
        # 1. Get Project SMTP Config
        project = self.context.get('project')
        if not project:
            return {"error": "No project context for SMTP config"}
            
        smtp_conf_str = project.get('smtp_config')
        if not smtp_conf_str:
             return {"error": "No SMTP configuration found in project settings"}
             
        try:
            smtp = json.loads(smtp_conf_str) if isinstance(smtp_conf_str, str) else smtp_conf_str
        except:
            return {"error": "Invalid SMTP config format with specific keys"}

        if not smtp or not smtp.get('host'):
             return {"error": "Incomplete SMTP config"}

        # 2. Prepare Message
        # Get email body from config template OR from accumulated context variables
        #   a) A template configured in the email node with {{variables}}
        #   b) Resolved from {{content}} or {{html}} in context
        
        email_body_template = config.get('email_body') or config.get('body') or config.get('body_var') or ''
        
        if email_body_template:
            # User configured a body template with variables
            email_body = self._resolve_variables(email_body_template, execution_context)
        else:
            # Auto-detect: look for known content keys in execution context
            email_body = ""
            if execution_context:
                # Priority order: _html_rendered > content > html > raw_output
                for key in ['_html_rendered', 'content', 'html', 'email_body', 'raw_output']:
                    val = execution_context.get(key)
                    if val and isinstance(val, str) and len(val) > 10:
                        email_body = val
                        logger.info(f"Email body auto-resolved from context key: '{key}' ({len(email_body)} chars)")
                        break
            
            # Fallback to input_data
            if not email_body:
                if isinstance(input_data, dict):
                    email_body = input_data.get('_html_rendered') or input_data.get('content') or input_data.get('html') or ''
                elif isinstance(input_data, str):
                    email_body = input_data
            
        if not email_body:
            email_body = "Nessun contenuto generato."
            logger.warning("No email body content found in context or input data")
        else:
            # Final pass: resolve any remaining {{variables}} in the body
            email_body = self._resolve_variables(email_body, execution_context)

        # Setup Message
        msg = MIMEMultipart('alternative')
        from_email = smtp.get('user')
        from_name = smtp.get('from_name') or from_email.split('@')[0] if from_email else 'Notification'
        msg['From'] = f"{from_name} <{from_email}>"
        
        # Resolve recipient from context
        if not recipient and execution_context:
            # Try common email field names from context
            for key in ['email', 'email_to', 'recipient', 'to']:
                val = execution_context.get(key)
                if val and isinstance(val, str) and '@' in val:
                    recipient = val
                    break

        if not recipient and isinstance(input_data, dict):
             recipient = input_data.get('email')

        if not recipient:
             req = self.context.get('request', {})
             recipient = req.get('email') or self.context.get('data', {}).get('email')

        if not recipient:
             logger.warning("No recipient email found.")
             return {"status": "skipped", "reason": "No recipient found"}

        msg['To'] = recipient
        msg['Subject'] = subject
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid(domain=smtp.get('host'))
        
        # Optional: Add Reply-To if configured or same as From
        msg['Reply-To'] = from_email

        # --- Wrap email body with Header and Footer ---
        header_logo = config.get('header_logo', '')
        header_text = config.get('header_text', '')
        footer_html = config.get('footer_html', '')
        
        # Resolve variables in footer too
        if footer_html:
            footer_html = self._resolve_variables(footer_html, execution_context)
        
        # Build header HTML
        header_html = ''
        if header_logo or header_text:
            header_html = '<div style="text-align:center; padding:20px 0; border-bottom:2px solid #eee; margin-bottom:20px;">'
            if header_logo:
                header_html += f'<img src="{header_logo}" alt="Logo" style="max-width:200px; max-height:80px; margin-bottom:10px;">'
            if header_text:
                header_html += f'<div style="font-size:18px; font-weight:bold; color:#333; margin-top:5px;">{header_text}</div>'
            header_html += '</div>'
        
        # Build footer HTML
        footer_section = ''
        if footer_html:
            footer_section = f'<div style="border-top:1px solid #eee; margin-top:30px; padding-top:15px; font-size:13px; color:#666;">{footer_html}</div>'
        
        # Wrap body
        full_email_html = f"""
        <div style="font-family: Arial, Helvetica, sans-serif; max-width:700px; margin:0 auto; color:#333;">
            {header_html}
            <div style="padding:10px 0;">{email_body}</div>
            {footer_section}
        </div>
        """

        # Add plain text alternative (Strip HTML)
        plain_text = re.sub(r'<[^>]+>', '', email_body)
        msg.attach(MIMEText(plain_text, 'plain'))
        msg.attach(MIMEText(full_email_html, 'html'))


        # 3. Send — Try bridge first (Railway blocks SMTP), fallback to direct
        host = smtp.get('host')
        port = int(smtp.get('port', 587))
        user = smtp.get('user')
        password = smtp.get('pass') or smtp.get('password')
        
        BRIDGE_URL = "http://workflow.floormad.com/bridge.php"
        
        # 3a. Try via bridge (works on Railway)
        try:
            import requests as http_requests
            bridge_payload = {
                "action": "send_email",
                "host": host,
                "port": port,
                "user": user,
                "password": password,
                "from_name": from_name,
                "to_email": recipient,
                "subject": subject,
                "html_body": full_email_html,
                "plain_text": plain_text
            }
            logger.info(f"Sending email via bridge to {recipient} (host={host}, port={port}, user={user})")
            bridge_response = http_requests.post(BRIDGE_URL, json=bridge_payload, timeout=30, allow_redirects=False)
            
            logger.info(f"Bridge HTTP status: {bridge_response.status_code}")
            logger.info(f"Bridge response body: {bridge_response.text[:500]}")
            
            # Check for redirects (HTTP->HTTPS loses POST body)
            if bridge_response.status_code in (301, 302, 307, 308):
                redirect_url = bridge_response.headers.get('Location', '')
                logger.warning(f"Bridge redirect detected to: {redirect_url} — retrying with new URL")
                bridge_response = http_requests.post(redirect_url, json=bridge_payload, timeout=30)
                logger.info(f"Redirect response: {bridge_response.status_code} - {bridge_response.text[:500]}")
            
            result = bridge_response.json()
            if result.get("success"):
                logger.info(f"Email sent via bridge to {recipient} — debug: {result.get('debug', [])}")
                return {"status": "sent", "recipient": recipient, "method": "bridge", "bridge_debug": result.get('debug', [])}
            else:
                logger.warning(f"Bridge email failed: {result.get('message')}, debug: {result.get('debug', [])}, trying direct SMTP...")
        except Exception as bridge_err:
            logger.warning(f"Bridge unavailable ({bridge_err}), trying direct SMTP...")
        
        # 3b. Fallback: direct SMTP (works locally)
        try:
            if port == 465:
                server = smtplib.SMTP_SSL(host, port, timeout=20)
            else:
                server = smtplib.SMTP(host, port, timeout=20)
                server.starttls()
            
            server.login(user, password)
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Email sent directly via SMTP to {recipient}")
            return {"status": "sent", "recipient": recipient, "method": "direct"}
            
        except Exception as e:
            logger.error(f"SMTP Sending Error: {e}")
            return {"error": str(e)}

    def execute_whatsapp(self, config: Dict[str, Any], input_data: Any, execution_context: Dict[str, Any] = None) -> Any:
        """
        Executes the Send WhatsApp Node using WeSender.
        """
        from wesender_client import WeSenderClient
        import time
        
        # 1. Resolve Inputs
        phone_field = config.get('phone_field', 'telefono')
        # Try to resolve phone from context/input
        phone = None
        
        logger.info(f"[WhatsApp] phone_field config = '{phone_field}'")
        logger.info(f"[WhatsApp] execution_context keys = {list(execution_context.keys()) if execution_context else 'None'}")
        
        # Check if phone_field is actually a direct value (e.g. "+39...") or a variable
        resolved_phone_val = self._resolve_variables(phone_field, execution_context)
        logger.info(f"[WhatsApp] resolved phone_field '{phone_field}' → '{resolved_phone_val}'")
        if resolved_phone_val and any(char.isdigit() for char in resolved_phone_val):
             phone = resolved_phone_val
        
        if not phone:
             # Look for the field name in context
             phone = self._resolve_variables(f"{{{{{phone_field}}}}}", execution_context)
             logger.info(f"[WhatsApp] fallback resolve '{{{{{phone_field}}}}}' → '{phone}'")
             
        if not phone and isinstance(input_data, dict):
            phone = input_data.get(phone_field) or input_data.get('phone') or input_data.get('telefono')
            logger.info(f"[WhatsApp] input_data fallback → '{phone}'")
            
        if not phone and execution_context:
             phone = execution_context.get(phone_field) or execution_context.get('phone') or execution_context.get('telefono')
             logger.info(f"[WhatsApp] context fallback → '{phone}'")

        if not phone:
            logger.warning("[WhatsApp] ❌ SKIPPED: No phone number found")
            return {"status": "skipped", "reason": "No phone number found"}

        # VALIDATION: Clean and validate phone number
        phone_clean = str(phone).strip()
        # Remove spaces, dashes, dots, parentheses
        phone_digits = ''.join(c for c in phone_clean if c.isdigit())
        
        # Blacklist of known placeholder/fake numbers
        fake_patterns = [
            '3401234567', '1234567890', '0000000000', '1111111111',
            '3331234567', '3201234567', '3281234567', '3381234567',
            '3391234567', '3471234567', '3481234567', '3491234567',
        ]
        
        # Check against blacklist (with or without country code prefix)
        is_fake = False
        for pattern in fake_patterns:
            if phone_digits.endswith(pattern):
                is_fake = True
                break
        
        # Check for sequential digit patterns (1234567, 9876543, etc.)
        if not is_fake and len(phone_digits) >= 7:
            last7 = phone_digits[-7:]
            if all(int(last7[i+1]) == int(last7[i]) + 1 for i in range(6)):
                is_fake = True  # ascending sequence
            if all(int(last7[i+1]) == int(last7[i]) - 1 for i in range(6)):
                is_fake = True  # descending sequence
            if len(set(last7)) == 1:
                is_fake = True  # all same digit
        
        # Min length check (at least 8 digits for a real phone)
        if len(phone_digits) < 8:
            logger.warning(f"[WhatsApp] ❌ SKIPPED: Phone too short ({phone_clean}, {len(phone_digits)} digits)")
            return {"status": "skipped", "reason": f"Phone number too short: {phone_clean}"}
        
        if is_fake:
            logger.warning(f"[WhatsApp] ❌ SKIPPED: Fake/placeholder phone detected: {phone_clean}")
            return {"status": "skipped", "reason": f"Fake/placeholder phone number: {phone_clean}"}

        # Message Body
        message_var = config.get('message_var', '')
        message = self._resolve_variables(message_var, execution_context)
        logger.info(f"[WhatsApp] message_var config = '{message_var}' → resolved len={len(message) if message else 0}")
        
        if not message:
             # Fallback to input content
             if isinstance(input_data, str):
                 message = input_data
             elif isinstance(input_data, dict):
                 message = input_data.get('message') or input_data.get('content') or input_data.get('text')
        
        if not message:
            logger.warning("[WhatsApp] ❌ SKIPPED: No message content found")
            return {"status": "skipped", "reason": "No message content found"}

        # 2. Get Config — try project first, then global settings
        project = self.context.get('project')
        if not project:
             return {"error": "No project context"}
              
        wesendit_conf = project.get('wesendit_config')
        if isinstance(wesendit_conf, str):
            try:
                import json
                wesendit_conf = json.loads(wesendit_conf)
            except:
                wesendit_conf = {}
                
        if not wesendit_conf or not isinstance(wesendit_conf, dict):
            wesendit_conf = {}
            
        api_key = wesendit_conf.get('api_key')
        api_url = wesendit_conf.get('api_url')
        
        # Fallback: check global settings
        if not api_key:
            try:
                from database import get_db_connection
                conn = get_db_connection()
                row = conn.execute("SELECT value FROM settings WHERE key='wesendit_api_key'").fetchone()
                if row and row['value']:
                    api_key = row['value']
                    logger.info("[WhatsApp] Using global WeSender API key")
                conn.close()
            except:
                pass
        
        if not api_key:
            logger.error("[WhatsApp] ❌ ERROR: Missing WeSender API Key (not in project config or global settings)")
            return {"error": "Missing WeSender API Key"}

        logger.info(f"[WhatsApp] ✅ Sending to {phone}, message_len={len(message)}, api_key_len={len(api_key)}")

        # 3. Small delay to avoid API rate limiting
        time.sleep(1)

        # 4. Send
        client = WeSenderClient(api_key, api_url)
        result = client.send_message(phone, message)
        
        if result.get('success'):
            logger.info(f"[WhatsApp] ✅ Message SENT to {phone}")
            return {"status": "sent", "recipient": phone, "api_response": result.get('data')}
        else:
            logger.error(f"[WhatsApp] ❌ SEND FAILED to {phone}: {result.get('details')}")
            return {"status": "error", "error": result.get('details')}


    def execute_pipedrive(self, config: Dict[str, Any], input_data: Any, execution_context: Dict[str, Any] = None) -> Any:
        """Execute Pipedrive CRM sync: search person by email, create or update."""
        import json
        
        # 1. Resolve field values from context
        email_field = config.get('email_field', '{{email}}')
        name_field = config.get('name_field', '{{nome}}')
        phone_field = config.get('phone_field', '{{telefono}}')
        address_field = config.get('address_field', '')
        notes_field = config.get('notes_field', '')
        
        email = self._resolve_variables(email_field, execution_context) if execution_context else email_field
        name = self._resolve_variables(name_field, execution_context) if execution_context else name_field
        phone = self._resolve_variables(phone_field, execution_context) if execution_context else phone_field
        address = self._resolve_variables(address_field, execution_context) if execution_context and address_field else ''
        notes = self._resolve_variables(notes_field, execution_context) if execution_context and notes_field else ''
        
        # 2. Get Pipedrive config from project
        project = self.context.get('project')
        if not project:
            return {"error": "No project context for Pipedrive config"}
        
        pd_conf_str = project.get('pipedrive_config')
        if not pd_conf_str:
            return {"error": "No Pipedrive configuration found in project settings"}
        
        try:
            pd_conf = json.loads(pd_conf_str) if isinstance(pd_conf_str, str) else pd_conf_str
        except:
            return {"error": "Invalid Pipedrive config format"}
        
        api_token = pd_conf.get('api_token')
        if not api_token:
            return {"error": "Missing Pipedrive API Token"}
        
        # 3. Sync to Pipedrive
        from pipedrive_client import PipedriveClient
        client = PipedriveClient(api_token)
        result = client.sync_person(
            name=name,
            email=email,
            phone=phone if phone else None,
            notes=notes if notes else None,
            postal_address=address if address else None
        )
        
        logger.info(f"Pipedrive sync result: {result.get('action', 'unknown')} for {email}")
        return result

    def _resolve_variables(self, text: str, execution_context: Dict[str, Any]) -> str:
        """
        Replaces {{variable_name}} with values from execution_context.
        Now supports FLAT context lookup: {{subject}} finds context['subject'] directly.
        Also supports dot notation: {{ai_node.content}} for nested access.
        """
        if not text or not isinstance(text, str) or not execution_context:
            return text
            
        # Find all matches (now including spaces/hyphens for lenient matching)
        matches = re.findall(r'\{\{([a-zA-Z0-9_. -]+)\}\}', text)
        result_text = text
        
        for var_name in matches:
            value = None
            found = False
            
            parts = var_name.split('.')
            root_var = parts[0]
            prop_path = parts[1:] if len(parts) > 1 else []
            
            # === Strategy 1: FLAT lookup (highest priority) ===
            # Check if the full var_name exists directly in context
            if var_name in execution_context:
                value = execution_context[var_name]
                found = True
            
            # === Strategy 2: Root + dot property access ===
            if not found and root_var in execution_context:
                data = execution_context[root_var]
                if prop_path:
                    # Traverse properties: {{node_name.field}}
                    current = data
                    valid_path = True
                    for prop in prop_path:
                        if isinstance(current, dict) and prop in current:
                            current = current[prop]
                        else:
                            valid_path = False
                            break
                    if valid_path:
                        value = current
                        found = True
                else:
                    value = data
                    found = True
            
            # === Strategy 3: Search node configs for matching output_var/node_name ===
            if not found:
                for nid, node in self.nodes.items():
                    config = node.get("data", {}).get("config", {})
                    if config.get("output_var") == root_var or config.get("node_name") == root_var:
                        if nid in execution_context:
                            data = execution_context[nid]
                            if prop_path:
                                current = data
                                valid_path = True
                                for prop in prop_path:
                                    if isinstance(current, dict) and prop in current:
                                        current = current[prop]
                                    else:
                                        valid_path = False
                                        break
                                if valid_path:
                                    value = current
                                    found = True
                            else:
                                value = data
                                found = True
                        break

            # === Strategy 4: Fuzzy Lookup (Slug -> Keys) ===
            # Handle case where user types {{body_email}} but key is "Body Email"
            if not found and not prop_path:
                normalized_var = re.sub(r'[^a-z0-9]', '', var_name.lower())
                for key in execution_context.keys():
                     normalized_key = re.sub(r'[^a-z0-9]', '', key.lower())
                     if normalized_key == normalized_var:
                         value = execution_context[key]
                         found = True
                         break
            
            if found and value is not None:
                if isinstance(value, (dict, list)):
                    try:
                        value = json.dumps(value, ensure_ascii=False)
                    except:
                        value = str(value)
                result_text = result_text.replace(f"{{{{{var_name}}}}}", str(value))
                
        return result_text


    # ═══════════════════════════════════════════════
    # NEW NODES: CONDITION, DELAY, HTTP_REQUEST, FILTER
    # ═══════════════════════════════════════════════

    def execute_condition(self, config: Dict[str, Any], input_data: Any, execution_context: Dict[str, Any] = None) -> Any:
        """
        IF/ELSE Conditional Node.
        Evaluates a condition and returns _branch = 'output_1' (TRUE) or 'output_2' (FALSE).
        The BFS loop uses this to route to the correct output.
        
        Config:
            field: variable name to check (e.g., '{{mq}}' or 'mq')
            operator: 'equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty', 'regex'
            value: comparison value
        """
        field_raw = config.get('field', '')
        operator = config.get('operator', 'is_not_empty')
        compare_value = config.get('value', '')
        
        # Resolve the field value from context
        field_value = self._resolve_variables(field_raw, execution_context) if execution_context else field_raw
        
        # Also resolve compare value in case it contains variables
        compare_value = self._resolve_variables(str(compare_value), execution_context) if execution_context and compare_value else compare_value
        
        logger.info(f"[CONDITION] field='{field_raw}' → '{field_value}', operator='{operator}', compare='{compare_value}'")
        
        result = False
        
        try:
            if operator == 'equals':
                result = str(field_value).strip().lower() == str(compare_value).strip().lower()
            elif operator == 'not_equals':
                result = str(field_value).strip().lower() != str(compare_value).strip().lower()
            elif operator == 'contains':
                result = str(compare_value).lower() in str(field_value).lower()
            elif operator == 'not_contains':
                result = str(compare_value).lower() not in str(field_value).lower()
            elif operator == 'greater_than':
                result = float(str(field_value).replace(',', '.')) > float(str(compare_value).replace(',', '.'))
            elif operator == 'less_than':
                result = float(str(field_value).replace(',', '.')) < float(str(compare_value).replace(',', '.'))
            elif operator == 'greater_equal':
                result = float(str(field_value).replace(',', '.')) >= float(str(compare_value).replace(',', '.'))
            elif operator == 'less_equal':
                result = float(str(field_value).replace(',', '.')) <= float(str(compare_value).replace(',', '.'))
            elif operator == 'is_empty':
                result = not field_value or str(field_value).strip() == '' or str(field_value).strip().lower() in ['none', 'null', 'undefined']
            elif operator == 'is_not_empty':
                result = field_value and str(field_value).strip() != '' and str(field_value).strip().lower() not in ['none', 'null', 'undefined']
            elif operator == 'starts_with':
                result = str(field_value).lower().startswith(str(compare_value).lower())
            elif operator == 'ends_with':
                result = str(field_value).lower().endswith(str(compare_value).lower())
            elif operator == 'regex':
                import re as regex_mod
                result = bool(regex_mod.search(str(compare_value), str(field_value)))
        except (ValueError, TypeError) as e:
            logger.warning(f"[CONDITION] Evaluation error: {e}")
            result = False
        
        branch = "output_1" if result else "output_2"
        logger.info(f"[CONDITION] Result: {result} → branch: {branch}")
        
        return {
            "_branch": branch,
            "result": result,
            "field": field_raw,
            "field_value": str(field_value),
            "operator": operator,
            "compare_value": str(compare_value)
        }

    def execute_delay(self, config: Dict[str, Any], input_data: Any) -> Any:
        """
        DELAY Node — pauses execution for a configurable duration.
        
        Config:
            delay_seconds: number of seconds to wait (default: 1)
        """
        import time
        
        delay = config.get('delay_seconds', 1)
        try:
            delay = float(delay)
        except:
            delay = 1.0
        
        # Cap at 300 seconds (5 minutes) for safety
        delay = min(delay, 300)
        
        logger.info(f"[DELAY] Waiting {delay} seconds...")
        time.sleep(delay)
        logger.info(f"[DELAY] Wait complete.")
        
        return input_data  # Pass through

    def execute_http_request(self, config: Dict[str, Any], input_data: Any, execution_context: Dict[str, Any] = None) -> Any:
        """
        HTTP_REQUEST Node — makes external HTTP API calls.
        
        Config:
            url: target URL (supports {{variables}})
            method: GET, POST, PUT, DELETE, PATCH (default: GET)
            headers: JSON string of headers
            body: request body (supports {{variables}})
            body_type: 'json' or 'form' (default: json)
            output_var: variable name to store response
        """
        import requests
        
        url = config.get('url', '')
        method = config.get('method', 'GET').upper()
        headers_raw = config.get('headers', '{}')
        body_raw = config.get('body', '')
        body_type = config.get('body_type', 'json')
        
        # Resolve variables in URL and body
        if execution_context:
            url = self._resolve_variables(url, execution_context)
            body_raw = self._resolve_variables(body_raw, execution_context)
        
        if not url:
            return {"error": "No URL configured"}
        
        logger.info(f"[HTTP_REQUEST] {method} {url}")
        
        # Parse headers
        headers = {}
        try:
            if headers_raw and headers_raw.strip():
                import json as json_mod
                headers = json_mod.loads(headers_raw) if isinstance(headers_raw, str) else headers_raw
        except:
            pass
        
        # Make request
        try:
            kwargs = {"headers": headers, "timeout": 30}
            
            if method in ('POST', 'PUT', 'PATCH') and body_raw:
                if body_type == 'json':
                    try:
                        import json as json_mod
                        kwargs["json"] = json_mod.loads(body_raw) if isinstance(body_raw, str) else body_raw
                    except:
                        kwargs["data"] = body_raw
                else:
                    kwargs["data"] = body_raw
            
            response = requests.request(method, url, **kwargs)
            
            # Try to parse response as JSON
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            logger.info(f"[HTTP_REQUEST] Response: {response.status_code}")
            
            return {
                "status_code": response.status_code,
                "response": response_data,
                "url": url,
                "method": method
            }
            
        except Exception as e:
            logger.error(f"[HTTP_REQUEST] Error: {e}")
            return {"error": str(e), "url": url}

    def execute_filter(self, config: Dict[str, Any], input_data: Any, execution_context: Dict[str, Any] = None) -> Any:
        """
        FILTER Node — filters data based on rules. If all conditions pass, data flows through.
        If conditions fail, returns _status: 'filtered' and the workflow continues but downstream 
        nodes can check for this status.
        
        Config:
            rules: list of {field, operator, value} conditions
            logic: 'AND' (all must match) or 'OR' (any must match)
        """
        import json as json_mod
        
        rules_raw = config.get('rules', '[]')
        logic = config.get('logic', 'AND').upper()
        
        try:
            rules = json_mod.loads(rules_raw) if isinstance(rules_raw, str) else rules_raw
        except:
            rules = []
        
        if not rules:
            return input_data  # No rules = pass everything through
        
        logger.info(f"[FILTER] Evaluating {len(rules)} rules with logic '{logic}'")
        
        rule_results = []
        for rule in rules:
            field = rule.get('field', '')
            operator = rule.get('operator', 'is_not_empty')
            value = rule.get('value', '')
            
            # Resolve field value
            field_value = self._resolve_variables(field, execution_context) if execution_context else field
            
            # Evaluate using same logic as CONDITION
            passed = False
            try:
                if operator == 'equals':
                    passed = str(field_value).strip().lower() == str(value).strip().lower()
                elif operator == 'not_equals':
                    passed = str(field_value).strip().lower() != str(value).strip().lower()
                elif operator == 'contains':
                    passed = str(value).lower() in str(field_value).lower()
                elif operator == 'not_contains':
                    passed = str(value).lower() not in str(field_value).lower()
                elif operator == 'greater_than':
                    passed = float(str(field_value).replace(',', '.')) > float(str(value).replace(',', '.'))
                elif operator == 'less_than':
                    passed = float(str(field_value).replace(',', '.')) < float(str(value).replace(',', '.'))
                elif operator == 'is_empty':
                    passed = not field_value or str(field_value).strip() in ['', 'None', 'null']
                elif operator == 'is_not_empty':
                    passed = field_value and str(field_value).strip() not in ['', 'None', 'null']
            except:
                passed = False
            
            rule_results.append(passed)
            logger.info(f"[FILTER] Rule: '{field}' {operator} '{value}' → {passed}")
        
        # Apply logic
        if logic == 'AND':
            all_passed = all(rule_results)
        else:
            all_passed = any(rule_results)
        
        if all_passed:
            logger.info(f"[FILTER] ✅ All conditions passed — data flows through")
            return input_data
        else:
            logger.info(f"[FILTER] ❌ Conditions not met — data filtered out")
            return {"_status": "filtered", "reason": "Filter conditions not met", "results": rule_results}
