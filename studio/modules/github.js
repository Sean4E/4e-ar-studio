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
    // Return the GitHub Pages URL (not the API response object)
    const cfg2 = this.getConfig();
    const pageUrl = `https://${cfg2.owner}.github.io/${cfg2.repo}/${path}`;
    Studio.log('GitHub: uploaded ' + path);
    return pageUrl;
  },

  /**
   * Delete a file from the repository via the GitHub Contents API.
   * If the path points to a directory, deletes all files within it
   * recursively. Silently returns if the path does not exist.
   *
   * @param {string} path — repo-relative path
   * @param {string} [commitMessage] — custom commit message
   * @returns {Promise<{deleted:boolean,notFound?:boolean,directory?:boolean}>}
   */
  async delete(path, commitMessage) {
    const cfg = this.getConfig();
    if (!cfg.token) throw new Error('GitHub token not set');

    const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
    const headers = {
      Authorization: 'Bearer ' + cfg.token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };

    // Fetch metadata to get SHA (or list of children for a directory)
    const check = await fetch(apiUrl + '?ref=' + cfg.branch, { headers });
    if (check.status === 404) return { notFound: true };
    if (!check.ok) {
      const err = await check.json().catch(() => ({}));
      throw new Error(err.message || 'GitHub lookup failed (' + check.status + ')');
    }
    const existing = await check.json();

    // Directory → recurse into children
    if (Array.isArray(existing)) {
      for (const item of existing) {
        await this.delete(item.path, commitMessage);
      }
      return { deleted: true, directory: true };
    }

    // Single file → DELETE with SHA
    const body = {
      message: commitMessage || `Studio delete: ${path}`,
      branch: cfg.branch,
      sha: existing.sha
    };
    const resp = await fetch(apiUrl, { method: 'DELETE', headers, body: JSON.stringify(body) });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'GitHub delete failed (' + resp.status + ')');
    }
    Studio.log('GitHub: deleted ' + path);
    return { deleted: true };
  },

  /**
   * List contents at a repo path (single level).
   * @param {string} path
   * @returns {Promise<Array<{name,path,sha,size,type,download_url}>>}
   */
  async listContents(path) {
    const cfg = this.getConfig();
    if (!cfg.token) throw new Error('GitHub token not set');
    const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${cfg.branch}`;
    const headers = {
      Authorization: 'Bearer ' + cfg.token,
      Accept: 'application/vnd.github+json'
    };
    const resp = await fetch(apiUrl, { headers });
    if (resp.status === 404) return [];
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'GitHub list failed (' + resp.status + ')');
    }
    const items = await resp.json();
    return Array.isArray(items) ? items : [items];
  },

  /**
   * Delete by GitHub Pages URL — strips the owner.github.io/repo prefix
   * and calls delete(). Silent no-op if URL is empty, doesn't match
   * our repo, or the file is already gone. Returns the result of
   * delete() or null if the URL wasn't one of ours.
   *
   * @param {string} url
   * @param {string} [commitMessage]
   * @returns {Promise<object|null>}
   */
  async deleteByUrl(url, commitMessage) {
    if (!url || typeof url !== 'string') return null;
    const cfg = this.getConfig();
    const prefix = `https://${cfg.owner}.github.io/${cfg.repo}/`;
    if (!url.startsWith(prefix)) return null;
    const path = url.slice(prefix.length).split('?')[0].split('#')[0];
    if (!path) return null;
    try {
      return await this.delete(path, commitMessage);
    } catch (e) {
      Studio.log('GitHub: delete failed for ' + path + ' — ' + e.message);
      return { error: e.message };
    }
  },

  /**
   * Recursively list every file under a path (no directory entries).
   * @param {string} path
   * @returns {Promise<Array<{name,path,sha,size,type,download_url}>>}
   */
  async listContentsRecursive(path) {
    const items = await this.listContents(path);
    const files = [];
    for (const item of items) {
      if (item.type === 'dir') {
        const sub = await this.listContentsRecursive(item.path);
        files.push(...sub);
      } else {
        files.push(item);
      }
    }
    return files;
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
