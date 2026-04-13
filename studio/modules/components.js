// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Component Registry (all 8th Wall xrextras)
// ═══════════════════════════════════════════════════════════
// Every component is defined as data. The inspector auto-generates
// UI from this registry. The player reads xrComponents{} from
// the project and generates A-Frame attributes.

Studio.Components = {

  categories: {
    gestures:  { label: 'Gestures',       icon: '🤚', order: 0 },
    face:      { label: 'Face Tracking',   icon: '👤', order: 1 },
    hand:      { label: 'Hand Tracking',   icon: '✋', order: 2 },
    image:     { label: 'Image Targets',   icon: '📷', order: 3 },
    materials: { label: 'Materials',       icon: '🎨', order: 4 },
    media:     { label: 'Media / UI',      icon: '🖥', order: 5 },
    rendering: { label: 'Rendering',       icon: '🌑', order: 6 },
    animation: { label: 'Animation',       icon: '🎬', order: 7 },
  },

  registry: {
    // ═══ GESTURES ═══════════════════════════════════════════
    'xrextras-gesture-detector': {
      name: 'Gesture Detector', category: 'gestures', icon: '🖐',
      description: 'Base gesture detection (add to scene, required for other gestures)',
      trackingModes: ['slam','image','face','hand'], appliesTo: 'scene', type: 'boolean',
    },
    'xrextras-hold-drag': {
      name: 'Hold & Drag', category: 'gestures', icon: '🤏',
      description: 'Drag object by holding and moving finger',
      trackingModes: ['slam','image'], appliesTo: 'entity', type: 'boolean',
    },
    'xrextras-pinch-scale': {
      name: 'Pinch to Scale', category: 'gestures', icon: '🔍',
      description: 'Resize object with two-finger pinch gesture. Set min/max to limit scale range.',
      trackingModes: ['slam','image'], appliesTo: 'entity', type: 'config',
      properties: {
        min: { type: 'range', label: 'Min Scale', default: 0.1, min: 0.01, max: 1, step: 0.01 },
        max: { type: 'range', label: 'Max Scale', default: 5, min: 1, max: 20, step: 0.5 },
      }
    },
    'xrextras-one-finger-rotate': {
      name: 'One-Finger Rotate', category: 'gestures', icon: '👆',
      description: 'Rotate object with single finger swipe',
      trackingModes: ['slam','image'], appliesTo: 'entity', type: 'boolean',
    },
    'xrextras-two-finger-rotate': {
      name: 'Two-Finger Rotate', category: 'gestures', icon: '✌️',
      description: 'Rotate object with two-finger twist',
      trackingModes: ['slam','image'], appliesTo: 'entity', type: 'boolean',
    },
    'xrextras-tap-recenter': {
      name: 'Tap to Recenter', category: 'gestures', icon: '📍',
      description: 'Tap surface to reposition content',
      trackingModes: ['slam'], appliesTo: 'scene', type: 'boolean',
    },
    'xrextras-spin': {
      name: 'Auto-Spin', category: 'gestures', icon: '🔄',
      description: 'Continuously rotate on Y axis',
      trackingModes: ['slam','image','face'], appliesTo: 'entity', type: 'boolean',
    },

    // ═══ FACE TRACKING ═════════════════════════════════════
    'xrextras-face-mesh': {
      name: 'Face Mesh', category: 'face', icon: '🎭',
      description: 'Render a mesh overlay on the detected face',
      trackingModes: ['face'], appliesTo: 'entity', type: 'boolean',
    },
    'xrextras-face-attachment': {
      name: 'Face Attachment', category: 'face', icon: '📌',
      description: 'Attach object to a face landmark point',
      trackingModes: ['face'], appliesTo: 'entity', type: 'config',
      properties: {
        point: {
          type: 'select', label: 'Attachment Point', default: 'forehead',
          options: ['forehead','noseBridge','noseTip','leftEar','rightEar',
                    'leftEye','rightEye','chin','leftCheek','rightCheek',
                    'upperLip','lowerLip']
        }
      }
    },
    'xrextras-faceanchor': {
      name: 'Face Anchor', category: 'face', icon: '⚓',
      description: 'Anchor entity to a face (scene-level)',
      trackingModes: ['face'], appliesTo: 'scene', type: 'config',
      properties: {
        index: { type: 'number', label: 'Face Index', default: 0, min: 0, max: 3 }
      }
    },
    'xrextras-ear-attachment': {
      name: 'Ear Attachment', category: 'face', icon: '👂',
      description: 'Attach object to ear position',
      trackingModes: ['face'], appliesTo: 'entity', type: 'config',
      properties: {
        side: { type: 'select', label: 'Side', default: 'left', options: ['left','right'] }
      }
    },

    // ═══ HAND TRACKING ═════════════════════════════════════
    'xrextras-hand-anchor': {
      name: 'Hand Anchor', category: 'hand', icon: '🤚',
      description: 'Anchor entity to detected hand',
      trackingModes: ['hand'], appliesTo: 'entity', type: 'boolean',
    },
    'xrextras-hand-attachment': {
      name: 'Hand Attachment', category: 'hand', icon: '📎',
      description: 'Attach object to a hand landmark',
      trackingModes: ['hand'], appliesTo: 'entity', type: 'config',
      properties: {
        point: { type: 'select', label: 'Landmark', default: 'palm',
          options: ['palm','indexTip','middleTip','ringTip','pinkyTip','thumbTip','wrist'] }
      }
    },
    'xrextras-hand-mesh': {
      name: 'Hand Mesh', category: 'hand', icon: '🧤',
      description: 'Render mesh overlay on detected hand',
      trackingModes: ['hand'], appliesTo: 'entity', type: 'boolean',
    },
    'xrextras-hand-occluder': {
      name: 'Hand Occluder', category: 'hand', icon: '✊',
      description: 'Hand occludes (hides) objects behind it',
      trackingModes: ['hand'], appliesTo: 'entity', type: 'boolean',
    },

    // ═══ IMAGE TARGETS ═════════════════════════════════════
    'xrextras-named-image-target': {
      name: 'Named Image Target', category: 'image', icon: '🎯',
      description: 'Track a specific named image target',
      trackingModes: ['image'], appliesTo: 'entity', type: 'config',
      properties: {
        name: { type: 'text', label: 'Target Name', default: 'target-0' }
      }
    },
    'xrextras-generate-image-targets': {
      name: 'Generate Image Targets', category: 'image', icon: '🏭',
      description: 'Auto-generate image targets from uploaded images',
      trackingModes: ['image'], appliesTo: 'scene', type: 'boolean',
    },
    'xrextras-target-mesh': {
      name: 'Target Mesh', category: 'image', icon: '🔲',
      description: 'Render mesh overlay on detected image target',
      trackingModes: ['image'], appliesTo: 'entity', type: 'boolean',
    },
    'xrextras-target-video-fade': {
      name: 'Target Video Fade', category: 'image', icon: '🎬',
      description: 'Play video on image target — fades in when found, fades out when lost. Video replaces the 3D model.',
      trackingModes: ['image'], appliesTo: 'entity', type: 'config',
      properties: {
        video: { type: 'text', label: 'Video URL (.mp4)', default: '' },
        loop: { type: 'boolean', label: 'Loop', default: true },
        volume: { type: 'range', label: 'Volume', default: 1.0, min: 0, max: 1, step: 0.05 }
      }
    },
    'xrextras-target-video-sound': {
      name: 'Target Video + Sound', category: 'image', icon: '🔊',
      description: 'Play video with audio on image target — plays when found, pauses when lost. iOS unlocks audio on first tap.',
      trackingModes: ['image'], appliesTo: 'entity', type: 'config',
      properties: {
        video: { type: 'text', label: 'Video URL (.mp4)', default: '' },
        loop: { type: 'boolean', label: 'Loop', default: true },
        volume: { type: 'range', label: 'Volume', default: 1.0, min: 0, max: 1, step: 0.05 }
      }
    },

    // ═══ MATERIALS ══════════════════════════════════════════
    'xrextras-basic-material': {
      name: 'Basic Material', category: 'materials', icon: '🎨',
      description: 'Simple unlit material with colour',
      trackingModes: ['slam','image','face','hand'], appliesTo: 'entity', type: 'config',
      properties: {
        color: { type: 'color', label: 'Colour', default: '#ffffff' },
        opacity: { type: 'range', label: 'Opacity', default: 1, min: 0, max: 1, step: 0.01 }
      }
    },
    'xrextras-pbr-material': {
      name: 'PBR Material', category: 'materials', icon: '✨',
      description: 'Physically-based material with metalness and roughness',
      trackingModes: ['slam','image','face','hand'], appliesTo: 'entity', type: 'config',
      properties: {
        color: { type: 'color', label: 'Colour', default: '#ffffff' },
        metalness: { type: 'range', label: 'Metalness', default: 0, min: 0, max: 1, step: 0.01 },
        roughness: { type: 'range', label: 'Roughness', default: 0.5, min: 0, max: 1, step: 0.01 },
        opacity: { type: 'range', label: 'Opacity', default: 1, min: 0, max: 1, step: 0.01 }
      }
    },
    'xrextras-hider-material': {
      name: 'Hider Material', category: 'materials', icon: '🚫',
      description: 'Invisible material that occludes objects behind it',
      trackingModes: ['slam','image','face','hand'], appliesTo: 'entity', type: 'boolean',
    },
    'xrextras-video-material': {
      name: 'Video Material', category: 'materials', icon: '📹',
      description: 'Apply video texture to object surface',
      trackingModes: ['slam','image'], appliesTo: 'entity', type: 'config',
      properties: {
        src: { type: 'text', label: 'Video URL', default: '' },
        autoplay: { type: 'boolean', label: 'Autoplay', default: true }
      }
    },

    // ═══ MEDIA / UI ════════════════════════════════════════
    'xrextras-capture-button': {
      name: 'Capture Button', category: 'media', icon: '📸',
      description: 'Add screenshot/recording capture button',
      trackingModes: ['slam','image','face'], appliesTo: 'scene', type: 'boolean',
    },
    'xrextras-capture-preview': {
      name: 'Capture Preview', category: 'media', icon: '🖼',
      description: 'Show preview of captured screenshot',
      trackingModes: ['slam','image','face'], appliesTo: 'scene', type: 'boolean',
    },
    'xrextras-play-video': {
      name: 'Play Video', category: 'media', icon: '▶️',
      description: 'Video playback controls',
      trackingModes: ['slam','image'], appliesTo: 'entity', type: 'config',
      properties: {
        src: { type: 'text', label: 'Video URL', default: '' },
        loop: { type: 'boolean', label: 'Loop', default: true }
      }
    },
    'audio-on-target': {
      name: 'Audio on Target', category: 'image', icon: '🎵',
      description: 'Play audio when image target found. Fades out when lost. iOS requires tap gesture.',
      trackingModes: ['image'], appliesTo: 'entity', type: 'config',
      properties: {
        src: { type: 'text', label: 'Audio URL (.mp3)', default: '' },
        volume: { type: 'range', label: 'Volume', default: 0.8, min: 0, max: 1, step: 0.05 },
        loop: { type: 'boolean', label: 'Loop', default: true },
        fadeIn: { type: 'range', label: 'Fade In (s)', default: 0.5, min: 0, max: 3, step: 0.1 },
        fadeOut: { type: 'range', label: 'Fade Out (s)', default: 1.0, min: 0, max: 3, step: 0.1 },
        resumeOnFound: { type: 'boolean', label: 'Resume on found', default: true }
      }
    },
    'audio-ambient': {
      name: 'Ambient Audio', category: 'media', icon: '🔊',
      description: 'Background audio that plays when AR starts. iOS requires tap gesture.',
      trackingModes: ['slam','image','face'], appliesTo: 'entity', type: 'config',
      properties: {
        src: { type: 'text', label: 'Audio URL (.mp3)', default: '' },
        volume: { type: 'range', label: 'Volume', default: 0.5, min: 0, max: 1, step: 0.05 },
        loop: { type: 'boolean', label: 'Loop', default: true },
        autoplay: { type: 'boolean', label: 'Autoplay', default: true },
        fadeIn: { type: 'range', label: 'Fade In (s)', default: 1.0, min: 0, max: 5, step: 0.1 }
      }
    },
    'xrextras-attach': {
      name: 'Attach to Camera', category: 'media', icon: '📎',
      description: 'Attach entity relative to camera (HUD)',
      trackingModes: ['slam','image','face','hand'], appliesTo: 'entity', type: 'config',
      properties: {
        target: { type: 'text', label: 'Target', default: 'camera' },
        offset: { type: 'text', label: 'Offset (x y z)', default: '0 0 -2' }
      }
    },

    // ═══ RENDERING ══════════════════════════════════════════
    'shadow': {
      name: 'Shadow', category: 'rendering', icon: '🌑',
      description: 'Cast and/or receive shadows',
      trackingModes: ['slam','image','face','hand'], appliesTo: 'entity', type: 'config',
      properties: {
        cast: { type: 'boolean', label: 'Cast Shadow', default: true },
        receive: { type: 'boolean', label: 'Receive Shadow', default: false }
      }
    },
    'look-at': {
      name: 'Look At Camera', category: 'rendering', icon: '👁',
      description: 'Object always faces the camera (billboard)',
      trackingModes: ['slam','image','face','hand'], appliesTo: 'entity', type: 'config',
      properties: {
        target: { type: 'text', label: 'Target Selector', default: '[camera]' }
      }
    },
    'visible': {
      name: 'Visibility', category: 'rendering', icon: '👁‍🗨',
      description: 'Set initial visibility',
      trackingModes: ['slam','image','face','hand'], appliesTo: 'entity', type: 'config',
      properties: {
        value: { type: 'boolean', label: 'Visible', default: true }
      }
    },

    // ═══ ANIMATION (A-Frame built-in) ══════════════════════
    'animation-mixer': {
      name: 'Animation Mixer', category: 'animation', icon: '🎞',
      description: 'Play animations from GLB file',
      trackingModes: ['slam','image','face','hand'], appliesTo: 'entity', type: 'config',
      properties: {
        clip: { type: 'text', label: 'Clip Name', default: '*' },
        loop: { type: 'select', label: 'Loop', default: 'repeat', options: ['repeat','once','pingpong'] },
        crossFadeDuration: { type: 'range', label: 'Crossfade', default: 0.4, min: 0, max: 2, step: 0.1 }
      }
    },
  },

  // ─── Helper Methods ────────────────────────────────────
  getForMode(mode) {
    return Object.entries(this.registry)
      .filter(([_, c]) => c.trackingModes.includes(mode))
      .map(([key, c]) => ({ key, ...c }));
  },

  getByCategory(category) {
    return Object.entries(this.registry)
      .filter(([_, c]) => c.category === category)
      .map(([key, c]) => ({ key, ...c }));
  },

  getEntityComponents(mode) {
    return this.getForMode(mode).filter(c => c.appliesTo === 'entity' || c.appliesTo === 'both');
  },

  getSceneComponents(mode) {
    return this.getForMode(mode).filter(c => c.appliesTo === 'scene' || c.appliesTo === 'both');
  },

  // Generate A-Frame attribute string from an object's xrComponents data
  toAFrameAttrs(xrComponents) {
    let attrs = '';
    Object.entries(xrComponents || {}).forEach(([key, config]) => {
      if (config === true || config === false) {
        if (config) attrs += ` ${key}`;
      } else if (typeof config === 'object' && config !== null) {
        const pairs = Object.entries(config).map(([k,v]) => `${k}: ${v}`).join('; ');
        attrs += ` ${key}="${pairs}"`;
      } else if (typeof config === 'string') {
        attrs += ` ${key}="${config}"`;
      }
    });
    return attrs;
  }
};
