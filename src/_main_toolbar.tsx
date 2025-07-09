import { app, BrowserWindow, Notification, ipcMain, shell, protocol, screen, Tray, Menu, nativeImage } from 'electron';
import * as WebSocket from 'ws';
import * as path from 'path';
import * as crypto from 'crypto';
import { createRestAPIServer } from './rest-api';
import { Message, AuthTokens, PKCEParams, AuthorizeResponse, TokenResponse, ErrorResponse } from './types';

class MenuBarNotificationApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private wsServer: WebSocket.Server | null = null;
  private restApiServer: any = null;
  private messages: Message[] = [];
  private pendingCount: number = 0;
  private readonly WS_PORT = 8080;
  private readonly OAUTH_SERVER_URL = process.env.OAUTH_SERVER_URL || 'https://api.keyboard.dev';
  private readonly SKIP_AUTH = process.env.SKIP_AUTH === 'true';
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
      app.quit();
      return;
    }

    // STEP 2: Set up event listeners BEFORE app.whenReady()
    
    // Handle macOS open-url events (MUST be before app.whenReady())
    app.on('open-url', (event, url) => {
      event.preventDefault();
      this.handleOAuthCallback(url);
    });

    // Handle second instance (protocol callbacks)
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Find protocol URL in command line arguments
      const url = commandLine.find(arg => arg.startsWith(`${this.CUSTOM_PROTOCOL}://`));
      if (url) {
        this.handleOAuthCallback(url);
      }
      
      // Show the window if it exists
      if (this.mainWindow) {
        this.showWindow();
      }
    });

    // STEP 3: Register as default protocol client
    if (!app.isDefaultProtocolClient(this.CUSTOM_PROTOCOL)) {
      app.setAsDefaultProtocolClient(this.CUSTOM_PROTOCOL);
    }

    // STEP 4: App ready event
    app.whenReady().then(async () => {
      this.createTray();
      this.createMainWindow();
      this.setupWebSocketServer();
      this.setupRestAPI();
      this.setupIPC();
      
      // Request notification permissions on macOS
      if (process.platform === 'darwin') {
        await this.requestNotificationPermissions();
      }
      
      app.on('activate', () => {
        // On macOS, show window when app is activated
        this.showWindow();
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

  private createTray(): void {
    // Create tray icon
    const icon = this.createTrayIcon();
    this.tray = new Tray(icon);
    
    this.tray.setToolTip('Message Approver');
    
    // Click to toggle window
    this.tray.on('click', (event, bounds) => {
      this.toggleWindow(bounds);
    });

    // Right-click for context menu
    this.tray.on('right-click', () => {
      this.showContextMenu();
    });

    this.updateTrayIcon();
  }

  private createTrayIcon(): Electron.NativeImage {
    // Create a simple 16x16 icon
    const size = 16;
    
    // Create a simple colored square as fallback (works without canvas)
    const canvas = Buffer.alloc(size * size * 4);
    const color = this.pendingCount > 0 ? [255, 59, 48, 255] : [0, 122, 255, 255];
    
    // Fill the buffer with the color
    for (let i = 0; i < canvas.length; i += 4) {
      canvas[i] = color[0];     // R
      canvas[i + 1] = color[1]; // G
      canvas[i + 2] = color[2]; // B
      canvas[i + 3] = color[3]; // A
    }
    
    return nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  private toggleWindow(bounds?: Electron.Rectangle): void {
    if (this.mainWindow?.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.showWindow(bounds);
    }
  }

  private showWindow(bounds?: Electron.Rectangle): void {
    if (!this.mainWindow) {
      this.createMainWindow();
    }

    if (this.mainWindow) {
      if (bounds && this.tray) {
        // Position window near tray icon
        const windowBounds = this.mainWindow.getBounds();
        const trayBounds = this.tray.getBounds();
        
        let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
        let y = Math.round(trayBounds.y + trayBounds.height + 5);
        
        // Make sure window stays on screen
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
        
        x = Math.max(0, Math.min(x, screenWidth - windowBounds.width));
        y = Math.max(0, Math.min(y, screenHeight - windowBounds.height));
        
        this.mainWindow.setPosition(x, y);
      }

      // Force window to appear on current desktop/space only when showing from tray
      if (process.platform === 'darwin' && bounds) {
        this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        
        // Show and focus
        this.mainWindow.show();
        this.mainWindow.focus();
        
        // Reset workspace visibility after showing
        setTimeout(() => {
          if (this.mainWindow) {
            this.mainWindow.setVisibleOnAllWorkspaces(false);
          }
        }, 200);
      } else {
        // Normal show for other cases (like OAuth callbacks)
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    }
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 600,  // Larger for reading code
      height: 700, // Taller for explanations
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      show: false,
      frame: false,
      transparent: true,
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: true,
      minimizable: false,
      maximizable: false,
      type: 'panel', // This helps with menu bar behavior
      // macOS specific
      ...(process.platform === 'darwin' && {
        vibrancy: 'under-window',
        visualEffectState: 'active',
        level: 'floating' // Use floating level instead of screen-saver
      })
    });

    this.mainWindow.loadFile(path.join(__dirname, '../public/index.html'));

    // Hide window when it loses focus
    this.mainWindow.on('blur', () => {
      if (this.mainWindow?.isVisible()) {
        setTimeout(() => {
          if (this.mainWindow?.isVisible() && !this.mainWindow?.isFocused()) {
            this.mainWindow.hide();
          }
        }, 100);
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.setupWindowControls();
  }

  private showContextMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Messages (${this.pendingCount} pending)`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show Messages',
        click: () => this.showWindow()
      },
      {
        label: 'Clear All',
        click: () => this.clearAllMessages(),
        enabled: this.messages.length > 0
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ]);

    this.tray?.popUpContextMenu(contextMenu);
  }

  private clearAllMessages(): void {
    this.messages = [];
    this.pendingCount = 0;
    this.updateTrayIcon();
    
    // Notify renderer
    if (this.mainWindow) {
      this.mainWindow.webContents.send('messages-cleared');
    }
  }

  private updateTrayIcon(): void {
    if (this.tray) {
      const icon = this.createTrayIcon();
      this.tray.setImage(icon);
      
      // Update tooltip with pending count
      const tooltip = this.pendingCount > 0 
        ? `Message Approver (${this.pendingCount} pending)`
        : 'Message Approver';
      this.tray.setToolTip(tooltip);
    }
  }

  private setupWindowControls(): void {
    // Handle window close
    ipcMain.handle('window-close', () => {
      if (this.mainWindow) {
        this.mainWindow.hide();
      }
    });

    // Handle window hide/show toggle
    ipcMain.handle('window-toggle-visibility', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isVisible()) {
          this.mainWindow.hide();
        } else {
          this.mainWindow.show();
        }
      }
    });

    // Handle window opacity change
    ipcMain.handle('window-set-opacity', (event, opacity: number) => {
      if (this.mainWindow) {
        this.mainWindow.setOpacity(Math.max(0.1, Math.min(1.0, opacity)));
      }
    });

    // Handle window resize
    ipcMain.handle('window-resize', (event, { width, height }) => {
      if (this.mainWindow) {
        this.mainWindow.setSize(width, height);
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
      console.log('tokens', tokens);
      // Calculate expiration time and create AuthTokens object
      const authTokens: AuthTokens = {
        ...tokens,
        expires_at: Date.now() + (tokens.expires_in * 1000)
      };
      
      this.authTokens = authTokens;
      this.currentPKCE = null; // Clear PKCE data
      
      // Notify the renderer process
      if (this.mainWindow) {
        this.mainWindow.webContents.send('auth-success', {
          user: tokens.user,
          authenticated: true
        });
      }

      // Show the window after successful authentication
      this.showWindow();

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
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('auth-logout');
    }
  }

  private setupWebSocketServer(): void {
    this.wsServer = new WebSocket.Server({ port: this.WS_PORT });
    
    this.wsServer.on('connection', (ws: WebSocket) => {
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
    this.updateTrayIcon();

    // Show desktop notification
    this.showNotification(message);

    // Send to renderer via websocket-message event
    if (this.mainWindow) {
      this.mainWindow.webContents.send('websocket-message', message);
    }

    // Auto-show window for high priority messages
    if (message.priority === 'high') {
      this.showWindow();
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
    this.showWindow();
    
    // Send message data to renderer if specific message was clicked
    if (message && this.mainWindow) {
      this.mainWindow.webContents.send('show-message', message);
    }
  }

  private setupIPC(): void {
    // OAuth-related IPC handlers
    ipcMain.handle('start-oauth', async (): Promise<void> => {
      await this.startOAuthFlow();
    });

    ipcMain.handle('get-auth-status', (): { authenticated: boolean; user?: any; skipAuth?: boolean } => {
      return {
        authenticated: !!this.authTokens || this.SKIP_AUTH,
        user: this.authTokens?.user || (this.SKIP_AUTH ? { email: 'test@example.com', firstName: 'Test' } : undefined),
        skipAuth: this.SKIP_AUTH
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
      this.updateTrayIcon();
    });

    // Handle approve message
    ipcMain.handle('approve-message', (event, messageId: string, feedback?: string, messageBody?: string): void => {
      const message = this.messages.find(msg => msg.id === messageId);
      if (message) {
        message.status = 'approved';
        message.feedback = feedback;
        
        // Update pending count
        this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length;
        this.updateTrayIcon();
        
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
        this.updateTrayIcon();
        
        // Send response back through WebSocket if needed
        this.sendWebSocketResponse(message, 'rejected', feedback);
      }
    });

    // Handle show all messages
    ipcMain.on('show-messages', (): void => {
      this.showWindow();
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
          this.updateTrayIcon();
          
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

    if (this.tray) {
      this.tray.destroy();
    }
  }
}

// Create the app instance
new MenuBarNotificationApp();
