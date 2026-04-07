// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Undo/Redo (Command Pattern)
// ═══════════════════════════════════════════════════════════

Studio.Undo = {
  _stack: [],
  _redoStack: [],
  MAX: 50,

  push(label) {
    const snap = JSON.parse(JSON.stringify(
      Studio.Project.state.objects.map(o => ({
        id: o.id, transform: o.transform, visible: o.visible,
        presets: o.presets, interactions: o.interactions,
        xrComponents: o.xrComponents, defaultAnim: o.defaultAnim, loop: o.loop
      }))
    ));
    this._stack.push({ label, snap });
    if (this._stack.length > this.MAX) this._stack.shift();
    this._redoStack.length = 0;
  },

  undo() {
    if (!this._stack.length) { Studio.toast('Nothing to undo', 'warn'); return; }
    const entry = this._stack.pop();
    this._redoStack.push({ label: 'redo', snap: this._currentSnap() });
    this._apply(entry.snap);
    Studio.toast('Undo: ' + entry.label, 'ok');
  },

  redo() {
    if (!this._redoStack.length) { Studio.toast('Nothing to redo', 'warn'); return; }
    const entry = this._redoStack.pop();
    this._stack.push({ label: 'undo', snap: this._currentSnap() });
    this._apply(entry.snap);
    Studio.toast('Redo', 'ok');
  },

  _currentSnap() {
    return JSON.parse(JSON.stringify(
      Studio.Project.state.objects.map(o => ({
        id: o.id, transform: o.transform, visible: o.visible,
        presets: o.presets, interactions: o.interactions,
        xrComponents: o.xrComponents, defaultAnim: o.defaultAnim, loop: o.loop
      }))
    ));
  },

  _apply(snap) {
    snap.forEach(s => {
      const obj = Studio.Project.getObject(s.id);
      if (!obj) return;
      Object.assign(obj, { transform: s.transform, visible: s.visible, presets: s.presets, interactions: s.interactions, xrComponents: s.xrComponents, defaultAnim: s.defaultAnim, loop: s.loop });
      if (obj.mesh) {
        const t = s.transform;
        obj.mesh.position.set(t.position.x, t.position.y, t.position.z);
        obj.mesh.rotation.set(THREE.MathUtils.degToRad(t.rotation.x), THREE.MathUtils.degToRad(t.rotation.y), THREE.MathUtils.degToRad(t.rotation.z));
        obj.mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
        obj.mesh.visible = s.visible;
      }
    });
    Studio.EventBus.emit('undo:applied');
  },

  init() {}
};
