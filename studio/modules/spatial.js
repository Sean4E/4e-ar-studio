// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Spatial (iframe spatial-v7.html editor)
// ═══════════════════════════════════════════════════════════
// Mirrors the Studio.Preview pattern — when the user switches to the
// Spatial tab, we lazy-inject an iframe pointing at the standalone
// spatial editor (spatial/spatial-v7.html). The iframe stays alive
// across tab switches so editor state (selected anchor, particle
// tweaks, unsaved journey edits) isn't wiped when the user flips to
// another tab and back.
//
// Milestone 2 of the spatial integration plan: UI surface only, no
// data wiring yet. Later milestones add:
//   3. postMessage handshake (studio ↔ iframe)
//   4. Populate anchor dropdowns from project.targets
//   5. Populate traveller dropdowns from project.objects
//   6. Save journey back to project.journeys[] + Firestore

Studio.Spatial = {
  _iframe: null,
  _ready: false,  // true once the iframe announced itself

  init() {
    // Lazy-load the iframe only when the user actually opens the tab.
    // Keeps the Spatial tab from pre-loading React + Three.js at boot.
    Studio.EventBus.on('tab:switched', ({ tab }) => {
      if (tab === 'spatial') this._ensureIframe();
    });

    // Handshake listener (Milestone 3b).
    // Child iframe posts `4e-spatial-ready` after its React app mounts;
    // we respond with `4e-spatial-project` carrying the current project's
    // targets + traveller-suitable objects. Re-sent whenever the project
    // changes so the editor reflects loads / resets without a reload.
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === '4e-spatial-ready') {
        this._ready = true;
        this._sendProject();
      } else if (d.type === '4e-spatial-journey') {
        // Real save-back from the spatial editor. Stores the journey
        // in project.state.journeys[] and auto-creates/updates empty
        // objects for each anchor that has an image target assigned
        // (with targetId + imageToSlam set). This automates the manual
        // steps: add empty → assign target → enable SLAM.
        const j = d.journey || d.payload;
        if (j) {
          Studio.Project.setJourney(j);
          const n = (j.anchors || []).length;
          const bound = (j.anchors || []).filter(a => a.it && a.it.assigned).length;
          Studio.log(`[Spatial] journey saved — ${n} anchors, ${bound} bound to targets`);
          Studio.toast(`Journey saved ✓ (${bound} anchor${bound !== 1 ? 's' : ''} bound)`, 'ok');
          // Re-render hierarchy + assets to show the new anchor objects
          if (Studio.Hierarchy?.render) Studio.Hierarchy.render();
          if (Studio.Assets?.render) Studio.Assets.render();
        }
      }
    });

    // When the user loads or resets a project, re-push the data so the
    // editor stays in sync. No-op if the iframe hasn't announced yet —
    // _sendProject guards on _ready.
    Studio.EventBus.on('project:loaded', () => this._sendProject());
    Studio.EventBus.on('project:reset',  () => this._sendProject());
    // Objects + targets change frequently — re-push on each mutation so
    // the editor's dropdowns stay current without round-trips on each
    // dropdown open.
    Studio.EventBus.on('object:added',   () => this._sendProject());
    Studio.EventBus.on('object:removed', () => this._sendProject());
    Studio.EventBus.on('target:changed', () => this._sendProject());

    Studio.log('Spatial module ready');
  },

  _ensureIframe() {
    if (this._iframe) return;  // already loaded, keep state alive
    const container = document.getElementById('spatial-container');
    if (!container) return;

    this._iframe = document.createElement('iframe');
    // Load the standalone editor served from the same origin as the
    // studio (Firebase Hosting serves /spatial/ with the same no-cache
    // headers as everything else).
    this._iframe.src = '../spatial/spatial-v7.html';
    this._iframe.style.cssText = 'width:100%;height:100%;border:none;background:#060810;display:block';
    this._iframe.setAttribute('allow', 'clipboard-read;clipboard-write');
    this._iframe.setAttribute('title', '4E Spatial Editor');
    container.appendChild(this._iframe);
    Studio.log('[Spatial] iframe loaded');
  },

  // Build a minimal project snapshot for the editor. We deliberately
  // don't ship the whole project JSON — just what the editor needs
  // (image targets for anchor binding, traveller-suitable objects
  // for path travellers). Adding more fields later is a one-line
  // change here; the iframe already stores whatever arrives.
  _buildSnapshot() {
    const s = Studio.Project?.state || {};
    return {
      id: s.id || null,
      name: s.name || '',
      trackingMode: s.trackingMode || 'slam',
      // Saved journey — the spatial editor restores anchors, sequence,
      // path configs, and global traveller from this on reconnect so
      // the user's work persists across tab switches and reloads.
      journey: (s.journeys && s.journeys[0]) || null,
      // Image targets that can be bound to anchors.
      targets: (s.targets || []).map(t => ({
        id: t.id,
        name: t.name || '',
        widthM: t.properties?.widthM || 0.1,
        thumbnailUrl: t._thumbnailDataUrl || t.thumbnailUrl || '',
      })),
      // Objects suitable as travellers: anything with geometry
      // (primitives or GLBs), excluding `empty` containers that
      // would render invisibly.
      // Resolve each model's best-available URL: the in-session blob
      // (survives before publish) takes priority over the GitHub URL
      // (only reliable after propagation). For unsaved files sitting
      // only as prefab.file, create the blob URL on-demand so the
      // iframe can fetch it same-origin.
      objects: (s.objects || [])
        .filter(o => (o.type === 'primitive' && o.primitiveType !== 'empty') || o.glbUrl || o.prefabId)
        .map(o => {
          let bestUrl = o.glbUrl || null;
          if (o.prefabId) {
            const pf = (s.prefabs || []).find(p => p.id === o.prefabId);
            if (pf) {
              if (!pf._blobUrl && pf.file) {
                try { pf._blobUrl = URL.createObjectURL(pf.file); } catch (_) {}
              }
              bestUrl = pf._blobUrl || pf.glbUrl || bestUrl;
            }
          }
          return {
            id: o.id,
            name: o.name || '',
            kind: o.type === 'primitive' ? 'primitive' : 'model',
            primitiveType: o.primitiveType || null,
            glbUrl: bestUrl,
            color: o.primitiveColor || null,
            // Clip names — populated by _loadModelIntoScene on first
            // GLB import. Used by the spatial editor to show an
            // Animation dropdown under a picked traveller object.
            clips: Array.isArray(o.clips) ? [...o.clips] : [],
          };
        }),
    };
  },

  _sendProject() {
    if (!this._ready || !this._iframe?.contentWindow) return;
    const project = this._buildSnapshot();
    try {
      this._iframe.contentWindow.postMessage({
        type: '4e-spatial-project',
        project,
      }, '*');
    } catch (e) {
      Studio.log('[Spatial] postMessage failed: ' + e.message);
    }
  },
};
