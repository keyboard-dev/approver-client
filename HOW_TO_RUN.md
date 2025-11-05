# How to Run the Approver-Client App

This guide explains how to run and build the approver-client Electron application.

## Prerequisites

- **Node.js** 18+ installed
- **npm** 7+ installed
- **Git** installed

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run in Development Mode

```bash
# Option 1: Run with hot reload (recommended for development)
npm run dev

# Option 2: Build and run
npm run build
npm run start
```

### 3. Build for Production

```bash
# Build TypeScript and Vite frontend
npm run build

# Package for your platform
npm run package

# Or create distributable (DMG for Mac, installer for Windows)
npm run make
```

## Development Scripts

### Frontend Development

```bash
# Run Vite dev server (hot reload for renderer process)
npm run dev:renderer

# Build frontend only
npm run build:renderer
```

### TypeScript Compilation

```bash
# Build TypeScript (main + renderer)
npm run build

# Watch mode (auto-rebuild on changes)
npm run build:watch
```

### Full Development Workflow

```bash
# Terminal 1: Watch TypeScript compilation
npm run build:watch

# Terminal 2: Run the app
npm run dev
```

## Platform-Specific Builds

### macOS

```bash
# Universal build (Apple Silicon + Intel)
npm run build-mac-universal

# Sign and notarize (requires Apple Developer account)
npm run build-signed
```

### Windows

```bash
npm run build-win
```

### Linux

```bash
npm run build-linux
```

## Project Structure

```
approver-client/
├── src/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Preload script (secure IPC bridge)
│   ├── ai-proxy.ts          # NEW: Secure AI API proxy
│   ├── renderer/            # React frontend
│   │   ├── main.tsx        # React entry point
│   │   ├── App.tsx         # Main App component
│   │   ├── components/     # React components
│   │   │   ├── chat/       # Chat UI components
│   │   │   ├── screens/    # Main screens
│   │   │   └── ui/         # shadcn/ui components
│   │   ├── runtime/        # AI provider runtimes
│   │   │   └── providers/  # OpenAI, Anthropic, MCP
│   │   └── services/       # Services (persistence, etc.)
│   └── types.ts            # TypeScript types
├── dist/                    # Compiled output
├── public/                  # Static assets
└── assets/                  # App icons, resources
```

## Configuration Files

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite bundler configuration
- `forge.config.js` - Electron Forge build configuration
- `tailwind.config.js` - Tailwind CSS configuration

## Troubleshooting

### "Module not found" errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript compilation errors

```bash
# Check for errors without building
npx tsc --noEmit

# Fix linting issues
npm run lint:fix
```

### Build fails on macOS

```bash
# If signing fails, skip it for development
SKIP_SIGNING=true npm run build-dev
```

### Electron window doesn't open

1. Check the console for errors
2. Try `npm run build` first
3. Clear dist folder: `rm -rf dist`
4. Rebuild: `npm run build && npm run start`

## Environment Variables

Create a `.env` file in the root directory:

```env
# For development
NODE_ENV=development

# Skip code signing (macOS)
SKIP_SIGNING=true

# Custom ports (optional)
VITE_PORT=5173
```

## Chat Feature - Running with AI

### Using the Chat Interface

1. **Start the app**
   ```bash
   npm run dev
   ```

2. **Click the 💬 Chat button** in the toolbar

3. **Configure your AI provider:**
   - Click the ⚙️ settings icon
   - Select a provider (OpenAI, Anthropic, or MCP)
   - Enter your API key
   - Choose a model

4. **Start chatting!**

### Setting API Keys Securely

**Important:** API keys are now handled securely in the main process!

The app uses a secure proxy system:
- API keys are stored in the main process (encrypted)
- Renderer process never sees the actual keys
- Keys are sent through secure IPC channels
- Keys are encrypted at rest using Electron's `safeStorage`

You set keys through the UI, and they're automatically secured.

## Testing

### Test AI Proxy (Without UI)

You can test the AI proxy from the developer console:

```javascript
// Check if a key is set
await window.electronAPI.aiProxyGetKeyStatus('openai')

// Set an API key (securely in main process)
await window.electronAPI.aiProxySetKey('openai', 'sk-...')

// Make a test request
const response = await window.electronAPI.aiProxyRequest({
  provider: 'openai',
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
})
console.log(response)
```

## Performance Tips

### Development Mode

```bash
# Faster builds (skip some optimizations)
NODE_ENV=development npm run build
```

### Production Build

```bash
# Full optimizations
NODE_ENV=production npm run build
```

## Debugging

### Enable DevTools

Dev tools are enabled by default in development mode.

To open DevTools:
- **macOS**: `Cmd + Option + I`
- **Windows/Linux**: `Ctrl + Shift + I`

### Main Process Debugging

```bash
# Run with Node inspector
node --inspect dist/main.js

# Then open chrome://inspect in Chrome
```

### Renderer Process Debugging

Use the built-in Chrome DevTools (see above).

## Distribution

### Before Distributing

1. **Update version** in `package.json`
2. **Build production** assets
3. **Test thoroughly**
4. **Sign the app** (macOS/Windows)
5. **Create installers**

### Distributable Formats

- **macOS**: `.dmg` disk image
- **Windows**: `.exe` installer
- **Linux**: `.deb` or `.AppImage`

### Example: Create macOS DMG

```bash
# Build and package
npm run build
npm run build-mac-universal

# Find the DMG in out/make/
ls out/make/
```

## CI/CD

For automated builds, see `.github/workflows/` (if configured).

Example GitHub Actions:

```yaml
name: Build
on: [push]
jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - run: npm run make
```

## Security Notes

### API Keys

- **NEVER** commit API keys to git
- **NEVER** hardcode keys in source code
- Use the secure AI proxy (automatically enabled)
- Keys are encrypted at rest
- Keys stay in the main process only

### Best Practices

1. Add `.env` to `.gitignore`
2. Use environment variables for secrets
3. Enable code signing for distribution
4. Keep dependencies updated: `npm audit fix`
5. Review security advisories: `npm audit`

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/keyboard-dev/approver-client/issues)
- **Documentation**: See `MCP_CHAT_INTEGRATION.md` and `BRING_YOUR_OWN_AI.md`
- **Logs**: Check the console in DevTools

## Next Steps

- Read `BRING_YOUR_OWN_AI.md` to learn about AI providers
- Read `MCP_CHAT_INTEGRATION.md` for chat features
- Explore the codebase in `src/`
- Build your first custom AI provider!

---

**Happy coding! 🚀**
