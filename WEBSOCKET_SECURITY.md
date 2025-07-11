# WebSocket Security Features

The approver app now includes comprehensive security features to protect WebSocket connections from unauthorized access.

## Security Features

### 1. **Localhost-Only Binding**
- WebSocket server binds to `127.0.0.1:8080` (localhost only)
- Prevents connections from other devices on the network
- Only processes running on the same machine can connect

### 2. **Connection Key Authentication**
- Each app instance generates a unique 256-bit connection key
- Key is required as a query parameter: `ws://127.0.0.1:8080?key=YOUR_KEY`
- Keys are cryptographically secure (generated using `crypto.randomBytes(32)`)

### 3. **Secure Key Storage**
- Keys are stored in `~/.keyboard-mcp-ws-key` with restricted permissions (600)
- Keys automatically regenerate every 30 days
- Key file includes metadata (creation time, version)

### 4. **Connection Validation**
- Validates both IP address (localhost only) and connection key
- Rejects connections with invalid or missing keys
- Logs security events for monitoring

## Getting Your Connection Key

### Via the UI
1. Open the approver app
2. Click "Settings" in the top-right corner
3. View the "WebSocket Connection Key" section
4. Copy either:
   - The connection key alone
   - The full connection URL

### Via API (if authenticated)
```bash
# Get key info
curl http://127.0.0.1:8081/api/health

# Get connection details
curl -H "Authorization: Bearer YOUR_TOKEN" http://127.0.0.1:8081/api/ws-connection
```

## Using the Secure Connection

### JavaScript/Node.js Example
```javascript
const WebSocket = require('ws');

const connectionKey = 'your-key-here';
const ws = new WebSocket(`ws://127.0.0.1:8080?key=${connectionKey}`);

ws.on('open', () => {
    console.log('✅ Secure connection established');
    
    // Send a message
    ws.send(JSON.stringify({
        id: 'test-message',
        title: 'Test Approval Request',
        body: 'This is a test message',
        timestamp: Date.now(),
        priority: 'normal',
        sender: 'Test Client',
        requiresResponse: true
    }));
});

ws.on('error', (error) => {
    if (error.message.includes('401')) {
        console.error('❌ Invalid connection key');
    }
});
```

### Python Example
```python
import websocket
import json

def on_open(ws):
    print("✅ Secure connection established")
    
    message = {
        "id": "test-message",
        "title": "Test Approval Request", 
        "body": "This is a test message",
        "timestamp": int(time.time() * 1000),
        "priority": "normal",
        "sender": "Python Client",
        "requiresResponse": True
    }
    
    ws.send(json.dumps(message))

def on_error(ws, error):
    if "401" in str(error):
        print("❌ Invalid connection key")

connection_key = "your-key-here"
ws = websocket.WebSocketApp(
    f"ws://127.0.0.1:8080?key={connection_key}",
    on_open=on_open,
    on_error=on_error
)

ws.run_forever()
```

## Testing the Security

### Test with Valid Key
```bash
# Get your key from the app settings, then:
node secure-test-client.js YOUR_KEY_HERE
```

### Test with Invalid Key
```bash
# This should fail with authentication error:
node secure-test-client.js invalid-key
```

### Test from Network (Should Fail)
```bash
# From another machine (should fail):
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://APPROVER_IP:8080?key=valid-key');
ws.on('error', (e) => console.log('❌ Network connection rejected:', e.message));
"
```

## Security Best Practices

### For Application Developers
1. **Store keys securely** - Never hardcode keys in your application
2. **Use environment variables** - Store keys in environment variables or secure config
3. **Handle key rotation** - Be prepared for keys to change every 30 days
4. **Implement retry logic** - Handle connection failures gracefully
5. **Validate responses** - Always validate data received from the WebSocket

### For System Administrators
1. **Monitor key file** - Ensure `~/.keyboard-mcp-ws-key` has correct permissions
2. **Regular key rotation** - Keys auto-rotate, but can be manually regenerated
3. **Log monitoring** - Check logs for rejected connection attempts
4. **Firewall rules** - Ensure port 8080 is not exposed to the network
5. **Process isolation** - Run the approver app with minimal privileges

## Key Management

### Manual Key Regeneration
You can regenerate the key manually:
1. Go to Settings in the approver app
2. Click "Regenerate Key" 
3. Confirm the action
4. Update all client applications with the new key

### Key Rotation Schedule
- Keys automatically regenerate every 30 days
- You'll receive a notification when a new key is generated
- Old keys become invalid immediately after regeneration

### Emergency Key Reset
If you suspect a key has been compromised:
1. Immediately regenerate the key via the UI
2. Update all legitimate client applications
3. Monitor logs for rejected connection attempts
4. Consider changing the WebSocket port if necessary

## Troubleshooting

### Common Connection Errors

**"Unexpected server response: 401"**
- Invalid or missing connection key
- Get a new key from the app settings

**"Connection refused"**
- Approver app is not running
- Wrong port number (should be 8080)
- Firewall blocking the connection

**"Network unreachable"**
- Trying to connect from another machine
- Use localhost/127.0.0.1 only

### Security Logs
The approver app logs security events:
- `✅ Accepted secure WebSocket connection` - Valid connection
- `🚨 Rejected WebSocket connection with invalid key` - Invalid key
- `🚨 Rejected WebSocket connection from non-localhost` - Network attempt

## Migration from Unsecured Version

If you're upgrading from an unsecured version:

1. **Update client code** to include the connection key parameter
2. **Get the connection key** from the app settings
3. **Test connections** with the new secure client
4. **Update documentation** for your team
5. **Monitor logs** for any connection issues

The old unsecured connections will be automatically rejected. 