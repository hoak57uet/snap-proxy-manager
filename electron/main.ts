import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ipv6Service } from './services/ipv6Service'
import { proxyService } from './services/proxyService'
import { rotationService } from './services/rotationService'
import { configStorageService } from './services/configStorageService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Setup IPC handlers
function setupIPCHandlers() {
  // IPv6 Detection
  ipcMain.handle('ipv6:detect', async () => {
    try {
      const interfaces = await ipv6Service.detectInterfaces();
      return { success: true, data: interfaces };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ipv6:test-connectivity', async () => {
    try {
      const result = await ipv6Service.testConnectivity();
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ipv6:generate', async (_, prefixBase: string, prefix: number, count: number) => {
    try {
      const addresses: string[] = [];
      const existing = new Set<string>();
      
      for (let i = 0; i < count; i++) {
        let attempts = 0;
        while (attempts < 100) {
          const addr = ipv6Service.generateRandomIPv6(prefixBase, prefix);
          if (!existing.has(addr)) {
            addresses.push(addr);
            existing.add(addr);
            break;
          }
          attempts++;
        }
      }
      
      return { success: true, data: addresses };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ipv6:detect-lan-ip', async () => {
    try {
      const lanIp = ipv6Service.detectLanIPv4();
      return { success: true, data: lanIp };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ipv6:reset-interfaces', async (_, interfaceName: string, originalIPv6: string) => {
    try {
      const removedCount = await ipv6Service.resetIPv6Interfaces(interfaceName, originalIPv6);
      return { success: true, data: removedCount };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Proxy Management
  ipcMain.handle('proxy:start', async (_, config: {
    id: number;
    type: 'HTTP' | 'SOCKS5';
    port: number;
    ipv6: string;
    interfaceName: string;
    prefix: number;
    username?: string;
    password?: string;
  }) => {
    try {
      const proxy = await proxyService.startProxy(
        config.id,
        config.type,
        config.port,
        config.ipv6,
        config.interfaceName,
        config.prefix,
        config.username,
        config.password
      );
      // Convert to serializable format (remove ChildProcess and other non-serializable properties)
      const serializable = proxyService.toSerializableArray([proxy])[0];
      return { success: true, data: serializable };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proxy:start-multiple', async (_, configs: Array<{
    id: number;
    type: 'HTTP' | 'SOCKS5';
    port: number;
    ipv6: string;
    interfaceName: string;
    prefix: number;
    username?: string;
    password?: string;
  }>) => {
    try {
      const proxies = await proxyService.startMultipleProxies(configs);
      // Convert to serializable format (remove ChildProcess and other non-serializable properties)
      const serializable = proxyService.toSerializableArray(proxies);
      return { success: true, data: serializable };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proxy:stop', async (_, id: number) => {
    try {
      await proxyService.stopProxy(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proxy:stop-all', async () => {
    try {
      await proxyService.stopAllProxies();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proxy:get-all', async () => {
    try {
      const proxies = proxyService.getAllProxies();
      // Convert to serializable format (remove ChildProcess and other non-serializable properties)
      const serializable = proxyService.toSerializableArray(proxies);
      return { success: true, data: serializable };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proxy:health-check', async (_, id: number) => {
    try {
      // Use single health check for manual checks (no retry)
      const result = await proxyService.healthCheck(id);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proxy:get-uri', async (_, id: number) => {
    try {
      const uri = proxyService.getProxyURI(id);
      return { success: true, data: uri };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proxy:rotate', async (_, id: number, newIPv6: string, interfaceName: string, prefix: number, graceful: boolean) => {
    try {
      await proxyService.rotateProxy(id, newIPv6, interfaceName, prefix, graceful);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Rotation Management
  ipcMain.handle('rotation:set-config', async (_, config: any) => {
    try {
      await rotationService.setConfig(config);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('rotation:set-network', async (_, interfaceName: string, prefix: number, prefixBase: string) => {
    try {
      rotationService.setNetworkConfig(interfaceName, prefix, prefixBase);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('rotation:rotate-now', async () => {
    try {
      await rotationService.rotateNow();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Setup rotation callback to notify renderer
  rotationService.onRotation((proxyId, newIPv6) => {
    win?.webContents.send('rotation:completed', { proxyId, newIPv6 });
  });

  // Config Storage Management
  ipcMain.handle('config:add-proxies', async (_, configs: any[]) => {
    try {
      configStorageService.addProxyConfigs(configs);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('config:get-all', async () => {
    try {
      const configs = configStorageService.getAllProxyConfigs();
      return { success: true, data: configs };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('config:delete-all', async () => {
    try {
      configStorageService.deleteAllProxyConfigs();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('config:delete', async (_, id: number) => {
    try {
      configStorageService.deleteProxyConfig(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('config:save-network', async (_, iface: any) => {
    try {
      configStorageService.saveNetworkInterface(iface);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('config:get-network', async () => {
    try {
      const iface = configStorageService.getNetworkInterface();
      return { success: true, data: iface };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Delete all proxies (stop + remove interfaces + delete configs)
  ipcMain.handle('proxy:delete-all', async () => {
    try {
      const networkConfig = configStorageService.getNetworkInterface();
      if (networkConfig) {
        await proxyService.deleteAllProxies(networkConfig.name, networkConfig.prefix);
      } else {
        await proxyService.stopAllProxies();
      }
      configStorageService.deleteAllProxyConfigs();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', async () => {
  // Clean up
  await proxyService.stopAllProxies();
  rotationService.destroy();
})

app.whenReady().then(() => {
  setupIPCHandlers();
  createWindow();
})
