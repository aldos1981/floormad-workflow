// App Initialized
console.log("App.js loaded externally");

// --- DRAWFLOW INSTANCE ---
let editor = null;

// --- SYSTEM LOG ---
let systemLogExpanded = true;

function addSystemLog(type, message) {
    const logContent = document.getElementById('system-log-content');
    if (!logContent) return;

    const timestamp = new Date().toLocaleTimeString('it-IT');
    const logEntry = document.createElement('div');
    logEntry.className = 'flex gap-2 text-xs';

    const typeColors = {
        'info': 'text-blue-400',
        'success': 'text-green-400',
        'error': 'text-red-400',
        'warning': 'text-yellow-400'
    };

    const typeIcons = {
        'info': 'ℹ️',
        'success': '✅',
        'error': '❌',
        'warning': '⚠️'
    };

    logEntry.innerHTML = `
        <span class="text-gray-600">[${timestamp}]</span>
        <span class="${typeColors[type] || 'text-gray-400'}">${typeIcons[type] || '•'}</span>
        <span class="text-gray-300 flex-1">${message}</span>
    `;

    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;

    // Keep only last 100 entries
    while (logContent.children.length > 100) {
        logContent.removeChild(logContent.firstChild);
    }
}

function clearSystemLog() {
    const logContent = document.getElementById('system-log-content');
    if (logContent) {
        logContent.innerHTML = '<div class="text-gray-500 italic">Log cleared...</div>';
    }
}

function toggleSystemLog() {
    const panel = document.getElementById('system-log-panel');
    const icon = document.getElementById('log-toggle-icon');
    if (!panel) return;

    systemLogExpanded = !systemLogExpanded;

    if (systemLogExpanded) {
        panel.style.height = '250px';
        icon.style.transform = 'rotate(0deg)';
    } else {
        panel.style.height = '40px';
        icon.style.transform = 'rotate(180deg)';
    }
}

// --- UI UTILS ---
function showToast(type, title, msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    // Determine colors and icons based on type
    let borderColor, icon;
    if (type === 'success') {
        borderColor = 'border-green-500';
        icon = '<span class="text-3xl">✅</span>';
    } else if (type === 'loading' || type === 'info') {
        borderColor = 'border-yellow-500';
        icon = '<span class="text-3xl">⏳</span>';
    } else { // error
        borderColor = 'border-red-500';
        icon = '<span class="text-3xl">❌</span>';
    }

    toast.className = `pointer-events-auto w-[600px] max-w-[90vw] shadow-2xl rounded-xl ring-1 ring-white/10 transition transform duration-300 ease-out translate-y-2 opacity-0 mb-4 bg-gray-800 border-l-8 ${borderColor}`;

    toast.innerHTML = `
                <div class="p-5">
                    <div class="flex items-start">
                        <div class="flex-shrink-0">
                            ${icon}
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
    // For errors with multi-line content, use the persistent modal
    if (type === 'error' && msg && msg.includes('\n')) {
        const modal = document.getElementById('status-modal');
        const iconEl = document.getElementById('status-icon');
        const titleEl = document.getElementById('status-title');
        const msgEl = document.getElementById('status-msg');
        const detailsBox = document.getElementById('status-details-box');
        const detailsEl = document.getElementById('status-details');

        if (modal) {
            if (iconEl) iconEl.innerHTML = '<span class="text-5xl">❌</span>';
            if (titleEl) titleEl.textContent = title;
            if (msgEl) msgEl.textContent = msg.split('\n')[0]; // First line as summary
            if (detailsBox && detailsEl) {
                detailsBox.classList.remove('hidden');
                detailsBox.style.maxHeight = '400px';
                detailsBox.style.overflow = 'auto';
                detailsEl.textContent = msg;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            return;
        }
    }
    showToast(type, title, msg);
    if (details) console.error("Error details:", details);
}

function extractEmail(jsonStr, targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;
    try {
        const data = JSON.parse(jsonStr);
        if (data.client_email) {
            const email = data.client_email;
            el.innerHTML = `
                <div style="margin-top:8px;background:#1e293b;border:1px solid #3b82f6;border-radius:10px;padding:14px 16px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                        <span style="font-size:14px;">🔗</span>
                        <span style="color:#93c5fd;font-weight:600;font-size:13px;">Condividi il Google Sheet con questo account</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;background:#0f172a;border-radius:8px;padding:8px 12px;margin-bottom:10px;">
                        <code style="color:#60a5fa;font-size:12px;flex:1;word-break:break-all;">${email}</code>
                        <button onclick="navigator.clipboard.writeText('${email}');this.textContent='✅ Copiato!';setTimeout(()=>this.textContent='📋 Copia',1500)"
                            style="background:#2563eb;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap;min-width:80px;">
                            📋 Copia
                        </button>
                    </div>
                    <div style="color:#94a3b8;font-size:11px;line-height:1.6;">
                        <strong style="color:#cbd5e1;">Come fare:</strong><br>
                        1️⃣ Apri il tuo Google Sheet<br>
                        2️⃣ Click <strong>Condividi</strong> (Share) in alto a destra<br>
                        3️⃣ Incolla l'email qui sopra<br>
                        4️⃣ Imposta il ruolo su <strong style="color:#34d399;">Editor</strong><br>
                        5️⃣ Deseleziona "Notifica persone" e click <strong>Condividi</strong>
                    </div>
                </div>
            `;
        } else {
            el.innerHTML = '';
        }
    } catch (e) {
        // Ignore parsing errors while typing
        el.innerHTML = '';
    }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Add event listener for delete confirmation
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
        console.log("Attached click listener to confirm-delete-btn");
    } else {
        console.warn("Could not find confirm-delete-btn to attach listener");
    }
});

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
            // Force redraw connections after tab is visible
            setTimeout(() => {
                if (typeof forceRedrawConnections === 'function') {
                    forceRedrawConnections();
                }
            }, 50);
        } else {
            toolbar.classList.add('hidden');
            toolbar.classList.remove('flex');
        }
    }

    if (tabId === 'tab-media' || tabId === 'tab-products') {
        loadMedia();
    }
}

// --- OUTPUT MODAL LOGIC ---
function showOutput() {
    const modal = document.getElementById('output-modal');
    const content = document.getElementById('output-content');
    const title = document.getElementById('output-title-text');
    if (title) title.innerText = "Execution Output";

    if (!lastExecutionResult) {
        showStatus('error', 'No Output', 'Run the workflow first to see results.');
        return;
    }

    content.innerText = JSON.stringify(lastExecutionResult, null, 2);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.viewJsonVar = function (varName) {
    if (!lastExecutionResult || !lastExecutionResult.final_context) return;
    const modal = document.getElementById('output-modal');
    const content = document.getElementById('output-content');
    const title = document.getElementById('output-title-text');

    if (title) title.innerText = `Variable: {{${varName}}}`;

    const val = lastExecutionResult.final_context[varName];
    if (typeof val === 'object' && val !== null) {
        content.innerText = JSON.stringify(val, null, 2);
    } else {
        content.innerText = String(val);
    }

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

// --- GLOBAL STATE ---
let currentProjectId = null;
let currentProducts = [];
let currentWorkflow = {};
let currentPriceCache = [];
let currentHeaders = [];
let currentMedia = [];
let lastExecutionResult = null;

// Track unsaved changes
let hasUnsavedChanges = false;

function markConfigDirty() {
    hasUnsavedChanges = true;
    const saveBtn = document.getElementById('save-config-btn');
    if (saveBtn) {
        saveBtn.classList.remove('hidden');
        saveBtn.classList.add('flex');
    }
}

function markConfigClean() {
    hasUnsavedChanges = false;
    // Don't hide the button - keep it visible for user convenience
}

// Custom Confirm Modal
function customConfirm(title, message) {
    console.log(`[MODAL] customConfirm called with title: "${title}"`);
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        console.log(`[MODAL] Elements found:`, {
            modal: !!modal,
            titleEl: !!titleEl,
            messageEl: !!messageEl,
            okBtn: !!okBtn,
            cancelBtn: !!cancelBtn
        });

        titleEl.textContent = title;
        messageEl.textContent = message;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        console.log(`[MODAL] Modal shown`);

        const cleanup = () => {
            console.log(`[MODAL] Cleanup called`);
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        okBtn.onclick = (e) => {
            console.log(`[MODAL] OK button clicked!`, e);
            cleanup();
            resolve(true);
            console.log(`[MODAL] Resolved with TRUE`);
        };

        cancelBtn.onclick = (e) => {
            console.log(`[MODAL] Cancel button clicked!`, e);
            cleanup();
            resolve(false);
            console.log(`[MODAL] Resolved with FALSE`);
        };

        console.log(`[MODAL] Event handlers attached`);
    });
} // To handle product linking

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
            if (!(await customConfirm('Delete File', `Delete ${file.name}?`))) return;
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
                    markConfigDirty();
                };
                row.querySelector('.attr-vals').oninput = (e) => {
                    currentProducts[index].attributes[idx].variants = e.target.value;
                    markConfigDirty();
                };
                row.querySelector('.del-attr-btn').onclick = () => {
                    currentProducts[index].attributes.splice(idx, 1);
                    markConfigDirty();
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
            markConfigDirty();
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





        // Delete Product - use data attribute to avoid closure issues
        const deleteBtn = template.querySelector('.delete-btn');
        deleteBtn.setAttribute('data-product-index', index);
        deleteBtn.onclick = async function () {
            const idx = parseInt(this.getAttribute('data-product-index'));
            await removeProduct(idx);
        };

        // Price List & Knowledge Base Selection (New)
        const priceSelect = template.querySelector('.price-list-select');
        const knowledgeSelect = template.querySelector('.knowledge-base-select');

        // Helper to populate options
        const populateMediaOptions = (selectEl, selectedValue) => {
            selectEl.innerHTML = '<option value="">-- Select File --</option>';
            currentMedia.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name;
                option.text = file.name;
                if (file.name === selectedValue) option.selected = true;
                selectEl.appendChild(option);
            });
        };

        populateMediaOptions(priceSelect, prod.price_list_file);
        populateMediaOptions(knowledgeSelect, prod.knowledge_base_file);

        priceSelect.onchange = (e) => {
            currentProducts[index].price_list_file = e.target.value;
        };
        knowledgeSelect.onchange = (e) => {
            currentProducts[index].knowledge_base_file = e.target.value;
        };

        // UI Helpers for Optimization
        const addOptimizeBtn = (parent, type, fileGetter) => {
            const container = document.createElement('div');
            container.className = "flex gap-1 ml-2";

            const btn = document.createElement('button');
            btn.className = "text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded flex items-center gap-1";
            btn.innerHTML = '<span>✨ Optimize</span>';
            btn.onclick = () => optimizeProductFile(type, index, fileGetter());

            const viewBtn = document.createElement('button');
            viewBtn.className = "text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded flex items-center gap-1";
            viewBtn.innerHTML = '<span>👁️ Result</span>';
            viewBtn.onclick = () => viewOptimizationResult(type, index, fileGetter());

            container.appendChild(btn);
            container.appendChild(viewBtn);
            parent.appendChild(container);
        };

        // Append Optimize Buttons (check for existing to prevent duplicates)
        if (priceSelect.parentNode) {
            // Check if wrapper already exists (to prevent duplicates on re-render)
            let wrapper = priceSelect.nextElementSibling;
            if (!wrapper || !wrapper.classList.contains('optimize-btn-wrapper')) {
                wrapper = document.createElement('div');
                wrapper.className = "flex items-center gap-2 mt-1 optimize-btn-wrapper";
                priceSelect.parentNode.insertBefore(wrapper, priceSelect.nextSibling);
            } else {
                wrapper.innerHTML = ''; // Clear existing buttons
            }
            addOptimizeBtn(wrapper, 'price_list', () => currentProducts[index].price_list_file);
        }

        if (knowledgeSelect.parentNode) {
            let wrapper = knowledgeSelect.nextElementSibling;
            if (!wrapper || !wrapper.classList.contains('optimize-btn-wrapper')) {
                wrapper = document.createElement('div');
                wrapper.className = "flex items-center gap-2 mt-1 optimize-btn-wrapper";
                knowledgeSelect.parentNode.insertBefore(wrapper, knowledgeSelect.nextSibling);
            } else {
                wrapper.innerHTML = ''; // Clear existing buttons
            }
            addOptimizeBtn(wrapper, 'knowledge_base', () => currentProducts[index].knowledge_base_file);
        }

        // Bind Basic Inputs
        template.querySelector('.prod-name').oninput = (e) => {
            currentProducts[index].name = e.target.value;
            markConfigDirty();
        };
        template.querySelector('.prod-desc').oninput = (e) => {
            currentProducts[index].descriptions = e.target.value.split('\n').filter(x => x.trim());
            markConfigDirty();
        };

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
    console.log(`[DEBUG] removeProduct called with index: ${index}`);
    console.log(`[DEBUG] currentProducts before:`, currentProducts);

    const confirmed = await customConfirm('Remove Product', 'Are you sure you want to remove this product?');
    if (!confirmed) {
        console.log(`[DEBUG] User cancelled deletion`);
        return;
    }

    console.log(`[DEBUG] User confirmed deletion, removing product at index ${index}`);
    currentProducts.splice(index, 1);
    console.log(`[DEBUG] currentProducts after splice:`, currentProducts);

    // Re-render the UI
    renderProducts();

    // IMPORTANT: Save to backend immediately
    await saveWorkflow();
    console.log(`[DEBUG] Product deleted and saved to backend`);
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

async function optimizeProductFile(type, index, fileName) {
    if (!fileName) {
        showStatus('error', 'No File', 'Please select a file first.');
        return;
    }

    if (!(await customConfirm('Optimize File', `Use AI to optimize and normalize "${fileName}"?\nThis will create a new file with standardized structure.`))) return;

    showStatus('info', 'Optimizing...', 'Sending file to AI for analysis...');

    try {
        const res = await fetch(`/api/projects/${currentProjectId}/optimize_file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_name: fileName, type: type })
        });

        const data = await res.json();
        if (data.success) {
            if (type === 'price_list') currentProducts[index].price_list_file = data.optimized_file;
            if (type === 'knowledge_base') currentProducts[index].knowledge_base_file = data.optimized_file;

            renderProducts();
            showStatus('success', 'Optimized!', `Created ${data.optimized_file}`);

            if (data.preview) {
                const modal = document.getElementById('output-modal');
                const content = document.getElementById('output-content');
                content.innerText = JSON.stringify(data.preview, null, 2);
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        } else {
            throw new Error(data.message);
        }
    } catch (e) {
        showStatus('error', 'Optimization Failed', e.message);
    }
}

async function viewOptimizationResult(type, index, fileName) {
    if (!fileName) {
        showStatus('error', 'No File', 'Please select a file first.');
        return;
    }

    // Check if the selected file is already optimized
    let targetFile = fileName;
    if (!fileName.startsWith('optimized_')) {
        // Try to find the optimized version by checking if it exists
        // First, construct the expected optimized filename
        const baseName = fileName.replace(/\.(csv|xlsx|xls|txt|pdf)$/i, '');
        targetFile = `optimized_${baseName}.json`;
    }

    showStatus('info', 'Loading...', `Fetching content for ${targetFile}...`);

    try {
        // Use new read_file endpoint
        const res = await fetch(`/api/projects/${currentProjectId}/read_file?file=${encodeURIComponent(targetFile)}`);

        if (res.ok) {
            const text = await res.text();
            const modal = document.getElementById('output-modal');
            const content = document.getElementById('output-content');
            try {
                // Try to format if JSON
                content.innerText = JSON.stringify(JSON.parse(text), null, 2);
            } catch (e) {
                content.innerText = text;
            }
            document.getElementById('output-title').innerText = `Content: ${targetFile}`;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            showStatus('success', 'Loaded', 'File content displayed.');
        } else {
            // File not found - likely not optimized yet
            if (targetFile !== fileName && !fileName.startsWith('optimized_')) {
                // The file hasn't been optimized yet
                const shouldOptimize = await customConfirm(
                    'File Not Optimized',
                    `The file "${fileName}" hasn't been optimized yet. Click "Optimize" first to create the optimized version, then use "View Result".`
                );
                throw new Error("File not optimized yet. Click 'Optimize' button first.");
            } else {
                const errorText = await res.text();
                throw new Error(errorText || "File not found");
            }
        }
    } catch (e) {
        showStatus('error', 'View Failed', e.message);
    }
}

// --- PRICE VIEW LOGIC ---

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
            document.getElementById('int-wesender-url').value = wesender.api_url || '';

            const pipedrive = project.pipedrive_config ? JSON.parse(project.pipedrive_config) : {};
            document.getElementById('int-pipedrive-token').value = pipedrive.api_token || '';
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

        // Load media files before rendering products (so dropdowns are populated)
        await loadMedia();
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
            api_key: document.getElementById('int-wesender-key').value,
            api_url: document.getElementById('int-wesender-url').value
        },
        pipedrive_config: {
            api_token: document.getElementById('int-pipedrive-token').value
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
        markConfigClean();
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
                                 <button onclick="renameProject('${p.id}', '${(p.name || 'Unnamed').replace(/'/g, "\\'")}')"
                                    class="text-yellow-400 hover:text-yellow-300 bg-gray-900/50 p-1.5 rounded hover:bg-yellow-900/40 transition" title="Rename">✏️</button>
                                 <button onclick="duplicateProject('${p.id}')" class="text-blue-400 hover:text-blue-300 bg-gray-900/50 p-1.5 rounded hover:bg-blue-900/40 transition" title="Duplicate">📋</button>
                                 <button onclick="deleteProject('${p.id}')" class="text-red-400 hover:text-red-300 bg-gray-900/50 p-1.5 rounded hover:bg-red-900/40 transition" title="Delete">🗑️</button>
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
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Running...";
    btn.disabled = true;
    btn.classList.add('opacity-70');

    try {
        const res = await fetch(`/api/projects/${id}/run`, { method: 'POST' });
        const data = await res.json();

        if (data.status === 'completed') {
            showStatus('success', 'Workflow Completed', `All ${(data.log || []).length} nodes executed successfully.`);
        } else if (data.status === 'error' || data.status === 'failed') {
            let errMsg = data.message || 'Execution failed';
            if (data.traceback) errMsg += '\n' + data.traceback.slice(-500);
            showStatus('error', 'Workflow Failed', errMsg);
        } else {
            showStatus('info', 'Workflow Done', data.message || JSON.stringify(data).slice(0, 300));
        }
    } catch (err) {
        showStatus('error', 'System Error', err.toString());
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-70');
    }
}

async function renameProject(id, currentName) {
    const newName = prompt('Rinomina il progetto:', currentName);
    if (!newName || newName === currentName) return;

    try {
        const res = await fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        if (res.ok) {
            showStatus('success', 'Renamed', `Project renamed to "${newName}"`);
            // Reload projects list to reflect the change
            if (typeof fetchProjects === 'function') fetchProjects();
        } else {
            showStatus('error', 'Error', 'Failed to rename project');
        }
    } catch (err) {
        showStatus('error', 'Error', err.toString());
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

async function duplicateProject(projectId) {
    try {
        showStatus('info', 'Duplicating...', 'Creating a copy of the project...');
        const res = await fetch(`/api/projects/${projectId}/duplicate`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showStatus('success', 'Project Duplicated!', `New project "${data.name}" created.`);
            fetchProjects();
        } else {
            showStatus('error', 'Duplicate Failed', data.detail || 'Unknown error');
        }
    } catch (e) {
        showStatus('error', 'Duplicate Failed', e.message);
    }
}

// --- GLOBAL SETTINGS LOGIC ---
async function testGeminiConnection() {
    const apiKey = document.getElementById('g-api-key').value; // Corrected ID from 'setting-google-api-key'
    if (!apiKey) {
        showStatus('error', 'Missing Key', 'Please enter an API Key first.');
        return;
    }

    showStatus('info', 'Testing AI...', 'Connecting to Gemini...');

    try {
        const res = await fetch('/api/test_gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey })
        });

        const data = await res.json();
        console.log("Gemini Test Response:", data); // Debugging

        if (data.success) {
            showStatus('success', 'Connected!', 'Gemini AI is responding: ' + (data.response || 'OK'));
        } else {
            const msg = data.message || data.detail || 'Unknown error occurred';
            showStatus('error', 'Connection Failed', msg);
        }
    } catch (e) {
        console.error("Gemini Test Fetch Error:", e);
        showStatus('error', 'Error', e.message);
    }
}

async function saveGlobalSettings() {
    const btn = document.getElementById('save-settings-btn'); // Assuming a save button exists
    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

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

        if (res.ok) {
            showStatus('success', 'Settings Saved', 'Global settings have been updated.');
            closeSettings();
        } else {
            const errorData = await res.json();
            showStatus('error', 'Save Failed', errorData.message || 'Failed to save settings.');
        }
    } catch (e) {
        showStatus('error', 'Error', e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

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
let currentNodeId = null;

// --- UNDO / REDO SYSTEM ---
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 50;
let _undoRedoActive = false; // flag to prevent recursive snapshots during undo/redo

function snapshotWorkflow() {
    if (!editor || _undoRedoActive) return;
    try {
        const state = JSON.stringify(editor.export());
        // Don't push duplicate states
        if (undoStack.length > 0 && undoStack[undoStack.length - 1] === state) return;
        undoStack.push(state);
        if (undoStack.length > MAX_UNDO) undoStack.shift();
        redoStack.length = 0; // clear redo on new action
    } catch (e) { console.warn('Snapshot failed:', e); }
}

function undoWorkflow() {
    if (!editor || undoStack.length < 2) return; // need at least 2: current + previous
    _undoRedoActive = true;
    try {
        const currentState = undoStack.pop();
        redoStack.push(currentState);
        const prevState = undoStack[undoStack.length - 1];
        const parsed = JSON.parse(prevState);
        editor.import(parsed);
        showToast('info', 'Undo', 'Azione annullata');
    } catch (e) { console.warn('Undo failed:', e); }
    _undoRedoActive = false;
}

function redoWorkflow() {
    if (!editor || redoStack.length === 0) return;
    _undoRedoActive = true;
    try {
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        const parsed = JSON.parse(nextState);
        editor.import(parsed);
        showToast('info', 'Redo', 'Azione ripristinata');
    } catch (e) { console.warn('Redo failed:', e); }
    _undoRedoActive = false;
}

function initDrawflow() {
    const id = document.getElementById("drawflow");
    editor = new Drawflow(id);
    editor.reroute = true;
    editor.editor_mode = 'edit';
    editor.zoom_max = 1.6;
    editor.zoom_min = 0.5;
    editor.zoom_value = 0.1;
    editor.start();

    // Init inline rename on double-click
    initInlineRename();
    // Init lasso rectangle selection
    initLassoSelect();

    // Event Listeners
    editor.on('nodeCreated', function (id) {
        console.log("Node created " + id);
        snapshotWorkflow();
    });

    // Snapshot on structure changes
    editor.on('nodeRemoved', function (id) { snapshotWorkflow(); });
    editor.on('connectionCreated', function (info) { snapshotWorkflow(); });
    editor.on('connectionRemoved', function (info) { snapshotWorkflow(); });

    // Debounced snapshot on node move (fires many times during drag)
    let _moveTimer = null;
    editor.on('nodeMoved', function (id) {
        clearTimeout(_moveTimer);
        _moveTimer = setTimeout(() => snapshotWorkflow(), 500);
    });

    // Take initial snapshot
    setTimeout(() => snapshotWorkflow(), 500);

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
        // Don't open sidebar if inline renaming is in progress
        if (window._isInlineRenaming) return;
        showNodeConfig(id);
    });

    editor.on('nodeUnselected', function (id) {
        currentNodeId = null;
        document.getElementById('node-config-panel').classList.add('hidden');
        document.getElementById('node-config-panel').classList.remove('flex');
    });

    // Connection Deletion + Undo/Redo Handler
    document.addEventListener('keydown', function (e) {
        // Undo: Ctrl+Z (or Cmd+Z on Mac)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
            if (!e.target.closest('input, textarea, select')) {
                e.preventDefault();
                undoWorkflow();
                return;
            }
        }
        // Redo: Ctrl+Shift+Z (or Cmd+Shift+Z on Mac)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
            if (!e.target.closest('input, textarea, select')) {
                e.preventDefault();
                redoWorkflow();
                return;
            }
        }
        // Delete connection
        if ((e.key === 'Delete' || e.key === 'Backspace') && editor.connection_selected) {
            const conn = editor.connection_selected;
            editor.removeSingleConnection(conn.output_id, conn.input_id, conn.output_class, conn.input_class);
        }
    });


    // --- CONTEXT MENU LOGIC ---
    editor.on('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Check if clicked on a node
        const nodeEl = e.target.closest('.drawflow-node');
        if (nodeEl) {
            const nodeId = nodeEl.id.replace('node-', '');
            // Select it first
            currentNodeId = nodeId;

            // Show custom menu
            showContextMenu(e.clientX, e.clientY, nodeId);
        } else {
            hideContextMenu();
        }
    });

    // Hide menu on click elsewhere
    document.addEventListener('click', hideContextMenu);

    // Inject Menu HTML if not present
    if (!document.getElementById('drawflow-context-menu')) {
        const menu = document.createElement('div');
        menu.id = 'drawflow-context-menu';
        menu.className = 'hidden fixed bg-gray-800 border border-gray-700 shadow-xl rounded-lg py-1 z-[200] min-w-[150px]';
        menu.innerHTML = `
            <button onclick="duplicateNode()" class="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition flex items-center gap-2">
                <span>📄</span> Duplicate
            </button>
            <button onclick="toggleNodeActive()" class="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition flex items-center gap-2">
                <span id="ctx-disable-icon">🚫</span> <span id="ctx-disable-text">Disable</span>
            </button>
            <div class="h-px bg-gray-700 my-1"></div>
            <button onclick="deleteSelectedNode()" class="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/30 transition flex items-center gap-2">
                <span>🗑️</span> Delete
            </button>
        `;
        document.body.appendChild(menu);
    }
}

let contextNodeId = null;

function showContextMenu(x, y, nodeId) {
    contextNodeId = nodeId;
    const menu = document.getElementById('drawflow-context-menu');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');

    // Update Disable/Enable Text
    const node = editor.getNodeFromId(nodeId);
    const isDisabled = node.data.config && node.data.config.disabled;
    const activeText = document.getElementById('ctx-disable-text');
    const activeIcon = document.getElementById('ctx-disable-icon');

    if (activeText) activeText.innerText = isDisabled ? "Enable" : "Disable";
    if (activeIcon) activeIcon.innerText = isDisabled ? "✅" : "🚫";
}

function hideContextMenu() {
    const menu = document.getElementById('drawflow-context-menu');
    if (menu) menu.classList.add('hidden');
}

function duplicateNode() {
    if (!contextNodeId) return;
    const node = editor.getNodeFromId(contextNodeId);
    if (!node) return;

    // Clone Data
    const newData = JSON.parse(JSON.stringify(node.data));
    // Reset Name? Or keep copy?
    if (newData.config && newData.config.node_name) {
        newData.config.node_name = newData.config.node_name + "_copy";
    }

    // Add Node slightly offset
    const pos_x = node.pos_x + 50;
    const pos_y = node.pos_y + 50;

    // Count inputs/outputs (addNode expects numbers, not connection objects)
    const numInputs = Object.keys(node.inputs || {}).length;
    const numOutputs = Object.keys(node.outputs || {}).length;

    editor.addNode(node.name, numInputs, numOutputs, pos_x, pos_y, node.class, newData, node.html);
    hideContextMenu();
}

function toggleNodeActive() {
    if (!contextNodeId) return;
    const node = editor.getNodeFromId(contextNodeId);
    if (!node) return;

    // Init config if missing
    if (!node.data.config) node.data.config = {};

    // Toggle
    node.data.config.disabled = !node.data.config.disabled;

    // Visual update
    const el = document.getElementById('node-' + contextNodeId);
    if (el) {
        if (node.data.config.disabled) {
            el.style.opacity = '0.5';
            el.style.filter = 'grayscale(100%)';
        } else {
            el.style.opacity = '1';
            el.style.filter = 'none';
        }
    }

    editor.updateNodeDataFromId(contextNodeId, { config: node.data.config });
    hideContextMenu();
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
        inputs = 1; outputs = 1;
    } else if (safeType === 'SEND_WHATSAPP') {
        html = `
            <div class="node-content wa-node">
                <div class="title-box">💬 WhatsApp</div>
                <div class="box">
                    <p>WeSender</p>
                </div>
            </div>`;
        inputs = 1; outputs = 1;
    } else if (safeType === 'HTML_PREVIEW') {
        html = `
            <div class="node-content preview-node" style="border-color:#10b981;">
                <div class="title-box" style="background:linear-gradient(135deg,#065f46,#047857);">👁️ HTML Preview</div>
                <div class="box">
                    <p>Live Preview</p>
                </div>
            </div>`;
        inputs = 1; outputs = 1;
    } else if (safeType === 'KNOWLEDGE') {
        html = `
            <div class="node-content knowledge-node" style="border-color:#14b8a6;">
                <div class="title-box" style="background:linear-gradient(135deg,#134e4a,#0f766e);">📚 Knowledge</div>
                <div class="box">
                    <p>Data Source</p>
                </div>
            </div>`;
        inputs = 1; outputs = 1;
    } else if (safeType === 'GOOGLE_SHEET') {
        html = `
            <div class="node-content sheet-node" style="border-color:#34a853;">
                <div class="title-box" style="background:linear-gradient(135deg,#188038,#137333);">📊 Google Sheet</div>
                <div class="box">
                    <p>Read/Filter Rows</p>
                </div>
            </div>`;
        inputs = 1; outputs = 1;
    } else if (safeType === 'PIPEDRIVE') {
        html = `
            <div class="node-content pipedrive-node" style="border-color:#7c3aed;">
                <div class="title-box" style="background:linear-gradient(135deg,#5b21b6,#7c3aed);">🔗 Pipedrive</div>
                <div class="box">
                    <p>CRM Sync</p>
                </div>
            </div>`;
        inputs = 1; outputs = 1;
    } else {
        console.warn("Unknown Node Type:", type);
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

// Helper to get AI Nodes
const getAiNodes = () => {
    const nodes = [];

    const search = (obj) => {
        if (!obj || typeof obj !== 'object') return;

        // Check if this object is an AI Node
        if (obj.name === 'AI_COMPLETION' && obj.data && obj.data.config) {
            nodes.push({
                id: obj.id,
                name: (obj.data.config.output_var && obj.data.config.output_var.trim()) ? obj.data.config.output_var.trim() : (obj.data.config.node_name || `AI_Node_${obj.id}`),
                schema: obj.data.config.schema_instruction || ''
            });
        }

        // Recurse
        Object.values(obj).forEach(child => search(child));
    };

    if (editor && editor.drawflow) {
        search(editor.drawflow);
    }

    // Deduplicate
    const unique = [];
    const ids = new Set();
    nodes.forEach(n => {
        if (!ids.has(n.id)) {
            unique.push(n);
            ids.add(n.id);
        }
    });

    return unique;
};

const renderJsonPicker = (targetId) => {
    const aiNodes = getAiNodes();
    if (aiNodes.length === 0) return '';

    let options = '';
    aiNodes.forEach(node => {
        // Main Output Var
        options += `<option value="${node.name}" class="font-bold">📦 ${node.name} (Full JSON)</option>`;

        // Try to extract keys from schema instruction (simple regex)
        // Looking for "keys: key1, key2" or JSON structure in comments
        try {
            // Regex to find "keys: ..." or simple JSON object in text
            // formatting: "keys: name, date, total" -> ["name", "date", "total"]
            const keysMatch = node.schema.match(/keys:\s*([a-zA-Z0-9_,\s]+)/i);
            if (keysMatch) {
                const keys = keysMatch[1].split(',').map(k => k.trim());
                keys.forEach(k => {
                    options += `<option value="${node.name}.${k}">  └─ ${k}</option>`;
                });
            }
        } catch (e) { }
    });

    const html = `
            <select onchange="insertVar('${targetId}', this.value); this.value='';" class="bg-gray-700 text-xs text-green-300 border border-gray-600 rounded px-1 ml-2 max-w-[120px] cursor-pointer" title="Insert AI Output">
                <option value="">+ AI Json</option>
                ${options}
            </select>
        `;
    return html;
};

function showNodeConfig(id) {
    const node = editor.getNodeFromId(id);
    const type = node.name;
    const data = node.data.config || {};


    const panel = document.getElementById('node-config-panel');
    const content = document.getElementById('node-config-content');
    document.getElementById('conf-node-id').innerText = "#" + id;

    content.innerHTML = ''; // Clear previous

    // Helper function to generate node name input field
    const nodeNameField = (defaultName) => `
        <div class="mb-3 pb-3 border-b border-gray-700">
            <label class="block text-xs text-gray-400 mb-1">📝 Node Name</label>
            <input id="cfg-node-name" type="text" 
                   class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" 
                   value="${data.node_name || defaultName}" 
                   placeholder="Enter custom node name">
            <p class="text-[10px] text-gray-500 mt-1">This name will be used in JSON outputs (e.g., ${defaultName}_content)</p>
        </div>
    `;

    if (type === 'TRIGGER') {
        const triggerType = data.trigger_type || 'cron';
        content.innerHTML = nodeNameField(`Trigger_${id}`) + `
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
                    <option value="*/10 * * * *">Every 10 Minutes</option>
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
        content.innerHTML = nodeNameField(`AI_Node_${id}`) + `
        <div>
                <label class="block text-xs text-gray-400 mb-1">Model Version</label>
                <select id="cfg-model" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs outline-none focus:border-blue-500 mb-2">
                    <option value="gemini-3-flash-preview" ${data.model === 'gemini-3-flash-preview' || !data.model ? 'selected' : ''}>Gemini 3 Flash (Fast)</option>
                    <option value="gemini-3-pro-preview" ${data.model === 'gemini-3-pro-preview' ? 'selected' : ''}>Gemini 3 Pro (Powerful)</option>
                    <option value="gemini-2.0-flash" ${data.model === 'gemini-2.0-flash' ? 'selected' : ''}>Gemini 2.0 Flash (Legacy)</option>
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
                    ${renderJsonPicker('cfg-html')}
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
                        ${renderJsonPicker('cfg-user')}
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
        <div>
                <label class="block text-xs text-gray-400 mb-1 flex justify-between">
                    <span>HTML Template</span>
                    <div class="flex items-center">
                         ${renderVarPicker('cfg-tpl')}
                         ${renderJsonPicker('cfg-tpl')}
                    </div>
                </label>
                <textarea id="cfg-tpl" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono focus:border-orange-500 outline-none" rows="8">${data.template || ''}</textarea>
            </div>
        <div>
            <label class="block text-xs text-gray-400 mb-1">Output Variable</label>
            <input id="cfg-out" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.output_var || 'html_content'}">
        </div>
    `;
    }
    else if (type === 'SEND_EMAIL') {
        content.innerHTML = nodeNameField(`Email_${id}`) + `
        <div>
                <label class="block text-xs text-gray-400 mb-1 flex justify-between">
                    <span>To (Email)</span>
                    <div class="flex items-center">
    
                        ${renderJsonPicker('cfg-to')}
                    </div>
                </label>
                 <div class="flex gap-2">
                    <input id="cfg-to" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.to_field || ''}" placeholder="email@example.com or {{variable}}">
                    ${renderVarPicker('cfg-to')}
                 </div>
                 <p class="text-[10px] text-gray-500 mt-1">Enter email directly or use a variable</p>
            </div>
                <div>
                <label class="block text-xs text-gray-400 mb-1 flex justify-between">
                    <span>Subject</span>
                    <div class="flex items-center">
                        ${renderVarPicker('cfg-subj')}
                        ${renderJsonPicker('cfg-subj')}
                    </div>
                </label>
                <input id="cfg-subj" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.subject || ''}">
            </div>
                <div>
                <label class="block text-xs text-gray-400 mb-1 flex justify-between">
                    <span>Body (Variable from previous step)</span>
                     <div class="flex items-center">
                        ${renderJsonPicker('cfg-body')}
                    </div>
                </label>
                <input id="cfg-body" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.body_var || 'html_content'}">
            </div>

            <hr class="border-gray-700 my-4">
            <h4 class="text-xs font-semibold text-yellow-400 mb-2">🖼️ Email Header</h4>
            <div>
                <label class="block text-xs text-gray-400 mb-1">Logo URL (image link)</label>
                <input id="cfg-email-logo" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.header_logo || ''}" placeholder="https://example.com/logo.png">
                <p class="text-xs text-amber-400/70 mt-1">⚠️ Usa PNG o JPG — i client email non supportano WebP</p>
            </div>
            <div class="mt-2">
                <label class="block text-xs text-gray-400 mb-1">Header Text (brand name / tagline)</label>
                <input id="cfg-email-header" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.header_text || ''}" placeholder="Company Name">
            </div>

            <hr class="border-gray-700 my-4">
            <h4 class="text-xs font-semibold text-yellow-400 mb-2">✍️ Email Footer / Signature</h4>
            <div>
                <label class="block text-xs text-gray-400 mb-1">Footer HTML (signature, links, etc.)</label>
                <textarea id="cfg-email-footer" rows="4" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" placeholder="<p>Cordiali saluti,<br>Nome Cognome</p>">${data.footer_html || ''}</textarea>
            </div>

            <hr class="border-gray-700 my-4">
            <div>
                <button onclick="testEmailNode()" class="w-full flex items-center justify-center gap-2 bg-sky-600/20 text-sky-400 hover:bg-sky-600/40 border border-sky-600/50 rounded-lg py-2.5 text-sm font-medium transition">
                    <span id="test-email-spinner" class="animate-spin hidden">⟳</span>
                    🧪 Test Send Email
                </button>
                <p class="text-[10px] text-gray-500 mt-1.5 text-center">Uses last run data to send a real test email</p>
                <div id="test-email-result" class="hidden mt-2 text-xs p-2 rounded border"></div>
            </div>
    `;
    }
    else if (type === 'SEND_WHATSAPP') {
        content.innerHTML = nodeNameField(`WhatsApp_${id}`) + `
        <div>
                <label class="block text-xs text-gray-400 mb-1">Phone Column</label>
                 <div class="flex gap-2">
                    <input id="cfg-phone" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.phone_field || 'telefono'}" placeholder="Column name">
                    ${renderVarPicker('cfg-phone')}
                 </div>
            </div>
        <div>
            <label class="block text-xs text-gray-400 mb-1 flex justify-between">
                <span>Message (Variable)</span>
                <div class="flex items-center">
                    ${renderJsonPicker('cfg-msg')}
                </div>
            </label>
            <input id="cfg-msg" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.message_var || 'ai_result'}">
        </div>
    `;
    }
    else if (type === 'HTML_PREVIEW') {
        content.innerHTML = nodeNameField(`Preview_${id}`) + `
        <div>
            <label class="block text-xs text-gray-400 mb-1">Source Variable</label>
            <div class="flex gap-1">
                <input id="cfg-preview-src" type="text" class="flex-1 bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.source_var || 'html_content'}" placeholder="Variable name">
                ${renderJsonPicker('cfg-preview-src')}
            </div>
            <p class="text-[10px] text-gray-500 mt-1">The variable containing the final HTML output</p>
        </div>
        <div class="mt-3">
            <button onclick="previewHtmlOutput()" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs text-white font-medium shadow-lg flex items-center justify-center gap-2">
                👁️ Open Live Preview
            </button>
        </div>
    `;
    }
    else if (type === 'KNOWLEDGE') {
        content.innerHTML = nodeNameField(`Knowledge_${id}`) + `
        <div>
            <label class="block text-xs text-gray-400 mb-1">📝 Manual Knowledge Text</label>
            <textarea id="cfg-knowledge-text" rows="5" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" placeholder="Paste knowledge text here...">${data.knowledge_text || ''}</textarea>
        </div>
        <div class="mt-3">
            <label class="block text-xs text-gray-400 mb-1">📄 Or Upload File (PDF, Excel, CSV, TXT)</label>
            <div class="flex gap-2">
                <input id="cfg-knowledge-file" type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.json,.md" class="flex-1 bg-gray-800 border border-gray-600 rounded p-1 text-white text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-teal-600 file:text-white hover:file:bg-teal-500" onchange="uploadKnowledgeFile(this, '${id}')">
            </div>
            <p class="text-[10px] text-gray-500 mt-1">File will be normalized to text and stored</p>
        </div>
        <div id="knowledge-preview-${id}" class="mt-2 ${data.knowledge_text ? '' : 'hidden'}">
            <label class="block text-xs text-gray-400 mb-1">📋 Current Knowledge (${data.knowledge_text ? data.knowledge_text.length : 0} chars)</label>
            <div class="bg-gray-900 border border-gray-700 rounded p-2 max-h-32 overflow-y-auto text-[10px] text-gray-400 font-mono">${(data.knowledge_text || '').substring(0, 500)}${(data.knowledge_text || '').length > 500 ? '...' : ''}</div>
        </div>
        <div class="mt-2">
            <label class="block text-xs text-gray-400 mb-1">Output Variable</label>
            <input id="cfg-knowledge-out" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.output_var || 'knowledge_text'}" placeholder="Variable name">
        </div>
    `;
    }
    else if (type === 'GOOGLE_SHEET') {
        content.innerHTML = nodeNameField(`Sheet_${id}`) + `
        <div>
            <label class="block text-xs text-gray-400 mb-1">Google Sheet ID</label>
            <div class="flex gap-2">
                <input id="cfg-sheet-id" type="text" class="flex-1 bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.sheet_id || ''}" placeholder="Leave empty for Project Default">
                <button onclick="openDrivePicker((id, doc) => { document.getElementById('cfg-sheet-id').value = id; const nameEl = document.getElementById('cfg-sheet-name'); if(nameEl) nameEl.value = doc.name || doc[google.picker.Document.NAME] || ''; updateSheetLink(); })" class="bg-gray-700 hover:bg-gray-600 text-white px-2 rounded border border-gray-600" title="Browse Drive">📂</button>
                <a id="cfg-sheet-link" href="https://docs.google.com/spreadsheets/d/${data.sheet_id || ''}" target="_blank" class="bg-green-700 hover:bg-green-600 text-white px-2 rounded border border-green-600 flex items-center ${data.sheet_id ? '' : 'opacity-40 pointer-events-none'}" title="Open in Google Sheets">🔗</a>
            </div>
            <input id="cfg-sheet-name" type="text" class="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-green-400 text-xs mt-1.5" value="${data.sheet_name || ''}" placeholder="File name (auto-filled)" readonly>
            <p class="text-[10px] text-gray-500 mt-1">Override Project Default if needed</p>
        </div>
        <div class="mt-3">
             <label class="block text-xs text-gray-400 mb-1">Sheet Range / Name</label>
             <input id="cfg-sheet-range" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.sheet_range || 'Foglio1!A:Z'}" placeholder="Foglio1!A:Z">
        </div>
        
        <div class="mt-4 border-t border-gray-700 pt-4">
             <label class="block text-xs font-bold text-gray-300 mb-2">Filter Rows</label>
             <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-[10px] text-gray-500 mb-1">Column Name</label>
                    <input id="cfg-filter-col" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.filter_column || 'preventivo_inviato'}" placeholder="Column Header">
                </div>
                <div>
                     <label class="block text-[10px] text-gray-500 mb-1">Value (Leave empty for Empty Check)</label>
                    <input id="cfg-filter-val" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.filter_value || ''}" placeholder="Value to match">
                </div>
             </div>
             <p class="text-[10px] text-gray-500 mt-1">If Value is empty, it selects rows where the column is empty.</p>
        </div>

        <div class="mt-4">            <label class="block text-xs text-gray-400 mb-1">Output Variable</label>            <input id="cfg-out" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.output_var || 'sheet_row'}" placeholder="Variable name">        </div>

        <div class="mt-4 border-t border-gray-700 pt-4">
             <label class="block text-xs font-bold text-green-400 mb-2">📝 Post-Process Update</label>
             <p class="text-[10px] text-gray-500 mb-2">After reading, update this column in the processed row.</p>
             <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-[10px] text-gray-500 mb-1">Column Name</label>
                    <input id="cfg-update-col" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.update_column || ''}" placeholder="e.g. preventivo_inviato">
                </div>
                <div>
                     <label class="block text-[10px] text-gray-500 mb-1">Value to Write</label>
                    <input id="cfg-update-val" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.update_value || ''}" placeholder="e.g. si">
                </div>
             </div>
        </div>

        <div class="mt-4 border-t border-gray-700 pt-4">
             <label class="block text-xs font-bold text-yellow-400 mb-2">🔢 Auto-Counter</label>
             <p class="text-[10px] text-gray-500 mb-2">Auto-increment: finds max value in column + 1, writes to the current row.</p>
             <div>
                <label class="block text-[10px] text-gray-500 mb-1">Counter Column Name</label>
                <input id="cfg-counter-col" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs" value="${data.counter_column || ''}" placeholder="e.g. preventivo_numero">
             </div>
        </div>
    `;
    }
    else if (type === 'PIPEDRIVE') {
        content.innerHTML = nodeNameField(`Pipedrive_${id}`) + `
        <p class="text-[10px] text-gray-500 mb-3">Search by email → Create or Update person in Pipedrive CRM</p>
        <div>
            <label class="block text-xs text-gray-400 mb-1">Email Field</label>
            <div class="flex gap-2">
                <input id="cfg-pd-email" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.email_field || '{{email}}'}" placeholder="{{email}}">
                ${renderVarPicker('cfg-pd-email')}
            </div>
        </div>
        <div class="mt-2">
            <label class="block text-xs text-gray-400 mb-1">Name Field</label>
            <div class="flex gap-2">
                <input id="cfg-pd-name" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.name_field || '{{nome}}'}" placeholder="{{nome}}">
                ${renderVarPicker('cfg-pd-name')}
            </div>
        </div>
        <div class="mt-2">
            <label class="block text-xs text-gray-400 mb-1">Phone Field</label>
            <div class="flex gap-2">
                <input id="cfg-pd-phone" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.phone_field || '{{telefono}}'}" placeholder="{{telefono}}">
                ${renderVarPicker('cfg-pd-phone')}
            </div>
        </div>
        <div class="mt-2">
            <label class="block text-xs text-gray-400 mb-1">Address Field (optional)</label>
            <div class="flex gap-2">
                <input id="cfg-pd-address" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.address_field || '{{localita}}'}" placeholder="{{localita}}">
                ${renderVarPicker('cfg-pd-address')}
            </div>
        </div>
        <div class="mt-2">
            <label class="block text-xs text-gray-400 mb-1">Notes Field (optional)</label>
            <div class="flex gap-2">
                <input id="cfg-pd-notes" type="text" class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-xs font-mono" value="${data.notes_field || ''}" placeholder="{{richiesta}}">
                ${renderVarPicker('cfg-pd-notes')}
            </div>
        </div>
    `;
    }

    // Attach sheet link updater for GOOGLE_SHEET nodes
    const sheetIdInput = document.getElementById('cfg-sheet-id');
    if (sheetIdInput) sheetIdInput.addEventListener('input', updateSheetLink);

    panel.classList.remove('hidden');
    panel.classList.add('flex');
}

// Helper: keep sheet link button in sync with ID field
function updateSheetLink() {
    const id = document.getElementById('cfg-sheet-id')?.value?.trim();
    const link = document.getElementById('cfg-sheet-link');
    if (link) {
        link.href = 'https://docs.google.com/spreadsheets/d/' + (id || '');
        link.classList.toggle('opacity-40', !id);
        link.classList.toggle('pointer-events-none', !id);
    }
}

// Helper for confirmation
let confirmResolve = null;

window.showConfirm = async (text, title = 'Confirm', icon = '⚠️') => {
    const modal = document.getElementById('node-delete-modal');
    if (!modal) return window.confirm(text); // Fallback

    // Update modal content
    const iconEl = document.getElementById('confirm-modal-icon');
    const titleEl = document.getElementById('confirm-modal-title');
    const textEl = document.getElementById('confirm-modal-text');
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    return new Promise((resolve) => {
        confirmResolve = resolve;
    });
};

window.confirmNodeDelete = () => {
    const modal = document.getElementById('node-delete-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (confirmResolve) confirmResolve(true);
    confirmResolve = null;
};

window.cancelNodeDelete = () => {
    const modal = document.getElementById('node-delete-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (confirmResolve) confirmResolve(false);
    confirmResolve = null;
};

function saveNodeConfig() {
    if (!currentNodeId) return;
    const node = editor.getNodeFromId(currentNodeId);
    const type = node.name;
    const data = node.data.config || {};

    // Save custom node name (common for all node types)
    const nodeNameInput = document.getElementById('cfg-node-name');
    if (nodeNameInput) {
        data.node_name = nodeNameInput.value.trim();
    }

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
        data.header_logo = document.getElementById('cfg-email-logo')?.value || '';
        data.header_text = document.getElementById('cfg-email-header')?.value || '';
        data.footer_html = document.getElementById('cfg-email-footer')?.value || '';
    }
    else if (type === 'SEND_WHATSAPP') {
        data.phone_field = document.getElementById('cfg-phone').value;
        data.message_var = document.getElementById('cfg-msg').value;
    }
    else if (type === 'HTML_PREVIEW') {
        data.source_var = document.getElementById('cfg-preview-src')?.value || 'html_content';
    }
    else if (type === 'KNOWLEDGE') {
        data.knowledge_text = document.getElementById('cfg-knowledge-text')?.value || '';
        data.output_var = document.getElementById('cfg-knowledge-out')?.value || 'knowledge_text';
    }
    else if (type === 'GOOGLE_SHEET') {
        data.sheet_id = document.getElementById('cfg-sheet-id').value;
        data.sheet_name = document.getElementById('cfg-sheet-name')?.value || '';
        data.sheet_range = document.getElementById('cfg-sheet-range').value;
        data.filter_column = document.getElementById('cfg-filter-col').value;
        data.filter_value = document.getElementById('cfg-filter-val').value;
        data.output_var = document.getElementById('cfg-out').value;
        data.update_column = document.getElementById('cfg-update-col')?.value || '';
        data.update_value = document.getElementById('cfg-update-val')?.value || '';
        data.counter_column = document.getElementById('cfg-counter-col')?.value || '';
    }
    else if (type === 'PIPEDRIVE') {
        data.email_field = document.getElementById('cfg-pd-email')?.value || '{{email}}';
        data.name_field = document.getElementById('cfg-pd-name')?.value || '{{nome}}';
        data.phone_field = document.getElementById('cfg-pd-phone')?.value || '{{telefono}}';
        data.address_field = document.getElementById('cfg-pd-address')?.value || '';
        data.notes_field = document.getElementById('cfg-pd-notes')?.value || '';
    }

    // Update Drawflow Data
    editor.updateNodeDataFromId(currentNodeId, { config: data });

    // Update title-box on canvas to reflect custom name
    if (data.node_name) {
        const nodeEl = document.querySelector(`#node-${currentNodeId} .title-box`);
        if (nodeEl) {
            const emoji = nodeEl.textContent.match(/^[\p{Emoji}\s]+/u)?.[0]?.trim() || '';
            nodeEl.textContent = (emoji ? emoji + ' ' : '') + data.node_name;
        }
    }

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

// --- LASSO RECTANGLE SELECT + GROUP MOVE + SPACE PAN ---
function initLassoSelect() {
    const container = document.getElementById('drawflow');
    if (!container) return;

    let isSelecting = false;
    let startX = 0, startY = 0;
    let selectedNodeIds = [];
    let isGroupDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let nodeStartPositions = {};
    let isSpacePanning = false;
    let panStartX = 0, panStartY = 0;
    let canvasStartX = 0, canvasStartY = 0;

    // Create selection rectangle element  
    const rect = document.createElement('div');
    rect.id = 'lasso-rect';
    rect.style.cssText = 'position:absolute;border:2px dashed #60a5fa;background:rgba(96,165,250,0.08);pointer-events:none;z-index:9999;display:none;border-radius:4px;';
    container.appendChild(rect);

    // Create invisible overlay for space/right-click/middle-click panning
    const panOverlay = document.createElement('div');
    panOverlay.id = 'pan-overlay';
    panOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;display:none;cursor:grab;';
    document.body.appendChild(panOverlay);
    let isPanDragging = false;
    let isRightClickPanning = false;

    // --- DISABLE Drawflow's built-in left-click canvas drag ---
    // Override Drawflow's drag behavior after it processes mousedown
    // Drawflow sets editor.drag = true when dragging empty canvas — we turn it off
    container.addEventListener('mousedown', function (e) {
        if (e.button === 0 && !e.target.closest('.drawflow-node') && !e.target.closest('.title-box')) {
            // Let Drawflow process the event normally (for node deselect etc.)
            // But after a microtask, disable its canvas drag
            requestAnimationFrame(() => {
                if (editor && editor.drag) {
                    editor.drag = false;
                }
            });
        }
    });

    // --- RIGHT-CLICK & MIDDLE-CLICK PAN ---
    // Suppress context menu on EMPTY CANVAS only
    container.addEventListener('contextmenu', function (e) {
        if (e.target.closest('.drawflow-node') || e.target.closest('.title-box')) return;
        if (!e.target.closest('input') && !e.target.closest('textarea')) {
            e.preventDefault();
        }
    });

    // Right-click or middle-click starts panning (only on empty canvas)
    container.addEventListener('mousedown', function (e) {
        if ((e.button === 2 || e.button === 1) && !e.target.closest('.drawflow-node') && !e.target.closest('.title-box')) {
            e.preventDefault();
            isRightClickPanning = true;
            panOverlay.style.display = 'block';
            panOverlay.style.cursor = 'grabbing';
            isPanDragging = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            const canvasEl = container.querySelector('.drawflow_content_node');
            if (canvasEl) {
                const transform = canvasEl.style.transform || '';
                const match = transform.match(/translate\(([-.\d]+)px,\s*([-.\d]+)px\)/);
                canvasStartX = match ? parseFloat(match[1]) : 0;
                canvasStartY = match ? parseFloat(match[2]) : 0;
            }
        }
    });

    // --- SPACE BAR PAN ---
    document.addEventListener('keydown', function (e) {
        if (e.code === 'Space' && !e.target.closest('input, textarea, select') && !isSpacePanning) {
            e.preventDefault();
            e.stopPropagation();
            isSpacePanning = true;
            panOverlay.style.display = 'block';
            container.classList.add('space-panning-active');
            if (editor) {
                editor.editor_mode = 'fixed';
                editor.drag = false;
                editor.drag_point = false;
            }
            // Force stop any active node drag
            document.querySelectorAll('.drawflow-node').forEach(n => {
                n.style.pointerEvents = 'none';
            });
        }
    });
    document.addEventListener('keyup', function (e) {
        if (e.code === 'Space' && isSpacePanning) {
            isSpacePanning = false;
            isPanDragging = false;
            panOverlay.style.display = 'none';
            panOverlay.style.cursor = 'grab';
            container.classList.remove('space-panning-active');
            if (editor) editor.editor_mode = 'edit';
            // Restore node interactions
            document.querySelectorAll('.drawflow-node').forEach(n => {
                n.style.pointerEvents = '';
            });
        }
    });

    // Pan mousedown — on OVERLAY (for spacebar panning)
    panOverlay.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        isPanDragging = true;
        panOverlay.style.cursor = 'grabbing';
        panStartX = e.clientX;
        panStartY = e.clientY;
        const canvasEl = container.querySelector('.drawflow_content_node');
        if (canvasEl) {
            const transform = canvasEl.style.transform || '';
            const match = transform.match(/translate\(([-.\d]+)px,\s*([-.\d]+)px\)/);
            canvasStartX = match ? parseFloat(match[1]) : 0;
            canvasStartY = match ? parseFloat(match[2]) : 0;
        }
    });

    // Lasso + group drag mousedown
    container.addEventListener('mousedown', function (e) {

        // --- LASSO SELECT ---
        // Only start lasso if clicking on empty canvas (not on a node)
        if (e.target.closest('.drawflow-node') || e.target.closest('.title-box') || e.target.closest('input') || e.target.closest('textarea')) {
            // Check if clicking a selected node to start group drag
            const clickedNode = e.target.closest('.drawflow-node');
            if (clickedNode && clickedNode.classList.contains('lasso-selected') && selectedNodeIds.length > 1) {
                e.stopPropagation();
                isGroupDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                // Store start positions of all selected nodes
                nodeStartPositions = {};
                selectedNodeIds.forEach(id => {
                    const el = document.getElementById('node-' + id);
                    if (el) {
                        nodeStartPositions[id] = {
                            x: parseFloat(el.style.left) || 0,
                            y: parseFloat(el.style.top) || 0
                        };
                    }
                });
            }
            return;
        }
        if (e.button !== 0) return;

        // Clear previous selection
        clearLassoSelection();

        isSelecting = true;
        const containerRect = container.getBoundingClientRect();
        startX = e.clientX - containerRect.left;
        startY = e.clientY - containerRect.top;
        rect.style.left = startX + 'px';
        rect.style.top = startY + 'px';
        rect.style.width = '0px';
        rect.style.height = '0px';
        rect.style.display = 'block';
    });

    document.addEventListener('mousemove', function (e) {
        // Space / right-click panning
        if (isPanDragging && (e.buttons === 1 || e.buttons === 2 || e.buttons === 4)) {
            const dx = e.clientX - panStartX;
            const dy = e.clientY - panStartY;
            if (editor) {
                editor.canvas_x = canvasStartX + dx;
                editor.canvas_y = canvasStartY + dy;
                const canvasEl = container.querySelector('.drawflow_content_node');
                if (canvasEl) {
                    canvasEl.style.transform = `translate(${editor.canvas_x}px, ${editor.canvas_y}px) scale(${editor.zoom})`;
                }
            }
            return;
        }

        // Group dragging
        if (isGroupDragging) {
            const zoom = editor ? editor.zoom : 1;
            const dx = (e.clientX - dragStartX) / zoom;
            const dy = (e.clientY - dragStartY) / zoom;
            selectedNodeIds.forEach(id => {
                const el = document.getElementById('node-' + id);
                const startPos = nodeStartPositions[id];
                if (el && startPos) {
                    el.style.left = (startPos.x + dx) + 'px';
                    el.style.top = (startPos.y + dy) + 'px';
                }
            });
            // Update connections in real-time
            if (editor) {
                selectedNodeIds.forEach(id => {
                    try { editor.updateConnectionNodes('node-' + id); } catch (err) { }
                });
            }
            return;
        }

        // Lasso selecting
        if (!isSelecting) return;
        const containerRect = container.getBoundingClientRect();
        const currentX = e.clientX - containerRect.left;
        const currentY = e.clientY - containerRect.top;
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const w = Math.abs(currentX - startX);
        const h = Math.abs(currentY - startY);
        rect.style.left = x + 'px';
        rect.style.top = y + 'px';
        rect.style.width = w + 'px';
        rect.style.height = h + 'px';
    });

    document.addEventListener('mouseup', function (e) {
        // Space/right-click pan end
        if (isPanDragging) {
            isPanDragging = false;
            if (isRightClickPanning) {
                isRightClickPanning = false;
                panOverlay.style.display = 'none';
            }
            panOverlay.style.cursor = 'grab';
            return;
        }

        // Group drag end - save positions to Drawflow
        if (isGroupDragging) {
            isGroupDragging = false;
            const zoom = editor ? editor.zoom : 1;
            const dx = (e.clientX - dragStartX) / zoom;
            const dy = (e.clientY - dragStartY) / zoom;
            selectedNodeIds.forEach(id => {
                const startPos = nodeStartPositions[id];
                if (startPos && editor) {
                    try {
                        const node = editor.getNodeFromId(id);
                        if (node) {
                            node.pos_x = startPos.x + dx;
                            node.pos_y = startPos.y + dy;
                        }
                    } catch (err) { }
                }
            });
            return;
        }

        // Lasso select end
        if (!isSelecting) return;
        isSelecting = false;

        const rectBounds = rect.getBoundingClientRect();
        rect.style.display = 'none';

        if (rectBounds.width < 10 || rectBounds.height < 10) return;

        const nodes = container.querySelectorAll('.drawflow-node');
        nodes.forEach(node => {
            const nodeBounds = node.getBoundingClientRect();
            if (nodeBounds.left < rectBounds.right && nodeBounds.right > rectBounds.left &&
                nodeBounds.top < rectBounds.bottom && nodeBounds.bottom > rectBounds.top) {
                node.classList.add('lasso-selected');
                node.style.outline = '2px solid #60a5fa';
                node.style.outlineOffset = '2px';
                const nodeId = node.id.replace('node-', '');
                selectedNodeIds.push(nodeId);
            }
        });

        if (selectedNodeIds.length > 0) {
            console.log(`Lasso selected ${selectedNodeIds.length} nodes:`, selectedNodeIds);
            showSelectionToolbar(selectedNodeIds.length);
        }
    });

    // Clear selection on click on empty canvas
    container.addEventListener('click', function (e) {
        if (e.target.closest('.lasso-selected')) return;
        if (!e.target.closest('.drawflow-node')) {
            clearLassoSelection();
        }
    });

    function clearLassoSelection() {
        container.querySelectorAll('.lasso-selected').forEach(n => {
            n.classList.remove('lasso-selected');
            n.style.outline = '';
            n.style.outlineOffset = '';
        });
        selectedNodeIds = [];
        hideSelectionToolbar();
    }

    // Selection toolbar (floating)
    function showSelectionToolbar(count) {
        let toolbar = document.getElementById('lasso-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'lasso-toolbar';
            toolbar.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(30,41,59,0.95);border:1px solid #3b82f6;border-radius:12px;padding:8px 16px;display:flex;gap:12px;align-items:center;z-index:10000;backdrop-filter:blur(8px);box-shadow:0 8px 32px rgba(0,0,0,0.5);';
            document.body.appendChild(toolbar);
        }
        toolbar.innerHTML = `
            <span style="color:#93c5fd;font-size:12px;font-weight:600;">${count} selected</span>
            <button onclick="bulkDeleteSelected()" style="background:#dc2626;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;" title="Delete selected (Del)">
                🗑️ Delete
            </button>
            <button onclick="bulkDuplicateSelected()" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;" title="Duplicate selected (Ctrl+D)">
                📋 Duplicate
            </button>
            <button onclick="copySelectedNodes()" style="background:#7c3aed;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;" title="Copy selected (Ctrl+C)">
                📎 Copy
            </button>
            <span style="color:#6b7280;font-size:10px;">Drag to move • Ctrl+V to paste</span>
        `;
        toolbar.style.display = 'flex';
    }

    function hideSelectionToolbar() {
        const toolbar = document.getElementById('lasso-toolbar');
        if (toolbar) toolbar.style.display = 'none';
    }

    // Bulk delete
    window.bulkDeleteSelected = function () {
        if (selectedNodeIds.length === 0) return;
        selectedNodeIds.forEach(id => {
            try { editor.removeNodeId('node-' + id); } catch (err) { }
        });
        clearLassoSelection();
    };

    // Bulk duplicate
    window.bulkDuplicateSelected = function () {
        if (selectedNodeIds.length === 0 || !editor) return;
        const offset = 50;
        selectedNodeIds.forEach(id => {
            try {
                const node = editor.getNodeFromId(id);
                if (!node) return;
                const newId = editor.addNode(
                    node.name,
                    Object.keys(node.inputs).length,
                    Object.keys(node.outputs).length,
                    node.pos_x + offset,
                    node.pos_y + offset,
                    node.class,
                    JSON.parse(JSON.stringify(node.data)),
                    node.html
                );
                console.log(`Duplicated node ${id} → ${newId}`);
            } catch (err) { console.warn('Duplicate failed for node', id, err); }
        });
        clearLassoSelection();
    };

    // Copy selected nodes to clipboard
    window.copySelectedNodes = function () {
        if (selectedNodeIds.length === 0 || !editor) return;
        const nodesCopy = [];
        selectedNodeIds.forEach(id => {
            try {
                const node = editor.getNodeFromId(id);
                if (!node) return;
                nodesCopy.push({
                    name: node.name,
                    class: node.class,
                    html: node.html,
                    pos_x: node.pos_x,
                    pos_y: node.pos_y,
                    inputs: Object.keys(node.inputs).length,
                    outputs: Object.keys(node.outputs).length,
                    data: JSON.parse(JSON.stringify(node.data))
                });
            } catch (err) { console.warn('Copy failed for node', id, err); }
        });

        if (nodesCopy.length > 0) {
            const clipboardData = JSON.stringify({ _floormad_nodes: nodesCopy });
            navigator.clipboard.writeText(clipboardData).then(() => {
                showStatus('success', 'Copied', `${nodesCopy.length} node(s) copied to clipboard. Use Ctrl+V to paste.`);
            }).catch(() => {
                // Fallback: store in memory
                window._floormadClipboard = nodesCopy;
                showStatus('success', 'Copied', `${nodesCopy.length} node(s) copied (memory). Use Ctrl+V to paste.`);
            });
        }
    };

    // Paste nodes from clipboard
    window.pasteNodes = async function () {
        if (!editor) return;
        let nodesCopy = null;

        // Try system clipboard first
        try {
            const text = await navigator.clipboard.readText();
            const parsed = JSON.parse(text);
            if (parsed._floormad_nodes) {
                nodesCopy = parsed._floormad_nodes;
            }
        } catch (e) {
            // Fallback: memory clipboard
            if (window._floormadClipboard) {
                nodesCopy = window._floormadClipboard;
            }
        }

        if (!nodesCopy || nodesCopy.length === 0) {
            showStatus('info', 'Nothing to Paste', 'No copied nodes found in clipboard.');
            return;
        }

        const offset = 100;
        let count = 0;
        nodesCopy.forEach(n => {
            try {
                editor.addNode(
                    n.name,
                    n.inputs,
                    n.outputs,
                    n.pos_x + offset,
                    n.pos_y + offset,
                    n.class,
                    JSON.parse(JSON.stringify(n.data)),
                    n.html
                );
                count++;
            } catch (err) { console.warn('Paste failed for node', n.name, err); }
        });

        if (count > 0) {
            showStatus('success', 'Pasted', `${count} node(s) pasted. Connect them as needed.`);
        }
    };

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        if (e.target.closest('input, textarea, select')) return;

        // Ctrl+C = copy selected nodes
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedNodeIds.length > 0) {
            e.preventDefault();
            window.copySelectedNodes();
            return;
        }

        // Ctrl+V = paste nodes
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            window.pasteNodes();
            return;
        }

        if (selectedNodeIds.length === 0) return;

        // Delete/Backspace = bulk delete
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            window.bulkDeleteSelected();
        }
        // Ctrl+D = bulk duplicate
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            window.bulkDuplicateSelected();
        }
    });
}

// --- INLINE RENAME ---
function initInlineRename() {
    const container = document.getElementById('drawflow');
    if (!container) return;

    container.addEventListener('dblclick', function (e) {
        const titleBox = e.target.closest('.title-box');
        if (!titleBox) return;
        if (titleBox.querySelector('input')) return; // Already editing

        // Set flag to prevent sidebar from opening
        window._isInlineRenaming = true;

        // Close the config sidebar if it opened from the first click
        const panel = document.getElementById('node-config-panel');
        if (panel) {
            panel.classList.add('hidden');
            panel.classList.remove('flex');
        }

        // Find node id
        const nodeEl = titleBox.closest('.drawflow-node');
        if (!nodeEl) return;
        const nodeId = nodeEl.id.replace('node-', '');

        // Get current text
        const currentText = titleBox.textContent.trim();
        // Extract emoji prefix
        const emojiMatch = currentText.match(/^([\p{Emoji}\uFE0F\s]+)/u);
        const emoji = emojiMatch ? emojiMatch[1].trim() : '';
        const nameOnly = emoji ? currentText.replace(emojiMatch[0], '').trim() : currentText;

        // Replace with input
        const origHtml = titleBox.innerHTML;
        titleBox.innerHTML = `<input type="text" value="${nameOnly}" 
            style="background:transparent; border:1px solid #60a5fa; color:white; font-size:inherit; font-weight:inherit; padding:1px 4px; border-radius:4px; width:100%; outline:none;"
            onclick="event.stopPropagation()" 
            onmousedown="event.stopPropagation()">`;

        const input = titleBox.querySelector('input');
        input.focus();
        input.select();

        // Prevent Drawflow from dragging while editing
        input.addEventListener('mousedown', e => e.stopPropagation());
        input.addEventListener('mouseup', e => e.stopPropagation());

        const finishEdit = () => {
            window._isInlineRenaming = false;
            const newName = input.value.trim() || nameOnly;
            titleBox.textContent = (emoji ? emoji + ' ' : '') + newName;

            // Save to Drawflow node data
            try {
                const node = editor.getNodeFromId(nodeId);
                if (node) {
                    if (!node.data.config) node.data.config = {};
                    node.data.config.node_name = newName;
                    editor.updateNodeDataFromId(nodeId, node.data);
                }
            } catch (e) { console.warn('Failed to save inline rename', e); }
        };

        input.addEventListener('blur', finishEdit, { once: true });
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { input.blur(); }
            if (e.key === 'Escape') {
                window._isInlineRenaming = false;
                titleBox.innerHTML = origHtml;
            }
        });
    });
}

// --- HTML PREVIEW ---
function previewHtmlOutput() {
    if (!currentProjectId) { showStatus('error', 'Error', 'No project selected'); return; }

    const srcInput = document.getElementById('cfg-preview-src');
    const varName = srcInput ? srcInput.value : 'html_content';

    // Priority 1: Use local result from recent "Run Workflow"
    console.log("previewHtmlOutput: checking lastExecutionResult", lastExecutionResult);
    if (lastExecutionResult && lastExecutionResult.final_context) {
        let htmlContent = '';
        const output = lastExecutionResult.final_context;
        console.log("previewHtmlOutput: final_context", output);
        console.log("previewHtmlOutput: Looking for varName:", varName);

        // Search for variable
        if (output[varName]) {
            htmlContent = output[varName];
            console.log("Found direct match for", varName);
        } else {
            // Deep search
            for (const key of Object.keys(output)) {
                if (typeof output[key] === 'object' && output[key] && output[key][varName]) {
                    htmlContent = output[key][varName];
                    console.log("Found nested match for", varName, "in", key);
                    break;
                }
            }
        }

        if (htmlContent) {
            const win = window.open('', '_blank', 'width=800,height=600');
            win.document.write(htmlContent);
            win.document.close();
            return;
        }
    }

    // Priority 2: Fetch processing runs from DB
    fetch(`/api/projects/${currentProjectId}/runs`)
        .then(r => r.json())
        .then(data => {
            const runs = data.runs || [];
            if (runs.length === 0) {
                showStatus('error', 'No Runs', 'Run the workflow first to generate output.');
                return;
            }
            // Get latest run output
            const lastRun = runs[0];
            return fetch(`/api/runs/${lastRun.id}`)
                .then(r => r.json());
        })
        .then(run => {
            if (!run) return;
            let htmlContent = '';

            // Try to find the variable in the run output
            if (run.output_json) {
                try {
                    const output = typeof run.output_json === 'string' ? JSON.parse(run.output_json) : run.output_json;
                    // Search through all node outputs for the variable
                    if (output[varName]) {
                        htmlContent = output[varName];
                    } else {
                        // Deep search
                        for (const key of Object.keys(output)) {
                            if (typeof output[key] === 'object' && output[key][varName]) {
                                htmlContent = output[key][varName];
                                break;
                            }
                        }
                    }
                } catch (e) { console.warn('Parse error', e); }
            }

            if (!htmlContent) {
                htmlContent = '<div style="padding:40px;text-align:center;color:#999;font-family:sans-serif;"><h2>No HTML output found</h2><p>Run the workflow first, or check that the variable name matches.</p></div>';
            }

            // Open preview window
            const win = window.open('', '_blank', 'width=800,height=600');
            win.document.write(htmlContent);
            win.document.close();
        })
        .catch(e => {
            showStatus('error', 'Preview Failed', e.message);
        });
}

// --- KNOWLEDGE FILE UPLOAD ---
async function uploadKnowledgeFile(input, nodeId) {
    const file = input.files[0];
    if (!file) return;

    showStatus('info', 'Processing...', `Reading ${file.name}...`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('node_id', nodeId);
    formData.append('project_id', currentProjectId);

    try {
        const res = await fetch('/api/knowledge/parse', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            // Set the text into the textarea
            const textarea = document.getElementById('cfg-knowledge-text');
            if (textarea) textarea.value = data.text;

            // Show preview
            const preview = document.getElementById(`knowledge-preview-${nodeId}`);
            if (preview) {
                preview.classList.remove('hidden');
                preview.querySelector('div').textContent = data.text.substring(0, 500) + (data.text.length > 500 ? '...' : '');
                preview.querySelector('label').textContent = `📋 Current Knowledge (${data.text.length} chars)`;
            }

            showStatus('success', 'File Parsed!', `${file.name} → ${data.text.length} characters extracted`);
        } else {
            showStatus('error', 'Parse Failed', data.error || 'Unknown error');
        }
    } catch (e) {
        showStatus('error', 'Upload Failed', e.message);
    }
}

// --- LOAD/SAVE WORKFLOW ---
// (Replaces renderWorkflow which was for list view)
function normalizeWorkflowForImport(wf) {
    if (!wf || Object.keys(wf).length === 0) return null;

    let data = wf;

    // Unwrap extra 'drawflow' layers (e.g. {drawflow: {drawflow: {Home: ...}}})
    let safety = 0;
    while (data && data.drawflow && !data.Home && safety < 5) {
        data = data.drawflow;
        safety++;
    }

    // Wrap if needed: Drawflow expects {drawflow: {Home: {data: {...}}}}
    if (data && data.Home && !data.drawflow) {
        data = { drawflow: data };
    }

    return data;
}

// Force all connection paths to recalculate their SVG coordinates
// This is needed because Drawflow's updateConnectionNodes uses getBoundingClientRect()
// which returns 0,0 if nodes aren't rendered yet (tab not visible, etc.)
function forceRedrawConnections() {
    if (!editor) return;

    const redraw = () => {
        try {
            // Get all node IDs from the Drawflow data
            const data = editor.drawflow.drawflow[editor.module]?.data || {};
            const nodeIds = Object.keys(data);

            // Recalculate connections for each node
            nodeIds.forEach(id => {
                editor.updateConnectionNodes('node-' + id);
            });

            editor.zoom_refresh();
            console.log(`Forced redraw of connections for ${nodeIds.length} nodes`);
        } catch (e) {
            console.error('forceRedrawConnections error:', e);
        }
    };

    // Multiple passes to ensure rendering at different stages
    requestAnimationFrame(() => {
        redraw();
        setTimeout(redraw, 100);
        setTimeout(redraw, 300);
        setTimeout(redraw, 600);
    });
}

function renderWorkflow() {
    if (editor) {
        editor.clear();

        if (currentWorkflow && Object.keys(currentWorkflow).length > 0) {
            try { repairWorkflow(currentWorkflow); } catch (e) { console.error("Repair failed", e); }

            const importData = normalizeWorkflowForImport(currentWorkflow);
            if (importData) {
                try {
                    editor.import(importData);
                    console.log("Workflow imported successfully");
                    // Force connection lines to render by recalculating all node connections
                    forceRedrawConnections();
                } catch (e) {
                    console.error("Import failed", e);
                }
            }
        }
    } else {
        initDrawflow();
        if (editor && currentWorkflow) {
            try { repairWorkflow(currentWorkflow); } catch (e) { }
            const importData = normalizeWorkflowForImport(currentWorkflow);
            if (importData) {
                try {
                    editor.import(importData);
                    // Force connection lines to render by recalculating all node connections
                    forceRedrawConnections();
                } catch (e) { console.error("Import failed (init)", e); }
            }
        }
    }
}

function repairWorkflow(json) {
    if (!json || !json.drawflow || !json.drawflow.Home || !json.drawflow.Home.data) return;

    const nodes = json.drawflow.Home.data;

    // Expected inputs/outputs for each node type
    const nodeIOMap = {
        'TRIGGER': { inputs: 0, outputs: 1 },
        'AI_COMPLETION': { inputs: 1, outputs: 1 },
        'HTML_TEMPLATE': { inputs: 1, outputs: 1 },
        'SEND_EMAIL': { inputs: 1, outputs: 1 },
        'SEND_WHATSAPP': { inputs: 1, outputs: 1 },
        'HTML_PREVIEW': { inputs: 1, outputs: 1 },
        'KNOWLEDGE': { inputs: 1, outputs: 1 },
        'GOOGLE_SHEET': { inputs: 1, outputs: 1 },
        'PIPEDRIVE': { inputs: 1, outputs: 1 },
    };

    const htmlTemplates = {
        'TRIGGER': `<div class="node-content trigger-node"><div class="title-box">⚡ Trigger</div><div class="box"><p>Cron / Webhook</p></div></div>`,
        'AI_COMPLETION': `<div class="node-content ai-node"><div class="title-box">✨ AI Completion</div><div class="box"><p>Gen Text/JSON</p></div></div>`,
        'HTML_TEMPLATE': `<div class="node-content html-node"><div class="title-box">📄 HTML Template</div><div class="box"><p>Build HTML</p></div></div>`,
        'SEND_EMAIL': `<div class="node-content email-node"><div class="title-box">📧 Send Email</div><div class="box"><p>SMTP/Gmail</p></div></div>`,
        'SEND_WHATSAPP': `<div class="node-content wa-node"><div class="title-box">💬 WhatsApp</div><div class="box"><p>WeSender</p></div></div>`,
        'HTML_PREVIEW': `<div class="node-content preview-node" style="border-color:#10b981;"><div class="title-box" style="background:linear-gradient(135deg,#065f46,#047857);">👁️ HTML Preview</div><div class="box"><p>Live Preview</p></div></div>`,
        'KNOWLEDGE': `<div class="node-content knowledge-node" style="border-color:#14b8a6;"><div class="title-box" style="background:linear-gradient(135deg,#134e4a,#0f766e);">📚 Knowledge</div><div class="box"><p>Data Source</p></div></div>`,
        'GOOGLE_SHEET': `<div class="node-content sheet-node" style="border-color:#34a853;"><div class="title-box" style="background:linear-gradient(135deg,#188038,#137333);">📊 Google Sheet</div><div class="box"><p>Read/Filter Rows</p></div></div>`,
        'PIPEDRIVE': `<div class="node-content pipedrive-node" style="border-color:#7c3aed;"><div class="title-box" style="background:linear-gradient(135deg,#5b21b6,#7c3aed);">🔗 Pipedrive</div><div class="box"><p>CRM Sync</p></div></div>`,
    };

    Object.values(nodes).forEach(node => {
        const type = (node.name || '').toUpperCase();

        // Fix HTML if missing
        if ((!node.html || node.html.includes('Unknown') || node.html.includes('UNKNOWN')) && htmlTemplates[type]) {
            console.log(`Repairing HTML for node ${node.id} (${node.name})`);
            node.html = htmlTemplates[type];
        }

        // Fix inputs/outputs port count
        const expected = nodeIOMap[type];
        if (expected) {
            const currentInputs = Object.keys(node.inputs || {}).length;
            const currentOutputs = Object.keys(node.outputs || {}).length;

            // Add missing input ports (preserve existing connections)
            if (currentInputs < expected.inputs) {
                for (let i = currentInputs + 1; i <= expected.inputs; i++) {
                    node.inputs['input_' + i] = { connections: [] };
                }
                console.log(`Added input port(s) to node ${node.id} (${type})`);
            }

            // Add missing output ports (preserve existing connections)
            if (currentOutputs < expected.outputs) {
                for (let i = currentOutputs + 1; i <= expected.outputs; i++) {
                    node.outputs['output_' + i] = { connections: [] };
                }
                console.log(`Added output port(s) to node ${node.id} (${type})`);
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

async function openSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Load Settings
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();

        document.getElementById('gs-client-id').value = settings.google_client_id || '';
        document.getElementById('gs-client-secret').value = settings.google_client_secret || '';
    } catch (e) {
        console.error("Failed to load settings", e);
        showStatus('error', 'Error', 'Failed to load global settings');
    }
}

async function saveGlobalSettings() {
    const clientId = document.getElementById('gs-client-id').value;
    const clientSecret = document.getElementById('gs-client-secret').value;

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                google_client_id: clientId,
                google_client_secret: clientSecret
            })
        });
        const data = await res.json();
        if (data.success) {
            showStatus('success', 'Saved', 'Global settings updated');
            document.getElementById('settings-modal').classList.add('hidden');
            document.getElementById('settings-modal').classList.remove('flex');
        } else {
            throw new Error(data.message);
        }
    } catch (e) {
        showStatus('error', 'Save Failed', e.message);
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
    const to = document.getElementById('int-smtp-to').value; // Get Test Recipient

    if (!host || !user || !pass) {
        showStatus('error', 'Missing Fields', 'Please fill Host, User and Password.');
        return;
    }

    showStatus('loading', 'Testing SMTP...', 'Sending test email...');

    try {
        const res = await fetch('/api/test/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port, user, password: pass, from_name: from || "Floormad Admin", to_email: to }) // Changed from 'pass' to 'password'
        });
        const data = await res.json();

        if (!res.ok) {
            // Handle FastAPI errors (422, etc)
            let msg = data.message || "Unknown error";
            if (data.detail) {
                if (Array.isArray(data.detail)) {
                    msg = data.detail.map(d => `${d.loc.join('.')} : ${d.msg}`).join('\n');
                } else {
                    msg = data.detail;
                }
            }
            throw new Error(msg);
        }

        if (data.success) {
            showStatus('success', 'Email Sent', 'Check your inbox for the test email.');
        } else {
            throw new Error(data.message || "Operation failed without message");
        }
    } catch (e) {
        console.error("SMTP Test Error", e);
        showStatus('error', 'Test Failed', e.message);
        addSystemLog('error', 'SMTP Test Failed: ' + e.message);
    }
}

// Test Email from SEND_EMAIL Node using last execution data
async function testEmailNode() {
    const resultDiv = document.getElementById('test-email-result');
    const spinner = document.getElementById('test-email-spinner');

    // Read current node config
    const toField = document.getElementById('cfg-to')?.value || '';
    const subject = document.getElementById('cfg-subj')?.value || '';
    const bodyVar = document.getElementById('cfg-body')?.value || '';

    // Resolve variables from last execution context
    const ctx = lastExecutionResult?.final_context || {};

    // Resolve {{var}} patterns
    function resolveVars(template) {
        if (!template) return template;
        return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
            return ctx[varName] !== undefined ? String(ctx[varName]) : match;
        });
    }

    let recipient = resolveVars(toField);
    let resolvedSubject = resolveVars(subject);

    // Get body from context variable
    let emailBody = '';
    if (bodyVar && ctx[bodyVar]) {
        emailBody = ctx[bodyVar];
    } else {
        // Try common keys
        for (const key of ['_html_rendered', 'content', 'html', 'email_body', 'html_content']) {
            if (ctx[key] && typeof ctx[key] === 'string' && ctx[key].length > 10) {
                emailBody = ctx[key];
                break;
            }
        }
    }

    if (!recipient || !recipient.includes('@')) {
        // Prompt for recipient
        recipient = prompt('Inserisci email destinatario per il test:', recipient || '');
        if (!recipient) return;
    }

    if (!emailBody) {
        if (resultDiv) {
            resultDiv.classList.remove('hidden', 'border-green-600', 'text-green-400', 'bg-green-900/20');
            resultDiv.classList.add('border-yellow-600', 'text-yellow-400', 'bg-yellow-900/20');
            resultDiv.textContent = '⚠️ Nessun contenuto email trovato. Esegui prima un Run del workflow.';
        }
        return;
    }

    // Show loading
    if (spinner) spinner.classList.remove('hidden');
    if (resultDiv) {
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'mt-2 text-xs p-2 rounded border border-gray-600 text-gray-400 bg-gray-800';
        resultDiv.textContent = '⏳ Sending test email...';
    }

    try {
        const res = await fetch('/api/test/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                host: document.getElementById('int-smtp-host')?.value || '',
                port: document.getElementById('int-smtp-port')?.value || '587',
                user: document.getElementById('int-smtp-user')?.value || '',
                password: document.getElementById('int-smtp-pass')?.value || '',
                from_name: document.getElementById('int-smtp-from')?.value || 'Floormad',
                to_email: recipient,
                subject: resolvedSubject || 'Test Email from Workflow Node',
                html_body: emailBody
            })
        });
        const data = await res.json();

        if (data.success) {
            if (resultDiv) {
                resultDiv.className = 'mt-2 text-xs p-2 rounded border border-green-600 text-green-400 bg-green-900/20';
                resultDiv.textContent = `✅ Email inviata a ${recipient}`;
            }
            showStatus('success', 'Test Email Sent', `Email sent to ${recipient}`);
        } else {
            throw new Error(data.message || 'Send failed');
        }
    } catch (e) {
        if (resultDiv) {
            resultDiv.className = 'mt-2 text-xs p-2 rounded border border-red-600 text-red-400 bg-red-900/20';
            resultDiv.textContent = `❌ ${e.message}`;
        }
        showStatus('error', 'Test Failed', e.message);
    } finally {
        if (spinner) spinner.classList.add('hidden');
    }
}

async function testWhatsApp() {
    const apiKey = document.getElementById('int-wesender-key').value;
    const apiUrl = document.getElementById('int-wesender-url').value;
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
            body: JSON.stringify({ api_key: apiKey, api_url: apiUrl, phone: phone })
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

async function testPipedrive() {
    const apiToken = document.getElementById('int-pipedrive-token').value;
    if (!apiToken) {
        showStatus('error', 'Missing Token', 'Please enter Pipedrive API Token.');
        return;
    }

    showStatus('loading', 'Testing Pipedrive...', 'Connecting to Pipedrive API...');

    try {
        const res = await fetch('/api/test/pipedrive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_token: apiToken })
        });
        const data = await res.json();
        if (data.success) {
            showStatus('success', 'Pipedrive Connected', data.message);
        } else {
            throw new Error(data.message);
        }
    } catch (e) {
        showStatus('error', 'Test Failed', e.message);
    }
}

// WebSocket Logic
let ws = null;

function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws/workflow-status`);

    ws.onopen = () => {
        console.log("WebSocket Connected");
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'execution_update') {
                updateNodeStatus(data.node_id, data.status, data.message);
            }
        } catch (e) {
            console.error("WS Message Error:", e);
        }
    };

    ws.onclose = () => {
        console.log("WebSocket Disconnected. Reconnecting in 5s...");
        setTimeout(connectWebSocket, 5000);
    };
}

function updateNodeStatus(nodeId, status, message) {
    if (!editor) return;

    const el = document.getElementById(`node-${nodeId}`);
    if (!el) return;

    // Remove old overlays & classes
    el.classList.remove('ring-4', 'ring-yellow-400', 'ring-green-500', 'ring-red-500', 'animate-pulse', 'opacity-50', 'grayscale');
    el.style.removeProperty('box-shadow');
    const oldOverlay = el.querySelector('.node-exec-overlay');
    if (oldOverlay) oldOverlay.remove();

    if (status === 'running') {
        el.classList.add('ring-4', 'ring-yellow-400', 'animate-pulse');
        el.style.boxShadow = '0 0 20px rgba(250,204,21,0.5), 0 0 40px rgba(250,204,21,0.2)';
        // Add spinner overlay
        const overlay = document.createElement('div');
        overlay.className = 'node-exec-overlay';
        overlay.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);border-radius:0.5rem;z-index:10;"><div style="width:28px;height:28px;border:3px solid rgba(250,204,21,0.3);border-top-color:#facc15;border-radius:50%;animation:spin 0.8s linear infinite;"></div></div>';
        el.style.position = 'relative';
        el.appendChild(overlay);
    } else if (status === 'completed' || status === 'success') {
        el.classList.add('ring-4', 'ring-green-500');
        el.style.boxShadow = '0 0 20px rgba(34,197,94,0.5), 0 0 40px rgba(34,197,94,0.2)';
        // Add checkmark overlay briefly
        const overlay = document.createElement('div');
        overlay.className = 'node-exec-overlay';
        overlay.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);border-radius:0.5rem;z-index:10;"><span style="font-size:28px;animation:popIn 0.3s ease-out;">✅</span></div>';
        el.style.position = 'relative';
        el.appendChild(overlay);
        setTimeout(() => { const o = el.querySelector('.node-exec-overlay'); if (o) o.remove(); }, 2000);
        setTimeout(() => { el.style.boxShadow = '0 0 10px rgba(34,197,94,0.3)'; }, 3000);
    } else if (status === 'error' || status === 'failed') {
        el.classList.add('ring-4', 'ring-red-500');
        el.style.boxShadow = '0 0 20px rgba(239,68,68,0.5), 0 0 40px rgba(239,68,68,0.2)';
        const overlay = document.createElement('div');
        overlay.className = 'node-exec-overlay';
        overlay.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);border-radius:0.5rem;z-index:10;"><span style="font-size:28px;animation:popIn 0.3s ease-out;">❌</span></div>';
        el.style.position = 'relative';
        el.appendChild(overlay);
    } else if (status === 'skipped') {
        el.classList.add('opacity-50', 'grayscale');
    }
}

function runWorkflow() {
    if (!currentProjectId) {
        showStatus('error', 'Error', 'No project selected.');
        return;
    }

    // Ensure WS is connected
    connectWebSocket();

    // Reset previous statuses visual
    document.querySelectorAll('.drawflow-node').forEach(el => {
        el.classList.remove('ring-4', 'ring-yellow-400', 'ring-green-500', 'ring-red-500', 'animate-pulse');
    });

    const btn = document.querySelector('button[onclick="runWorkflow()"]');
    const spinner = document.getElementById('run-spinner');
    const outputBtn = document.getElementById('btn-view-output');

    const setRunning = (isRunning) => {
        if (btn) {
            btn.disabled = isRunning;
            if (isRunning) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                if (spinner) spinner.classList.remove('hidden');
                if (outputBtn) outputBtn.classList.add('hidden');
            } else {
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                if (spinner) spinner.classList.add('hidden');
            }
        }
    };

    setRunning(true);

    // Show "running" spinner on trigger node immediately
    const triggerEl = document.querySelector('.drawflow-node.TRIGGER');
    if (triggerEl) {
        const triggerNodeId = triggerEl.id.replace('node-', '');
        updateNodeStatus(triggerNodeId, 'running', 'Starting...');
    }

    saveConfig().then(() => {
        fetch(`/api/projects/${currentProjectId}/run`, { method: 'POST' })
            .then(async res => {
                const data = await res.json();
                lastExecutionResult = data;

                // Animate execution log sequentially
                const log = data.log || [];
                await animateExecutionLog(log, data.status);

                if (data.status === 'error' || data.status === 'failed') {
                    let errorDetail = data.message || data.error || 'Unknown Execution Error';

                    if (log.length > 0) {
                        errorDetail += '\n\n── Execution Log ──\n';
                        log.forEach((entry, i) => {
                            const icon = entry.status === 'success' ? '✅' : entry.status === 'error' ? '❌' : '⏭️';
                            errorDetail += `${icon} ${entry.node_name || entry.type || 'Node'} (${entry.node_id}): ${entry.status}`;
                            if (entry.error) errorDetail += ` → ${entry.error}`;
                            if (entry.output) errorDetail += `\n   Output: ${entry.output.substring(0, 150)}`;
                            errorDetail += '\n';
                        });
                    }

                    if (data.traceback) {
                        errorDetail += '\n── Python Traceback ──\n' + data.traceback;
                    }

                    showStatus('error', 'Execution Failed', errorDetail);
                    addSystemLog('error', 'Workflow Execution Failed: ' + (data.message || 'Unknown'));

                    if (data.final_context || data.log) {
                        populateJsonPreview(data);
                        if (outputBtn) { outputBtn.classList.remove('hidden'); outputBtn.classList.add('flex'); }
                    }
                    return;
                }

                console.log("Execution Result:", data);
                showStatus('success', 'Workflow Executed', 'Check output for details.');
                addSystemLog('success', 'Workflow executed successfully.');

                populateJsonPreview(data);

                if (outputBtn) {
                    outputBtn.classList.remove('hidden');
                    outputBtn.classList.add('flex');
                }
            })
            .catch(err => {
                console.error(err);
                showStatus('error', 'Execution Failed', err.message);
                addSystemLog('error', 'Workflow Execution Failed: ' + err.message);
            })
            .finally(() => {
                setRunning(false);
            });
    });
}

// Animate execution log nodes sequentially with delays
async function animateExecutionLog(log, finalStatus) {
    for (let i = 0; i < log.length; i++) {
        const entry = log[i];
        const nodeId = entry.node_id;

        // Show running state
        updateNodeStatus(nodeId, 'running', 'Processing...');

        // Wait based on position (faster for earlier nodes)
        await new Promise(r => setTimeout(r, 600));

        // Show final state
        const status = entry.status === 'success' ? 'completed' :
            entry.status === 'skipped' ? 'skipped' : 'error';
        updateNodeStatus(nodeId, status, entry.output || '');

        // Small pause before next node
        await new Promise(r => setTimeout(r, 300));
    }
}

// --- JSON DATA PREVIEW PANEL ---
function toggleJsonBottomBar() {
    const content = document.getElementById('json-bar-content');
    const chevron = document.getElementById('json-bar-chevron');
    if (!content) return;
    const isHidden = content.classList.contains('hidden');
    if (isHidden) {
        content.classList.remove('hidden');
        if (chevron) chevron.textContent = '▼';
        // Re-render if we have cached data
        if (lastExecutionResult && lastExecutionResult.final_context) {
            populateJsonPreview(lastExecutionResult);
        }
    } else {
        content.classList.add('hidden');
        if (chevron) chevron.textContent = '▲';
    }
}

function populateJsonPreview(data) {
    const container = document.getElementById('json-preview-content');
    const countEl = document.getElementById('json-bar-count');
    const content = document.getElementById('json-bar-content');
    const chevron = document.getElementById('json-bar-chevron');
    if (!container) return;

    const context = data.final_context || {};
    const log = data.log || [];

    // Filter out internal node IDs (numeric)
    const entries = Object.entries(context).filter(([key]) => {
        if (/^\d+$/.test(key)) return false;
        return true;
    });

    // Update count in header
    if (countEl) {
        countEl.textContent = entries.length > 0 ? `(${entries.length} fields)` : '(empty)';
        countEl.className = entries.length > 0 ? 'text-[10px] text-green-500 ml-1 font-bold' : 'text-[10px] text-gray-600 ml-1';
    }

    if (entries.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 text-xs py-3 w-full">
            <span class="text-lg">📭</span>
            <span class="ml-2">No JSON fields collected. Run your workflow.</span>
        </div>`;
        return;
    }

    // Auto-expand the bar when data arrives
    if (content && content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (chevron) chevron.textContent = '▼';
    }

    // Build compact card grid
    let html = '<div class="flex flex-wrap gap-2" style="max-height:160px; overflow-y:auto; padding-bottom:4px;">';

    entries.forEach(([varName, value]) => {
        let preview = '';
        let bgColor = 'bg-gray-800';
        let textColor = 'text-blue-400';

        if (typeof value === 'string') {
            const stripped = value.replace(/<[^>]*>/g, '').trim();
            preview = stripped.substring(0, 40) + (stripped.length > 40 ? '…' : '');
            if (value.includes('<html') || value.includes('<div') || value.includes('<table')) {
                bgColor = 'bg-purple-900/30';
                textColor = 'text-purple-400';
            }
        } else if (typeof value === 'object' && value !== null) {
            preview = JSON.stringify(value).substring(0, 40) + '…';
            bgColor = 'bg-amber-900/20';
            textColor = 'text-amber-400';
        } else {
            preview = String(value).substring(0, 40);
        }

        html += `
        <div class="${bgColor} border border-gray-700 rounded-md px-2.5 py-1.5 hover:border-gray-500 transition cursor-pointer group relative">
             <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5" onclick="copyJsonVar('${varName}')" title="Click to copy">
                    <code class="${textColor} text-[11px] font-mono font-bold whitespace-nowrap">{{${varName}}}</code>
                    <span class="text-gray-600 text-[10px] opacity-0 group-hover:opacity-100 transition">📋</span>
                </div>
                <!-- Eye Icon for Preview -->
                <button onclick="viewJsonVar('${varName}'); event.stopPropagation();" class="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition p-0.5 rounded hover:bg-white/10" title="View Full Content">
                    👁️
                </button>
            </div>
            <div class="text-gray-500 text-[10px] mt-0.5 truncate max-w-[200px]" onclick="copyJsonVar('${varName}')">${escapeHtml(preview)}</div>
        </div>`;
    });

    html += '</div>';

    container.innerHTML = html;
    // Reset container styles for the new layout
    container.className = 'px-3 py-2 overflow-x-auto';
    container.style.maxHeight = '180px';
    container.style.overflowY = 'auto';
}

function copyJsonVar(varName) {
    navigator.clipboard.writeText('{{' + varName + '}}').then(() => {
        showStatus('success', 'Copied!', '{{' + varName + '}} copied to clipboard');
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    // connectWebSocket(); // Call in initApp instead
});

// Init Logic
function initApp() {
    console.log("DOM Ready. Initializing...");

    // Fetch Projects
    fetchProjects().catch(err => {
        console.error("Init fetchProjects failed:", err);
    });

    // Fetch System Info
    fetchSystemInfo();

    // Connect WS
    connectWebSocket();

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


// --- GOOGLE OAUTH & PICKER ---

let googlePickerApiLoaded = false;

async function checkOAuthStatus() {
    if (!currentProjectId) return;
    try {
        const res = await fetch(`/api/projects/${currentProjectId}/auth_status`);
        const data = await res.json();
        const statusEl = document.getElementById('oauth-status');
        const connectBtn = document.getElementById('btn-connect-google');
        const disconnectBtn = document.getElementById('btn-disconnect-google');
        if (statusEl) {
            if (data.connected) {
                statusEl.innerHTML = `✅ <span class="text-green-400">Connected</span>`;
                statusEl.classList.remove('text-gray-500');
                if (connectBtn) connectBtn.classList.add('hidden');
                if (disconnectBtn) { disconnectBtn.classList.remove('hidden'); disconnectBtn.classList.add('flex'); }
            } else {
                const errorMsg = data.error || 'Not Connected';
                statusEl.innerHTML = `<span class="text-red-400">${errorMsg}</span>`;
                statusEl.classList.add('text-gray-500');
                if (connectBtn) connectBtn.classList.remove('hidden');
                if (disconnectBtn) { disconnectBtn.classList.add('hidden'); disconnectBtn.classList.remove('flex'); }
            }
        }
    } catch (e) {
        console.error("Auth status check failed", e);
    }
}

async function connectGoogleDrive() {
    if (!currentProjectId) return showStatus('error', 'Error', 'No project selected.');

    // 1. Get Auth URL
    try {
        const res = await fetch(`/api/auth/google/url?project_id=${currentProjectId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // 2. Open Popup
        const width = 500;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        window.open(data.url, 'google_oauth', `width=${width},height=${height},top=${top},left=${left}`);

    } catch (e) {
        showStatus('error', 'OAuth Failed', e.message);
    }
}

// Handle Message from Popup
window.addEventListener('message', (event) => {
    if (event.data === 'oauth_success') {
        showStatus('success', 'Connected', 'Google Account linked successfully.');
        checkOAuthStatus();
    }
});

async function disconnectGoogle() {
    if (!currentProjectId) return showStatus('error', 'Error', 'No project selected.');
    const confirmed = await showConfirm('Disconnect Google Account from this project? You will need to reconnect to use Google features.', 'Disconnect Google', '🔌');
    if (!confirmed) return;
    try {
        const res = await fetch(`/api/projects/${currentProjectId}/disconnect_google`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showStatus('success', 'Disconnected', 'Google Account has been disconnected.');
            checkOAuthStatus();
        } else {
            throw new Error(data.error || 'Disconnect failed');
        }
    } catch (e) {
        showStatus('error', 'Error', e.message);
    }
}

// Picker Logic
function loadGoogleApi() {
    if (typeof gapi !== 'undefined') {
        gapi.load('picker', { 'callback': onPickerApiLoad });
    }
}

function onPickerApiLoad() {
    googlePickerApiLoaded = true;
}

if (typeof gapi !== 'undefined') {
    loadGoogleApi();
} else {
    window.addEventListener('load', () => { if (typeof gapi !== 'undefined') loadGoogleApi(); });
}

async function openDrivePicker(callback) {
    if (!googlePickerApiLoaded) {
        loadGoogleApi();
        if (!googlePickerApiLoaded) return showStatus('error', 'API Error', 'Google Picker API not loaded. Check connection?');
    }

    if (!currentProjectId) return;

    try {
        const res = await fetch(`/api/projects/${currentProjectId}/picker_token`);
        if (!res.ok) throw new Error("Failed to get picker token");
        const data = await res.json();

        if (!data.token) {
            const doConnect = await showConfirm('Google Drive is not connected. Connect now?', 'Connect Google', '🔗');
            if (doConnect) connectGoogleDrive();
            return;
        }

        const view = new google.picker.View(google.picker.ViewId.SPREADSHEETS);
        const picker = new google.picker.PickerBuilder()
            .setAppId(data.app_id)
            .setOAuthToken(data.token)
            .addView(view)
            .addView(new google.picker.DocsUploadView())
            .setCallback((data) => {
                if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
                    const doc = data[google.picker.Response.DOCUMENTS][0];
                    const fileId = doc[google.picker.Document.ID];
                    callback(fileId, doc);
                }
            })
            .build();
        picker.setVisible(true);

    } catch (e) {
        showStatus('error', 'Picker Failed', e.message);
    }
}

// --- SETTINGS LOGIC ---

async function openSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();

        const elId = document.getElementById('gs-client-id');
        const elSecret = document.getElementById('gs-client-secret');
        if (elId) elId.value = settings.google_client_id || '';
        if (elSecret) elSecret.value = settings.google_client_secret || '';
    } catch (e) {
        console.error("Failed to load settings", e);
    }
}

async function saveGlobalSettings() {
    const clientId = document.getElementById('gs-client-id').value;
    const clientSecret = document.getElementById('gs-client-secret').value;

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                google_client_id: clientId,
                google_client_secret: clientSecret
            })
        });
        const data = await res.json();
        if (data.success) {
            showStatus('success', 'Saved', 'Global settings updated');
            document.getElementById('settings-modal').classList.add('hidden');
            document.getElementById('settings-modal').classList.remove('flex');
        } else {
            throw new Error(data.message);
        }
    } catch (e) {
        showStatus('error', 'Save Failed', e.message);
    }
}

// Hook into openConfig (Global Override) to verify/init OAuth status
// We need to wait for original function to be available if defined elsewhere, 
// but since we are at the end of the file, it should be fine.
const _originalOpenConfig = window.openConfig;
window.openConfig = async function (id) {
    if (typeof _originalOpenConfig === 'function') {
        await _originalOpenConfig(id);
    } else {
        // Checking if openConfig is defined on global scope but not window
        // In browsers, global functions are on window.
        // If not found, maybe retry or just proceed with check.
        // console.warn("Original openConfig not found via window.openConfig");
    }
    // Check OAuth Status
    checkOAuthStatus();
};

// --- VERSION HISTORY ---

function toggleVersionPanel() {
    const panel = document.getElementById('version-history-panel');
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        panel.classList.add('flex');
        loadVersionHistory();
    } else {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
    }
}

async function loadVersionHistory() {
    if (!currentProjectId) return;
    const list = document.getElementById('version-list');
    list.innerHTML = '<p class="text-gray-500 text-xs text-center py-4">Loading...</p>';

    try {
        const res = await fetch(`/api/projects/${currentProjectId}/versions`);
        const data = await res.json();

        if (!data.versions || data.versions.length === 0) {
            list.innerHTML = '<p class="text-gray-500 text-xs text-center py-4">No versions yet. Save your workflow to create the first version.</p>';
            return;
        }

        list.innerHTML = data.versions.map(v => {
            const d = new Date(v.created_at + 'Z');
            const timeStr = d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return `
                <div class="bg-gray-700/50 border border-gray-600 rounded-lg p-3 hover:border-blue-500/50 transition">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-bold text-blue-400">${v.label}</span>
                        <span class="text-[10px] text-gray-500">${timeStr}</span>
                    </div>
                    <button onclick="restoreVersion('${v.id}', '${v.label}')"
                        class="w-full mt-1.5 py-1.5 bg-gray-600 hover:bg-amber-600 text-gray-300 hover:text-white text-[11px] rounded transition flex items-center justify-center gap-1">
                        ↩️ Restore
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        list.innerHTML = '<p class="text-red-400 text-xs text-center py-4">Failed to load versions.</p>';
    }
}

async function createManualSnapshot() {
    if (!currentProjectId) return;
    const label = prompt('Name this snapshot (optional):') || '';

    try {
        const res = await fetch(`/api/projects/${currentProjectId}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: label || undefined })
        });
        const data = await res.json();
        if (data.success) {
            showStatus('success', 'Snapshot Saved', `Version "${data.label}" created.`);
            loadVersionHistory();
        } else {
            throw new Error('Failed');
        }
    } catch (e) {
        showStatus('error', 'Snapshot Failed', e.message);
    }
}

async function restoreVersion(versionId, label) {
    const confirmed = await showConfirm(`Restore version "${label}"? This will replace your current workflow. Make sure to save a snapshot first if needed.`, 'Restore Version', '⏳');
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/projects/${currentProjectId}/versions/${versionId}/restore`, {
            method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
            showStatus('success', 'Restored!', `Workflow restored to "${label}". Reloading...`);
            // Reload the project to get the restored workflow
            setTimeout(() => {
                openConfig(currentProjectId);
            }, 500);
        } else {
            throw new Error(data.message || 'Restore failed');
        }
    } catch (e) {
        showStatus('error', 'Restore Failed', e.message);
    }
}
