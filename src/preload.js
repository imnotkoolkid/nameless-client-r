const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
let currentSettings = {};
const assetCache = new Map();
function getAssetSync(assetPath, encoding) {
    const key = `${assetPath}_${encoding || 'utf8'}`;
    if (assetCache.has(key)) return assetCache.get(key);
    try {
        const data = fs.readFileSync(assetPath, encoding === 'base64' ? { encoding: 'base64' } : 'utf8');
        assetCache.set(key, data);
        return data;
    } catch {
        return null;
    }
}
async function getAsset(assetPath, encoding) {
    return getAssetSync(assetPath, encoding);
}
const _styleEls = {};
function getOrCreate(id, tag = 'style') {
    if (_styleEls[id]) return _styleEls[id];
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement(tag);
        el.id = id;
        document.head.appendChild(el);
    }
    _styleEls[id] = el;
    return el;
}
function applyTheme(isNameless, customCssUrl, customCssMode, customCssCode) {
    const customEl = getOrCreate('nameless-custom-css');
    if (customCssMode === 'code') {
        delete customEl.dataset.url;
        customEl.textContent = customCssCode || '';
    } else {
        if (customCssUrl?.trim()) {
            if (customEl.dataset.url !== customCssUrl) {
                customEl.dataset.url = customCssUrl;
                ipcRenderer.invoke('fetch-resource', customCssUrl).then(css => {
                    if (customEl.dataset.url === customCssUrl) customEl.textContent = css;
                });
            }
        } else {
            customEl.textContent = '';
            delete customEl.dataset.url;
        }
    }
    if (isNameless) {
        if (!document.getElementById('nameless-theme-css')) {
            const themePath = path.join(__dirname, 'assets', 'css', 'nameless.css');
            const css = getAssetSync(themePath);
            if (css) {
                const el = document.createElement('style');
                el.id = 'nameless-theme-css';
                el.textContent = css;
                document.head.appendChild(el);
                _styleEls['nameless-theme-css'] = el;
            }
        }
    } else {
        const el = document.getElementById('nameless-theme-css');
        if (el) {
            el.remove();
            delete _styleEls['nameless-theme-css'];
        }
    }
}
function applyUIScaleAndOpacity(opacity = 100, scale = 100) {
    let css = '';
    if (opacity !== 100) css += `opacity: ${opacity}% !important; `;
    if (scale !== 100) css += `transform: scale(${scale / 100}) !important; `;
    getOrCreate('nameless-ui-scale-opacity').textContent =
        css ? `.team-score, .desktop-game-interface { ${css} }` : '';
}
function applyGameChat(chatMode) {
    const css = chatMode === 'simplified'
        ? `#bottom-left .chat .input-wrapper input { opacity: 0 !important; margin: 0 !important; }
           #bottom-left .chat .input-wrapper input:focus { opacity: 1 !important; }
           #bottom-left .chat .messages.messages-cont { background-color: #fff0 !important; overflow: hidden !important; word-break: break-word !important; }
           .desktop-game-interface .chat>.info, .desktop-game-interface .chat .info-key-cont.enter { display: none !important; }`
        : chatMode === 'hidden'
            ? `#bottom-left .chat .input-wrapper input, #bottom-left .chat .messages.messages-cont, .desktop-game-interface .chat>.info, .desktop-game-interface .chat .info-key-cont.enter { display: none !important; }`
            : '';
    getOrCreate('nameless-game-chat').textContent = css;
}
function applyGameCustomizations(hitmarker, killicon) {
    let css = '';
    window._customHitmarkerLink = hitmarker?.trim() || null;
    if (window._customHitmarkerLink) {
        css += `.hitmark { background: url("${window._customHitmarkerLink}") center / contain no-repeat !important; object-position: -99999px 99999px !important; }\n`;
        if (!window._hitmarkObserver) {
            window._hitmarkObserver = new MutationObserver(mutations => {
                if (!window._customHitmarkerLink) return;
                for (const mut of mutations) {
                    if (mut.type === 'attributes') {
                        const t = mut.target;
                        if (t.classList.contains('hitmark') && t.src !== window._customHitmarkerLink) {
                            t.src = window._customHitmarkerLink;
                        }
                    } else if (mut.type === 'childList') {
                        for (const node of mut.addedNodes) {
                            if (node.nodeType !== 1) continue;
                            if (node.classList.contains('hitmark')) {
                                if (node.src !== window._customHitmarkerLink) node.src = window._customHitmarkerLink;
                            } else if (node.querySelectorAll) {
                                const marks = node.querySelectorAll('.hitmark');
                                for (let i = 0; i < marks.length; i++) {
                                    if (marks[i].src !== window._customHitmarkerLink) marks[i].src = window._customHitmarkerLink;
                                }
                            }
                        }
                    }
                }
            });
            window._hitmarkObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src'],
            });
        }
    } else {
        if (window._hitmarkObserver) {
            window._hitmarkObserver.disconnect();
            window._hitmarkObserver = null;
        }
    }
    if (killicon?.trim()) {
        css += `.animate-cont::before { content: ""; background: url("${killicon.trim()}") center / contain no-repeat; width: 10rem; height: 10rem; margin-bottom: 2rem; display: inline-block; }\n.animate-cont svg { display: none !important; }\n`;
    }
    getOrCreate('nameless-game-customizations').textContent = css;
}
function applyUIAnimations(enabled) {
    if (!enabled) {
        getOrCreate('nameless-ui-animations').textContent = '* { transition: none !important; animation: none !important; }';
    } else {
        const el = document.getElementById('nameless-ui-animations');
        if (el) {
            el.remove();
            delete _styleEls['nameless-ui-animations'];
        }
    }
}
function buildCombo(e) {
    const parts = [];
    if (e.ctrlKey && !['ControlLeft', 'ControlRight'].includes(e.code)) parts.push('Ctrl');
    if (e.shiftKey && !['ShiftLeft', 'ShiftRight'].includes(e.code)) parts.push('Shift');
    if (e.altKey && !['AltLeft', 'AltRight'].includes(e.code)) parts.push('Alt');
    parts.push(e.code);
    return parts.join('+');
}
if (!window._namelessInjectedScripts) window._namelessInjectedScripts = new Set();
function applyCustomScripts(scripts) {
    if (!scripts || !Array.isArray(scripts)) return;
    for (const script of scripts) {
        if (!script.enabled) continue;
        const scriptKey = `${script.mode}:${script.content}`;
        if (window._namelessInjectedScripts.has(scriptKey)) continue;
        window._namelessInjectedScripts.add(scriptKey);
        if (script.mode === 'code') {
            const el = document.createElement('script');
            el.textContent = script.content;
            document.head.appendChild(el);
        } else if (script.mode === 'url' && script.content) {
            ipcRenderer.invoke('fetch-resource', script.content).then(jsCode => {
                if (jsCode) {
                    const el = document.createElement('script');
                    el.textContent = jsCode;
                    document.head.appendChild(el);
                }
            }).catch(console.error);
        }
    }
}
let _keystrokeHost = null;
let _keystrokeKeyMap = null;
function _buildKeyMap(shadow) {
    _keystrokeKeyMap = new Map();
    shadow.querySelectorAll('.nlc-key-default[data-code]').forEach(el => {
        _keystrokeKeyMap.set(el.getAttribute('data-code'), el);
    });
}
async function applyKeystrokeOverlay(enabled, editMode, xOffset, yOffset, removedKeys) {
    if (!enabled) {
        _keystrokeHost?.remove();
        _keystrokeHost = null;
        _keystrokeKeyMap = null;
        return;
    }
    if (!_keystrokeHost) {
        const overlayHtmlPath = path.join(__dirname, 'assets', 'html', 'keystrokeOverlay.html');
        const fontPath = path.join(__dirname, 'assets', 'font', 'forza.ttf');
        const overlayHtml = getAssetSync(overlayHtmlPath);
        const fontBase64 = getAssetSync(fontPath, 'base64');
        if (!overlayHtml) return;
        _keystrokeHost = Object.assign(document.createElement('div'), { id: 'nameless-keystroke-host' });
        _keystrokeHost.style.cssText = 'position:fixed;z-index:99998;pointer-events:none;top:0;left:0;';
        const shadow = _keystrokeHost.attachShadow({ mode: 'open' });
        let fontFaceCSS = '';
        if (fontBase64) {
            fontFaceCSS = `@font-face { font-family: 'forza'; src: url('data:font/ttf;base64,${fontBase64}') format('truetype'); }`;
        }
        const baseStyle = document.createElement('style');
        baseStyle.textContent = `${fontFaceCSS}
            :host { all: initial; }
            * { box-sizing: border-box; font-family: 'forza', sans-serif !important; }
            #nlc-overlay-wrapper { position: fixed; top: 0; left: 0; pointer-events: none; }
            #nlc-overlay-wrapper.edit-mode { pointer-events: all; cursor: default; }
            .nlc-key-default.nlc-key-active { color: black !important; background: white !important; border-color: white !important; }`;
        shadow.appendChild(baseStyle);
        const wrapper = document.createElement('div');
        wrapper.id = 'nlc-overlay-wrapper';
        wrapper.innerHTML = overlayHtml;
        shadow.appendChild(wrapper);
        _buildKeyMap(shadow);
        wrapper.querySelector('#keys-overlay')?.addEventListener('click', e => {
            const wrap = shadow.getElementById('nlc-overlay-wrapper');
            if (!wrap?.classList.contains('edit-mode')) return;
            const keyEl = e.target.closest('.nlc-key-default[data-code]');
            if (!keyEl) return;
            const code = keyEl.getAttribute('data-code');
            let rKeys = currentSettings['keystroke overlay removed keys'] || [];
            if (rKeys.includes(code)) {
                rKeys = rKeys.filter(k => k !== code);
                keyEl.classList.remove('nlc-key-disabled');
            } else {
                rKeys.push(code);
                keyEl.classList.add('nlc-key-disabled');
            }
            currentSettings['keystroke overlay removed keys'] = rKeys;
            ipcRenderer.invoke('update-setting', 'keystroke overlay removed keys', rKeys);
            reapplyKeystroke();
        });
        document.body.appendChild(_keystrokeHost);
    }
    const shadow = _keystrokeHost.shadowRoot;
    const wrapper = shadow.getElementById('nlc-overlay-wrapper');
    const keysOverlay = shadow.getElementById('keys-overlay');
    if (!wrapper || !keysOverlay) return;
    wrapper.style.top = `${Number(yOffset) || 0}px`;
    wrapper.style.left = `${Number(xOffset) || 0}px`;
    const rKeys = removedKeys || [];
    if (_keystrokeKeyMap) {
        _keystrokeKeyMap.forEach((el, code) => {
            el.classList.toggle('nlc-key-disabled', rKeys.includes(code));
        });
    } else {
        keysOverlay.querySelectorAll('.nlc-key-default[data-code]').forEach(el => {
            el.classList.toggle('nlc-key-disabled', rKeys.includes(el.getAttribute('data-code')));
        });
    }
    keysOverlay.classList.toggle('edit', !!editMode);
    wrapper.classList.toggle('edit-mode', !!editMode);
}
function highlightKeystrokeKey(code, active) {
    _keystrokeKeyMap?.get(code)?.classList.toggle('nlc-key-active', active);
}
const KEYSTROKE_KEYS = new Set([
    'keystroke overlay', 'keystroke overlay edit mode',
    'keystroke overlay x', 'keystroke overlay y', 'keystroke overlay removed keys'
]);
function reapplyKeystroke() {
    applyKeystrokeOverlay(
        currentSettings['keystroke overlay'],
        currentSettings['keystroke overlay edit mode'],
        currentSettings['keystroke overlay x'],
        currentSettings['keystroke overlay y'],
        currentSettings['keystroke overlay removed keys']
    );
}
function applyAllSettings(s) {
    applyTheme(s['nameless theme'], s['custom css url'], s['custom css mode'], s['custom css code']);
    applyUIScaleAndOpacity(s['in-game ui opacity'], s['in-game ui scale']);
    applyGameChat(s['game chat']);
    applyGameCustomizations(s['custom hitmarker'], s['custom kill icon']);
    applyUIAnimations(s['ui animations']);
    applyKeystrokeOverlay(
        s['keystroke overlay'], s['keystroke overlay edit mode'],
        s['keystroke overlay x'], s['keystroke overlay y'],
        s['keystroke overlay removed keys']
    );
}
contextBridge.exposeInMainWorld('api', {
    getSettings: async () => {
        currentSettings = await ipcRenderer.invoke('get-settings');
        return currentSettings;
    },
    getDefaults: () => {
        try {
            return JSON.parse(getAssetSync(path.join(__dirname, 'assets', 'default.json')));
        } catch (e) {
            console.error('Failed to read default.json', e);
            return {};
        }
    },
    updateSetting: (key, value) => {
        currentSettings[key] = value;
        if (key === 'nameless theme' || key === 'custom css url' || key === 'custom css mode' || key === 'custom css code')
            applyTheme(currentSettings['nameless theme'], currentSettings['custom css url'], currentSettings['custom css mode'], currentSettings['custom css code']);
        if (key === 'in-game ui opacity' || key === 'in-game ui scale')
            applyUIScaleAndOpacity(currentSettings['in-game ui opacity'], currentSettings['in-game ui scale']);
        if (key === 'game chat') applyGameChat(currentSettings['game chat']);
        if (key === 'custom hitmarker' || key === 'custom kill icon')
            applyGameCustomizations(currentSettings['custom hitmarker'], currentSettings['custom kill icon']);
        if (key === 'ui animations') applyUIAnimations(currentSettings['ui animations']);
        if (KEYSTROKE_KEYS.has(key)) reapplyKeystroke();
        return ipcRenderer.invoke('update-setting', key, value);
    },
    updateSettingsBulk: async (newSettings) => {
        currentSettings = { ...newSettings };
        applyAllSettings(currentSettings);
        return ipcRenderer.invoke('update-settings-bulk', newSettings);
    },
    actionFullscreen: () => ipcRenderer.send('action-fullscreen'),
    actionDevtools: () => ipcRenderer.send('action-devtools'),
    actionQuickRestart: () => ipcRenderer.send('action-quick-restart'),
    actionZoom: dir => ipcRenderer.send('action-zoom', dir),
    buildCombo: (ctrlKey, shiftKey, altKey, code) => buildCombo({ ctrlKey, shiftKey, altKey, code })
});
window.addEventListener('DOMContentLoaded', () => {
    ipcRenderer.invoke('get-settings').then(s => {
        currentSettings = s;
        applyAllSettings(s);
        applyCustomScripts(s['custom scripts']);
        const cssPath = path.join(__dirname, 'styles', 'menu.css');
        const fontPath = path.join(__dirname, 'assets', 'font', 'forza.ttf');
        const htmlPath = path.join(__dirname, 'menu.html');
        const jsPath = path.join(__dirname, 'components', 'menu.js');
        const cssContentRaw = getAssetSync(cssPath);
        const fontBase64 = getAssetSync(fontPath, 'base64');
        const htmlContent = getAssetSync(htmlPath);
        const jsContent = getAssetSync(jsPath);
        let styleEl = null;
        if (cssContentRaw) {
            let cssContent = cssContentRaw;
            if (fontBase64) {
                cssContent = cssContent.replace('../assets/font/forza.ttf', `data:font/ttf;base64,${fontBase64}`);
                if (!document.getElementById('nameless-global-font')) {
                    const globalFontEl = document.createElement('style');
                    globalFontEl.id = 'nameless-global-font';
                    globalFontEl.textContent = `@font-face { font-family: 'forza'; src: url('data:font/ttf;base64,${fontBase64}') format('truetype'); }`;
                    document.head.appendChild(globalFontEl);
                }
            }
            styleEl = document.createElement('style');
            styleEl.textContent = cssContent;
        }
        if (!htmlContent) return;
        const host = document.createElement('div');
        host.id = 'nameless-menu-host';
        host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;z-index:99999;';
        const shadowRoot = host.attachShadow({ mode: 'open' });
        if (styleEl) shadowRoot.appendChild(styleEl);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = htmlContent;
        shadowRoot.appendChild(wrapper);
        document.body.appendChild(host);
        if (jsContent) {
            const scriptEl = document.createElement('script');
            scriptEl.textContent = `(function(){const root=document.getElementById('nameless-menu-host').shadowRoot;\n${jsContent}\n})();`;
            document.body.appendChild(scriptEl);
        }
        let _menuOverlay = null;
        const getMenuOverlay = () => {
            if (!_menuOverlay) {
                _menuOverlay = document.getElementById('nameless-menu-host')?.shadowRoot?.getElementById('nameless-menu-overlay');
            }
            return _menuOverlay;
        };
        document.addEventListener('keydown', e => {
            highlightKeystrokeKey(e.code, true);
            if (e.repeat) return;
            const ae = document.activeElement;
            if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && !ae.classList.contains('setting-input')) return;
            const combo = buildCombo(e);
            const kb = currentSettings.keybinds || {};
            if (combo === kb['toggle menu']) {
                const menu = getMenuOverlay();
                if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
            } else if (combo === kb['copy url']) {
                navigator.clipboard.writeText(window.location.href);
            } else if (combo === kb['return main page']) {
                window.location.href = 'https://kirka.io';
            } else if (combo === kb['reload']) {
                location.reload();
            } else if (combo === kb['fullscreen']) {
                ipcRenderer.send('action-fullscreen');
            } else if (combo === kb['devtools']) {
                ipcRenderer.send('action-devtools');
            } else if (combo === kb['quick restart']) {
                ipcRenderer.send('action-quick-restart');
            } else if (combo === kb['zoom in']) {
                ipcRenderer.send('action-zoom', 'in');
            } else if (combo === kb['zoom out']) {
                ipcRenderer.send('action-zoom', 'out');
            } else if (combo === kb['zoom reset']) {
                ipcRenderer.send('action-zoom', 'reset');
            }
        });
        document.addEventListener('keyup', e => highlightKeystrokeKey(e.code, false));
    }).catch(e => console.error('Failed to inject Nameless menu:', e));
});