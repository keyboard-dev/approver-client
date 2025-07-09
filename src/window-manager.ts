import { BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { Message } from './types';

export interface WindowManagerOptions {
  onWindowClosed: () => void;
  onMessageShow: (message: Message) => void;
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private options: WindowManagerOptions;

  constructor(options: WindowManagerOptions) {
    this.options = options;
  }

  public createMainWindow(): void {
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
      this.options.onWindowClosed();
    });

    this.setupWindowControls();
  }

  public toggleWindow(bounds?: Electron.Rectangle): void {
    if (this.mainWindow?.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.showWindow(bounds);
    }
  }

  public showWindow(bounds?: Electron.Rectangle): void {
    if (!this.mainWindow) {
      this.createMainWindow();
    }

    if (this.mainWindow) {
      if (bounds) {
        this.positionWindowNearTray(bounds);
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

  private positionWindowNearTray(trayBounds: Electron.Rectangle): void {
    if (!this.mainWindow) return;

    const windowBounds = this.mainWindow.getBounds();
    
    let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
    let y = Math.round(trayBounds.y + trayBounds.height + 5);
    
    // Make sure window stays on screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    x = Math.max(0, Math.min(x, screenWidth - windowBounds.width));
    y = Math.max(0, Math.min(y, screenHeight - windowBounds.height));
    
    this.mainWindow.setPosition(x, y);
  }

  public hideWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
  }

  public isVisible(): boolean {
    return this.mainWindow?.isVisible() ?? false;
  }

  public sendMessage(channel: string, ...args: any[]): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }

  public showMessage(message: Message): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('show-message', message);
    }
  }

  private setupWindowControls(): void {
    // Handle window close
    ipcMain.handle('window-close', () => {
      this.hideWindow();
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

  public destroy(): void {
    if (this.mainWindow) {
      this.mainWindow.close();
      this.mainWindow = null;
    }
  }
} 