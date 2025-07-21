require('dotenv').config();

console.log('=== ENVIRONMENT CHECK ===');
Object.keys(process.env).forEach(key => {
  if (key.includes('APPLE') || key.includes('CSC') || key.includes('AC_')) {
    console.log(`${key}: ${process.env[key]}`);
  }
});
console.log('=========================');

module.exports = {
  packagerConfig: {
    asar: true,
    protocols: [
      {
        name: "MCP Auth Protocol",
        schemes: ["mcpauth"]
      }
    ],
    osxSign: {
    },
    osxNotarize: {
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'mcp-notification-app'  // Changed from 'electron_quick_start'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {}
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {}
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    }
  ]
};