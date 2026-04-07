// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Assets Panel (bottom panel grid)
// ═══════════════════════════════════════════════════════════

Studio.Assets = {
  init() {
    Studio.EventBus.on('object:added', () => this.render());
    Studio.EventBus.on('object:removed', () => this.render());
    Studio.EventBus.on('project:loaded', () => this.render());
    Studio.EventBus.on('project:reset', () => this.render());
    Studio.EventBus.on('tracking:modeChanged', () => this.render());
    Studio.EventBus.on('target:changed', () => this.render());

    this.render();
  },

  render() {
    const container = document.getElementById('bp-assets');
    if (!container) return;

    const state = Studio.Project.state;
    let html = '<div class="asset-grid">';

    // ─── Upload button ─────────────────────────────────
    html += `
      <div class="asset-card asset-upload" onclick="document.getElementById('fi-model').click()" title="Upload GLB model">
        <div class="asset-icon">+</div>
        <div class="asset-label">Upload Model</div>
      </div>`;

    // ─── Sample models ─────────────────────────────────
    html += `
      <div class="asset-card asset-sample" onclick="Studio.Viewport.loadSample('../samples/Duck.glb','Duck')" title="Duck sample">
        <div class="asset-icon">🦆</div>
        <div class="asset-label">Duck</div>
      </div>`;

    html += `
      <div class="asset-card asset-sample" onclick="Studio.Viewport.loadSample('../samples/Fox.glb','Fox')" title="Fox sample">
        <div class="asset-icon">🦊</div>
        <div class="asset-label">Fox</div>
      </div>`;

    // ─── Image Targets (only in image mode) ────────────
    if (state.trackingMode === 'image') {
      const hasTarget = state.target.mindBuffer || state.target.mindUrl;
      html += `
        <div class="asset-card asset-target${hasTarget ? ' has-target' : ''}" onclick="document.getElementById('fi-target').click()" title="Upload image target">
          <div class="asset-icon">${hasTarget ? '🎯' : '📷'}</div>
          <div class="asset-label">${hasTarget ? 'Target Set' : 'Add Target'}</div>
        </div>`;

      // Sample target
      html += `
        <div class="asset-card asset-sample" onclick="Studio.Assets._loadSampleTarget()" title="Sample image target">
          <div class="asset-icon">🖼</div>
          <div class="asset-label">Sample Target</div>
        </div>`;
    }

    // ─── Separator ─────────────────────────────────────
    if (state.objects.length > 0) {
      html += '<div class="asset-divider"></div>';
    }

    // ─── In-scene objects ──────────────────────────────
    state.objects.forEach(obj => {
      const icon = obj.type === 'model' ? '📦' : '🔲';
      html += `
        <div class="asset-card asset-scene" onclick="Studio.Viewport.selectObject('${obj.id}')" title="${obj.name}">
          <div class="asset-icon">${icon}</div>
          <div class="asset-label">${this._truncate(obj.name, 14)}</div>
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
  },

  // ─── Load sample target image ─────────────────────────
  async _loadSampleTarget() {
    try {
      Studio.toast('Loading sample target...', 'ok');
      const resp = await fetch('../samples/target-sample.png');
      const blob = await resp.blob();
      const file = new File([blob], 'target-sample.png', { type: 'image/png' });
      await Studio.Viewport.handleTargetFile(file);
    } catch (e) {
      Studio.toast('Failed to load sample target: ' + e.message, 'err');
    }
  },

  async handleMediaFile(file) {
    if (!file) return;
    Studio.toast('Uploading ' + file.name + '…', 'ok');
    try {
      const gh = Studio.GitHub.getConfig();
      if (!gh.token) { Studio.toast('Set GitHub token first (click Publish)', 'warn'); return; }
      if (!Studio.Project.state.id) Studio.Project.state.id = Studio.Project._genId();
      const ext = file.name.split('.').pop() || 'bin';
      const path = 'assets/' + Studio.Project.state.id + '/media/' + Date.now() + '.' + ext;
      const b64 = await Studio.GitHub.file2b64(file);
      const url = await Studio.GitHub.upload(path, b64);
      Studio.toast(file.name + ' uploaded ✓', 'ok');
      Studio.log('Media uploaded: ' + url);
      // Store in project for reference
      if (!Studio.Project.state.media) Studio.Project.state.media = [];
      Studio.Project.state.media.push({ name: file.name, url: url, type: file.type });
      Studio.Project.markDirty();
      this.render();
    } catch(e) {
      Studio.toast('Upload failed: ' + e.message, 'err');
    }
  },

  // ─── Helpers ──────────────────────────────────────────
  _truncate(str, max) {
    return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
  }
};
