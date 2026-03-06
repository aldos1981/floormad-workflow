# Changelog

## [3.3.0] — 2026-03-06 14:35
### ✨ Nuova Feature — Cron Scheduler Automatico
- **Background Scheduler**: I workflow con trigger "Cron Schedule" ora partono automaticamente
  - Loop asyncio al boot che controlla ogni 30s i progetti attivi
  - Legge `cron_expression` dal nodo Trigger del workflow
  - Usa `croniter` per valutare se è il momento di eseguire
  - **Anti-spam**: intervallo minimo 4 minuti tra le esecuzioni dello stesso progetto
  - Log delle esecuzioni nella tabella `runs`
  - Notifica via WebSocket al frontend quando un cron run completa
- Aggiunto `croniter` a requirements.txt

## [3.2.1] — 2026-03-06 12:37
### 🐛 Fix Critico — Email dal Workflow
- **Bridge MIME Encoding**: L'HTML del preventivo (tabelle, €, ²) superava il limite SMTP di 998 char/riga
  - Aggiunto `Content-Transfer-Encoding: base64` per text/plain e text/html
  - `chunk_split(base64_encode(...))` split in righe da 76 caratteri
  - Questo spiega perché il test (HTML breve) funzionava ma il workflow (HTML lungo) no

## [3.2.0] — 2026-03-06 12:22
### 🐛 Fix Critico
- **Spacebar Panning**: Riscritto completamente il sistema di panning con Space
  - Overlay con background semi-trasparente (`rgba(0,0,0,0.001)`) per garantire cattura click
  - Intercettore mousedown in fase CAPTURE che blocca Drawflow quando Space è premuto
  - Nullificazione `editor.ele_selected` e `editor.node_selected` per cancellare drag attivi
  - Fix regex double-escape in translate pattern
### 🔧 Miglioramento
- Bridge email: aggiunto `bridge_debug` nell'output per diagnostica SMTP step-by-step
- Gestione redirect HTTP→HTTPS nel bridge call

## [3.1.1] — 2026-03-06 12:14
### 🐛 Debug
- Aggiunto logging dettagliato alla chiamata bridge.php (HTTP status, response body, SMTP debug steps)
- Gestione redirect HTTP→HTTPS che potrebbe perdere il body POST
- L'output del nodo email ora include `bridge_debug` con i passi SMTP

## [3.1.0] — 2026-03-06 12:11
### ✨ Nuove Funzionalità
- **Feedback Visuale Workflow**: Ogni nodo mostra spinner giallo + glow durante l'esecuzione
- **Animazione Sequenziale**: I nodi si animano uno dopo l'altro con ✅ (successo) o ❌ (errore)
- **Pulsante Test Email**: Aggiunto 🧪 "Test Send Email" nel pannello configurazione del nodo SEND_EMAIL
  - Usa i dati dell'ultimo Run per inviare una email reale di test
  - Risolve automaticamente le variabili {{...}} dal contesto di esecuzione
### 🐛 Fix
- **Spacebar Panning**: Fix per muovere l'intera canvas invece dei singoli nodi
  - Aggiunto `pointer-events: none` su tutti i nodi durante space hold
  - Disabilitati `editor.drag` e `editor.drag_point` durante il panning
### 🎨 UI
- Aggiornato cache-busting JS a `?v=3.1.0`
- Aggiunte animazioni CSS `@keyframes spin` e `@keyframes popIn`

## [3.0.0] — 2026-03-06
### 🚀 Major Release
- **SMTP Bridge**: Routing email tramite bridge.php su cPanel (Railway blocca SMTP diretto)
- **Workflow Engine**: `execute_email` ora prova bridge.php → fallback a SMTP diretto
- **Redirect**: Aggiunto index.html per redirect workflow.floormad.com → Railway

## [1.0.0] - 2024-05-22
### 🚀 Major Release
- **Project Media Library**: Gestione file centralizzata (stile WordPress) per ogni progetto.
- **Product Catalog 2.0**:
    - **Dynamic Attributes**: Attributi personalizzabili per prodotto.
    - **Knowledge Base**: Link PDF/Docs per elaborazione AI.
    - **AI Integration**: Auto-riasunto dei file knowledge caricati.
- **Workflow Builder**:
    - **Interaction Fixes**: Drag-and-drop nativo ripristinato.
    - **UI Toolbar**: Aggiunti pulsanti "Save Workflow" e "Output".
    - **AI Node**: Supporto Gemini 1.5 Pro e inserimento header dinamico da Google Sheets.
- **System**:
    - Toast Notifications migliorati.
    - Ottimizzazioni database.

## [0.5.0] - Beta
- Implementazione iniziale Workflow Engine.
- Sync base Google Sheets.
- Nodi Trigger e Action.
