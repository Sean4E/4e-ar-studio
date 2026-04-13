// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Image Targets Workspace
// In-browser processing (Canvas API), quality scoring,
// multi-target management, content assignment.
// Replaces MindAR compilation with 8th Wall native format.
// ═══════════════════════════════════════════════════════════

Studio.Targets = {
  _selectedId: null,

  // ─── Constants (match 8th Wall CLI) ─────────────────────
  LUMINANCE_W: 480,
  LUMINANCE_H: 640,
  THUMB_W: 263,
  THUMB_H: 350,
  MIN_W: 480,
  MIN_H: 640,

  // ─── Init ──────────────────────────────────────────────
  init() {
    Studio.EventBus.on('project:loaded', () => { this._selectedId = null; this.render(); });
    Studio.EventBus.on('project:reset', () => { this._selectedId = null; this.render(); });
    Studio.EventBus.on('tracking:modeChanged', () => this.render());
    Studio.EventBus.on('object:added', () => this._renderDetails());
    Studio.EventBus.on('object:removed', () => this._renderDetails());
    Studio.EventBus.on('tab:switched', ({ tab }) => { if (tab === 'targets') this.render(); });

    // Drag-and-drop on workspace
    const container = document.getElementById('targets-container');
    if (container) {
      container.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; container.classList.add('tgt-dragover'); });
      container.addEventListener('dragleave', () => container.classList.remove('tgt-dragover'));
      container.addEventListener('drop', e => { e.preventDefault(); container.classList.remove('tgt-dragover'); this._handleDrop(e); });
    }

    this.render();
    Studio.log('Targets workspace ready');
  },

  // ─── Handle Drop ───────────────────────────────────────
  _handleDrop(e) {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) { Studio.toast('Drop image files', 'err'); return; }
    files.forEach(f => this.processFile(f));
  },

  // ─── Add Target (file picker) ──────────────────────────
  addTarget() {
    document.getElementById('fi-target-new').click();
  },

  // ─── Load Sample Target ───────────────────────────────
  async loadSampleTarget() {
    try {
      Studio.toast('Loading sample target…', 'ok');
      const resp = await fetch('../samples/target-sample.png');
      const blob = await resp.blob();
      const file = new File([blob], 'target-sample.png', { type: 'image/png' });

      // Ensure we're in image mode
      if (Studio.Project.state.trackingMode !== 'image') {
        Studio.setTrackingMode('image');
      }

      // Process through the full pipeline
      await this.processFile(file);

      // Switch to targets tab to show result
      Studio.switchTab('targets');
    } catch (e) {
      Studio.toast('Failed to load sample: ' + e.message, 'err');
    }
  },

  // ─── Process Image File → Target ──────────────────────
  async processFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      Studio.toast('Not an image file', 'err');
      return;
    }

    Studio.toast('Processing ' + file.name + '…', 'ok');

    try {
      const img = await this._loadImage(file);

      // Validate minimum size
      if (img.width < this.MIN_W && img.height < this.MIN_H) {
        Studio.toast('Image too small — minimum ' + this.MIN_W + '×' + this.MIN_H, 'err');
        return;
      }

      // Clean name
      const name = file.name.replace(/\.\w+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || 'target';

      // Check for duplicate name
      const targets = Studio.Project.state.targets;
      let finalName = name;
      let n = 1;
      while (targets.some(t => t.name === finalName)) {
        finalName = name + '_' + (++n);
      }

      // Auto-crop to 3:4 ratio
      const crop = this._autoCrop(img.width, img.height);

      // Generate luminance (480×640 grayscale)
      const lumCanvas = this._generateLuminance(img, crop);

      // Generate thumbnail (263×350)
      const thumbCanvas = this._generateThumbnail(img, crop);

      // Quality analysis
      const quality = this._analyzeQuality(lumCanvas);

      // Build target object
      const target = {
        id: 'tgt_' + Studio.Project._genId(),
        name: finalName,
        type: 'PLANAR',
        quality: quality,
        properties: {
          top: crop.top,
          left: crop.left,
          width: crop.width,
          height: crop.height,
          originalWidth: img.width,
          originalHeight: img.height,
          isRotated: false,
        },
        // Transient (not serialized)
        _imageFile: file,
        _luminanceDataUrl: lumCanvas.toDataURL('image/jpeg', 0.9),
        _thumbnailDataUrl: thumbCanvas.toDataURL('image/jpeg', 0.85),
        // URLs (set after publish/upload)
        originalUrl: '',
        luminanceUrl: '',
        thumbnailUrl: '',
        // Content assignment
        objectIds: [],
      };

      targets.push(target);
      Studio.Project.markDirty();

      this._selectedId = target.id;
      this.render();
      Studio.EventBus.emit('target:changed');

      const qLabel = quality >= 70 ? 'Excellent' : quality >= 45 ? 'Good' : quality >= 25 ? 'Fair' : 'Poor';
      Studio.toast(finalName + ' added — Quality: ' + qLabel + ' (' + quality + ')', 'ok');
      Studio.log('Target processed: ' + finalName + ' (' + img.width + '×' + img.height + ', quality ' + quality + ')');

    } catch (e) {
      Studio.toast('Processing failed: ' + e.message, 'err');
      Studio.log('Target processing error: ' + e.message);
    }
  },

  // ─── Remove Target ─────────────────────────────────────
  removeTarget(id) {
    const targets = Studio.Project.state.targets;
    const idx = targets.findIndex(t => t.id === id);
    if (idx < 0) return;

    // Unassign objects
    const target = targets[idx];
    (target.objectIds || []).forEach(oid => {
      const obj = Studio.Project.getObject(oid);
      if (obj) obj.targetId = null;
    });

    targets.splice(idx, 1);
    if (this._selectedId === id) this._selectedId = targets[0]?.id || null;
    Studio.Project.markDirty();
    this.render();
    Studio.EventBus.emit('target:changed');
    Studio.toast('Target removed', 'ok');
  },

  // ─── Rename Target ─────────────────────────────────────
  renameTarget(id, newName) {
    const target = this._getTarget(id);
    if (!target) return;
    // Sanitise
    newName = newName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'target';
    target.name = newName;
    Studio.Project.markDirty();
    this.render();
  },

  // ─── Replace Target Image ───────────────────────────────
  replaceImage(id) {
    const target = this._getTarget(id);
    if (!target) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const img = await this._loadImage(file);
        const crop = this._autoCrop(img.width, img.height);
        const lumCanvas = this._generateLuminance(img, crop);
        const thumbCanvas = this._generateThumbnail(img, crop);
        const quality = this._analyzeQuality(lumCanvas);

        target.quality = quality;
        target.properties = { top: crop.top, left: crop.left, width: crop.width, height: crop.height, originalWidth: img.width, originalHeight: img.height, isRotated: false };
        target._imageFile = file;
        target._luminanceDataUrl = lumCanvas.toDataURL('image/jpeg', 0.9);
        target._thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.85);

        // Upload immediately so the image persists across saves
        const gh = Studio.GitHub.getConfig();
        if (gh.token) {
          const projId = Studio.Project.state.id || Studio.Project._genId();
          if (!Studio.Project.state.id) Studio.Project.state.id = projId;
          const base = 'assets/' + projId;

          Studio.toast('Uploading replacement image…', 'ok');
          try {
            const origB64 = await Studio.GitHub.file2b64(file);
            target.originalUrl = await Studio.GitHub.upload(base + '/' + target.id + '_original.jpg', origB64);
            target.luminanceUrl = await Studio.GitHub.upload(base + '/' + target.id + '_luminance.jpg',
              target._luminanceDataUrl.split(',')[1]);
            target.thumbnailUrl = await Studio.GitHub.upload(base + '/' + target.id + '_thumb.jpg',
              target._thumbnailDataUrl.split(',')[1]);
          } catch(e) {
            Studio.log('Upload failed, will retry on publish: ' + e.message);
            // Clear URLs so publish re-uploads
            target.originalUrl = '';
            target.luminanceUrl = '';
            target.thumbnailUrl = '';
          }
        } else {
          // No token — clear URLs, will upload on publish
          target.originalUrl = '';
          target.luminanceUrl = '';
          target.thumbnailUrl = '';
        }

        Studio.Project.markDirty();
        this.render();
        Studio.EventBus.emit('target:changed');

        const qLabel = quality >= 70 ? 'Excellent' : quality >= 45 ? 'Good' : quality >= 25 ? 'Fair' : 'Poor';
        Studio.toast('Image replaced — Quality: ' + qLabel + ' (' + quality + ')', 'ok');
      } catch (e) {
        Studio.toast('Replace failed: ' + e.message, 'err');
      }
    };
    input.click();
  },

  // ─── Assign / Unassign Object ──────────────────────────
  assignObject(targetId, objectId) {
    const target = this._getTarget(targetId);
    if (!target) return;
    const obj = Studio.Project.getObject(objectId);
    if (!obj) return;

    // Remove from any other target first
    Studio.Project.state.targets.forEach(t => {
      t.objectIds = (t.objectIds || []).filter(id => id !== objectId);
    });

    // Add to this target
    if (!target.objectIds) target.objectIds = [];
    if (!target.objectIds.includes(objectId)) {
      target.objectIds.push(objectId);
    }
    obj.targetId = targetId;
    Studio.Project.markDirty();
    this._renderDetails();
  },

  unassignObject(targetId, objectId) {
    const target = this._getTarget(targetId);
    if (!target) return;
    target.objectIds = (target.objectIds || []).filter(id => id !== objectId);
    const obj = Studio.Project.getObject(objectId);
    if (obj) obj.targetId = null;
    Studio.Project.markDirty();
    this._renderDetails();
  },

  // ─── Get Target Helper ─────────────────────────────────
  _getTarget(id) {
    return Studio.Project.state.targets.find(t => t.id === id) || null;
  },

  // ═══════════════════════════════════════════════════════
  // IMAGE PROCESSING (Canvas API — replaces 8th Wall CLI)
  // ═══════════════════════════════════════════════════════

  _loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  },

  _autoCrop(w, h) {
    // Crop to 3:4 aspect ratio (portrait)
    const targetRatio = 3 / 4;
    const imgRatio = w / h;
    let cropW, cropH, left, top;

    if (imgRatio > targetRatio) {
      // Wider — crop sides
      cropH = h;
      cropW = Math.round(h * targetRatio);
      left = Math.round((w - cropW) / 2);
      top = 0;
    } else {
      // Taller — crop top/bottom
      cropW = w;
      cropH = Math.round(w / targetRatio);
      left = 0;
      top = Math.round((h - cropH) / 2);
    }

    return { left, top, width: cropW, height: cropH };
  },

  _generateLuminance(img, crop) {
    const canvas = document.createElement('canvas');
    canvas.width = this.LUMINANCE_W;
    canvas.height = this.LUMINANCE_H;
    const ctx = canvas.getContext('2d');

    // Draw cropped region scaled to 480×640
    ctx.drawImage(img, crop.left, crop.top, crop.width, crop.height, 0, 0, this.LUMINANCE_W, this.LUMINANCE_H);

    // Convert to grayscale (ITU-R BT.601 luma)
    const imageData = ctx.getImageData(0, 0, this.LUMINANCE_W, this.LUMINANCE_H);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  },

  _generateThumbnail(img, crop) {
    const canvas = document.createElement('canvas');
    canvas.width = this.THUMB_W;
    canvas.height = this.THUMB_H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, crop.left, crop.top, crop.width, crop.height, 0, 0, this.THUMB_W, this.THUMB_H);
    return canvas;
  },

  // ─── Quality Analysis ─────────────────────────────────
  // Scores 0–100 based on contrast + edge detail.
  // Good image targets: high local contrast, varied texture,
  // non-repetitive, asymmetric features.
  _analyzeQuality(lumCanvas) {
    const ctx = lumCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, this.LUMINANCE_W, this.LUMINANCE_H);
    const d = imageData.data;
    const w = this.LUMINANCE_W, h = this.LUMINANCE_H;
    const total = w * h;

    // 1. Histogram & standard deviation (contrast)
    const hist = new Array(256).fill(0);
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      hist[d[i]]++;
      sum += d[i];
    }
    const mean = sum / total;
    let variance = 0;
    for (let i = 0; i < 256; i++) {
      variance += hist[i] * (i - mean) * (i - mean);
    }
    const stdDev = Math.sqrt(variance / total);

    // 2. Edge strength (simplified Sobel)
    let edgeSum = 0, edgeCount = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        const gx = d[idx + 4] - d[idx - 4];
        const gy = d[idx + w * 4] - d[idx - w * 4];
        edgeSum += Math.sqrt(gx * gx + gy * gy);
        edgeCount++;
      }
    }
    const edgeAvg = edgeSum / edgeCount;

    // 3. Feature distribution — check that detail isn't concentrated in one area
    // Split into 4×4 grid, measure edge variance across cells
    const gridSize = 4;
    const cellW = Math.floor(w / gridSize), cellH = Math.floor(h / gridSize);
    const cellEdges = [];
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        let cellSum = 0, cellCount = 0;
        for (let y = gy * cellH + 1; y < (gy + 1) * cellH - 1; y++) {
          for (let x = gx * cellW + 1; x < (gx + 1) * cellW - 1; x++) {
            const idx = (y * w + x) * 4;
            const ex = d[idx + 4] - d[idx - 4];
            const ey = d[idx + w * 4] - d[idx - w * 4];
            cellSum += Math.sqrt(ex * ex + ey * ey);
            cellCount++;
          }
        }
        cellEdges.push(cellSum / cellCount);
      }
    }
    const cellMean = cellEdges.reduce((a, b) => a + b, 0) / cellEdges.length;
    let cellVar = 0;
    cellEdges.forEach(v => cellVar += (v - cellMean) * (v - cellMean));
    cellVar /= cellEdges.length;
    const uniformity = 1 - Math.min(1, Math.sqrt(cellVar) / (cellMean + 1));

    // Combine scores
    const contrastScore = Math.min(100, (stdDev / 55) * 100);       // std ~55 = excellent
    const detailScore = Math.min(100, (edgeAvg / 25) * 100);        // avg edge ~25 = excellent
    const uniformScore = uniformity * 100;                             // 100 = perfectly distributed

    const final = Math.round(contrastScore * 0.3 + detailScore * 0.45 + uniformScore * 0.25);
    return Math.max(0, Math.min(100, final));
  },

  // ═══════════════════════════════════════════════════════
  // UPLOAD (called from Studio.publishProject)
  // ═══════════════════════════════════════════════════════

  async uploadTargets(basePath) {
    const targets = Studio.Project.state.targets;
    if (!targets.length) return;

    for (const target of targets) {
      // Skip if already uploaded
      if (target.luminanceUrl && target.originalUrl) continue;

      const prefix = basePath + '/targets/' + target.name;

      // Upload luminance
      if (target._luminanceDataUrl && !target.luminanceUrl) {
        const lumB64 = target._luminanceDataUrl.split(',')[1];
        target.luminanceUrl = await Studio.GitHub.upload(prefix + '_luminance.jpg', lumB64);
        Studio.log('Uploaded luminance: ' + target.name);
      }

      // Upload thumbnail
      if (target._thumbnailDataUrl && !target.thumbnailUrl) {
        const thumbB64 = target._thumbnailDataUrl.split(',')[1];
        target.thumbnailUrl = await Studio.GitHub.upload(prefix + '_thumbnail.jpg', thumbB64);
      }

      // Upload original
      if (target._imageFile && !target.originalUrl) {
        const origB64 = await Studio.GitHub.file2b64(target._imageFile);
        target.originalUrl = await Studio.GitHub.upload(prefix + '_original.' + (target._imageFile.name.split('.').pop() || 'png'), origB64);
        Studio.log('Uploaded original: ' + target.name);
      }
    }
  },

  // Build 8th Wall imageTargetData array for player
  buildTargetData() {
    return Studio.Project.state.targets
      .filter(t => t.luminanceUrl)
      .map(t => ({
        imagePath: t.luminanceUrl,
        name: t.name,
        type: t.type || 'PLANAR',
        metadata: null,
        properties: t.properties,
        resources: {
          luminanceImage: t.luminanceUrl,
          originalImage: t.originalUrl || t.luminanceUrl,
          thumbnailImage: t.thumbnailUrl || t.luminanceUrl,
          croppedImage: t.luminanceUrl,
        },
        loadAutomatically: true,
        created: Date.now(),
        updated: Date.now(),
      }));
  },

  // ═══════════════════════════════════════════════════════
  // WORKSPACE UI
  // ═══════════════════════════════════════════════════════

  render() {
    const container = document.getElementById('targets-container');
    if (!container) return;

    const mode = Studio.Project.state.trackingMode;
    if (mode !== 'image') {
      container.innerHTML = `
        <div class="tgt-mode-hint">
          <div class="tgt-mode-icon">📷</div>
          <div class="tgt-mode-title">Image Targets</div>
          <div class="tgt-mode-desc">Switch to <strong>Image</strong> tracking mode to manage image targets.</div>
          <button class="tb-btn" onclick="Studio.setTrackingMode('image')">Switch to Image Mode</button>
        </div>`;
      return;
    }

    const targets = Studio.Project.state.targets;

    container.innerHTML = `
      <div class="tgt-library">
        <div class="tgt-lib-header">
          <span class="tgt-lib-title">Targets (${targets.length})</span>
          <button class="tb-btn" onclick="Studio.Targets.addTarget()" title="Add image target">+ Add Target</button>
        </div>
        <div class="tgt-grid" id="tgt-grid">
          ${targets.map(t => this._renderCard(t)).join('')}
          <div class="tgt-card tgt-card-add" onclick="Studio.Targets.addTarget()">
            <div class="tgt-card-add-icon">+</div>
            <div class="tgt-card-add-label">Drop image<br>or click to add</div>
          </div>
        </div>
        ${targets.length === 0 ? `
        <div class="tgt-empty-hint">
          <p>Upload images that will trigger your AR content.</p>
          <p class="tgt-tips-title">Tips for good targets:</p>
          <ul class="tgt-tips">
            <li>High contrast photos with lots of detail</li>
            <li>Avoid logos, simple shapes, or text-heavy images</li>
            <li>Non-symmetric patterns work best</li>
            <li>Minimum 480 x 640 pixels</li>
            <li>Matte/non-reflective when printed</li>
          </ul>
        </div>` : ''}
      </div>
      <div class="tgt-details" id="tgt-details"></div>
    `;

    // Re-bind drag-drop
    const grid = document.getElementById('tgt-grid');
    if (grid) {
      grid.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; grid.classList.add('tgt-dragover'); });
      grid.addEventListener('dragleave', () => grid.classList.remove('tgt-dragover'));
      grid.addEventListener('drop', e => { e.preventDefault(); grid.classList.remove('tgt-dragover'); this._handleDrop(e); });
    }

    this._renderDetails();
  },

  _renderCard(target) {
    const sel = this._selectedId === target.id;
    const thumb = target._thumbnailDataUrl || target.thumbnailUrl || '';
    const qClass = target.quality >= 70 ? 'excellent' : target.quality >= 45 ? 'good' : target.quality >= 25 ? 'fair' : 'poor';
    const assignedCount = (target.objectIds || []).length;

    return `
      <div class="tgt-card ${sel ? 'selected' : ''}" onclick="Studio.Targets.selectTarget('${target.id}')">
        <div class="tgt-card-thumb" style="background-image: url('${thumb}')"></div>
        <div class="tgt-card-info">
          <div class="tgt-card-name">${target.name}</div>
          <div class="tgt-card-meta">
            <span class="tgt-quality-dot ${qClass}"></span>
            <span>${target.quality}</span>
            ${assignedCount > 0 ? `<span class="tgt-card-assigned">${assignedCount} obj</span>` : ''}
          </div>
        </div>
      </div>`;
  },

  selectTarget(id) {
    this._selectedId = id;
    // Update card selection visuals
    document.querySelectorAll('.tgt-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.tgt-card[onclick*="${id}"]`);
    if (card) card.classList.add('selected');
    this._renderDetails();
  },

  _renderDetails() {
    const container = document.getElementById('tgt-details');
    if (!container) return;

    const target = this._getTarget(this._selectedId);
    if (!target) {
      container.innerHTML = '<div class="tgt-detail-empty">Select a target to view details</div>';
      return;
    }

    const thumb = target._thumbnailDataUrl || target.thumbnailUrl || '';
    const qClass = target.quality >= 70 ? 'excellent' : target.quality >= 45 ? 'good' : target.quality >= 25 ? 'fair' : 'poor';
    const qLabel = target.quality >= 70 ? 'Excellent' : target.quality >= 45 ? 'Good' : target.quality >= 25 ? 'Fair' : 'Poor';
    const uploaded = !!(target.luminanceUrl && target.originalUrl);

    // Available objects (all objects in the project)
    const allObjects = Studio.Project.state.objects;
    const assignedIds = target.objectIds || [];

    container.innerHTML = `
      <div class="tgt-detail-scroll">

        <!-- Target Name -->
        <div class="tgt-detail-section">
          <label class="tgt-detail-label">Name</label>
          <input class="insp-input" value="${target.name}" onchange="Studio.Targets.renameTarget('${target.id}', this.value)" style="width:100%;flex:none">
        </div>

        <!-- Preview -->
        <div class="tgt-detail-section">
          <label class="tgt-detail-label">Preview</label>
          <div class="tgt-preview">
            <img src="${thumb}" class="tgt-preview-img" onerror="this.style.display='none'">
          </div>
        </div>

        <!-- Quality -->
        <div class="tgt-detail-section">
          <label class="tgt-detail-label">Tracking Quality</label>
          <div class="tgt-quality-bar-wrap">
            <div class="tgt-quality-bar ${qClass}" style="width:${target.quality}%"></div>
          </div>
          <div class="tgt-quality-text ${qClass}">${qLabel} (${target.quality}/100)</div>
          ${target.quality < 45 ? '<div class="tgt-quality-warn">This image may not track reliably. Use a photo with more detail and contrast.</div>' : ''}
        </div>

        <!-- Info -->
        <div class="tgt-detail-section">
          <label class="tgt-detail-label">Details</label>
          <div class="tgt-detail-row"><span>Original size</span><span>${target.properties.originalWidth} × ${target.properties.originalHeight}</span></div>
          <div class="tgt-detail-row"><span>Crop region</span><span>${target.properties.width} × ${target.properties.height}</span></div>
          <div class="tgt-detail-row"><span>Type</span><span>${target.type}</span></div>
          <div class="tgt-detail-row"><span>Status</span><span class="${uploaded ? 'tgt-status-ok' : 'tgt-status-pending'}">${uploaded ? '✓ Uploaded' : '⏳ Pending upload'}</span></div>
        </div>

        <!-- Content Assignment -->
        <div class="tgt-detail-section">
          <label class="tgt-detail-label">Assigned Content</label>
          ${assignedIds.length === 0 && allObjects.length === 0 ? '<div class="tgt-detail-hint">Add models to your scene first, then assign them to this target.</div>' : ''}
          ${assignedIds.map(oid => {
            const obj = Studio.Project.getObject(oid);
            if (!obj) return '';
            return `
              <div class="tgt-assign-item">
                <span class="tgt-assign-icon">📦</span>
                <span class="tgt-assign-name">${obj.name}</span>
                <button class="tgt-assign-remove" onclick="Studio.Targets.unassignObject('${target.id}', '${oid}')" title="Remove">✕</button>
              </div>`;
          }).join('')}
          ${allObjects.filter(o => !assignedIds.includes(o.id)).length > 0 ? `
          <div class="tgt-assign-add">
            <select class="insp-select" id="tgt-assign-select" onchange="if(this.value){Studio.Targets.assignObject('${target.id}', this.value); this.value='';}">
              <option value="">+ Assign object…</option>
              ${allObjects.filter(o => !assignedIds.includes(o.id)).map(o =>
                `<option value="${o.id}">${o.name}</option>`
              ).join('')}
            </select>
          </div>` : ''}
        </div>

        <!-- Actions -->
        <div class="tgt-detail-section">
          <button class="insp-btn" onclick="Studio.Targets.replaceImage('${target.id}')" style="margin-bottom:6px">Replace Image</button>
          <button class="insp-btn danger" onclick="if(confirm('Remove this target?')) Studio.Targets.removeTarget('${target.id}')">Remove Target</button>
        </div>
      </div>
    `;
  },
};
