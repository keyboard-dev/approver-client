/* eslint-disable @typescript-eslint/no-require-imports */
require('@dotenvx/dotenvx').config()
// require('dotenv').config()

module.exports = {
  packagerConfig: {
    asar: {
      // Unpack prisma binaries and migrations for proper execution
      unpack: '**/{node_modules/@prisma/engines/**/*,dist/prisma/**/*}',
    },
    icon: 'assets/keyboard-dock.icns',
    protocols: [
      {
        name: 'MCP Auth Protocol',
        schemes: ['mcpauth'],
      },
    ],
    // Ensure prisma folder is included
    extraResource: [
      'dist/prisma',
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
        name: 'keyboard approver', // Changed from 'electron_quick_start'
      },
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
