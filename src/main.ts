import { app, BrowserWindow, Notification, ipcMain, shell, protocol } from 'electron';
import * as WebSocket from 'ws';
import * as path from 'path';
import * as crypto from 'crypto';

interface Message {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  priority?: 'low' | 'normal' | 'high';
  sender?: string;
  read?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  feedback?: string;
  requiresResponse?: boolean;
  codeEval?: boolean;
  code?: string;
  explaination?: string;
  type?: string;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profile_picture?: string;
  };
}

interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

interface AuthorizeResponse {
  authorization_url: string;
  state: string;
  redirect_uri: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profile_picture?: string;
  };
}

interface ErrorResponse {
  error?: string;
  error_description?: string;
}

class NotificationApp {
  private mainWindow: BrowserWindow | null = null;
  private wsServer: WebSocket.Server | null = null;
  private messages: Message[] = [];
  private readonly WS_PORT = 8080;
  private readonly OAUTH_SERVER_URL = process.env.OAUTH_SERVER_URL || 'http://localhost:4000';
  private readonly CUSTOM_PROTOCOL = 'mcpauth';
  private currentPKCE: PKCEParams | null = null;
  private authTokens: AuthTokens | null = null;

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    // STEP 1: Handle single instance FIRST
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      console.log('🔒 Another instance is already running, quitting...');
      app.quit();
      return;
    }

    // STEP 2: Set up event listeners BEFORE app.whenReady()
    
    // Handle macOS open-url events (MUST be before app.whenReady())
    app.on('open-url', (event, url) => {
      event.preventDefault();
      console.log('🍎 macOS open-url event:', url);
      console.log('🔧 App ready state:', app.isReady());
      console.log('🔧 Main window exists:', !!this.mainWindow);
      this.handleOAuthCallback(url);
    });

    // Handle second instance (protocol callbacks)
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      console.log('🔄 Second instance detected');
      console.log('📋 Command line:', commandLine);
      
      // Find protocol URL in command line arguments
      const url = commandLine.find(arg => arg.startsWith(`${this.CUSTOM_PROTOCOL}://`));
      if (url) {
        console.log('🔗 OAuth callback URL found:', url);
        this.handleOAuthCallback(url);
      }
      
      // Focus the existing window
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
        this.mainWindow.show();
      }
    });

    // STEP 3: Register as default protocol client
    if (!app.isDefaultProtocolClient(this.CUSTOM_PROTOCOL)) {
      console.log('🔗 Registering as default protocol client for:', this.CUSTOM_PROTOCOL);
      app.setAsDefaultProtocolClient(this.CUSTOM_PROTOCOL);
    }

    // STEP 4: App ready event
    app.whenReady().then(async () => {
      console.log('🚀 App is ready, creating main window...');
      // Remove duplicate protocol registration
      this.createMainWindow();
      this.setupWebSocketServer();
      this.setupIPC();
      
      // Request notification permissions on macOS
      if (process.platform === 'darwin') {
        await this.requestNotificationPermissions();
      }
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
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
      console.log('🔐 Starting OAuth flow...');
      
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
      
      console.log('🔗 Opening authorization URL:', data.authorization_url);
      
      // Open browser for user authentication
      await shell.openExternal(data.authorization_url);
      
    } catch (error) {
      console.error('❌ OAuth flow error:', error);
      this.notifyAuthError('Failed to start authentication');
    }
  }

  private async handleOAuthCallback(url: string): Promise<void> {
    try {
      console.log('🔄 Handling OAuth callback:', url);
      
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
      console.log('🔄 Exchanging code for tokens...');
      
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
      
      console.log('✅ Authentication successful for user:', tokens.user.email);
      
      // Notify the renderer process
      if (this.mainWindow) {
        this.mainWindow.webContents.send('auth-success', {
          user: tokens.user,
          authenticated: true
        });
      }

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

      console.log('🔄 Refreshing access token...');

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

      console.log('✅ Tokens refreshed successfully');
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
      console.log('🔄 Access token expired, refreshing...');
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
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('auth-error', { message });
    }

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
    
    console.log('🔐 User logged out');
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('auth-logout');
    }
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      show: true, // Show the window immediately
      title: 'Message Viewer'
    });

    this.mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupWebSocketServer(): void {
    this.wsServer = new WebSocket.Server({ port: this.WS_PORT });
    
    console.log(`WebSocket server listening on port ${this.WS_PORT}`);

    this.wsServer.on('connection', (ws: WebSocket) => {
      console.log('Client connected to WebSocket server');

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: Message = JSON.parse(data.toString());
          this.handleIncomingMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected from WebSocket server');
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

    console.log('📥 Received message:', message.title);
    console.log('📝 Total messages stored:', this.messages.length);

    // Show desktop notification
    this.showNotification(message);

    // Send to renderer via websocket-message event
    if (this.mainWindow) {
      this.mainWindow.webContents.send('websocket-message', message);
    }
  }

  private showNotification(message: Message): void {
    console.log('🔔 Attempting to show notification for:', message.title);
    
    if (!Notification.isSupported()) {
      console.log('❌ Notifications are not supported on this system');
      return;
    }

    console.log('✅ Notifications are supported');

    try {
      const notification = new Notification({
        title: message.title,
        body: message.body,
        // Remove icon for now to avoid path issues
        urgency: message.priority === 'high' ? 'critical' : 'normal'
      });

      notification.on('click', () => {
        console.log('🖱️ Notification clicked');
        this.openMessageWindow(message);
      });

      notification.show();
      console.log('✅ Notification shown successfully');
    } catch (error) {
      console.error('❌ Error showing notification:', error);
    }
  }

  private async requestNotificationPermissions(): Promise<void> {
    try {
      console.log('🔔 Requesting notification permissions...');
      // On macOS, we can use the system notification request
      // This will prompt the user if permissions haven't been granted
      if (Notification.isSupported()) {
        console.log('✅ Notification permissions available');
      } else {
        console.log('❌ Notifications not supported');
      }
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
    }
  }

  private openMessageWindow(message?: Message): void {
    if (!this.mainWindow) {
      this.createMainWindow();
    }

    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
      
      // Send message data to renderer if specific message was clicked
      if (message) {
        this.mainWindow.webContents.send('show-message', message);
      }
    }
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
    });

    // Handle approve message
    ipcMain.handle('approve-message', (event, messageId: string, feedback?: string, messageBody?: string): void => {
      console.log('🔧 approve-message IPC called for messageId:', messageId);
      const message = this.messages.find(msg => msg.id === messageId);
      if (message) {
        message.status = 'approved';
        message.feedback = feedback;
        console.log('✅ Message approved:', message.title);
        console.log('🔧 Message requiresResponse:', message.requiresResponse);
        console.log('🔧 Message body:', messageBody);
        
        // Send response back through WebSocket if needed
        this.sendWebSocketResponse(message, 'approved', feedback);
      } else {
        console.log('❌ Message not found for ID:', messageId);
      }
    });

    // Handle reject message
    ipcMain.handle('reject-message', (event, messageId: string, feedback?: string): void => {
      console.log('🔧 reject-message IPC called for messageId:', messageId);
      const message = this.messages.find(msg => msg.id === messageId);
      if (message) {
        message.status = 'rejected';
        message.feedback = feedback;
        console.log('❌ Message rejected:', message.title);
        console.log('🔧 Message requiresResponse:', message.requiresResponse);
        
        // Send response back through WebSocket if needed
        this.sendWebSocketResponse(message, 'rejected', feedback);
      } else {
        console.log('❌ Message not found for ID:', messageId);
      }
    });

    // Handle show all messages
    ipcMain.on('show-messages', (): void => {
      this.openMessageWindow();
    });
  }

  private sendWebSocketResponse(message: Message, status: 'approved' | 'rejected', feedback?: string): void {
    console.log('🔧 sendWebSocketResponse called');
    console.log('🔧 wsServer exists:', !!this.wsServer);
    console.log('🔧 message.requiresResponse:', message.requiresResponse);
    console.log('🔧 wsServer clients count:', this.wsServer?.clients?.size || 0);
    
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

      console.log(`📤 Sent ${status} response for message: ${message.title}`);
    } else {
      console.log('🔧 Not sending WebSocket response - wsServer:', !!this.wsServer, 'requiresResponse:', message.requiresResponse);
    }
  }
}

// Create the app instance
new NotificationApp();
