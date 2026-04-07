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

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    this.scene.add(dir);

    // Grid + axes
    this.scene.add(new THREE.GridHelper(6, 30, 0x222244, 0x1a1a3a));
    const axes = new THREE.AxesHelper(0.4);
    axes.position.set(-3, 0, -3);
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
    Studio.EventBus.on('project:loaded', () => this._rebuildScene());
    Studio.EventBus.on('object:removed', ({ id, object }) => this._removeFromScene(object));

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

  async handleModelFile(file) {
    if (!file) return;
    const obj = Studio.Project.createObject({
      name: file.name.replace(/\.\w+$/, ''),
      file: file,
    });
    const url = URL.createObjectURL(file);
    await this._loadModelIntoScene(obj, url);
    Studio.Project.addObject(obj);
    this.selectObject(obj.id);
    Studio.toast(obj.name + ' added', 'ok');
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
    Studio.Project.state.objects.forEach(o => { if (o.mesh) this.scene.remove(o.mesh); });
    this.mixers.length = 0;
    if (this.targetPlane) { this.scene.remove(this.targetPlane); this.targetPlane = null; }
    this.deselectAll();
  },

  // ─── Rebuild Scene from Project State ──────────────────
  async _rebuildScene() {
    this._clearScene();
    const state = Studio.Project.state;

    // Target plane
    if (state.target.imageUrl) {
      this._showTargetPlaneFromUrl(state.target.imageUrl);
    }
    // Hide target plane for non-image modes
    if (state.trackingMode !== 'image' && this.targetPlane) {
      this.targetPlane.visible = false;
    }

    // Load objects
    for (const obj of state.objects) {
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
  },

  // ─── Tracking Mode Helper (face/hand reference) ─────────
  showTrackingHelper(mode) {
    this.removeTrackingHelper();

    if (mode === 'face') {
      // Simple face outline using a sphere + features
      const group = new THREE.Group();
      group.name = '_trackingHelper';

      // Head sphere (wireframe)
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: 0.3 })
      );
      head.position.y = 0.15;
      group.add(head);

      // Nose
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.015, 0.04, 6),
        new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.5 })
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

  // ─── Load Sample Model ─────────────────────────────────
  async loadSample(url, name) {
    Studio.toast('Loading ' + name + '…', 'ok');
    try {
      // Resolve to absolute URL for the player to load
      const base = (window.AR_BASE_URL || window.location.origin);
      const absUrl = url.startsWith('http') ? url : base + '/' + url.replace(/^\.\.\//, '');
      const obj = Studio.Project.createObject({ name: name });
      // Set glbUrl immediately — samples are already hosted
      obj.glbUrl = absUrl;
      await this._loadModelIntoScene(obj, url);
      Studio.Project.addObject(obj);
      this.selectObject(obj.id);
      Studio.toast(name + ' added ✓', 'ok');
    } catch(e) {
      Studio.toast('Failed: ' + e.message, 'err');
    }
  },
};
