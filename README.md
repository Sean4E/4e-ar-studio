# 4E AR Studio

Build, deploy, and experience WebAR apps in minutes.
Image tracking + SLAM-ready · GLB + USDZ · All devices.

---

## Files

| File | Purpose |
|---|---|
| `builder.html` | The creation tool — upload targets, models, generate QR codes |
| `player.html` | The AR experience player — opened via QR scan |
| `config.js` | Your Firebase credentials — fill this in once |

---

## Quick Start

### 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Go to **Project Settings → Your Apps → Add Web App**
4. Copy your credentials into `config.js`

### 2. Enable Firestore

1. Firebase Console → **Firestore Database** → Create database
2. Start in **Test mode** for development (locks down in production later)

### 3. Enable Storage

1. Firebase Console → **Storage** → Get Started
2. Accept defaults, start in Test mode

### 4. Set Security Rules (Development)

**Firestore Rules** (Firestore → Rules):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /ar_apps/{appId} {
      allow read;
      allow write;  // Tighten for production
    }
  }
}
```

**Storage Rules** (Storage → Rules):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read;
      allow write;  // Tighten for production
    }
  }
}
```

### 5. Set Storage CORS (Required)

Firebase Storage needs CORS configured so the player can load assets from any device.

Create a file called `cors.json`:
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

Apply it using the Google Cloud CLI:
```bash
gcloud storage buckets update gs://YOUR_PROJECT.appspot.com --cors-file=cors.json
```

Or use Firebase Hosting (see below) which handles this automatically.

### 6. Host the Files

The files **must** be served from HTTPS — not opened as local `file://` URLs.

**Option A — Firebase Hosting (recommended, free):**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # Set public directory to your ar-studio folder
firebase deploy
```
Your URLs will be: `https://YOUR_PROJECT.web.app/builder.html`

**Option B — Any HTTPS host:**
Upload `builder.html`, `player.html`, and `config.js` to the same folder on any HTTPS server.

**Option C — Local development:**
```bash
npx serve .
# or
python3 -m http.server 8080
```
Then open `http://localhost:8080/builder.html`. QR codes will use localhost URLs — only testable on the same device.

---

## How It Works

### Builder (`builder.html`)

| Step | What happens |
|---|---|
| Basics | Name your experience, choose tracking mode |
| Target | Upload PNG/JPG — compiled to `.mind` format in-browser using MindAR.js |
| Model | Upload GLB (required) + USDZ (optional for iOS native AR) |
| Settings | Scale, Y-offset, animation selection, loop mode |
| Publish | All assets uploaded to Firebase Storage, config saved to Firestore, QR code generated |

### Player (`player.html?id=APP_ID`)

| Device | Experience |
|---|---|
| **iOS iPhone/iPad** + USDZ uploaded | Launches native **ARKit Quick Look** — full ARKit quality, no WebAR needed |
| **iOS without USDZ** | Falls back to WebAR (MindAR + A-Frame in Safari) |
| **Android Chrome** | Full WebAR with MindAR image tracking |
| **Desktop (webcam)** | MindAR WebAR — great for demos |

---

## Image Target Tips

Good targets:
- High contrast photographs
- Logos with distinct shapes
- Posters, artwork, signage
- Heritage plaques, artworks

Avoid:
- Plain solid colours
- Repeating patterns (wallpaper, fabric)
- Very dark or low-contrast images
- Symmetric shapes (plain circles, squares)

---

## 3D Model Tips

**GLB format:**
- Use GLB (binary GLTF) not separate GLTF + textures
- Embed all textures in the binary
- Optimise with [gltf.report](https://gltf.report) or Blender's GLB export
- Draco compression supported

**USDZ format (iOS):**
- Export from Blender using the USDZ exporter
- Or convert online at [usdz-convert.com](https://usdz-convert.com)
- Textures should use PBR materials

**Scale:**
- 1 unit = 1 metre in MindAR world space
- The image target dimensions define the scale reference
- Use the scale slider in Settings to adjust

---

## Production Checklist

- [ ] Tighten Firebase Security Rules (require auth for writes)
- [ ] Set `window.AR_BASE_URL` in `config.js` to your production domain
- [ ] Apply Storage CORS config
- [ ] Enable Firebase Authentication if you want a login system
- [ ] Test on real iOS and Android devices before sharing QR codes
- [ ] Optimise GLB file size (target < 5MB for fast loading)

---

## Libraries Used

| Library | Purpose | Version |
|---|---|---|
| [MindAR.js](https://github.com/hiukim/mind-ar-js) | Image tracking · .mind compilation | 1.2.5 |
| [A-Frame](https://aframe.io) | WebXR scene rendering | 1.5.0 |
| [aframe-extras](https://github.com/c-frame/aframe-extras) | animation-mixer component | 7.0.0 |
| [Three.js](https://threejs.org) | 3D preview in Builder | 0.152 |
| [Firebase](https://firebase.google.com) | Storage + Firestore | 10.12 |
| [QRCode.js](https://davidshimjs.github.io/qrcodejs/) | QR code generation | 1.0.0 |

---

Built with 4E Virtual Design · [4e.ie](https://4e.ie)
