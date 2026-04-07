// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Preview (iframe player embed)
// ═══════════════════════════════════════════════════════════

Studio.Preview = {
  _iframe: null,

  init() {
    Studio.EventBus.on('project:loaded', () => this.refresh());
    Studio.EventBus.on('project:reset', () => this._clear());

    // Refresh when switching to the preview tab
    Studio.EventBus.on('tab:switched', ({ tab }) => {
      if (tab === 'preview') this.refresh();
    });

    Studio.log('Preview module ready');
  },

  /**
   * Refresh the preview iframe with the current project.
   * Points to ../player-v2.html?id=PROJECT_ID
   * If no project id exists yet, shows a placeholder.
   */
  refresh() {
    const container = document.getElementById('preview-container');
    if (!container) return;

    const projectId = Studio.Project.state.id;
    if (!projectId) {
      container.innerHTML = `
        <div style="
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          height:100%; color:var(--muted); font-family:var(--font-mono,'Space Mono',monospace);
          gap:12px; text-align:center;
        ">
          <div style="font-size:32px; opacity:0.4;">▶</div>
          <div style="font-size:12px; opacity:0.6;">
            Save your project first to enable preview.
          </div>
        </div>
      `;
      this._iframe = null;
      return;
    }

    const playerUrl = '../player-v2.html?id=' + encodeURIComponent(projectId);

    // Build or update iframe
    if (this._iframe && this._iframe.parentNode === container) {
      this._iframe.src = playerUrl;
    } else {
      container.innerHTML = '';
      this._iframe = document.createElement('iframe');
      this._iframe.src = playerUrl;
      this._iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:6px;background:#000;';
      this._iframe.setAttribute('allow', 'camera;microphone;gyroscope;accelerometer;xr-spatial-tracking');
      this._iframe.setAttribute('allowfullscreen', '');
      container.appendChild(this._iframe);
    }

    // Add toolbar
    this._ensureToolbar(container, playerUrl);
  },

  /**
   * Open the player in a new browser tab.
   */
  openExternal() {
    const projectId = Studio.Project.state.id;
    if (!projectId) {
      Studio.toast('Save your project first', 'warn');
      return;
    }
    const url = '../player-v2.html?id=' + encodeURIComponent(projectId);
    window.open(url, '_blank');
  },

  // ─── Internal ─────────────────────────────────────────
  _clear() {
    const container = document.getElementById('preview-container');
    if (!container) return;
    container.innerHTML = '';
    this._iframe = null;
  },

  _ensureToolbar(container, url) {
    // Avoid duplicate toolbar
    if (container.querySelector('.preview-toolbar')) return;

    const bar = document.createElement('div');
    bar.className = 'preview-toolbar';
    bar.style.cssText = 'position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:10;';

    // Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'tb-btn';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.title = 'Reload preview';
    refreshBtn.style.cssText = 'font-size:10px;padding:4px 10px;';
    refreshBtn.onclick = () => this.refresh();

    // Open external button
    const extBtn = document.createElement('button');
    extBtn.className = 'tb-btn';
    extBtn.textContent = 'Open';
    extBtn.title = 'Open in new tab';
    extBtn.style.cssText = 'font-size:10px;padding:4px 10px;';
    extBtn.onclick = () => this.openExternal();

    bar.appendChild(refreshBtn);
    bar.appendChild(extBtn);

    // Make container relative for absolute toolbar positioning
    container.style.position = 'relative';
    container.appendChild(bar);
  }
};
