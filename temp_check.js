        // Override console to show on screen
        const debugConsole = document.getElementById('debug-console');
        const originalLog = console.log;
        const originalError = console.error;

        function logToScreen(msg, type = 'log') {
            const line = document.createElement('div');
            line.textContent = `[${type.toUpperCase()}] ${msg}`;
            if (type === 'error') line.style.color = '#ff5555';
            if (debugConsole) {
                debugConsole.appendChild(line);
                debugConsole.scrollTop = debugConsole.scrollHeight;
            }
        }

        console.log = function (...args) {
            originalLog.apply(console, args);
            logToScreen(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
        };

        console.error = function (...args) {
            originalError.apply(console, args);
            logToScreen(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), 'error');
        };

        // --- UI UTILS ---
        let currentProjectId = null;

        function showToast(type, title, msg) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');

            // Allow pointer events on toast
            toast.className = `pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 transition transform duration-300 ease-out translate-y-2 opacity-0 ${type === 'success' ? 'bg-gray-800 border-l-4 border-green-500' : 'bg-gray-800 border-l-4 border-red-500'}`;

            toast.innerHTML = `
                <div class="p-4">
                    <div class="flex items-start">
                        <div class="flex-shrink-0">
                            ${type === 'success'
                    ? '<svg class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
                    : '<svg class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'}
                        </div>
                        <div class="ml-3 w-0 flex-1 pt-0.5">
                            <p class="text-sm font-medium text-white">${title}</p>
                            <p class="mt-1 text-sm text-gray-400">${msg}</p>
                        </div>
                        <div class="ml-4 flex-shrink-0 flex">
                            <button onclick="this.closest('div').parentElement.parentElement.remove()" class="rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                <span class="sr-only">Close</span>
                                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(toast);

            // Animate In
            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-2', 'opacity-0');
            });

            // Auto Remove
            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        }

        // Wrapper to replace old showStatus with Toast
        function showStatus(type, title, msg, details = null) {
            showToast(type, title, msg);
            if (details) console.error("Error details:", details);
        }

        function extractEmail(jsonStr, targetId) {
            try {
                const data = JSON.parse(jsonStr);
                if (data.client_email) {
                    document.getElementById(targetId).innerText = data.client_email;
                }
            } catch (e) {
                // Ignore parsing errors while typing
            }
        }

        // --- TAB LOGIC ---
        function switchTab(tabId) {
            ['tab-general', 'tab-ai', 'tab-products', 'tab-workflow'].forEach(t => {
                document.getElementById(t).classList.add('hidden');
                document.getElementById('btn-' + t).classList.remove('border-blue-500', 'text-blue-400');
                document.getElementById('btn-' + t).classList.add('border-transparent', 'text-gray-400');
            });

            document.getElementById(tabId).classList.remove('hidden');
            const btn = document.getElementById('btn-' + tabId);
            btn.classList.remove('border-transparent', 'text-gray-400');
            btn.classList.add('border-blue-500', 'text-blue-400');
        }

        // ... (existing code for confirm modal, product config, etc.)

        // --- CUSTOM CONFIRM MODAL LOGIC ---
        let confirmCallback = null;
        function showConfirm(msg) {
            return new Promise((resolve) => {
                document.getElementById('confirm-msg').innerText = msg;
                document.getElementById('confirm-modal').classList.remove('hidden');
                document.getElementById('confirm-modal').classList.add('flex');
                confirmCallback = resolve;
            });
        }

        function closeConfirm(result) {
            document.getElementById('confirm-modal').classList.add('hidden');
            document.getElementById('confirm-modal').classList.remove('flex');
            if (confirmCallback) confirmCallback(result);
        }

        // --- PRODUCT CONFIG LOGIC ---
        let currentProducts = [];

        function renderProducts() {
            const list = document.getElementById('products-list');
            list.innerHTML = '';

            currentProducts.forEach((prod, index) => {
                const template = document.getElementById('product-template').content.cloneNode(true);

                template.querySelector('.prod-name').value = prod.name || '';
                // Colors
                template.querySelector('.prod-colors').value = Array.isArray(prod.colors) ? prod.colors.join(', ') : (prod.colors || '');

                // Join descriptions array into textarea lines
                const descText = Array.isArray(prod.descriptions) ? prod.descriptions.join('\n') : (prod.descriptions || '');
                template.querySelector('.prod-desc').value = descText;

                template.querySelector('.delete-btn').onclick = () => removeProduct(index);
                // Bind inputs to array
                template.querySelector('.prod-name').oninput = (e) => currentProducts[index].name = e.target.value;
                template.querySelector('.prod-colors').oninput = (e) => currentProducts[index].colors = e.target.value.split(',').map(c => c.trim()).filter(c => c);
                template.querySelector('.prod-desc').oninput = (e) => currentProducts[index].descriptions = e.target.value.split('\n').filter(l => l.trim());

                list.appendChild(template);
            });
        }

        function addProduct() {
            currentProducts.push({ id: crypto.randomUUID(), name: '', colors: [], descriptions: [] });
            renderProducts();
        }

        async function removeProduct(index) {
            const confirmed = await showConfirm('Remove this product?');
            if (!confirmed) return;
            currentProducts.splice(index, 1);
            renderProducts();
        }

        // --- PRICE VIEW LOGIC ---
        let currentPriceCache = [];

        function viewPriceCache() {
            const modal = document.getElementById('price-modal');
            const theadRow = document.querySelector('#price-modal thead tr');
            const tbody = document.getElementById('price-table-body');

            theadRow.innerHTML = '';
            tbody.innerHTML = '';

            if (!currentPriceCache || currentPriceCache.length === 0) {
                theadRow.innerHTML = '<th class="p-3 text-xs font-bold text-gray-400 uppercase border-b border-gray-700">No Data</th>';
                tbody.innerHTML = '<tr><td class="p-4 text-center text-gray-500">No data synced yet.</td></tr>';
            } else {
                // Get all keys from the first object to form headers
                const keys = Object.keys(currentPriceCache[0]);

                // Render Headers
                keys.forEach(key => {
                    theadRow.innerHTML += `<th class="p-3 text-xs font-bold text-gray-400 uppercase border-b border-gray-700 whitespace-nowrap">${key.replace(/_/g, ' ')}</th>`;
                });

                // Render Rows (Limit to 100)
                currentPriceCache.slice(0, 100).forEach(row => {
                    let tr = '<tr class="hover:bg-gray-800/50 transition">';
                    keys.forEach(key => {
                        // Highlight specific columns for better readability
                        let classes = "p-3 border-b border-gray-700/50 text-gray-300";
                        if (key.toLowerCase().includes('prezzo')) classes += " text-emerald-400 font-bold";
                        if (key.toLowerCase().includes('fascia')) classes += " text-blue-300 font-mono";
                        if (key === 'prodotto') classes += " font-medium text-white";

                        tr += `<td class="${classes}">${row[key] !== null && row[key] !== undefined ? row[key] : '-'}</td>`;
                    });
                    tr += '</tr>';
                    tbody.innerHTML += tr;
                });
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        // --- PRICE SYNC LOGIC ---
        async function syncPrices() {
            const id = document.getElementById('c-id').value;
            const sheetId = document.getElementById('c-price-url').value;
            const range = document.getElementById('c-price-range').value || 'Foglio1!A:G';

            // REMOVED BLOCKING CHECK FOR SHEET URL to allow fallback to upload

            const btn = document.getElementById('btn-sync-prices');
            const spinner = document.getElementById('sync-spinner');
            const status = document.getElementById('sync-status');

            btn.disabled = true;
            spinner.classList.remove('hidden');
            status.classList.add('hidden');

            try {
                const res = await fetch(`/api/projects/${id}/sync-prices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sheet_id: sheetId, sheet_range: range })
                });

                const data = await res.json();

                if (data.success) {
                    showStatus('success', 'Sync Complete', `Synced ${data.count} items.`);

                    // Reload project data to update local cache variable
                    openConfig(id);
                } else {
                    throw new Error(data.detail || data.message);
                }
            } catch (e) {
                showStatus('error', 'Sync Failed', e.message);
            } finally {
                btn.disabled = false;
                spinner.classList.add('hidden');
            }
        }

        // --- CONFIG MODAL LOGIC ---
        async function openConfig(id) {
            currentProjectId = id; // Fix: Set global variable
            // Fetch Data
            try {
                const res = await fetch(`/api/projects/${id}`);
                if (!res.ok) throw new Error("Failed to load project");
                const project = await res.json();

                // Populate Form
                document.getElementById('c-id').value = project.id;
                document.getElementById('c-name').value = project.name;
                document.getElementById('c-desc').value = project.description || '';
                document.getElementById('c-status').value = project.status || 'active';
                document.getElementById('c-sheet').value = project.google_sheet_id;
                document.getElementById('c-json').value = project.service_account_json;
                extractEmail(project.service_account_json, 'c-sa-email'); // Extract and show email immediately

                document.getElementById('c-cron').value = project.cron_expression || '';
                // Use price_list_url field for ID
                document.getElementById('c-price-url').value = project.price_list_url || '';
                document.getElementById('c-price-range').value = 'Foglio1!A:G'; // Default
                document.getElementById('c-locality-prompt').value = project.locality_prompt || '';

                // Clear sync status
                document.getElementById('sync-status').classList.add('hidden');

                // Load Price Cache
                try {
                    currentPriceCache = project.price_list_cache ? JSON.parse(project.price_list_cache) : [];
                } catch (e) {
                    currentPriceCache = [];
                }

                // Products
                try {
                    currentProducts = project.products_config ? JSON.parse(project.products_config) : [];
                    if (!Array.isArray(currentProducts)) currentProducts = [];
                } catch (e) {
                    currentProducts = [];
                }
                renderProducts();

                // Workflow - Now Drawflow Object
                try {
                    currentWorkflow = project.workflow_json ? JSON.parse(project.workflow_json) : {};
                } catch (e) {
                    currentWorkflow = {};
                }

                // Show Modal first so container has size
                document.getElementById('config-modal').classList.remove('hidden');
                document.getElementById('config-modal').classList.add('flex');

                // Init Drawflow if needed (with slight delay for rendering)
                setTimeout(() => {
                    renderWorkflow();
                }, 100);

                // Reset to General Tab
                switchTab('tab-general');

            } catch (e) {
                showStatus('error', 'Error', e.message);
            }
        }

        function closeConfig() {
            document.getElementById('config-modal').classList.add('hidden');
            document.getElementById('config-modal').classList.remove('flex');
        }

        async function saveConfig() {
            // Update workflow var from editor
            updateGlobalWorkflowVar();

            const btn = document.getElementById('save-spinner').parentElement;
            const spinner = document.getElementById('save-spinner');
            btn.disabled = true;
            spinner.classList.remove('hidden');

            const id = document.getElementById('c-id').value;

            const payload = {
                name: document.getElementById('c-name').value,
                description: document.getElementById('c-desc').value,
                status: document.getElementById('c-status').value,
                google_sheet_id: document.getElementById('c-sheet').value,
                service_account_json: document.getElementById('c-json').value,

                cron_expression: document.getElementById('c-cron').value,
                price_list_url: document.getElementById('c-price-url').value,
                locality_prompt: document.getElementById('c-locality-prompt').value,

                products_config: currentProducts,
                workflow_json: currentWorkflow // Drawflow Export Object
            };

            try {
                const res = await fetch(`/api/projects/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error("Update failed");
                const data = await res.json();

                closeConfig();
                showStatus('success', 'Saved!', 'Project configuration updated successfully.');
                fetchProjects();

            } catch (e) {
                showStatus('error', 'Save Failed', e.message);
            } finally {
                btn.classList.add('hidden');
            }
        }


        // --- MAIN PAGE LOGIC ---
        function openModal() { document.getElementById('project-modal').classList.remove('hidden'); document.getElementById('project-modal').classList.add('flex'); }
        function closeModal() { document.getElementById('project-modal').classList.add('hidden'); document.getElementById('project-modal').classList.remove('flex'); }

        async function fetchProjects() {
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error(`API Error: ${res.status}`);

                const data = await res.json();

                if (!data.projects) throw new Error("Invalid API response: no projects key");

                const grid = document.getElementById('projects-grid');
                if (grid) {
                    document.getElementById('project-count').innerText = data.projects.length;

                    if (data.projects.length === 0) {
                        grid.innerHTML = '<div class="col-span-3 text-center text-gray-500 py-10">No projects found. Create one to get started!</div>';
                        return;
                    }

                    grid.innerHTML = data.projects.map(p => `
                        <div class="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-blue-500 transition group relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-800/50">
                            <div class="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition flex gap-2">
                                 <button onclick="deleteProject('${p.id}')" class="text-red-400 hover:text-red-300 bg-gray-900/50 p-1.5 rounded hover:bg-red-900/40 transition">🗑️</button>
                            </div>
                            <div class="flex items-center justify-between mb-4">
                                <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold">
                                    ${(p.name || '?').charAt(0).toUpperCase()}
                                </div>
                                <span class="px-2 py-1 ${p.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'} text-xs rounded-full border">
                                    ${p.status || 'Active'}
                                </span>
                            </div>
                            <h3 class="text-lg font-bold truncate text-white">${p.name || 'Unnamed'}</h3>
                            <p class="text-gray-400 text-sm mb-4 truncate">${p.description || 'No description'}</p>
                            
                            <div class="space-y-2 mb-6">
                                <div class="flex justify-between text-xs text-gray-500 border-t border-gray-700 pt-2">
                                    <span>Sheet Link</span>
                                    <span class="font-mono text-blue-300/70 hover:text-blue-300 cursor-pointer" onclick="window.open('https://docs.google.com/spreadsheets/d/${p.google_sheet_id}', '_blank')">Open ↗</span>
                                </div>
                                ${p.cron_expression ? '<div class="flex justify-between text-xs text-emerald-500/70"><span>Scheduler</span><span>Active ⚡</span></div>' : ''}
                            </div>

                            <div class="flex gap-2">
                                <button onclick="openConfig('${p.id}')" class="flex-1 bg-gray-700 hover:bg-gray-600 py-2.5 rounded-lg text-sm transition text-gray-200 font-medium">Configure</button>
                                <button onclick="runProject('${p.id}')" class="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg text-sm transition font-semibold shadow-lg shadow-blue-900/20 text-white">Run Workflow</button>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (e) {
                console.error("Fetch Projects Failed:", e);
                showStatus('error', 'Load Error', e.message);
                const grid = document.getElementById('projects-grid');
                if (grid) grid.innerHTML = `<div class="col-span-3 text-red-400 text-center py-4">Error loading projects: ${e.message}</div>`;
            }
        }

        async function runProject(id) {
            // Simplified run (test)
            const btn = event.target;
            const originalText = btn.innerText;
            btn.innerText = "Running...";
            btn.disabled = true;
            btn.classList.add('opacity-70');

            try {
                const res = await fetch(`/api/projects/${id}/test`, { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    showStatus('success', 'Workflow Dry Run Success', data.message, data.details);
                } else {
                    showStatus('error', 'Workflow Failed', data.message, data.trace);
                }
            } catch (err) {
                showStatus('error', 'System Error', err.toString());
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
                btn.classList.remove('opacity-70');
            }
        }

        document.getElementById('create-project-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerText = "Creating...";

            const payload = {
                name: document.getElementById('p-name').value,
                description: document.getElementById('p-desc').value,
                google_sheet_id: document.getElementById('p-sheet').value,
                service_account_json: document.getElementById('p-json').value
            };

            try {
                const res = await fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    closeModal();
                    fetchProjects();
                    e.target.reset();
                    showStatus('success', 'Project Created', 'You can now configure the workflow.');
                } else {
                    throw new Error('Failed to create project');
                }
            } catch (err) {
                alert('Error creating project: ' + err);
            } finally {
                btn.innerText = originalText;
            }
        });

        async function uploadPriceList() {
            if (!currentProjectId) return;
            const fileInput = document.getElementById('price-upload-file');
            const file = fileInput.files[0];

            if (!file) {
                showStatus('error', 'No File', 'Please select an Excel or CSV file first.');
                return;
            }

            showStatus('loading', 'Uploading...', 'Parsing and caching price list...');

            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch(`/api/projects/${currentProjectId}/upload-price-list`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    showStatus('success', 'Upload Complete', data.message);
                    // Refresh project to get new cache
                    const pRes = await fetch('/api/projects');
                    const projects = await pRes.json();
                    const p = projects.find(x => x.id === currentProjectId);
                    if (p) {
                        try {
                            currentPriceCache = p.price_list_cache ? JSON.parse(p.price_list_cache) : [];
                        } catch (e) {
                            currentPriceCache = [];
                        }
                    }
                } else {
                    showStatus('error', 'Upload Failed', data.message);
                }
            } catch (e) {
                showStatus('error', 'Error', e.message);
            }
        }

        async function uploadPriceList() {
            if (!currentProjectId) return;
            const fileInput = document.getElementById('price-upload-file');
            const file = fileInput.files[0];
            const btnSpinner = document.querySelector('#btn-upload #upload-spinner');
            const btnText = document.querySelector('#btn-upload span:first-child');

            if (!file) {
                showStatus('error', 'No File', 'Please select an Excel or CSV file first.');
                return;
            }

            showStatus('loading', 'Uploading...', 'Parsing and caching price list...');
            if (btnSpinner) btnSpinner.classList.remove('hidden');
            if (btnText) btnText.textContent = 'Uploading...';

            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch(`/api/projects/${currentProjectId}/upload-price-list`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    showStatus('success', 'Upload Complete', data.message);
                    // Refresh project to get new cache
                    const pRes = await fetch('/api/projects');
                    const projects = await pRes.json();
                    const p = projects.find(x => x.id === currentProjectId);
                    if (p) {
                        try {
                            currentPriceCache = p.price_list_cache ? JSON.parse(p.price_list_cache) : [];
                        } catch (e) {
                            currentPriceCache = [];
                        }
                    }
                } else {
                    showStatus('error', 'Upload Failed', data.message);
                }
            } catch (e) {
                showStatus('error', 'Error', e.message);
            } finally {
                if (btnSpinner) btnSpinner.classList.add('hidden');
                if (btnText) btnText.textContent = 'Upload';
            }
        }

        let projectToDeleteId = null;

        function deleteProject(id) {
            projectToDeleteId = id;
            const modal = document.getElementById('delete-modal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeDeleteModal() {
            projectToDeleteId = null;
            const modal = document.getElementById('delete-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            if (!projectToDeleteId) return;

            const btn = document.getElementById('confirm-delete-btn');
            const originalText = btn.innerText;
            btn.innerText = "Deleting...";
            btn.disabled = true;

            try {
                await fetch(`/api/projects/${projectToDeleteId}`, { method: 'DELETE' });
                closeDeleteModal();
                fetchProjects();
                showStatus('success', 'Project Deleted', 'The project has been permanently removed.');
            } catch (e) {
                showStatus('error', 'Delete Failed', e.message);
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });

        // --- GLOBAL SETTINGS LOGIC ---
        async function openSettings() {
            try {
                const res = await fetch('/api/settings');
                const settings = await res.json();

                document.getElementById('g-sa-json').value = settings.service_account_json || '';
                document.getElementById('g-api-key').value = settings.google_api_key || '';
                document.getElementById('g-sheet-id').value = settings.default_sheet_id || '';

                extractEmail(settings.service_account_json || '', 'g-sa-email');

                document.getElementById('settings-modal').classList.remove('hidden');
                document.getElementById('settings-modal').classList.add('flex');
            } catch (e) {
                showStatus('error', 'Error', 'Failed to load settings: ' + e.message);
            }
        }

        function closeSettings() {
            document.getElementById('settings-modal').classList.add('hidden');
            document.getElementById('settings-modal').classList.remove('flex');
        }

        // --- WORKFLOW BUILDER LOGIC ---
        // --- VISUAL WORKFLOW BUILDER (DRAWFLOW) ---
        let editor = null;
        let currentNodeId = null;

        function initDrawflow() {
            const id = document.getElementById("drawflow");
            editor = new Drawflow(id);
            editor.reroute = true;
            editor.editor_mode = 'edit';
            editor.start();

            // Event Listeners
            editor.on('nodeCreated', function (id) {
                console.log("Node created " + id);
            });

            editor.on('nodeSelected', function (id) {
                currentNodeId = id;
                showNodeConfig(id);
            });

            editor.on('nodeUnselected', function (id) {
                currentNodeId = null;
                document.getElementById('node-config-panel').classList.add('hidden');
                document.getElementById('node-config-panel').classList.remove('flex');
            });
        }

        // --- DRAG & DROP LOGIC ---
        function allowDrop(ev) {
            ev.preventDefault();
        }

        function drag(ev) {
            ev.dataTransfer.setData("node", ev.target.dataset.node);
        }

        function drop(ev) {
            ev.preventDefault();
            const nodeType = ev.dataTransfer.getData("node");
            addNodeToTheCanvas(nodeType, ev.clientX, ev.clientY);
        }

        function addNodeToTheCanvas(type, pos_x, pos_y) {
            if (editor.editor_mode === 'fixed') return false;

            // Adjust position relative to canvas
            pos_x = pos_x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)) - (editor.precanvas.getBoundingClientRect().x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)));
            pos_y = pos_y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)) - (editor.precanvas.getBoundingClientRect().y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)));

            // Node Templates
            let html = `<div>Unknown</div>`;
            let inputs = 1;
            let outputs = 1;
            let title = type.replace('_', ' ');

            if (type === 'AI_COMPLETION') {
                html = `
                <div class="title-box">✨ AI Completion</div>
                <div class="box">
                    <p>Gen Text/JSON</p>
                </div>`;
            } else if (type === 'HTML_TEMPLATE') {
                html = `
                <div class="title-box">📄 HTML Template</div>
                <div class="box">
                    <p>Build HTML</p>
                </div>`;
            } else if (type === 'SEND_EMAIL') {
                html = `
                <div class="title-box">📧 Send Email</div>
                <div class="box">
                    <p>SMTP/Gmail</p>
                </div>`;
                inputs = 1; outputs = 0;
            } else if (type === 'SEND_WHATSAPP') {
                html = `
                <div class="title-box">💬 WhatsApp</div>
                <div class="box">
                    <p>WeSender</p>
                </div>`;
                inputs = 1; outputs = 0;
            }

            // Add Node
            // addNode(name, inputs, outputs, posx, posy, class, data, html_string)
            editor.addNode(type, inputs, outputs, pos_x, pos_y, type, { config: {} }, html);
        }

        // --- CONFIG PANEL LOGIC ---
        function showNodeConfig(id) {
            const node = editor.getNodeFromId(id);
            const type = node.name;
            const data = node.data.config || {};

            const panel = document.getElementById('node-config-panel');
            const content = document.getElementById('node-config-content');
            document.getElementById('conf-node-id').innerText = "#" + id;

            content.innerHTML = ''; // Clear previous

            if (type === 'AI_COMPLETION') {
                content.innerHTML = `
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">System Prompt</label>
                        <textarea id="cfg-sys" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono focus:border-purple-500 outline-none" rows="3">${data.system_prompt || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-400 mb-1 flex justify-between">
                            <span>User Prompt ({{var}})</span>
                            <button onclick="startDictation(this, 'cfg-user')" class="text-purple-400 hover:text-purple-300 text-xs">🎤 Dictate</button>
                        </label>
                        <textarea id="cfg-user" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono focus:border-purple-500 outline-none" rows="4">${data.user_prompt || ''}</textarea>
                    </div>
                     <div>
                        <label class="block text-xs text-gray-400 mb-1">Output Variable</label>
                        <input id="cfg-out" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.output_var || 'ai_result'}">
                    </div>
                `;
            }
            else if (type === 'HTML_TEMPLATE') {
                content.innerHTML = `
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">HTML Template</label>
                        <textarea id="cfg-tpl" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono focus:border-orange-500 outline-none" rows="8">${data.template || ''}</textarea>
                    </div>
                     <div>
                        <label class="block text-xs text-gray-400 mb-1">Output Variable</label>
                        <input id="cfg-out" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.output_var || 'html_content'}">
                    </div>
                `;
            }
            else if (type === 'SEND_EMAIL') {
                content.innerHTML = `
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">To (Column)</label>
                        <input id="cfg-to" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.to_field || 'email'}">
                    </div>
                     <div>
                        <label class="block text-xs text-gray-400 mb-1">Subject</label>
                        <input id="cfg-subj" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.subject || ''}">
                    </div>
                     <div>
                        <label class="block text-xs text-gray-400 mb-1">Body (Variable)</label>
                        <input id="cfg-body" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.body_var || 'html_content'}">
                    </div>
                `;
            }
            else if (type === 'SEND_WHATSAPP') {
                content.innerHTML = `
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">Phone (Column)</label>
                        <input id="cfg-phone" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.phone_field || 'telefono'}">
                    </div>
                     <div>
                        <label class="block text-xs text-gray-400 mb-1">Message (Variable)</label>
                        <input id="cfg-msg" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.message_var || 'ai_result'}">
                    </div>
                `;
            }

            panel.classList.remove('hidden');
            panel.classList.add('flex');
        }

        function saveNodeConfig() {
            if (!currentNodeId) return;
            const node = editor.getNodeFromId(currentNodeId);
            const type = node.name;
            const data = node.data.config || {};

            // Extract values based on type
            if (type === 'AI_COMPLETION') {
                data.system_prompt = document.getElementById('cfg-sys').value;
                data.user_prompt = document.getElementById('cfg-user').value;
                data.output_var = document.getElementById('cfg-out').value;
            }
            else if (type === 'HTML_TEMPLATE') {
                data.template = document.getElementById('cfg-tpl').value;
                data.output_var = document.getElementById('cfg-out').value;
            }
            else if (type === 'SEND_EMAIL') {
                data.to_field = document.getElementById('cfg-to').value;
                data.subject = document.getElementById('cfg-subj').value;
                data.body_var = document.getElementById('cfg-body').value;
            }
            else if (type === 'SEND_WHATSAPP') {
                data.phone_field = document.getElementById('cfg-phone').value;
                data.message_var = document.getElementById('cfg-msg').value;
            }

            // Update Drawflow Data
            editor.updateNodeDataFromId(currentNodeId, { config: data });

            // Visual Feedback
            const btn = document.querySelector('#node-config-panel button');
            const originalText = btn.innerText;
            btn.innerText = "Saved!";
            btn.classList.add('bg-green-600');
            setTimeout(() => {
                btn.innerText = originalText;
                btn.classList.remove('bg-green-600');
            }, 1000);
        }

        function zoomEditor(delta) {
            editor.zoom += delta;
            editor.zoom_refresh();
        }

        // --- LOAD/SAVE WORKFLOW ---
        // (Replaces renderWorkflow which was for list view)
        function renderWorkflow() {
            // This function is now just "Load Drawflow Data"
            if (editor) {
                editor.clear(); // Clear canvas
                if (currentWorkflow && Object.keys(currentWorkflow).length > 0) {
                    // If it's the old array format, we can't load it directly. 
                    // TODO: Migration logic or just reset.
                    // Assuming new format is JSON object from Drawflow export
                    try {
                        editor.import(currentWorkflow);
                    } catch (e) {
                        console.error("Invalid workflow format for Drawflow", e);
                        // Initialize with empty or default trigger if needed
                    }
                } else {
                    // Add default Trigger node?
                }
            } else {
                // Init if not already
                initDrawflow();
                // Try again
                if (editor && currentWorkflow) {
                    try { editor.import(currentWorkflow); } catch (e) { }
                }
            }
        }

        // Update saveConfig to export Drawflow data
        // Found in saveConfig(): workflow_json: currentWorkflow
        // We need to update currentWorkflow global variable before save

        function updateGlobalWorkflowVar() {
            if (editor) {
                currentWorkflow = editor.export();
            }
        }

        // --- DICTATION (Updated) ---
        function startDictation(btn, targetId) {
            const textarea = document.getElementById(targetId);
            if (!('webkitSpeechRecognition' in window)) {
                alert("Web Speech API not supported in this browser.");
                return;
            }
            const recognition = new webkitSpeechRecognition();
            recognition.lang = 'it-IT';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            btn.classList.add('text-red-500', 'animate-pulse');
            btn.innerText = "🔴 Listening...";

            recognition.start();

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                // Insert at cursor
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                textarea.value = text.substring(0, start) + transcript + text.substring(end);

                // Trigger input event to save
                textarea.dispatchEvent(new Event('input'));
            };

            recognition.onend = () => {
                btn.classList.remove('text-red-500', 'animate-pulse');
                btn.innerText = "🎤 Dictate";
            };

            recognition.onerror = (event) => {
                console.error(event.error);
                btn.classList.remove('text-red-500', 'animate-pulse');
                btn.innerText = "🎤 Error";
            };
        } recognition.start();

        document.getElementById('global-settings-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerText = "Saving...";

            const payload = {
                service_account_json: document.getElementById('g-sa-json').value,
                google_api_key: document.getElementById('g-api-key').value,
                default_sheet_id: document.getElementById('g-sheet-id').value
            };

            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    closeSettings();
                    showStatus('success', 'Settings Saved', 'Global credentials updated.');
                } else {
                    throw new Error(data.message);
                }
            } catch (e) {
                showStatus('error', 'Save Failed', e.message);
            } finally {
                btn.innerText = originalText;
            }
        });

        // --- CHANGELOG LOGIC ---
        async function fetchSystemInfo() {
            try {
                const res = await fetch('/api/system/info');

                let data = { version: '0.5.0', changelog: 'Changelog not available (Server update required)' };

                if (res.ok) {
                    try {
                        data = await res.json();
                    } catch (e) {
                        console.warn('Failed to parse system info JSON', e);
                    }
                } else {
                    console.warn('System info endpoint not found (Server might need restart)');
                }

                // Update Version Badge
                const vElement = document.getElementById('app-version');
                if (vElement) vElement.innerText = "v" + (data.version || '0.5.0');

                // Helper to prevent crash on replace
                const rawChangelog = data.changelog || '';

                // Render Markdown (Basic regex parser for now)
                let html = rawChangelog
                    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-gray-200 mt-4 mb-2">$1</h3>')
                    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-blue-400 mt-6 mb-3 border-b border-gray-700 pb-2">$1</h2>')
                    .replace(/^\- \*\*(.*?)\*\*: (.*$)/gim, '<li class="ml-4 list-disc"><strong class="text-emerald-400">$1</strong>: $2</li>')
                    .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc text-gray-300">$1</li>')
                    .replace(/\n/gim, '<br>');

                const contentElement = document.getElementById('changelog-content');
                if (contentElement) contentElement.innerHTML = html;

            } catch (e) {
                console.error("Failed to load system info", e);
            }
        }

        function openChangelog() {
            document.getElementById('changelog-modal').classList.remove('hidden');
            document.getElementById('changelog-modal').classList.add('flex');
            fetchSystemInfo(); // Refresh on open
        }

        // Init
        document.addEventListener('DOMContentLoaded', () => {
            console.log("DOM Ready. Initializing...");

            // Fetch Projects
            fetchProjects().then(() => console.log("Projects fetched")).catch(err => console.error("Init fetchProjects failed:", err));

            // Fetch System Info
            fetchSystemInfo();

            // Check URL Params for deep linking
            const urlParams = new URLSearchParams(window.location.search);
            const projectId = urlParams.get('project');
            if (projectId) {
                console.log("Found project ID in URL:", projectId);
                // Wait a bit for components to hydrate if needed
                setTimeout(() => openConfig(projectId), 500);
            }
        });
