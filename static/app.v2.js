// App Initialized
console.log("App.js loaded externally");


// --- UI UTILS ---
let currentProjectId = null;
let lastExecutionResult = null;

function showToast(type, title, msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    // Enhanced Toast Styling: Wider box, better readability
    toast.className = `pointer-events-auto w-[600px] max-w-[90vw] shadow-2xl rounded-xl ring-1 ring-white/10 transition transform duration-300 ease-out translate-y-2 opacity-0 mb-4 ${type === 'success' ? 'bg-gray-800 border-l-8 border-green-500' : 'bg-gray-900 border-l-8 border-red-500'}`;

    toast.innerHTML = `
                <div class="p-5">
                    <div class="flex items-start">
                        <div class="flex-shrink-0">
                            ${type === 'success'
            ? '<span class="text-3xl">✅</span>'
            : '<span class="text-3xl">❌</span>'}
                        </div>
                        <div class="ml-4 w-0 flex-1 pt-1">
                            <p class="text-xl font-bold text-white leading-6 mb-2">${title}</p>
                            <p class="text-base text-gray-300 leading-relaxed">${msg}</p>
                        </div>
                        <div class="ml-4 flex-shrink-0 flex">
                            <button onclick="this.closest('div').parentElement.parentElement.remove()" class="rounded-md inline-flex text-gray-400 hover:text-white focus:outline-none">
                                <span class="sr-only">Close</span>
                                <svg class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
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

    // Auto Remove (Extended time)
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 6000);
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
    ['tab-general', 'tab-ai', 'tab-products', 'tab-media', 'tab-workflow', 'tab-integrations'].forEach(t => {
        const el = document.getElementById(t);
        if (el) el.classList.add('hidden');

        const btn = document.getElementById('btn-' + t);
        if (btn) {
            btn.classList.remove('border-blue-500', 'text-blue-400');
            btn.classList.add('border-transparent', 'text-gray-400');
        }
    });

    document.getElementById(tabId).classList.remove('hidden');
    const btn = document.getElementById('btn-' + tabId);
    btn.classList.remove('border-transparent', 'text-gray-400');
    btn.classList.add('border-blue-500', 'text-blue-400');

    // Toggle Toolbar for Workflow
    const toolbar = document.getElementById('workflow-toolbar');
    if (toolbar) {
        if (tabId === 'tab-workflow') {
            toolbar.classList.remove('hidden');
            toolbar.classList.add('flex');
        } else {
            toolbar.classList.add('hidden');
            toolbar.classList.remove('flex');
        }
    }

    if (tabId === 'tab-media') {
        loadMedia();
    }
}

// --- OUTPUT MODAL LOGIC ---
function showOutput() {
    const modal = document.getElementById('output-modal');
    const content = document.getElementById('output-content');

    if (!lastExecutionResult) {
        showStatus('error', 'No Output', 'Run the workflow first to see results.');
        return;
    }

    content.innerText = JSON.stringify(lastExecutionResult, null, 2);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function copyOutput() {
    if (!lastExecutionResult) return;
    navigator.clipboard.writeText(JSON.stringify(lastExecutionResult, null, 2)).then(() => {
        showStatus('success', 'Copied', 'JSON copied to clipboard');
    });
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

// --- MEDIA LIBRARY LOGIC ---
let currentMedia = [];
let mediaSelectorCallback = null; // To handle product linking

async function loadMedia() {
    if (!currentProjectId) return;
    const grid = document.getElementById('media-grid');
    grid.innerHTML = '<p class="col-span-full text-gray-500 text-center py-8">Loading media...</p>';

    try {
        const res = await fetch(`/api/projects/${currentProjectId}/media`);
        currentMedia = await res.json();
    } catch (e) {
        console.error("Failed to load media", e);
        currentMedia = [];
    }
    renderMediaGrid();
}

function renderMediaGrid() {
    const grid = document.getElementById('media-grid');
    grid.innerHTML = '';

    if (currentMedia.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-gray-500 text-center py-8">No files uploaded yet.</p>';
        return;
    }

    currentMedia.forEach(file => {
        const div = document.createElement('div');
        div.className = "bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-blue-500 transition group relative aspect-square flex flex-col items-center justify-center text-center cursor-pointer";
        div.innerHTML = `
            <div class="text-4xl mb-2">${file.icon}</div>
            <div class="text-xs font-medium text-gray-300 truncate w-full px-2" title="${file.name}">${file.name}</div>
            <div class="text-[10px] text-gray-500 mt-1">${(file.size / 1024).toFixed(1)} KB</div>
            
            ${file.ai_summary ? '<div class="absolute top-2 left-2 text-xs" title="AI Summary Available">✨</div>' : ''}
            
            <button class="delete-media-btn absolute top-2 right-2 text-gray-600 hover:text-red-500 hidden group-hover:block bg-gray-900 rounded-full p-1" title="Delete">
                 <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        `;

        // Handle Click (Select or Preview)
        div.onclick = (e) => {
            if (e.target.closest('.delete-media-btn')) return;

            if (mediaSelectorCallback) {
                // Link Mode
                mediaSelectorCallback(file);
                // Close modal (if we had one, but we are reusing tab for now?)
                // Actually, let's assume we are just clicking in the tab unless we build a specific modal.
                // For "Link File from Media", we need a modal.
                // Let's implement a simple prompt or simple modal selector later.
                // For now, let's copy filename to clipboard on click?
            } else {
                // View/Download
                // window.open(file.url, '_blank');
            }
        };

        div.querySelector('.delete-media-btn').onclick = async () => {
            if (!confirm(`Delete ${file.name}?`)) return;
            await fetch(`/api/projects/${currentProjectId}/media/${file.name}`, { method: 'DELETE' });
            loadMedia();
        };

        grid.appendChild(div);
    });
}

function handleMediaUpload(files) {
    if (!files || files.length === 0 || !currentProjectId) return;

    // Convert to array
    [...files].forEach(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        showStatus('info', 'Uploading...', `Uploading ${file.name}`);

        try {
            const res = await fetch(`/api/projects/${currentProjectId}/media/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                showStatus('success', 'Uploaded', `${file.name} saved.`);
            } else {
                throw new Error(data.message);
            }
        } catch (e) {
            showStatus('error', 'Upload Failed', e.message);
        }
    });

    // Refresh after delay
    setTimeout(loadMedia, 2000);
}

function handleMediaDrop(e) {
    e.preventDefault();
    e.target.classList.remove('border-blue-500', 'bg-gray-800/50');
    handleMediaUpload(e.dataTransfer.files);
}

// Simple Media Selector Modal (Injected on demand)
let mediaSelectorResolver = null;

function openMediaSelector(prodIndex) {
    // Create a temporary modal to select media
    // For simplicity, we'll just check if there are files and add "Pick" buttons to the existing Media Tab?
    // No, better to have a proper modal.

    // Quick hack: Use a simple Prompt or Alert for now, OR fetch list and show a custom overlay.
    // Let's build a dynamic overlay.

    if (currentMedia.length === 0) {
        alert("No media uploaded. Go to Media Library tab to upload files first.");
        return;
    }

    const mediaNames = currentMedia.map(m => m.name);
    const namesString = mediaNames.join('\n');
    const selected = prompt(`Enter filename to link (Copy from Media Library):\n\nAvailable:\n${namesString}`);

    if (selected && mediaNames.includes(selected)) {
        if (!currentProducts[prodIndex].knowledge) currentProducts[prodIndex].knowledge = [];
        currentProducts[prodIndex].knowledge.push({ name: selected });
        renderProducts();
    } else if (selected) {
        alert("File not found in library.");
    }
}

// --- PRODUCT CONFIG LOGIC ---


function renderProducts() {
    const list = document.getElementById('products-list');
    list.innerHTML = '';

    currentProducts.forEach((prod, index) => {
        const template = document.getElementById('product-template').content.cloneNode(true);
        const card = template.querySelector('.product-card'); // Scope constraint

        // Basic Fields
        template.querySelector('.prod-name').value = prod.name || '';
        template.querySelector('.prod-desc').value = Array.isArray(prod.descriptions) ? prod.descriptions.join('\n') : (prod.descriptions || '');

        // Attributes Visualization
        const attrContainer = template.querySelector('.prod-attributes');
        const attributes = prod.attributes || [];

        const renderAttrList = () => {
            attrContainer.innerHTML = '';
            attributes.forEach((attr, idx) => {
                const row = document.getElementById('attribute-row-template').content.cloneNode(true);
                row.querySelector('.attr-name').value = attr.name;
                row.querySelector('.attr-vals').value = attr.variants;

                // Bind Inputs
                row.querySelector('.attr-name').oninput = (e) => {
                    currentProducts[index].attributes[idx].name = e.target.value;
                };
                row.querySelector('.attr-vals').oninput = (e) => {
                    currentProducts[index].attributes[idx].variants = e.target.value;
                };
                row.querySelector('.del-attr-btn').onclick = () => {
                    currentProducts[index].attributes.splice(idx, 1);
                    renderProducts(); // Re-render to update
                };
                attrContainer.appendChild(row);
            });
        };
        renderAttrList();

        // Attribute Add Button
        template.querySelector('.add-attr-btn').onclick = () => {
            if (!currentProducts[index].attributes) currentProducts[index].attributes = [];
            currentProducts[index].attributes.push({ name: '', variants: '' });
            renderProducts();
        };

        // Knowledge Visualization
        const knContainer = template.querySelector('.prod-knowledge');
        const knowledge = prod.knowledge || []; // Array of filenames or objects

        knowledge.forEach((item, kIdx) => {
            const pill = document.createElement('div');
            pill.className = "bg-purple-900/40 border border-purple-500/30 text-purple-200 text-xs px-2 py-1 rounded flex items-center gap-1";
            pill.innerHTML = `<span>📄 ${typeof item === 'string' ? item : item.name}</span> <button class="text-purple-400 hover:text-white font-bold ml-1">×</button>`;
            pill.querySelector('button').onclick = () => {
                currentProducts[index].knowledge.splice(kIdx, 1);
                renderProducts();
            };
            knContainer.appendChild(pill);
        });

        // Link Media Button
        template.querySelector('.link-media-btn').onclick = () => {
            openMediaSelector(index);
        };

        // Price List Upload
        const priceBtn = template.querySelector('.upload-price-btn');
        const priceInput = template.querySelector('.upload-price-input');

        // Visual feedback if file exists
        if (prod.price_list_file) {
            priceBtn.classList.remove('bg-gray-700', 'text-gray-300');
            priceBtn.classList.add('bg-emerald-900/40', 'text-emerald-400', 'border-emerald-500/50');
            priceBtn.innerText = "📄 " + prod.price_list_file.split('/').pop();
        }

        priceBtn.onclick = () => priceInput.click();
        priceInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                uploadProductPriceList(e.target.files[0], index, priceBtn);
            }
        };

        // Delete Product
        template.querySelector('.delete-btn').onclick = () => removeProduct(index);

        // Bind Basic Inputs
        template.querySelector('.prod-name').oninput = (e) => currentProducts[index].name = e.target.value;
        template.querySelector('.prod-desc').oninput = (e) => currentProducts[index].descriptions = e.target.value.split('\n').filter(l => l.trim());

        list.appendChild(template);
    });
}

function addProduct() {
    currentProducts.push({
        id: crypto.randomUUID(),
        name: '',
        descriptions: [],
        attributes: [],
        knowledge: []
    });
    renderProducts();
}

async function removeProduct(index) {
    const confirmed = await showConfirm('Remove this product?');
    if (!confirmed) return;
    currentProducts.splice(index, 1);
    renderProducts();
}

async function uploadProductPriceList(file, index, btn) {
    if (!file || !currentProjectId) return;

    const originalText = btn.innerText;
    btn.innerText = "Uploading...";
    btn.disabled = true;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`/api/projects/${currentProjectId}/product-price-list?product_index=${index}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            showStatus('success', 'Uploaded', 'Price list attached to product.');
            currentProducts[index].price_list_file = data.filename;
            renderProducts();
        } else {
            throw new Error(data.message);
        }
    } catch (e) {
        showStatus('error', 'Upload Failed', e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
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
let currentHeaders = []; // Store sheet headers

async function openConfig(id) {
    currentProjectId = id; // Fix: Set global variable
    currentHeaders = []; // Reset

    // Fetch Data
    try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) throw new Error("Failed to load project");
        const project = await res.json();

        // Fetch Headers (Async)
        fetchHeaders(id);

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

        // Integrations
        try {
            const smtp = project.smtp_config ? JSON.parse(project.smtp_config) : {};
            document.getElementById('int-smtp-host').value = smtp.host || '';
            document.getElementById('int-smtp-port').value = smtp.port || '';
            document.getElementById('int-smtp-user').value = smtp.user || '';
            document.getElementById('int-smtp-pass').value = smtp.pass || '';
            document.getElementById('int-smtp-from').value = smtp.from_name || '';

            const wesender = project.wesendit_config ? JSON.parse(project.wesendit_config) : {};
            document.getElementById('int-wesender-key').value = wesender.api_key || '';
        } catch (e) {
            console.warn("Failed to parse integrations config", e);
        }

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

async function fetchHeaders(id) {
    try {
        const res = await fetch(`/api/projects/${id}/headers`);
        const data = await res.json();
        if (data.success) {
            currentHeaders = data.headers || [];
            console.log("Headers loaded:", currentHeaders);
        }
    } catch (e) {
        console.warn("Failed to fetch headers", e);
    }
}

function renderVarPicker(targetId, type = 'insert') {
    if (!currentHeaders || currentHeaders.length === 0) return '';

    const options = currentHeaders.map(h => `<option value="${h}">${h}</option>`).join('');

    if (type === 'select') {
        return options;
    }

    return `
        <select onchange="insertVar('${targetId}', this.value); this.value='';" class="bg-gray-700 text-xs text-blue-300 border border-gray-600 rounded px-1 ml-2 w-20 cursor-pointer">
            <option value="">+ Var</option>
            ${options}
        </select>
    `;
}

function insertVar(targetId, val) {
    const el = document.getElementById(targetId);
    if (!el) return;

    const tag = `{{${val}}}`;

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const text = el.value;
        el.value = text.substring(0, start) + tag + text.substring(end);
        el.dispatchEvent(new Event('input')); // Trigger update
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

    // Gather Data
    const projectData = {
        name: document.getElementById('c-name').value,
        description: document.getElementById('c-desc').value,
        status: document.getElementById('c-status').value,
        google_sheet_id: document.getElementById('c-sheet').value,
        service_account_json: document.getElementById('c-json').value,
        cron_expression: document.getElementById('c-cron').value,
        price_list_url: document.getElementById('c-price-url').value, // Used as ID reference
        locality_prompt: document.getElementById('c-locality-prompt').value,
        products_config: currentProducts,
        workflow_json: currentWorkflow,
        smtp_config: {
            host: document.getElementById('int-smtp-host').value,
            port: document.getElementById('int-smtp-port').value,
            user: document.getElementById('int-smtp-user').value,
            pass: document.getElementById('int-smtp-pass').value,
            from_name: document.getElementById('int-smtp-from').value
        },
        wesendit_config: {
            api_key: document.getElementById('int-wesender-key').value
        }
    };

    try {
        const res = await fetch(`/api/projects/${currentProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });

        if (!res.ok) throw new Error("Update failed");
        const data = await res.json();

        // closeConfig(); // User requested to keep it open to test connections
        showStatus('success', 'Saved!', 'Project configuration updated successfully.');
        // fetchProjects(); // Background refresh only? or maybe skipping to avoid grid re-render flickering

        // Update local cache of this project in the grid list without full reload?
        // For now, let's just keep it open.

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
        const res = await fetch('/api/projects?t=' + new Date().getTime());
        if (!res.ok) throw new Error(`API Error: ${res.status}`);

        const data = await res.json();
        console.log("API Response Data:", data); // DEBUG LOG

        if (!data.projects) throw new Error("Invalid API response: no projects key");

        console.log(`FETCH SUCCESS: Found ${data.projects.length} projects. Rendering...`);

        const grid = document.getElementById('projects-grid');
        if (grid) {
            console.log("Grid element found. Updating HTML...");
            document.getElementById('project-count').innerText = data.projects.length;

            if (data.projects.length === 0) {
                console.log("No projects to render (list empty).");
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

function handleCreateProject(e) {
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

    fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(async res => {
            if (res.ok) {
                closeModal();
                fetchProjects();
                e.target.reset();
                showStatus('success', 'Project Created', 'You can now configure the workflow.');
            } else {
                throw new Error('Failed to create project');
            }
        })
        .catch(err => {
            alert('Error creating project: ' + err);
        })
        .finally(() => {
            btn.innerText = originalText;
        });
}

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

function handleConfirmDelete() {
    if (!projectToDeleteId) return;

    const btn = document.getElementById('confirm-delete-btn');
    const originalText = btn.innerText;
    btn.innerText = "Deleting...";
    btn.disabled = true;

    fetch(`/api/projects/${projectToDeleteId}`, { method: 'DELETE' })
        .then(() => {
            closeDeleteModal();
            fetchProjects();
            showStatus('success', 'Project Deleted', 'The project has been permanently removed.');
        })
        .catch(e => {
            showStatus('error', 'Delete Failed', e.message);
        })
        .finally(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        });
}

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
    editor.zoom_max = 1.6;
    editor.zoom_min = 0.5;
    editor.zoom_value = 0.1;
    editor.start();

    // Event Listeners
    editor.on('nodeCreated', function (id) {
        console.log("Node created " + id);
    });

    // Fix: Explicit Wheel Event for Zoom to prevent scrolling
    const container = document.getElementById("drawflow");
    container.addEventListener('wheel', function (e) {
        // Simple zoom logic
        if (e.ctrlKey || e.metaKey || e.altKey) {
            e.preventDefault();
            if (e.deltaY > 0) editor.zoom_out();
            else editor.zoom_in();
            return;
        }
        // Or just always zoom if over canvas?
        // User asked for zoom with mouse wheel. Standard behavior is usually Ctrl+Wheel or just Wheel if it's a canvas tool.
        // Let's go with just Wheel for now, but ensure we don't block scrolling if we are at limits?
        // Drawflow zoom doesn't return limits easily.

        e.preventDefault();
        if (e.deltaY > 0) editor.zoom_out();
        else editor.zoom_in();
    }, { passive: false });


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

// Fallback to ensure the function is fully replaced if the range above was partial
// Fallback: Handle click but respect drag
function forceSelectNode(el) {
    return; // Disabled to restore native drag
    // Old logic disabled:
    // Determine if we are dragging (Drawflow sets editor_selected to true on drag start usually)
    // A simple way is to check if the mouse moved, but here we are in an onclick.
    // We'll use a small timeout to allow Drawflow to capture the click first if needed.

    setTimeout(() => {
        // If we really need to force selection:
        const nodeEl = el.closest('.drawflow-node');
        if (!nodeEl) return;
        const id = nodeEl.id.replace('node-', '');

        // Check if we are actually in drag mode? 
        // For now, let's just trigger selection and hope it doesn't break drag.
        // verified: The issue was likely onclick stopping propagation.

        currentNodeId = id;
        showNodeConfig(id);

        // Highlight visual selection manually if needed
        document.querySelectorAll('.drawflow-node').forEach(n => n.classList.remove('selected'));
        nodeEl.classList.add('selected');
    }, 10);
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
    // Normalized Type
    const safeType = type.toUpperCase();

    if (safeType === 'TRIGGER') {
        html = `
            <div class="node-content trigger-node">
                <div class="title-box">⚡ Trigger</div>
                <div class="box">
                    <p>Cron / Webhook</p>
                </div>
            </div>`;
        inputs = 0; outputs = 1;
    } else if (safeType === 'AI_COMPLETION') {
        html = `
            <div class="node-content ai-node">
                <div class="title-box">✨ AI Completion</div>
                <div class="box">
                    <p>Gen Text/JSON</p>
                </div>
            </div>`;
    } else if (safeType === 'HTML_TEMPLATE') {
        html = `
            <div class="node-content html-node">
                <div class="title-box">📄 HTML Template</div>
                <div class="box">
                    <p>Build HTML</p>
                </div>
            </div>`;
    } else if (safeType === 'SEND_EMAIL') {
        html = `
            <div class="node-content email-node">
                <div class="title-box">📧 Send Email</div>
                <div class="box">
                    <p>SMTP/Gmail</p>
                </div>
            </div>`;
        inputs = 1; outputs = 0;
    } else if (safeType === 'SEND_WHATSAPP') {
        html = `
            <div class="node-content wa-node">
                <div class="title-box">💬 WhatsApp</div>
                <div class="box">
                    <p>WeSender</p>
                </div>
            </div>`;
        inputs = 1; outputs = 0;
    } else {
        console.warn("Unknown Node Type:", type);
        // Fallback for visual debugging but maybe we should prevent adding?
        // Let's keep it but make it clear
        html = `<div class="node-content unknown-node bg-red-900/50 border border-red-500 rounded p-2">
                    <div class="title-box text-red-300">⚠️ Unknown</div>
                    <div class="text-xs text-red-200">Type: ${type}</div>
                </div>`;
    }

    // Add Node
    editor.addNode(safeType, inputs, outputs, pos_x, pos_y, safeType, { config: {} }, html);
}

async function deleteSelectedNode() {
    if (!currentNodeId) return;
    const confirmed = await showConfirm("Delete this node? This cannot be undone.");
    if (confirmed) {
        editor.removeNodeId('node-' + currentNodeId);
        document.getElementById('node-config-panel').classList.add('hidden');
        document.getElementById('node-config-panel').classList.remove('flex');
        currentNodeId = null;

        // SAVE IMMEDIATELY
        await saveConfig();
        showStatus('success', 'Deleted', 'Node removed and workflow saved.');
    }
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

    if (type === 'TRIGGER') {
        const triggerType = data.trigger_type || 'cron';
        content.innerHTML = `
            <div>
                <label class="block text-xs text-gray-400 mb-1">Trigger Type</label>
                <select id="cfg-type" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs outline-none focus:border-blue-500" 
                    onchange="
                        document.getElementById('field-cron').classList.toggle('hidden', this.value !== 'cron'); 
                        document.getElementById('field-webhook').classList.toggle('hidden', this.value !== 'webhook');
                        document.getElementById('field-sheet').classList.toggle('hidden', this.value !== 'google_sheet');
                        document.getElementById('field-manual').classList.toggle('hidden', this.value !== 'manual');
                    ">
                    <option value="cron" ${triggerType === 'cron' ? 'selected' : ''}>Cron Schedule</option>
                    <option value="webhook" ${triggerType === 'webhook' ? 'selected' : ''}>Webhook</option>
                    <option value="google_sheet" ${triggerType === 'google_sheet' ? 'selected' : ''}>Google Sheet</option>
                    <option value="manual" ${triggerType === 'manual' ? 'selected' : ''}>Manual Trigger</option>
                </select>
            </div>
            
            <div id="field-cron" class="${triggerType === 'cron' ? '' : 'hidden'}">
                <label class="block text-xs text-gray-400 mb-1 mt-2">Cron Preset</label>
                <select id="cfg-cron-preset" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs outline-none focus:border-blue-500 mb-2"
                    onchange="if(this.value) document.getElementById('cfg-cron').value = this.value;">
                    <option value="">Custom...</option>
                    <option value="* * * * *">Every Minute</option>
                    <option value="*/5 * * * * ">Every 5 Minutes</option>
        < option value = "*/10 * * * *" > Every 10 Minutes</option >
                    <option value="*/15 * * * *">Every 15 Minutes</option>
                    <option value="*/30 * * * *">Every 30 Minutes</option>
                    <option value="0 * * * *">Every Hour</option>
                    <option value="0 */2 * * *">Every 2 Hours</option>
                    <option value="0 */4 * * *">Every 4 Hours</option>
                    <option value="0 */8 * * *">Every 8 Hours</option>
                    <option value="0 */12 * * *">Every 12 Hours</option>
                    <option value="0 9 * * *">Daily at 9 AM</option>
                    <option value="0 12 * * *">Daily at 12 PM</option>
                    <option value="0 18 * * *">Daily at 6 PM</option>
                    <option value="0 0 * * *">Daily at Midnight</option>
                    <option value="0 9 * * 1">Weekly on Monday 9 AM</option>
                    <option value="0 9 * * 5">Weekly on Friday 9 AM</option>
                    <option value="0 0 1 * *">Monthly on 1st</option>
                </select >
                <label class="block text-xs text-gray-400 mb-1">Cron Expression</label>
                <input id="cfg-cron" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.cron_expression || '0 * * * *'}" placeholder="* * * * *">
                <p class="text-[10px] text-gray-500 mt-1">e.g. "0 9 * * *" for daily at 9am</p>
            </div>

            <div id="field-webhook" class="${triggerType === 'webhook' ? '' : 'hidden'}">
                <label class="block text-xs text-gray-400 mb-1 mt-2">Method</label>
                <select id="cfg-method" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs outline-none focus:border-blue-500">
                    <option value="GET" ${data.webhook_method === 'GET' ? 'selected' : ''}>GET</option>
                    <option value="POST" ${data.webhook_method === 'POST' ? 'selected' : ''}>POST</option>
                </select>
            </div>

            <div id="field-sheet" class="${triggerType === 'google_sheet' ? '' : 'hidden'}">
                <label class="block text-xs text-gray-400 mb-1 mt-2">Event</label>
                <select id="cfg-sheet-event" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs outline-none focus:border-blue-500">
                    <option value="new_row" ${data.sheet_event === 'new_row' ? 'selected' : ''}>New Row Added</option>
                    <option value="change_status" ${data.sheet_event === 'change_status' ? 'selected' : ''}>Cell/Status Change</option>
                </select>
            </div>

            <div id="field-manual" class="${triggerType === 'manual' ? '' : 'hidden'}">
                <p class="text-xs text-gray-500 mt-2">This workflow will only run when manually triggered via the "Run Workflow" button.</p>
            </div>
    `;
    }
    else if (type === 'AI_COMPLETION') {
        content.innerHTML = `
        < div >
                <label class="block text-xs text-gray-400 mb-1">Model Version</label>
                <select id="cfg-model" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs outline-none focus:border-blue-500 mb-2">
                    <option value="gemini-2.0-flash" ${data.model === 'gemini-2.0-flash' ? 'selected' : ''}>Gemini 2.0 Flash (Fast)</option>
                    <option value="gemini-1.5-pro" ${data.model === 'gemini-1.5-pro' ? 'selected' : ''}>Gemini 1.5 Pro (Powerful)</option>
                </select>

                <label class="block text-xs text-gray-400 mb-1">System Instruction</label>
                <div class="flex flex-wrap gap-1 mb-1" id="headers-container-sys">
                    <!-- Headers injected here -->
                    <span class="text-[10px] text-gray-500">Loading headers...</span>
                </div>
                <textarea id="cfg-system" rows="3" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" placeholder="You are a helpful assistant...">${data.system_prompt || ''}</textarea>
                
                <label class="block text-xs text-gray-400 mb-1 mt-2">Schema Instruction (JSON Strict)</label>
                <textarea id="cfg-schema" rows="3" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" placeholder="Generate a JSON with keys: greeting, table, technical_section...">${data.schema_instruction || ''}</textarea>

                <label class="block text-xs text-gray-400 mb-1 mt-2">HTML Template (Optional)</label>
                 <div class="flex items-center mb-1">
                    <select onchange="insertVar('cfg-html', this.value); this.value='';" class="bg-gray-700 text-xs text-blue-300 border border-gray-600 rounded px-1 ml-auto w-20 cursor-pointer">
                        <option value="">+ Var</option>
                        ${renderVarPicker(null, 'select')}
                    </select>
                </div>
                <textarea id="cfg-html" rows="4" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" placeholder="<html><body>...{{ai_output}}...</body></html>">${data.html_template || ''}</textarea>
                
                <label class="block text-xs text-gray-400 mb-1 mt-2">Temperature</label>
                <input id="cfg-temp" type="number" step="0.1" min="0" max="1" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.temperature || 0.3}">
            </div>
            <script>
                // Fetch Headers Helper
                (async () => {
                    const cid = "${id}";
                    if(!currentProjectId) return;
                    try {
                        const res = await fetch(\`/api/projects/\${currentProjectId}/headers\`);
                        const json = await res.json();
                        const container = document.getElementById('headers-container-sys');
                        if(json.success && json.headers && container) {
                            container.innerHTML = '';
                            json.headers.forEach(h => {
                                const tag = document.createElement('span');
                                tag.className = 'bg-gray-700 hover:bg-gray-600 text-blue-300 px-1 rounded cursor-pointer text-[10px] border border-gray-600';
                                tag.innerText = h;
                                tag.onclick = () => {
                                    const area = document.getElementById('cfg-system');
                                    const start = area.selectionStart;
                                    area.value = area.value.substring(0, start) + "{{" + h + "}}" + area.value.substring(area.selectionEnd);
                                };
                                container.appendChild(tag);
                            });
                        } else if(container) {
                             container.innerHTML = '<span class="text-[10px] text-red-400">No headers found</span>';
                        }
                    } catch(e) { console.error(e); }
                })();
            </script>
            <div>
                <label class="block text-xs text-gray-400 mb-1 flex justify-between items-center">
                    <span>User Prompt</span>
                    <div class="flex items-center">
                        ${renderVarPicker('cfg-user')}
                        <button onclick="startDictation(this, 'cfg-user')" class="text-purple-400 hover:text-purple-300 text-xs ml-2">🎤</button>
                    </div>
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
        < div >
                <label class="block text-xs text-gray-400 mb-1 flex justify-between">
                    <span>HTML Template</span>
                    ${renderVarPicker('cfg-tpl')}
                </label>
                <textarea id="cfg-tpl" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono focus:border-orange-500 outline-none" rows="8">${data.template || ''}</textarea>
            </div >
        <div>
            <label class="block text-xs text-gray-400 mb-1">Output Variable</label>
            <input id="cfg-out" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.output_var || 'html_content'}">
        </div>
    `;
    }
    else if (type === 'SEND_EMAIL') {
        content.innerHTML = `
        < div >
                <label class="block text-xs text-gray-400 mb-1">To Column (Select)</label>
                 <div class="flex gap-2">
                    <input id="cfg-to" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.to_field || 'email'}" placeholder="Enter column name">
                    ${renderVarPicker('cfg-to')}
                 </div>
                 <p class="text-[10px] text-gray-500 mt-1">Select from sheet headers</p>
            </div >
                <div>
                <label class="block text-xs text-gray-400 mb-1 flex justify-between">
                    <span>Subject</span>
                    ${renderVarPicker('cfg-subj')}
                </label>
                <input id="cfg-subj" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.subject || ''}">
            </div>
                <div>
                <label class="block text-xs text-gray-400 mb-1">Body (Variable from previous step)</label>
                <input id="cfg-body" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.body_var || 'html_content'}">
            </div>
    `;
    }
    else if (type === 'SEND_WHATSAPP') {
        content.innerHTML = `
        < div >
                <label class="block text-xs text-gray-400 mb-1">Phone Column</label>
                 <div class="flex gap-2">
                    <input id="cfg-phone" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.phone_field || 'telefono'}" placeholder="Column name">
                    ${renderVarPicker('cfg-phone')}
                 </div>
            </div >
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
    if (type === 'TRIGGER') {
        data.trigger_type = document.getElementById('cfg-type').value;
        if (data.trigger_type === 'cron') {
            data.cron_expression = document.getElementById('cfg-cron').value;
            delete data.webhook_method;
            delete data.sheet_event;
        } else if (data.trigger_type === 'webhook') {
            data.webhook_method = document.getElementById('cfg-method').value;
            delete data.cron_expression;
            delete data.sheet_event;
        } else if (data.trigger_type === 'google_sheet') {
            data.sheet_event = document.getElementById('cfg-sheet-event').value;
            delete data.cron_expression;
            delete data.webhook_method;
        } else {
            // Manual
            delete data.cron_expression;
            delete data.webhook_method;
            delete data.sheet_event;
        }
    }
    else if (type === 'AI_COMPLETION') {
        data.model = document.getElementById('cfg-model').value;
        data.system_prompt = document.getElementById('cfg-system').value;
        data.schema_instruction = document.getElementById('cfg-schema').value;
        data.html_template = document.getElementById('cfg-html').value;
        data.temperature = parseFloat(document.getElementById('cfg-temp').value) || 0.3;
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
            // REPAIR: Fix Unknown nodes before import
            try { repairWorkflow(currentWorkflow); } catch (e) { console.error("Repair failed", e); }

            // Check if it's the new JSON spec or old Drawflow export
            if (currentWorkflow.drawflow) {
                try { editor.import(currentWorkflow); } catch (e) { console.error("Import failed", e); }
            } else {
                try { editor.import(currentWorkflow); } catch (e) { }
            }
        }
    } else {
        // Init if not already
        initDrawflow();
        if (editor && currentWorkflow) {
            try { repairWorkflow(currentWorkflow); } catch (e) { }
            try { editor.import(currentWorkflow); } catch (e) { }
        }
    }
}

function repairWorkflow(json) {
    if (!json || !json.drawflow || !json.drawflow.Home || !json.drawflow.Home.data) return;

    const nodes = json.drawflow.Home.data;
    Object.values(nodes).forEach(node => {
        // If HTML is missing or Unknown, regenerate it
        if (!node.html || node.html.includes('Unknown') || node.html.includes('UNKNOWN')) {
            console.log(`Reparing node ${node.id} (${node.name})`);

            // Re-use templates (should ideally be shared const, but duplicating for safety here)
            let html = `<div>Unknown</div>`;
            const type = node.name.toUpperCase();

            if (type === 'TRIGGER') {
                html = `<div class="node-content trigger-node"><div class="title-box">⚡ Trigger</div><div class="box"><p>Cron / Webhook</p></div></div>`;
            } else if (type === 'AI_COMPLETION') {
                html = `<div class="node-content ai-node"><div class="title-box">✨ AI Completion</div><div class="box"><p>Gen Text/JSON</p></div></div>`;
            } else if (type === 'HTML_TEMPLATE') {
                html = `<div class="node-content html-node"><div class="title-box">📄 HTML Template</div><div class="box"><p>Build HTML</p></div></div>`;
            } else if (type === 'SEND_EMAIL') {
                html = `<div class="node-content email-node"><div class="title-box">📧 Send Email</div><div class="box"><p>SMTP/Gmail</p></div></div>`;
            } else if (type === 'SEND_WHATSAPP') {
                html = `<div class="node-content wa-node"><div class="title-box">💬 WhatsApp</div><div class="box"><p>WeSender</p></div></div>`;
            }

            if (html !== `<div>Unknown</div>`) {
                node.html = html;
            }
        }
    });
}

// Update saveConfig to export Drawflow data
// Found in saveConfig(): workflow_json: currentWorkflow
// We need to update currentWorkflow global variable before save

function updateGlobalWorkflowVar() {
    if (editor) {
        currentWorkflow = editor.export();
    }
}

// [DEPRECATED] Duplicate saveConfig removed. 
// Uses the main saveConfig() defined above which includes all fields.

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
}

function handleGlobalSettings(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";

    const payload = {
        service_account_json: document.getElementById('g-sa-json').value,
        google_api_key: document.getElementById('g-api-key').value,
        default_sheet_id: document.getElementById('g-sheet-id').value
    };

    fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(async res => {
            const data = await res.json();
            if (data.success) {
                closeSettings();
                showStatus('success', 'Settings Saved', 'Global credentials updated.');
            } else {
                throw new Error(data.message);
            }
        })
        .catch(e => {
            showStatus('error', 'Save Failed', e.message);
        })
        .finally(() => {
            btn.innerText = originalText;
        });
}

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

// --- INTEGRATION TESTS ---
async function testEmail() {
    const host = document.getElementById('int-smtp-host').value;
    const port = document.getElementById('int-smtp-port').value;
    const user = document.getElementById('int-smtp-user').value;
    const pass = document.getElementById('int-smtp-pass').value;
    const from = document.getElementById('int-smtp-from').value;

    if (!host || !user || !pass) {
        showStatus('error', 'Missing Fields', 'Please fill Host, User and Password.');
        return;
    }

    showStatus('loading', 'Testing SMTP...', 'Sending test email...');

    try {
        const res = await fetch('/api/test/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port, user, pass, from_name: from })
        });
        const data = await res.json();
        if (data.success) {
            showStatus('success', 'Email Sent', 'Check your inbox for the test email.');
        } else {
            throw new Error(data.message);
        }
    } catch (e) {
        showStatus('error', 'Test Failed', e.message);
    }
}

async function testWhatsApp() {
    const apiKey = document.getElementById('int-wesender-key').value;
    if (!apiKey) {
        showStatus('error', 'Missing Key', 'Please enter WeSender API Key.');
        return;
    }

    const phone = prompt("Enter phone number to send test message (e.g. +39...)");
    if (!phone) return;

    showStatus('loading', 'Testing WhatsApp...', 'Sending test message...');

    try {
        const res = await fetch('/api/test/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey, phone: phone })
        });
        const data = await res.json();
        if (data.success) {
            showStatus('success', 'Message Sent', 'Check WhatsApp.');
        } else {
            throw new Error(data.message);
        }
    } catch (e) {
        showStatus('error', 'Test Failed', e.message);
    }
}

function runWorkflow() {
    if (!currentProjectId) {
        showStatus('error', 'Error', 'No project selected.');
        return;
    }

    // Find button elements
    const btn = document.querySelector('button[onclick="runWorkflow()"]');
    const spinner = document.getElementById('run-spinner');
    const outputBtn = document.getElementById('btn-view-output'); // NEW: Get output button

    const setRunning = (isRunning) => {
        if (btn) {
            btn.disabled = isRunning;
            if (isRunning) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                if (spinner) spinner.classList.remove('hidden');
                if (outputBtn) outputBtn.classList.add('hidden'); // Hide output while running
            } else {
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                if (spinner) spinner.classList.add('hidden');
            }
        }
    };

    setRunning(true);
    saveConfig().then(() => {
        // Fixed URL spaces
        fetch(`/api/projects/${currentProjectId}/run`, { method: 'POST' })
            .then(async res => {
                const data = await res.json();
                lastExecutionResult = data; // NEW: Save Global Result

                if (data.status === 'error' || data.status === 'failed') {
                    // Check if it's the specific "No Trigger" error
                    if (data.message === "No Trigger Node found") {
                        throw new Error("Add a Trigger Node to start.");
                    }
                    throw new Error(data.message || data.error || 'Unknown Execution Error');
                }

                console.log("Execution Result:", data);

                // NEW: Use Toast instead of Alert
                showStatus('success', 'Workflow Executed', 'Check output for details.');

                // NEW: Show Output Button
                if (outputBtn) {
                    outputBtn.classList.remove('hidden');
                    outputBtn.classList.add('flex');
                }
            })
            .catch(err => {
                console.error(err);
                showStatus('error', 'Execution Failed', err.message);
            })
            .finally(() => {
                setRunning(false);
            });
    });
}

// Init Logic
function initApp() {
    console.log("DOM Ready. Initializing...");

    // Fetch Projects
    fetchProjects().catch(err => {
        console.error("Init fetchProjects failed:", err);
    });

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

    // Attach Event Listeners (Moved from global scope)
    const createForm = document.getElementById('create-project-form');
    if (createForm) {
        createForm.removeEventListener('submit', handleCreateProject); // Prevent dupes if re-init
        createForm.addEventListener('submit', handleCreateProject);
    }

    const deleteBtn = document.getElementById('confirm-delete-btn');
    if (deleteBtn) {
        deleteBtn.removeEventListener('click', handleConfirmDelete);
        deleteBtn.addEventListener('click', handleConfirmDelete);
    }

    const settingsForm = document.getElementById('global-settings-form');
    if (settingsForm) {
        settingsForm.removeEventListener('submit', handleGlobalSettings);
        settingsForm.addEventListener('submit', handleGlobalSettings);
    }
}

console.log("Script execution reached end. Checking readyState...");
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // console.log("Document already ready. Calling initApp immediately.");
    initApp();
}

// Fallback: Ensure projects are fetched even if DOMContentLoaded missed
window.addEventListener('load', () => {
    console.log("Window Load fallback");
    const grid = document.getElementById('projects-grid');
    if (!grid || grid.innerHTML.trim() === '' || document.getElementById('project-count').innerText === '0') {
        console.log("Projects not loaded yet, fetching...");
        setTimeout(fetchProjects, 100);
    }
});
