// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Hierarchy Panel (Scene Tree)
// ═══════════════════════════════════════════════════════════

Studio.Hierarchy = {
  _selectedId: null,

  init() {
    // Listen for state changes
    Studio.EventBus.on('object:added', () => this.render());
    Studio.EventBus.on('object:removed', () => this.render());
    Studio.EventBus.on('object:selected', ({ id }) => { this._selectedId = id; this.render(); });
    Studio.EventBus.on('object:deselected', () => { this._selectedId = null; this.render(); });
    Studio.EventBus.on('project:loaded', () => this.render());
    Studio.EventBus.on('project:reset', () => this.render());
    Studio.EventBus.on('project:dirty', () => this._updateStatus());
    Studio.EventBus.on('tracking:modeChanged', () => this.render());
    Studio.EventBus.on('target:changed', () => this.render());

    this.render();
  },

  render() {
    const list = document.getElementById('h-list');
    const state = Studio.Project.state;
    let html = '';

    // Tracking source header
    const mode = state.trackingMode || 'slam';
    const modeIcons = { slam: '🌐', image: '📷', face: '👤', hand: '✋' };
    const modeLabels = { slam: 'Surface Tracking', image: 'Image Target', face: 'Face Tracking', hand: 'Hand Tracking' };

    html += `<div class="h-track">${modeIcons[mode] || '🌐'} ${modeLabels[mode] || mode}</div>`;

    // Image target (if image mode)
    if (mode === 'image') {
      const hasTarget = state.target.mindBuffer || state.target.mindUrl;
      html += `<div class="h-item" style="opacity:${hasTarget ? 1 : 0.4}" onclick="document.getElementById('fi-target').click()">
        <span class="h-icon">🎯</span>
        <span class="h-name">Image Target</span>
        <span style="font-size:9px;color:${hasTarget ? 'var(--green)' : 'var(--faint)'}">${hasTarget ? '✓' : 'none'}</span>
      </div>`;
    }

    // Scene objects
    state.objects.forEach(obj => {
      const sel = obj.id === this._selectedId;
      const icon = obj.type === 'model' ? '📦' : obj.type === 'light' ? '💡' : '🔲';
      html += `<div class="h-item${sel ? ' selected' : ''}" onclick="Studio.Viewport.selectObject('${obj.id}')">
        <span class="h-icon">${icon}</span>
        <span class="h-name">${obj.name}</span>
        <span class="h-vis${obj.visible ? '' : ' off'}" onclick="event.stopPropagation();Studio.Hierarchy.toggleVisibility('${obj.id}')">${obj.visible ? '👁' : '🚫'}</span>
      </div>`;
    });

    if (state.objects.length === 0) {
      html += '<div class="panel-empty" style="padding:12px">Add a 3D model to begin</div>';
    }

    list.innerHTML = html;
    this._updateStatus();
  },

  toggleVisibility(id) {
    const obj = Studio.Project.getObject(id);
    if (!obj) return;
    obj.visible = !obj.visible;
    if (obj.mesh) obj.mesh.visible = obj.visible;
    Studio.Project.markDirty();
    this.render();
  },

  _updateStatus() {
    const state = Studio.Project.state;
    const statusEl = document.getElementById('tb-status');
    if (statusEl) {
      statusEl.textContent = state.name + (state.dirty ? ' *' : '');
    }
    // Update page title
    document.title = `${state.name}${state.dirty ? ' *' : ''} — 4E AR Studio`;
  },
};
