// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Assets Panel (bottom panel)
// Sectioned layout: Primitives | Samples | Upload | Scene
// ═══════════════════════════════════════════════════════════

Studio.Assets = {
  _tab: 'project',         // 'project' | 'library'
  _library: null,          // cached cross-project asset list
  _libraryLoading: false,
  _libraryError: null,

  init() {
    Studio.EventBus.on('object:added', () => this.render());
    Studio.EventBus.on('object:removed', () => this.render());
    Studio.EventBus.on('project:loaded', () => this.render());
    Studio.EventBus.on('project:reset', () => this.render());
    Studio.EventBus.on('tracking:modeChanged', () => this.render());
    Studio.EventBus.on('target:changed', () => this.render());
    Studio.EventBus.on('prefab:added', () => this.render());
    Studio.EventBus.on('prefab:removed', () => this.render());

    // Convert vertical mouse-wheel into horizontal scroll when hovering
    // the asset drawer — natural navigation for the row-based layout.
    const container = document.getElementById('bp-assets');
    if (container) {
      container.addEventListener('wheel', (e) => {
        // Horizontal intent already (trackpad, shift-wheel) → let it through
        if (e.deltaX !== 0 && Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
        // Only intercept when there IS horizontal content to scroll
        if (container.scrollWidth <= container.clientWidth) return;
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }, { passive: false });
    }

    this.render();
  },

  render() {
    const container = document.getElementById('bp-assets');
    if (!container) return;

    const state = Studio.Project.state;
    let html = '';

    // Tabs — sticky on the left
    html += `<div class="ast-tabs">
      <button class="ast-tab${this._tab === 'project' ? ' active' : ''}" onclick="Studio.Assets.setTab('project')" title="Current project's assets">
        <span class="ast-tab-icon">📁</span><span class="ast-tab-label">Project</span>
      </button>
      <button class="ast-tab${this._tab === 'library' ? ' active' : ''}" onclick="Studio.Assets.setTab('library')" title="All assets across all projects on GitHub">
        <span class="ast-tab-icon">📦</span><span class="ast-tab-label">Assets</span>
      </button>
    </div>`;

    if (this._tab === 'library') {
      html += this._renderLibrary();
      container.innerHTML = html;
      return;
    }
    // Project tab — existing content below

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
        <div class="ast-card ast-upload" onclick="document.getElementById('fi-model').click()" title="Upload GLB/GLTF model to library">
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

    // ─── Section: 3D Models (prefab library) ────────────
    // Uploaded GLBs live here as reusable prefabs. Click a card to
    // instantiate into the scene — one prefab can be instantiated
    // many times, each instance with its own transform, target, and
    // components. Removing a scene instance leaves the prefab here.
    const prefabs = state.prefabs || [];
    if (prefabs.length > 0) {
      html += `<div class="ast-section">
        <div class="ast-section-title">3D Models (${prefabs.length})</div>
        <div class="ast-row">`;
      prefabs.forEach(p => {
        const instanceCount = state.objects.filter(o => o.prefabId === p.id).length;
        const statusDot = p.glbUrl
          ? '<span class="ast-dot ast-dot-ok" title="Uploaded"></span>'
          : '<span class="ast-dot ast-dot-pending" title="Pending upload"></span>';
        const usage = instanceCount > 0 ? `${instanceCount}×` : 'unused';
        html += `
          <div class="ast-card ast-prefab" onclick="Studio.Viewport.instantiatePrefab('${p.id}')" title="${this._esc(p.name)} — click to add instance to scene">
            <div class="ast-card-icon">📦</div>
            <div class="ast-card-label">${this._truncate(p.name, 14)}</div>
            <div class="ast-card-sub">${usage}${statusDot}
              <button class="ast-copy-btn" onclick="event.stopPropagation(); Studio.Assets.removePrefab('${p.id}')" title="Remove prefab (and all instances)">✕</button>
            </div>
          </div>`;
      });
      html += `</div></div>`;
    }

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

  // ─── Tabs + Library ────────────────────────────────────
  setTab(name) {
    this._tab = name;
    this.render();
    // Lazy-load the library the first time the tab is opened
    if (name === 'library' && this._library == null && !this._libraryLoading) {
      this.loadLibrary();
    }
  },

  async loadLibrary() {
    const cfg = Studio.GitHub.getConfig();
    if (!cfg.token) {
      this._libraryError = 'GitHub token not set — save a project once to enter one.';
      this.render();
      return;
    }
    this._libraryLoading = true;
    this._libraryError = null;
    this.render();
    try {
      const files = await Studio.GitHub.listContentsRecursive('assets');
      // Classify + dedupe. Filter out PWA/splash/target auxiliary files
      // that users don't want to re-add as generic library items.
      const lib = { models: [], audio: [], video: [], images: [] };
      files.forEach(f => {
        const path = f.path;
        const name = f.name;
        const size = f.size || 0;
        const ext = (name.split('.').pop() || '').toLowerCase();
        // Skip auto-generated per-project files
        if (/\/pwa\//.test(path)) return;
        if (/splash-logo\.png$/.test(path)) return;
        if (/_luminance\./.test(name) || /_thumb(nail)?\./.test(name) || /_original\./.test(name)) return;
        const cfg = Studio.GitHub.getConfig();
        const url = `https://${cfg.owner}.github.io/${cfg.repo}/${path}`;
        const projectId = (path.match(/^assets\/([^\/]+)\//) || [])[1] || '';
        const item = { name, path, size, url, projectId, ext };
        if (ext === 'glb' || ext === 'gltf') lib.models.push(item);
        else if (['mp3','wav','ogg','m4a'].includes(ext)) lib.audio.push(item);
        else if (['mp4','webm','mov','m4v'].includes(ext)) lib.video.push(item);
        else if (['png','jpg','jpeg','webp','gif'].includes(ext)) lib.images.push(item);
      });
      // Sort within each group by project id then name
      ['models','audio','video','images'].forEach(k => {
        lib[k].sort((a, b) => (a.projectId + a.name).localeCompare(b.projectId + b.name));
      });
      this._library = lib;
    } catch (e) {
      this._libraryError = e.message;
    } finally {
      this._libraryLoading = false;
      this.render();
    }
  },

  _renderLibrary() {
    if (this._libraryLoading) {
      return `<div class="ast-section"><div style="padding:20px;color:var(--muted);font-size:12px">Loading cross-project assets…</div></div>`;
    }
    if (this._libraryError) {
      return `<div class="ast-section"><div style="padding:20px;color:var(--red);font-size:12px">${this._esc(this._libraryError)}</div><div class="ast-row"><div class="ast-card ast-action" onclick="Studio.Assets.loadLibrary()"><div class="ast-card-icon">🔄</div><div class="ast-card-label">Retry</div></div></div></div>`;
    }
    if (!this._library) {
      return `<div class="ast-section"><div style="padding:20px;color:var(--faint);font-size:12px">No library loaded yet</div></div>`;
    }
    const lib = this._library;
    const total = lib.models.length + lib.audio.length + lib.video.length + lib.images.length;
    if (total === 0) {
      return `<div class="ast-section"><div style="padding:20px;color:var(--faint);font-size:12px">No assets across any project yet</div></div>`;
    }

    const iconFor = (ext) => ({
      glb:'📦', gltf:'📦',
      mp3:'🎵', wav:'🎵', ogg:'🎵', m4a:'🎵',
      mp4:'🎬', webm:'🎬', mov:'🎬', m4v:'🎬',
      png:'🖼', jpg:'🖼', jpeg:'🖼', webp:'🖼', gif:'🖼',
    })[ext] || '📎';

    const section = (title, items, kind) => {
      if (!items.length) return '';
      let rows = '';
      items.forEach(it => {
        const shortProj = it.projectId ? it.projectId.slice(-6) : '—';
        const sizeKb = it.size ? (it.size >= 1024*1024 ? (it.size/1024/1024).toFixed(1)+'M' : (it.size/1024).toFixed(0)+'K') : '';
        rows += `
          <div class="ast-card ast-library" onclick="Studio.Assets.addLibraryAsset('${kind}', '${this._esc(it.url)}', '${this._esc(it.name)}')" title="${this._esc(it.name)} · project ${it.projectId}">
            <div class="ast-card-icon">${iconFor(it.ext)}</div>
            <div class="ast-card-label">${this._truncate(it.name, 14)}</div>
            <div class="ast-card-sub">${sizeKb} · ${shortProj}</div>
          </div>`;
      });
      return `<div class="ast-section">
        <div class="ast-section-title">${title} (${items.length})</div>
        <div class="ast-row">${rows}</div>
      </div>`;
    };

    return section('3D Models', lib.models, 'model') +
           section('Videos',    lib.video,  'video') +
           section('Audio',     lib.audio,  'audio') +
           section('Images',    lib.images, 'image') +
           `<div class="ast-section"><div class="ast-row"><div class="ast-card ast-action" onclick="Studio.Assets.loadLibrary()" title="Fetch fresh list from GitHub"><div class="ast-card-icon">🔄</div><div class="ast-card-label">Refresh</div></div></div></div>`;
  },

  // Click-to-add from the library → current project. Doesn't copy the
  // file; references the existing GitHub URL, so no extra storage.
  addLibraryAsset(kind, url, name) {
    if (kind === 'model') {
      // Avoid duplicates
      let pf = Studio.Project.getPrefabByUrl(url);
      if (!pf) {
        pf = Studio.Project.createPrefab({ name: name.replace(/\.\w+$/, ''), glbUrl: url });
        Studio.Project.addPrefab(pf);
        Studio.toast(name + ' added to project', 'ok');
      } else {
        Studio.toast(name + ' is already in the project', 'ok');
      }
      this.setTab('project');
      return;
    }
    // Audio / video / image → media library entry
    const media = Studio.Project.state.media || (Studio.Project.state.media = []);
    if (media.some(m => m.url === url)) {
      Studio.toast(name + ' is already in the project', 'ok');
      this.setTab('project');
      return;
    }
    const type = kind === 'audio' ? 'audio/' : kind === 'video' ? 'video/' : 'image/';
    media.push({ name, url, type });
    Studio.Project.markDirty();
    this.setTab('project');
    Studio.toast(name + ' added to project', 'ok');
  },

  removePrefab(id) {
    const prefab = Studio.Project.getPrefab(id);
    if (!prefab) return;
    const instanceCount = Studio.Project.state.objects.filter(o => o.prefabId === id).length;
    const msg = instanceCount > 0
      ? `Remove "${prefab.name}" and its ${instanceCount} instance${instanceCount > 1 ? 's' : ''} from the scene? This also deletes the GLB file from GitHub.`
      : `Remove "${prefab.name}" from the library? This deletes the GLB file from GitHub.`;
    if (!confirm(msg)) return;
    Studio.Project.removePrefab(id);
    this.render();
    Studio.Hierarchy.render();
    Studio.toast(prefab.name + ' removed', 'ok');
  },

  _esc(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  removeMedia(idx) {
    const media = Studio.Project.state.media;
    if (!media || idx < 0 || idx >= media.length) return;
    const item = media[idx];
    media.splice(idx, 1);
    Studio.Project.markDirty();
    this.render();
    Studio.toast(item.name + ' removed from library', 'ok');
    // Delete the file from GitHub, unless another object still references it
    if (Studio.GitHub?.deleteByUrl && item.url) {
      const stillUsed = (Studio.Project.state.objects || []).some(o => {
        if (o.glbUrl === item.url) return true;
        const x = o.xrComponents || {};
        return Object.values(x).some(c => c && typeof c === 'object' &&
          (c.src === item.url || c.video === item.url || c.image === item.url));
      });
      if (!stillUsed) Studio.GitHub.deleteByUrl(item.url).catch(() => {});
    }
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
