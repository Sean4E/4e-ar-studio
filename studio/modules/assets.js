// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Assets Panel (bottom panel)
// Sectioned layout: Primitives | Samples | Upload | Scene
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
    let html = '';

    // ─── Section: Primitives ──────────────────────────
    html += `<div class="ast-section">
      <div class="ast-section-title">Primitives</div>
      <div class="ast-row">
        ${this._primCard('cube',     '⬜', 'Cube')}
        ${this._primCard('sphere',   '⚪', 'Sphere')}
        ${this._primCard('cylinder', '🔷', 'Cylinder')}
        ${this._primCard('plane',    '▬',  'Plane')}
        ${this._primCard('cone',     '🔺', 'Cone')}
        ${this._primCard('torus',    '⭕', 'Torus')}
        ${this._primCard('empty',    '◇',  'Empty')}
      </div>
    </div>`;

    // ─── Section: Samples ─────────────────────────────
    html += `<div class="ast-section">
      <div class="ast-section-title">Sample Models</div>
      <div class="ast-row">
        ${this._sampleCard('🦆', 'Duck',  "../samples/Duck.glb")}
        ${this._sampleCard('🦊', 'Fox',   "../samples/Fox.glb")}
      </div>
    </div>`;

    // ─── Section: Image Targets (image mode only) ─────
    if (state.trackingMode === 'image') {
      const tgtCount = (state.targets || []).length;
      html += `<div class="ast-section">
        <div class="ast-section-title">Image Targets (${tgtCount})</div>
        <div class="ast-row">
          <div class="ast-card ast-action" onclick="Studio.switchTab('targets')" title="Open Targets workspace">
            <div class="ast-card-icon">📷</div>
            <div class="ast-card-label">Manage Targets</div>
            <div class="ast-card-sub">${tgtCount ? tgtCount + ' target' + (tgtCount > 1 ? 's' : '') : 'None yet'}</div>
          </div>
          <div class="ast-card ast-action" onclick="Studio.Targets.loadSampleTarget()" title="Add sample target image">
            <div class="ast-card-icon">🖼</div>
            <div class="ast-card-label">Sample Target</div>
            <div class="ast-card-sub">Quick test</div>
          </div>
        </div>
      </div>`;
    }

    // ─── Section: Upload ──────────────────────────────
    html += `<div class="ast-section">
      <div class="ast-section-title">Upload</div>
      <div class="ast-row">
        <div class="ast-card ast-upload" onclick="document.getElementById('fi-model').click()" title="Upload GLB/GLTF model">
          <div class="ast-card-icon">+</div>
          <div class="ast-card-label">3D Model</div>
          <div class="ast-card-sub">.glb .gltf</div>
        </div>
        <div class="ast-card ast-upload" onclick="document.getElementById('fi-media').click()" title="Upload image, video, or audio">
          <div class="ast-card-icon">🎬</div>
          <div class="ast-card-label">Media</div>
          <div class="ast-card-sub">img / vid / audio</div>
        </div>
      </div>
    </div>`;

    // ─── Section: Media Library ──────────────────────────
    const media = state.media || [];
    if (media.length > 0) {
      html += `<div class="ast-section">
        <div class="ast-section-title">Media Library (${media.length})</div>
        <div class="ast-row">`;
      media.forEach((m, idx) => {
        const icon = m.type?.startsWith('audio') ? '🎵'
                   : m.type?.startsWith('video') ? '🎬'
                   : m.type?.startsWith('image') ? '🖼'
                   : '📎';
        const ext = m.name?.split('.').pop() || '';
        html += `
          <div class="ast-card ast-media" title="${m.name}\n${m.url}">
            <div class="ast-card-icon">${icon}</div>
            <div class="ast-card-label">${this._truncate(m.name || 'Media', 14)}</div>
            <div class="ast-card-sub">${ext}
              <button class="ast-copy-btn" onclick="event.stopPropagation(); navigator.clipboard.writeText('${m.url}'); Studio.toast('URL copied', 'ok')" title="Copy URL">📋</button>
              <button class="ast-copy-btn" onclick="event.stopPropagation(); Studio.Assets.removeMedia(${idx})" title="Remove">✕</button>
            </div>
          </div>`;
      });
      html += `</div></div>`;
    }

    // ─── Section: Scene Objects ────────────────────────
    if (state.objects.length > 0) {
      html += `<div class="ast-section">
        <div class="ast-section-title">In Scene (${state.objects.length})</div>
        <div class="ast-row">`;
      state.objects.forEach(obj => {
        const icon = obj.type === 'primitive' ? this._primIcon(obj.primitiveType) : '📦';
        const statusDot = obj.glbUrl || obj.type === 'primitive'
          ? '<span class="ast-dot ast-dot-ok"></span>'
          : '<span class="ast-dot ast-dot-pending"></span>';
        html += `
          <div class="ast-card ast-scene${Studio.Viewport._selectedId === obj.id ? ' selected' : ''}" onclick="Studio.Viewport.selectObject('${obj.id}')" title="${obj.name}">
            <div class="ast-card-icon">${icon}</div>
            <div class="ast-card-label">${this._truncate(obj.name, 12)}</div>
            <div class="ast-card-sub">${obj.type}${statusDot}</div>
          </div>`;
      });
      html += `</div></div>`;
    }

    container.innerHTML = html;
  },

  // ─── Card Builders ─────────────────────────────────────
  _primCard(type, icon, label) {
    return `<div class="ast-card ast-prim" onclick="Studio.Viewport.addPrimitive('${type}')" title="Add ${label}">
      <div class="ast-card-icon">${icon}</div>
      <div class="ast-card-label">${label}</div>
    </div>`;
  },

  _sampleCard(icon, name, url) {
    return `<div class="ast-card ast-sample" onclick="Studio.Viewport.loadSample('${url}','${name}')" title="Add ${name} sample">
      <div class="ast-card-icon">${icon}</div>
      <div class="ast-card-label">${name}</div>
    </div>`;
  },

  _primIcon(type) {
    const icons = { cube: '⬜', sphere: '⚪', cylinder: '🔷', plane: '▬', cone: '🔺', torus: '⭕', empty: '◇' };
    return icons[type] || '🔲';
  },

  removeMedia(idx) {
    const media = Studio.Project.state.media;
    if (!media || idx < 0 || idx >= media.length) return;
    const name = media[idx].name;
    media.splice(idx, 1);
    Studio.Project.markDirty();
    this.render();
    Studio.toast(name + ' removed from library', 'ok');
  },

  // ─── Load sample target via new Targets system ────────
  // (Kept here for backward compat — delegates to Targets module)

  // ─── Media Upload ─────────────────────────────────────
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
      if (!Studio.Project.state.media) Studio.Project.state.media = [];
      Studio.Project.state.media.push({ name: file.name, url: url, type: file.type });
      Studio.Project.markDirty();
      this.render();
    } catch (e) {
      Studio.toast('Upload failed: ' + e.message, 'err');
    }
  },

  // ─── Helpers ──────────────────────────────────────────
  _truncate(str, max) {
    return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
  }
};
