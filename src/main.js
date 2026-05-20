const { app, BrowserWindow, Menu, ipcMain, net } = require('electron');
const path = require('path');
const settingsManager = require('./components/settingsManager');
const drpc = require('./components/drpc');
app.setName('Nameless Client(r)');
app.setAppUserModelId('dev.imnotkoolkid.namelessclient');
settingsManager.init();
drpc.init(settingsManager.settings);
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    minWidth: 900,
    minHeight: 540,
    title: 'Nameless(r)',
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, 'assets/img/icon.png'),
    show: false,
    fullscreen: settingsManager.get('start fullscreen') === true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      spellcheck: false
    }
  });
  Menu.setApplicationMenu(null);
  mainWindow.on('page-title-updated', e => e.preventDefault());
  mainWindow.once('ready-to-show', () => {
    if (!settingsManager.get('start fullscreen')) mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.loadURL('https://kirka.io');
  const onNavigate = (_, url) => drpc.setState(url);
  mainWindow.webContents.on('did-navigate', onNavigate);
  mainWindow.webContents.on('did-navigate-in-page', onNavigate);
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomLevel(settingsManager.get('zoom level') || 0);
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}
app.whenReady().then(() => {
  createWindow();
  const fs = require('fs');
  const MAX_CACHE = 64;
  const resourceCache = new Map();
  const cacheSet = (url, body) => {
    if (resourceCache.size >= MAX_CACHE) {
      resourceCache.delete(resourceCache.keys().next().value);
    }
    resourceCache.set(url, body);
  };
  ipcMain.handle('fetch-resource', (_, url) => new Promise(resolve => {
    if (resourceCache.has(url)) return resolve(resourceCache.get(url));
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fs.readFile(url, 'utf8', (err, data) => {
        const body = err ? '' : data;
        cacheSet(url, body);
        resolve(body);
      });
      return;
    }
    try {
      const req = net.request(url);
      const chunks = [];
      req.on('response', res => {
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const body = chunks.join('');
          cacheSet(url, body);
          resolve(body);
        });
      });
      req.on('error', err => { console.error('Fetch resource error:', err); resolve(''); });
      req.end();
    } catch (err) {
      console.error('Fetch resource exception:', err);
      resolve('');
    }
  }));
  ipcMain.on('action-fullscreen', e => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.setFullScreen(!win.isFullScreen());
  });
  ipcMain.on('action-devtools', e => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.webContents.toggleDevTools();
  });
  ipcMain.on('action-quick-restart', () => { app.relaunch(); app.exit(); });
  let _zoomLevel = settingsManager.get('zoom level') || 0;
  ipcMain.on('action-zoom', (e, dir) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    if (dir === 'reset') _zoomLevel = 0;
    else if (dir === 'in') _zoomLevel += 1;
    else if (dir === 'out') _zoomLevel -= 1;
    win.webContents.setZoomLevel(_zoomLevel);
    settingsManager.settings['zoom level'] = _zoomLevel;
    settingsManager.scheduleSave();
  });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });