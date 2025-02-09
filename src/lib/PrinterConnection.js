export class PrinterConnection {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.systemStatus = {
            ready: false,
            lastPing: null,
            networkInterfaces: [],
            printersCount: 0,
            isConnected: false
        };
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.isConnecting = false;
        this.statusCheckInterval = null;
    }

    async initialize() {
        try {
            await this.connectWebSocket();
            this.startStatusCheck();
            return true;
        } catch (error) {
            console.error('Error al inicializar PrinterConnection:', error);
            return false;
        }
    }

    async connectWebSocket() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        try {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }

            return new Promise((resolve, reject) => {
                this.ws = new WebSocket('ws://localhost:8080');
                
                this.ws.onopen = async () => {
                    console.log('Conectado al servidor de impresión');
                    this.isConnected = true;
                    this.connectionAttempts = 0;
                    this.isConnecting = false;
                    resolve(true);
                };
                
                this.ws.onclose = () => {
                    console.log('Desconectado del servidor');
                    this.isConnected = false;
                    this.isConnecting = false;
                    this.systemStatus = {
                        ...this.systemStatus,
                        ready: false,
                        isConnected: false
                    };
                    
                    if (this.connectionAttempts < this.maxConnectionAttempts) {
                        this.connectionAttempts++;
                        setTimeout(() => this.connectWebSocket(), 3000);
                    }
                };
                
                this.ws.onerror = (error) => {
                    console.error('Error de WebSocket:', error);
                    this.isConnected = false;
                    this.isConnecting = false;
                    this.systemStatus = {
                        ...this.systemStatus,
                        ready: false,
                        isConnected: false,
                        error: error.message
                    };
                    reject(error);
                };

                // Timeout para la conexión inicial
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.isConnecting = false;
                        reject(new Error('Timeout al conectar al servidor'));
                    }
                }, 5000);
            });
        } catch (error) {
            this.isConnecting = false;
            throw error;
        }
    }

    startStatusCheck() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }

        this.statusCheckInterval = setInterval(async () => {
            if (this.isConnected && !this.isConnecting) {
                await this.checkStatus();
            }
        }, 5000);
    }

    async checkStatus() {
        try {
            if (!this.isConnected || !this.ws) return;

            return new Promise((resolve, reject) => {
                const messageHandler = (event) => {
                    try {
                        const response = JSON.parse(event.data);
                        this.ws.removeEventListener('message', messageHandler);
                        
                        if (response.status === 'success') {
                            this.systemStatus = response.system;
                            resolve(response.system);
                        } else {
                            reject(new Error(response.message));
                        }
                    } catch (error) {
                        reject(error);
                    }
                };
                
                this.ws.addEventListener('message', messageHandler);
                this.ws.send(JSON.stringify({ type: 'checkStatus' }));
            });
        } catch (error) {
            console.error('Error al verificar estado:', error);
        }
    }

    async waitForConnection(timeout = 5000) {
        if (this.isConnected) return true;
        if (this.connectionAttempts >= this.maxConnectionAttempts) return false;

        return new Promise((resolve) => {
            const checkInterval = 100;
            let totalTime = 0;
            const checker = setInterval(() => {
                if (this.isConnected) {
                    clearInterval(checker);
                    resolve(true);
                } else if (totalTime >= timeout) {
                    clearInterval(checker);
                    resolve(false);
                }
                totalTime += checkInterval;
            }, checkInterval);
        });
    }

    getSystemStatus() {
        return {
            ...this.systemStatus,
            isConnected: this.isConnected,
            lastUpdate: new Date().toLocaleTimeString()
        };
    }

    async getPrinters() {
        try {
            if (!this.isConnected || !this.ws) {
                throw new Error('No hay conexión con el servidor');
            }

            return new Promise((resolve, reject) => {
                const messageHandler = (event) => {
                    try {
                        const response = JSON.parse(event.data);
                        this.ws.removeEventListener('message', messageHandler);
                        
                        if (response.status === 'success' && response.printers) {
                            this.systemStatus = response.system;
                            resolve(response.printers);
                        } else {
                            reject(new Error(response.message || 'Error al obtener impresoras'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                };
                
                this.ws.addEventListener('message', messageHandler);
                this.ws.send(JSON.stringify({
                    type: 'getPrinters'
                }));
            });
        } catch (error) {
            throw new Error(`Error al obtener impresoras: ${error.message}`);
        }
    }

    async printImage(imageFile, printerName) {
        try {
            const isConnected = await this.waitForConnection();
            if (!isConnected) {
                throw new Error('No se pudo establecer conexión con el servidor');
            }

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = () => {
                    const base64Image = reader.result;
                    
                    const messageHandler = (event) => {
                        const response = JSON.parse(event.data);
                        this.ws.removeEventListener('message', messageHandler);
                        
                        if (response.status === 'success') {
                            resolve(response.message);
                        } else {
                            reject(new Error(response.message));
                        }
                    };
                    
                    this.ws.addEventListener('message', messageHandler);
                    
                    this.ws.send(JSON.stringify({
                        type: 'print',
                        image: base64Image,
                        printer: printerName
                    }));
                };
                
                reader.onerror = reject;
                reader.readAsDataURL(imageFile);
            });
        } catch (error) {
            throw new Error(`Error al imprimir: ${error.message}`);
        }
    }
} 