// Debug test client to troubleshoot WebSocket connection
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
    // Send a simple test message
    const testMessage = {
        id: Date.now().toString(),
        title: 'Debug Test Message',
        body: 'This is a debug message to test the connection.',
        timestamp: Date.now(),
        priority: 'normal',
        sender: 'Debug Client'
    };
    
    ws.send(JSON.stringify(testMessage));
    
    // Close after 3 seconds
    setTimeout(() => {
        ws.close();
        process.exit(0);
    }, 3000);
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', (code, reason) => {
    });

// Timeout after 5 seconds if no connection
setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
        process.exit(1);
    }
}, 5000); 