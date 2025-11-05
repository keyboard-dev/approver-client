# Bring Your Own AI (BYOAI) Guide

This guide explains how to use your own AI models with the approver-client chat interface.

## Supported AI Providers

The chat interface now supports multiple AI providers out of the box:

### 1. **OpenAI**
- Models: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo
- Requires: API Key
- Get your API key: [OpenAI Platform](https://platform.openai.com/api-keys)

### 2. **Anthropic (Claude)**
- Models: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
- Requires: API Key
- Get your API key: [Anthropic Console](https://console.anthropic.com/)

### 3. **MCP Server**
- Your Model Context Protocol server at https://mcp.keyboard.dev
- Optional: API Key for authentication
- Default option for MCP tool integrations

## Getting Started

### Quick Setup

1. **Open the Chat** - Click the 💬 Chat button in the toolbar
2. **Open Settings** - Click the gear icon (⚙️) in the chat header
3. **Select Provider** - Choose your AI provider from the dropdown
4. **Enter API Key** - Paste your API key (required for OpenAI and Anthropic)
5. **Choose Model** - Select the specific model you want to use
6. **Save Settings** - Click "Save Settings"

### Detailed Configuration

#### Using OpenAI

```typescript
// Settings:
Provider: OpenAI
Model: gpt-4o (or any OpenAI model)
API Key: sk-...your-key...
Temperature: 0.7 (default, range 0-2)
Streaming: Off (experimental feature)
```

**Example API Key:**
- Get from: https://platform.openai.com/api-keys
- Format: `sk-...` (starts with "sk-")
- Keep it secret!

#### Using Anthropic Claude

```typescript
// Settings:
Provider: Anthropic
Model: claude-3-5-sonnet-20241022
API Key: sk-ant-...your-key...
Temperature: 0.7
Streaming: Off
```

**Example API Key:**
- Get from: https://console.anthropic.com/
- Format: `sk-ant-...` (starts with "sk-ant-")
- Keep it secret!

#### Using MCP Server

```typescript
// Settings:
Provider: MCP Server
MCP Server URL: https://mcp.keyboard.dev
API Key: (optional)
Temperature: 0.7
```

## Features

### ✅ Multiple Chat Sessions

Create and manage multiple independent chat conversations:

1. Click the **Messages** icon (📱) to open the session sidebar
2. Click **+ New Chat** to create a new session
3. Click on any session to switch to it
4. Each session maintains its own history and context
5. Delete sessions with the trash icon (🗑️)

### ✅ Message Persistence

All messages are automatically saved to your local IndexedDB:

- Messages persist across app restarts
- Each session stores its complete conversation history
- No data sent to external servers (except the AI provider you choose)

### ✅ Rich Markdown Rendering

Messages support full GitHub Flavored Markdown:

- **Code blocks** with syntax highlighting
- `Inline code`
- Lists, tables, quotes
- **Bold**, *italic*, ~~strikethrough~~
- Links and images

**Code Example:**
```javascript
// Click the copy button to copy code!
function greet(name) {
  console.log(`Hello, ${name}!`)
}
```

### ✅ Copy Code Blocks

Hover over any code block and click the copy button to copy the code to your clipboard.

### ✅ Tool Call Approvals

When using MCP or tools-enabled models:

1. AI requests permission to use a tool
2. You see the tool name and arguments
3. Click **Approve** or **Reject**
4. Tool executes only after approval
5. Results appear in the chat

### ✅ Streaming Responses (Experimental)

Enable streaming in settings to see responses appear in real-time:

- Words appear as they're generated
- More responsive feel
- Currently experimental - may have issues

## Advanced: Adding Custom AI Providers

You can add your own custom AI provider by extending the `BaseAIProvider` class.

### Step 1: Create Your Provider

Create a new file: `src/renderer/runtime/providers/YourProvider.ts`

```typescript
import type { LanguageModelV1CallOptions, ChatModelRunResult } from '@assistant-ui/react'
import { BaseAIProvider, type AIProviderConfig } from './BaseAIProvider'

export class YourCustomProvider extends BaseAIProvider {
  readonly provider = 'your-provider'

  constructor(config: AIProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://your-api.com',
      model: config.model || 'your-default-model',
    })
  }

  async doGenerate(options: LanguageModelV1CallOptions): Promise<ChatModelRunResult> {
    const messages = this.formatMessages(options.prompt)

    try {
      const response = await fetch(`${this.config.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature || 0.7,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()

      return {
        text: data.response || '',
        finishReason: 'stop',
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
        },
        toolCalls: [],
        toolResults: [],
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: {},
        },
      }
    }
    catch (error) {
      console.error('Generation error:', error)
      return this.createErrorResult(error as Error)
    }
  }

  async doStream(options: LanguageModelV1CallOptions): Promise<AsyncIterable<ChatModelRunResult>> {
    // Implement streaming if your API supports it
    // Otherwise, fall back to non-streaming
    const result = await this.doGenerate(options)
    return (async function* () {
      yield result
    })()
  }
}
```

### Step 2: Register Your Provider

Update `src/renderer/runtime/providers/index.ts`:

```typescript
import { YourCustomProvider } from './YourProvider'

export const AVAILABLE_PROVIDERS: ProviderOption[] = [
  // ... existing providers ...
  {
    id: 'your-provider',
    name: 'Your Custom Provider',
    description: 'Your custom AI model',
    requiresApiKey: true,
    defaultModel: 'your-model-v1',
    models: ['your-model-v1', 'your-model-v2'],
  },
]
```

### Step 3: Add to Runtime

Update `src/renderer/runtime/UnifiedRuntime.ts`:

```typescript
import { YourCustomProvider } from './providers/YourProvider'

// In createUnifiedRuntime function:
switch (options.provider) {
  // ... existing cases ...
  case 'your-provider':
    aiProvider = new YourCustomProvider({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    })
    break
}
```

### Step 4: Use It!

Your custom provider will now appear in the provider dropdown in chat settings.

## API Format Examples

### OpenAI-Compatible API

If your AI has an OpenAI-compatible API, you can simply use the `OpenAIProvider` with a custom `baseUrl`:

```typescript
// In settings or code:
new OpenAIProvider({
  apiKey: 'your-key',
  baseUrl: 'https://your-openai-compatible-api.com/v1',
  model: 'your-model',
})
```

### Custom Request/Response Format

For custom APIs, implement the provider to match your API's format:

**Request Format:**
```json
{
  "model": "your-model",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.7
}
```

**Response Format:**
```json
{
  "response": "Hello! How can I help?",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}
```

## Configuration Options

### Temperature

Controls randomness in responses:
- **0.0** - Deterministic, focused
- **0.7** - Balanced (recommended)
- **1.0** - Creative
- **2.0** - Very creative/random

### Max Tokens

Maximum length of generated response (optional):
- Not set - Use model's default
- 1000 - Short responses
- 4000 - Standard
- 8000+ - Long-form content

### Base URL

Override the default API endpoint:
- OpenAI: `https://api.openai.com/v1` (default)
- Anthropic: `https://api.anthropic.com/v1` (default)
- Custom: Your API endpoint

## Security Best Practices

### ✅ Secure API Key Handling (Automatic)

**The app now uses a secure architecture that protects your API keys:**

1. **API keys NEVER leave the main process**
   - Keys are stored in Electron's main process (Node.js)
   - Encrypted at rest using `safeStorage`
   - Never exposed to the renderer (frontend)

2. **Secure IPC Proxy**
   - All AI API calls go through a proxy in the main process
   - Frontend sends request → Main process makes API call with key → Frontend receives response
   - Keys are never transmitted to or visible in the frontend

3. **Architecture Diagram:**
```
┌─────────────────────────────────────────────────┐
│ Renderer Process (React/Frontend)              │
│ ┌─────────────────────────────────────────────┐ │
│ │ EnhancedChatScreen                          │ │
│ │ - User enters API key in settings          │ │
│ │ - Sent via IPC to main process             │ │
│ │ - NEVER stored in frontend                 │ │
│ └─────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────┘
                 │ IPC (secure channel)
                 ▼
┌─────────────────────────────────────────────────┐
│ Main Process (Node.js/Electron)                │
│ ┌─────────────────────────────────────────────┐ │
│ │ AIProxyService                              │ │
│ │ - Receives & encrypts API key              │ │
│ │ - Stores encrypted key (safeStorage)       │ │
│ │ - Makes API calls to OpenAI/Anthropic/MCP  │ │
│ │ - Returns responses to renderer            │ │
│ └─────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────────────┐
│ External AI APIs                                │
│ - api.openai.com                                │
│ - api.anthropic.com                             │
│ - mcp.keyboard.dev                              │
└─────────────────────────────────────────────────┘
```

4. **What this means for you:**
   - ✅ Your API keys are secure
   - ✅ Keys are encrypted at rest
   - ✅ Keys never visible in DevTools/frontend
   - ✅ Safe to distribute your app (keys won't be in the bundle)
   - ✅ No risk of accidental key exposure

### How It Works

When you set an API key in the chat settings:

```typescript
// What happens in the frontend:
await window.electronAPI.aiProxySetKey('openai', 'sk-...')
// Key is immediately sent to main process via secure IPC

// What happens in the main process:
class AIProxyService {
  async setKey(provider, apiKey) {
    // Encrypt the key
    const encrypted = safeStorage.encryptString(apiKey)
    // Store encrypted (could be saved to disk if needed)
    this.encryptedKeys[provider] = encrypted
  }

  async makeRequest(provider, messages) {
    // Decrypt the key (only in main process)
    const apiKey = safeStorage.decryptString(this.encryptedKeys[provider])
    // Make API call
    const response = await fetch(API_URL, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    // Return response to frontend (key never sent)
    return response.json()
  }
}
```

### Checking API Key Status

You can check if a key is set without exposing it:

```typescript
// In your React component:
const { hasKey } = await window.electronAPI.aiProxyGetKeyStatus('openai')
if (hasKey) {
  console.log('OpenAI key is set ✅')
} else {
  console.log('Please set your OpenAI API key')
}
```

### Never Commit API Keys

- Never hardcode API keys
- Use environment variables
- Add `.env` to `.gitignore`
- Use `.env.example` for templates

## Troubleshooting

### "API error: 401 Unauthorized"

- Check your API key is correct
- Ensure key has proper permissions
- Verify key hasn't expired

### "API error: 429 Too Many Requests"

- You've hit rate limits
- Wait a few moments
- Consider upgrading your API plan

### "Network error" / "Failed to fetch"

- Check your internet connection
- Verify the base URL is correct
- Check if API is down (status page)

### Messages not persisting

- Check browser console for IndexedDB errors
- Clear IndexedDB and try again
- Ensure app has storage permissions

### Streaming not working

- Streaming is experimental
- Some providers may not support it
- Try disabling streaming in settings

## Examples

### Example 1: Using GPT-4 for Code Review

```
You: Can you review this TypeScript code?

```typescript
function processData(data: any) {
  return data.map(x => x * 2)
}
```