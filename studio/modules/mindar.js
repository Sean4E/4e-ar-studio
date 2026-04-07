// ═══════════════════════════════════════════════════════════
// 4E AR Studio — MindAR (image-target compiler)
// ═══════════════════════════════════════════════════════════

Studio.MindAR = {
  _compiler: null,
  _loaded: false,

  /**
   * Compile an image file into a MindAR .mind target buffer.
   * Dynamically imports the mind-ar ES module on first use.
   *
   * The resulting ArrayBuffer is stored in
   * Studio.Project.state.target.mindBuffer for later upload.
   *
   * @param {File} file — image file (png / jpg)
   * @returns {Promise<ArrayBuffer>}
   */
  async compile(file) {
    if (!this._loaded) {
      Studio.log('MindAR: loading compiler...');
      try {
        const mod = await import(
          'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js'
        );
        // mind-ar exposes the compiler on the default export or window
        this._compiler = mod.MindARCompiler || mod.default?.MindARCompiler || window.MindARCompiler;
        if (!this._compiler) {
          // Some builds attach to MINDAR.IMAGE
          this._compiler = window.MINDAR?.IMAGE?.Compiler;
        }
        this._loaded = true;
        Studio.log('MindAR: compiler loaded');
      } catch (e) {
        Studio.log('MindAR: failed to load compiler — ' + e.message);
        throw e;
      }
    }

    if (!this._compiler) {
      throw new Error('MindAR compiler not available');
    }

    // Create a compiler instance and compile the image
    const compiler = new this._compiler();

    // Read image as data-url for the compiler
    const dataUrl = await this._fileToDataUrl(file);
    const img = await this._loadImage(dataUrl);

    Studio.log('MindAR: compiling target (' + img.width + 'x' + img.height + ')...');
    await compiler.compileImageTargets([img], (progress) => {
      const pct = Math.round(progress * 100);
      Studio.EventBus.emit('mindar:progress', { percent: pct });
    });

    const buffer = await compiler.exportData();
    Studio.Project.state.target.mindBuffer = buffer;
    Studio.log('MindAR: compilation complete (' + (buffer.byteLength / 1024).toFixed(1) + ' KB)');
    Studio.EventBus.emit('mindar:compiled', { size: buffer.byteLength });
    return buffer;
  },

  // ─── Helpers ──────────────────────────────────────────
  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  },

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  },

  init() {
    Studio.log('MindAR module ready');
  }
};
