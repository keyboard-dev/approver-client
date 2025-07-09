import { Tray, Menu, nativeImage, BrowserWindow, screen, app } from 'electron';
import { Message } from './types';

export interface TrayManagerOptions {
  onToggleWindow: (bounds?: Electron.Rectangle) => void;
  onShowWindow: () => void;
  onClearAllMessages: () => void;
  onQuit: () => void;
  getMessages: () => Message[];
  getPendingCount: () => number;
}

export class TrayManager {
  private tray: Tray | null = null;
  private options: TrayManagerOptions;

  constructor(options: TrayManagerOptions) {
    this.options = options;
  }

  public createTray(): void {
    // Create tray icon
    const icon = this.createTrayIcon();
    this.tray = new Tray(icon);
    
    this.tray.setToolTip('Message Approver');
    
    // Click to toggle window
    this.tray.on('click', (event, bounds) => {
      this.options.onToggleWindow(bounds);
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
    const pendingCount = this.options.getPendingCount();
    const color = pendingCount > 0 ? [255, 59, 48, 255] : [0, 122, 255, 255];
    
    // Fill the buffer with the color
    for (let i = 0; i < canvas.length; i += 4) {
      canvas[i] = color[0];     // R
      canvas[i + 1] = color[1]; // G
      canvas[i + 2] = color[2]; // B
      canvas[i + 3] = color[3]; // A
    }
    
    return nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  private showContextMenu(): void {
    const pendingCount = this.options.getPendingCount();
    const messages = this.options.getMessages();
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Messages (${pendingCount} pending)`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show Messages',
        click: () => this.options.onShowWindow()
      },
      {
        label: 'Clear All',
        click: () => this.options.onClearAllMessages(),
        enabled: messages.length > 0
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.options.onQuit()
      }
    ]);

    this.tray?.popUpContextMenu(contextMenu);
  }

  public updateTrayIcon(): void {
    if (this.tray) {
      const icon = this.createTrayIcon();
      this.tray.setImage(icon);
      
      // Update tooltip with pending count
      const pendingCount = this.options.getPendingCount();
      const tooltip = pendingCount > 0 
        ? `Message Approver (${pendingCount} pending)`
        : 'Message Approver';
      this.tray.setToolTip(tooltip);
    }
  }

  public getBounds(): Electron.Rectangle | undefined {
    return this.tray?.getBounds();
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
} 