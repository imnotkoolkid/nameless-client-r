const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const GPU_SWITCHES = [
    'disable-frame-rate-limit', 'ignore-gpu-blacklist',
    'enable-gpu-rasterization', 'force_high_performance_gpu', 'enable-zero-copy',
    ['enable-features', 'CanvasOopRasterization,UseSkiaRenderer'],
    'disable-renderer-backgrounding', 'disable-background-timer-throttling'
];
class SettingsManager {
    constructor() {
        this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
        this.defaultSettingsPath = path.join(__dirname, '..', 'assets', 'default.json');
        this.settings = {};
        this.saveTimeout = null;
    }
    scheduleSave() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            const json = JSON.stringify(this.settings, null, 2);
            fs.promises.writeFile(this.settingsPath, json)
                .catch(err => console.error('Failed to save settings:', err));
        }, 150);
    }
    init() {
        let defaults = {};
        try {
            defaults = JSON.parse(fs.readFileSync(this.defaultSettingsPath, 'utf8'));
        } catch (e) {
            console.error('Error reading default.json', e);
        }
        try {
            if (fs.existsSync(this.settingsPath)) {
                const saved = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
                this.settings = { ...defaults, ...saved };
                if (defaults.keybinds) {
                    this.settings.keybinds = { ...defaults.keybinds, ...(saved.keybinds || {}) };
                }
            } else {
                this.settings = defaults;
                this.scheduleSave();
            }
        } catch (e) {
            console.error('Error loading settings', e);
            this.settings = defaults.unlimited !== undefined ? defaults
                : { 'unlimited fps': true, 'start fullscreen': true };
            this.scheduleSave();
        }
        if (this.settings['unlimited fps']) {
            if (app.isReady()) console.warn('SettingsManager.init() called after app is ready! GPU switches ignored.');
            for (const sw of GPU_SWITCHES) {
                Array.isArray(sw) ? app.commandLine.appendSwitch(...sw) : app.commandLine.appendSwitch(sw);
            }
            if (process.platform === 'win32') {
                exec(
                    `reg add "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences" /v "${process.execPath}" /t REG_SZ /d "GpuPreference=2;" /f`,
                    err => { if (err) console.error('Failed to set high performance GPU preference:', err); }
                );
            }
        } else if (process.platform === 'win32') {
            exec(`reg delete "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences" /v "${process.execPath}" /f`, () => { });
        }
        ipcMain.removeHandler('get-settings');
        ipcMain.handle('get-settings', () => this.settings);
        ipcMain.removeHandler('update-setting');
        ipcMain.handle('update-setting', (_, key, value) => {
            try {
                this.settings[key] = value;
                this.scheduleSave();
                return { success: true };
            } catch (err) {
                console.error('Failed to update setting', err);
                return { success: false, error: err.message };
            }
        });
        ipcMain.removeHandler('update-settings-bulk');
        ipcMain.handle('update-settings-bulk', (_, newSettings) => {
            try {
                Object.keys(this.settings).forEach(k => delete this.settings[k]);
                Object.assign(this.settings, newSettings);
                this.scheduleSave();
                return { success: true };
            } catch (err) {
                console.error('Failed to bulk update settings', err);
                return { success: false, error: err.message };
            }
        });
    }
    get(key) { return this.settings[key]; }
}
module.exports = new SettingsManager();