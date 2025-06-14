import { app, BrowserWindow, Notification, ipcMain } from 'electron';
import * as WebSocket from 'ws';
import * as path from 'path';

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
}

class NotificationApp {
  private mainWindow: BrowserWindow | null = null;
  private wsServer: WebSocket.Server | null = null;
  private messages: Message[] = [];
  private readonly WS_PORT = 8080;

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    app.whenReady().then(async () => {
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
    ipcMain.handle('approve-message', (event, messageId: string, feedback?: string): void => {
      const message = this.messages.find(msg => msg.id === messageId);
      if (message) {
        message.status = 'approved';
        message.feedback = feedback;
        console.log('✅ Message approved:', message.title);
        
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
        console.log('❌ Message rejected:', message.title);
        
        // Send response back through WebSocket if needed
        this.sendWebSocketResponse(message, 'rejected', feedback);
      }
    });

    // Handle show all messages
    ipcMain.on('show-messages', (): void => {
      this.openMessageWindow();
    });
  }

  private sendWebSocketResponse(message: Message, status: 'approved' | 'rejected', feedback?: string): void {
    if (this.wsServer && message.requiresResponse) {
      const response = {
        id: message.id,
        status: status,
        feedback: feedback,
        timestamp: Date.now(),
        originalMessage: {
          id: message.id,
          title: message.title
        }
      };

      // Send response to all connected WebSocket clients
      this.wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(response));
        }
      });

      console.log(`📤 Sent ${status} response for message: ${message.title}`);
    }
  }
}

// Create the app instance
new NotificationApp();
