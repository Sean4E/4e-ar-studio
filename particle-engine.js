// ═══════════════════════════════════════════════════════════
// 4E Particle Engine — extracted from spatial-v7.html
// Used by player-spatial.html (journey-runtime) for particle
// travellers + effects. Pure Three.js — no A-Frame wrapper needed.
// ═══════════════════════════════════════════════════════════

// Helpers
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
function hexToRgb(h) {
  return { r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 };
}
function sNoise(x, y, z) {
  return Math.sin(x * 1.4 + y * 2.1) * Math.cos(y * 1.7 + z * 1.3) * Math.sin(z * 2.3 + x * 1.1);
}
const mkPt = () => ({
  alive: false, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0,
  life: 0, maxLife: 1, r1: 1, g1: 1, b1: 1, r2: 0, g2: 0, b2: 0,
  rm: .5, gm: .5, bm: .5, hasMid: false, sStart: .1, sEnd: .05,
  nx: 0, ny: 0, nz: 0
});

// Shaders
const VERT = `attribute float aSize;attribute vec4 aColor;varying vec4 vColor;void main(){vColor=aColor;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*(320.0/-mv.z);gl_Position=projectionMatrix*mv;}`;
const FRAG = `varying vec4 vColor;void main(){vec2 c=gl_PointCoord-vec2(0.5);float r=length(c)*2.0;if(r>1.0)discard;float a=1.0-smoothstep(0.5,1.0,r);gl_FragColor=vec4(vColor.rgb,vColor.a*a);}`;

// Defaults
const DEF_P = {
  count: 60,
  emissionRate: 20,
  burstCount: 0,
  continuousEmit: true,
  emitShape: "sphere",
  emitRadius: .35,
  emitAngle: 30,
  spread3D: true,
  lifetimeMin: 1.5,
  lifetimeMax: 2.8,
  speedMin: .5,
  speedMax: 1.5,
  spread: 90,
  sizeStart: .1,
  sizeEnd: .04,
  sizeCurve: "linear",
  colorStart: "#ffc400",
  colorMid: null,
  colorEnd: "#ff6600",
  opacityStart: 1,
  opacityEnd: 0,
  opacityCurve: "linear",
  gravity: 0,
  drag: .98,
  turbulence: .5,
  turbulenceFreq: 1,
  turbulenceSpeed: 1,
  swirl: 0,
  attract: 0,
  blending: "additive"
};
const P = o => ({
  ...DEF_P,
  ...o
});
const PPRESETS = {
  swarm: {
    name: "Swarm",
    col: "#ffcc00",
    cat: "organic",
    desc: "Swarming insects",
    c: P({
      count: 90,
      emissionRate: 45,
      emitShape: "sphere",
      emitRadius: .6,
      lifetimeMin: 1.2,
      lifetimeMax: 2.2,
      speedMin: 1.8,
      speedMax: 3.5,
      spread: 360,
      spread3D: true,
      sizeStart: .055,
      sizeEnd: .03,
      colorStart: "#ffee44",
      colorEnd: "#ff8800",
      opacityStart: .9,
      opacityEnd: 0,
      drag: .90,
      turbulence: 4,
      turbulenceFreq: 2.5,
      turbulenceSpeed: 2.5,
      swirl: 2
    })
  },
  smoke: {
    name: "Smoke",
    col: "#aaaaaa",
    cat: "gas",
    desc: "Rising smoke",
    c: P({
      count: 38,
      emissionRate: 9,
      emitShape: "cone",
      emitRadius: .28,
      lifetimeMin: 3.5,
      lifetimeMax: 6,
      speedMin: .2,
      speedMax: .65,
      spread: 28,
      spread3D: false,
      sizeStart: .18,
      sizeEnd: 1.1,
      sizeCurve: "easeIn",
      colorStart: "#999999",
      colorEnd: "#333333",
      opacityStart: .55,
      opacityEnd: 0,
      opacityCurve: "easeIn",
      gravity: .28,
      drag: .995,
      turbulence: .5,
      turbulenceFreq: .4,
      turbulenceSpeed: .3,
      blending: "normal"
    })
  },
  fire: {
    name: "Fire",
    col: "#ff4400",
    cat: "heat",
    desc: "Flickering flames",
    c: P({
      count: 70,
      emissionRate: 35,
      emitShape: "cone",
      emitRadius: .32,
      lifetimeMin: .7,
      lifetimeMax: 1.7,
      speedMin: .9,
      speedMax: 2.2,
      spread: 32,
      spread3D: false,
      sizeStart: .24,
      sizeEnd: .03,
      sizeCurve: "easeOut",
      colorStart: "#ffffff",
      colorMid: "#ff7700",
      colorEnd: "#990000",
      opacityStart: .9,
      opacityEnd: 0,
      opacityCurve: "fadeInOut",
      gravity: 1.1,
      drag: .97,
      turbulence: 1.5,
      turbulenceFreq: 3.5,
      turbulenceSpeed: 3
    })
  },
  liquid: {
    name: "Liquid",
    col: "#00aaff",
    cat: "fluid",
    desc: "Water droplets",
    c: P({
      count: 50,
      emissionRate: 24,
      emitShape: "sphere",
      emitRadius: .22,
      lifetimeMin: 1,
      lifetimeMax: 2.2,
      speedMin: .6,
      speedMax: 2,
      spread: 75,
      spread3D: true,
      sizeStart: .1,
      sizeEnd: .02,
      sizeCurve: "easeOut",
      colorStart: "#99ddff",
      colorEnd: "#0055cc",
      opacityStart: .85,
      opacityEnd: 0,
      gravity: -2.2,
      drag: .97,
      turbulence: .3,
      turbulenceFreq: 1.2
    })
  },
  sparkle: {
    name: "Sparkle",
    col: "#ffffff",
    cat: "magic",
    desc: "Magic twinkles",
    c: P({
      count: 55,
      emissionRate: 28,
      emitShape: "sphere",
      emitRadius: .45,
      lifetimeMin: .5,
      lifetimeMax: 1.3,
      speedMin: .2,
      speedMax: 1,
      spread: 180,
      spread3D: true,
      sizeStart: .03,
      sizeEnd: .18,
      sizeCurve: "peak",
      colorStart: "#ffffff",
      colorEnd: "#ffccaa",
      opacityStart: 0,
      opacityEnd: 0,
      opacityCurve: "peak",
      drag: .97,
      turbulence: .4
    })
  },
  dust: {
    name: "Dust",
    col: "#c8a882",
    cat: "ambient",
    desc: "Drifting dust",
    c: P({
      count: 70,
      emissionRate: 16,
      emitShape: "box",
      emitRadius: .9,
      lifetimeMin: 3,
      lifetimeMax: 6,
      speedMin: .04,
      speedMax: .22,
      spread: 180,
      spread3D: true,
      sizeStart: .04,
      sizeEnd: .02,
      colorStart: "#d4b896",
      colorEnd: "#9a7a58",
      opacityStart: .4,
      opacityEnd: 0,
      gravity: -.04,
      drag: .998,
      turbulence: .35,
      turbulenceFreq: .4,
      turbulenceSpeed: .3,
      blending: "normal"
    })
  },
  electric: {
    name: "Electric",
    col: "#88ccff",
    cat: "energy",
    desc: "Plasma discharge",
    c: P({
      count: 45,
      emissionRate: 40,
      emitShape: "ring",
      emitRadius: .28,
      lifetimeMin: .1,
      lifetimeMax: .35,
      speedMin: 2.5,
      speedMax: 6,
      spread: 170,
      spread3D: true,
      sizeStart: .05,
      sizeEnd: .015,
      colorStart: "#cceeff",
      colorEnd: "#0033ff",
      opacityStart: 1,
      opacityEnd: 0,
      drag: .85,
      turbulence: 9,
      turbulenceFreq: 7,
      turbulenceSpeed: 9
    })
  },
  snow: {
    name: "Snow",
    col: "#ddeeff",
    cat: "ambient",
    desc: "Falling snowflakes",
    c: P({
      count: 85,
      emissionRate: 20,
      emitShape: "box",
      emitRadius: 1.4,
      lifetimeMin: 3,
      lifetimeMax: 7,
      speedMin: .08,
      speedMax: .35,
      spread: 25,
      spread3D: false,
      sizeStart: .065,
      sizeEnd: .065,
      colorStart: "#eeeeff",
      colorEnd: "#bbccee",
      opacityStart: .82,
      opacityEnd: .1,
      gravity: -.45,
      drag: .997,
      turbulence: .5,
      turbulenceFreq: .5,
      turbulenceSpeed: .3,
      swirl: .4,
      blending: "normal"
    })
  },
  explosion: {
    name: "Explode",
    col: "#ff6600",
    cat: "force",
    desc: "Outward burst",
    c: P({
      count: 110,
      emissionRate: 0,
      burstCount: 110,
      continuousEmit: false,
      emitShape: "point",
      lifetimeMin: .4,
      lifetimeMax: 1.6,
      speedMin: 2.5,
      speedMax: 7,
      spread: 180,
      spread3D: true,
      sizeStart: .2,
      sizeEnd: .03,
      sizeCurve: "easeOut",
      colorStart: "#ffffff",
      colorMid: "#ffaa00",
      colorEnd: "#aa1100",
      opacityStart: 1,
      opacityEnd: 0,
      opacityCurve: "easeIn",
      gravity: -.6,
      drag: .93,
      turbulence: .9
    })
  },
  fireflies: {
    name: "Fireflies",
    col: "#99ff44",
    cat: "organic",
    desc: "Glowing fireflies",
    c: P({
      count: 22,
      emissionRate: 4,
      emitShape: "sphere",
      emitRadius: 1.1,
      lifetimeMin: 3.5,
      lifetimeMax: 7,
      speedMin: .04,
      speedMax: .28,
      spread: 180,
      spread3D: true,
      sizeStart: .04,
      sizeEnd: .14,
      sizeCurve: "peak",
      colorStart: "#99ff44",
      colorEnd: "#44ff88",
      opacityStart: 0,
      opacityEnd: 0,
      opacityCurve: "peak",
      drag: .997,
      turbulence: 1.2,
      turbulenceFreq: .4,
      turbulenceSpeed: .4
    })
  },
  nebula: {
    name: "Nebula",
    col: "#cc44ff",
    cat: "cosmic",
    desc: "Cosmic gas cloud",
    c: P({
      count: 130,
      emissionRate: 22,
      emitShape: "sphere",
      emitRadius: 1.3,
      lifetimeMin: 5,
      lifetimeMax: 10,
      speedMin: .08,
      speedMax: .45,
      spread: 180,
      spread3D: true,
      sizeStart: .22,
      sizeEnd: .5,
      sizeCurve: "easeIn",
      colorStart: "#cc44ff",
      colorMid: "#ff44aa",
      colorEnd: "#4444ff",
      opacityStart: .28,
      opacityEnd: 0,
      drag: .999,
      turbulence: .9,
      turbulenceFreq: .25,
      turbulenceSpeed: .18,
      swirl: 3.5
    })
  },
  rain: {
    name: "Rain",
    col: "#8888cc",
    cat: "fluid",
    desc: "Driving rainfall",
    c: P({
      count: 110,
      emissionRate: 55,
      emitShape: "box",
      emitRadius: 1.6,
      lifetimeMin: .5,
      lifetimeMax: 1.1,
      speedMin: 3.5,
      speedMax: 6,
      spread: 8,
      spread3D: false,
      sizeStart: .035,
      sizeEnd: .02,
      colorStart: "#aaaadd",
      colorEnd: "#6666aa",
      opacityStart: .65,
      opacityEnd: .08,
      gravity: -5.5,
      drag: .99,
      turbulence: .2,
      blending: "normal"
    })
  },
  confetti: {
    name: "Confetti",
    col: "#ff44aa",
    cat: "force",
    desc: "Celebration burst",
    c: P({
      count: 65,
      emissionRate: 0,
      burstCount: 65,
      continuousEmit: false,
      emitShape: "cone",
      emitRadius: .35,
      emitAngle: 40,
      lifetimeMin: 2.5,
      lifetimeMax: 5,
      speedMin: 1.2,
      speedMax: 3.2,
      spread: 80,
      spread3D: false,
      sizeStart: .11,
      sizeEnd: .08,
      colorStart: "#ff44aa",
      colorMid: "#ffcc00",
      colorEnd: "#44ffaa",
      opacityStart: 1,
      opacityEnd: .35,
      opacityCurve: "easeIn",
      gravity: -1.5,
      drag: .975,
      turbulence: 1,
      turbulenceFreq: 2,
      turbulenceSpeed: 2,
      blending: "normal"
    })
  },
  void: {
    name: "Void",
    col: "#440066",
    cat: "energy",
    desc: "Dark vortex",
    c: P({
      count: 75,
      emissionRate: 22,
      emitShape: "ring",
      emitRadius: 1.6,
      lifetimeMin: 1.8,
      lifetimeMax: 3.5,
      speedMin: .2,
      speedMax: .7,
      spread: 25,
      spread3D: false,
      sizeStart: .07,
      sizeEnd: .015,
      sizeCurve: "easeIn",
      colorStart: "#9900cc",
      colorEnd: "#110018",
      opacityStart: .85,
      opacityEnd: 0,
      opacityCurve: "easeIn",
      drag: .975,
      turbulence: .4,
      swirl: -6,
      attract: 2.8
    })
  },
  embers: {
    name: "Embers",
    col: "#ff8800",
    cat: "heat",
    desc: "Fire embers drift",
    c: P({
      count: 42,
      emissionRate: 14,
      emitShape: "cone",
      emitRadius: .42,
      lifetimeMin: 2.2,
      lifetimeMax: 5,
      speedMin: .3,
      speedMax: 1.1,
      spread: 55,
      spread3D: false,
      sizeStart: .075,
      sizeEnd: .012,
      sizeCurve: "easeOut",
      colorStart: "#ffee44",
      colorMid: "#ff5500",
      colorEnd: "#550000",
      opacityStart: 1,
      opacityEnd: 0,
      opacityCurve: "fadeInOut",
      gravity: .6,
      drag: .993,
      turbulence: 1.8,
      turbulenceFreq: 1.8,
      turbulenceSpeed: 1.8
    })
  },
  bubbles: {
    name: "Bubbles",
    col: "#88ddff",
    cat: "fluid",
    desc: "Soap bubbles",
    c: P({
      count: 28,
      emissionRate: 7,
      emitShape: "sphere",
      emitRadius: .55,
      lifetimeMin: 2.5,
      lifetimeMax: 5,
      speedMin: .18,
      speedMax: .55,
      spread: 22,
      spread3D: false,
      sizeStart: .05,
      sizeEnd: .18,
      sizeCurve: "easeIn",
      colorStart: "#aaeeff",
      colorEnd: "#ffffff",
      opacityStart: .12,
      opacityEnd: .04,
      gravity: .55,
      drag: .993,
      turbulence: .5,
      turbulenceFreq: .8
    })
  },
  aurora: {
    name: "Aurora",
    col: "#00ffcc",
    cat: "cosmic",
    desc: "Northern lights",
    c: P({
      count: 95,
      emissionRate: 18,
      emitShape: "box",
      emitRadius: 1.6,
      lifetimeMin: 5,
      lifetimeMax: 9,
      speedMin: .08,
      speedMax: .38,
      spread: 22,
      spread3D: false,
      sizeStart: .28,
      sizeEnd: .55,
      sizeCurve: "peak",
      colorStart: "#00ffcc",
      colorMid: "#88ff00",
      colorEnd: "#0033ff",
      opacityStart: 0,
      opacityEnd: 0,
      opacityCurve: "peak",
      gravity: .12,
      drag: .999,
      turbulence: .65,
      turbulenceFreq: .28,
      turbulenceSpeed: .45,
      swirl: .9
    })
  },
  portal: {
    name: "Portal",
    col: "#00e5ff",
    cat: "energy",
    desc: "Dimensional rift",
    c: P({
      count: 70,
      emissionRate: 32,
      emitShape: "ring",
      emitRadius: 1.05,
      lifetimeMin: .9,
      lifetimeMax: 2,
      speedMin: .15,
      speedMax: .85,
      spread: 12,
      spread3D: false,
      sizeStart: .09,
      sizeEnd: .02,
      colorStart: "#00ffff",
      colorEnd: "#0000cc",
      opacityStart: .95,
      opacityEnd: 0,
      drag: .972,
      turbulence: .55,
      swirl: 9,
      attract: 1.8
    })
  },
  plasma: {
    name: "Plasma",
    col: "#ff44ff",
    cat: "energy",
    desc: "Plasma arcs",
    c: P({
      count: 55,
      emissionRate: 38,
      emitShape: "sphere",
      emitRadius: .3,
      lifetimeMin: .3,
      lifetimeMax: .8,
      speedMin: 1.5,
      speedMax: 4.5,
      spread: 90,
      spread3D: true,
      sizeStart: .12,
      sizeEnd: .03,
      sizeCurve: "easeOut",
      colorStart: "#ffffff",
      colorMid: "#ff88ff",
      colorEnd: "#4400cc",
      opacityStart: 1,
      opacityEnd: 0,
      opacityCurve: "easeIn",
      drag: .91,
      turbulence: 5,
      turbulenceFreq: 5,
      turbulenceSpeed: 6
    })
  },
  comet: {
    name: "Comet",
    col: "#ffddaa",
    cat: "cosmic",
    desc: "Comet tail",
    c: P({
      count: 60,
      emissionRate: 35,
      emitShape: "point",
      lifetimeMin: .4,
      lifetimeMax: .9,
      speedMin: .05,
      speedMax: .2,
      spread: 160,
      spread3D: true,
      sizeStart: .14,
      sizeEnd: .02,
      sizeCurve: "easeOut",
      colorStart: "#ffffff",
      colorMid: "#ffcc44",
      colorEnd: "#ff4400",
      opacityStart: .95,
      opacityEnd: 0,
      opacityCurve: "easeIn",
      gravity: -.1,
      drag: .93,
      turbulence: .3
    })
  }
};
const JP = [{
  id: "drift",
  name: "Drift",
  col: "#00ffcc",
  pp: "aurora",
  shape: "arc",
  easing: "easeInOut",
  dur: 4500,
  desc: "Slow arcs, aurora clouds"
}, {
  id: "storm",
  name: "Storm",
  col: "#88ccff",
  pp: "electric",
  shape: "noise",
  easing: "linear",
  dur: 680,
  desc: "Fast noise, crackle"
}, {
  id: "cascade",
  name: "Cascade",
  col: "#00aaff",
  pp: "liquid",
  shape: "bezier",
  easing: "easeOut",
  dur: 2100,
  desc: "Bezier curves, droplets"
}, {
  id: "inferno",
  name: "Inferno",
  col: "#ff4400",
  pp: "fire",
  shape: "arc",
  easing: "easeIn",
  dur: 1350,
  desc: "Hot arcs, fire trail"
}, {
  id: "phantom",
  name: "Phantom",
  col: "#99ff44",
  pp: "fireflies",
  shape: "noise",
  easing: "spring",
  dur: 3400,
  desc: "Noise paths, fireflies"
}, {
  id: "warp",
  name: "Warp",
  col: "#00ffff",
  pp: "portal",
  shape: "straight",
  easing: "easeIn",
  dur: 520,
  desc: "Instant dash, portal"
}, {
  id: "nebula",
  name: "Nebula",
  col: "#cc44ff",
  pp: "nebula",
  shape: "bezier",
  easing: "easeInOut",
  dur: 5500,
  desc: "Cosmic slow swirl"
}, {
  id: "comet",
  name: "Comet",
  col: "#ffddaa",
  pp: "comet",
  shape: "straight",
  easing: "easeIn",
  dur: 820,
  desc: "Straight fast, comet tail"
}, {
  id: "tide",
  name: "Tide",
  col: "#88ddff",
  pp: "bubbles",
  shape: "arc",
  easing: "easeInOut",
  dur: 3100,
  desc: "Gentle arcs, bubbles"
}, {
  id: "spring",
  name: "Spring",
  col: "#ff44aa",
  pp: "confetti",
  shape: "arc",
  easing: "bounce",
  dur: 1800,
  desc: "Bounce arcs, confetti"
}, {
  id: "abyss",
  name: "Abyss",
  col: "#4400cc",
  pp: "void",
  shape: "bezier",
  easing: "easeIn",
  dur: 2600,
  desc: "Bezier spiral, vortex"
}, {
  id: "swarm",
  name: "Swarm",
  col: "#ffcc00",
  pp: "swarm",
  shape: "noise",
  easing: "linear",
  dur: 1050,
  desc: "Noisy fast, insects"
}, {
  id: "ember",
  name: "Embers",
  col: "#ff8800",
  pp: "embers",
  shape: "arc",
  easing: "easeOut",
  dur: 2200,
  desc: "Rising arcs, embers"
}, {
  id: "aurora2",
  name: "Aurora",
  col: "#00ff88",
  pp: "aurora",
  shape: "noise",
  easing: "easeInOut",
  dur: 4000,
  desc: "Noise drifts, aurora"
}, {
  id: "plasma",
  name: "Plasma",
  col: "#ff44ff",
  pp: "plasma",
  shape: "bezier",
  easing: "spring",
  dur: 900,
  desc: "Spring bezier, plasma"
}, {
  id: "blizzrd",
  name: "Blizzard",
  col: "#ddeeff",
  pp: "snow",
  shape: "noise",
  easing: "linear",
  dur: 3000,
  desc: "Noise slow, snowfall"
}];
const mkPt = () => ({
  alive: false,
  px: 0,
  py: 0,
  pz: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 0,
  maxLife: 1,
  r1: 1,
  g1: 1,
  b1: 1,
  r2: 0,
  g2: 0,
  b2: 0,
  rm: .5,
  gm: .5,
  bm: .5,
  hasMid: false,
  sStart: .1,
  sEnd: .05,
  nx: 0,
  ny: 0,
  nz: 0
});
function emitP(ps, o) {
  let s = -1;
  for (let i = 0; i < ps.p.length; i++) {
    if (!ps.p[i].alive) {
      s = i;
      break;
    }
  }
  if (s === -1) return;
  const p = ps.p[s],
    c = ps.cfg,
    R = c.emitRadius;
  let ox = 0,
    oy = 0,
    oz = 0;
  if (c.emitShape === "sphere") {
    const th = Math.random() * Math.PI * 2,
      ph = Math.acos(2 * Math.random() - 1),
      r = R * Math.cbrt(Math.random());
    ox = r * Math.sin(ph) * Math.cos(th);
    oy = r * Math.cos(ph);
    oz = r * Math.sin(ph) * Math.sin(th);
  } else if (c.emitShape === "ring") {
    const a = Math.random() * Math.PI * 2;
    ox = Math.cos(a) * R;
    oz = Math.sin(a) * R;
    oy = (Math.random() - .5) * .08;
  } else if (c.emitShape === "cone") {
    const a = Math.random() * Math.PI * 2,
      r2 = Math.random() * R;
    ox = Math.cos(a) * r2;
    oz = Math.sin(a) * r2;
  } else if (c.emitShape === "box") {
    ox = (Math.random() - .5) * R * 2;
    oy = (Math.random() - .5) * R * 2;
    oz = (Math.random() - .5) * R * 2;
  }
  p.px = o.x + ox;
  p.py = o.y + oy;
  p.pz = o.z + oz;
  const spd = rand(c.speedMin, c.speedMax),
    spr = c.spread / 180 * Math.PI;
  if (c.spread3D) {
    const th = Math.random() * Math.PI * 2,
      ph = Math.random() * spr;
    p.vx = Math.sin(ph) * Math.cos(th) * spd;
    p.vy = Math.sin(ph) * Math.sin(th) * spd;
    p.vz = Math.cos(ph) * spd;
  } else {
    const th = Math.random() * Math.PI * 2,
      ph = Math.random() * spr;
    p.vx = Math.sin(ph) * Math.cos(th) * spd;
    p.vz = Math.sin(ph) * Math.sin(th) * spd;
    p.vy = Math.cos(ph) * spd;
  }
  if (c.gravity < -1.5) p.vy = -Math.abs(p.vy);
  p.maxLife = rand(c.lifetimeMin, c.lifetimeMax);
  p.life = p.maxLife;
  const c1 = hexToRgb(c.colorStart),
    c2 = hexToRgb(c.colorEnd);
  p.r1 = c1.r;
  p.g1 = c1.g;
  p.b1 = c1.b;
  p.r2 = c2.r;
  p.g2 = c2.g;
  p.b2 = c2.b;
  if (c.colorMid) {
    const cm = hexToRgb(c.colorMid);
    p.rm = cm.r;
    p.gm = cm.g;
    p.bm = cm.b;
    p.hasMid = true;
  } else p.hasMid = false;
  p.sStart = c.sizeStart;
  p.sEnd = c.sizeEnd;
  p.nx = Math.random() * 200;
  p.ny = Math.random() * 200;
  p.nz = Math.random() * 200;
  p.alive = true;
}
function tickPS(ps, dt, o, time) {
  const c = ps.cfg;
  if (c.continuousEmit && c.emissionRate > 0) {
    ps.acc += c.emissionRate * dt;
    while (ps.acc >= 1) {
      ps.acc--;
      emitP(ps, o);
    }
  }
  if (!ps.burst && c.burstCount > 0) {
    for (let i = 0; i < c.burstCount; i++) emitP(ps, o);
    ps.burst = true;
  }
  const {
    pos,
    col,
    sz
  } = ps.bufs;
  for (let i = 0; i < c.count; i++) {
    const p = ps.p[i];
    if (!p.alive) {
      sz[i] = 0;
      col[i * 4 + 3] = 0;
      pos[i * 3] = o.x;
      pos[i * 3 + 1] = o.y;
      pos[i * 3 + 2] = o.z;
      continue;
    }
    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
      sz[i] = 0;
      col[i * 4 + 3] = 0;
      continue;
    }
    const t = clamp(1 - p.life / p.maxLife, 0, 1),
      tf = c.turbulence * dt;
    const tx = p.nx + time * c.turbulenceSpeed,
      ty = p.ny + time * c.turbulenceSpeed,
      tz = p.nz + time * c.turbulenceSpeed;
    p.vx += sNoise(p.px * c.turbulenceFreq + tx, p.py * c.turbulenceFreq, p.pz * c.turbulenceFreq) * tf;
    p.vy += sNoise(p.px * c.turbulenceFreq, p.py * c.turbulenceFreq + ty, p.pz * c.turbulenceFreq) * tf;
    p.vz += sNoise(p.px * c.turbulenceFreq, p.py * c.turbulenceFreq, p.pz * c.turbulenceFreq + tz) * tf;
    p.vy += c.gravity * dt;
    if (c.swirl !== 0) {
      const sa = c.swirl * dt,
        cs = Math.cos(sa),
        sn = Math.sin(sa);
      const nx2 = p.vx * cs - p.vz * sn,
        nz2 = p.vx * sn + p.vz * cs;
      p.vx = nx2;
      p.vz = nz2;
    }
    if (c.attract !== 0) {
      const dx = o.x - p.px,
        dy = o.y - p.py,
        dz = o.z - p.pz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + .01;
      const af = c.attract * dt / dist;
      p.vx += dx * af;
      p.vy += dy * af;
      p.vz += dz * af;
    }
    const d = Math.pow(c.drag, dt * 60);
    p.vx *= d;
    p.vy *= d;
    p.vz *= d;
    p.px += p.vx * dt;
    p.py += p.vy * dt;
    p.pz += p.vz * dt;
    let r, g, b;
    if (p.hasMid) {
      if (t < .5) {
        const tt = t * 2;
        r = lerp(p.r1, p.rm, tt);
        g = lerp(p.g1, p.gm, tt);
        b = lerp(p.b1, p.bm, tt);
      } else {
        const tt = (t - .5) * 2;
        r = lerp(p.rm, p.r2, tt);
        g = lerp(p.gm, p.g2, tt);
        b = lerp(p.bm, p.b2, tt);
      }
    } else {
      r = lerp(p.r1, p.r2, t);
      g = lerp(p.g1, p.g2, t);
      b = lerp(p.b1, p.b2, t);
    }
    let a;
    switch (c.opacityCurve) {
      case "easeIn":
        a = lerp(c.opacityStart, c.opacityEnd, t * t);
        break;
      case "easeOut":
        a = lerp(c.opacityStart, c.opacityEnd, 1 - (1 - t) * (1 - t));
        break;
      case "fadeInOut":
        a = Math.sin(t * Math.PI) * Math.max(c.opacityStart, c.opacityEnd, .01);
        break;
      case "peak":
        a = Math.sin(t * Math.PI);
        break;
      case "flicker":
        a = lerp(c.opacityStart, c.opacityEnd, t) * (.7 + .3 * Math.sin(time * 30 + p.nx));
        break;
      default:
        a = lerp(c.opacityStart, c.opacityEnd, t);
    }
    let s;
    switch (c.sizeCurve) {
      case "easeIn":
        s = lerp(p.sStart, p.sEnd, t * t);
        break;
      case "easeOut":
        s = lerp(p.sStart, p.sEnd, 1 - (1 - t) * (1 - t));
        break;
      case "peak":
        s = Math.sin(t * Math.PI) * Math.max(p.sStart, p.sEnd, .001);
        break;
      default:
        s = lerp(p.sStart, p.sEnd, t);
    }
    pos[i * 3] = p.px;
    pos[i * 3 + 1] = p.py;
    pos[i * 3 + 2] = p.pz;
    col[i * 4] = r;
    col[i * 4 + 1] = g;
    col[i * 4 + 2] = b;
    col[i * 4 + 3] = clamp(a, 0, 1);
    sz[i] = Math.max(0, s);
  }
  ps.geo.attributes.position.needsUpdate = true;
  ps.geo.attributes.aColor.needsUpdate = true;
  ps.geo.attributes.aSize.needsUpdate = true;
}
function mkPS(cfg, scene) {
  const c = {
      ...DEF_P,
      ...cfg
    },
    N = c.count;
  const pos = new Float32Array(N * 3),
    col = new Float32Array(N * 4),
    sz = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 4));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
  const bl = c.blending === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: bl,
    depthWrite: false,
    uniforms: {}
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return {
    cfg: c,
    p: Array.from({
      length: N
    }, mkPt),
    bufs: {
      pos,
      col,
      sz
    },
    geo,
    mat,
    pts,
    acc: 0,
    burst: false
  };
}
function rmPS(ps, scene) {
  if (!ps) return;
  scene.remove(ps.pts);
  ps.geo.dispose();
  ps.mat.dispose();
}
}
