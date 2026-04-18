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

// Fullscreen the active workspace tab — hides toolbar, hierarchy,
// inspector and bottom panel so the content fills the viewport.
// Same button toggles back. Useful for the Spatial tab in particular
// (the embedded editor uses every pixel) but works on all tabs.
Studio.toggleFullscreen = function() {
  const on = !document.body.classList.contains('studio-fullscreen');
  document.body.classList.toggle('studio-fullscreen', on);
  const btn = document.getElementById('ws-fs-btn');
  if (btn) {
    btn.textContent = on ? '⛶ Exit' : '⛶';
    btn.title = on
      ? 'Exit fullscreen (restore toolbar + side panels)'
      : 'Fullscreen workspace (hide toolbar + side panels)';
    btn.classList.toggle('active', on);
  }
  console.log('[Studio] fullscreen', on ? 'ON' : 'OFF');
  if (Studio.toast) Studio.toast('Fullscreen ' + (on ? 'ON' : 'OFF'), 'ok');
  // Nudge both the studio viewport and the Spatial iframe to re-measure
  // their canvases. Fire a few times across layout milestones because
  // CSS grid reflow can take a frame or two to settle, especially when
  // side panels re-appear on exit.
  const nudge = () => {
    if (Studio.Viewport && Studio.Viewport._resize) Studio.Viewport._resize();
    if (Studio.Spatial && Studio.Spatial._iframe) {
      const cw = Studio.Spatial._iframe.contentWindow;
      // Two paths because cross-realm dispatchEvent can silently fail
      // in some browsers: (a) post a message the iframe knows to treat
      // as a resize trigger, and (b) still try a plain resize dispatch
      // as a fallback for any future change.
      try { cw.postMessage({ type: '4e-spatial-resize' }, '*'); } catch (_) {}
      try { cw.dispatchEvent(new Event('resize')); } catch (_) {}
    }
    window.dispatchEvent(new Event('resize'));
  };
  requestAnimationFrame(() => requestAnimationFrame(nudge));
  setTimeout(nudge, 150);
  setTimeout(nudge, 350);
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
  // Show/hide target button + image-only workspace tabs
  const targetBtn = document.getElementById('tb-add-target');
  if (targetBtn) targetBtn.style.display = mode === 'image' ? '' : 'none';
  // Targets + Spatial tabs only make sense for image-target projects.
  // Spatial journeys are built on image-target-to-SLAM anchoring;
  // showing them for Surface/Face/Hand projects is misleading.
  document.querySelectorAll('.ws-tab[data-tab="targets"], .ws-tab[data-tab="spatial"]')
    .forEach(t => t.style.display = mode === 'image' ? '' : 'none');
  // If the user was on a hidden tab, switch to scene
  if (mode !== 'image' && (Studio.currentTab === 'targets' || Studio.currentTab === 'spatial')) {
    Studio.switchTab('scene');
  }
  // Target plane visibility
  if (Studio.Viewport.targetPlane) {
    Studio.Viewport.targetPlane.visible = mode === 'image';
  }
  // Show face/hand helper in viewport
  Studio.Viewport.removeTrackingHelper();
  if (mode === 'face' || mode === 'hand') {
    Studio.Viewport.showTrackingHelper(mode);
  }
  Studio.EventBus.emit('tracking:modeChanged', { mode });
  Studio.Hierarchy.render();
  // Auto-switch to targets tab when entering image mode
  if (mode === 'image' && Studio.currentTab === 'scene') {
    Studio.switchTab('targets');
  }
  Studio.log('Tracking: ' + mode);
};

// ─── QR Rendering ────────────────────────────────────────
// Shared renderer used by publish & preview modals. Defaults to splash
// accent (dark modules) + white (light modules). Customizable via the
// color pickers in the publish modal.
Studio._qrUrl = '';

Studio.renderQR = function(url) {
  const qrEl = document.getElementById('qr-code');
  const darkInp = document.getElementById('qr-dark');
  const lightInp = document.getElementById('qr-light');
  const themeRow = document.getElementById('qr-theme');
  if (!qrEl) return;

  if (url) Studio._qrUrl = url;
  const finalUrl = Studio._qrUrl;
  if (!finalUrl) return;

  const dark = (darkInp && darkInp.value) || '#7c3aed';
  const light = (lightInp && lightInp.value) || '#ffffff';

  qrEl.innerHTML = '';
  new QRCode(qrEl, { text: finalUrl, width: 180, height: 180, colorDark: dark, colorLight: light });
  if (themeRow) themeRow.style.display = 'flex';
};

Studio.resetQRColors = function() {
  const sp = Studio.Project.state.splash || {};
  const dark = sp.accentColor || '#7c3aed';
  const light = '#ffffff';
  const darkInp = document.getElementById('qr-dark');
  const lightInp = document.getElementById('qr-light');
  if (darkInp) darkInp.value = dark;
  if (lightInp) lightInp.value = light;
  Studio.renderQR();
};

Studio.downloadQR = function() {
  const qrEl = document.getElementById('qr-code');
  const canvas = qrEl?.querySelector('canvas');
  if (!canvas) { Studio.toast('QR not ready', 'err'); return; }
  const a = document.createElement('a');
  const name = (Studio.Project.state.name || 'ar-app').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  a.download = name + '-qr.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
};

// ─── Project Operations ──────────────────────────────────
Studio.newProject = function() {
  Studio.Project.reset();
  document.getElementById('tb-name').value = 'Untitled';
  // Reset tracking mode UI to default (slam)
  Studio.setTrackingMode('slam');
  Studio.Inspector.clear();
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

  // Project DATA saves to Firestore without a token (assets require
  // a token but are optional). The Save path stays unblocked so you
  // can always persist project changes. If there are assets to upload
  // and no token, individual upload blocks below log a hint — the
  // toolbar "Token" button surfaces the modal any time you want.
  const gh = Studio.GitHub.getConfig();
  if (state.splash.logoFile && !state.splash.logoUrl) {
    try {
      if (gh.token) {
        const path = 'assets/' + state.id + '/splash-logo.png';
        state.splash.logoUrl = await Studio.GitHub.upload(path, await Studio.GitHub.file2b64(state.splash.logoFile));
        state.splash.logoFile = null;
        Studio.log('Splash logo uploaded');
      }
    } catch(e) { Studio.log('Logo upload failed: ' + e.message); }
  }
  // PWA icons — upload if stale (cheap no-op when cached)
  if (gh.token) {
    try {
      await Studio.PWA.uploadIcons('assets/' + state.id);
    } catch(e) { Studio.log('PWA icons failed: ' + e.message); }
  }

  const data = Studio.Project.serialize();
  data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  if (!data.createdAt) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

  try {
    await Studio.Firebase.save(state.id, data);
    // Track our own save timestamp so the real-time listener can
    // distinguish our writes from remote writes (preview/player).
    Studio.Project._lastSaveTs = Date.now();
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

// Unsubscribe function for the current project's real-time listener.
// Called before opening a different project or on page unload.
Studio._unsubFirestore = null;

Studio._loadProjectById = async function(id) {
  const data = await Studio.Firebase.load(id);
  if (!data) { Studio.toast('Project not found', 'err'); return; }

  // Stop listening to the previous project (if any)
  if (Studio._unsubFirestore) { Studio._unsubFirestore(); Studio._unsubFirestore = null; }

  Studio.Project.state.id = id;
  Studio.Project.deserialize(data);
  document.getElementById('tb-name').value = Studio.Project.state.name;
  // Restore tracking mode UI
  Studio.setTrackingMode(Studio.Project.state.trackingMode);
  Studio.log('Opened: ' + Studio.Project.state.name);
  Studio.toast('Opened: ' + Studio.Project.state.name, 'ok');

  // ─── Real-time sync ─────────────────────────────────────
  // Subscribe to Firestore changes on this project. When any other
  // client (preview player, published player's in-app editor, another
  // browser tab) writes journeys[], the studio picks it up live —
  // no reload needed. This makes the spatial editor a true single
  // source of truth across all surfaces.
  Studio._unsubFirestore = Studio.Firebase.listen(id, (remoteData) => {
    // Only update journeys — don't overwrite the entire project state
    // (the user might have unsaved local edits to other fields).
    const remoteJourneys = remoteData.journeys || [];
    const localJourneys = Studio.Project.state.journeys || [];
    // Compare timestamps to avoid echoing our own saves
    const remoteTs = remoteData.updatedAt?.toMillis?.() || 0;
    const localTs = Studio.Project._lastSaveTs || 0;
    if (remoteTs > localTs && JSON.stringify(remoteJourneys) !== JSON.stringify(localJourneys)) {
      Studio.Project.state.journeys = remoteJourneys.map(j => JSON.parse(JSON.stringify(j)));
      Studio.log('[Sync] journey updated from remote (preview/player save)');
      // Re-push to the spatial editor if it's open
      if (Studio.Spatial._ready) Studio.Spatial._sendProject();
      // Re-render hierarchy to reflect any anchor changes
      Studio.Hierarchy.render();
    }
  });
};

Studio.publishProject = async function() {
  if (!Studio.Firebase.ready) { Studio.toast('Firebase not connected', 'err'); return; }
  const state = Studio.Project.state;
  if (state.objects.length === 0) { Studio.toast('Add models first', 'err'); return; }
  // Check for image targets (new multi-target system OR legacy single target)
  if (state.trackingMode === 'image') {
    const hasNewTargets = state.targets && state.targets.length > 0;
    const hasLegacyTarget = state.target.mindBuffer || state.target.mindUrl;
    if (!hasNewTargets && !hasLegacyTarget) {
      Studio.toast('Add an image target first', 'err'); return;
    }
  }

  const gh = Studio.GitHub.getConfig();
  if (!gh.token) {
    // Opened from Publish — saveToken should continue the publish flow.
    Studio._tokenModalFromPublish = true;
    document.getElementById('modal-token').classList.remove('hidden');
    return;
  }

  if (!state.id) state.id = Studio.Project._genId();
  const base = 'assets/' + state.id;
  Studio.toast('Publishing…', 'ok');

  try {
    // Upload target if needed
    if (state.target.mindBuffer && !state.target.mindUrl) {
      Studio.log('Uploading image target…');
      state.target.mindUrl = await Studio.GitHub.upload(base + '/target.mind', Studio.GitHub.ab2b64(state.target.mindBuffer));
    }
    if (state.target.imgFile && !state.target.imageUrl) {
      state.target.imageUrl = await Studio.GitHub.upload(base + '/target.png', await Studio.GitHub.file2b64(state.target.imgFile));
    }

    // Upload 8th Wall native image targets
    if (state.targets && state.targets.length > 0) {
      Studio.log('Uploading ' + state.targets.length + ' image target(s)…');
      await Studio.Targets.uploadTargets(base);
    }

    // Upload any PREFAB GLBs that haven't been uploaded yet (user added
    // a model without a GitHub token set, or the inline upload failed)
    const pendingPrefabs = (state.prefabs || []).filter(p => p.file && !p.glbUrl);
    if (pendingPrefabs.length) {
      Studio.log('Uploading ' + pendingPrefabs.length + ' prefab(s)…');
      await Promise.all(pendingPrefabs.map(async p => {
        const path = base + '/prefabs/' + p.id + '.glb';
        p.glbUrl = await Studio.GitHub.upload(path, await Studio.GitHub.file2b64(p.file));
        p.file = null;
        // Backfill glbUrl on existing instances of this prefab
        state.objects.forEach(o => { if (o.prefabId === p.id) o.glbUrl = p.glbUrl; });
        Studio.log('Uploaded prefab: ' + p.name);
      }));
    }

    // Legacy path: objects with inline file/glbUrl but no prefab
    const pending = state.objects.filter(o => o.file && !o.glbUrl);
    if (pending.length) {
      Studio.log('Uploading ' + pending.length + ' legacy model(s)…');
      await Promise.all(pending.map(async o => {
        const path = base + '/' + o.id + '.glb';
        o.glbUrl = await Studio.GitHub.upload(path, await Studio.GitHub.file2b64(o.file));
        Studio.log('Uploaded: ' + o.name);
      }));
    }

    // Save metadata
    await Studio.saveProject();

    const url = (window.AR_BASE_URL || location.origin) + '/player-v2.html?id=' + state.id;
    const qrEl = document.getElementById('qr-code');
    const urlEl = document.getElementById('pub-url');
    const statusEl = document.getElementById('deploy-status');

    // Show modal in "deploying" state — QR hidden until ready
    qrEl.innerHTML = '';
    urlEl.value = '';
    const themeRow = document.getElementById('qr-theme');
    if (themeRow) themeRow.style.display = 'none';
    statusEl.innerHTML = '<div style="color:var(--orange);font-size:14px;text-align:center;padding:20px">⏳ Publishing…<br><span style="font-size:11px;color:var(--muted)">Uploading assets and waiting for deployment</span></div>';
    document.getElementById('modal-publish').classList.remove('hidden');

    // Gather EVERY GitHub-hosted URL the published app will need —
    // any of these not-yet-propagated = the player can't render. The
    // publish modal isn't "Ready" until they're all live.
    const assetUrls = new Set();
    const addUrl = u => { if (u && typeof u === 'string' && u.includes('github.io')) assetUrls.add(u); };
    // GLBs (prefabs + direct instances)
    (state.prefabs || []).forEach(p => addUrl(p.glbUrl));
    state.objects.forEach(o => {
      addUrl(o.glbUrl);
      // Audio / video / image URLs on components
      const xr = o.xrComponents || {};
      Object.values(xr).forEach(cfg => {
        if (cfg && typeof cfg === 'object') {
          [cfg.src, cfg.video, cfg.image].forEach(addUrl);
        }
      });
    });
    // Image targets
    (state.targets || []).forEach(t => {
      addUrl(t.luminanceUrl); addUrl(t.originalUrl); addUrl(t.thumbnailUrl);
    });
    // Splash + PWA
    addUrl(state.splash?.logoUrl);
    addUrl(state.pwa?.icon192Url);
    addUrl(state.pwa?.icon512Url);
    addUrl(state.pwa?.appleIconUrl);
    const allUrls = [...assetUrls];
    const total = allUrls.length;

    const showReady = () => {
      urlEl.value = url;
      Studio.resetQRColors();
      Studio.renderQR(url);
      statusEl.innerHTML = '<div style="color:var(--green);font-size:13px;text-align:center">✅ Live and ready to scan!<br><span style="font-size:10px;color:var(--muted)">All assets propagated · Player v' + Studio.VERSION + '</span></div>';
      Studio.toast('Published & deployed ✓', 'ok');
    };

    if (total === 0) {
      // Firestore-only project — nothing to wait for
      showReady();
    } else {
      // Poll EVERY asset URL until all return 200. Show live
      // "Assets live: N / TOTAL" progress so the user sees
      // propagation happening. Firestore write is instant; GitHub
      // Pages propagation is the variable — usually 30-90s.
      Studio.log('Waiting for ' + total + ' asset(s) to propagate on GitHub Pages…');
      const start = Date.now();
      const live = new Set();

      const check1 = async (u) => {
        try {
          const r = await fetch(u + (u.includes('?') ? '&' : '?') + '_t=' + Date.now(),
                                { method: 'HEAD', cache: 'no-store' });
          if (r.ok) live.add(u);
        } catch (e) { /* retry next tick */ }
      };

      const paint = (elapsed) => {
        const n = live.size;
        const pct = Math.round(100 * n / total);
        const bar = '<div style="margin-top:8px;background:var(--bg);border-radius:3px;overflow:hidden;height:6px"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,var(--cyan),var(--purple));transition:width .3s"></div></div>';
        statusEl.innerHTML =
          '<div style="color:var(--orange);font-size:13px;text-align:center;padding:10px 0">' +
            '⏳ Assets live: ' + n + ' / ' + total + ' · ' + elapsed + 's' +
            '<div style="font-size:10px;color:var(--muted);margin-top:3px">GitHub Pages propagating — usually 30s-2min</div>' +
            bar +
          '</div>';
      };

      const tick = async () => {
        const pending = allUrls.filter(u => !live.has(u));
        await Promise.all(pending.map(check1));
        const elapsed = Math.round((Date.now() - start) / 1000);
        if (live.size === total) {
          Studio.log('All ' + total + ' assets live in ' + elapsed + 's');
          showReady();
          return;
        }
        paint(elapsed);
        if (Date.now() - start < 300000) {
          setTimeout(tick, 4000);
        } else {
          // Timeout — surface the remaining-missing count, still
          // show the QR so the user can retry in a moment.
          showReady();
          statusEl.innerHTML += '<div style="color:var(--orange);font-size:10px;margin-top:4px">' + (total - live.size) + ' asset(s) still propagating — they\'ll catch up shortly.</div>';
        }
      };

      paint(0);
      tick();
    }
    Studio.log('Published: ' + url);

  } catch(e) {
    Studio.toast('Publish failed: ' + e.message, 'err');
    Studio.log('ERROR: ' + e.message);
  }
};

Studio.previewProject = async function() {
  const state = Studio.Project.state;

  // Auto-save if needed
  if (!state.id || state.dirty) {
    if (!Studio.Firebase.ready) { Studio.toast('Firebase not connected', 'err'); return; }
    Studio.toast('Saving…', 'ok');
    await Studio.saveProject();
  }

  // Check if any models lack URLs (not yet uploaded)
  const missing = state.objects.filter(o => !o.glbUrl);
  let statusHtml = '';
  if (missing.length) {
    statusHtml = `<div style="color:var(--orange);font-size:12px;margin-bottom:8px">⚠ ${missing.length} model(s) not uploaded yet — use <strong>Publish</strong> to upload assets</div>`;
  } else {
    statusHtml = `<div style="color:var(--green);font-size:12px;margin-bottom:8px">✓ All assets ready</div>`;
  }

  const url = (window.AR_BASE_URL || location.origin) + '/player-v2.html?id=' + state.id;
  document.getElementById('pub-url').value = url;
  Studio.resetQRColors();
  Studio.renderQR(url);
  document.getElementById('deploy-status').innerHTML = `
    <div style="font-size:14px;font-weight:700;color:var(--cyan);margin-bottom:6px">📱 Dev Preview</div>
    ${statusHtml}
    <div style="font-size:11px;color:var(--muted);line-height:1.5">
      Scan this QR to test on your phone.<br>
      Sample models work instantly. Custom uploads need Publish first.
    </div>
  `;
  document.getElementById('modal-publish').classList.remove('hidden');
};

// Open the GitHub token modal on demand. Reachable from the toolbar
// "🔑 Token" button so you can set or update the token any time —
// not just when Save / Publish trips. Important after an origin move
// (Firebase ↔ GH Pages) because localStorage is origin-scoped and
// doesn't carry across.
Studio.openTokenModal = function() {
  // Pre-fill with the current value (if any) so "update" is obvious.
  const current = Studio.GitHub.getConfig().token || '';
  const input = document.getElementById('token-input');
  if (input) input.value = current;
  // Mark this as a standalone open (not part of a Publish flow) so
  // saveToken doesn't auto-trigger a publish afterwards.
  Studio._tokenModalFromPublish = false;
  document.getElementById('modal-token').classList.remove('hidden');
};

// Keep the toolbar button's label in sync with whether a token is
// set. Condensed to just the key icon (+ ✓ when set) so the toolbar
// has room for Publish on narrower viewports. Full wording lives
// in the tooltip for anyone unsure what the icon means.
Studio.refreshTokenIndicator = function() {
  const btn = document.getElementById('tb-token');
  if (!btn) return;
  const has = !!(Studio.GitHub.getConfig().token);
  btn.textContent = has ? '🔑 ✓' : '🔑';
  btn.title = has
    ? 'GitHub token set for this origin — click to update'
    : 'No GitHub token for this origin — click to enter';
  btn.style.opacity = has ? '1' : '0.9';
};

Studio.saveToken = function() {
  const token = document.getElementById('token-input').value.trim();
  if (!token) { Studio.toast('Paste a valid token', 'err'); return; }
  localStorage.setItem('4e-ar-gh-token', token);
  Studio.closeModal('modal-token');
  Studio.toast('Token saved', 'ok');
  Studio.refreshTokenIndicator();
  // Only continue into publish if the modal was opened from Publish.
  // When opened manually from the toolbar button, just save and stop.
  if (Studio._tokenModalFromPublish) {
    Studio._tokenModalFromPublish = false;
    Studio.publishProject();
  }
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
  // Duplicate the selected object (e.g. to spawn another prefab
  // instance for a different image target without re-clicking the
  // library card).
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); Studio.Viewport.duplicateSelected(); return; }
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
  Studio.Targets.init();
  Studio.CodeEditor.init();
  Studio.Splash.init();
  Studio.PWA.init();
  Studio.Preview.init();
  Studio.Spatial.init();

  // Single source of truth: <meta name="version"> in index.html.
  // Hardcoding it here caused a real-world bug where the toolbar kept
  // reading 3.10.6 after index.html had moved to 3.10.11 — the user
  // thought the deploy hadn't landed. Read it from the DOM so bumping
  // one line in index.html is all it takes.
  Studio.VERSION = (document.querySelector('meta[name="version"]')?.content) || 'dev';
  Studio.log('4E AR Studio v' + Studio.VERSION + ' ready');

  // Apply initial tracking mode tab visibility (default is 'slam' which
  // should hide Targets + Spatial tabs on boot). Without this, all tabs
  // are visible until the user clicks a mode button.
  Studio.setTrackingMode(Studio.Project.state.trackingMode);

  // Token indicator in the toolbar — reflects whether this origin has
  // a saved token. After a hosting change (GH Pages → Firebase) this
  // button will show unchecked so you know to paste the token in.
  Studio.refreshTokenIndicator();
  const tbVersion = document.getElementById('tb-version');
  if (tbVersion) {
    tbVersion.textContent = 'v' + Studio.VERSION;
    tbVersion.title = 'Studio v' + Studio.VERSION + ' · click to verify live';
    tbVersion.style.cursor = 'pointer';
    // Click the version pill to re-verify against the live server on
    // demand — useful for confirming "am I actually on latest?" with a
    // visible status instead of digging through the console.
    tbVersion.addEventListener('click', async () => {
      tbVersion.textContent = 'checking…';
      try {
        const [studioRes, playerRes] = await Promise.all([
          fetch(location.pathname + '?_c=' + Date.now(), { cache: 'no-store' }).then(r => r.text()),
          fetch('../player-v2.html?_c=' + Date.now(), { cache: 'no-store' }).then(r => r.text()),
        ]);
        const studioLive = (studioRes.match(/<meta name="version" content="([^"]+)">/) || [])[1] || '?';
        const playerLive = (playerRes.match(/<meta name="version" content="([^"]+)">/) || [])[1] || '?';
        const studioOk = studioLive === Studio.VERSION;
        const msg = (studioOk ? '✓' : '⚠') + ' Studio ' + Studio.VERSION +
                    ' / Player ' + playerLive +
                    (studioOk ? '' : ' (live studio: ' + studioLive + ' — reload to update)');
        Studio.toast(msg, studioOk ? 'ok' : 'warn');
        Studio.log(msg);
      } catch (e) {
        Studio.toast('Version check failed', 'err');
      } finally {
        tbVersion.textContent = 'v' + Studio.VERSION;
      }
    });
  }

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
