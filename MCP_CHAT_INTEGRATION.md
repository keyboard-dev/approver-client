# MCP Chat Integration

This document describes the new MCP Chat feature integrated into the approver-client application.

## Overview

The MCP Chat feature provides a conversational interface to interact with your MCP (Model Context Protocol) server at `https://mcp.keyboard.dev`. It's built using [assistant-ui](https://www.assistant-ui.com), a production-ready React library for AI chat interfaces.

## Features

- 💬 **Real-time Chat Interface**: Chat with your MCP server through a modern, polished UI
- 🔧 **MCP Tools Support**: View and approve/reject tool calls inline in the chat
- ✅ **Human-in-the-Loop Approvals**: Review tool calls before they execute
- 🎨 **Consistent Design**: Built with your existing shadcn/ui components
- ⚡ **Streaming Support**: Ready for streaming responses (can be enhanced)
- 🔒 **Secure**: Supports API key authentication

## Architecture

### Components

1. **ChatScreen** (`src/renderer/components/screens/ChatScreen.tsx`)
   - Main screen component
   - Handles settings (server URL, API key)
   - Integrates the chat interface

2. **ChatInterface** (`src/renderer/components/chat/ChatInterface.tsx`)
   - Main chat UI using assistant-ui primitives
   - Message list, composer, welcome screen

3. **ChatMessage** (`src/renderer/components/chat/ChatMessage.tsx`)
   - Individual message renderer
   - Supports user and assistant messages
   - Handles tool call rendering

4. **ToolCallRenderer** (`src/renderer/components/chat/ToolCallRenderer.tsx`)
   - Displays tool calls with approve/reject buttons
   - Shows tool arguments and results
   - Expandable/collapsible view

### Runtime & Providers

1. **McpRuntime** (`src/renderer/runtime/McpRuntime.ts`)
   - Custom runtime adapter for assistant-ui
   - Connects to MCP server at `https://mcp.keyboard.dev`
   - Handles message generation and tool calls

2. **McpRuntimeProvider** (`src/renderer/providers/McpRuntimeProvider.tsx`)
   - React context provider for the MCP runtime
   - Manages server URL, API key, and tool approval callbacks
   - Wraps chat components

## Usage

### Accessing the Chat

1. Launch the approver-client application
2. After authentication, click the **💬 Chat** button in the top toolbar
3. The chat interface will open

### Configuring the Server

1. Click the **Settings** gear icon in the chat header
2. Configure:
   - **Server URL**: Your MCP server endpoint (default: `https://mcp.keyboard.dev`)
   - **API Key**: Optional API key for authentication
3. Click **Save Settings**

### Chatting with MCP

1. Type your message in the composer at the bottom
2. Press Enter or click **Send**
3. The assistant will respond with text and/or tool calls

### Approving Tool Calls

When the assistant requests to use a tool:

1. A tool call card will appear in the chat
2. Click the card to expand and view:
   - Tool name
   - Arguments
   - Status (Pending/Approved/Rejected)
3. Click **Approve** to allow execution or **Reject** to deny
4. The tool result will appear after execution

## Customization

### Changing the MCP Server URL

Edit `ChatScreen.tsx`:
```typescript
const [serverUrl, setServerUrl] = useState('https://your-mcp-server.com')
```

### Custom Tool Approval Logic

The `handleToolCall` callback in `ChatScreen.tsx` can be customized:

```typescript
const handleToolCall = useCallback(
  async (toolCall: {
    id: string
    name: string
    arguments: Record<string, unknown>
  }): Promise<'approved' | 'rejected'> => {
    // Your custom approval logic here
    // Could show a custom dialog, check permissions, etc.
    return 'approved'
  },
  [],
)
```

### Styling

All components use your existing Tailwind CSS classes and shadcn/ui components. Customize in:
- `ChatMessage.tsx` - Message bubble styles
- `ToolCallRenderer.tsx` - Tool call card styles
- `ChatInterface.tsx` - Overall layout

## API Integration

### Expected MCP Server Endpoints

The runtime expects your MCP server to expose:

**POST `/v1/chat`**
```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": false
}
```

**Response:**
```json
{
  "content": "Assistant response",
  "finishReason": "stop",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 20
  },
  "toolCalls": [
    {
      "id": "call_1",
      "name": "tool_name",
      "arguments": { "arg1": "value1" }
    }
  ]
}
```

### Extending for Streaming

To enable streaming responses:

1. Update `McpRuntime.ts` `doStream` method
2. Use Server-Sent Events (SSE) or WebSocket for streaming
3. Update the implementation to yield incremental chunks

## Dependencies

New packages added:
- `@assistant-ui/react` - Core React components
- `@assistant-ui/react-markdown` - Markdown rendering
- `@radix-ui/react-avatar` - Avatar component
- `motion` - Animation library
- `remark-gfm` - GitHub Flavored Markdown
- `zustand` - State management

## Troubleshooting

### Chat not appearing
- Ensure you're authenticated
- Check that the Chat button is visible in the toolbar
- Verify the `showChat` state is being set correctly

### Server connection errors
- Verify the MCP server URL is correct
- Check network connectivity
- Ensure API key is valid (if required)
- Check browser/Electron console for error messages

### Tool calls not working
- Verify the MCP server returns tool calls in the expected format
- Check the `handleToolCall` callback is being invoked
- Review console logs for approval flow

## Future Enhancements

Potential improvements:
- [ ] Streaming responses implementation
- [ ] Message persistence (save chat history)
- [ ] Multi-turn conversations with context
- [ ] Rich markdown rendering with code highlighting
- [ ] File attachments support
- [ ] Export chat transcripts
- [ ] Multiple chat sessions/threads
- [ ] Tool call history and analytics

## Learn More

- [assistant-ui Documentation](https://www.assistant-ui.com/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Keyboard.dev MCP Docs](https://docs.keyboard.dev)
