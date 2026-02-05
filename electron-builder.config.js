/* eslint-disable @typescript-eslint/no-require-imports */
require('@dotenvx/dotenvx').config()

module.exports = {
  appId: 'dev.keyboard.desktop',
  productName: 'KeyboardAI',
  directories: {
    output: 'dist-universal',
    buildResources: 'build',
  },
  // Disable native module rebuild - not needed for this app and avoids Node.js v22 tar/ESM compatibility issues
  npmRebuild: false,
  files: ['dist/**/*', 'public/**/*', 'assets/**/*', 'node_modules/**/*'],
  win: {
    target: {
      target: 'nsis',
      arch: ['x64', 'ia32', 'arm64'], // All architectures in one installer
    },
    icon: 'assets/keyboard-dock.ico',
    // Code signing: electron-builder automatically reads CSC_LINK and CSC_KEY_PASSWORD
    // (or WIN_CSC_LINK / WIN_CSC_KEY_PASSWORD) from environment variables
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    installerIcon: 'assets/keyboard-dock.ico',
    uninstallerIcon: 'assets/keyboard-dock.ico',
    artifactName: 'Keyboard.Approver-Setup-Win-latest.${ext}',
    shortcutName: 'KeyboardAI',
    // Delete app data on uninstall for clean removal
    deleteAppDataOnUninstall: false,
  },
  protocols: [
    {
      name: 'MCP Auth Protocol',
      schemes: ['mcpauth'],
    },
  ],
}
