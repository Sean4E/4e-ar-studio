// ═══════════════════════════════════════════════════════════
// 4E AR Studio v2 — Orchestrator
// ═══════════════════════════════════════════════════════════

// ─── Utility methods on Studio namespace ─────────────────
Studio.toast = function(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + (type || '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = 'toast', 3200);
};

Studio.log = function(msg) {
  const c = document.getElementById('console-log');
  if (c) {
    c.innerHTML += `<div>${new Date().toLocaleTimeString()} — ${msg}</div>`;
    c.scrollTop = c.scrollHeight;
  }
  console.log('[Studio]', msg);
};

Studio.closeModal = function(id) {
  document.getElementById(id)?.classList.add('hidden');
};

// ─── Tab Switching ───────────────────────────────────────
Studio.currentTab = 'scene';

Studio.switchTab = function(tab) {
  Studio.currentTab = tab;
  document.querySelectorAll('.ws-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.ws-content').forEach(c => c.classList.toggle('active', c.dataset.tab === tab));
  Studio.EventBus.emit('tab:switched', { tab });
  if (tab === 'scene') Studio.Viewport._resize();
};

Studio.showBottomTab = function(tab) {
  document.querySelectorAll('.bp-tab').forEach(t => t.classList.toggle('active', t.dataset.bp === tab));
  document.querySelectorAll('.bp-content').forEach(c => c.classList.toggle('active', c.dataset.bp === tab));
};

// ─── Tracking Mode ───────────────────────────────────────
Studio.setTrackingMode = function(mode) {
  Studio.Project.state.trackingMode = mode;
  Studio.Project.markDirty();
  document.querySelectorAll('#tracking-mode .tb-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  // Show/hide target button
  const targetBtn = document.getElementById('tb-add-target');
  if (targetBtn) targetBtn.style.display = mode === 'image' ? '' : 'none';
  // Target plane visibility
  if (Studio.Viewport.targetPlane) {
    Studio.Viewport.targetPlane.visible = mode === 'image';
  }
  Studio.EventBus.emit('tracking:modeChanged', { mode });
  Studio.Hierarchy.render();
  Studio.log('Tracking: ' + mode);
};

// ─── Project Operations ──────────────────────────────────
Studio.newProject = function() {
  Studio.Project.reset();
  document.getElementById('tb-name').value = 'Untitled';
  Studio.log('New project');
};

Studio.renameProject = function(name) {
  Studio.Project.state.name = name.trim() || 'Untitled';
  Studio.Project.markDirty();
};

Studio.saveProject = async function() {
  if (!Studio.Firebase.ready) { Studio.toast('Firebase not connected', 'err'); return; }
  const state = Studio.Project.state;
  if (!state.id) state.id = Studio.Project._genId();
  state.name = document.getElementById('tb-name').value.trim() || 'Untitled';

  const data = Studio.Project.serialize();
  data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  if (!data.createdAt) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

  try {
    await Studio.Firebase.save(state.id, data);
    state.dirty = false;
    Studio.Hierarchy._updateStatus();
    Studio.toast('Saved ✓', 'ok');
    Studio.log('Saved: ' + state.id);
  } catch(e) {
    Studio.toast('Save failed: ' + e.message, 'err');
  }
};

Studio.openProject = async function() {
  if (!Studio.Firebase.ready) { Studio.toast('Firebase not connected', 'err'); return; }
  try {
    const projects = await Studio.Firebase.list();
    const list = document.getElementById('project-list');
    list.innerHTML = '';
    if (!projects.length) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--faint)">No projects yet</div>';
    }
    projects.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `<span style="font-weight:600">${p.name || p.id}</span><span style="font-size:11px;color:var(--muted)">${p.trackingMode || ''}</span>`;
      li.onclick = async () => {
        Studio.closeModal('modal-open');
        await Studio._loadProjectById(p.id);
      };
      list.appendChild(li);
    });
    document.getElementById('modal-open').classList.remove('hidden');
  } catch(e) {
    Studio.toast('Load failed: ' + e.message, 'err');
  }
};

Studio._loadProjectById = async function(id) {
  const data = await Studio.Firebase.load(id);
  if (!data) { Studio.toast('Project not found', 'err'); return; }
  Studio.Project.state.id = id;
  Studio.Project.deserialize(data);
  document.getElementById('tb-name').value = Studio.Project.state.name;
  // Restore tracking mode UI
  Studio.setTrackingMode(Studio.Project.state.trackingMode);
  Studio.log('Opened: ' + Studio.Project.state.name);
  Studio.toast('Opened: ' + Studio.Project.state.name, 'ok');
};

Studio.publishProject = async function() {
  if (!Studio.Firebase.ready) { Studio.toast('Firebase not connected', 'err'); return; }
  const state = Studio.Project.state;
  if (state.objects.length === 0) { Studio.toast('Add models first', 'err'); return; }
  if (state.trackingMode === 'image' && !state.target.mindBuffer && !state.target.mindUrl) {
    Studio.toast('Add an image target first', 'err'); return;
  }

  const gh = Studio.GitHub.getConfig();
  if (!gh.token) {
    document.getElementById('modal-token').classList.remove('hidden');
    return;
  }

  if (!state.id) state.id = Studio.Project._genId();
  const base = 'assets/' + state.id;
  Studio.toast('Publishing…', 'ok');

  try {
    // Upload target
    if (state.target.mindBuffer) {
      Studio.log('Uploading target…');
      state.target.mindUrl = await Studio.GitHub.upload(base + '/target.mind', Studio.GitHub.ab2b64(state.target.mindBuffer));
    }
    if (state.target.imgFile) {
      state.target.imageUrl = await Studio.GitHub.upload(base + '/target.png', await Studio.GitHub.file2b64(state.target.imgFile));
    }

    // Upload models
    const uploads = state.objects.filter(o => o.file && !o.glbUrl).map(async (o, i) => {
      Studio.log('Uploading ' + o.name + '…');
      o.glbUrl = await Studio.GitHub.upload(base + '/model_' + i + '.glb', await Studio.GitHub.file2b64(o.file));
    });
    await Promise.all(uploads);

    // Save
    await Studio.saveProject();

    // Show QR
    const url = (window.AR_BASE_URL || location.origin) + '/player-v2.html?id=' + state.id;
    document.getElementById('pub-url').value = url;
    const qrEl = document.getElementById('qr-code');
    qrEl.innerHTML = '';
    new QRCode(qrEl, { text: url, width: 180, height: 180, colorDark: '#7c3aed', colorLight: '#ffffff' });
    document.getElementById('deploy-status').innerHTML = '<span style="color:var(--green)">✓ Published</span>';
    document.getElementById('modal-publish').classList.remove('hidden');
    Studio.log('Published: ' + url);

  } catch(e) {
    Studio.toast('Publish failed: ' + e.message, 'err');
    Studio.log('ERROR: ' + e.message);
  }
};

Studio.previewProject = async function() {
  const state = Studio.Project.state;
  if (!state.id) { Studio.toast('Save project first', 'warn'); return; }
  if (state.dirty) await Studio.saveProject();
  const url = (window.AR_BASE_URL || location.origin) + '/player-v2.html?id=' + state.id;
  document.getElementById('pub-url').value = url;
  const qrEl = document.getElementById('qr-code');
  qrEl.innerHTML = '';
  new QRCode(qrEl, { text: url, width: 180, height: 180, colorDark: '#7c3aed', colorLight: '#ffffff' });
  document.getElementById('deploy-status').innerHTML = '<span style="color:var(--cyan)">Preview</span>';
  document.getElementById('modal-publish').classList.remove('hidden');
};

Studio.saveToken = function() {
  const token = document.getElementById('token-input').value.trim();
  if (!token) { Studio.toast('Paste a valid token', 'err'); return; }
  localStorage.setItem('4e-ar-gh-token', token);
  Studio.closeModal('modal-token');
  Studio.toast('Token saved', 'ok');
  Studio.publishProject();
};

// ─── Keyboard Shortcuts ──────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); Studio.saveProject(); }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); Studio.Undo.undo(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); Studio.Undo.redo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); Studio.saveProject(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); Studio.newProject(); return; }
  const k = e.key.toLowerCase();
  if (k === 'w') Studio.Viewport.setGizmo('translate');
  if (k === 'e') Studio.Viewport.setGizmo('rotate');
  if (k === 'r') Studio.Viewport.setGizmo('scale');
  if (k === 'delete' || k === 'backspace') {
    if (Studio.Viewport._selectedId) {
      Studio.Project.removeObject(Studio.Viewport._selectedId);
      Studio.Inspector.clear();
    }
  }
  if (k === 'escape') Studio.Viewport.deselectAll();
});

// Unsaved changes warning
window.addEventListener('beforeunload', e => {
  if (Studio.Project.state.dirty) { e.preventDefault(); e.returnValue = 'Unsaved changes'; }
});

// ─── Boot ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Init all modules
  Studio.Firebase.init();
  Studio.Viewport.init();
  Studio.Hierarchy.init();
  Studio.Inspector.init();
  Studio.Undo.init();
  Studio.Assets.init();
  Studio.CodeEditor.init();
  Studio.Splash.init();
  Studio.Preview.init();

  Studio.log('4E AR Studio v2 ready');

  // Load project from URL if ?edit=ID
  const editId = new URLSearchParams(location.search).get('edit');
  if (editId && Studio.Firebase.ready) {
    try {
      await Studio._loadProjectById(editId);
    } catch(e) {
      Studio.toast('Failed to load project', 'err');
    }
  }
});
