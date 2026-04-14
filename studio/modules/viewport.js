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

    const prefab = Studio.Project.createPrefab({
      name: file.name.replace(/\.\w+$/, ''),
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
      const path = 'assets/' + Studio.Project.state.id + '/prefabs/' + prefab.id + '.glb';
      Studio.toast('Uploading ' + prefab.name + '…', 'ok');
      prefab.glbUrl = await Studio.GitHub.upload(path, await Studio.GitHub.file2b64(file));
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

  // ─── Multi-Target Visualization ────────────────────────
  showMultiTargets() {
    // Clear old target planes
    this.targetPlanes.forEach(p => this.scene.remove(p));
    this.targetPlanes = [];
    // Also clear legacy single plane
    if (this.targetPlane) { this.scene.remove(this.targetPlane); this.targetPlane = null; }

    const targets = Studio.Project.state.targets || [];
    if (targets.length === 0) return;

    const spacing = 2.0; // distance between targets
    const startX = -(targets.length - 1) * spacing / 2;

    targets.forEach((target, idx) => {
      const url = target.originalUrl || target._thumbnailDataUrl || target.thumbnailUrl;
      if (!url) return;

      const tex = new THREE.TextureLoader().load(url);
      tex.colorSpace = THREE.SRGBColorSpace;

      // Default 3:4 aspect (matches target processing)
      const pw = 1.2, ph = pw * (4/3);
      const geo = new THREE.PlaneGeometry(pw, ph);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, side: THREE.DoubleSide,
        transparent: true, opacity: 0.7
      });

      const plane = new THREE.Mesh(geo, mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(startX + idx * spacing, 0.001, 0);
      plane.userData.targetId = target.id;
      plane.userData.targetName = target.name;
      this.targetPlanes.push(plane);
      this.scene.add(plane);

      // Label above the target
      this._addTargetLabel(target.name, startX + idx * spacing, 0, ph / 2 + 0.15);
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
