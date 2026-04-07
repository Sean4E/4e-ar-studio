// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Firebase (Firestore persistence)
// ═══════════════════════════════════════════════════════════

Studio.Firebase = {
  _db: null,
  _collection: 'ar_apps',
  ready: false,

  init() {
    try {
      const cfg = window.AR_FIREBASE_CONFIG;
      if (!cfg || !cfg.apiKey || cfg.apiKey.includes('YOUR_')) {
        Studio.log('Firebase: no valid config');
        return;
      }
      if (!firebase.apps.length) {
        firebase.initializeApp(cfg);
      }
      this._db = firebase.firestore();
      this.ready = true;
      Studio.log('Firebase ready');
    } catch (e) {
      Studio.log('Firebase init failed: ' + e.message);
    }
  },

  /**
   * Save a project document. Creates or overwrites by id.
   * @param {string} id  — document id
   * @param {object} data — serialised project data
   * @returns {Promise<string>} the document id
   */
  async save(id, data) {
    if (!this._db) throw new Error('Firebase not initialised');
    const doc = { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (!id) {
      // New document
      doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await this._db.collection(this._collection).add(doc);
      Studio.log('Firebase: created ' + ref.id);
      return ref.id;
    }
    // Update existing
    doc.createdAt = data.createdAt || firebase.firestore.FieldValue.serverTimestamp();
    await this._db.collection(this._collection).doc(id).set(doc, { merge: true });
    Studio.log('Firebase: saved ' + id);
    return id;
  },

  /**
   * Load a single project by id.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async load(id) {
    if (!this._db) throw new Error('Firebase not initialised');
    const snap = await this._db.collection(this._collection).doc(id).get();
    if (!snap.exists) {
      Studio.log('Firebase: document not found — ' + id);
      return null;
    }
    Studio.log('Firebase: loaded ' + id);
    return { id: snap.id, ...snap.data() };
  },

  /**
   * List recent projects, ordered by updatedAt descending.
   * @param {number} [limit=30]
   * @returns {Promise<Array>}
   */
  async list(limit = 30) {
    if (!this._db) throw new Error('Firebase not initialised');
    const snap = await this._db
      .collection(this._collection)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();
    const results = [];
    snap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
    Studio.log('Firebase: listed ' + results.length + ' projects');
    return results;
  },

  /**
   * Delete a project by id.
   * @param {string} id
   */
  async remove(id) {
    if (!this._db) throw new Error('Firebase not initialised');
    await this._db.collection(this._collection).doc(id).delete();
    Studio.log('Firebase: deleted ' + id);
  }
};
