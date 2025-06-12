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
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupWebSocketServer();
      this.setupIPC();
      
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
      show: false, // Don't show initially
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

    // Store the message
    this.messages.push(message);

    // Show desktop notification
    this.showNotification(message);
  }

  private showNotification(message: Message): void {
    if (!Notification.isSupported()) {
      console.log('Notifications are not supported on this system');
      return;
    }

    const notification = new Notification({
      title: message.title,
      body: message.body,
      icon: path.join(__dirname, '../assets/icon.png'),
      urgency: message.priority === 'high' ? 'critical' : 'normal'
    });

    notification.on('click', () => {
      this.openMessageWindow(message);
    });

    notification.show();
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

    // Handle show all messages
    ipcMain.on('show-messages', (): void => {
      this.openMessageWindow();
    });
  }
}

// Create the app instance
new NotificationApp();
