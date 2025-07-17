/**
 * Test script for OAuth HTTP server functionality
 */

const { OAuthHttpServer } = require('./dist/oauth-http-server');

async function testOAuthHttpServer() {
  console.log('🧪 Testing OAuth HTTP Server\n');

  const server = new OAuthHttpServer(8082);

  console.log('1. Testing Server Startup...');
  
  try {
    await server.startServer((callbackData) => {
      console.log('📡 Received OAuth callback:', callbackData);
      
      if (callbackData.error) {
        console.log('❌ OAuth Error:', callbackData.error);
        if (callbackData.error_description) {
          console.log('   Description:', callbackData.error_description);
        }
      } else if (callbackData.code && callbackData.state) {
        console.log('✅ OAuth Success!');
        console.log('   Code:', callbackData.code.substring(0, 10) + '...');
        console.log('   State:', callbackData.state);
      }
      
      // Server will auto-stop after callback
    });

    console.log('✅ OAuth HTTP Server started successfully');
    console.log(`🌐 Callback URL: ${server.getCallbackUrl()}`);
    console.log(`📍 Port: ${server.getPort()}`);
    console.log(`⚡ Running: ${server.isServerRunning()}`);
    
    console.log('\n2. You can test the callback by visiting:');
      console.log(`   Success: http://localhost:8082/callback?code=test_code&state=test_state`);
  console.log(`   Error:   http://localhost:8082/callback?error=access_denied&error_description=User%20denied`);
    
    console.log('\n✨ Test completed! The server will handle callbacks and then shut down.');
    
    // Keep the process alive for manual testing
    console.log('\n⏳ Server is running... Visit the URLs above or press Ctrl+C to exit.');
    
  } catch (error) {
    console.error('❌ Server startup failed:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down test server...');
  process.exit(0);
});

// Run the test
if (require.main === module) {
  testOAuthHttpServer().catch(console.error);
}

module.exports = { testOAuthHttpServer }; 