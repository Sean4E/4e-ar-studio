// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Splash Screen Designer
// 3-panel layout: Elements | Preview | Properties
// ═══════════════════════════════════════════════════════════

Studio.Splash = {
  init() {
    const container = document.getElementById('splash-editor-container');
    if (!container) return;

    container.innerHTML = `
      <div class="sp-layout">
        <!-- LEFT: Elements & Layers -->
        <div class="sp-left">
          <div class="sp-panel-title">Elements</div>

          <div class="sp-element">
            <input type="checkbox" id="sp-show-logo" checked onchange="Studio.Splash._update()">
            <span>🖼 Logo</span>
          </div>
          <div class="sp-element">
            <input type="checkbox" id="sp-show-title" checked onchange="Studio.Splash._update()">
            <span>📝 Title</span>
          </div>
          <div class="sp-element">
            <input type="checkbox" id="sp-show-subtitle" checked onchange="Studio.Splash._update()">
            <span>💬 Subtitle</span>
          </div>
          <div class="sp-element">
            <input type="checkbox" id="sp-spinner" checked onchange="Studio.Splash._update()">
            <span>⏳ Spinner</span>
          </div>
          <div class="sp-element">
            <input type="checkbox" id="sp-branding" checked onchange="Studio.Splash._update()">
            <span>✦ Branding</span>
          </div>

          <div class="sp-panel-title" style="margin-top:12px">Quick Themes</div>
          <div class="sp-themes-grid">
            <button onclick="Studio.Splash._theme('dark')" style="background:#060a18;color:#e2e8f0" title="Dark">Dark</button>
            <button onclick="Studio.Splash._theme('light')" style="background:#f8fafc;color:#1e293b" title="Light">Light</button>
            <button onclick="Studio.Splash._theme('neon')" style="background:#0a0020;color:#22d3ee" title="Neon">Neon</button>
            <button onclick="Studio.Splash._theme('warm')" style="background:#1c0a00;color:#fb923c" title="Warm">Warm</button>
            <button onclick="Studio.Splash._theme('nature')" style="background:#001a0a;color:#34d399" title="Nature">Nature</button>
            <button onclick="Studio.Splash._theme('brand')" style="background:#0f0030;color:#a78bfa" title="Brand">Brand</button>
          </div>
        </div>

        <!-- CENTRE: Live Preview -->
        <div class="sp-centre">
          <div class="sp-phone">
            <div class="sp-notch"></div>
            <div class="sp-screen" id="sp-screen"></div>
          </div>
          <div class="sp-preview-hint">Live preview — exactly as users see it</div>
        </div>

        <!-- RIGHT: Properties -->
        <div class="sp-right">
          <div class="sp-panel-title">Properties</div>

          <div class="sp-prop-group">
            <div class="sp-prop-label">Title</div>
            <input class="sp-prop-input" id="sp-title" placeholder="Uses project name" oninput="Studio.Splash._update()">
          </div>

          <div class="sp-prop-group">
            <div class="sp-prop-label">Subtitle</div>
            <input class="sp-prop-input" id="sp-subtitle" placeholder="Tagline or description" oninput="Studio.Splash._update()">
          </div>

          <div class="sp-prop-group">
            <div class="sp-prop-label">Logo</div>
            <div style="display:flex;gap:4px;align-items:center">
              <button class="sp-prop-btn" onclick="document.getElementById('sp-logo-fi').click()">Upload</button>
              <button class="sp-prop-btn" onclick="Studio.Splash._removeLogo()">Clear</button>
              <span id="sp-logo-name" style="font-size:9px;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px"></span>
            </div>
            <input type="file" id="sp-logo-fi" accept="image/*" style="display:none" onchange="Studio.Splash._handleLogo(this.files[0]);this.value=''">
            <button class="sp-prop-btn" style="margin-top:4px;font-size:9px;width:100%" title="Re-render the PWA / favicon / home-screen icons from the splash logo. Useful if the initial generation caught GitHub Pages before the logo had propagated." onclick="Studio.Splash._regenIcons()">↻ Regenerate app icons</button>
          </div>

          <div class="sp-prop-group">
            <div class="sp-prop-label" title="Minimum total splash time, measured from page load. If the experience loads faster, the splash dismisses as soon as this elapses; if it loads slower, the splash hides immediately when the scene is ready.">Min Duration</div>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="range" min="0" max="10" step="0.5" value="3" id="sp-duration" oninput="Studio.Splash._update();document.getElementById('sp-dur-val').textContent=this.value+'s'" style="flex:1">
              <span id="sp-dur-val" style="font-size:10px;color:var(--muted);width:24px">3s</span>
            </div>
          </div>

          <div class="sp-prop-group">
            <div class="sp-prop-label">Colours</div>
            <div class="sp-colors-row">
              <label><input type="color" id="sp-bg" value="#060a18" onchange="Studio.Splash._update()"><span>BG</span></label>
              <label><input type="color" id="sp-text" value="#e2e8f0" onchange="Studio.Splash._update()"><span>Text</span></label>
              <label><input type="color" id="sp-accent" value="#8b5cf6" onchange="Studio.Splash._update()"><span>Accent</span></label>
            </div>
          </div>

          <div class="sp-prop-group">
            <div class="sp-prop-label">Style</div>
            <div class="sp-element">
              <input type="checkbox" id="sp-gradient" onchange="Studio.Splash._update()">
              <span>Gradient background</span>
            </div>
          </div>
        </div>
      </div>`;

    // Styles
    if (!document.getElementById('sp-styles')) {
      const s = document.createElement('style'); s.id = 'sp-styles';
      s.textContent = `
        .sp-layout{display:flex;height:100%;overflow:hidden}
        .sp-left,.sp-right{width:200px;flex-shrink:0;padding:10px;overflow-y:auto;border-right:1px solid var(--border)}
        .sp-right{border-right:none;border-left:1px solid var(--border)}
        .sp-centre{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;background:var(--bg)}
        .sp-panel-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px}
        .sp-element{display:flex;align-items:center;gap:7px;padding:5px 6px;border-radius:5px;font-size:11px;color:var(--text2);cursor:pointer;transition:background .12s}
        .sp-element:hover{background:var(--bg3)}
        .sp-themes-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px}
        .sp-themes-grid button{padding:4px;border:1px solid var(--border);border-radius:4px;font-size:9px;font-family:inherit;cursor:pointer;font-weight:600;transition:all .12s}
        .sp-themes-grid button:hover{border-color:var(--purple);transform:scale(1.03)}
        .sp-phone{width:220px;height:400px;background:#111;border-radius:22px;padding:5px;position:relative;box-shadow:0 6px 24px rgba(0,0,0,.4)}
        .sp-notch{width:90px;height:14px;background:#111;border-radius:0 0 8px 8px;position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:2}
        .sp-screen{width:100%;height:100%;border-radius:17px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;transition:background .3s}
        .sp-preview-hint{font-size:9px;color:var(--faint);margin-top:6px}
        .sp-prop-group{margin-bottom:10px}
        .sp-prop-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:3px}
        .sp-prop-input{width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:4px;font-family:inherit;font-size:11px;outline:none}
        .sp-prop-input:focus{border-color:var(--purple)}
        .sp-prop-btn{background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:3px 8px;border-radius:3px;font-family:inherit;font-size:10px;cursor:pointer}
        .sp-prop-btn:hover{border-color:var(--purple)}
        .sp-colors-row{display:flex;gap:8px}
        .sp-colors-row label{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer}
        .sp-colors-row input[type=color]{width:30px;height:22px;border:1px solid var(--border);border-radius:3px;cursor:pointer;background:none;padding:0}
        .sp-colors-row span{font-size:8px;color:var(--faint)}
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

  // Force a fresh render + upload of PWA/favicon/home-screen icons.
  // Useful when the first save hit the GitHub Pages propagation window
  // and baked the procedural "4E" fallback into the project's icons.
  async _regenIcons() {
    const state = Studio.Project.state;
    if (!state.id) { Studio.toast('Save the project once first', 'warn'); return; }
    const gh = Studio.GitHub.getConfig();
    if (!gh.token) { Studio.toast('GitHub token not set', 'err'); return; }
    // Drop both caches (in-memory and persisted) so uploadIcons regenerates
    if (state.pwa) state.pwa.sourceKey = '';
    if (Studio.PWA) Studio.PWA._sourceKey = '';
    Studio.toast('Regenerating icons…', 'ok');
    try {
      await Studio.PWA.uploadIcons('assets/' + state.id);
      Studio.Project.markDirty();
      await Studio.saveProject();
      Studio.toast('App icons regenerated ✓', 'ok');
    } catch(e) {
      Studio.toast('Regenerate failed: ' + e.message, 'err');
    }
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
    sp.showLogo = document.getElementById('sp-show-logo')?.checked;
    sp.showTitle = document.getElementById('sp-show-title')?.checked;
    sp.showSubtitle = document.getElementById('sp-show-subtitle')?.checked;
    sp.duration = parseFloat(document.getElementById('sp-duration')?.value) || 3;
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
    if (el('sp-show-logo')) el('sp-show-logo').checked = sp.showLogo !== false;
    if (el('sp-show-title')) el('sp-show-title').checked = sp.showTitle !== false;
    if (el('sp-show-subtitle')) el('sp-show-subtitle').checked = sp.showSubtitle !== false;
    if (el('sp-duration')) { el('sp-duration').value = sp.duration || 3; if (el('sp-dur-val')) el('sp-dur-val').textContent = (sp.duration || 3) + 's'; }
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

    // Gradient uses opaque color-mix so designer preview matches the
    // published player (transparent gradients were letting the camera
    // feed bleed through on device)
    screen.style.background = sp.gradient
      ? `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 72%, ${accent}))`
      : bg;

    let html = '';
    if (sp.showLogo !== false) {
      html += logo
        ? `<img src="${logo}" style="max-height:44px;max-width:110px;margin-bottom:10px;object-fit:contain">`
        : `<img src="../samples/logo_WHT.png" style="max-height:30px;margin-bottom:10px;opacity:.7" onerror="this.outerHTML='<div style=font-size:32px;margin-bottom:10px;opacity:.7>&#9670;</div>'">`;
    }
    if (sp.showTitle !== false) {
      html += `<div style="color:${text};font-size:15px;font-weight:700;font-family:'Syne',sans-serif;text-align:center;padding:0 12px;line-height:1.3">${this._esc(title)}</div>`;
    }
    if (sp.showSubtitle !== false && sp.subtitle) {
      html += `<div style="color:${text};opacity:.4;font-size:10px;margin-top:4px;text-align:center">${this._esc(sp.subtitle)}</div>`;
    }
    if (sp.showSpinner !== false) {
      html += `<div style="margin-top:16px;display:flex;align-items:center;gap:5px"><div style="width:13px;height:13px;border:2px solid ${accent}33;border-top-color:${accent};border-radius:50%;animation:sp-spin .8s linear infinite"></div><span style="color:${text};opacity:.25;font-size:9px">Loading…</span></div>`;
    }
    if (sp.showBranding !== false) {
      html += `<div style="position:absolute;bottom:10px;font-size:7px;color:${text};opacity:.12">Powered by 4E AR Studio</div>`;
    }
    screen.innerHTML = html;
  },

  _esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },
  render() { this._render(); }
};
