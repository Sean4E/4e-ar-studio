// ═══════════════════════════════════════════════════════════
// 4E AR Studio — GitHub (asset upload via GitHub API)
// ═══════════════════════════════════════════════════════════

Studio.GitHub = {
  _tokenKey: '4e-ar-gh-token',

  /**
   * Return current GitHub config merged with the stored PAT.
   * @returns {{ owner:string, repo:string, branch:string, token:string }}
   */
  getConfig() {
    const cfg = { ...(window.AR_GITHUB_CONFIG || {}) };
    cfg.token = localStorage.getItem(this._tokenKey) || cfg.token || '';
    return cfg;
  },

  /**
   * Upload a file to the repository via the GitHub Contents API.
   * If the file already exists it will be overwritten (SHA is resolved automatically).
   *
   * @param {string} path  — repo-relative path, e.g. "projects/abc/model.glb"
   * @param {string} b64   — base-64 encoded file content
   * @returns {Promise<object>} GitHub API response JSON
   */
  async upload(path, b64) {
    const cfg = this.getConfig();
    if (!cfg.token) throw new Error('GitHub token not set');

    const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
    const headers = {
      Authorization: 'Bearer ' + cfg.token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };

    // Check if file already exists (need SHA to update)
    let sha;
    try {
      const check = await fetch(apiUrl + '?ref=' + cfg.branch, { headers });
      if (check.ok) {
        const existing = await check.json();
        sha = existing.sha;
      }
    } catch (_) { /* file does not exist yet, that is fine */ }

    const body = {
      message: `Studio upload: ${path}`,
      branch: cfg.branch,
      content: b64
    };
    if (sha) body.sha = sha;

    const resp = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'GitHub upload failed (' + resp.status + ')');
    }

    const result = await resp.json();
    Studio.log('GitHub: uploaded ' + path);
    return result;
  },

  /**
   * Convert an ArrayBuffer to a base-64 string.
   * @param {ArrayBuffer} buf
   * @returns {string}
   */
  ab2b64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  /**
   * Read a File object and return its base-64 representation.
   * @param {File} file
   * @returns {Promise<string>}
   */
  file2b64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result is a data URL; strip the prefix
        const b64 = reader.result.split(',')[1];
        resolve(b64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  },

  init() {
    Studio.log('GitHub module ready');
  }
};
