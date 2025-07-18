/**
 * Test script for Provider WebSocket functionality
 * Demonstrates both provider token requests and provider status requests
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ProviderWebSocketTest {
  constructor() {
    this.ws = null;
    this.wsKey = null;
  }

  async initialize() {
    console.log('🚀 Provider WebSocket Test\n');
    
    // Load WebSocket key
    await this.loadWebSocketKey();
    
    // Connect to WebSocket
    await this.connectWebSocket();
  }

  async loadWebSocketKey() {
    try {
      const keyFile = path.join(os.homedir(), '.keyboard-mcp-ws-key');
      
      if (!fs.existsSync(keyFile)) {
        throw new Error('WebSocket key file not found. Make sure the Electron app is running.');
      }
      
      const keyData = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
      this.wsKey = keyData.key;
      
      console.log('🔑 Loaded WebSocket key successfully');
      
    } catch (error) {
      console.error('❌ Failed to load WebSocket key:', error.message);
      throw error;
    }
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://127.0.0.1:8080?key=${this.wsKey}`;
      
      console.log('🌐 Connecting to WebSocket...');
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('✅ Connected to WebSocket server\n');
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket connection error:', error.message);
        reject(error);
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      });
      
      this.ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
      });
    });
  }

  handleMessage(message) {
    if (message.type === 'user-tokens-available') {
      console.log('📋 Provider Status Response:');
      console.log(`   Available Tokens: ${JSON.stringify(message.tokensAvailable, null, 2)}`);
      console.log(`   Timestamp: ${new Date(message.timestamp).toLocaleString()}`);
      if (message.requestId) {
        console.log(`   Request ID: ${message.requestId}`);
      }
      console.log('');
    }
    
    if (message.type === 'provider-auth-token') {
      console.log(`📋 ${message.providerName || message.providerId} Token Response:`);
      
      if (message.error) {
        console.log(`   ❌ Error: ${message.error}`);
      } else {
        console.log(`   ✅ Provider: ${message.providerName} (${message.providerId})`);
        console.log(`   🔐 Authenticated: ${message.authenticated}`);
        console.log(`   👤 User: ${message.user ? `${message.user.name || message.user.email}` : 'N/A'}`);
        console.log(`   🎟️  Token: ${message.token ? `${message.token.substring(0, 20)}...` : 'None'}`);
        console.log(`   🕐 Timestamp: ${new Date(message.timestamp).toLocaleString()}`);
      }
      console.log('');
    }
  }

  async requestProviderStatus() {
    const request = {
      type: 'request-provider-status',
      requestId: 'status-test-001',
      timestamp: Date.now()
    };
    
    console.log('📤 Requesting provider status...');
    this.ws.send(JSON.stringify(request));
  }

  async requestProviderToken(providerId) {
    const request = {
      type: 'request-provider-token',
      providerId: providerId,
      requestId: `token-${providerId}-001`,
      timestamp: Date.now()
    };
    
    console.log(`📤 Requesting ${providerId} token...`);
    this.ws.send(JSON.stringify(request));
  }

  async runTests() {
    console.log('🧪 Running Provider WebSocket Tests\n');
    
    // Test 1: Get provider status
    console.log('1️⃣ Testing provider status request...');
    await this.requestProviderStatus();
    
    // Wait a bit, then test token requests
    setTimeout(async () => {
      console.log('2️⃣ Testing Google token request...');
      await this.requestProviderToken('google');
      
      setTimeout(async () => {
        console.log('3️⃣ Testing GitHub token request...');
        await this.requestProviderToken('github');
        
        setTimeout(async () => {
          console.log('4️⃣ Testing Microsoft token request...');
          await this.requestProviderToken('microsoft');
          
          // Clean up after 3 seconds
          setTimeout(() => {
            console.log('🧹 Test completed, disconnecting...');
            this.disconnect();
          }, 3000);
        }, 1000);
      }, 1000);
    }, 1000);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runProviderWebSocketTest() {
  const tester = new ProviderWebSocketTest();
  
  try {
    await tester.initialize();
    await tester.runTests();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    tester.disconnect();
  }
}

// Run the test
runProviderWebSocketTest().catch(console.error);

module.exports = { ProviderWebSocketTest }; 