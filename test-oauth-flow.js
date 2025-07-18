/**
 * Test script to demonstrate OAuth provider functionality
 * This script shows how to use the new OAuth provider system
 */

// Mock environment variables for testing
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Import the OAuth system
const { OAuthProviderManager, OAUTH_PROVIDERS } = require('./src/oauth-providers');
const { OAuthTokenStorage } = require('./src/oauth-token-storage');
const crypto = require('crypto');

async function testOAuthSystem() {
  console.log('🧪 Testing OAuth Provider System\n');

  // Initialize the system
  const providerManager = new OAuthProviderManager('mcpauth');
  const tokenStorage = new OAuthTokenStorage('./test-tokens');

  // 1. Test provider availability
  console.log('1. Available Providers:');
  const availableProviders = providerManager.getAvailableProviders();
  availableProviders.forEach(provider => {
    console.log(`   ${provider.icon} ${provider.name} (${provider.id})`);
    console.log(`     Scopes: ${provider.scopes.join(', ')}`);
    console.log(`     PKCE: ${provider.usePKCE ? 'Yes' : 'No'}\n`);
  });

  // 2. Test PKCE generation
  console.log('2. PKCE Parameters:');
  const pkceParams = providerManager.generatePKCE('google');
  console.log(`   Code Verifier: ${pkceParams.codeVerifier.substring(0, 20)}...`);
  console.log(`   Code Challenge: ${pkceParams.codeChallenge.substring(0, 20)}...`);
  console.log(`   State: ${pkceParams.state}\n`);

  // 3. Test authorization URL generation
  console.log('3. Authorization URLs:');
  availableProviders.forEach(provider => {
    try {
      const pkce = providerManager.generatePKCE(provider.id);
      const authUrl = providerManager.buildAuthorizationUrl(provider, pkce);
      console.log(`   ${provider.name}: ${authUrl.substring(0, 80)}...\n`);
    } catch (error) {
      console.log(`   ${provider.name}: Error - ${error.message}\n`);
    }
  });

  // 4. Test token storage (mock data)
  console.log('4. Token Storage Test:');
  const mockTokens = {
    providerId: 'google',
    access_token: 'mock_access_token_' + crypto.randomBytes(16).toString('hex'),
    refresh_token: 'mock_refresh_token_' + crypto.randomBytes(16).toString('hex'),
    token_type: 'Bearer',
    expires_in: 3600,
    expires_at: Date.now() + (3600 * 1000),
    scope: 'openid email profile',
    user: {
      id: '123456789',
      email: 'test@example.com',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      picture: 'https://example.com/avatar.jpg'
    }
  };

  try {
    await tokenStorage.storeTokens(mockTokens);
    console.log('   ✅ Tokens stored successfully');
    
    const retrievedTokens = await tokenStorage.getTokens('google');
    console.log('   ✅ Tokens retrieved successfully');
    console.log(`   User: ${retrievedTokens.user.name} (${retrievedTokens.user.email})`);
    
    const isExpired = await tokenStorage.areTokensExpired('google');
    console.log(`   Token expired: ${isExpired ? '❌ Yes' : '✅ No'}`);
    
    const storageInfo = tokenStorage.getStorageInfo();
    console.log(`   Storage file: ${storageInfo.filePath}`);
    console.log(`   Providers stored: ${storageInfo.providersCount}\n`);
    
  } catch (error) {
    console.log(`   ❌ Storage error: ${error.message}\n`);
  }

  // 5. Test provider configurations
  console.log('5. Provider Configurations:');
  Object.entries(OAUTH_PROVIDERS).forEach(([id, config]) => {
    console.log(`   ${config.name} (${id}):`);
    console.log(`     Auth URL: ${config.authorizationUrl}`);
    console.log(`     Token URL: ${config.tokenUrl}`);
    console.log(`     User Info URL: ${config.userInfoUrl || 'Not configured'}`);
    console.log(`     Redirect URI: ${config.redirectUri}`);
    console.log('');
  });

  console.log('🎉 OAuth system test completed!');
  console.log('\n📋 To use this system:');
  console.log('1. Set up OAuth apps with each provider');
  console.log('2. Configure environment variables');
  console.log('3. Start the Electron app');
  console.log('4. Go to Settings → OAuth Providers');
  console.log('5. Click "Connect" for any provider');
  console.log('6. Complete OAuth flow in browser');
  console.log('7. Use "Copy Token" to get access tokens');
}

// Run the test
if (require.main === module) {
  testOAuthSystem().catch(console.error);
}

module.exports = { testOAuthSystem }; 