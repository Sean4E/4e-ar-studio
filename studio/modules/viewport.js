// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Viewport (Three.js 3D Editor)
// ═══════════════════════════════════════════════════════════

Studio.Viewport = {
  renderer: null,
  scene: null,
  camera: null,
  orbit: null,
  gizmo: null,
  raycaster: null,
  mouse: new THREE.Vector2(),
  clock: new THREE.Clock(),
  mixers: [],
  targetPlane: null,
  targetPlanes: [],  // multi-target: one plane per target
  presetRafs: {},
  _selectedId: null,
  _trackingHelper: null, // face/hand reference mesh

  // ─── Init ──────────────────────────────────────────────
  init() {
    const container = document.getElementById('workspace');
    const canvas = document.getElementById('vp-canvas');

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x080c16);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 200);
    this.camera.position.set(0, 1.5, 3);

    // Orbit controls
    this.orbit = new THREE.OrbitControls(this.camera, canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.target.set(0, 0.3, 0);

    // Transform gizmo
    this.gizmo = new THREE.TransformControls(this.camera, canvas);
    this.gizmo.addEventListener('dragging-changed', e => {
      this.orbit.enabled = !e.value;
      if (e.value) Studio.Undo.push('transform');
    });
    this.gizmo.addEventListener('objectChange', () => {
      Studio.EventBus.emit('object:transformed', { id: this._selectedId });
      Studio.Project.markDirty();
    });
    this.scene.add(this.gizmo);

    // Lighting — reverted to the setup that was in place when shadows
    // "looked beautiful". DirectionalLight default shadow camera
    // (±5 units, near 0.5 / far 500) with a 2048² map. Any tuning
    // (bias, frustum-tightening, normalBias) is deferred until we
    // have a clear reproduction of what's wrong in isolation.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    this.scene.add(dir);

    // Grid + axes. Grid gets an explicit LOW renderOrder so it draws
    // before anything else in the opaque pass — lets a hider mesh
    // (renderOrder = -5 when active, see applyMaterial) write its
    // depth on top of the grid's pre-drawn colour. Result: grid
    // stays visible through an invisible hider, matching the test
    // harness look, while content behind the hider still gets
    // depth-occluded.
    const grid = new THREE.GridHelper(6, 30, 0x222244, 0x1a1a3a);
    grid.renderOrder = -10;
    this.scene.add(grid);
    const axes = new THREE.AxesHelper(0.4);
    axes.position.set(-3, 0, -3);
    axes.renderOrder = -10;
    this.scene.add(axes);

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    canvas.addEventListener('pointerdown', e => this._onClick(e));

    // Resize
    this._resize();
    new ResizeObserver(() => this._resize()).observe(container);

    // Render loop
    this._tick();

    // Listen for events
    Studio.EventBus.on('project:reset', () => this._clearScene());
    Studio.EventBus.on('project:loaded', () => {
      // Restore the project's stored viewport background colour
      const bg = Studio.Project.state.scene?.viewportBg;
      if (bg && this.renderer) this.renderer.setClearColor(bg);
      this._rebuildScene();
    });
    Studio.EventBus.on('object:removed', ({ id, object }) => this._removeFromScene(object));
    Studio.EventBus.on('target:changed', () => {
      if (Studio.Project.state.trackingMode === 'image') this.showMultiTargets();
    });

    Studio.log('Viewport ready');
  },

  // ─── Resize ────────────────────────────────────────────
  _resize() {
    const container = document.getElementById('workspace');
    const w = container.clientWidth, h = container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  },

  // ─── Render Loop ───────────────────────────────────────
  _tick() {
    requestAnimationFrame(() => this._tick());
    const dt = this.clock.getDelta();
    this.mixers.forEach(m => m.update(dt));
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  },

  // ─── Click to Select ───────────────────────────────────
  _onClick(e) {
    if (this.gizmo.dragging) return;
    const rect = document.getElementById('vp-canvas').getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const meshes = [];
    Studio.Project.state.objects.forEach(obj => {
      if (obj.mesh) obj.mesh.traverse(c => { if (c.isMesh) meshes.push(c); });
    });
    const hits = this.raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      let hit = hits[0].object;
      while (hit.parent && !hit.userData._objId) hit = hit.parent;
      if (hit.userData._objId) {
        this.selectObject(hit.userData._objId);
        return;
      }
    }
    // Clicked empty space — deselect
    this.deselectAll();
  },

  // ─── Selection ─────────────────────────────────────────
  selectObject(id) {
    const obj = Studio.Project.getObject(id);
    if (!obj || !obj.mesh) return;
    this._selectedId = id;
    this.gizmo.attach(obj.mesh);
    Studio.EventBus.emit('object:selected', { id });
  },

  deselectAll() {
    this._selectedId = null;
    this.gizmo.detach();
    Studio.EventBus.emit('object:deselected');
  },

  // ─── Gizmo Mode ────────────────────────────────────────
  setGizmo(mode) {
    this.gizmo.setMode(mode);
    document.querySelectorAll('#gizmo-mode .tb-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.gizmo === mode);
    });
    Studio.EventBus.emit('gizmo:modeChanged', { mode });
  },

  // ─── Add Model ─────────────────────────────────────────
  addModel() {
    document.getElementById('fi-model').click();
  },

  addTarget() {
    document.getElementById('fi-target').click();
  },

  // Upload a GLB from the user → prefab library (not a scene instance).
  // The user clicks the prefab card afterwards to add instances to the scene.
  async handleModelFile(file) {
    if (!file) return;

    // Create a session-only blob URL RIGHT AWAY and keep it on the
    // prefab — this is what the viewport uses to load meshes, so
    // instantiating works immediately even while GitHub Pages is still
    // propagating the freshly-uploaded GLB (~10-60s delay).
    const blobUrl = URL.createObjectURL(file);

    // Keep the original filename (including extension) so the user can
    // always recognise their uploads — don't strip ".glb" etc.
    const prefab = Studio.Project.createPrefab({
      name: file.name,
      file: file,
      _blobUrl: blobUrl,   // transient, per session; revoked on removePrefab
    });

    // Peek at the GLB to detect animation clips (for UI affordances)
    try {
      await new Promise((resolve) => {
        const loader = new THREE.GLTFLoader();
        loader.load(blobUrl, gltf => {
          prefab.clips = (gltf.animations || []).map(a => a.name).filter(n => n);
          resolve();
        }, null, () => resolve());
      });
    } catch (e) { /* non-fatal — clips just stay empty */ }

    // Render a thumbnail into a data URL — shown on the prefab card
    // immediately (no wait for GitHub upload) and persisted once the
    // .thumb.png is uploaded below.
    try {
      if (Studio.Thumbnails) {
        prefab._thumbDataUrl = await Studio.Thumbnails.renderGlb(blobUrl);
      }
    } catch(e) { Studio.log('Thumbnail render failed: ' + e.message); }

    Studio.Project.addPrefab(prefab);
    Studio.Assets.render();
    Studio.toast(prefab.name + ' added to library', 'ok');

    // Upload so the GitHub-hosted URL is ready for publish (the player
    // can only load over the network — it can't use blob: URLs).
    const gh = Studio.GitHub.getConfig();
    if (!gh.token) {
      Studio.toast(prefab.name + ' in library — needs Publish to upload', 'warn');
      return;
    }
    try {
      if (!Studio.Project.state.id) Studio.Project.state.id = Studio.Project._genId();
      const base = 'assets/' + Studio.Project.state.id + '/prefabs/';
      Studio.toast('Uploading ' + prefab.name + '…', 'ok');
      prefab.glbUrl = await Studio.GitHub.upload(base + prefab.id + '.glb', await Studio.GitHub.file2b64(file));

      // Upload the thumbnail sibling so it shows up for repeat visitors
      // and in the cross-project Library tab. Filename convention:
      // <prefabId>.thumb.png — Library detects this by suffix.
      if (prefab._thumbDataUrl && Studio.Thumbnails) {
        try {
          const thumbB64 = Studio.Thumbnails.dataUrlToB64(prefab._thumbDataUrl);
          prefab.thumbUrl = await Studio.GitHub.upload(base + prefab.id + '.thumb.png', thumbB64);
        } catch(e) { Studio.log('Thumbnail upload failed: ' + e.message); }
      }

      // Keep prefab._blobUrl for the rest of the session — the viewport
      // uses it for fast local loads regardless of GH Pages propagation.
      // Clear .file so the transient File object can be GC'd.
      prefab.file = null;
      Studio.Project.markDirty();
      Studio.Assets.render();
      Studio.toast(prefab.name + ' uploaded ✓', 'ok');
    } catch(e) {
      Studio.toast('Upload failed: ' + e.message, 'err');
      Studio.log('Prefab upload failed: ' + e.message);
    }
  },

  // Instantiate a prefab as a new scene object. Multiple calls with the
  // same prefabId produce independent instances — each with its own
  // transform, targetId, xrComponents. That's the mechanism for
  // assigning the same model to multiple image targets.
  async instantiatePrefab(prefabId) {
    const prefab = Studio.Project.getPrefab(prefabId);
    if (!prefab) return;

    const obj = Studio.Project.createObject({
      name: prefab.name,
      type: 'model',
      prefabId: prefab.id,
      glbUrl: prefab.glbUrl || '',
      clips: [...(prefab.clips || [])],
      visible: true,
    });

    // Load order preference for the studio viewport:
    //   1. _blobUrl (instant, from RAM, survives GH Pages propagation)
    //   2. prefab.glbUrl (GitHub Pages URL, only reliable after propagation)
    //   3. Fresh blob from prefab.file (edge case, pre-upload)
    let loadUrl = prefab._blobUrl || prefab.glbUrl;
    if (!loadUrl && prefab.file) {
      loadUrl = URL.createObjectURL(prefab.file);
      prefab._blobUrl = loadUrl;
    }
    if (!loadUrl) {
      Studio.toast('Prefab has no GLB yet — wait for upload', 'warn');
      return;
    }

    try {
      await this._loadModelIntoScene(obj, loadUrl);
      Studio.Project.addObject(obj);
      this.selectObject(obj.id);
    } catch (e) {
      // If loading from the GitHub URL failed (e.g. GH Pages still
      // propagating and we had no blob fallback), retry once after a
      // short delay to cover the propagation window.
      if (loadUrl === prefab.glbUrl) {
        Studio.log('Prefab load failed, retrying in 3s…');
        await new Promise(r => setTimeout(r, 3000));
        try {
          await this._loadModelIntoScene(obj, loadUrl + (loadUrl.includes('?') ? '&' : '?') + '_t=' + Date.now());
          Studio.Project.addObject(obj);
          this.selectObject(obj.id);
          return;
        } catch (e2) { /* fall through to error toast */ }
      }
      Studio.toast('Load failed: ' + e.message, 'err');
    }
  },

  async handleTargetFile(file) {
    if (!file) return;
    Studio.Project.state.target.imgFile = file;

    // Show as ground plane
    this._showTargetPlane(file);

    // Compile with MindAR
    if (Studio.MindAR) {
      Studio.toast('Compiling image target…', 'ok');
      try {
        await Studio.MindAR.compile(file);
        Studio.toast('Target compiled ✓', 'ok');
      } catch(e) {
        Studio.toast('Compile failed: ' + e.message, 'err');
      }
    }

    Studio.Project.markDirty();
    Studio.EventBus.emit('target:changed');
  },

  // ─── Load Model into Three.js Scene ────────────────────
  _loadModelIntoScene(obj, url) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();
      if (THREE.DRACOLoader) {
        const draco = new THREE.DRACOLoader();
        draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.147.0/examples/jsm/libs/draco/');
        loader.setDRACOLoader(draco);
      }
      loader.load(url, gltf => {
        const model = gltf.scene;
        model.userData._objId = obj.id;
        model.traverse(c => {
          c.userData._objId = obj.id;
          if (c.isMesh) c.castShadow = true;
        });
        this.scene.add(model);
        obj.mesh = model;

        // Extract animations
        if (gltf.animations.length) {
          obj.clips = gltf.animations.map(a => a.name).filter(n => n);
          const mixer = new THREE.AnimationMixer(model);
          mixer._clips = gltf.animations;
          mixer._objId = obj.id;
          if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
          this.mixers.push(mixer);
        }

        resolve();
      }, null, reject);
    });
  },

  // ─── Show Target Image as Ground Plane ─────────────────
  _showTargetPlane(file) {
    if (this.targetPlane) {
      this.scene.remove(this.targetPlane);
      this.targetPlane = null;
    }
    const texUrl = URL.createObjectURL(file);
    const tex = new THREE.TextureLoader().load(texUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.src = texUrl;
    img.onload = () => {
      const aspect = img.width / img.height;
      const pw = 1.5, ph = pw / aspect;
      const geo = new THREE.PlaneGeometry(pw, ph);
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
      this.targetPlane = new THREE.Mesh(geo, mat);
      this.targetPlane.rotation.x = -Math.PI / 2;
      this.targetPlane.position.y = 0.001;
      this.scene.add(this.targetPlane);
    };
  },

  _showTargetPlaneFromUrl(url) {
    if (this.targetPlane) { this.scene.remove(this.targetPlane); this.targetPlane = null; }
    if (!url) return;
    const tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
    img.onload = () => {
      const aspect = img.width / img.height;
      const pw = 1.5, ph = pw / aspect;
      const geo = new THREE.PlaneGeometry(pw, ph);
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
      this.targetPlane = new THREE.Mesh(geo, mat);
      this.targetPlane.rotation.x = -Math.PI / 2;
      this.targetPlane.position.y = 0.001;
      this.scene.add(this.targetPlane);
    };
  },

  // Which target is currently "focused" in the viewport. null = grid
  // mode (show all targets spread out). When set, only that target
  // plane is shown (at world origin), and object visibility is
  // filtered so only objects assigned to this target (or unassigned)
  // are visible.
  _focusedTargetId: null,

  // Toggle focus on a target — pass null or same-id to return to grid.
  focusTarget(id) {
    this._focusedTargetId = (this._focusedTargetId === id) ? null : id;
    this.showMultiTargets();
    this._syncFocusVisibility();
    Studio.Hierarchy?.render();   // re-render so hierarchy highlights the focused target
  },

  // Hide objects assigned to OTHER image targets while one is focused.
  // Unassigned objects (no targetId) stay visible — they're "global"
  // to the scene.
  _syncFocusVisibility() {
    const focus = this._focusedTargetId;
    Studio.Project.state.objects.forEach(obj => {
      if (!obj.mesh) return;
      // Respect the user's explicit visibility flag as the baseline,
      // then add focus-based filtering on top.
      let visible = obj.visible !== false;
      if (focus && obj.targetId && obj.targetId !== focus) visible = false;
      obj.mesh.visible = visible;
    });
  },

  // ─── Multi-Target Visualization ────────────────────────
  showMultiTargets() {
    // Clear old target planes
    this.targetPlanes.forEach(p => this.scene.remove(p));
    this.targetPlanes = [];
    // Also clear legacy single plane
    if (this.targetPlane) { this.scene.remove(this.targetPlane); this.targetPlane = null; }

    const targets = Studio.Project.state.targets || [];
    if (targets.length === 0) return;

    // If a target is focused: render ONLY that one, centered at origin
    // so the user sees it in-place with its assigned objects (which
    // are authored near origin). Returning to grid mode unfocuses.
    const focus = this._focusedTargetId;
    const visible = focus ? targets.filter(t => t.id === focus) : targets;

    const spacing = 2.0;
    const startX = focus ? 0 : -(visible.length - 1) * spacing / 2;

    visible.forEach((target, idx) => {
      const url = target.originalUrl || target._thumbnailDataUrl || target.thumbnailUrl;
      if (!url) return;

      const tex = new THREE.TextureLoader().load(url);
      tex.colorSpace = THREE.SRGBColorSpace;

      const pw = 1.2, ph = pw * (4/3);
      const geo = new THREE.PlaneGeometry(pw, ph);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, side: THREE.DoubleSide,
        transparent: true, opacity: 0.7
      });

      const plane = new THREE.Mesh(geo, mat);
      plane.rotation.x = -Math.PI / 2;
      const x = focus ? 0 : startX + idx * spacing;
      plane.position.set(x, 0.001, 0);
      plane.userData.targetId = target.id;
      plane.userData.targetName = target.name;
      this.targetPlanes.push(plane);
      this.scene.add(plane);

      this._addTargetLabel(target.name, x, 0, ph / 2 + 0.15);
    });
  },

  _addTargetLabel(text, x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 256, 48);
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 24);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y + 0.3, z);
    sprite.scale.set(0.8, 0.15, 1);
    this.targetPlanes.push(sprite); // track for cleanup
    this.scene.add(sprite);
  },

  // ─── Remove from Scene ─────────────────────────────────
  _removeFromScene(obj) {
    if (!obj) return;
    if (obj.mesh) this.scene.remove(obj.mesh);
    const mi = this.mixers.findIndex(m => m._objId === obj.id);
    if (mi >= 0) this.mixers.splice(mi, 1);
    if (this._selectedId === obj.id) this.deselectAll();
  },

  // ─── Clear Scene ───────────────────────────────────────
  _clearScene() {
    // Stop all preset animations
    Object.keys(this.presetRafs).forEach(k => { cancelAnimationFrame(this.presetRafs[k].id); });
    this.presetRafs = {};
    // Remove ALL gltf models from the Three.js scene (not relying on state array)
    const toRemove = [];
    this.scene.traverse(child => {
      if (child.userData._objId) toRemove.push(child);
    });
    toRemove.forEach(obj => this.scene.remove(obj));
    this.mixers.length = 0;
    // Remove target planes (legacy + multi-target)
    if (this.targetPlane) { this.scene.remove(this.targetPlane); this.targetPlane = null; }
    this.targetPlanes.forEach(p => this.scene.remove(p));
    this.targetPlanes = [];
    // Remove tracking helper
    this.removeTrackingHelper();
    this.deselectAll();
    Studio.log('Scene cleared');
  },

  // ─── Rebuild Scene from Project State ──────────────────
  async _rebuildScene() {
    this._clearScene();
    const state = Studio.Project.state;

    // Target planes
    if (state.trackingMode === 'image') {
      // New multi-target system takes priority
      if (state.targets && state.targets.length > 0) {
        this.showMultiTargets();
      } else if (state.target.imageUrl) {
        // Legacy single target fallback
        this._showTargetPlaneFromUrl(state.target.imageUrl);
      }
    } else {
      // Hide target planes for non-image modes
      if (this.targetPlane) this.targetPlane.visible = false;
      this.targetPlanes.forEach(p => p.visible = false);
    }

    // Load objects
    for (const obj of state.objects) {
      // Primitive objects — rebuild geometry
      if (obj.type === 'primitive' && obj.primitiveType) {
        const defs = {
          cube:     () => new THREE.BoxGeometry(0.3, 0.3, 0.3),
          sphere:   () => new THREE.SphereGeometry(0.18, 24, 16),
          cylinder: () => new THREE.CylinderGeometry(0.15, 0.15, 0.35, 24),
          plane:    () => new THREE.PlaneGeometry(0.5, 0.5),
          cone:     () => new THREE.ConeGeometry(0.18, 0.35, 24),
          torus:    () => new THREE.TorusGeometry(0.15, 0.05, 12, 32),
          empty:    () => new THREE.SphereGeometry(0.04, 8, 6),
        };
        const geoFn = defs[obj.primitiveType];
        if (geoFn) {
          const isEmpty = obj.primitiveType === 'empty';
          const color = obj.primitiveColor || (isEmpty ? '#666666' : '#8b5cf6');
          const mat = new THREE.MeshStandardMaterial({
            color, roughness: 0.5, metalness: 0.1,
            wireframe: isEmpty, opacity: isEmpty ? 0.4 : 1, transparent: isEmpty,
          });
          const mesh = new THREE.Mesh(geoFn(), mat);
          mesh.castShadow = !isEmpty;
          mesh.userData._objId = obj.id;
          mesh.userData._primitiveType = obj.primitiveType;
          mesh.traverse(c => { c.userData._objId = obj.id; });
          this.scene.add(mesh);
          obj.mesh = mesh;
          const t = obj.transform;
          mesh.position.set(t.position.x, t.position.y, t.position.z);
          mesh.rotation.set(THREE.MathUtils.degToRad(t.rotation.x), THREE.MathUtils.degToRad(t.rotation.y), THREE.MathUtils.degToRad(t.rotation.z));
          mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
          mesh.visible = obj.visible;
          // Apply video-on-target preview (if configured)
          this.syncVideoPreview(obj);
          // Re-apply any saved material override (hider/basic/pbr) so
          // it survives project reload. Without this, opening a project
          // with an existing hider toggle shows the object's original
          // material in the viewport — out of sync with the published
          // player.
          this.applyMaterial(obj);
        }
        continue;
      }
      if (obj.glbUrl) {
        try {
          await this._loadModelIntoScene(obj, obj.glbUrl);
          // Apply saved transform
          if (obj.mesh) {
            const t = obj.transform;
            obj.mesh.position.set(t.position.x, t.position.y, t.position.z);
            obj.mesh.rotation.set(
              THREE.MathUtils.degToRad(t.rotation.x),
              THREE.MathUtils.degToRad(t.rotation.y),
              THREE.MathUtils.degToRad(t.rotation.z)
            );
            obj.mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
            obj.mesh.visible = obj.visible;
            // Same as primitives — re-apply saved material override
            // so hiders on GLBs look right immediately on load.
            this.applyMaterial(obj);
          }
          // Play saved animation
          if (obj.defaultAnim) {
            const mi = this.mixers.find(m => m._objId === obj.id);
            if (mi && mi._clips) {
              mi.stopAllAction();
              const clip = mi._clips.find(c => c.name === obj.defaultAnim);
              if (clip) mi.clipAction(clip).play();
            }
          }
        } catch(e) {
          Studio.log('Failed to load: ' + obj.name + ' — ' + e.message);
        }
      }
    }
    // Re-apply focus filtering now that fresh meshes may have set
    // visible=true regardless of the current focus state.
    this._syncFocusVisibility();
  },

  // ─── Tracking Mode Helper (face/hand reference) ─────────
  showTrackingHelper(mode) {
    this.removeTrackingHelper();

    if (mode === 'face') {
      // Simple face outline using a sphere + features.
      // Color choice matters here: the primitive default is #8b5cf6
      // (the same lavender), and when a user places a cube on or near
      // origin it visually merges with this helper — misread as "the
      // hider isn't working". Using a distinct amber (#f59e0b) keeps
      // the helper clearly identifiable as a reference, never as content.
      const HELPER_COLOR = 0xf59e0b;
      const group = new THREE.Group();
      group.name = '_trackingHelper';

      // Head sphere (wireframe)
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 12),
        new THREE.MeshBasicMaterial({ color: HELPER_COLOR, wireframe: true, transparent: true, opacity: 0.25 })
      );
      head.position.y = 0.15;
      group.add(head);

      // Nose — wireframe too so it reads as a reference marker, not
      // a solid object that could be confused with a primitive.
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.015, 0.04, 6),
        new THREE.MeshBasicMaterial({ color: HELPER_COLOR, wireframe: true, transparent: true, opacity: 0.4 })
      );
      nose.position.set(0, 0.14, 0.12);
      nose.rotation.x = Math.PI / 2;
      group.add(nose);

      // Eyes
      [-0.04, 0.04].forEach(x => {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.012, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.6 })
        );
        eye.position.set(x, 0.17, 0.1);
        group.add(eye);
      });

      // Label
      this.scene.add(group);
      this._trackingHelper = group;

    } else if (mode === 'hand') {
      // Simple hand outline
      const group = new THREE.Group();
      group.name = '_trackingHelper';

      // Palm
      const palm = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.12, 0.03),
        new THREE.MeshBasicMaterial({ color: 0x34d399, wireframe: true, transparent: true, opacity: 0.3 })
      );
      palm.position.y = 0.06;
      group.add(palm);

      // Fingers
      for (let i = 0; i < 5; i++) {
        const finger = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.005, 0.06, 6),
          new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.4 })
        );
        finger.position.set(-0.04 + i * 0.02, 0.15, 0);
        group.add(finger);
      }

      this.scene.add(group);
      this._trackingHelper = group;

    } else if (mode === 'slam') {
      // Just show the grid (already there)
    }
    // Image mode shows target plane (handled separately)
  },

  removeTrackingHelper() {
    if (this._trackingHelper) {
      this.scene.remove(this._trackingHelper);
      this._trackingHelper = null;
    }
  },

  // ─── Video-on-target preview ────────────────────────────
  // Renders a plane textured with the actual video (muted, looping) at
  // the object's transform, so users can position/rotate/scale it in
  // the viewport. Auto-sizes to the video's natural aspect ratio.
  //
  // Behaviour by host primitive:
  //   - Plane primitive: the host plane itself gets the video texture
  //     and its geometry resizes to match the video aspect (width kept
  //     from the component's `width` prop)
  //   - Empty / anything else: a child plane is added as a preview
  //     helper (child inherits parent's transform)
  syncVideoPreview(obj) {
    if (!obj || !obj.mesh) return;
    const cfg = obj.xrComponents?.['video-on-target'];
    const src = cfg?.src || '';
    const width = cfg?.width || 1.0;

    const isPlaneHost = obj.primitiveType === 'plane';

    // Dispose any previous preview child (for Empty/other hosts)
    const prev = obj.mesh.children.find(c => c.userData._videoPreview);
    if (prev) {
      this._disposeVideoMesh(prev);
      obj.mesh.remove(prev);
    }

    // If removing video: revert Plane host to its solid material
    if (!src) {
      if (isPlaneHost && obj.mesh.userData._savedMaterial) {
        const vidTex = obj.mesh.material.map;
        if (vidTex && vidTex.image) { try { vidTex.image.pause(); } catch(e){} vidTex.dispose(); }
        obj.mesh.material.dispose();
        obj.mesh.material = obj.mesh.userData._savedMaterial;
        obj.mesh.userData._savedMaterial = null;
        // Restore default plane geometry
        obj.mesh.geometry.dispose();
        obj.mesh.geometry = new THREE.PlaneGeometry(0.5, 0.5);
      }
      return;
    }

    // Build the video element + texture (shared between host-plane and child-plane paths)
    const vid = document.createElement('video');
    vid.src = src;
    vid.crossOrigin = 'anonymous';
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.setAttribute('webkit-playsinline', '');
    vid.preload = 'auto';
    vid.play().catch(() => {});   // studio preview — muted autoplay is allowed

    const tex = new THREE.VideoTexture(vid);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;

    const resize = (targetMesh) => {
      if (vid.videoWidth && vid.videoHeight) {
        const h = width * (vid.videoHeight / vid.videoWidth);
        if (targetMesh.geometry) targetMesh.geometry.dispose();
        targetMesh.geometry = new THREE.PlaneGeometry(width, h);
      }
    };

    if (isPlaneHost) {
      // Store original material so we can revert if video is removed later
      if (!obj.mesh.userData._savedMaterial) {
        obj.mesh.userData._savedMaterial = obj.mesh.material;
      } else {
        obj.mesh.material.dispose();  // dispose the intermediate video material we'll replace
      }
      obj.mesh.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      // Resize host plane to match video aspect
      if (vid.readyState >= 1) resize(obj.mesh);
      else vid.addEventListener('loadedmetadata', () => resize(obj.mesh), { once: true });
    } else {
      // Child plane preview for Empty/other hosts. Rotated -90° on X
      // to lie flat on the image target (matches the player component).
      const geo = new THREE.PlaneGeometry(width, width * 9/16);
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      const plane = new THREE.Mesh(geo, mat);
      plane.rotation.x = -Math.PI / 2;
      plane.userData._videoPreview = true;
      plane.userData._objId = obj.id;
      plane.userData._ignoreRaycast = true;
      obj.mesh.add(plane);
      if (vid.readyState >= 1) resize(plane);
      else vid.addEventListener('loadedmetadata', () => resize(plane), { once: true });
    }
  },

  // Swap the object's rendered material in the studio viewport to
  // match whichever xrextras-*-material component is currently
  // enabled on it. Called by the inspector on toggle / property edit.
  // Restores the original material when no material component is
  // active. Handles both primitives (single mesh) and GLBs (traverses
  // submeshes, caches each submesh's original material on first swap).
  applyMaterial(obj) {
    if (!obj?.mesh) return;
    const xr = obj.xrComponents || {};
    const basic = xr['xrextras-basic-material'];
    const pbr = xr['xrextras-pbr-material'];
    const hider = xr['xrextras-hider-material'];

    const makeMaterial = () => {
      if (basic) {
        return new THREE.MeshBasicMaterial({
          color: basic.color || '#ffffff',
          transparent: (basic.opacity != null && basic.opacity < 1),
          opacity: basic.opacity != null ? basic.opacity : 1,
        });
      }
      if (pbr) {
        return new THREE.MeshStandardMaterial({
          color: pbr.color || '#ffffff',
          metalness: pbr.metalness != null ? pbr.metalness : 0,
          roughness: pbr.roughness != null ? pbr.roughness : 0.5,
          transparent: (pbr.opacity != null && pbr.opacity < 1),
          opacity: pbr.opacity != null ? pbr.opacity : 1,
        });
      }
      if (hider) {
        // Test harness buildMat() does just these three lines:
        //   const m = new THREE.MeshStandardMaterial({ side });
        //   m.colorWrite = false;
        //   return m;
        // Three.js defaults for MeshStandardMaterial are depthWrite=true
        // and depthTest=true — but we set them explicitly anyway so
        // future refactors of Three.js or inherited material defaults
        // can't silently break occlusion.
        const sideStr = (hider && hider.side) || 'front';
        const sideMap = { front: THREE.FrontSide, back: THREE.BackSide, double: THREE.DoubleSide };
        const side = sideMap[sideStr] != null ? sideMap[sideStr] : THREE.FrontSide;
        const m = new THREE.MeshStandardMaterial({ side });
        m.colorWrite = false;
        m.depthWrite = true;
        m.depthTest = true;
        m.transparent = false;
        return m;
      }
      return null;  // no override → restore
    };

    const overrideMat = makeMaterial();
    const wantFlip = !!(hider && hider !== true && hider.invertNormals);

    // ── PRIMITIVES: full rebuild, byte-for-byte like the test harness ──
    // docs/hider-test.html's buildBoxA() disposes the existing mesh,
    // creates fresh geometry + material, builds a fresh Mesh, and
    // adds it to the scene. We do the same — including replacing the
    // mesh instance (removing the old one from the scene and adding a
    // new one), so every mechanical step matches the test exactly.
    // The previous v3.10.20 approach kept the same mesh instance and
    // only replaced its .geometry/.material, which visually worked in
    // isolation but diverged from the test harness's exact steps.
    if (obj.type === 'primitive' && obj.primitiveType) {
      const defs = {
        cube:     () => new THREE.BoxGeometry(0.3, 0.3, 0.3),
        sphere:   () => new THREE.SphereGeometry(0.18, 24, 16),
        cylinder: () => new THREE.CylinderGeometry(0.15, 0.15, 0.35, 24),
        plane:    () => new THREE.PlaneGeometry(0.5, 0.5),
        cone:     () => new THREE.ConeGeometry(0.18, 0.35, 24),
        torus:    () => new THREE.TorusGeometry(0.15, 0.05, 12, 32),
        empty:    () => new THREE.SphereGeometry(0.04, 8, 6),
      };
      const geoFn = defs[obj.primitiveType];
      if (geoFn) {
        const oldMesh = obj.mesh;
        const wasSelected = (this._selectedId === obj.id);

        // Fresh geometry, with winding flip applied BEFORE mesh creation
        // (same order as buildBoxA: geom → flip → new Mesh(geom, mat)).
        const geo = geoFn();
        if (wantFlip && geo.index) {
          const arr = geo.index.array;
          for (let i = 0; i < arr.length; i += 3) {
            const tmp = arr[i + 1]; arr[i + 1] = arr[i + 2]; arr[i + 2] = tmp;
          }
          geo.index.needsUpdate = true;
          geo.computeVertexNormals();
        }

        // Fresh material — either the hider/basic/pbr override, or the
        // default primitive material when no material component is on.
        let mat;
        if (overrideMat) {
          mat = overrideMat;
        } else {
          const isEmpty = obj.primitiveType === 'empty';
          const color = obj.primitiveColor || (isEmpty ? '#666666' : '#8b5cf6');
          mat = new THREE.MeshStandardMaterial({
            color, roughness: 0.5, metalness: 0.1,
            wireframe: isEmpty, opacity: isEmpty ? 0.4 : 1, transparent: isEmpty,
          });
        }

        // New mesh, preserving everything that matters on the old one.
        const newMesh = new THREE.Mesh(geo, mat);
        newMesh.position.copy(oldMesh.position);
        newMesh.rotation.copy(oldMesh.rotation);
        newMesh.scale.copy(oldMesh.scale);
        newMesh.visible = oldMesh.visible;
        // Hiders shouldn't cast a shadow — an invisible cube that still
        // throws a dark silhouette onto the floor is exactly the kind of
        // "why is there something there?" bug the test harness avoids
        // by not having a shadow map at all. For primitives with no
        // hider, cast shadows as usual.
        newMesh.castShadow = !(hider) && obj.primitiveType !== 'empty';
        // Render order: hider must draw BEFORE user content so its
        // depth is in the buffer when other objects depth-test — but
        // AFTER the grid helper, so the grid's colour stays visible
        // through the invisible hider (matches the test harness look).
        //   Grid helper: renderOrder = -10 (set at init)
        //   Hider mesh:  renderOrder = -5  (this line, when hider on)
        //   Content:     renderOrder = 0   (default)
        // Without this, Three.js's opaque sort uses material.id as a
        // tie-break — the freshly-rebuilt hider material always has
        // the highest id and ends up drawn LAST, meaning surrounding
        // meshes paint colour before the hider's depth lands and
        // occlusion breaks entirely.
        newMesh.renderOrder = hider ? -5 : 0;
        newMesh.userData._objId = obj.id;
        newMesh.userData._primitiveType = obj.primitiveType;

        // Swap in the scene, update gizmo attachment + selection.
        this.scene.remove(oldMesh);
        if (oldMesh.geometry) oldMesh.geometry.dispose();
        if (oldMesh.material && typeof oldMesh.material.dispose === 'function') {
          oldMesh.material.dispose();
        }
        this.scene.add(newMesh);
        obj.mesh = newMesh;
        if (wasSelected) {
          this.gizmo.attach(newMesh);
        }

        // Diagnostic log.
        const active = basic ? 'basic' : pbr ? 'pbr' : hider ? 'hider' : 'none';
        const cfg = (active === 'hider' && typeof hider === 'object')
          ? ` side=${hider.side||'front'} invertNormals=${!!hider.invertNormals}`
          : '';
        Studio.log(`[material] ${obj.name||obj.id}: ${active}${cfg} (rebuilt)`);
        if (hider && window.console) {
          // Full dump so we can see every property that matters for
          // occlusion. If occlusion doesn't work, the problem has to
          // be visible in one of these values.
          console.log('[4E hider]', obj.name || obj.id, {
            materialType:    newMesh.material.type,
            colorWrite:      newMesh.material.colorWrite,
            depthWrite:      newMesh.material.depthWrite,
            depthTest:       newMesh.material.depthTest,
            transparent:     newMesh.material.transparent,
            opacity:         newMesh.material.opacity,
            side:            newMesh.material.side,
            sideHuman:       ['Front','Back','Double'][newMesh.material.side],
            visible:         newMesh.visible,
            castShadow:      newMesh.castShadow,
            renderOrder:     newMesh.renderOrder,
            frustumCulled:   newMesh.frustumCulled,
            scale:           newMesh.scale.toArray(),
            position:        newMesh.position.toArray(),
            geometryIndexed: !!newMesh.geometry.index,
            geometryType:    newMesh.geometry.type,
            flippedWinding:  !!wantFlip,
          });
        }
        return;  // primitive path done
      }
    }

    // ── GLBs (and anything else with sub-meshes): traverse-and-swap ──
    // We don't rebuild GLB geometry — too expensive and we'd lose any
    // state the loader set up. Swap materials on each sub-mesh, caching
    // the original the first time so toggling off restores.
    const meshInfo = [];
    obj.mesh.traverse(c => {
      if (!c.isMesh) return;
      if (!c.userData._origMat) c.userData._origMat = c.material;
      // Cache original castShadow too, for restoration when hider off.
      if (c.userData._origCastShadow === undefined) {
        c.userData._origCastShadow = c.castShadow;
      }

      const isFlipped = !!c.userData._hiderFlipped;
      if (wantFlip !== isFlipped) this._flipMeshWinding(c);

      if (overrideMat) {
        c.material = overrideMat;
        // Hider also applies to GLBs: invisible mesh, no shadow cast.
        c.renderOrder = hider ? -5 : 0;
        c.castShadow = hider ? false : c.userData._origCastShadow;
      } else if (c.userData._origMat) {
        c.material = c.userData._origMat;
        c.renderOrder = 0;
        c.castShadow = c.userData._origCastShadow;
      }

      meshInfo.push({
        name: c.name || '(unnamed)',
        materialType: c.material?.type,
        colorWrite: c.material?.colorWrite,
        side: c.material?.side,
        castShadow: c.castShadow,
      });
    });

    const active = basic ? 'basic' : pbr ? 'pbr' : hider ? 'hider' : 'none';
    const cfg = (active === 'hider' && typeof hider === 'object')
      ? ` side=${hider.side||'front'} invertNormals=${!!hider.invertNormals}`
      : '';
    Studio.log(`[material] ${obj.name||obj.id}: ${active}${cfg} meshes=${meshInfo.length}`);
    if (hider && window.console) {
      console.log('[4E hider]', obj.name || obj.id, 'meshes:', meshInfo);
    }
  },

  // Dumps every mesh's render-critical properties to a CSV file and
  // triggers a browser download. Drag the file into chat or open it
  // in a spreadsheet to inspect. Covers the scene's renderer state
  // as a header, then one row per mesh: position, scale, material
  // flags (colorWrite, depthWrite, depthTest, transparent, opacity,
  // side), renderOrder, visibility. Enough to diagnose any occlusion
  // / depth-sort issue without needing to paste into the console.
  diagnoseScene() {
    const r = this.renderer;
    const meta = [
      ['# 4E Studio Scene Diagnose', ''],
      ['# Generated',          new Date().toISOString()],
      ['# Studio version',     Studio.VERSION || '?'],
      ['# Renderer autoClear', r.autoClear],
      ['# Renderer sortObjects', r.sortObjects],
      ['# Renderer shadowMap', r.shadowMap.enabled],
      ['# Renderer outputColorSpace', r.outputColorSpace],
      ['# Camera position',    this.camera.position.toArray().join(' ')],
      ['', ''],
    ];
    const header = [
      'index','name','type','objId','visible','renderOrder','frustumCulled',
      'castShadow','receiveShadow',
      'posX','posY','posZ','scaleX','scaleY','scaleZ',
      'matType','colorWrite','depthWrite','depthTest','transparent','opacity','side'
    ];
    const rows = [];
    let i = 0;
    this.scene.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material || {};
      const p = o.position, s = o.scale;
      rows.push([
        i++,
        o.name || '(unnamed)',
        o.type,
        o.userData._objId || '',
        o.visible,
        o.renderOrder,
        o.frustumCulled,
        o.castShadow,
        o.receiveShadow,
        p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3),
        s.x.toFixed(3), s.y.toFixed(3), s.z.toFixed(3),
        m.type || '',
        m.colorWrite,
        m.depthWrite,
        m.depthTest,
        m.transparent,
        m.opacity != null ? m.opacity : '',
        m.side != null ? (['Front','Back','Double'][m.side] || m.side) : '',
      ]);
    });

    // Build CSV. Quote any value containing comma or newline.
    const csvEscape = v => {
      const s = String(v == null ? '' : v);
      return /[,"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    };
    const lines = [];
    meta.forEach(row => lines.push(row.map(csvEscape).join(',')));
    lines.push(header.map(csvEscape).join(','));
    rows.forEach(row => lines.push(row.map(csvEscape).join(',')));
    const csv = lines.join('\n');

    // 1. Save locally as a download, so you always have a copy.
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '4e-diagnose-' + Date.now() + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    // 2. Also upload to the GitHub repo at studio/diagnose/latest.csv
    //    so whoever is debugging (including Claude) can read it via a
    //    stable URL without needing the user to upload manually.
    //    Overwrites the previous latest on each click — if you want
    //    to preserve history, save the downloaded file somewhere.
    //    This path is excluded from the Firebase deploy workflow so
    //    the upload doesn't trigger a studio deploy.
    const ghPath = 'studio/diagnose/latest.csv';
    const b64 = btoa(unescape(encodeURIComponent(csv)));  // utf8-safe btoa
    (async () => {
      try {
        if (!Studio.GitHub?.getConfig().token) {
          Studio.toast('CSV downloaded ' + rows.length + ' meshes · GitHub token not set so not uploaded', 'warn');
          return;
        }
        await Studio.GitHub.upload(ghPath, b64);
        const cfg = Studio.GitHub.getConfig();
        const rawUrl = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${ghPath}`;
        Studio.toast('Diagnose saved: ' + rows.length + ' meshes (file + GitHub)', 'ok');
        Studio.log('[diagnose] uploaded to ' + rawUrl);
      } catch (e) {
        Studio.toast('Diagnose CSV downloaded but upload failed: ' + e.message, 'warn');
        Studio.log('[diagnose] upload error: ' + e.message);
      }
    })();
    return { meta, header, rows };
  },

  // Adds a cyan wireframe outline as a child of every sub-mesh. Because
  // it's a child (not a scene-level helper), it inherits transforms
  // automatically — moves with the gizmo, no per-frame updates needed.
  _addOccluderHelper(obj) {
    if (!obj?.mesh) return;
    const wireMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7 });
    const added = [];
    obj.mesh.traverse(c => {
      if (!c.isMesh || !c.geometry) return;
      const wireGeo = new THREE.WireframeGeometry(c.geometry);
      const wire = new THREE.LineSegments(wireGeo, wireMat);
      wire.userData._occluderHelper = true;
      // Bump renderOrder so the wireframe draws after the (invisible)
      // occluder material and isn't depth-clipped by it.
      wire.renderOrder = 10;
      c.add(wire);
      added.push(wire);
    });
    obj._occluderHelpers = added;
  },

  // Reverses triangle winding on a mesh. Indexed geometries swap the
  // last two indices of every triangle; non-indexed geometries swap
  // the second and third vertex of every triangle in every buffer
  // attribute. Normals are re-computed. Idempotent toggle — tracks
  // the state via userData._hiderFlipped.
  _flipMeshWinding(mesh) {
    const geo = mesh.geometry;
    if (!geo) return;
    if (geo.index) {
      const arr = geo.index.array;
      for (let i = 0; i < arr.length; i += 3) {
        const tmp = arr[i + 1]; arr[i + 1] = arr[i + 2]; arr[i + 2] = tmp;
      }
      geo.index.needsUpdate = true;
    } else {
      // Non-indexed: swap vertex 1 ↔ vertex 2 for every triangle in every attribute.
      for (const name in geo.attributes) {
        const attr = geo.attributes[name];
        const itemSize = attr.itemSize;
        const arr = attr.array;
        for (let i = 0; i < arr.length; i += itemSize * 3) {
          for (let k = 0; k < itemSize; k++) {
            const a = i + itemSize + k, b = i + itemSize * 2 + k;
            const tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp;
          }
        }
        attr.needsUpdate = true;
      }
    }
    geo.computeVertexNormals();
    mesh.userData._hiderFlipped = !mesh.userData._hiderFlipped;
  },

  _removeOccluderHelper(obj) {
    if (!obj?._occluderHelpers?.length) return;
    obj._occluderHelpers.forEach(w => {
      if (w.parent) w.parent.remove(w);
      if (w.geometry) w.geometry.dispose();
      if (w.material) w.material.dispose();
    });
    obj._occluderHelpers = null;
  },

  _disposeVideoMesh(mesh) {
    if (!mesh) return;
    if (mesh.material) {
      if (mesh.material.map && mesh.material.map.image) {
        try { mesh.material.map.image.pause(); } catch(e){}
        mesh.material.map.dispose();
      }
      mesh.material.dispose();
    }
    if (mesh.geometry) mesh.geometry.dispose();
  },

  // ─── Preset Animation Preview ───────────────────────────
  startPreset(obj, type) {
    const key = obj.id + '_' + type;
    if (this.presetRafs[key]) return;
    const mesh = obj.mesh; if (!mesh) return;
    const origin = { y: mesh.position.y, sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z };
    const raf = { id: 0 };
    this.presetRafs[key] = raf;
    const tick = () => {
      raf.id = requestAnimationFrame(tick);
      const p = obj.presets?.[type]; if (!p) return;
      const t = performance.now() * 0.001;
      if (type === 'spin') mesh.rotation[p.axis || 'y'] = t * (p.speed || 1) * 1.5;
      if (type === 'bob') mesh.position.y = origin.y + Math.sin(t * (p.speed || 2)) * (p.height || 0.05);
      if (type === 'pulse') { const s = 1 + Math.sin(t * (p.speed || 3)) * (p.amount || 0.08); mesh.scale.set(origin.sx*s, origin.sy*s, origin.sz*s); }
    };
    tick();
  },

  stopPreset(obj, type) {
    const key = obj.id + '_' + type;
    if (this.presetRafs[key]) { cancelAnimationFrame(this.presetRafs[key].id); delete this.presetRafs[key]; }
  },

  stopAllPresets(obj) {
    ['spin', 'bob', 'pulse'].forEach(t => this.stopPreset(obj, t));
  },

  // ─── Add Primitive Object ───────────────────────────────
  addPrimitive(type) {
    const defs = {
      cube:     { geo: new THREE.BoxGeometry(0.3, 0.3, 0.3),       name: 'Cube',     color: 0x8b5cf6 },
      sphere:   { geo: new THREE.SphereGeometry(0.18, 24, 16),     name: 'Sphere',   color: 0x22d3ee },
      cylinder: { geo: new THREE.CylinderGeometry(0.15, 0.15, 0.35, 24), name: 'Cylinder', color: 0x34d399 },
      plane:    { geo: new THREE.PlaneGeometry(0.5, 0.5),          name: 'Plane',    color: 0xfb923c },
      cone:     { geo: new THREE.ConeGeometry(0.18, 0.35, 24),     name: 'Cone',     color: 0xf87171 },
      torus:    { geo: new THREE.TorusGeometry(0.15, 0.05, 12, 32),name: 'Torus',    color: 0xa78bfa },
      empty:    { geo: new THREE.SphereGeometry(0.04, 8, 6),       name: 'Empty',    color: 0x666666 },
    };
    const def = defs[type];
    if (!def) return;

    const mat = new THREE.MeshStandardMaterial({
      color: def.color, roughness: 0.5, metalness: 0.1,
      wireframe: type === 'empty',
      opacity: type === 'empty' ? 0.4 : 1,
      transparent: type === 'empty',
    });
    const mesh = new THREE.Mesh(def.geo, mat);
    mesh.castShadow = type !== 'empty';
    mesh.position.y = type === 'plane' ? 0.001 : 0.2;
    if (type === 'plane') mesh.rotation.x = -Math.PI / 2;

    // Auto-suffix name if duplicates exist (Empty 1, Empty 2, Cube 2, etc.)
    let name = def.name;
    const existing = Studio.Project.state.objects.filter(o => o.name === name || o.name.startsWith(name + ' '));
    if (existing.length > 0) name = def.name + ' ' + (existing.length + 1);

    const obj = Studio.Project.createObject({
      name: name,
      type: 'primitive',
      primitiveType: type,
      primitiveColor: '#' + def.color.toString(16).padStart(6, '0'),
      visible: true,   // explicit so a stale createObject default can never make new primitives invisible
    });

    mesh.userData._objId = obj.id;
    mesh.userData._primitiveType = type;
    mesh.traverse(c => { c.userData._objId = obj.id; });
    this.scene.add(mesh);
    obj.mesh = mesh;
    // Persist initial transform so save/reload and the published player
    // use the same orientation we're showing in the editor. Plane
    // primitives lie flat on the image target (X = -90°) — this is the
    // 8th Wall image-target convention (Y = normal, XZ = image plane).
    obj.transform.position.y = mesh.position.y;
    if (type === 'plane') obj.transform.rotation.x = -90;

    Studio.Project.addObject(obj);
    this.selectObject(obj.id);
    Studio.toast(def.name + ' added', 'ok');
  },

  // Duplicate the currently-selected object. Especially useful for
  // prefab instances (spawn another copy for a different image target)
  // and for copying a pre-configured primitive (same components,
  // transform slightly offset so the duplicate is visible).
  async duplicateSelected() {
    const id = this._selectedId;
    if (!id) return;
    const src = Studio.Project.getObject(id);
    if (!src) return;

    // Deep clone the data portion (skip transient fields)
    const clone = Studio.Project.createObject({
      name: src.name + ' (copy)',
      type: src.type,
      primitiveType: src.primitiveType,
      primitiveColor: src.primitiveColor,
      prefabId: src.prefabId,
      glbUrl: src.glbUrl,
      visible: true,
      targetId: src.targetId,
      imageToSlam: !!src.imageToSlam,
      transform: {
        position: { x: src.transform.position.x + 0.1, y: src.transform.position.y, z: src.transform.position.z + 0.1 },
        rotation: { ...src.transform.rotation },
        scale:    { ...src.transform.scale },
      },
      clips: [...(src.clips || [])],
      defaultAnim: src.defaultAnim,
      loop: src.loop,
      presets: JSON.parse(JSON.stringify(src.presets || {})),
      interactions: JSON.parse(JSON.stringify(src.interactions || {})),
      xrComponents: JSON.parse(JSON.stringify(src.xrComponents || {})),
    });

    // Build its viewport mesh. Prefabs + primitives both route here.
    if (clone.type === 'model' && clone.prefabId) {
      const pf = Studio.Project.getPrefab(clone.prefabId);
      const loadUrl = (pf && (pf._blobUrl || pf.glbUrl)) || clone.glbUrl;
      if (loadUrl) {
        try { await this._loadModelIntoScene(clone, loadUrl); } catch(e) {}
      }
    } else if (clone.type === 'primitive') {
      this._buildPrimitiveMesh(clone);
    }

    // Re-apply any material override and video preview the source had
    // — the cloned xrComponents were deep-copied (independent from
    // this point on) but the freshly-loaded mesh is wearing the
    // prefab's default materials. Running these against the clone
    // brings the visual state in line with the cloned data.
    this.applyMaterial(clone);
    this.syncVideoPreview(clone);

    Studio.Project.addObject(clone);
    this.selectObject(clone.id);
    Studio.toast(clone.name + ' duplicated', 'ok');
  },

  // Extracted primitive-mesh builder so duplicate() can use it too
  _buildPrimitiveMesh(obj) {
    const defs = {
      cube:     () => new THREE.BoxGeometry(0.3, 0.3, 0.3),
      sphere:   () => new THREE.SphereGeometry(0.18, 24, 16),
      cylinder: () => new THREE.CylinderGeometry(0.15, 0.15, 0.35, 24),
      plane:    () => new THREE.PlaneGeometry(0.5, 0.5),
      cone:     () => new THREE.ConeGeometry(0.18, 0.35, 24),
      torus:    () => new THREE.TorusGeometry(0.15, 0.05, 12, 32),
      empty:    () => new THREE.SphereGeometry(0.04, 8, 6),
    };
    const geoFn = defs[obj.primitiveType];
    if (!geoFn) return;
    const isEmpty = obj.primitiveType === 'empty';
    const color = obj.primitiveColor || (isEmpty ? '#666666' : '#8b5cf6');
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.5, metalness: 0.1,
      wireframe: isEmpty, opacity: isEmpty ? 0.4 : 1, transparent: isEmpty,
    });
    const mesh = new THREE.Mesh(geoFn(), mat);
    mesh.castShadow = !isEmpty;
    mesh.userData._objId = obj.id;
    mesh.traverse(c => { c.userData._objId = obj.id; });
    this.scene.add(mesh);
    obj.mesh = mesh;
    const t = obj.transform;
    mesh.position.set(t.position.x, t.position.y, t.position.z);
    mesh.rotation.set(THREE.MathUtils.degToRad(t.rotation.x), THREE.MathUtils.degToRad(t.rotation.y), THREE.MathUtils.degToRad(t.rotation.z));
    mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
    mesh.visible = obj.visible;
    // Carry over any active material override + video preview
    this.applyMaterial(obj);
    this.syncVideoPreview(obj);
  },

  // Add a plane pre-configured for video-on-target. One-click workflow:
  // user picks the video from the inspector dropdown and it just works.
  addVideoPlane() {
    this.addPrimitive('plane');
    const obj = Studio.Project.state.objects[Studio.Project.state.objects.length - 1];
    if (!obj) return;
    obj.name = 'Video Plane';
    if (!obj.xrComponents) obj.xrComponents = {};
    // Pre-populate with component defaults (matches _toggleComponent logic)
    const compDef = Studio.Components?.registry?.['video-on-target'];
    if (compDef?.properties) {
      const cfg = {};
      Object.entries(compDef.properties).forEach(([k, d]) => { cfg[k] = d.default; });
      obj.xrComponents['video-on-target'] = cfg;
    } else {
      obj.xrComponents['video-on-target'] = { src: '', width: 1, volume: 1, loop: true, fadeIn: 0.5, fadeOut: 1, resumeOnFound: true, muted: false };
    }
    Studio.Project.markDirty();
    // Refresh inspector so the user sees the video-on-target toggle already on
    Studio.Inspector.render(obj.id);
    Studio.Hierarchy.render();
    Studio.toast('Video Plane added — pick a video in the inspector', 'ok');
  },

  // ─── Load Sample Model ─────────────────────────────────
  // Load a built-in sample model. Adds it to the prefab library (or
  // finds an existing prefab for the same URL), then instantiates it.
  async loadSample(url, name) {
    Studio.toast('Loading ' + name + '…', 'ok');
    try {
      const base = (window.AR_BASE_URL || window.location.origin);
      const absUrl = url.startsWith('http') ? url : base + '/' + url.replace(/^\.\.\//, '');

      let pf = Studio.Project.getPrefabByUrl(absUrl) || Studio.Project.getPrefabByUrl(url);
      if (!pf) {
        pf = Studio.Project.createPrefab({ name, glbUrl: absUrl });
        Studio.Project.addPrefab(pf);
      }
      await this.instantiatePrefab(pf.id);
      Studio.toast(name + ' added ✓', 'ok');
    } catch(e) {
      Studio.toast('Failed: ' + e.message, 'err');
    }
  },
};
