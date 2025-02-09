<script>
    import { onMount } from 'svelte';
    import { PrinterConnection } from '$lib/PrinterConnection';
    
    let printerConnection;
    let selectedFile;
    let printers = [];
    let selectedPrinter = null;
    let imagePreview = null;
    let status = { message: '', isError: false };
    let isLoading = true;
    let isInitialLoad = true;
    let connectionAttempts = 0;
    const MAX_CONNECTION_ATTEMPTS = 3;
    let loadingTimeout;
  
    onMount(async () => {
        try {
            await initializeConnection();
        } catch (error) {
            console.error('Error en la inicialización:', error);
            status = { 
                message: 'Error al inicializar la conexión: ' + error.message, 
                isError: true 
            };
        } finally {
            isLoading = false;
            isInitialLoad = false;
        }
  
        return () => {
            if (loadingTimeout) clearTimeout(loadingTimeout);
        };
    });
  
    async function initializeConnection() {
        printerConnection = new PrinterConnection();
        
        // Solo mostrar mensaje de carga en el primer intento
        if (isInitialLoad) {
            status = { message: 'Conectando al servidor...', isError: false };
        }
        
        // Inicializar la conexión
        const initialized = await printerConnection.initialize();
        if (!initialized) {
            connectionAttempts++;
            if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
                // Reintentar después de un breve delay
                loadingTimeout = setTimeout(initializeConnection, 2000);
                return;
            }
            throw new Error('No se pudo establecer conexión con el servidor');
        }
  
        // Resetear intentos si la conexión fue exitosa
        connectionAttempts = 0;
        
        // Cargar impresoras iniciales
        await loadPrinters();
    }
  
    async function loadPrinters(silent = false) {
        try {
            if (!printerConnection?.isConnected) {
                if (!silent) {
                    throw new Error('No hay conexión con el servidor');
                }
                return;
            }
            
            if (!silent) {
                isLoading = true;
                status = { message: 'Cargando impresoras...', isError: false };
            }
            
            const newPrinters = await printerConnection.getPrinters();
            
            // Actualizar la lista solo si hay cambios
            if (JSON.stringify(newPrinters) !== JSON.stringify(printers)) {
                printers = newPrinters;
                if (!silent) {
                    status = { 
                        message: `${printers.length} impresoras encontradas`, 
                        isError: false 
                    };
                }
            }
        } catch (error) {
            console.error('Error al cargar impresoras:', error);
            if (!silent) {
                status = { 
                    message: 'Error al cargar impresoras: ' + error.message, 
                    isError: true 
                };
            }
            printers = [];
        } finally {
            if (!silent) {
                isLoading = false;
            }
        }
    }
  
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            selectedFile = event.target.files;
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
  
    async function handlePrint() {
        if (!selectedFile || !selectedPrinter) {
            status = { 
                message: 'Por favor selecciona una imagen y una impresora', 
                isError: true 
            };
            return;
        }
  
        try {
            status = { message: 'Enviando a imprimir...', isError: false };
            await printerConnection.printImage(selectedFile[0], selectedPrinter.name);
            status = { message: 'Imagen enviada a imprimir correctamente', isError: false };
        } catch (error) {
            status = { message: 'Error al imprimir: ' + error.message, isError: true };
        }
    }
  </script>
  
  <div class="container">
    <h1>Impresión de Imágenes</h1>
  
    <!-- Estado del Sistema -->
    <div class="card system-status">
        <h2>Estado del Sistema</h2>
        {#if isLoading}
            <div class="loading">Cargando estado del sistema...</div>
        {:else if printerConnection}
            {@const systemStatus = printerConnection.getSystemStatus()}
            <div class="status-grid">
                <div class="status-item">
                    <span class="label">Estado de Conexión:</span>
                    <span class="value {systemStatus.isConnected ? 'online' : 'offline'}">
                        {systemStatus.isConnected ? 'CONECTADO' : 'DESCONECTADO'}
                    </span>
                </div>
                <div class="status-item">
                    <span class="label">Sistema Listo:</span>
                    <span class="value {systemStatus.ready ? 'ready' : 'not-ready'}">
                        {systemStatus.ready ? 'LISTO' : 'NO LISTO'}
                    </span>
                </div>
                <div class="status-item">
                    <span class="label">Impresoras Detectadas:</span>
                    <span class="value">{systemStatus.printersCount || 0}</span>
                </div>
                <div class="status-item">
                    <span class="label">Última Actualización:</span>
                    <span class="value">{systemStatus.lastUpdate}</span>
                </div>
                {#if systemStatus.networkInterfaces?.length > 0}
                    <div class="status-item network-interfaces">
                        <span class="label">Interfaces de Red:</span>
                        <ul>
                            {#each systemStatus.networkInterfaces as netInterface}
                                <li>{netInterface.name}: {netInterface.address}</li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
    
    <div class="card printer-list">
        <h2>Impresoras Disponibles</h2>
        <button on:click={loadPrinters}>Actualizar Lista</button>
        <div class="printer-grid">
            {#each printers as printer}
                <div 
                    class="printer-item {selectedPrinter === printer ? 'selected' : ''}"
                    on:click={() => selectedPrinter = printer}
                >
                    <div class="printer-name">{printer.name}</div>
                    <div class="printer-info">
                        <span class="connection-type">
                            <i class="icon {printer.connectionType.toLowerCase()}"></i>
                            {printer.connectionType}
                        </span>
                        <span class="status {printer.status.toLowerCase()}">
                            {printer.status}
                        </span>
                    </div>
                    {#if printer.statusDetails}
                        <div class="status-details">
                            {printer.statusDetails}
                        </div>
                    {/if}
                    <div class="paper-sizes">
                        <span>Tamaños disponibles:</span>
                        <ul>
                            {#each printer.paperSizes as size}
                                <li>{size}</li>
                            {/each}
                        </ul>
                    </div>
                </div>
            {/each}
        </div>
    </div>
    
    <div class="card">
        <h2>Imagen a Imprimir</h2>
        <input 
            type="file" 
            accept="image/*" 
            on:change={handleFileSelect}
        />
        {#if imagePreview}
            <img src={imagePreview} alt="Vista previa" class="preview-image"/>
        {/if}
    </div>
  
    <div class="card">
        <h2>Opciones de Impresión</h2>
        {#if selectedPrinter}
            <div class="selected-printer">
                <strong>Impresora seleccionada:</strong> {selectedPrinter.name}
            </div>
        {:else}
            <div class="no-printer">No hay impresora seleccionada</div>
        {/if}
        <button 
            on:click={handlePrint}
            disabled={!selectedFile || !selectedPrinter}
        >
            Imprimir Imagen
        </button>
    </div>
  
    {#if status.message}
        <div class="status {status.isError ? 'error' : 'success'}">
            {status.message}
        </div>
    {/if}
  </div>
  
  <style>
    .container {
        padding: 20px;
        max-width: 1000px;
        margin: 0 auto;
    }
  
    .card {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 20px;
    }
  
    .system-status {
        background: #f8f9fa;
    }
  
    .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }
  
    .status-item {
        padding: 10px;
        background: white;
        border-radius: 4px;
        border: 1px solid #dee2e6;
    }
  
    .status-item .label {
        font-weight: bold;
        display: block;
        margin-bottom: 5px;
        color: #666;
    }
  
    .status-item .value {
        font-size: 1.1em;
    }
  
    .online {
        color: #28a745;
    }
  
    .offline {
        color: #dc3545;
    }
  
    .ready {
        color: #28a745;
    }
  
    .not-ready {
        color: #dc3545;
    }
  
    .network-interfaces {
        grid-column: 1 / -1;
    }
  
    .network-interfaces ul {
        margin: 5px 0;
        padding-left: 20px;
        list-style-type: none;
    }
  
    .printer-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }
  
    .printer-item {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 6px;
        border: 1px solid #dee2e6;
        cursor: pointer;
        transition: all 0.2s ease;
    }
  
    .printer-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
  
    .printer-item.selected {
        border: 2px solid #4CAF50;
        background: #e8f5e9;
    }
  
    .printer-name {
        font-weight: bold;
        margin-bottom: 8px;
    }
  
    .printer-info {
        display: flex;
        gap: 15px;
        margin-bottom: 8px;
        font-size: 0.9em;
        color: #666;
        align-items: center;
    }
  
    .connection-type, .status {
        padding: 4px 8px;
        border-radius: 3px;
        background: #e9ecef;
        display: flex;
        align-items: center;
        gap: 5px;
    }
  
    .icon {
        width: 16px;
        height: 16px;
        display: inline-block;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
    }
  
    .icon.network::before {
        content: "🌐";
    }
  
    .icon.usb::before {
        content: "🔌";
    }
  
    .icon.local::before {
        content: "💻";
    }
  
    .icon.virtual::before {
        content: "💾";
    }
  
    .status.online {
        background-color: #d4edda;
        color: #155724;
    }
  
    .status.offline {
        background-color: #f8d7da;
        color: #721c24;
    }
  
    .status.error {
        background-color: #fff3cd;
        color: #856404;
    }
  
    .status-details {
        font-size: 0.85em;
        color: #666;
        margin-bottom: 8px;
        font-style: italic;
    }
  
    .paper-sizes {
        font-size: 0.9em;
        color: #666;
    }
  
    .paper-sizes ul {
        margin: 5px 0;
        padding-left: 20px;
    }
  
    button {
        background-color: #4CAF50;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-top: 10px;
    }
  
    button:hover:not(:disabled) {
        background-color: #45a049;
    }
  
    button:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
    }
  
    .preview-image {
        max-width: 100%;
        margin-top: 10px;
        border-radius: 4px;
    }
  
    .status {
        padding: 10px;
        border-radius: 4px;
        margin-top: 20px;
    }
  
    .success {
        background-color: #dff0d8;
        color: #3c763d;
    }
  
    .error {
        background-color: #f2dede;
        color: #a94442;
    }
  
    h1, h2 {
        color: #333;
        margin-top: 0;
    }
  
    input[type="file"] {
        width: 100%;
        padding: 8px;
        margin-bottom: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }
  
    .selected-printer {
        margin-bottom: 10px;
    }
  
    .no-printer {
        color: #666;
        margin-bottom: 10px;
    }
  
    .loading {
        padding: 20px;
        text-align: center;
        color: #666;
        font-style: italic;
    }
  </style> 