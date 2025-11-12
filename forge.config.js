/* eslint-disable @typescript-eslint/no-require-imports */
require('@dotenvx/dotenvx').config()
// require('dotenv').config()

module.exports = {
  packagerConfig: {
    asar: true,
    // Platform-specific icon handling will be done by makers
    icon: process.platform === 'win32' ? 'assets/keyboard-dock' : 'assets/keyboard-dock.icns',
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
    // Windows code signing (when certificates are available)
    ...(process.platform === 'win32' && process.env.WIN_CSC_LINK && {
      certificateFile: process.env.WIN_CSC_LINK,
      certificatePassword: process.env.WIN_CSC_KEY_PASSWORD,
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
      name: '@electron-forge/maker-zip',
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
