// Simple test client to send messages to the Electron app
const WebSocket = require('ws');

class TestClient {
    constructor() {
        this.ws = null;
        this.connect();
    }

    connect() {
        this.ws = new WebSocket('ws://localhost:8080');

        this.ws.on('open', () => {
            console.log('Connected to Electron app');
            
            // Send a few test messages
            setTimeout(() => this.sendTestMessages(), 1000);
        });

        this.ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        this.ws.on('close', () => {
            console.log('Disconnected from Electron app');
        });
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            console.log('Sent message:', message.title);
        }
    }

    sendTestMessages() {
        // Test message 1
        this.sendMessage({
            id: Date.now().toString(),
            title: 'Welcome to the Notification App!',
            body: 'This is your first test message. Click on the notification to view details.',
            timestamp: Date.now(),
            priority: 'normal',
            sender: 'Test Client'
        });

        // Test message 2 (after 3 seconds)
        setTimeout(() => {
            this.sendMessage({
                id: (Date.now() + 1).toString(),
                title: 'High Priority Alert',
                body: 'This is a high priority message that requires immediate attention. Please review the details and take appropriate action.',
                timestamp: Date.now(),
                priority: 'high',
                sender: 'Alert System'
            });
        }, 3000);

        // Test message 3 (after 6 seconds)
        setTimeout(() => {
            this.sendMessage({
                id: (Date.now() + 2).toString(),
                title: 'Weekly Report Ready',
                body: 'Your weekly analytics report has been generated and is ready for review.',
                timestamp: Date.now(),
                priority: 'low',
                sender: 'Analytics Bot'
            });
        }, 6000);

        // Schedule disconnect after 10 seconds
        setTimeout(() => {
            this.ws.close();
            console.log('Test completed. Check your Electron app for notifications!');
        }, 10000);
    }
}

// Usage instructions
console.log('Test Client for Electron Notification App');
console.log('========================================');
console.log('Make sure your Electron app is running first with: npm start');
console.log('Then run this test client with: node test-client.js');
console.log('');
console.log('Starting test client...');

// Create test client
new TestClient(); 