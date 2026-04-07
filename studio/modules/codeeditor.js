// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Code Editor (CodeMirror 5)
// ═══════════════════════════════════════════════════════════

Studio.CodeEditor = {
  _cm: null,
  _currentObjId: null,

  init() {
    // Create CodeMirror instance inside #code-editor-container
    const container = document.getElementById('code-editor-container');
    if (!container) { Studio.log('CodeEditor: container not found'); return; }

    this._cm = CodeMirror(container, {
      value: '',
      mode: 'javascript',
      theme: 'material-darker',
      lineNumbers: true,
      tabSize: 2,
      indentWithTabs: false,
      autoCloseBrackets: true,
      matchBrackets: true,
      lineWrapping: true,
      placeholder: '// Select an object, then write custom JS here.\n// Runs once when the AR scene loads.\n// Available: el (A-Frame entity), THREE, scene',
      extraKeys: {
        'Ctrl-S': () => this.save(),
        'Cmd-S':  () => this.save()
      }
    });

    // Auto-save on changes (debounced)
    this._cm.on('changes', this._debounce(() => this.save(), 1000));

    // Listen for object selection
    Studio.EventBus.on('object:selected', ({ id }) => this.load(id));
    Studio.EventBus.on('object:deselected', () => this._clearEditor());
    Studio.EventBus.on('project:reset', () => this._clearEditor());
    Studio.EventBus.on('project:loaded', () => {
      // If an object was previously selected, re-load its code
      if (this._currentObjId) {
        const obj = Studio.Project.getObject(this._currentObjId);
        if (obj) {
          this._cm.setValue(obj.customCode || '');
        } else {
          this._clearEditor();
        }
      }
    });

    Studio.log('CodeEditor ready');
  },

  /**
   * Load the customCode for a specific object into the editor.
   * @param {string} id — object id
   */
  load(id) {
    // Save current object's code before switching
    if (this._currentObjId && this._currentObjId !== id) {
      this.save();
    }

    const obj = Studio.Project.getObject(id);
    if (!obj) { this._clearEditor(); return; }

    this._currentObjId = id;
    this._cm.setValue(obj.customCode || '');
    this._cm.setOption('readOnly', false);
    this._cm.refresh();
  },

  /**
   * Save the current editor content back to the selected object's customCode.
   */
  save() {
    if (!this._currentObjId || !this._cm) return;

    const obj = Studio.Project.getObject(this._currentObjId);
    if (!obj) return;

    const code = this._cm.getValue();
    if (code !== obj.customCode) {
      obj.customCode = code;
      Studio.Project.markDirty();
      Studio.log('CodeEditor: saved code for ' + obj.name);
    }
  },

  // ─── Internal ─────────────────────────────────────────
  _clearEditor() {
    this.save(); // persist any pending edits
    this._currentObjId = null;
    if (this._cm) {
      this._cm.setValue('');
      this._cm.setOption('readOnly', 'nocursor');
    }
  },

  _debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }
};
