// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Thumbnail generator
// Renders a GLB/GLTF into a small PNG using an offscreen Three.js
// renderer. Used by the prefab library to show a real 3D preview
// instead of the 📦 emoji. Same renderer can be reused for other
// asset previews later (primitives, environments, etc.).
// ═══════════════════════════════════════════════════════════

Studio.Thumbnails = {
  SIZE: 128,                   // px — Firestore-friendly data URL size + fits card nicely
  _renderer: null,             // shared offscreen renderer
  _canvas: null,
  _loader: null,

  _ensureRenderer() {
    if (this._renderer) return;
    this._canvas = document.createElement('canvas');
    this._canvas.width = this.SIZE;
    this._canvas.height = this.SIZE;
    this._renderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,   // required for toDataURL
    });
    this._renderer.setPixelRatio(1);
    this._renderer.setSize(this.SIZE, this.SIZE, false);
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Let the card CSS background show through transparent corners
    this._renderer.setClearColor(0x000000, 0);
    this._loader = new THREE.GLTFLoader();
    if (THREE.DRACOLoader) {
      const draco = new THREE.DRACOLoader();
      draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.147.0/examples/jsm/libs/draco/');
      this._loader.setDRACOLoader(draco);
    }
  },

  // Load a GLB (local blob or remote URL) and produce a tightly-framed
  // PNG data URL. Rejects on load failure / empty scene.
  async renderGlb(url) {
    this._ensureRenderer();
    const gltf = await new Promise((resolve, reject) => {
      this._loader.load(url, resolve, undefined, reject);
    });

    const scene = new THREE.Scene();
    const model = gltf.scene;
    scene.add(model);

    // Fit the camera to the model's bounding box. A small framing
    // margin prevents the geometry from touching the edges.
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) throw new Error('Empty model');
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    model.position.sub(center);     // centre on origin

    // Simple three-point-ish lighting for decent shading on any model
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 3, 4);
    const fill = new THREE.DirectionalLight(0xffffff, 0.45);
    fill.position.set(-3, 1.5, 2);
    const amb = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(key, fill, amb);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim * 2.2;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
    camera.position.set(dist, dist * 0.7, dist);
    camera.lookAt(0, 0, 0);

    this._renderer.render(scene, camera);
    const dataUrl = this._canvas.toDataURL('image/png');

    // Tear down scene (disposes referenced GPU resources on next frame)
    scene.remove(model, key, fill, amb);
    model.traverse(o => {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      }
    });

    return dataUrl;
  },

  // Convert a data URL like "data:image/png;base64,XXXX" into just the
  // base-64 portion — Studio.GitHub.upload expects it without the prefix.
  dataUrlToB64(dataUrl) {
    return dataUrl.split(',')[1];
  },
};
