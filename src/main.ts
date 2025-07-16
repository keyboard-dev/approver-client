import { app, BrowserWindow, Notification, ipcMain, shell, protocol, screen, Tray, Menu, nativeImage } from 'electron';
import * as WebSocket from 'ws';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import { createRestAPIServer } from './rest-api';
import { Message, AuthTokens, PKCEParams, AuthorizeResponse, TokenResponse, ErrorResponse } from './types';
import { TrayManager, TrayManagerOptions } from './tray-manager';
import { WindowManager, WindowManagerOptions } from './window-manager';

class MenuBarNotificationApp {
  private trayManager: TrayManager;
  private windowManager: WindowManager;
  private wsServer: WebSocket.Server | null = null;
  private restApiServer: any = null;
  private messages: Message[] = [];
  private pendingCount: number = 0;
  private notificationsEnabled: boolean = true;
  private readonly WS_PORT = 8080;
  private readonly OAUTH_SERVER_URL = process.env.OAUTH_SERVER_URL || 'https://api.keyboard.dev';
  private readonly SKIP_AUTH = process.env.SKIP_AUTH === 'true';
  private readonly CUSTOM_PROTOCOL = 'mcpauth';
  private currentPKCE: PKCEParams | null = null;
  private authTokens: AuthTokens | null = null;
  
  // WebSocket security
  private wsConnectionKey: string | null = null;
  private readonly WS_KEY_FILE = path.join(os.homedir(), '.keyboard-mcp-ws-key');

  constructor() {
    // Initialize managers
    this.windowManager = new WindowManager({
      onWindowClosed: () => {
        // Handle window closed
      },
      onMessageShow: (message: Message) => {
        // Handle message show
      }
    });

    this.trayManager = new TrayManager({
      onToggleWindow: (bounds?: Electron.Rectangle) => {
        this.windowManager.toggleWindow(bounds);
      },
      onShowWindow: () => {
        this.windowManager.showWindow();
      },
      onClearAllMessages: () => {
        this.clearAllMessages();
      },
      onQuit: () => {
        app.quit();
      },
      getMessages: () => this.messages,
      getPendingCount: () => this.pendingCount
    });

    this.initializeApp();
  }

  private initializeApp(): void {
    // STEP 1: Handle single instance FIRST
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      app.quit();
      return;
    }

    // STEP 2: Set up event listeners BEFORE app.whenReady()
    
    // Platform-specific protocol handling
    if (process.platform === 'darwin') {
      // Handle macOS open-url events (MUST be before app.whenReady())
      app.on('open-url', (event, url) => {
        event.preventDefault();
        this.handleOAuthCallback(url);
      });
    }

    // Handle second instance (protocol callbacks for all platforms)
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Find protocol URL in command line arguments
      const url = commandLine.find(arg => arg.startsWith(`${this.CUSTOM_PROTOCOL}://`));
      if (url) {
        this.handleOAuthCallback(url);
      }
      
      // Show the window if it exists
      this.windowManager.showWindow();
    });

    // STEP 3: Register as default protocol client
    if (!app.isDefaultProtocolClient(this.CUSTOM_PROTOCOL)) {
      app.setAsDefaultProtocolClient(this.CUSTOM_PROTOCOL);
    }

    // STEP 4: App ready event
    app.whenReady().then(async () => {
      // Initialize WebSocket security key first
      await this.initializeWebSocketKey();
      
      this.trayManager.createTray();
      this.setupWebSocketServer();
      this.setupRestAPI();
      this.setupIPC();
      
      // Request notification permissions on all platforms
      await this.requestNotificationPermissions();
      
      app.on('activate', () => {
        // On macOS, show window when app is activated
        this.windowManager.showWindow();
      });
    });

    // Don't quit when all windows are closed (menu bar app behavior)
    app.on('window-all-closed', () => {
      // Keep running in background for menu bar app
    });

    // Handle app termination
    app.on('before-quit', () => {
        this.cleanup();
    });
  }

  // WebSocket Security Methods
  private async initializeWebSocketKey(): Promise<void> {
    try {
      // Try to load existing key
      if (fs.existsSync(this.WS_KEY_FILE)) {
        const keyData = fs.readFileSync(this.WS_KEY_FILE, 'utf8');
        const parsedData = JSON.parse(keyData);
        
        // Validate key format and age (regenerate if older than 30 days)
        if (parsedData.key && parsedData.createdAt) {
          const keyAge = Date.now() - parsedData.createdAt;
          const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
          
          if (keyAge < maxAge) {
            this.wsConnectionKey = parsedData.key;
            console.log('🔑 Loaded existing WebSocket connection key');
            return;
          }
        }
      }
      
      // Generate new key if none exists or is expired
      await this.generateNewWebSocketKey();
      
    } catch (error) {
      console.error('❌ Error initializing WebSocket key:', error);
      // Fallback: generate new key
      await this.generateNewWebSocketKey();
    }
  }

  private async generateNewWebSocketKey(): Promise<void> {
    try {
      // Generate a secure random key
      this.wsConnectionKey = crypto.randomBytes(32).toString('hex');
      
      // Store key with metadata
      const keyData = {
        key: this.wsConnectionKey,
        createdAt: Date.now(),
        version: '1.0'
      };
      
      // Write to file with restricted permissions
      fs.writeFileSync(this.WS_KEY_FILE, JSON.stringify(keyData, null, 2), { mode: 0o600 });
      
      console.log('🔑 Generated new WebSocket connection key');
      
      // Notify UI if window exists
      this.windowManager.sendMessage('ws-key-generated', {
        key: this.wsConnectionKey,
        createdAt: keyData.createdAt
      });
      
    } catch (error) {
      console.error('❌ Error generating WebSocket key:', error);
      throw error;
    }
  }

  private getWebSocketConnectionUrl(): string {
    if (!this.wsConnectionKey) {
      throw new Error('WebSocket connection key not initialized');
    }
    return `ws://127.0.0.1:${this.WS_PORT}?key=${this.wsConnectionKey}`;
  }

  private validateWebSocketKey(providedKey: string): boolean {
    return this.wsConnectionKey === providedKey;
  }

  private generatePKCE(): PKCEParams {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    return { codeVerifier, codeChallenge, state };
  }

  private async startOAuthFlow(): Promise<void> {
    try {
      // Generate PKCE parameters
      this.currentPKCE = this.generatePKCE();
      
      // Get authorization URL from server
      const params = new URLSearchParams({
        redirect_uri: `${this.CUSTOM_PROTOCOL}://callback`,
        state: this.currentPKCE.state,
        code_challenge: this.currentPKCE.codeChallenge,
        code_challenge_method: 'S256'
      });

      const response = await fetch(`${this.OAUTH_SERVER_URL}/oauth/authorize?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get authorization URL: ${response.statusText}`);
      }

      const data = await response.json() as AuthorizeResponse;
      
      // Open browser for user authentication
      await shell.openExternal(data.authorization_url);
      
    } catch (error) {
      console.error('❌ OAuth flow error:', error);
      this.notifyAuthError('Failed to start authentication');
    }
  }

  private async handleOAuthCallback(url: string): Promise<void> {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      const error = urlObj.searchParams.get('error');

      if (error) {
        throw new Error(`OAuth error: ${error} - ${urlObj.searchParams.get('error_description')}`);
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state');
      }

      if (!this.currentPKCE || state !== this.currentPKCE.state) {
        throw new Error('State mismatch - potential CSRF attack');
      }

      // Exchange code for tokens
      await this.exchangeCodeForTokens(code);
      
    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      this.notifyAuthError(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<void> {
    try {
      if (!this.currentPKCE) {
        throw new Error('No PKCE parameters available');
      }

      const response = await fetch(`${this.OAUTH_SERVER_URL}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: `${this.CUSTOM_PROTOCOL}://callback`,
          code_verifier: this.currentPKCE.codeVerifier,
          grant_type: 'authorization_code'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as ErrorResponse;
        throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
      }

      const tokens = await response.json() as TokenResponse;
      // Calculate expiration time and create AuthTokens object
      const authTokens: AuthTokens = {
        ...tokens,
        expires_at: Date.now() + (tokens.expires_in * 1000)
      };
      
      this.authTokens = authTokens;
      this.currentPKCE = null; // Clear PKCE data
      
      // Notify the renderer process
      this.windowManager.sendMessage('auth-success', {
        user: tokens.user,
        authenticated: true
      });

      // Show the window after successful authentication
      this.windowManager.showWindow();

      // Show success notification
      this.showNotification({
        id: 'auth-success',
        title: 'Authentication Successful',
        body: `Welcome back, ${tokens.user.firstName || tokens.user.email}!`,
        timestamp: Date.now(),
        priority: 'normal'
      });

    } catch (error) {
      console.error('❌ Token exchange error:', error);
      this.notifyAuthError(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async refreshTokens(): Promise<boolean> {
    try {
      if (!this.authTokens?.refresh_token) {
        return false;
      }

      const response = await fetch(`${this.OAUTH_SERVER_URL}/oauth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: this.authTokens.refresh_token,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        console.error('❌ Token refresh failed:', response.statusText);
        return false;
      }

      const tokens = await response.json() as TokenResponse;
      
      // Update tokens
      this.authTokens = {
        ...this.authTokens,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        expires_at: Date.now() + (tokens.expires_in * 1000)
      };

      return true;

    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return false;
    }
  }

  private async getValidAccessToken(): Promise<string | null> {
    if (!this.authTokens) {
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    if (Date.now() >= (this.authTokens.expires_at - bufferTime)) {
      const refreshed = await this.refreshTokens();
      if (!refreshed) {
        this.authTokens = null;
        return null;
      }
    }

    return this.authTokens.access_token;
  }

  private notifyAuthError(message: string): void {
    console.error('🔐 Auth Error:', message);
    
    this.windowManager.sendMessage('auth-error', { message });

    this.showNotification({
      id: 'auth-error',
      title: 'Authentication Error',
      body: message,
      timestamp: Date.now(),
      priority: 'high'
    });
  }

  private logout(): void {
    this.authTokens = null;
    this.currentPKCE = null;
    
    this.windowManager.sendMessage('auth-logout');
  }

  private setupWebSocketServer(): void {
    this.wsServer = new WebSocket.Server({ 
      port: this.WS_PORT,
      host: '127.0.0.1', // Localhost only for security
      verifyClient: (info: any) => {
        try {
          // Extract key from query parameters
          const url = new URL(info.req.url!, `ws://127.0.0.1:${this.WS_PORT}`);
          const providedKey = url.searchParams.get('key');
          
          // Validate connection is from localhost
          const remoteAddress = info.req.connection.remoteAddress;
          const isLocalhost = remoteAddress === '127.0.0.1' || 
                             remoteAddress === '::1' || 
                             remoteAddress === '::ffff:127.0.0.1';
          
          if (!isLocalhost) {
            console.warn(`🚨 Rejected WebSocket connection from non-localhost: ${remoteAddress}`);
            return false;
          }
          
          // Validate key
          if (!providedKey || !this.validateWebSocketKey(providedKey)) {
            console.warn(`🚨 Rejected WebSocket connection with invalid key from ${remoteAddress}`);
            return false;
          }
          

          return true;
          
        } catch (error) {
          console.error('❌ Error validating WebSocket connection:', error);
          return false;
        }
      }
    });
    
    this.wsServer.on('connection', (ws: WebSocket, req) => {
      console.log(`🔐 Secure WebSocket connection established from ${req.connection.remoteAddress}`);
      
      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle token request
          if (message.type === 'request-token') {
            const token = await this.getValidAccessToken();
            
            const tokenResponse = {
              type: 'auth-token',
              token: token || (this.SKIP_AUTH ? 'test-token' : null),
              timestamp: Date.now(),
              requestId: message.requestId, // Echo back request ID if provided
              authenticated: !!token || this.SKIP_AUTH,
              user: token ? this.authTokens?.user : (this.SKIP_AUTH ? { email: 'test@example.com', firstName: 'Test' } : null)
            };
            
            ws.send(JSON.stringify(tokenResponse));
            return;
          }
          
          // Handle regular messages
          this.handleIncomingMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log('🔐 Secure WebSocket connection closed');
      });
    });
  }

  private handleIncomingMessage(message: Message): void {
    // Add timestamp if not provided
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    // Set default status if not provided
    if (!message.status) {
      message.status = 'pending';
    }

    // Store the message
    this.messages.push(message);

    // Update pending count
    this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length;
    this.trayManager.updateTrayIcon();

    // Show desktop notification
    this.showNotification(message);

    // Send to renderer via websocket-message event
    this.windowManager.sendMessage('websocket-message', message);

    // Auto-show window for high priority messages
    if (message.priority === 'high') {
      this.windowManager.showWindow();
    }
  }

  private showNotification(message: Message): void {
    if (!Notification.isSupported()) {
      return;
    }

    try {
      const notification = new Notification({
        title: message.title,
        body: message.body,
        urgency: message.priority === 'high' ? 'critical' : 'normal'
      });

      notification.on('click', () => {
        this.openMessageWindow(message);
      });

      notification.show();
      } catch (error) {
      console.error('❌ Error showing notification:', error);
    }
  }

  private async requestNotificationPermissions(): Promise<void> {
    try {
      // On macOS, we can use the system notification request
      if (Notification.isSupported()) {
        } else {
        }
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
    }
  }

  private openMessageWindow(message?: Message): void {
    this.windowManager.showWindow();
    
    // Send message data to renderer if specific message was clicked
    if (message) {
      this.windowManager.showMessage(message);
    }
  }

  private clearAllMessages(): void {
    this.messages = [];
    this.pendingCount = 0;
    this.trayManager.updateTrayIcon();
    
    // Notify renderer
    this.windowManager.sendMessage('messages-cleared');
  }

  private setupIPC(): void {
    // OAuth-related IPC handlers
    ipcMain.handle('start-oauth', async (): Promise<void> => {
      await this.startOAuthFlow();
    });

    ipcMain.handle('get-auth-status', (): { authenticated: boolean; user?: any } => {
      return {
        authenticated: !!this.authTokens,
        user: this.authTokens?.user
      };
    });

    ipcMain.handle('logout', (): void => {
      this.logout();
    });

    ipcMain.handle('get-access-token', async (): Promise<string | null> => {
      return await this.getValidAccessToken();
    });

    // Handle requests for all messages
    ipcMain.handle('get-messages', (): Message[] => {
      return this.messages;
    });

    // Handle mark as read
    ipcMain.handle('mark-message-read', (event, messageId: string): void => {
      const message = this.messages.find(msg => msg.id === messageId);
      if (message) {
        message.read = true;
      }
    });

    // Handle delete message
    ipcMain.handle('delete-message', (event, messageId: string): void => {
      this.messages = this.messages.filter(msg => msg.id !== messageId);
      this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length;
      this.trayManager.updateTrayIcon();
    });

    // Handle approve message
    ipcMain.handle('approve-message', (event, messageId: string, feedback?: string, messageBody?: string): void => {
      const message = this.messages.find(msg => msg.id === messageId);
      if (message) {
        message.status = 'approved';
        message.feedback = feedback;
        
        // Update pending count
        this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length;
        this.trayManager.updateTrayIcon();
        
        // Send response back through WebSocket if needed
        this.sendWebSocketResponse(message, 'approved', feedback);
      }
    });

    // Handle reject message
    ipcMain.handle('reject-message', (event, messageId: string, feedback?: string): void => {
      const message = this.messages.find(msg => msg.id === messageId);
      if (message) {
        message.status = 'rejected';
        message.feedback = feedback;
        
        // Update pending count
        this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length;
        this.trayManager.updateTrayIcon();
        
        // Send response back through WebSocket if needed
        this.sendWebSocketResponse(message, 'rejected', feedback);
      }
    });

    // Handle show all messages
    ipcMain.on('show-messages', (): void => {
      this.windowManager.showWindow();
    });

    // WebSocket key management
    ipcMain.handle('get-ws-connection-key', (): string | null => {
      return this.wsConnectionKey;
    });

    ipcMain.handle('get-ws-connection-url', (): string => {
      return this.getWebSocketConnectionUrl();
    });

    ipcMain.handle('regenerate-ws-key', async (): Promise<{ key: string; createdAt: number }> => {
      await this.generateNewWebSocketKey();
      return {
        key: this.wsConnectionKey!,
        createdAt: Date.now()
      };
    });

    ipcMain.handle('get-ws-key-info', (): { key: string | null; createdAt: number | null; keyFile: string } => {
      let createdAt: number | null = null;
      
      try {
        if (fs.existsSync(this.WS_KEY_FILE)) {
          const keyData = fs.readFileSync(this.WS_KEY_FILE, 'utf8');
          const parsedData = JSON.parse(keyData);
          createdAt = parsedData.createdAt;
        }
      } catch (error) {
        console.error('Error reading key file:', error);
      }
      
      return {
        key: this.wsConnectionKey,
        createdAt,
        keyFile: this.WS_KEY_FILE
      };
    });
  }

  private sendWebSocketResponse(message: Message, status: 'approved' | 'rejected', feedback?: string): void {
    if (this.wsServer && message.requiresResponse) {
      let response = {
        id: message.id,
        status: status,
        feedback: feedback,
        timestamp: Date.now(),
        originalMessage: {
          id: message.id,
          title: message.title,
          body: "no body"
        }
      };
      if(status === 'approved') {
        if(message.body) {
          response.originalMessage.body = message.body;
        }
      }

      // Send response to all connected WebSocket clients
      this.wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(response));
        }
      });
    }
  }

  private setupRestAPI(): void {
    this.restApiServer = createRestAPIServer({
      getMessages: () => this.messages,
      getAuthTokens: () => this.authTokens,
      getWebSocketServerStatus: () => !!this.wsServer,
      updateMessageStatus: (messageId: string, status: 'approved' | 'rejected', feedback?: string) => {
        const message = this.messages.find(msg => msg.id === messageId);
        if (message) {
          message.status = status;
          message.feedback = feedback;
          
          // Update pending count
          this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length;
          this.trayManager.updateTrayIcon();
          
          // Send response through WebSocket if needed
          this.sendWebSocketResponse(message, status, feedback);
          
          return true;
        }
        return false;
      }
    });

    this.restApiServer.start().catch((error: Error) => {
      console.error('Failed to start REST API server:', error);
    });
  }

  private cleanup(): void {
    if (this.restApiServer) {
      this.restApiServer.stop().catch((error: Error) => {
        console.error('Error stopping REST API server:', error);
      });
    }
    
    if (this.wsServer) {
      this.wsServer.close();
    }

    this.trayManager.destroy();
    this.windowManager.destroy();
  }
}

// Create the app instance
new MenuBarNotificationApp();
