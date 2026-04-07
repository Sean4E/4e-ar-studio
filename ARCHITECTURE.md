# 4E AR DevStudio — Architecture & 8th Wall Integration

## Available 8th Wall Components (from xrextras)

### Gestures
| Component | Description | Use Case |
|---|---|---|
| `xrextras-gesture-detector` | Base gesture detection | Required on a-scene for any gesture |
| `xrextras-hold-drag` | Drag objects | Move objects on surface |
| `xrextras-pinch-scale` | Pinch to resize | Scale objects with two fingers |
| `xrextras-one-finger-rotate` | Swipe to rotate | Rotate objects |
| `xrextras-two-finger-rotate` | Two-finger rotate | Precision rotation |
| `xrextras-tap-recenter` | Tap to recenter | Reposition content |
| `xrextras-spin` | Auto-spin | Showcase rotation |

### Face Tracking
| Component | Description |
|---|---|
| `xrextras-face-mesh` | Full face mesh overlay |
| `xrextras-face-attachment` | Attach objects to face points |
| `xrextras-faceanchor` | Face anchor entity |
| `xrextras-ear-attachment` | Ear positioning |

### Hand Tracking
| Component | Description |
|---|---|
| `xrextras-hand-anchor` | Hand anchor point |
| `xrextras-hand-attachment` | Attach to hand |
| `xrextras-hand-mesh` | Hand mesh overlay |
| `xrextras-hand-occluder` | Hand occlusion |

### Image Targets
| Component | Description |
|---|---|
| `xrextras-named-image-target` | Named image target |
| `xrextras-generate-image-targets` | Generate targets |
| `xrextras-target-mesh` | Target mesh overlay |
| `xrextras-target-video-fade` | Video on target |

### Materials
| Component | Description |
|---|---|
| `xrextras-basic-material` | Basic material |
| `xrextras-pbr-material` | PBR material |
| `xrextras-hider-material` | Occlusion material |
| `xrextras-video-material` | Video texture |

### Media/UI
| Component | Description |
|---|---|
| `xrextras-capture-button` | Screenshot capture |
| `xrextras-capture-preview` | Preview capture |
| `xrextras-play-video` | Video playback |
| `xrextras-attach` | Attach entity to camera |

## SLAM Scene Pattern (Proven from 8th Wall examples)

```html
<a-scene
  xrextras-gesture-detector
  xrweb="allowedDevices: any"
  renderer="colorManagement: true">

  <a-camera id="camera"
    position="0 8 0"
    raycaster="objects: .cantap"
    cursor="fuse: false; rayOrigin: mouse;">
  </a-camera>

  <!-- Directional light following camera with shadows -->
  <a-entity
    light="type: directional; intensity: 0.8; castShadow: true;
      shadowMapHeight: 2048; shadowMapWidth: 2048;
      shadowCameraTop: 20; shadowCameraBottom: -20;
      shadowCameraRight: 20; shadowCameraLeft: -20;
      target: #camera"
    xrextras-attach="target: camera; offset: 8 15 4"
    shadow>
  </a-entity>

  <a-light type="ambient" intensity="0.5"></a-light>

  <!-- Shadow catcher ground -->
  <a-box id="ground" class="cantap"
    scale="1000 2 1000" position="0 -1 0"
    material="shader: shadow; transparent: true; opacity: 0.4"
    shadow>
  </a-box>

  <!-- Interactive model -->
  <a-entity
    gltf-model="#model"
    class="cantap"
    xrextras-hold-drag
    xrextras-pinch-scale
    xrextras-two-finger-rotate
    shadow="cast: true">
  </a-entity>
</a-scene>
```

## Interaction Mapping (DevStudio → Player)

| DevStudio Checkbox | Player Component | On Entity |
|---|---|---|
| Tap to place | Custom tap-place component | a-scene |
| Hold & drag | `xrextras-hold-drag` | Entity |
| Pinch to scale | `xrextras-pinch-scale` | Entity |
| One-finger rotate | `xrextras-one-finger-rotate` | Entity |
| Two-finger rotate | `xrextras-two-finger-rotate` | Entity |
| Auto-spin | `xrextras-spin` | Entity |
| Cast shadow | `shadow="cast: true"` | Entity |
| Face camera | `look-at="[camera]"` | Entity |

## Shadow Setup (Proven Pattern)

1. Directional light with `castShadow: true` + shadow map config
2. Light attached to camera via `xrextras-attach`
3. Ground `a-box` with `material="shader: shadow; transparent: true; opacity: 0.4"`
4. Ground has `shadow` component
5. Models have `shadow="cast: true"`

## Face Scene Pattern

```html
<a-scene
  xrface="allowedDevices: any"
  xrextras-gesture-detector>

  <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

  <a-entity xrextras-faceanchor="index: 0">
    <a-entity xrextras-face-attachment="point: forehead">
      <!-- Content attached to forehead -->
    </a-entity>
  </a-entity>
</a-scene>
```

## Image Target Pattern (8th Wall native, NOT MindAR)

```html
<a-scene
  xrweb="allowedDevices: any"
  xrextras-gesture-detector>

  <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

  <a-entity
    xrextras-named-image-target="name: my-target"
    visible="false">
    <!-- Content shown when target detected -->
    <a-gltf-model src="#model"></a-gltf-model>
  </a-entity>
</a-scene>
```

Note: 8th Wall image targets use `xrextras-named-image-target` with
targets uploaded via `xrextras-generate-image-targets` component.
This would replace MindAR entirely.
