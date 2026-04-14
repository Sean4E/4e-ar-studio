// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Project State Management
// ═══════════════════════════════════════════════════════════

Studio.Project = {
  state: {
    id: null,
    name: 'Untitled',
    version: 2,
    trackingMode: 'slam', // 'image' | 'slam' | 'face' | 'hand'

    target: {
      mindUrl: '',
      imageUrl: '',
      mindBuffer: null, // transient
      imgFile: null      // transient
    },

    // 8th Wall native image targets (new multi-target system)
    targets: [],

    objects: [],

    scene: {
      shadowCatcher: true,
      ambientIntensity: 0.5,
      directIntensity: 0.8,
      // spawnMode controls how SLAM-tracked objects appear in the
      // published app: 'showOnStart' = visible from frame 1 at saved
      // world transform; 'tapToPlace' = hidden until user taps any
      // detected ground surface, then anchored at the tap point.
      spawnMode: 'showOnStart',
    },

    splash: {
      title: '',
      subtitle: '',
      bgColor: '#060a18',
      textColor: '#e2e8f0',
      accentColor: '#8b5cf6',
      logoUrl: '',
      logoFile: null,  // transient
      showSpinner: true,
      showBranding: true,
      showLogo: true,
      showTitle: true,
      showSubtitle: true,
      gradient: '',
      duration: 3,
    },

    media: [],  // uploaded audio/video/image files { name, url, type }

    // Uploaded 3D models, Unity-style. Each prefab is a SOURCE; scene
    // objects reference it via `prefabId` and can be instantiated
    // multiple times with independent transforms / targetIds /
    // components. Removing an instance from the scene does not remove
    // the prefab from the library.
    prefabs: [],  // { id, name, glbUrl, clips[], file?(transient), sortOrder }

    // PWA: URLs of generated app icons (populated on publish)
    pwa: { icon192Url: '', icon512Url: '', appleIconUrl: '' },

    dirty: false,
    createdAt: null,
    updatedAt: null
  },

  // ─── Prefab CRUD ───────────────────────────────────────
  createPrefab(overrides = {}) {
    return {
      id: 'pf_' + this._genId(),
      name: 'Model',
      glbUrl: '',
      file: null,     // transient, cleared after upload
      clips: [],      // animation clip names, detected on first load
      sortOrder: this.state.prefabs.length,
      ...overrides
    };
  },

  addPrefab(prefab) {
    this.state.prefabs.push(prefab);
    this.markDirty();
    Studio.EventBus.emit('prefab:added', { prefab });
    return prefab;
  },

  getPrefab(id) {
    return this.state.prefabs.find(p => p.id === id) || null;
  },

  // Find a prefab by its glbUrl (useful for migrating legacy objects
  // whose glbUrl was stored inline and deduping on import).
  getPrefabByUrl(url) {
    if (!url) return null;
    return this.state.prefabs.find(p => p.glbUrl === url) || null;
  },

  // ─── Object CRUD ───────────────────────────────────────
  createObject(overrides = {}) {
    return {
      id: this._genId(),
      name: 'Object',
      type: 'model',       // 'model' | 'primitive'
      primitiveType: null, // 'cube' | 'sphere' | 'cylinder' | 'plane' | 'cone' | 'torus'
      primitiveColor: null,
      prefabId: null,      // reference into state.prefabs for model instances
      glbUrl: '',          // legacy / denormalised; always matches prefab.glbUrl when prefabId is set
      file: null,         // transient (legacy direct-upload path)
      visible: true,
      targetId: null,      // which image target this object belongs to
      imageToSlam: false,  // on first image-found, promote object to world space (SLAM anchor) so it stays put when target is lost
      parentId: null,
      sortOrder: this.state.objects.length,

      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale:    { x: 1, y: 1, z: 1 }
      },

      clips: [],
      defaultAnim: '',
      loop: 'repeat',

      presets: { spin: null, bob: null, pulse: null },

      interactions: {
        holdDrag: false,
        pinchScale: false,
        oneFingerRotate: false,
        twoFingerRotate: false,
        tapRecenter: false,
        autoSpin: false,
        faceCamera: false,
        castShadow: true,
        facePoint: 'forehead'
      },

      xrComponents: {},
      customCode: '',
      mesh: null,  // transient Three.js reference

      ...overrides
    };
  },

  addObject(obj) {
    this.state.objects.push(obj);
    this.markDirty();
    Studio.EventBus.emit('object:added', { object: obj });
    return obj;
  },

  removeObject(id) {
    const idx = this.state.objects.findIndex(o => o.id === id);
    if (idx < 0) return null;
    const obj = this.state.objects.splice(idx, 1)[0];
    this.markDirty();
    Studio.EventBus.emit('object:removed', { id, object: obj });
    // Clean up any GitHub-hosted media URLs owned by this object
    // (audio/video/image in xrComponents). Fire-and-forget.
    //
    // IMPORTANT: do NOT delete the object's GLB. GLBs live in the
    // prefab library now — removing an instance from the scene must
    // not delete the shared prefab file. The prefab is only deleted
    // when the user explicitly removes it from the library.
    if (Studio.GitHub?.deleteByUrl) {
      const urls = [];
      const xr = obj.xrComponents || {};
      Object.values(xr).forEach(cfg => {
        if (cfg && typeof cfg === 'object') {
          const u = cfg.src || cfg.video || cfg.image;
          if (u && typeof u === 'string' && !u.startsWith('#')) urls.push(u);
        }
      });
      const stillReferenced = new Set();
      this.state.objects.forEach(o => {
        const x = o.xrComponents || {};
        Object.values(x).forEach(c => {
          if (c && typeof c === 'object') {
            const u = c.src || c.video || c.image;
            if (u && typeof u === 'string' && !u.startsWith('#')) stillReferenced.add(u);
          }
        });
      });
      (this.state.media || []).forEach(m => { if (m.url) stillReferenced.add(m.url); });
      urls.filter(u => !stillReferenced.has(u)).forEach(u => {
        Studio.GitHub.deleteByUrl(u).catch(() => {});
      });
    }
    return obj;
  },

  // Remove a prefab from the library AND all its instances from the scene.
  // Also deletes the shared GLB from GitHub. This is the explicit
  // "remove from library" action — different from scene-instance delete.
  removePrefab(id) {
    const idx = this.state.prefabs.findIndex(p => p.id === id);
    if (idx < 0) return null;
    const prefab = this.state.prefabs.splice(idx, 1)[0];

    // Drop any scene instances that reference this prefab
    const toRemove = this.state.objects.filter(o => o.prefabId === id).map(o => o.id);
    toRemove.forEach(oid => this.removeObject(oid));

    // Free the session-only blob URL so it doesn't leak memory
    if (prefab._blobUrl) {
      try { URL.revokeObjectURL(prefab._blobUrl); } catch(e) {}
    }

    // Delete the shared GLB from GitHub
    if (Studio.GitHub?.deleteByUrl && prefab.glbUrl) {
      Studio.GitHub.deleteByUrl(prefab.glbUrl).catch(() => {});
    }
    this.markDirty();
    Studio.EventBus.emit('prefab:removed', { id, prefab });
    return prefab;
  },

  getObject(id) {
    return this.state.objects.find(o => o.id === id) || null;
  },

  // ─── Serialization ─────────────────────────────────────
  serialize() {
    const s = this.state;
    return {
      name: s.name,
      version: s.version,
      trackingMode: s.trackingMode,
      target: { mindUrl: s.target.mindUrl, imageUrl: s.target.imageUrl },
      // 8th Wall native image targets
      targets: (s.targets || []).map(t => ({
        id: t.id, name: t.name, type: t.type, quality: t.quality,
        properties: JSON.parse(JSON.stringify(t.properties)),
        originalUrl: t.originalUrl, luminanceUrl: t.luminanceUrl,
        thumbnailUrl: t.thumbnailUrl, objectIds: [...(t.objectIds || [])],
      })),
      prefabs: (s.prefabs || []).map(p => ({
        id: p.id, name: p.name, glbUrl: p.glbUrl,
        clips: [...(p.clips || [])], sortOrder: p.sortOrder || 0
      })),
      objects: s.objects.map(o => ({
        id: o.id, name: o.name, type: o.type,
        primitiveType: o.primitiveType || null, primitiveColor: o.primitiveColor || null,
        prefabId: o.prefabId || null,
        glbUrl: o.glbUrl,
        visible: o.visible, targetId: o.targetId, imageToSlam: !!o.imageToSlam,
        parentId: o.parentId, sortOrder: o.sortOrder,
        transform: JSON.parse(JSON.stringify(o.transform)),
        clips: [...o.clips], defaultAnim: o.defaultAnim, loop: o.loop,
        presets: JSON.parse(JSON.stringify(o.presets)),
        interactions: JSON.parse(JSON.stringify(o.interactions)),
        xrComponents: JSON.parse(JSON.stringify(o.xrComponents)),
        customCode: o.customCode
      })),
      scene: JSON.parse(JSON.stringify(s.scene)),
      splash: {
        title: s.splash.title, subtitle: s.splash.subtitle,
        bgColor: s.splash.bgColor, textColor: s.splash.textColor,
        accentColor: s.splash.accentColor, logoUrl: s.splash.logoUrl,
        showSpinner: s.splash.showSpinner, showBranding: s.splash.showBranding,
        showLogo: s.splash.showLogo, showTitle: s.splash.showTitle,
        showSubtitle: s.splash.showSubtitle, gradient: s.splash.gradient,
        duration: s.splash.duration || 3
      },
      media: (s.media || []).map(m => ({ name: m.name, url: m.url, type: m.type })),
      pwa: {
        icon192Url: s.pwa?.icon192Url || '',
        icon512Url: s.pwa?.icon512Url || '',
        appleIconUrl: s.pwa?.appleIconUrl || '',
        sourceKey: s.pwa?.sourceKey || '',
      },
      updatedAt: null // set by Firebase
    };
  },

  deserialize(data) {
    const s = this.state;
    s.name = data.name || 'Untitled';
    s.version = data.version || 1;
    s.trackingMode = data.trackingMode || 'image';
    s.target.mindUrl = data.target?.mindUrl || data.mindUrl || '';
    s.target.imageUrl = data.target?.imageUrl || '';
    s.target.mindBuffer = null;
    s.target.imgFile = null;
    // Restore 8th Wall native targets
    s.targets = (data.targets || []).map(t => ({
      id: t.id, name: t.name, type: t.type || 'PLANAR',
      quality: t.quality || 0,
      properties: t.properties || {},
      originalUrl: t.originalUrl || '', luminanceUrl: t.luminanceUrl || '',
      thumbnailUrl: t.thumbnailUrl || '', objectIds: t.objectIds || [],
      _imageFile: null, _luminanceDataUrl: '', _thumbnailDataUrl: '',
    }));
    s.scene = { ...s.scene, ...(data.scene || {}) };
    s.splash = { ...s.splash, ...(data.splash || {}) };
    s.media = (data.media || []).map(m => ({ name: m.name, url: m.url, type: m.type }));
    s.pwa = {
      icon192Url: data.pwa?.icon192Url || '',
      icon512Url: data.pwa?.icon512Url || '',
      appleIconUrl: data.pwa?.appleIconUrl || '',
      sourceKey: data.pwa?.sourceKey || '',
    };
    s.createdAt = data.createdAt;
    s.updatedAt = data.updatedAt;

    // Prefabs — restore saved library first
    s.prefabs = (data.prefabs || []).map(p => ({
      id: p.id, name: p.name || 'Model',
      glbUrl: p.glbUrl || '',
      clips: [...(p.clips || [])],
      sortOrder: p.sortOrder || 0,
      file: null,
    }));

    // Parse objects (handle legacy single-model format)
    s.objects = [];
    if (data.objects?.length) {
      data.objects.forEach(od => {
        s.objects.push(this.createObject({
          id: od.id, name: od.name, type: od.type || 'model',
          primitiveType: od.primitiveType || null, primitiveColor: od.primitiveColor || null,
          prefabId: od.prefabId || null,
          glbUrl: od.glbUrl, visible: od.visible !== false,
          targetId: od.targetId || null, imageToSlam: !!od.imageToSlam,
          parentId: od.parentId, sortOrder: od.sortOrder || 0,
          transform: od.transform || { position:{x:0,y:0,z:0}, rotation:{x:0,y:0,z:0}, scale:{x:1,y:1,z:1} },
          clips: od.clips || [], defaultAnim: od.defaultAnim || '', loop: od.loop || 'repeat',
          presets: od.presets || { spin:null, bob:null, pulse:null },
          interactions: od.interactions || {},
          xrComponents: od.xrComponents || {},
          customCode: od.customCode || ''
        }));
      });
    } else if (data.glbUrl) {
      // Legacy single-model format
      s.objects.push(this.createObject({
        name: data.name || 'Model', glbUrl: data.glbUrl,
        transform: {
          position: { x: data.posX||0, y: data.posY||0, z: data.posZ||0 },
          rotation: { x: data.rotX||0, y: data.rotY||0, z: data.rotZ||0 },
          scale: { x: data.scale||1, y: data.scale||1, z: data.scale||1 }
        },
        clips: data.animations || [], defaultAnim: data.defaultAnimation || '',
        loop: data.loopMode || 'repeat'
      }));
    }

    // Migration: if any model object has glbUrl but no prefabId, auto-
    // promote it into a prefab and backfill the objects' prefabId. This
    // lets pre-prefab projects inherit the library without the user
    // having to do anything — they just open the project and save.
    s.objects.forEach(o => {
      if (o.type === 'model' && o.glbUrl && !o.prefabId) {
        let pf = this.getPrefabByUrl(o.glbUrl);
        if (!pf) {
          pf = this.createPrefab({
            name: o.name || 'Model',
            glbUrl: o.glbUrl,
            clips: [...(o.clips || [])],
          });
          s.prefabs.push(pf);
        }
        o.prefabId = pf.id;
      }
      // Denormalise: ensure instance.glbUrl matches prefab.glbUrl so the
      // viewport/player can always use obj.glbUrl directly even if only
      // prefabId was persisted.
      if (o.prefabId) {
        const pf = this.getPrefab(o.prefabId);
        if (pf && pf.glbUrl && o.glbUrl !== pf.glbUrl) o.glbUrl = pf.glbUrl;
      }
    });

    s.dirty = false;
    Studio.EventBus.emit('project:loaded', { id: s.id, name: s.name });
  },

  reset() {
    const s = this.state;
    s.id = null;
    s.name = 'Untitled';
    s.trackingMode = 'slam';
    s.target = { mindUrl: '', imageUrl: '', mindBuffer: null, imgFile: null };
    s.targets = [];
    s.objects = [];
    s.scene = { shadowCatcher: true, ambientIntensity: 0.5, directIntensity: 0.8, spawnMode: 'showOnStart' };
    s.splash = { title:'', subtitle:'', bgColor:'#060a18', textColor:'#e2e8f0', accentColor:'#8b5cf6', logoUrl:'', logoFile:null, showSpinner:true, showBranding:true, showLogo:true, showTitle:true, showSubtitle:true, gradient:'', duration:3 };
    s.media = [];
    s.prefabs = [];
    s.pwa = { icon192Url: '', icon512Url: '', appleIconUrl: '' };
    s.dirty = false;
    Studio.EventBus.emit('project:reset');
  },

  markDirty() {
    this.state.dirty = true;
    Studio.EventBus.emit('project:dirty');
  },

  _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
};
