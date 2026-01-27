/* eslint-disable @typescript-eslint/no-require-imports */
require('@dotenvx/dotenvx').config()
// require('dotenv').config()

// Debug: Check if Apple credentials are loaded and decrypted
const checkEnvVar = (name) => {
  const val = process.env[name]
  if (!val) return 'NOT SET'
  if (val.startsWith('encrypted:')) return 'STILL ENCRYPTED'
  return `OK (${val.substring(0, 8)}...)`
}
console.log('[forge.config.js] NODE_ENV:', process.env.NODE_ENV)
console.log('[forge.config.js] SKIP_SIGNING:', process.env.SKIP_SIGNING)
console.log('[forge.config.js] APPLE_API_KEY_ID:', checkEnvVar('APPLE_API_KEY_ID'))
console.log('[forge.config.js] APPLE_API_ISSUER:', checkEnvVar('APPLE_API_ISSUER'))
console.log('[forge.config.js] APPLE_API_KEY:', checkEnvVar('APPLE_API_KEY'))

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'KeyboardAI',
    // Use platform-specific icons
    ...(process.platform === 'darwin' && { icon: 'assets/keyboard-dock.icns' }),
    ...(process.platform === 'win32' && { icon: 'assets/keyboard-dock.ico' }),
    protocols: [
      {
        name: 'MCP Auth Protocol',
        schemes: ['mcpauth'],
      },
    ],
    ...(process.env.NODE_ENV !== 'development' && !process.env.SKIP_SIGNING && {
      osxSign: {},
      osxNotarize: {
        appleApiKey: process.env.APPLE_API_KEY,
        appleApiKeyId: process.env.APPLE_API_KEY_ID,
        appleApiIssuer: process.env.APPLE_API_ISSUER,
      },
    }),
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'keyboard_approver', // No spaces in the name for better compatibility
        setupExe: 'KeyboardAISetup.exe',
        setupIcon: 'assets/keyboard-dock.ico',
        // Add protocol registration during installation
        loadingGif: undefined, // Can add a loading GIF if desired
        // The protocols are already defined in packagerConfig and will be registered
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {},
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
}
