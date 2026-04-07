// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Splash Screen Designer
// Mini Canva-style editor for branded AR loading screens
// ═══════════════════════════════════════════════════════════

Studio.Splash = {
  init() {
    const container = document.getElementById('splash-editor-container');
    if (!container) return;

    container.innerHTML = `
      <div class="sp-editor">
        <div class="sp-controls">
          <div class="sp-head">Splash Screen</div>
          <div class="sp-desc">Design the loading screen users see before AR starts</div>

          <div class="sp-field">
            <label>Title</label>
            <input class="sp-input" id="sp-title" placeholder="App name" oninput="Studio.Splash._update()">
          </div>
          <div class="sp-field">
            <label>Subtitle</label>
            <input class="sp-input" id="sp-subtitle" placeholder="Tagline or description" oninput="Studio.Splash._update()">
          </div>
          <div class="sp-field">
            <label>Logo</label>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="sp-btn" onclick="document.getElementById('sp-logo-fi').click()">Upload</button>
              <button class="sp-btn" onclick="Studio.Splash._removeLogo()">Clear</button>
              <span id="sp-logo-name" style="font-size:10px;color:var(--faint)"></span>
            </div>
            <input type="file" id="sp-logo-fi" accept="image/*" style="display:none" onchange="Studio.Splash._handleLogo(this.files[0]);this.value=''">
          </div>
          <div class="sp-field">
            <label>Colours</label>
            <div style="display:flex;gap:10px">
              <div class="sp-color-pick"><input type="color" id="sp-bg" value="#060a18" onchange="Studio.Splash._update()"><span>BG</span></div>
              <div class="sp-color-pick"><input type="color" id="sp-text" value="#e2e8f0" onchange="Studio.Splash._update()"><span>Text</span></div>
              <div class="sp-color-pick"><input type="color" id="sp-accent" value="#8b5cf6" onchange="Studio.Splash._update()"><span>Accent</span></div>
            </div>
          </div>
          <div class="sp-field">
            <label>Options</label>
            <label class="insp-check"><input type="checkbox" id="sp-spinner" checked onchange="Studio.Splash._update()"> Loading spinner</label>
            <label class="insp-check"><input type="checkbox" id="sp-gradient" onchange="Studio.Splash._update()"> Gradient background</label>
            <label class="insp-check"><input type="checkbox" id="sp-branding" checked onchange="Studio.Splash._update()"> 4E branding</label>
          </div>
          <div class="sp-field">
            <label>Quick Themes</label>
            <div class="sp-themes">
              <button onclick="Studio.Splash._theme('dark')" style="background:#060a18;color:#fff">Dark</button>
              <button onclick="Studio.Splash._theme('light')" style="background:#f8fafc;color:#1e293b">Light</button>
              <button onclick="Studio.Splash._theme('neon')" style="background:#0a0020;color:#22d3ee">Neon</button>
              <button onclick="Studio.Splash._theme('warm')" style="background:#1c0a00;color:#fb923c">Warm</button>
              <button onclick="Studio.Splash._theme('nature')" style="background:#001a0a;color:#34d399">Nature</button>
              <button onclick="Studio.Splash._theme('brand')" style="background:#0f0030;color:#a78bfa">Brand</button>
            </div>
          </div>
        </div>
        <div class="sp-preview-area">
          <div class="sp-phone">
            <div class="sp-notch"></div>
            <div class="sp-screen" id="sp-screen"></div>
          </div>
          <div class="sp-preview-label">Live preview</div>
        </div>
      </div>`;

    // Styles
    if (!document.getElementById('sp-styles')) {
      const s = document.createElement('style'); s.id = 'sp-styles';
      s.textContent = `
        .sp-editor{display:flex;gap:24px;height:100%;padding:16px;overflow-y:auto}
        .sp-controls{width:260px;flex-shrink:0}
        .sp-head{font-size:15px;font-weight:700;margin-bottom:2px}
        .sp-desc{font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.5}
        .sp-field{margin-bottom:10px}
        .sp-field label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);display:block;margin-bottom:3px}
        .sp-input{width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:4px;font-family:inherit;font-size:12px;outline:none}
        .sp-input:focus{border-color:var(--purple)}
        .sp-btn{background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:3px 8px;border-radius:3px;font-family:inherit;font-size:10px;cursor:pointer}
        .sp-btn:hover{border-color:var(--purple)}
        .sp-color-pick{display:flex;flex-direction:column;align-items:center;gap:2px}
        .sp-color-pick input{width:32px;height:24px;border:1px solid var(--border);border-radius:3px;cursor:pointer;background:none;padding:0}
        .sp-color-pick span{font-size:9px;color:var(--faint)}
        .sp-themes{display:flex;gap:4px;flex-wrap:wrap}
        .sp-themes button{padding:3px 8px;border:1px solid var(--border);border-radius:3px;font-size:9px;font-family:inherit;cursor:pointer;font-weight:600}
        .sp-themes button:hover{transform:scale(1.05);border-color:var(--purple)}
        .sp-preview-area{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .sp-phone{width:240px;height:440px;background:#111;border-radius:24px;padding:6px;position:relative;box-shadow:0 6px 24px rgba(0,0,0,.4)}
        .sp-notch{width:100px;height:16px;background:#111;border-radius:0 0 10px 10px;position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:2}
        .sp-screen{width:100%;height:100%;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;transition:background .3s}
        .sp-preview-label{font-size:10px;color:var(--faint);margin-top:8px}
        @keyframes sp-spin{to{transform:rotate(360deg)}}
      `;
      document.head.appendChild(s);
    }

    Studio.EventBus.on('project:loaded', () => this._sync());
    Studio.EventBus.on('project:reset', () => this._sync());
    Studio.EventBus.on('tab:switched', ({ tab }) => { if (tab === 'splash') this._render(); });

    this._sync();
    Studio.log('Splash module ready');
  },

  _themes: {
    dark:   { bgColor:'#060a18', textColor:'#e2e8f0', accentColor:'#8b5cf6' },
    light:  { bgColor:'#f8fafc', textColor:'#1e293b', accentColor:'#6366f1' },
    neon:   { bgColor:'#0a0020', textColor:'#22d3ee', accentColor:'#8b5cf6' },
    warm:   { bgColor:'#1c0a00', textColor:'#fb923c', accentColor:'#f59e0b' },
    nature: { bgColor:'#001a0a', textColor:'#34d399', accentColor:'#10b981' },
    brand:  { bgColor:'#0f0030', textColor:'#a78bfa', accentColor:'#8b5cf6' },
  },

  _theme(name) {
    const t = this._themes[name]; if (!t) return;
    Object.assign(Studio.Project.state.splash, t);
    document.getElementById('sp-bg').value = t.bgColor;
    document.getElementById('sp-text').value = t.textColor;
    document.getElementById('sp-accent').value = t.accentColor;
    Studio.Project.markDirty();
    this._render();
  },

  _handleLogo(file) {
    if (!file) return;
    const sp = Studio.Project.state.splash;
    sp.logoFile = file;
    sp._blobUrl = URL.createObjectURL(file);
    document.getElementById('sp-logo-name').textContent = file.name;
    Studio.Project.markDirty();
    this._render();
  },

  _removeLogo() {
    const sp = Studio.Project.state.splash;
    sp.logoFile = null; sp._blobUrl = null; sp.logoUrl = '';
    document.getElementById('sp-logo-name').textContent = '';
    Studio.Project.markDirty();
    this._render();
  },

  _update() {
    const sp = Studio.Project.state.splash;
    sp.title = document.getElementById('sp-title')?.value || '';
    sp.subtitle = document.getElementById('sp-subtitle')?.value || '';
    sp.bgColor = document.getElementById('sp-bg')?.value || '#060a18';
    sp.textColor = document.getElementById('sp-text')?.value || '#e2e8f0';
    sp.accentColor = document.getElementById('sp-accent')?.value || '#8b5cf6';
    sp.showSpinner = document.getElementById('sp-spinner')?.checked;
    sp.gradient = document.getElementById('sp-gradient')?.checked;
    sp.showBranding = document.getElementById('sp-branding')?.checked;
    Studio.Project.markDirty();
    this._render();
  },

  _sync() {
    const sp = Studio.Project.state.splash;
    const el = id => document.getElementById(id);
    if (el('sp-title')) el('sp-title').value = sp.title || '';
    if (el('sp-subtitle')) el('sp-subtitle').value = sp.subtitle || '';
    if (el('sp-bg')) el('sp-bg').value = sp.bgColor || '#060a18';
    if (el('sp-text')) el('sp-text').value = sp.textColor || '#e2e8f0';
    if (el('sp-accent')) el('sp-accent').value = sp.accentColor || '#8b5cf6';
    if (el('sp-spinner')) el('sp-spinner').checked = sp.showSpinner !== false;
    if (el('sp-gradient')) el('sp-gradient').checked = !!sp.gradient;
    if (el('sp-branding')) el('sp-branding').checked = sp.showBranding !== false;
    this._render();
  },

  _render() {
    const screen = document.getElementById('sp-screen');
    if (!screen) return;
    const sp = Studio.Project.state.splash;
    const bg = sp.bgColor || '#060a18';
    const text = sp.textColor || '#e2e8f0';
    const accent = sp.accentColor || '#8b5cf6';
    const title = sp.title || Studio.Project.state.name || 'AR Experience';
    const logo = sp._blobUrl || sp.logoUrl || '';

    screen.style.background = sp.gradient ? `linear-gradient(145deg, ${bg}, ${accent}18)` : bg;

    screen.innerHTML = `
      ${logo ? `<img src="${logo}" style="max-height:48px;max-width:120px;margin-bottom:12px;object-fit:contain">` : `<div style="font-size:36px;margin-bottom:12px;opacity:.7">◈</div>`}
      <div style="color:${text};font-size:16px;font-weight:700;font-family:'Syne',sans-serif;text-align:center;padding:0 14px;line-height:1.3">${this._esc(title)}</div>
      ${sp.subtitle ? `<div style="color:${text};opacity:.45;font-size:10px;margin-top:5px;text-align:center;padding:0 14px">${this._esc(sp.subtitle)}</div>` : ''}
      ${sp.showSpinner !== false ? `<div style="margin-top:16px;display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border:2px solid ${accent}33;border-top-color:${accent};border-radius:50%;animation:sp-spin .8s linear infinite"></div><span style="color:${text};opacity:.3;font-size:10px">Loading…</span></div>` : ''}
      ${sp.showBranding !== false ? `<div style="position:absolute;bottom:10px;font-size:8px;color:${text};opacity:.15">Powered by 4E AR Studio</div>` : ''}
    `;
  },

  _esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },

  render() { this._render(); }
};
