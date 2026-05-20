const tabs = root.querySelectorAll('.menu-tabs .tab');
const panes = root.querySelectorAll('.tab-pane');
const tabMap = new Map();
const paneMap = new Map();
tabs.forEach(t => tabMap.set(t, t.dataset.target));
panes.forEach(p => paneMap.set(p.id, p));
let _activeTab = root.querySelector('.menu-tabs .tab.active');
let _activePane = root.querySelector('.tab-pane.active');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        if (_activeTab === tab) return;
        _activeTab?.classList.remove('active');
        _activePane?.classList.remove('active');
        tab.classList.add('active');
        const pane = paneMap.get(tabMap.get(tab));
        pane?.classList.add('active');
        _activeTab = tab;
        _activePane = pane;
    });
});
if (!window.api) return;
window.api.getSettings().then(settings => {
    const $ = id => root.getElementById(id);
    const updateSliderBg = el => {
        const pct = ((el.value - (el.min || 0)) / ((el.max || 100) - (el.min || 0))) * 100;
        el.style.background = `linear-gradient(to right, var(--accent) ${pct}%, var(--bg1) ${pct}%)`;
    };
    const showContainers = (val, urlId, codeId) => {
        const u = $(urlId), c = $(codeId);
        if (u) u.style.display = val === 'url' ? 'flex' : 'none';
        if (c) c.style.display = val === 'code' ? 'flex' : 'none';
    };
    const updateUI = s => {
        const togglePairs = [
            ['toggle-unlimited-fps', 'unlimited fps'],
            ['toggle-start-fullscreen', 'start fullscreen'],
            ['toggle-nameless-theme', 'nameless theme'],
            ['toggle-show-rpc', 'show rpc'],
            ['toggle-rpc-match-info', 'rpc match info'],
            ['toggle-ui-animations', 'ui animations'],
            ['toggle-keystroke-overlay', 'keystroke overlay'],
            ['toggle-keystroke-edit', 'keystroke overlay edit mode'],
        ];
        for (const [id, key] of togglePairs) {
            const el = $(id);
            if (el) el.checked = !!(key === 'rpc match info' || key === 'ui animations'
                ? s[key] !== false
                : s[key]);
        }
        const inputPairs = [
            ['input-hitmarker', 'custom hitmarker'],
            ['input-killicon', 'custom kill icon'],
            ['input-custom-css-url', 'custom css url'],
            ['input-custom-css-code', 'custom css code'],
        ];
        for (const [id, key] of inputPairs) {
            const el = $(id);
            if (el) el.value = s[key] || '';
        }
        const cssMode = s['custom css mode'] || 'url';
        $('css-mode-group')?.querySelectorAll('.btn-box').forEach(b =>
            b.classList.toggle('active', b.dataset.val === cssMode));
        showContainers(cssMode, 'custom-css-url-container', 'custom-css-code-container');
        const chatMode = s['game chat'] || 'default';
        $('group-chat-mode')?.querySelectorAll('.btn-box').forEach(b =>
            b.classList.toggle('active', b.dataset.val === chatMode));
        const sliderPairs = [
            ['input-ui-opacity', 'val-ui-opacity', 'in-game ui opacity'],
            ['input-ui-scale', 'val-ui-scale', 'in-game ui scale'],
        ];
        for (const [iId, vId, key] of sliderPairs) {
            const input = $(iId), valEl = $(vId);
            if (!input || !valEl) continue;
            input.value = s[key] ?? 100;
            valEl.textContent = input.value;
            updateSliderBg(input);
        }
        const kPairs = [
            ['input-keystroke-x', 'keystroke overlay x'],
            ['input-keystroke-y', 'keystroke overlay y'],
        ];
        for (const [id, key] of kPairs) {
            const el = $(id);
            if (el) el.value = s[key] ?? 0;
        }
        root.querySelectorAll('.hotkey-value').forEach(el => {
            const key = el.dataset.keybind;
            if (key && s.keybinds?.[key]) el.textContent = s.keybinds[key].replace(/Key|Digit/g, '');
        });
    };
    updateUI(settings);
    const bindToggle = (id, key) =>
        $(id)?.addEventListener('change', e => window.api.updateSetting(key, e.target.checked));
    [
        ['toggle-unlimited-fps', 'unlimited fps'],
        ['toggle-start-fullscreen', 'start fullscreen'],
        ['toggle-nameless-theme', 'nameless theme'],
        ['toggle-show-rpc', 'show rpc'],
        ['toggle-rpc-match-info', 'rpc match info'],
        ['toggle-ui-animations', 'ui animations'],
        ['toggle-keystroke-overlay', 'keystroke overlay'],
        ['toggle-keystroke-edit', 'keystroke overlay edit mode'],
    ].forEach(([id, key]) => bindToggle(id, key));
    const bindInput = (id, key) =>
        $(id)?.addEventListener('input', e => window.api.updateSetting(key, e.target.value));
    bindInput('input-hitmarker', 'custom hitmarker');
    bindInput('input-killicon', 'custom kill icon');
    const themeToggle = $('toggle-nameless-theme');
    const checkDisableNamelessTheme = () => {
        const mode = $('css-mode-group')?.querySelector('.btn-box.active')?.dataset.val || 'url';
        const hasVal = mode === 'code'
            ? $('input-custom-css-code')?.value.trim()
            : $('input-custom-css-url')?.value.trim();
        if (hasVal) { themeToggle.checked = false; window.api.updateSetting('nameless theme', false); }
    };
    ['input-custom-css-url', 'input-custom-css-code'].forEach(id => {
        const key = id === 'input-custom-css-url' ? 'custom css url' : 'custom css code';
        $(id)?.addEventListener('input', e => {
            settings[key] = e.target.value;
            window.api.updateSetting(key, e.target.value);
            checkDisableNamelessTheme();
        });
    });
    const bindButtonGroup = (groupId, onSelect) => {
        const group = $(groupId);
        if (!group) return;
        const boxes = group.querySelectorAll('.btn-box');
        boxes.forEach(box => box.addEventListener('click', () => {
            boxes.forEach(b => b.classList.remove('active'));
            box.classList.add('active');
            onSelect(box.dataset.val);
        }));
    };
    bindButtonGroup('css-mode-group', val => {
        settings['custom css mode'] = val;
        window.api.updateSetting('custom css mode', val);
        showContainers(val, 'custom-css-url-container', 'custom-css-code-container');
        checkDisableNamelessTheme();
    });
    bindButtonGroup('group-chat-mode', val => window.api.updateSetting('game chat', val));
    const bindSlider = (inputId, valId, key) => {
        const input = $(inputId), valEl = $(valId);
        if (!input || !valEl) return;
        input.addEventListener('input', e => {
            valEl.textContent = e.target.value;
            updateSliderBg(e.target);
            window.api.updateSetting(key, parseInt(e.target.value, 10));
        });
    };
    bindSlider('input-ui-opacity', 'val-ui-opacity', 'in-game ui opacity');
    bindSlider('input-ui-scale', 'val-ui-scale', 'in-game ui scale');
    const sanitizeInt = val => {
        const neg = val.startsWith('-');
        return (neg ? '-' : '') + val.replace(/[^0-9]/g, '');
    };
    const bindIntInput = (id, key) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('input', e => {
            e.target.value = sanitizeInt(e.target.value);
            const v = parseInt(e.target.value, 10);
            window.api.updateSetting(key, isNaN(v) ? 0 : v);
        });
        el.addEventListener('change', e => {
            const v = parseInt(e.target.value, 10) || 0;
            e.target.value = v;
            window.api.updateSetting(key, v);
        });
    };
    bindIntInput('input-keystroke-x', 'keystroke overlay x');
    bindIntInput('input-keystroke-y', 'keystroke overlay y');
    const buildCombo = e => window.api.buildCombo(e.ctrlKey, e.shiftKey, e.altKey, e.code);
    root.querySelectorAll('.hotkey-value').forEach(el => {
        el.addEventListener('click', () => {
            el.textContent = 'Listening...';
            el.style.opacity = '0.7';
            const handler = e => {
                e.preventDefault();
                e.stopPropagation();
                const combo = buildCombo(e);
                if (!settings.keybinds) settings.keybinds = {};
                settings.keybinds[el.dataset.keybind] = combo;
                window.api.updateSetting('keybinds', settings.keybinds);
                el.textContent = combo.replace(/Key|Digit/g, '');
                el.style.opacity = '1';
                document.removeEventListener('keydown', handler, true);
            };
            document.addEventListener('keydown', handler, true);
        });
    });
    const resetBtn = $('btn-reset-settings');
    let undoTimeout = null, countdownInterval = null, backupSettings = null;
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (resetBtn.classList.contains('undo-mode')) {
                clearTimeout(undoTimeout);
                clearInterval(countdownInterval);
                resetBtn.classList.remove('undo-mode');
                resetBtn.textContent = 'Reset';
                if (backupSettings) {
                    const defaults = window.api.getDefaults();
                    for (const k in settings) delete settings[k];
                    Object.assign(settings, backupSettings);
                    if (defaults.keybinds) {
                        settings.keybinds = { ...defaults.keybinds, ...(backupSettings.keybinds || {}) };
                    }
                    await window.api.updateSettingsBulk(settings).catch(err => console.error('Failed to restore settings:', err));
                    updateUI(settings);
                    backupSettings = null;
                }
            } else {
                backupSettings = JSON.parse(JSON.stringify(settings));
                const defaults = window.api.getDefaults();
                for (const k in settings) delete settings[k];
                Object.assign(settings, defaults);
                await window.api.updateSettingsBulk(settings).catch(err => console.error('Failed to reset settings:', err));
                updateUI(settings);
                resetBtn.classList.add('undo-mode');
                let timeLeft = 3;
                resetBtn.textContent = `Undo (${timeLeft}s)`;
                countdownInterval = setInterval(() => {
                    resetBtn.textContent = `Undo (${--timeLeft}s)`;
                    if (timeLeft <= 0) clearInterval(countdownInterval);
                }, 1000);
                undoTimeout = setTimeout(() => {
                    resetBtn.classList.remove('undo-mode');
                    resetBtn.textContent = 'Reset';
                    backupSettings = null;
                }, 3000);
            }
        });
    }
    root.querySelectorAll('.plugin-dropdown-toggle').forEach(el => {
        el.addEventListener('click', () => {
            const target = $(el.dataset.target);
            if (!target) return;
            const isOpen = target.style.display !== 'none' && target.style.display !== '';
            target.style.display = isOpen ? 'none' : 'block';
            el.classList.toggle('open', !isOpen);
        });
    });
    bindButtonGroup('plugin-script-mode-group', val =>
        showContainers(val, 'plugin-script-url-container', 'plugin-script-code-container'));
    const renderPluginScripts = () => {
        const list = $('manage-scripts-list');
        if (!list) return;
        while (list.firstChild) list.removeChild(list.firstChild);
        const scripts = settings['custom scripts'] || [];
        if (scripts.length === 0) return;
        const frag = document.createDocumentFragment();
        scripts.forEach((script, idx) => {
            const item = document.createElement('div');
            item.className = 'plugin-script-item';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'setting-label';
            nameSpan.textContent = script.name || `Script ${idx + 1}`;
            const controls = document.createElement('div');
            controls.style.cssText = 'display:flex;align-items:center;gap:8px;';
            const delBtn = document.createElement('button');
            delBtn.className = 'plugin-btn-remove';
            delBtn.textContent = 'Remove';
            const label = document.createElement('label');
            label.className = 'toggle-switch';
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = !!script.enabled;
            const sliderSpan = document.createElement('span');
            sliderSpan.className = 'slider';
            label.appendChild(chk);
            label.appendChild(sliderSpan);
            controls.appendChild(delBtn);
            controls.appendChild(label);
            item.appendChild(nameSpan);
            item.appendChild(controls);
            let undoTimer = null, countdownTimer = null;
            delBtn.addEventListener('click', () => {
                if (delBtn.classList.contains('undo-mode')) {
                    clearTimeout(undoTimer);
                    clearInterval(countdownTimer);
                    delBtn.classList.remove('undo-mode');
                    delBtn.textContent = 'Remove';
                } else {
                    delBtn.classList.add('undo-mode');
                    let t = 3;
                    delBtn.textContent = `Undo (${t}s)`;
                    countdownTimer = setInterval(() => {
                        delBtn.textContent = `Undo (${--t}s)`;
                        if (t <= 0) clearInterval(countdownTimer);
                    }, 1000);
                    undoTimer = setTimeout(() => {
                        const i = settings['custom scripts'].indexOf(script);
                        if (i !== -1) {
                            settings['custom scripts'].splice(i, 1);
                            window.api.updateSetting('custom scripts', settings['custom scripts']);
                        }
                        renderPluginScripts();
                    }, 3000);
                }
            });
            chk.addEventListener('change', e => {
                script.enabled = e.target.checked;
                window.api.updateSetting('custom scripts', settings['custom scripts']);
            });
            frag.appendChild(item);
        });
        list.appendChild(frag);
    };
    renderPluginScripts();
    $('btn-add-plugin-script')?.addEventListener('click', () => {
        const mode = $('plugin-script-mode-group')?.querySelector('.active')?.dataset.val ?? 'url';
        const nameInput = $('input-plugin-script-name');
        const name = nameInput.value.trim() || `Script ${(settings['custom scripts'] || []).length + 1}`;
        const content = (mode === 'url'
            ? $('input-plugin-script-url')
            : $('input-plugin-script-code'))?.value.trim();
        if (!content) return;
        if (!settings['custom scripts']) settings['custom scripts'] = [];
        settings['custom scripts'].push({ name, mode, content, enabled: true });
        window.api.updateSetting('custom scripts', settings['custom scripts']);
        nameInput.value = '';
        const urlEl = $('input-plugin-script-url');
        const codeEl = $('input-plugin-script-code');
        if (urlEl) urlEl.value = '';
        if (codeEl) codeEl.value = '';
        renderPluginScripts();
    });
    const searchInput = $('menu-search-input');
    if (searchInput) {
        const allItems = [...root.querySelectorAll('.setting-item')];
        const allCats = [...root.querySelectorAll('.setting-category')];
        const itemMeta = allItems.map(item => ({
            el: item,
            label: (item.querySelector('.setting-label')?.textContent || '').toLowerCase(),
            cat: item.closest('.setting-category'),
            pane: item.closest('.tab-pane'),
        }));
        const catMeta = allCats.map(cat => ({
            el: cat,
            header: (cat.querySelector('.category-header')?.textContent || '').toLowerCase(),
            items: [...cat.querySelectorAll('.setting-item')],
        }));
        const tabByPaneId = new Map();
        tabs.forEach(t => {
            const target = t.dataset.target;
            tabByPaneId.set(target, t);
        });
        const switchTab = id => {
            _activeTab?.classList.remove('active');
            _activePane?.classList.remove('active');
            const tab = tabByPaneId.get(id);
            const pane = paneMap.get(id);
            tab?.classList.add('active');
            pane?.classList.add('active');
            _activeTab = tab || null;
            _activePane = pane || null;
        };
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const q = searchInput.value.trim().toLowerCase();
                if (!q) {
                    for (const { el } of itemMeta) el.style.display = '';
                    for (const { el } of catMeta) el.style.display = '';
                    updateUI(settings);
                    return;
                }
                const matchingCats = new Set();
                for (const { el, header } of catMeta) {
                    if (header.includes(q)) matchingCats.add(el);
                }
                let bestScore = -1, bestPaneId = null;
                for (const { el, label, cat, pane } of itemMeta) {
                    let score;
                    if (cat && matchingCats.has(cat)) {
                        score = 2;
                    } else {
                        score = label === q ? 3 : label.startsWith(q) ? 2 : label.includes(q) ? 1 : -1;
                    }
                    el.style.display = score >= 0 ? '' : 'none';
                    if (score > bestScore) {
                        bestScore = score;
                        bestPaneId = pane?.id || null;
                    }
                }
                for (const { el, items } of catMeta) {
                    if (matchingCats.has(el)) {
                        el.style.display = '';
                        items.forEach(i => { i.style.display = ''; });
                    } else {
                        el.style.display = items.some(i => i.style.display !== 'none') ? '' : 'none';
                    }
                }
                const cssMode = settings['custom css mode'] || 'url';
                const pluginMode = $('plugin-script-mode-group')?.querySelector('.active')?.dataset.val ?? 'url';
                showContainers(cssMode, 'custom-css-url-container', 'custom-css-code-container');
                showContainers(pluginMode, 'plugin-script-url-container', 'plugin-script-code-container');
                if (bestPaneId) switchTab(bestPaneId);
            }, 100);
        });
    }
}).catch(err => console.error('Failed to load settings:', err));