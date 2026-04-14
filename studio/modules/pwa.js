// ═══════════════════════════════════════════════════════════
// 4E AR Studio — PWA helpers
// Generates app icons from the splash logo (or a 4E fallback),
// uploads them on publish, and primes transient blobs on save.
// ═══════════════════════════════════════════════════════════

Studio.PWA = {
  // Sizes we produce. 180 is apple-touch-icon, 192/512 are manifest icons.
  SIZES: [192, 512, 180],

  // Cached blobs keyed by size — regenerated when the splash logo changes
  _blobs: {},
  _sourceKey: '',  // identifies the current source (url + bgColor) so we know when to regen

  init() {
    Studio.EventBus.on('project:loaded', () => this._reset());
    Studio.EventBus.on('project:reset', () => this._reset());
  },

  _reset() {
    this._blobs = {};
    this._sourceKey = '';
  },

  // Build a cache key so we only regenerate when source actually changes.
  // Uses the uploaded logoUrl (persistent) rather than the blob: URL, plus
  // bgColor and accentColor which affect the rendered icon.
  _currentKey() {
    const sp = Studio.Project.state.splash;
    return (sp.logoUrl || '') + '|' + (sp.bgColor || '') + '|' + (sp.accentColor || '');
  },

  // Load an image (with CORS) and return a canvas drawing
  _loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });
  },

  // Render a size-by-size icon: logo centered on splash bgColor, padded
  async _renderIcon(size, img, bgColor) {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');

    // Background (solid splash bg)
    ctx.fillStyle = bgColor || '#060a18';
    ctx.fillRect(0, 0, size, size);

    if (img) {
      // Fit logo within ~70% of the canvas, preserving aspect
      const pad = size * 0.15;
      const maxW = size - pad * 2;
      const maxH = size - pad * 2;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (size - w) / 2;
      const y = (size - h) / 2;
      ctx.drawImage(img, x, y, w, h);
    } else {
      // Procedural 4E fallback — accent-colored "4E" on bg
      const accent = Studio.Project.state.splash.accentColor || '#8b5cf6';
      ctx.fillStyle = accent;
      ctx.font = `700 ${Math.round(size * 0.5)}px "Syne", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('4E', size / 2, size / 2 + size * 0.02);
    }

    return new Promise(res => cv.toBlob(res, 'image/png'));
  },

  // Prime icon blobs in memory. Lazy — regenerates only if source changed.
  async primeIcons() {
    const key = this._currentKey();
    if (key === this._sourceKey && Object.keys(this._blobs).length === this.SIZES.length) {
      return this._blobs;  // already primed
    }
    const sp = Studio.Project.state.splash;
    // Prefer the persistent logoUrl (so keys are stable across reloads), but
    // fall back to the transient blob URL if the logo was just uploaded and
    // hasn't been persisted yet (e.g. during publish before GitHub upload).
    const src = sp.logoUrl || sp._blobUrl || '';

    let img = null;
    if (src) {
      try { img = await this._loadImage(src); }
      catch(e) { Studio.log('PWA: logo load failed, using 4E fallback'); }
    }

    const blobs = {};
    for (const size of this.SIZES) {
      blobs[size] = await this._renderIcon(size, img, sp.bgColor);
    }
    this._blobs = blobs;
    this._sourceKey = key;
    return blobs;
  },

  // Upload icons to GitHub under assets/{id}/pwa/ and return URL map.
  // Only uploads if icons aren't already in state.pwa or source changed.
  async uploadIcons(basePath) {
    const state = Studio.Project.state;
    state.pwa = state.pwa || {};

    // If we already have URLs AND the source hasn't changed since, skip.
    const sourceNow = this._currentKey();
    if (state.pwa.icon192Url && state.pwa.icon512Url && state.pwa.appleIconUrl
        && state.pwa.sourceKey === sourceNow) {
      return state.pwa;
    }

    await this.primeIcons();
    const blob2b64 = blob => new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });

    const map = { 192: 'icon-192.png', 512: 'icon-512.png', 180: 'apple-icon.png' };
    const urls = {};
    for (const size of this.SIZES) {
      const blob = this._blobs[size];
      if (!blob) continue;
      const path = basePath + '/pwa/' + map[size];
      urls[size] = await Studio.GitHub.upload(path, await blob2b64(blob));
    }

    state.pwa = {
      icon192Url: urls[192] || '',
      icon512Url: urls[512] || '',
      appleIconUrl: urls[180] || '',
      sourceKey: sourceNow,
    };
    return state.pwa;
  },
};
