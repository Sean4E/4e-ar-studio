// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Hierarchy Panel (Scene Tree)
// ═══════════════════════════════════════════════════════════

Studio.Hierarchy = {
  _selectedId: null,
  _collapsed: new Set(),   // targetIds whose children are currently collapsed

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

    // Image targets (if image mode)
    if (mode === 'image') {
      const targets = state.targets || [];
      if (targets.length === 0) {
        html += `<div class="h-item" style="opacity:0.4" onclick="Studio.Targets.addTarget()">
          <span class="h-icon">🎯</span>
          <span class="h-name">+ Add Image Target</span>
        </div>`;
      } else {
        const focusedId = Studio.Viewport?._focusedTargetId || null;
        targets.forEach(t => {
          const assigned = (t.objectIds || []).length;
          const qCol = t.quality >= 70 ? 'var(--green)' : t.quality >= 45 ? 'var(--amber,#f0a)' : 'var(--faint)';
          const isFocused = focusedId === t.id;
          const isCollapsed = this._collapsed.has(t.id);
          const chevron = isCollapsed ? '▶' : '▼';
          // Header: chevron toggles collapse, rest of row focuses the
          // target in the viewport (centres it, hides other targets).
          html += `<div class="h-item h-target-row${isFocused ? ' h-target-focused' : ''}">
            <span class="h-chevron" onclick="event.stopPropagation();Studio.Hierarchy.toggleCollapse('${t.id}')" title="${isCollapsed ? 'Expand' : 'Collapse'}">${chevron}</span>
            <span class="h-icon" onclick="Studio.Hierarchy.focusTarget('${t.id}')" title="Centre this target in the viewport — click again to return to grid view">🎯</span>
            <span class="h-name" onclick="Studio.Hierarchy.focusTarget('${t.id}')">${t.name}</span>
            <span style="font-size:9px;color:${qCol}" title="Number of assigned objects">${assigned} obj</span>
            <span class="h-target-edit" onclick="event.stopPropagation();Studio.Hierarchy.editTarget('${t.id}')" title="Edit target settings (opens Targets tab)">✎</span>
          </div>`;

          // Children — hidden when collapsed
          if (!isCollapsed) {
            (t.objectIds || []).forEach(oid => {
              const obj = Studio.Project.getObject(oid);
              if (!obj) return;
              const sel = obj.id === this._selectedId;
              const icon = obj.type === 'primitive' ? (obj.primitiveType === 'empty' ? '◇' : '🔲') : '📦';
              html += `<div class="h-item h-indent${sel ? ' selected' : ''}" onclick="Studio.Viewport.selectObject('${obj.id}')" style="padding-left:28px">
                <span class="h-icon">${icon}</span>
                <span class="h-name">${obj.name}</span>
                <span class="h-vis${obj.visible ? '' : ' off'}" onclick="event.stopPropagation();Studio.Hierarchy.toggleVisibility('${obj.id}')">${obj.visible ? '👁' : '🚫'}</span>
              </div>`;
            });
          }
        });

        html += `<div class="h-item" style="opacity:0.5" onclick="Studio.Targets.addTarget()">
          <span class="h-icon">➕</span>
          <span class="h-name">Add Target</span>
        </div>`;
      }
    }

    // Scene objects (exclude those already shown under targets)
    const shownUnderTargets = new Set();
    if (mode === 'image') {
      (state.targets || []).forEach(t => (t.objectIds || []).forEach(id => shownUnderTargets.add(id)));
    }

    // Unassigned objects
    const unassigned = state.objects.filter(o => !shownUnderTargets.has(o.id));
    if (unassigned.length > 0 && mode === 'image' && (state.targets || []).length > 0) {
      html += `<div class="h-track" style="font-size:9px;opacity:0.5;margin-top:4px">Unassigned Objects</div>`;
    }
    unassigned.forEach(obj => {
      const sel = obj.id === this._selectedId;
      const icon = obj.type === 'model' ? '📦'
        : obj.primitiveType === 'empty' ? '◇'
        : obj.type === 'light' ? '💡' : '🔲';
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

  // Centre this target in the viewport + hide other targets. Does NOT
  // switch tabs — user stays in the 3D Scene tab. Click again on the
  // same target to return to grid view (all targets visible).
  focusTarget(targetId) {
    if (Studio.Viewport?.focusTarget) Studio.Viewport.focusTarget(targetId);
  },

  // Explicit "edit target settings" action (quality, image replace,
  // etc.) — switches to the Targets tab. Triggered by the pencil icon,
  // not by the row body itself.
  editTarget(targetId) {
    Studio.switchTab('targets');
    if (Studio.Targets && Studio.Targets._selectedId !== targetId) {
      Studio.Targets._selectedId = targetId;
      Studio.Targets.render();
    }
  },

  // Legacy alias — some older callers may still route here. Point
  // them at focusTarget which is now the default action.
  selectTarget(targetId) {
    this.focusTarget(targetId);
  },

  toggleCollapse(targetId) {
    if (this._collapsed.has(targetId)) this._collapsed.delete(targetId);
    else this._collapsed.add(targetId);
    this.render();
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
