// Secure test client that demonstrates connecting with a WebSocket key
const WebSocket = require('ws');

class SecureTestClient {
    constructor(connectionKey) {
        this.connectionKey = connectionKey;
        this.ws = null;
        this.connect();
    }

    connect() {
        if (!this.connectionKey) {
            console.error('❌ No connection key provided. Please get the key from the approver app settings.');
            console.log('📋 Steps to get the connection key:');
            console.log('   1. Open the approver app');
            console.log('   2. Go to Settings');
            console.log('   3. Copy the WebSocket connection key or full URL');
            console.log('   4. Run: node secure-test-client.js YOUR_KEY_HERE');
            return;
        }

        const wsUrl = `ws://127.0.0.1:8080?key=${this.connectionKey}`;
        console.log(`🔐 Connecting to secure WebSocket: ${wsUrl}`);

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            console.log('✅ Secure WebSocket connection established!');
            
            // Send test messages after connection
            setTimeout(() => this.sendTestMessages(), 1000);
        });

        this.ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                console.log('📨 Received response:', response);
            } catch (error) {
                console.error('❌ Error parsing response:', error);
            }
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            
            if (error.message.includes('Unexpected server response: 401')) {
                console.log('🔑 Invalid connection key. Please check your key and try again.');
                console.log('📋 Get a new key from the approver app settings.');
            }
        });

        this.ws.on('close', (code, reason) => {
            console.log(`🔐 WebSocket connection closed: ${code} - ${reason}`);
        });
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            console.log('📤 Sent message:', message.title);
        } else {
            console.error('❌ WebSocket not connected');
        }
    }

    sendTestMessages() {
        console.log('📨 Sending test messages...');

        // Test message 1 - Code approval request
        this.sendMessage({
            id: `secure-test-${Date.now()}-1`,
            title: 'Secure Code Deployment Request',
            body: 'Request to deploy security-critical code changes.',
            code: `
// Security enhancement: Add rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
            `.trim(),
            explaination: 'This code adds rate limiting to our API endpoints to prevent abuse and DoS attacks. The rate limiter allows 100 requests per 15-minute window per IP address.',
            timestamp: Date.now(),
            priority: 'high',
            sender: 'Secure CI/CD Pipeline',
            status: 'pending',
            requiresResponse: true,
            codeEval: true
        });

        // Test message 2 - Regular approval request
        setTimeout(() => {
            this.sendMessage({
                id: `secure-test-${Date.now()}-2`,
                title: 'Database Migration Approval',
                body: `Request approval for database migration:

Migration: 2024_add_user_security_fields
- Add two_factor_enabled column
- Add failed_login_attempts column  
- Add account_locked_until column
- Add password_changed_at column

This migration enhances user account security by adding fields for:
- Two-factor authentication tracking
- Failed login attempt monitoring
- Account lockout functionality
- Password age tracking

Please review and approve this security enhancement.`,
                timestamp: Date.now(),
                priority: 'normal',
                sender: 'Database Team',
                status: 'pending',
                requiresResponse: true
            });
        }, 2000);

        // Test message 3 - Low priority notification
        setTimeout(() => {
            this.sendMessage({
                id: `secure-test-${Date.now()}-3`,
                title: 'Weekly Security Report Ready',
                body: 'The weekly security report has been generated and is ready for review. No critical issues found this week.',
                timestamp: Date.now(),
                priority: 'low',
                sender: 'Security Monitor',
                status: 'pending',
                requiresResponse: false
            });
        }, 4000);

        // Schedule disconnect after 10 seconds
        setTimeout(() => {
            console.log('🔐 Closing secure connection...');
            this.ws.close();
        }, 10000);
    }
}

// Command line usage
if (require.main === module) {
    const connectionKey = process.argv[2];
    
    if (!connectionKey) {
        console.log('🔐 Secure WebSocket Test Client');
        console.log('================================');
        console.log('');
        console.log('Usage: node secure-test-client.js <connection-key>');
        console.log('');
        console.log('To get the connection key:');
        console.log('1. Open the approver app');
        console.log('2. Go to Settings');
        console.log('3. Copy the WebSocket connection key');
        console.log('4. Run: node secure-test-client.js YOUR_KEY_HERE');
        console.log('');
        console.log('Example:');
        console.log('node secure-test-client.js a1b2c3d4e5f6...');
        process.exit(1);
    }
    
    console.log('🔐 Starting secure WebSocket test client...');
    new SecureTestClient(connectionKey);
}

module.exports = SecureTestClient; 