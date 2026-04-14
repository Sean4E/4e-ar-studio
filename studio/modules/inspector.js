// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Inspector Panel (auto-generated from registry)
// ═══════════════════════════════════════════════════════════

Studio.Inspector = {
  currentId: null,

  init() {
    Studio.EventBus.on('object:selected', ({ id }) => this.render(id));
    Studio.EventBus.on('object:deselected', () => this.clear());
    Studio.EventBus.on('object:transformed', ({ id }) => {
      if (id === this.currentId) this._syncTransform();
    });
    Studio.EventBus.on('undo:applied', () => {
      if (this.currentId) this.render(this.currentId);
    });
  },

  clear() {
    this.currentId = null;
    document.getElementById('insp-empty').classList.remove('hidden');
    document.getElementById('insp-content').classList.add('hidden');
  },

  render(id) {
    const obj = Studio.Project.getObject(id);
    if (!obj) { this.clear(); return; }
    this.currentId = id;

    document.getElementById('insp-empty').classList.add('hidden');
    const content = document.getElementById('insp-content');
    content.classList.remove('hidden');
    content.innerHTML = '';

    // Name
    content.appendChild(this._buildSection('Name', `
      <input class="insp-input" value="${this._esc(obj.name)}" onchange="Studio.Inspector._setName(this.value)" style="width:100%">
    `));

    // Transform
    content.appendChild(this._buildTransformSection(obj));

    // Animation (if model has clips)
    if (obj.clips?.length) {
      content.appendChild(this._buildAnimSection(obj));
    }

    // Preset Animations
    content.appendChild(this._buildPresetSection(obj));

    // Target Assignment (image mode with targets)
    const mode = Studio.Project.state.trackingMode;
    if (mode === 'image' && Studio.Project.state.targets.length > 0) {
      content.appendChild(this._buildTargetAssignSection(obj));
    }

    // xrextras Components — grouped by category, filtered by tracking mode
    const cats = Studio.Components.categories;
    Object.keys(cats).sort((a, b) => cats[a].order - cats[b].order).forEach(catKey => {
      const comps = Studio.Components.getByCategory(catKey)
        .filter(c => c.trackingModes.includes(mode) && (c.appliesTo === 'entity' || c.appliesTo === 'both'))
        .filter(c => !c.hidden);  // registry-flagged hidden components stay configurable via data but don't clutter the UI
      if (!comps.length) return;
      content.appendChild(this._buildComponentCategory(catKey, comps, obj));
    });

    // Scene Settings
    content.appendChild(this._buildSceneSection());

    // Delete
    content.appendChild(this._buildSection('', `
      <button class="insp-btn danger" onclick="Studio.Inspector._deleteSelected()">Delete Object</button>
    `));
  },

  // ─── Transform Section ─────────────────────────────────
  _buildTransformSection(obj) {
    const t = obj.transform;
    const uniformChecked = window._uniformScale !== false ? 'checked' : '';

    const resetBtn = (key, def) => `<button onclick="Studio.Inspector._resetT('${key}',${def})" title="Reset to ${def}" style="background:none;border:1px solid var(--border);color:var(--faint);width:18px;height:18px;border-radius:3px;cursor:pointer;font-size:9px;flex-shrink:0;padding:0;line-height:16px" onmouseover="this.style.borderColor='var(--purple)'" onmouseout="this.style.borderColor='var(--border)'">&circlearrowleft;</button>`;

    const posRow = (axis, val) => `
      <div class="insp-row">
        <label class="${axis}">${axis.toUpperCase()}</label>
        <input type="range" min="-3" max="3" step="0.01" value="${val}" oninput="Studio.Inspector._setT('p${axis}',this.value);this.nextElementSibling.value=this.value" style="flex:1">
        <input type="number" step="0.01" class="insp-input" id="ip-p${axis}" value="${val}" onchange="Studio.Inspector._setT('p${axis}',this.value);this.previousElementSibling.value=this.value" style="width:50px;flex:none">
        ${resetBtn('p'+axis, 0)}
      </div>`;

    const rotRow = (axis, val) => `
      <div class="insp-row">
        <label class="${axis}">${axis.toUpperCase()}</label>
        <input type="range" min="-180" max="180" step="1" value="${val}" oninput="Studio.Inspector._setT('r${axis}',this.value);this.nextElementSibling.value=this.value" style="flex:1">
        <input type="number" step="1" class="insp-input" id="ip-r${axis}" value="${val}" onchange="Studio.Inspector._setT('r${axis}',this.value);this.previousElementSibling.value=this.value" style="width:50px;flex:none">
        ${resetBtn('r'+axis, 0)}
      </div>`;

    const scaleRow = (axis, val) => `
      <div class="insp-row">
        <label class="${axis}">${axis.toUpperCase()}</label>
        <input type="range" min="0.01" max="5" step="0.01" value="${val}" oninput="Studio.Inspector._setScale('s${axis}',this.value);this.nextElementSibling.value=this.value" style="flex:1">
        <input type="number" step="0.01" class="insp-input" id="ip-s${axis}" value="${val}" onchange="Studio.Inspector._setScale('s${axis}',this.value);this.previousElementSibling.value=this.value" style="width:50px;flex:none">
        ${resetBtn('s'+axis, 1)}
      </div>`;

    return this._buildSection('Transform', `
      <div class="insp-label" style="margin-top:2px" title="Object position in 3D space (meters)">Position</div>
      ${posRow('x', t.position.x)}${posRow('y', t.position.y)}${posRow('z', t.position.z)}
      <div class="insp-label" style="margin-top:6px" title="Object rotation in degrees (-180 to 180)">Rotation</div>
      ${rotRow('x', t.rotation.x)}${rotRow('y', t.rotation.y)}${rotRow('z', t.rotation.z)}
      <div class="insp-label" style="margin-top:6px" title="Object scale multiplier. Uniform keeps all axes the same.">Scale <label class="insp-check" style="float:right;font-size:9px" title="When checked, changing any axis sets all three to the same value"><input type="checkbox" ${uniformChecked} onchange="window._uniformScale=this.checked"> Uniform</label></div>
      ${scaleRow('x', t.scale.x)}${scaleRow('y', t.scale.y)}${scaleRow('z', t.scale.z)}
    `);
  },

  // ─── Animation Section ─────────────────────────────────
  _buildAnimSection(obj) {
    const options = obj.clips.map(c => `<option value="${c}" ${c === obj.defaultAnim ? 'selected' : ''}>${c}</option>`).join('');
    // Build clickable clip list for animation mixer
    const clipBtns = obj.clips.map(c =>
      `<button class="sp-btn" style="font-size:9px;margin:1px;${c===obj.defaultAnim?'border-color:var(--purple);color:var(--purple2)':''}" onclick="Studio.Inspector._setAnim('${c}')" title="Click to play '${c}'">${c}</button>`
    ).join('');

    return this._buildSection('🎞 Animation', `
      <div class="insp-label" title="Select which animation clip to play by default">Default Clip</div>
      <select class="insp-select" onchange="Studio.Inspector._setAnim(this.value)" title="Choose the animation that plays when the AR experience loads">
        <option value="">— None (static) —</option>${options}
      </select>
      <div class="insp-label" style="margin-top:6px" title="How the animation repeats">Loop Mode</div>
      <select class="insp-select" onchange="Studio.Inspector._setLoop(this.value)" title="repeat: plays forever, once: plays one time, none: no animation">
        <option value="repeat" ${obj.loop==='repeat'?'selected':''}>Repeat (loop forever)</option>
        <option value="once" ${obj.loop==='once'?'selected':''}>Once (play and stop)</option>
        <option value="none" ${obj.loop==='none'?'selected':''}>None (disabled)</option>
      </select>
      ${obj.clips.length > 1 ? `
        <div class="insp-label" style="margin-top:6px" title="Click a clip to preview it. Active clip shown in purple.">Available Clips (${obj.clips.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:2px">${clipBtns}</div>
      ` : ''}
    `);
  },

  // ─── Preset Animations ─────────────────────────────────
  _buildPresetSection(obj) {
    const p = obj.presets || {};
    const spin = p.spin || {};
    const bob = p.bob || {};
    const pulse = p.pulse || {};
    return this._buildSection('Preset Animations', `
      <div class="comp-group">
        <label class="insp-check"><input type="checkbox" ${p.spin?'checked':''} onchange="Studio.Inspector._togglePreset('spin',this.checked)"> 🔄 Spin</label>
        ${p.spin ? `<div class="comp-group-body"><div class="insp-row"><label style="width:40px;font-size:9px;color:var(--muted)">Speed</label><input type="range" min="0.1" max="5" step="0.1" value="${spin.speed||1}" oninput="Studio.Inspector._setPresetVal('spin','speed',+this.value)" style="flex:1"><span style="font-size:9px;width:24px">${(spin.speed||1).toFixed(1)}</span></div></div>` : ''}
      </div>
      <div class="comp-group">
        <label class="insp-check"><input type="checkbox" ${p.bob?'checked':''} onchange="Studio.Inspector._togglePreset('bob',this.checked)"> ↕ Bob</label>
        ${p.bob ? `<div class="comp-group-body"><div class="insp-row"><label style="width:40px;font-size:9px;color:var(--muted)">Height</label><input type="range" min="0.01" max="0.3" step="0.01" value="${bob.height||0.05}" oninput="Studio.Inspector._setPresetVal('bob','height',+this.value)" style="flex:1"><span style="font-size:9px;width:24px">${(bob.height||0.05).toFixed(2)}</span></div></div>` : ''}
      </div>
      <div class="comp-group">
        <label class="insp-check"><input type="checkbox" ${p.pulse?'checked':''} onchange="Studio.Inspector._togglePreset('pulse',this.checked)"> 💓 Pulse</label>
        ${p.pulse ? `<div class="comp-group-body"><div class="insp-row"><label style="width:40px;font-size:9px;color:var(--muted)">Amount</label><input type="range" min="0.02" max="0.3" step="0.01" value="${pulse.amount||0.08}" oninput="Studio.Inspector._setPresetVal('pulse','amount',+this.value)" style="flex:1"><span style="font-size:9px;width:24px">${(pulse.amount||0.08).toFixed(2)}</span></div></div>` : ''}
      </div>
    `);
  },

  // ─── Component Category (auto-generated) ───────────────
  _buildComponentCategory(catKey, comps, obj) {
    const cat = Studio.Components.categories[catKey];
    let inner = '';
    comps.forEach(comp => {
      const enabled = !!(obj.xrComponents?.[comp.key] || obj.interactions?.[this._ixKey(comp.key)]);
      if (comp.type === 'boolean') {
        inner += `<label class="insp-check" title="${comp.description || ''}"><input type="checkbox" ${enabled?'checked':''} onchange="Studio.Inspector._toggleComponent('${comp.key}',this.checked)"> ${comp.icon} ${comp.name}</label>`;
      } else if (comp.type === 'config') {
        inner += `<div class="comp-group">
          <div class="comp-group-header" title="${comp.description || ''}">
            <input type="checkbox" ${enabled?'checked':''} onchange="Studio.Inspector._toggleComponent('${comp.key}',this.checked)">
            <span>${comp.icon} ${comp.name}</span>
          </div>`;
        if (enabled && comp.properties) {
          inner += '<div class="comp-group-body">';
          Object.entries(comp.properties).forEach(([propKey, propDef]) => {
            const val = obj.xrComponents?.[comp.key]?.[propKey] ?? propDef.default;
            inner += this._buildPropertyInput(comp.key, propKey, propDef, val);
          });
          inner += '</div>';
        }
        inner += '</div>';
      }
    });
    return this._buildSection(`${cat.icon} ${cat.label}`, inner);
  },

  _buildPropertyInput(compKey, propKey, def, val) {
    if (def.type === 'select') {
      const opts = def.options.map(o => `<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('');
      return `<div class="insp-row"><label style="font-size:9px;color:var(--muted);width:60px">${def.label}</label><select class="insp-select" style="font-size:10px;padding:2px 4px" onchange="Studio.Inspector._setCompProp('${compKey}','${propKey}',this.value)">${opts}</select></div>`;
    }
    if (def.type === 'range') {
      return `<div class="insp-row"><label style="font-size:9px;color:var(--muted);width:60px" title="${def.label}: ${def.min} to ${def.max}">${def.label}</label><input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${val}" oninput="Studio.Inspector._setCompProp('${compKey}','${propKey}',+this.value);this.nextElementSibling.textContent=this.value" style="flex:1"><span style="font-size:9px;width:28px">${val}</span></div>`;
    }
    if (def.type === 'color') {
      return `<div class="insp-row"><label style="font-size:9px;color:var(--muted);width:60px">${def.label}</label><input type="color" value="${val}" onchange="Studio.Inspector._setCompProp('${compKey}','${propKey}',this.value)" style="width:32px;height:20px;border:none;background:none"></div>`;
    }
    if (def.type === 'boolean') {
      return `<label class="insp-check" style="margin-left:4px"><input type="checkbox" ${val?'checked':''} onchange="Studio.Inspector._setCompProp('${compKey}','${propKey}',this.checked)"> ${def.label}</label>`;
    }
    // text / number — with media picker for URL fields
    const isMediaField = def.label && (
      def.label.toLowerCase().includes('url') ||
      def.label.toLowerCase().includes('audio') ||
      def.label.toLowerCase().includes('video') ||
      propKey === 'src' || propKey === 'video'
    );

    if (isMediaField) {
      const media = Studio.Project.state.media || [];
      // Filter to matching type
      const isAudio = compKey.includes('audio') || compKey.includes('Audio') || compKey.includes('sound') || compKey.includes('Sound');
      const isVideo = compKey.includes('video') || compKey.includes('Video');
      const filtered = media.filter(m => {
        if (isAudio) return m.type?.startsWith('audio');
        if (isVideo) return m.type?.startsWith('video');
        return true;
      });

      let options = `<option value="">— Select from library —</option>`;
      filtered.forEach(m => {
        const sel = m.url === val ? 'selected' : '';
        options += `<option value="${m.url}" ${sel}>${m.name}</option>`;
      });

      return `<div class="insp-row" style="flex-wrap:wrap">
        <label style="font-size:9px;color:var(--muted);width:60px">${def.label}</label>
        <select class="insp-select" style="font-size:10px;flex:1;min-width:100px" onchange="if(this.value){Studio.Inspector._setCompProp('${compKey}','${propKey}',this.value)}">
          ${options}
        </select>
        <input class="insp-input" style="margin-top:2px;font-size:9px" value="${this._esc(val)}" placeholder="Or paste URL" onchange="Studio.Inspector._setCompProp('${compKey}','${propKey}',this.value)">
      </div>`;
    }

    return `<div class="insp-row"><label style="font-size:9px;color:var(--muted);width:60px">${def.label}</label><input class="insp-input" value="${this._esc(val)}" onchange="Studio.Inspector._setCompProp('${compKey}','${propKey}',this.value)"></div>`;
  },

  // ─── Scene Settings ────────────────────────────────────
  _buildSceneSection() {
    const sc = Studio.Project.state.scene;
    return this._buildSection('🌍 AR Scene', `
      <label class="insp-check"><input type="checkbox" ${sc.shadowCatcher?'checked':''} onchange="Studio.Project.state.scene.shadowCatcher=this.checked;Studio.Project.markDirty()"> Shadow catcher</label>
      <div class="insp-row" style="margin-top:4px"><label style="font-size:9px;color:var(--muted);width:50px">Ambient</label><input type="range" min="0" max="2" step="0.1" value="${sc.ambientIntensity}" oninput="Studio.Project.state.scene.ambientIntensity=+this.value;Studio.Project.markDirty()" style="flex:1"><span style="font-size:9px;width:20px">${sc.ambientIntensity}</span></div>
      <div class="insp-row"><label style="font-size:9px;color:var(--muted);width:50px">Direct</label><input type="range" min="0" max="3" step="0.1" value="${sc.directIntensity}" oninput="Studio.Project.state.scene.directIntensity=+this.value;Studio.Project.markDirty()" style="flex:1"><span style="font-size:9px;width:20px">${sc.directIntensity}</span></div>
    `);
  },

  // ─── Actions ───────────────────────────────────────────
  _setName(val) {
    const obj = Studio.Project.getObject(this.currentId);
    if (obj) { obj.name = val.trim() || 'Object'; Studio.Project.markDirty(); Studio.Hierarchy.render(); }
  },

  _setT(key, val) {
    const obj = Studio.Project.getObject(this.currentId);
    if (!obj?.mesh) return;
    const v = parseFloat(val) || 0;
    const m = obj.mesh, t = obj.transform;
    if (key === 'px') { m.position.x = v; t.position.x = v; }
    if (key === 'py') { m.position.y = v; t.position.y = v; }
    if (key === 'pz') { m.position.z = v; t.position.z = v; }
    if (key === 'rx') { m.rotation.x = THREE.MathUtils.degToRad(v); t.rotation.x = v; }
    if (key === 'ry') { m.rotation.y = THREE.MathUtils.degToRad(v); t.rotation.y = v; }
    if (key === 'rz') { m.rotation.z = THREE.MathUtils.degToRad(v); t.rotation.z = v; }
    Studio.Project.markDirty();
  },

  _resetT(key, def) {
    // Reset and re-render inspector to sync sliders
    if (key.startsWith('s')) {
      this._setScale(key, def);
    } else {
      this._setT(key, def);
    }
    this.render(this.currentId);
  },

  _setScale(key, val) {
    const obj = Studio.Project.getObject(this.currentId);
    if (!obj?.mesh) return;
    const v = parseFloat(val) || 1;
    if (window._uniformScale !== false) {
      obj.mesh.scale.set(v, v, v);
      obj.transform.scale = { x: v, y: v, z: v };
      ['ip-sx','ip-sy','ip-sz'].forEach(id => { const el = document.getElementById(id); if (el) el.value = v; });
    } else {
      if (key === 'sx') { obj.mesh.scale.x = v; obj.transform.scale.x = v; }
      if (key === 'sy') { obj.mesh.scale.y = v; obj.transform.scale.y = v; }
      if (key === 'sz') { obj.mesh.scale.z = v; obj.transform.scale.z = v; }
    }
    Studio.Project.markDirty();
  },

  _setAnim(clip) {
    const obj = Studio.Project.getObject(this.currentId);
    if (!obj) return;
    obj.defaultAnim = clip;
    Studio.Project.markDirty();
    // Play the clip in the viewport
    const mixer = Studio.Viewport.mixers.find(m => m._objId === obj.id);
    if (mixer && mixer._clips) {
      mixer.stopAllAction();
      if (clip) {
        const c = mixer._clips.find(a => a.name === clip);
        if (c) mixer.clipAction(c).play();
      }
    }
  },

  _setLoop(mode) {
    const obj = Studio.Project.getObject(this.currentId);
    if (obj) { obj.loop = mode; Studio.Project.markDirty(); }
  },

  _togglePreset(type, enabled) {
    const obj = Studio.Project.getObject(this.currentId);
    if (!obj) return;
    const defaults = { spin: { speed: 1, axis: 'y' }, bob: { height: 0.05, speed: 2 }, pulse: { amount: 0.08, speed: 3 } };
    if (enabled) {
      obj.presets[type] = defaults[type];
      Studio.Viewport.startPreset(obj, type);
    } else {
      obj.presets[type] = null;
      Studio.Viewport.stopPreset(obj, type);
    }
    Studio.Project.markDirty();
    this.render(this.currentId);
  },

  _setPresetVal(type, key, val) {
    const obj = Studio.Project.getObject(this.currentId);
    if (obj?.presets?.[type]) { obj.presets[type][key] = val; Studio.Project.markDirty(); }
  },

  _toggleComponent(compKey, enabled) {
    const obj = Studio.Project.getObject(this.currentId);
    if (!obj) return;
    if (!obj.xrComponents) obj.xrComponents = {};

    // Map xrextras interaction shortcuts
    const ixMap = {
      'xrextras-hold-drag': 'holdDrag', 'xrextras-pinch-scale': 'pinchScale',
      'xrextras-one-finger-rotate': 'oneFingerRotate', 'xrextras-two-finger-rotate': 'twoFingerRotate',
      'xrextras-spin': 'autoSpin', 'look-at': 'faceCamera',
    };
    if (ixMap[compKey]) {
      if (!obj.interactions) obj.interactions = {};
      obj.interactions[ixMap[compKey]] = enabled;
    }

    const compDef = Studio.Components.registry[compKey];
    if (enabled) {
      if (compDef?.type === 'config' && compDef.properties) {
        const cfg = {};
        Object.entries(compDef.properties).forEach(([k, d]) => { cfg[k] = d.default; });
        obj.xrComponents[compKey] = cfg;
      } else {
        obj.xrComponents[compKey] = true;
      }
    } else {
      delete obj.xrComponents[compKey];
    }
    Studio.Project.markDirty();
    // Keep the 3D viewport's video preview in sync with component toggles
    if (compKey === 'video-on-target' && Studio.Viewport?.syncVideoPreview) {
      Studio.Viewport.syncVideoPreview(obj);
    }
    this.render(this.currentId);
  },

  _setCompProp(compKey, propKey, val) {
    const obj = Studio.Project.getObject(this.currentId);
    if (!obj?.xrComponents?.[compKey]) return;
    if (typeof obj.xrComponents[compKey] !== 'object') obj.xrComponents[compKey] = {};
    obj.xrComponents[compKey][propKey] = val;
    Studio.Project.markDirty();
    // Re-sync video preview when its src or width change
    if (compKey === 'video-on-target' && (propKey === 'src' || propKey === 'width') && Studio.Viewport?.syncVideoPreview) {
      Studio.Viewport.syncVideoPreview(obj);
    }
  },

  _deleteSelected() {
    if (!this.currentId) return;
    Studio.Project.removeObject(this.currentId);
    this.clear();
  },

  _syncTransform() {
    const obj = Studio.Project.getObject(this.currentId);
    if (!obj?.mesh) return;
    const m = obj.mesh;
    // Update stored transform from mesh
    obj.transform.position = { x: +m.position.x.toFixed(4), y: +m.position.y.toFixed(4), z: +m.position.z.toFixed(4) };
    obj.transform.rotation = { x: +THREE.MathUtils.radToDeg(m.rotation.x).toFixed(2), y: +THREE.MathUtils.radToDeg(m.rotation.y).toFixed(2), z: +THREE.MathUtils.radToDeg(m.rotation.z).toFixed(2) };
    obj.transform.scale = { x: +m.scale.x.toFixed(4), y: +m.scale.y.toFixed(4), z: +m.scale.z.toFixed(4) };
    // Update input fields
    ['px','py','pz'].forEach(k => { const el = document.getElementById('ip-'+k); if (el) el.value = obj.transform.position[k[1]]; });
    ['rx','ry','rz'].forEach(k => { const el = document.getElementById('ip-'+k); if (el) el.value = obj.transform.rotation[k[1]]; });
    ['sx','sy','sz'].forEach(k => { const el = document.getElementById('ip-'+k); if (el) el.value = obj.transform.scale[k[1]]; });
  },

  // ─── Target Assignment ─────────────────────────────────
  _buildTargetAssignSection(obj) {
    const targets = Studio.Project.state.targets;
    const opts = targets.map(t =>
      `<option value="${t.id}" ${obj.targetId === t.id ? 'selected' : ''}>${t.name}</option>`
    ).join('');
    return this._buildSection('📷 Image Target', `
      <select class="insp-select" onchange="Studio.Inspector._setTargetId(this.value)">
        <option value="">— All targets —</option>
        ${opts}
      </select>
      <div style="font-size:9px;color:var(--faint);margin-top:3px">Which image target triggers this object</div>
    `);
  },

  _setTargetId(targetId) {
    const obj = Studio.Project.getObject(this.currentId);
    if (!obj) return;

    // Remove from previous target's objectIds
    Studio.Project.state.targets.forEach(t => {
      t.objectIds = (t.objectIds || []).filter(id => id !== obj.id);
    });

    if (targetId) {
      obj.targetId = targetId;
      const target = Studio.Project.state.targets.find(t => t.id === targetId);
      if (target) {
        if (!target.objectIds) target.objectIds = [];
        if (!target.objectIds.includes(obj.id)) target.objectIds.push(obj.id);
      }
    } else {
      obj.targetId = null;
    }
    Studio.Project.markDirty();
    // Refresh targets workspace if open
    if (Studio.Targets._selectedId) Studio.Targets._renderDetails();
  },

  // ─── Helpers ───────────────────────────────────────────
  _buildSection(title, html) {
    const div = document.createElement('div');
    div.className = 'insp-section';
    div.innerHTML = (title ? `<div class="insp-label">${title}</div>` : '') + html;
    return div;
  },

  _esc(s) { return String(s || '').replace(/"/g, '&quot;'); },

  _ixKey(compKey) {
    const map = { 'xrextras-hold-drag':'holdDrag', 'xrextras-pinch-scale':'pinchScale', 'xrextras-one-finger-rotate':'oneFingerRotate', 'xrextras-two-finger-rotate':'twoFingerRotate', 'xrextras-spin':'autoSpin', 'look-at':'faceCamera' };
    return map[compKey];
  },
};

window._uniformScale = true;
