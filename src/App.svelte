<script>
    import { onMount } from 'svelte';
    import { PrinterConnection } from './lib/PrinterConnection';
    
    let printerConnection;
    let selectedFile;

    onMount(() => {
        printerConnection = new PrinterConnection();
    });

    async function handlePrint() {
        if (!selectedFile) {
            alert('Por favor selecciona una imagen primero');
            return;
        }

        try {
            await printerConnection.printImage(selectedFile[0]);
            alert('Imagen enviada a imprimir');
        } catch (error) {
            alert('Error al imprimir: ' + error.message);
        }
    }
</script>

<div class="container">
    <h1>Impresión de Imágenes</h1>
    
    <input 
        type="file" 
        accept="image/*" 
        bind:files={selectedFile}
    />
    
    <button on:click={handlePrint}>
        Imprimir Imagen
    </button>
</div>

<style>
    .container {
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
    }

    button {
        margin-top: 20px;
        padding: 10px 20px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    button:hover {
        background-color: #45a049;
    }
</style> 