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

  init() {
    // Lazy-load the iframe only when the user actually opens the tab.
    // Keeps the Spatial tab from pre-loading React + Three.js at boot.
    Studio.EventBus.on('tab:switched', ({ tab }) => {
      if (tab === 'spatial') this._ensureIframe();
    });
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
};
