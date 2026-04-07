// ═══════════════════════════════════════════════════════════
// 4E AR Studio — EventBus (pub/sub module communication)
// ═══════════════════════════════════════════════════════════

window.Studio = window.Studio || {};

Studio.EventBus = {
  _listeners: {},

  on(event, callback) {
    (this._listeners[event] = this._listeners[event] || []).push(callback);
    return () => this.off(event, callback);
  },

  off(event, callback) {
    const arr = this._listeners[event];
    if (arr) this._listeners[event] = arr.filter(fn => fn !== callback);
  },

  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => {
      try { fn(data); } catch(e) { console.error(`EventBus [${event}]:`, e); }
    });
  },

  // Debug: log all events
  debug(enabled = true) {
    if (enabled) {
      const orig = this.emit.bind(this);
      this.emit = (event, data) => { console.log(`%c[Event] ${event}`, 'color:#8b5cf6', data); orig(event, data); };
    }
  }
};
