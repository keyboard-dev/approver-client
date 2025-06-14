// Debug test client to troubleshoot WebSocket connection
const WebSocket = require('ws');

console.log('🔍 Debug Test Client');
console.log('===================');
console.log('Attempting to connect to ws://localhost:8080...');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
    console.log('✅ Connected successfully!');
    
    // Send a simple test message
    const testMessage = {
        id: Date.now().toString(),
        title: 'Debug Test Message',
        body: 'This is a debug message to test the connection.',
        timestamp: Date.now(),
        priority: 'normal',
        sender: 'Debug Client'
    };
    
    console.log('📤 Sending test message:', testMessage.title);
    ws.send(JSON.stringify(testMessage));
    
    // Close after 3 seconds
    setTimeout(() => {
        ws.close();
        console.log('🔌 Connection closed');
        process.exit(0);
    }, 3000);
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    console.log('');
    console.log('💡 Troubleshooting tips:');
    console.log('1. Make sure the Electron app is running: npm start');
    console.log('2. Check if port 8080 is available');
    console.log('3. Look for console output in the Electron app');
    process.exit(1);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed with code: ${code}, reason: ${reason}`);
});

// Timeout after 5 seconds if no connection
setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
        console.log('⏰ Connection timeout - Electron app might not be running');
        process.exit(1);
    }
}, 5000); 