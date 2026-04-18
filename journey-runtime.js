// ═══════════════════════════════════════════════════════════
// 4E Journey Runtime — self-contained A-Frame component
// Shared by player-v2.html and player-spatial.html.
// Injects its own CSS + HTML overlay on first init.
// Requires: particle-engine.js (loaded before this file).
// ═══════════════════════════════════════════════════════════

(function() {
'use strict';

// ─── Self-inject CSS ───────────────────────────────────────
const JR_CSS = `
/* ─── Journey runtime UI ─────────────────────────────────────
   Only shown for projects that include APP.journey (spatial-test
   for now). Hidden otherwise so other published apps are unaffected.
   Mobile-first sizing — buttons stay clickable on small screens. */
#jr-ui{position:fixed;inset:0;z-index:30;pointer-events:none;display:none}
#jr-ui.show{display:block}
.jr-side{position:absolute;top:74px;right:12px;display:flex;flex-direction:column;gap:10px;pointer-events:auto}
.jr-btn{width:46px;height:46px;border-radius:23px;background:rgba(10,14,26,.78);border:1px solid rgba(167,139,250,.45);color:#a78bfa;font-size:18px;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;font-family:inherit;transition:all .15s}
.jr-btn:hover,.jr-btn:active{background:rgba(139,92,246,.25);color:#fff}
.jr-btn.off{color:#475569;border-color:#2d384a}
.jr-status-pill{position:absolute;top:14px;left:14px;pointer-events:auto;background:rgba(10,14,26,.78);border:1px solid rgba(74,222,128,.4);color:#4ade80;padding:5px 10px;border-radius:12px;font-size:11px;font-family:ui-monospace,monospace;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.jr-status-pill.warn{border-color:rgba(251,191,36,.4);color:#fbbf24}
.jr-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:60;pointer-events:auto}
.jr-modal-overlay.hidden{display:none}
/* Full-screen on mobile, centered card on desktop. Tabs at top,
   scrollable content per tab, large touch targets throughout. */
.jr-modal{background:#0d1220;border:1px solid #1e2838;border-radius:12px;width:min(440px,96vw);max-height:88vh;display:flex;flex-direction:column;color:#e2e8f0;font-family:ui-monospace,'Space Mono',monospace;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)}
@media(max-width:480px){.jr-modal{width:100vw;height:100vh;max-height:100vh;border-radius:0;border:none}}
.jr-modal-tabs{display:flex;border-bottom:1px solid #1e2838;flex-shrink:0;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0 4px}
.jr-modal-tab{padding:12px 16px;border:none;background:transparent;color:#64748b;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;flex-shrink:0}
.jr-modal-tab:hover{color:#cbd5e1}
.jr-modal-tab.active{color:#a78bfa;border-bottom-color:#8b5cf6}
.jr-modal-body{flex:1;overflow-y:auto;padding:18px 20px;min-height:0}
@media(max-width:480px){.jr-modal-body{padding:16px}}
.jr-modal-body .sec{display:none}
.jr-modal-body .sec.active{display:block}
.jr-modal-body h4{color:#a78bfa;font-size:11px;letter-spacing:.06em;margin:22px 0 12px;text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid rgba(139,92,246,.12);clear:both}
.jr-modal-body h4:first-child{margin-top:4px}
/* Single-line label row: "Label  [value]" on one row, control below */
.jr-modal-body label{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;color:#94a3b8;margin:16px 0 8px;line-height:1.4;clear:both;gap:10px}
.jr-modal-body label .v{color:#cbd5e1;font-size:11px;font-weight:600;white-space:nowrap}
.jr-modal-body input[type=range]{display:block;width:100%;accent-color:#8b5cf6;margin:0 0 6px;height:6px}
.jr-modal-body input[type=color]{display:block;width:100%;height:42px;background:transparent;border:1px solid #1e2838;border-radius:6px;cursor:pointer;margin:0 0 10px;padding:2px}
.jr-modal-body select{display:block;width:100%;background:#060810;border:1px solid #1e2838;color:#e2e8f0;padding:10px 12px;border-radius:6px;font-family:inherit;font-size:12px;margin:0 0 10px}
.jr-modal-body select option{background:#0a0e1a;color:#e2e8f0}
/* Dual-slider row — replaces fragile inline-block+float with flexbox */
.jr-dual{display:flex;gap:10px;margin:0 0 10px}
.jr-dual input[type=range]{flex:1;margin:0}
.jr-chip-grid{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;clear:both}
.jr-chip{padding:8px 14px;border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;border:1px solid #1e2838;background:#0a0e1a;color:#94a3b8;transition:all .12s;min-width:0;line-height:1}
.jr-chip:hover{border-color:#8b5cf6;color:#a78bfa}
.jr-chip.active{background:rgba(139,92,246,.18);border-color:#8b5cf6;color:#a78bfa}
.jr-chip.amber.active{background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.5);color:#fbbf24}
.jr-chip.cyan.active{background:rgba(34,211,238,.1);border-color:rgba(34,211,238,.4);color:#22d3ee}
.jr-chip.green.active{background:rgba(74,222,128,.1);border-color:rgba(74,222,128,.4);color:#4ade80}
.jr-toggle{display:flex;align-items:center;gap:12px;padding:12px 0;font-size:12px;color:#cbd5e1;cursor:pointer;margin:0;clear:both}
.jr-toggle input{display:none}
.jr-toggle .sw{width:36px;height:20px;border-radius:10px;background:#1e2838;position:relative;transition:background .15s;flex-shrink:0}
.jr-toggle .sw::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#475569;transition:all .15s}
.jr-toggle input:checked + .sw{background:rgba(139,92,246,.45)}
.jr-toggle input:checked + .sw::after{left:18px;background:#a78bfa}
.jr-preset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;margin:0 0 14px;clear:both}
.jr-preset{padding:12px 6px;border-radius:8px;font-size:10px;text-align:center;cursor:pointer;border:1px solid #1e2838;background:#0a0e1a;color:#94a3b8;transition:all .12s;line-height:1.4;word-break:break-word}
.jr-preset .icon{font-size:20px;display:block;margin-bottom:6px}
.jr-preset:hover{border-color:#8b5cf6;color:#a78bfa}
.jr-preset.active{background:rgba(139,92,246,.15);border-color:#8b5cf6;color:#a78bfa}
.jr-modal-footer{padding:14px 20px;border-top:1px solid #1e2838;flex-shrink:0}
@media(max-width:480px){.jr-modal-footer{padding:12px 16px}}
.jr-modal-close{width:100%;padding:14px;background:#8b5cf6;border:none;color:#fff;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;letter-spacing:.02em}
#jr-debug{position:fixed;bottom:10px;left:10px;background:rgba(10,14,26,.85);border:1px solid #1e2838;border-radius:5px;padding:8px 10px;font-size:10px;color:#94a3b8;line-height:1.6;font-family:ui-monospace,monospace;z-index:25;display:none;max-width:280px;pointer-events:none}
#jr-debug.show{display:block}
/* In-app spatial editor overlay — full-screen iframe */
#jr-editor-overlay{position:fixed;inset:0;z-index:200;background:#060810;display:none}
#jr-editor-overlay.open{display:block}
#jr-editor-iframe{width:100%;height:100%;border:none;background:#060810}
#jr-editor-close{position:fixed;top:6px;right:6px;z-index:210;width:36px;height:36px;border-radius:18px;background:rgba(10,14,26,.85);border:1px solid rgba(248,113,113,.4);color:#f87171;font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
`;

if (!document.getElementById('jr-injected-css')) {
  const s = document.createElement('style');
  s.id = 'jr-injected-css';
  s.textContent = JR_CSS;
  document.head.appendChild(s);
}


// ─── Self-inject HTML overlay ──────────────────────────────
const JR_HTML = `
<div id="jr-ui">
  <div class="jr-status-pill" id="jr-status">Locked: 0 / 0</div>
  <div class="jr-side">
    <button class="jr-btn" id="jr-btn-paths" title="Show / hide path lines">🛣</button>
    <button class="jr-btn" id="jr-btn-anchors" title="Show / hide anchor billboards">📍</button>
    <button class="jr-btn" id="jr-btn-settings" title="Path + traveller settings">⚙</button>
    <button class="jr-btn" id="jr-btn-calibrate" title="Re-search image targets">🎯</button>
  </div>
</div>
<div id="jr-debug"></div>
<div class="jr-modal-overlay hidden" id="jr-modal">
  <div class="jr-modal">
    <div class="jr-modal-tabs">
      <button class="jr-modal-tab active" data-sec="traveller">Traveller</button>
      <button class="jr-modal-tab" data-sec="path">Path</button>
      <button class="jr-modal-tab" data-sec="display">Display</button>
      <button class="jr-modal-tab" data-sec="presets">Presets</button>
    </div>
    <div class="jr-modal-body">

      <!-- ─── TRAVELLER TAB ─────────────────────────────── -->
      <div class="sec active" data-sec="traveller">
        <h4>Type</h4>
        <div class="jr-chip-grid" id="jr-m-tv-type">
          <button class="jr-chip amber active" data-v="object">Object</button>
          <button class="jr-chip cyan" data-v="particles">Particles</button>
        </div>

        <!-- Object settings (shown when type=object) -->
        <div id="jr-m-obj-settings">
          <h4>Shape</h4>
          <div class="jr-chip-grid" id="jr-m-shapes">
            <button class="jr-chip amber active" data-v="sphere">sphere</button>
            <button class="jr-chip amber" data-v="cube">cube</button>
            <button class="jr-chip amber" data-v="torus">torus</button>
            <button class="jr-chip amber" data-v="cone">cone</button>
            <button class="jr-chip amber" data-v="diamond">diamond</button>
            <button class="jr-chip amber" data-v="ring">ring</button>
          </div>
          <h4>Appearance</h4>
          <label>Color</label>
          <input type="color" id="jr-m-color" value="#ffc400">
          <label>Scale <span class="v" id="jr-m-scale-v">1.0×</span></label>
          <input type="range" id="jr-m-scale" min="0.3" max="2.5" step="0.1" value="1.0">
          <h4>Trail</h4>
          <label class="jr-toggle">
            <input type="checkbox" id="jr-m-trail" checked>
            <span class="sw"></span>
            Trail enabled
          </label>
          <label>Trail length <span class="v" id="jr-m-trail-len-v">45</span></label>
          <input type="range" id="jr-m-trail-len" min="5" max="120" step="5" value="45">
        </div>

        <!-- Particle settings (shown when type=particles) -->
        <div id="jr-m-particle-settings" style="display:none">
          <h4>Preset</h4>
          <div class="jr-preset-grid" id="jr-m-particle-pick">
            <div class="jr-preset active" data-preset="swarm"><span class="icon">🐝</span>Swarm</div>
            <div class="jr-preset" data-preset="smoke"><span class="icon">💨</span>Smoke</div>
            <div class="jr-preset" data-preset="fire"><span class="icon">🔥</span>Fire</div>
            <div class="jr-preset" data-preset="liquid"><span class="icon">💧</span>Liquid</div>
            <div class="jr-preset" data-preset="sparkle"><span class="icon">✨</span>Sparkle</div>
            <div class="jr-preset" data-preset="dust"><span class="icon">🌫</span>Dust</div>
            <div class="jr-preset" data-preset="electric"><span class="icon">⚡</span>Electric</div>
            <div class="jr-preset" data-preset="snow"><span class="icon">❄</span>Snow</div>
            <div class="jr-preset" data-preset="explosion"><span class="icon">💥</span>Explosion</div>
            <div class="jr-preset" data-preset="fireflies"><span class="icon">🪲</span>Fireflies</div>
            <div class="jr-preset" data-preset="nebula"><span class="icon">🌌</span>Nebula</div>
            <div class="jr-preset" data-preset="rain"><span class="icon">🌧</span>Rain</div>
            <div class="jr-preset" data-preset="confetti"><span class="icon">🎉</span>Confetti</div>
            <div class="jr-preset" data-preset="void"><span class="icon">🕳</span>Void</div>
            <div class="jr-preset" data-preset="embers"><span class="icon">🪨</span>Embers</div>
            <div class="jr-preset" data-preset="bubbles"><span class="icon">🫧</span>Bubbles</div>
            <div class="jr-preset" data-preset="aurora"><span class="icon">🌈</span>Aurora</div>
            <div class="jr-preset" data-preset="portal"><span class="icon">🌀</span>Portal</div>
            <div class="jr-preset" data-preset="plasma"><span class="icon">⚛</span>Plasma</div>
            <div class="jr-preset" data-preset="comet"><span class="icon">☄</span>Comet</div>
          </div>
          <h4>Parameters</h4>
          <h4>Emission</h4>
          <label>Count <span class="v" id="jr-p-count-v">60</span></label>
          <input type="range" id="jr-p-count" min="10" max="200" step="5" value="60">
          <label>Emission rate <span class="v" id="jr-p-rate-v">20</span></label>
          <input type="range" id="jr-p-rate" min="1" max="100" step="1" value="20">
          <label>Burst count <span class="v" id="jr-p-burst-v">0</span></label>
          <input type="range" id="jr-p-burst" min="0" max="100" step="5" value="0">
          <label class="jr-toggle">
            <input type="checkbox" id="jr-p-continuous" checked>
            <span class="sw"></span>
            Continuous emit
          </label>

          <h4>Shape</h4>
          <label>Emit shape</label>
          <div class="jr-chip-grid" id="jr-p-emit-shape">
            <button class="jr-chip active" data-v="sphere">sphere</button>
            <button class="jr-chip" data-v="ring">ring</button>
            <button class="jr-chip" data-v="cone">cone</button>
            <button class="jr-chip" data-v="box">box</button>
            <button class="jr-chip" data-v="point">point</button>
          </div>
          <label>Emit radius <span class="v" id="jr-p-radius-v">0.35</span></label>
          <input type="range" id="jr-p-radius" min="0.05" max="2" step="0.05" value="0.35">
          <label>Emit angle <span class="v" id="jr-p-angle-v">30°</span></label>
          <input type="range" id="jr-p-angle" min="0" max="180" step="5" value="30">
          <label class="jr-toggle">
            <input type="checkbox" id="jr-p-spread3d" checked>
            <span class="sw"></span>
            Spread 3D
          </label>

          <h4>Lifetime &amp; Speed</h4>
          <label>Lifetime <span class="v" id="jr-p-life-v">1.5 – 2.8s</span></label>
          <div class="jr-dual">
            <input type="range" id="jr-p-life-min" min="0.2" max="6" step="0.1" value="1.5">
            <input type="range" id="jr-p-life-max" min="0.2" max="8" step="0.1" value="2.8">
          </div>
          <label>Speed <span class="v" id="jr-p-speed-v">0.5 – 1.5</span></label>
          <div class="jr-dual">
            <input type="range" id="jr-p-speed-min" min="0" max="5" step="0.1" value="0.5">
            <input type="range" id="jr-p-speed-max" min="0" max="8" step="0.1" value="1.5">
          </div>
          <label>Spread <span class="v" id="jr-p-spread-v">90°</span></label>
          <input type="range" id="jr-p-spread" min="0" max="360" step="5" value="90">

          <h4>Size</h4>
          <label>Size start → end <span class="v" id="jr-p-size-v">0.10 → 0.04</span></label>
          <div class="jr-dual">
            <input type="range" id="jr-p-size-start" min="0.01" max="1" step="0.01" value="0.1">
            <input type="range" id="jr-p-size-end" min="0.01" max="1" step="0.01" value="0.04">
          </div>
          <label>Size curve</label>
          <div class="jr-chip-grid" id="jr-p-size-curve">
            <button class="jr-chip active" data-v="linear">linear</button>
            <button class="jr-chip" data-v="easeIn">easeIn</button>
            <button class="jr-chip" data-v="easeOut">easeOut</button>
            <button class="jr-chip" data-v="peak">peak</button>
          </div>

          <h4>Color</h4>
          <label>Color start</label>
          <input type="color" id="jr-p-color-start" value="#ffc400">
          <label class="jr-toggle">
            <input type="checkbox" id="jr-p-color-mid-toggle">
            <span class="sw"></span>
            Color midpoint
          </label>
          <div id="jr-p-color-mid-row" style="display:none">
            <label>Color mid</label>
            <input type="color" id="jr-p-color-mid" value="#ff8800">
          </div>
          <label>Color end</label>
          <input type="color" id="jr-p-color-end" value="#ff6600">

          <h4>Opacity</h4>
          <label>Opacity start → end <span class="v" id="jr-p-opacity-v">1.0 → 0.0</span></label>
          <div class="jr-dual">
            <input type="range" id="jr-p-opacity-start" min="0" max="1" step="0.05" value="1">
            <input type="range" id="jr-p-opacity-end" min="0" max="1" step="0.05" value="0">
          </div>
          <label>Opacity curve</label>
          <div class="jr-chip-grid" id="jr-p-opacity-curve">
            <button class="jr-chip active" data-v="linear">linear</button>
            <button class="jr-chip" data-v="easeIn">easeIn</button>
            <button class="jr-chip" data-v="easeOut">easeOut</button>
            <button class="jr-chip" data-v="fadeInOut">fadeInOut</button>
            <button class="jr-chip" data-v="peak">peak</button>
            <button class="jr-chip" data-v="flicker">flicker</button>
          </div>

          <h4>Physics</h4>
          <label>Turbulence <span class="v" id="jr-p-turb-v">0.5</span></label>
          <input type="range" id="jr-p-turb" min="0" max="8" step="0.1" value="0.5">
          <label>Turbulence frequency <span class="v" id="jr-p-turb-freq-v">1.0</span></label>
          <input type="range" id="jr-p-turb-freq" min="0.1" max="5" step="0.1" value="1.0">
          <label>Turbulence speed <span class="v" id="jr-p-turb-speed-v">1.0</span></label>
          <input type="range" id="jr-p-turb-speed" min="0.1" max="5" step="0.1" value="1.0">
          <label>Gravity <span class="v" id="jr-p-gravity-v">0.0</span></label>
          <input type="range" id="jr-p-gravity" min="-3" max="3" step="0.1" value="0">
          <label>Drag <span class="v" id="jr-p-drag-v">0.98</span></label>
          <input type="range" id="jr-p-drag" min="0.8" max="1" step="0.005" value="0.98">
          <label>Swirl <span class="v" id="jr-p-swirl-v">0.0</span></label>
          <input type="range" id="jr-p-swirl" min="0" max="5" step="0.1" value="0">
          <label>Attract <span class="v" id="jr-p-attract-v">0.0</span></label>
          <input type="range" id="jr-p-attract" min="-3" max="3" step="0.1" value="0">

          <h4>Rendering</h4>
          <label>Blending</label>
          <div class="jr-chip-grid" id="jr-p-blending">
            <button class="jr-chip active" data-v="additive">additive</button>
            <button class="jr-chip" data-v="normal">normal</button>
            <button class="jr-chip" data-v="screen">screen</button>
          </div>
        </div>
      </div>

      <!-- ─── PATH TAB ──────────────────────────────────── -->
      <div class="sec" data-sec="path">
        <h4>Timing</h4>
        <label>Duration per leg <span class="v" id="jr-m-dur-v">2000ms</span></label>
        <input type="range" id="jr-m-dur" min="300" max="8000" step="100" value="2000">

        <h4>Easing</h4>
        <div class="jr-chip-grid" id="jr-m-easings">
          <button class="jr-chip active" data-v="linear">linear</button>
          <button class="jr-chip" data-v="easeIn">easeIn</button>
          <button class="jr-chip" data-v="easeOut">easeOut</button>
          <button class="jr-chip" data-v="easeInOut">easeInOut</button>
          <button class="jr-chip" data-v="fadeInOut">fadeInOut</button>
          <button class="jr-chip" data-v="peak">peak</button>
          <button class="jr-chip" data-v="bounce">bounce</button>
          <button class="jr-chip" data-v="spring">spring</button>
        </div>

        <h4>Curve shape</h4>
        <div class="jr-chip-grid" id="jr-m-curves">
          <button class="jr-chip cyan active" data-v="smooth">smooth</button>
          <button class="jr-chip cyan" data-v="arc">high arc</button>
          <button class="jr-chip cyan" data-v="bezier">bezier</button>
          <button class="jr-chip cyan" data-v="straight">straight</button>
          <button class="jr-chip cyan" data-v="noise">noise</button>
        </div>

        <h4>Loop</h4>
        <label class="jr-toggle">
          <input type="checkbox" id="jr-m-loop" checked>
          <span class="sw"></span>
          Loop journey
        </label>
      </div>

      <!-- ─── DISPLAY TAB ───────────────────────────────── -->
      <div class="sec" data-sec="display">
        <h4>Visibility</h4>
        <label class="jr-toggle">
          <input type="checkbox" id="jr-m-show-paths" checked>
          <span class="sw"></span>
          🛣 Show paths
        </label>
        <label class="jr-toggle">
          <input type="checkbox" id="jr-m-show-anchors" checked>
          <span class="sw"></span>
          📍 Show anchor billboards
        </label>
        <label class="jr-toggle">
          <input type="checkbox" id="jr-m-show-traveller" checked>
          <span class="sw"></span>
          🔶 Show traveller
        </label>

        <h4>Debug</h4>
        <label class="jr-toggle">
          <input type="checkbox" id="jr-m-debug">
          <span class="sw"></span>
          Show debug overlay
        </label>
      </div>

      <!-- ─── PRESETS TAB ───────────────────────────────── -->
      <div class="sec" data-sec="presets">
        <h4>Journey presets</h4>
        <div class="jr-preset-grid" id="jr-m-journey-presets">
          <div class="jr-preset" data-preset="gentle"><span class="icon">🌿</span>Gentle</div>
          <div class="jr-preset" data-preset="energetic"><span class="icon">⚡</span>Energetic</div>
          <div class="jr-preset" data-preset="dramatic"><span class="icon">🎭</span>Dramatic</div>
          <div class="jr-preset" data-preset="minimal"><span class="icon">◯</span>Minimal</div>
          <div class="jr-preset" data-preset="cosmic"><span class="icon">✨</span>Cosmic</div>
          <div class="jr-preset" data-preset="playful"><span class="icon">🎈</span>Playful</div>
        </div>

        <h4>Quick tip</h4>
        <p style="font-size:10px;color:#475569;line-height:1.6">Switch to the <strong style="color:#cbd5e1">Traveller</strong> tab and select <strong style="color:#22d3ee">Particles</strong> to access all 20 particle presets with full parameter controls — same as the spatial editor.</p>
      </div>

    </div>
    <div class="jr-modal-footer">
      <button class="jr-modal-close" id="jr-m-close">Close</button>
    </div>
  </div>
</div>
<!-- In-app spatial editor — replaces the settings modal on mobile -->
<div id="jr-editor-overlay">
  <iframe id="jr-editor-iframe" src="" allow="camera; microphone"></iframe>
  <button id="jr-editor-close">✕</button>
</div>
`;

function _injectJRUI() {
  if (document.getElementById('jr-ui')) return;
  const d = document.createElement('div');
  d.innerHTML = JR_HTML;
  while (d.firstChild) document.body.appendChild(d.firstChild);
}


// ─── A-Frame component registration ───────────────────────
  AFRAME.registerComponent('journey-runtime', {
    init() {
      // Inject UI overlay + CSS if not already in the document.
      _injectJRUI();

      const sceneEl = this.el;
      // APP is on window (set by the player after Firestore/JSON load).
      const _APP = window.APP || {};
      this.journey = _APP.journey || null;
      if (!this.journey || !this.journey.anchors || this.journey.anchors.length < 2) {
        console.log('[journey-runtime] no journey or <2 anchors — disabling');
        return;
      }
      // Resolve target name per anchor (xrimagefound delivers .name; we
      // need the name string, not the studio's tgt_xxxx id).
      const targets = _APP.targets || [];
      this.anchors = this.journey.anchors.map(a => {
        const tgt = (a.it && a.it.id) ? targets.find(t => t.id === a.it.id) : null;
        return {
          id: a.id,
          name: a.name,
          targetName: tgt ? tgt.name : null,
          worldPos: null,        // populated when target found
          locked: false,
          billboard: null,
        };
      });
      this.lockedCount = 0;
      this.totalCount = this.anchors.length;

      // Settings — defaults from journey.globalTraveller
      const gtv = this.journey.globalTraveller || {};
      this.settings = {
        traveller: {
          shape: gtv.type || 'sphere',
          color: gtv.color || '#ffc400',
          scale: gtv.scale || 1.0,
        },
        path: { duration: 2000, easing: 'linear' },
        pathsVisible: true,
        anchorsVisible: true,
      };

      this.curves = [];
      this.edgeIdx = 0;
      this.edgeT = 0;

      // Three.js groups attached to the scene root
      const scene3 = sceneEl.object3D;
      this.anchorGroup = new THREE.Group();
      this.pathGroup = new THREE.Group();
      this.travContainer = new THREE.Group();
      scene3.add(this.anchorGroup);
      scene3.add(this.pathGroup);
      scene3.add(this.travContainer);

      // Particle state — managed alongside the mesh traveller.
      // When type='particles', we create a particle system at the
      // traveller container position and tick it each frame.
      this._particleSystem = null;
      this._particleCfg = { ...DEF_P };
      this._particleTime = 0;

      this.rebuildTraveller();

      // xrimagefound handler — capture world transform per-anchor on
      // first detection. After that, the position is "world-locked".
      this._onFound = (e) => {
        const d = e && e.detail;
        if (!d) return;
        for (const a of this.anchors) {
          if (a.locked) continue;
          if (!a.targetName || d.name !== a.targetName) continue;
          // Compose a Vector3 from the image-found world pose
          a.worldPos = new THREE.Vector3().copy(d.position);
          a.locked = true;
          this.lockedCount++;
          console.log('[journey-runtime] locked', a.name, 'at', d.name, a.worldPos.toArray());
          this.rebuildAnchors();
          this.rebuildPaths();
          this.updateStatus();
          break;
        }
      };
      const attach = () => sceneEl.addEventListener('xrimagefound', this._onFound);
      if (sceneEl.hasLoaded) attach(); else sceneEl.addEventListener('loaded', attach);

      // Preview-mode shortcut. When running in an iframe (browser
      // preview, no real camera), 8th Wall's xrweb fails to start and
      // xrimagefound never fires. We fake anchor world positions in a
      // row in front of the default camera so the user can verify the
      // path + traveller render correctly before going to the phone.
      if (PREVIEW_MODE) {
        console.log('[journey-runtime] PREVIEW_MODE — faking anchor positions in a row');
        const spacing = 0.45;
        const startX = -((this.anchors.length - 1) * spacing) / 2;
        this.anchors.forEach((a, i) => {
          a.worldPos = new THREE.Vector3(startX + i * spacing, 0, -1.2);
          a.locked = true;
        });
        this.lockedCount = this.anchors.length;
        // Defer the rebuild to after the scene init finishes.
        setTimeout(() => {
          this.rebuildAnchors();
          this.rebuildPaths();
          this.updateStatus();
          // Camera preview: nudge the A-Frame camera so the row is in view.
          const cam = sceneEl.camera;
          if (cam) {
            cam.parent && cam.parent.position.set(0, 0.2, 0);
            cam.position.set(0, 0.2, 0);
          }
        }, 300);
      }

      // Show UI overlay
      const ui = document.getElementById('jr-ui');
      if (ui) ui.classList.add('show');
      this.wireUI();
      this.updateStatus();

      // Debug overlay (?debug=1 URL flag)
      if (new URLSearchParams(location.search).get('debug') === '1') {
        document.getElementById('jr-debug').classList.add('show');
      }

      this._clock = new THREE.Clock();
    },

    // ─── Three.js builders (mirrors docs/journey-runtime-test.html) ──
    makeAnchorBillboard(name) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
      const ctx = cv.getContext('2d');
      ctx.strokeStyle = 'rgba(0,229,255,0.55)';
      ctx.lineWidth = 5; ctx.strokeRect(20, 20, 216, 216);
      ctx.fillStyle = 'rgba(0,229,255,0.10)'; ctx.fillRect(20, 20, 216, 216);
      ctx.fillStyle = '#00e5ff';
      ctx.font = "bold 22px ui-monospace, 'Space Mono', monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, 128, 128);
      ctx.strokeStyle = 'rgba(0,229,255,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(128, 64); ctx.lineTo(128, 90);
      ctx.moveTo(128, 192); ctx.lineTo(128, 166);
      ctx.moveTo(64, 128); ctx.lineTo(90, 128);
      ctx.moveTo(192, 128); ctx.lineTo(166, 128);
      ctx.stroke();
      const tex = new THREE.CanvasTexture(cv);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
      return new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), mat);
    },
    makeTraveller() {
      const G = {
        sphere:  new THREE.SphereGeometry(0.04, 24, 24),
        cube:    new THREE.BoxGeometry(0.06, 0.06, 0.06),
        torus:   new THREE.TorusGeometry(0.035, 0.012, 10, 28),
        cone:    new THREE.ConeGeometry(0.035, 0.07, 14),
        diamond: new THREE.OctahedronGeometry(0.045),
        ring:    new THREE.TorusGeometry(0.045, 0.008, 8, 32),
      };
      const c = new THREE.Color(this.settings.traveller.color);
      const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.5 });
      const m = new THREE.Mesh(G[this.settings.traveller.shape] || G.sphere, mat);
      m.scale.setScalar(this.settings.traveller.scale);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12 })
      );
      m.add(halo);
      return m;
    },

    rebuildAnchors() {
      // Clear & rebuild billboards for locked anchors only
      while (this.anchorGroup.children.length) {
        const c = this.anchorGroup.children[0];
        this.anchorGroup.remove(c);
        c.geometry?.dispose();
        if (c.material) { c.material.map?.dispose(); c.material.dispose(); }
      }
      for (const a of this.anchors) {
        a.billboard = null;
        if (!a.locked || !a.worldPos) continue;
        const m = this.makeAnchorBillboard(a.name);
        m.position.copy(a.worldPos);
        m.visible = this.settings.anchorsVisible;
        this.anchorGroup.add(m);
        a.billboard = m;
      }
    },

    rebuildPaths() {
      while (this.pathGroup.children.length) {
        const c = this.pathGroup.children[0];
        this.pathGroup.remove(c);
        c.geometry?.dispose(); c.material?.dispose();
      }
      this.curves = [];
      if (!this.settings.pathsVisible) return;
      const seq = this.journey.sequence || this.anchors.map(a => a.id);
      const pairs = [];
      for (let i = 0; i < seq.length - 1; i++) pairs.push([seq[i], seq[i + 1]]);
      if (this.journey.loop && seq.length > 1) pairs.push([seq[seq.length - 1], seq[0]]);
      for (const [fromId, toId] of pairs) {
        const fa = this.anchors.find(a => a.id === fromId);
        const ta = this.anchors.find(a => a.id === toId);
        if (!fa || !ta || !fa.locked || !ta.locked) continue;
        const fp = fa.worldPos, tp = ta.worldPos;
        const cShape = this.settings.path.curve || 'smooth';
        const d = fp.distanceTo(tp);
        let curvePts;
        if (cShape === 'straight') {
          curvePts = [fp, tp];
        } else if (cShape === 'arc') {
          const mid = fp.clone().lerp(tp, 0.5);
          mid.y += d * 0.35;
          curvePts = [fp, mid, tp];
        } else if (cShape === 'bezier') {
          const dir = tp.clone().sub(fp).normalize();
          const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
          const mid = fp.clone().lerp(tp, 0.5);
          curvePts = [
            fp,
            fp.clone().lerp(mid, 0.5).addScaledVector(perp, d * 0.42).add(new THREE.Vector3(0, d * 0.32, 0)),
            tp.clone().lerp(mid, 0.5).addScaledVector(perp, -d * 0.28).add(new THREE.Vector3(0, d * 0.12, 0)),
            tp
          ];
        } else if (cShape === 'noise') {
          curvePts = [];
          const time = this._particleTime || 0;
          for (let i = 0; i <= 14; i++) {
            const t = i / 14;
            const p = fp.clone().lerp(tp, t);
            const env = Math.sin(t * Math.PI);
            if (i > 0 && i < 14) {
              p.y += Math.sin(t * 9 + time * 2) * 0.48 * env;
              p.x += Math.cos(t * 6 + time * 1.5) * 0.32 * env;
              p.z += Math.sin(t * 5 + time * 1.2) * 0.26 * env;
            }
            curvePts.push(p);
          }
        } else {
          const mid = fp.clone().lerp(tp, 0.5);
          mid.y += 0.08;
          curvePts = [fp, mid, tp];
        }
        const curve = new THREE.CatmullRomCurve3(curvePts);
        this.curves.push({ from: fromId, to: toId, curve });
        const pts = curve.getPoints(64);
        this.pathGroup.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.7 })
        ));
        const dots = pts.filter((_, i) => i % 4 === 0);
        this.pathGroup.add(new THREE.Points(
          new THREE.BufferGeometry().setFromPoints(dots),
          new THREE.PointsMaterial({ color: 0x00e5ff, size: 0.012, transparent: true, opacity: 0.55, sizeAttenuation: true })
        ));
      }
    },

    rebuildTraveller() {
      // Clean up existing mesh traveller
      while (this.travContainer.children.length) {
        const c = this.travContainer.children[0];
        this.travContainer.remove(c);
        c.traverse(x => { x.geometry?.dispose(); x.material?.dispose?.(); });
      }
      // Clean up particle system (lives at scene level, not container)
      if (this._particleSystem) {
        rmPS(this._particleSystem, this.el.object3D);
        this._particleSystem = null;
      }
      if (this.settings.traveller.type === 'particles') {
        // Create particle system at scene root (particles move via
        // tickPS origin parameter, not by parenting to travContainer)
        this._particleSystem = mkPS(this._particleCfg, this.el.object3D);
      } else {
        this.travContainer.add(this.makeTraveller());
      }
    },

    EASINGS: {
      linear:    t => t,
      easeIn:    t => t * t,
      easeOut:   t => 1 - (1 - t) * (1 - t),
      easeInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
      fadeInOut:  t => Math.sin(t * Math.PI),
      peak:      t => Math.pow(Math.sin(t * Math.PI), 0.5),
      bounce: t => {
        const n1 = 7.5625, d1 = 2.75;
        if (t < 1/d1) return n1*t*t;
        if (t < 2/d1) return n1*(t-=1.5/d1)*t+.75;
        if (t < 2.5/d1) return n1*(t-=2.25/d1)*t+.9375;
        return n1*(t-=2.625/d1)*t+.984375;
      },
      spring: t => 1 - Math.cos(t * Math.PI * 3) * Math.exp(-t * 5),
    },

    tick() {
      if (!this._clock) return;
      const dt = Math.min(this._clock.getDelta(), 0.05);
      this._particleTime = (this._particleTime || 0) + dt;
      // Noise paths need continuous rebuilding (they're time-animated)
      if ((this.settings.path.curve === 'noise') && this.curves.length > 0 && this.lockedCount >= 2) {
        this._noiseRebuildAcc = (this._noiseRebuildAcc || 0) + dt;
        if (this._noiseRebuildAcc > 0.05) {
          this._noiseRebuildAcc = 0;
          this.rebuildPaths();
        }
      }
      // Animate traveller along the available curves
      if (this.curves.length > 0) {
        const dur = this.settings.path.duration / 1000;
        this.edgeT += dt / dur;
        while (this.edgeT >= 1) {
          this.edgeT -= 1;
          this.edgeIdx = (this.edgeIdx + 1) % this.curves.length;
        }
        const ease = this.EASINGS[this.settings.path.easing] || this.EASINGS.linear;
        const ec = this.curves[this.edgeIdx];
        const pos = ec.curve.getPoint(ease(this.edgeT));
        this.travContainer.position.copy(pos);
        const ahead = ec.curve.getPoint(Math.min(1, ease(this.edgeT) + 0.04));
        this.travContainer.lookAt(ahead);
        // Tick particle system at traveller position
        if (this._particleSystem) {
          tickPS(this._particleSystem, dt, { x: pos.x, y: pos.y, z: pos.z }, this._particleTime);
        }
      }
      // Anchor billboards face the camera
      const cam = this.el.camera;
      if (cam) {
        const camPos = new THREE.Vector3();
        cam.getWorldPosition(camPos);
        for (const a of this.anchors) {
          if (a.billboard) a.billboard.lookAt(camPos);
        }
      }
      // Debug overlay update — cheap, only if visible
      const dbg = document.getElementById('jr-debug');
      if (dbg && dbg.classList.contains('show')) {
        dbg.innerHTML = '<div><span class="k">locked</span><span class="v">' + this.lockedCount + ' / ' + this.totalCount + '</span></div>' +
          '<div><span class="k">curves</span><span class="v">' + this.curves.length + '</span></div>' +
          '<div><span class="k">edge</span><span class="v">' + this.edgeIdx + ' · ' + Math.round(this.edgeT * 100) + '%</span></div>' +
          '<div><span class="k">traveller</span><span class="v">' + this.settings.traveller.shape + '</span></div>' +
          '<div><span class="k">duration</span><span class="v">' + this.settings.path.duration + 'ms</span></div>';
      }
    },

    updateStatus() {
      const el = document.getElementById('jr-status');
      if (!el) return;
      el.textContent = 'Locked: ' + this.lockedCount + ' / ' + this.totalCount;
      el.classList.toggle('warn', this.lockedCount < 2);
    },

    // Journey presets — whole-config overrides applied in one tap.
    JOURNEY_PRESETS: {
      gentle:    { traveller: { shape: 'sphere', color: '#4ade80', scale: 0.8 }, path: { duration: 3500, easing: 'easeInOut', curve: 'smooth' } },
      energetic: { traveller: { shape: 'diamond', color: '#fbbf24', scale: 1.2 }, path: { duration: 1200, easing: 'easeIn', curve: 'arc' } },
      dramatic:  { traveller: { shape: 'torus', color: '#f87171', scale: 1.5 }, path: { duration: 4000, easing: 'fadeInOut', curve: 'smooth' } },
      minimal:   { traveller: { shape: 'cube', color: '#e2e8f0', scale: 0.6 }, path: { duration: 2500, easing: 'linear', curve: 'straight' } },
      cosmic:    { traveller: { shape: 'ring', color: '#a78bfa', scale: 1.0 }, path: { duration: 3000, easing: 'easeInOut', curve: 'arc' } },
      playful:   { traveller: { shape: 'cone', color: '#22d3ee', scale: 1.0 }, path: { duration: 1600, easing: 'peak', curve: 'smooth' } },
    },

    wireUI() {
      const self = this;
      const $$ = id => document.getElementById(id);

      // ─── Modal tab switching ────────────────────────────
      document.querySelectorAll('.jr-modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.jr-modal-tab').forEach(t => t.classList.toggle('active', t === tab));
          document.querySelectorAll('.jr-modal-body .sec').forEach(s => s.classList.toggle('active', s.dataset.sec === tab.dataset.sec));
        });
      });

      // ─── Floating button bar ────────────────────────────
      const refreshBtns = () => {
        $$('jr-btn-paths').classList.toggle('off', !self.settings.pathsVisible);
        $$('jr-btn-anchors').classList.toggle('off', !self.settings.anchorsVisible);
      };
      $$('jr-btn-paths').addEventListener('click', () => {
        self.settings.pathsVisible = !self.settings.pathsVisible;
        $$('jr-m-show-paths').checked = self.settings.pathsVisible;
        self.rebuildPaths(); refreshBtns();
      });
      $$('jr-btn-anchors').addEventListener('click', () => {
        self.settings.anchorsVisible = !self.settings.anchorsVisible;
        $$('jr-m-show-anchors').checked = self.settings.anchorsVisible;
        for (const a of self.anchors) if (a.billboard) a.billboard.visible = self.settings.anchorsVisible;
        refreshBtns();
      });
      $$('jr-btn-calibrate').addEventListener('click', () => {
        for (const a of self.anchors) { a.locked = false; a.worldPos = null; a.billboard = null; }
        self.lockedCount = 0;
        self.rebuildAnchors(); self.rebuildPaths(); self.updateStatus();
      });
      // ─── In-app spatial editor (replaces modal on mobile) ──
      // On mobile (< 768px), the ⚙ button opens the full-screen
      // spatial-mobile editor iframe. On desktop, it opens the
      // traditional settings modal. The editor receives the current
      // project data and posts changes back for live updates.
      const isMobileDevice = window.innerWidth < 768 || 'ontouchstart' in window;
      const editorOverlay = $$('jr-editor-overlay');
      const editorIframe = $$('jr-editor-iframe');
      const editorClose = $$('jr-editor-close');

      if (isMobileDevice && editorOverlay && editorIframe) {
        // Determine the editor URL — relative to the player
        const editorUrl = (window.AR_BASE_URL || window.location.origin) + '/spatial/spatial-mobile.html';

        $$('jr-btn-settings').addEventListener('click', () => {
          editorOverlay.classList.add('open');
          if (!editorIframe.src || !editorIframe.src.includes('spatial-mobile')) {
            editorIframe.src = editorUrl;
          }
        });

        if (editorClose) {
          editorClose.addEventListener('click', () => {
            editorOverlay.classList.remove('open');
          });
        }

        // Listen for the editor's ready signal, then send project data
        window.addEventListener('message', (ev) => {
          const d = ev.data;
          if (!d || typeof d !== 'object') return;

          if (d.type === '4e-spatial-ready' && editorIframe.contentWindow) {
            // Send the current project state to the editor
            const _A = window.APP || {};
            editorIframe.contentWindow.postMessage({
              type: '4e-spatial-project',
              project: {
                id: _A.id || null,
                name: _A.name || '',
                trackingMode: 'image',
                targets: (_A.targets || []).map(t => ({
                  id: t.id, name: t.name || '',
                  widthM: t.properties?.widthM || 0.1,
                  thumbnailUrl: t.thumbnailUrl || t.luminanceUrl || '',
                })),
                objects: [],
                journey: _A.journey || null,
              }
            }, '*');
            console.log('[journey-runtime] sent project to in-app editor');
          }

          // Receive updated journey from the editor
          if (d.type === '4e-spatial-journey' && d.journey) {
            console.log('[journey-runtime] received journey update from in-app editor');
            const j = d.journey;
            // Update the live runtime settings from the journey
            if (j.globalTraveller) {
              Object.assign(self.settings.traveller, {
                shape: j.globalTraveller.type || self.settings.traveller.shape,
                color: j.globalTraveller.color || self.settings.traveller.color,
                scale: j.globalTraveller.scale || self.settings.traveller.scale,
              });
              self.rebuildTraveller();
            }
            // Store updated journey on APP for persistence
            if (window.APP) {
              window.APP.journey = j;
              window.APP.journeys = [j];
            }
            // Persist to Firestore so the change is global (visible
            // in the studio on next load, and on any other device).
            const appId = window.APP && window.APP.id;
            if (appId && typeof firebase !== 'undefined' && firebase.firestore) {
              try {
                const db = firebase.firestore();
                db.collection('ar_apps').doc(appId).update({
                  journeys: [j],
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                  console.log('[journey-runtime] journey saved to Firestore ✓');
                }).catch(err => {
                  console.warn('[journey-runtime] Firestore save failed:', err.message);
                });
              } catch (e) {
                console.warn('[journey-runtime] Firestore save error:', e.message);
              }
            }
          }
        });
      } else {
        // Desktop: use the traditional settings modal
        $$('jr-btn-settings').addEventListener('click', () => $$('jr-modal').classList.remove('hidden'));
      }
      $$('jr-m-close').addEventListener('click', () => $$('jr-modal').classList.add('hidden'));

      // ─── Chip grid helper ───────────────────────────────
      function chipGrid(containerId, getValue, setValue, rebuild) {
        const container = $$(containerId);
        if (!container) return;
        container.querySelectorAll('.jr-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.v === getValue());
          c.addEventListener('click', () => {
            container.querySelectorAll('.jr-chip').forEach(x => x.classList.remove('active'));
            c.classList.add('active');
            setValue(c.dataset.v);
            if (rebuild) rebuild();
          });
        });
      }

      // ─── Traveller tab — type toggle ─────────────────────
      self.settings.traveller.type = self.settings.traveller.type || 'object';
      chipGrid('jr-m-tv-type', () => self.settings.traveller.type, v => {
        self.settings.traveller.type = v;
        $$('jr-m-obj-settings').style.display = v === 'object' ? 'block' : 'none';
        $$('jr-m-particle-settings').style.display = v === 'particles' ? 'block' : 'none';
        self.rebuildTraveller();
      }, null);
      $$('jr-m-obj-settings').style.display = self.settings.traveller.type === 'object' ? 'block' : 'none';
      $$('jr-m-particle-settings').style.display = self.settings.traveller.type === 'particles' ? 'block' : 'none';

      // Particle preset buttons
      function applyParticleCfg(cfg) {
        self._particleCfg = { ...DEF_P, ...cfg };
        self.rebuildTraveller();
        syncParticleUI();
      }
      function syncParticleUI() {
        const c = self._particleCfg;
        $$('jr-p-count').value = c.count; $$('jr-p-count-v').textContent = c.count;
        $$('jr-p-rate').value = c.emissionRate; $$('jr-p-rate-v').textContent = c.emissionRate;
        $$('jr-p-burst').value = c.burstCount || 0; $$('jr-p-burst-v').textContent = c.burstCount || 0;
        $$('jr-p-continuous').checked = c.continuousEmit !== false;
        $$('jr-p-life-min').value = c.lifetimeMin; $$('jr-p-life-max').value = c.lifetimeMax;
        $$('jr-p-life-v').textContent = c.lifetimeMin.toFixed(1) + ' – ' + c.lifetimeMax.toFixed(1) + 's';
        $$('jr-p-speed-min').value = c.speedMin; $$('jr-p-speed-max').value = c.speedMax;
        $$('jr-p-speed-v').textContent = c.speedMin.toFixed(1) + ' – ' + c.speedMax.toFixed(1);
        $$('jr-p-spread').value = c.spread; $$('jr-p-spread-v').textContent = c.spread + '°';
        $$('jr-p-spread3d').checked = c.spread3D !== false;
        $$('jr-p-angle').value = c.emitAngle || 30; $$('jr-p-angle-v').textContent = (c.emitAngle || 30) + '°';
        $$('jr-p-size-start').value = c.sizeStart; $$('jr-p-size-end').value = c.sizeEnd;
        $$('jr-p-size-v').textContent = c.sizeStart.toFixed(2) + ' → ' + c.sizeEnd.toFixed(2);
        chipGrid('jr-p-size-curve', () => c.sizeCurve || 'linear', v => { self._particleCfg.sizeCurve = v; applyParticleCfg(self._particleCfg); }, null);
        $$('jr-p-color-start').value = c.colorStart;
        $$('jr-p-color-end').value = c.colorEnd;
        $$('jr-p-color-mid-toggle').checked = !!c.colorMid;
        $$('jr-p-color-mid-row').style.display = c.colorMid ? 'block' : 'none';
        if (c.colorMid) $$('jr-p-color-mid').value = c.colorMid;
        $$('jr-p-opacity-start').value = c.opacityStart; $$('jr-p-opacity-end').value = c.opacityEnd;
        $$('jr-p-opacity-v').textContent = c.opacityStart.toFixed(1) + ' → ' + c.opacityEnd.toFixed(1);
        chipGrid('jr-p-opacity-curve', () => c.opacityCurve || 'linear', v => { self._particleCfg.opacityCurve = v; applyParticleCfg(self._particleCfg); }, null);
        $$('jr-p-turb').value = c.turbulence; $$('jr-p-turb-v').textContent = c.turbulence.toFixed(1);
        $$('jr-p-turb-freq').value = c.turbulenceFreq || 1; $$('jr-p-turb-freq-v').textContent = (c.turbulenceFreq || 1).toFixed(1);
        $$('jr-p-turb-speed').value = c.turbulenceSpeed || 1; $$('jr-p-turb-speed-v').textContent = (c.turbulenceSpeed || 1).toFixed(1);
        $$('jr-p-gravity').value = c.gravity || 0; $$('jr-p-gravity-v').textContent = (c.gravity || 0).toFixed(1);
        $$('jr-p-drag').value = c.drag; $$('jr-p-drag-v').textContent = c.drag.toFixed(3);
        $$('jr-p-swirl').value = c.swirl || 0; $$('jr-p-swirl-v').textContent = (c.swirl || 0).toFixed(1);
        $$('jr-p-attract').value = c.attract || 0; $$('jr-p-attract-v').textContent = (c.attract || 0).toFixed(1);
        $$('jr-p-radius').value = c.emitRadius; $$('jr-p-radius-v').textContent = c.emitRadius.toFixed(2);
        chipGrid('jr-p-emit-shape', () => c.emitShape, v => { self._particleCfg.emitShape = v; applyParticleCfg(self._particleCfg); }, null);
        chipGrid('jr-p-blending', () => c.blending || 'additive', v => { self._particleCfg.blending = v; applyParticleCfg(self._particleCfg); }, null);
      }
      document.querySelectorAll('#jr-m-particle-pick .jr-preset').forEach(p => {
        p.addEventListener('click', () => {
          const key = p.dataset.preset;
          const preset = typeof PPRESETS !== 'undefined' && PPRESETS[key];
          if (!preset) return;
          document.querySelectorAll('#jr-m-particle-pick .jr-preset').forEach(x => x.classList.remove('active'));
          p.classList.add('active');
          applyParticleCfg(preset.c);
        });
      });
      // Per-parameter sliders — update cfg and rebuild on change
      const pSlider = (id, field, parse, fmtId, fmt) => {
        const el = $$(id);
        if (!el) return;
        el.addEventListener('input', () => {
          self._particleCfg[field] = parse(el.value);
          if (fmtId) $$(fmtId).textContent = fmt ? fmt(self._particleCfg) : el.value;
          applyParticleCfg(self._particleCfg);
        });
      };
      pSlider('jr-p-count', 'count', Number, 'jr-p-count-v');
      pSlider('jr-p-rate', 'emissionRate', Number, 'jr-p-rate-v');
      pSlider('jr-p-life-min', 'lifetimeMin', Number, 'jr-p-life-v', c => c.lifetimeMin.toFixed(1)+' – '+c.lifetimeMax.toFixed(1)+'s');
      pSlider('jr-p-life-max', 'lifetimeMax', Number, 'jr-p-life-v', c => c.lifetimeMin.toFixed(1)+' – '+c.lifetimeMax.toFixed(1)+'s');
      pSlider('jr-p-speed-min', 'speedMin', Number, 'jr-p-speed-v', c => c.speedMin.toFixed(1)+' – '+c.speedMax.toFixed(1));
      pSlider('jr-p-speed-max', 'speedMax', Number, 'jr-p-speed-v', c => c.speedMin.toFixed(1)+' – '+c.speedMax.toFixed(1));
      pSlider('jr-p-spread', 'spread', Number, 'jr-p-spread-v', c => c.spread+'°');
      pSlider('jr-p-size-start', 'sizeStart', Number, 'jr-p-size-v', c => c.sizeStart.toFixed(2)+' → '+c.sizeEnd.toFixed(2));
      pSlider('jr-p-size-end', 'sizeEnd', Number, 'jr-p-size-v', c => c.sizeStart.toFixed(2)+' → '+c.sizeEnd.toFixed(2));
      $$('jr-p-color-start').addEventListener('input', e => { self._particleCfg.colorStart = e.target.value; applyParticleCfg(self._particleCfg); });
      $$('jr-p-color-end').addEventListener('input', e => { self._particleCfg.colorEnd = e.target.value; applyParticleCfg(self._particleCfg); });
      pSlider('jr-p-opacity-start', 'opacityStart', Number, 'jr-p-opacity-v', c => c.opacityStart.toFixed(1)+' → '+c.opacityEnd.toFixed(1));
      pSlider('jr-p-opacity-end', 'opacityEnd', Number, 'jr-p-opacity-v', c => c.opacityStart.toFixed(1)+' → '+c.opacityEnd.toFixed(1));
      pSlider('jr-p-burst', 'burstCount', Number, 'jr-p-burst-v');
      $$('jr-p-continuous').addEventListener('change', e => { self._particleCfg.continuousEmit = e.target.checked; applyParticleCfg(self._particleCfg); });
      pSlider('jr-p-angle', 'emitAngle', Number, 'jr-p-angle-v', c => (c.emitAngle||30)+'°');
      $$('jr-p-spread3d').addEventListener('change', e => { self._particleCfg.spread3D = e.target.checked; applyParticleCfg(self._particleCfg); });
      $$('jr-p-color-mid-toggle').addEventListener('change', e => {
        self._particleCfg.colorMid = e.target.checked ? ($$('jr-p-color-mid').value || '#ff8800') : null;
        $$('jr-p-color-mid-row').style.display = e.target.checked ? 'block' : 'none';
        applyParticleCfg(self._particleCfg);
      });
      $$('jr-p-color-mid').addEventListener('input', e => { self._particleCfg.colorMid = e.target.value; applyParticleCfg(self._particleCfg); });
      pSlider('jr-p-turb', 'turbulence', Number, 'jr-p-turb-v', c => c.turbulence.toFixed(1));
      pSlider('jr-p-turb-freq', 'turbulenceFreq', Number, 'jr-p-turb-freq-v', c => (c.turbulenceFreq||1).toFixed(1));
      pSlider('jr-p-turb-speed', 'turbulenceSpeed', Number, 'jr-p-turb-speed-v', c => (c.turbulenceSpeed||1).toFixed(1));
      pSlider('jr-p-gravity', 'gravity', Number, 'jr-p-gravity-v', c => (c.gravity||0).toFixed(1));
      pSlider('jr-p-drag', 'drag', Number, 'jr-p-drag-v', c => c.drag.toFixed(3));
      pSlider('jr-p-swirl', 'swirl', Number, 'jr-p-swirl-v', c => (c.swirl||0).toFixed(1));
      pSlider('jr-p-attract', 'attract', Number, 'jr-p-attract-v', c => (c.attract||0).toFixed(1));
      pSlider('jr-p-radius', 'emitRadius', Number, 'jr-p-radius-v', c => c.emitRadius.toFixed(2));
      syncParticleUI();

      // ─── Traveller tab — object controls ─────────────────
      chipGrid('jr-m-shapes', () => self.settings.traveller.shape, v => { self.settings.traveller.shape = v; }, () => self.rebuildTraveller());
      $$('jr-m-color').value = self.settings.traveller.color;
      $$('jr-m-color').addEventListener('input', e => { self.settings.traveller.color = e.target.value; self.rebuildTraveller(); });
      $$('jr-m-scale').value = self.settings.traveller.scale;
      $$('jr-m-scale-v').textContent = self.settings.traveller.scale.toFixed(1) + '×';
      $$('jr-m-scale').addEventListener('input', e => {
        self.settings.traveller.scale = parseFloat(e.target.value);
        $$('jr-m-scale-v').textContent = (+e.target.value).toFixed(1) + '×';
        self.rebuildTraveller();
      });
      // Trail
      const gtv = self.journey.globalTraveller || {};
      self.settings.trail = gtv.trail !== false;
      self.settings.trailLen = gtv.trailLen || 45;
      $$('jr-m-trail').checked = self.settings.trail;
      $$('jr-m-trail-len').value = self.settings.trailLen;
      $$('jr-m-trail-len-v').textContent = self.settings.trailLen;
      $$('jr-m-trail').addEventListener('change', e => { self.settings.trail = e.target.checked; });
      $$('jr-m-trail-len').addEventListener('input', e => { self.settings.trailLen = parseInt(e.target.value); $$('jr-m-trail-len-v').textContent = e.target.value; });

      // ─── Path tab ──────────────────────────────────────
      $$('jr-m-dur').value = self.settings.path.duration;
      $$('jr-m-dur-v').textContent = self.settings.path.duration + 'ms';
      $$('jr-m-dur').addEventListener('input', e => {
        self.settings.path.duration = parseInt(e.target.value);
        $$('jr-m-dur-v').textContent = e.target.value + 'ms';
      });
      chipGrid('jr-m-easings', () => self.settings.path.easing, v => { self.settings.path.easing = v; }, null);
      // Curve shape
      self.settings.path.curve = self.settings.path.curve || 'smooth';
      chipGrid('jr-m-curves', () => self.settings.path.curve, v => { self.settings.path.curve = v; self.rebuildPaths(); }, null);
      // Loop toggle
      $$('jr-m-loop').checked = !!self.journey.loop;
      $$('jr-m-loop').addEventListener('change', e => {
        self.journey.loop = e.target.checked;
        self.rebuildPaths();
      });

      // ─── Display tab ───────────────────────────────────
      $$('jr-m-show-paths').checked = self.settings.pathsVisible;
      $$('jr-m-show-anchors').checked = self.settings.anchorsVisible;
      self.settings.travellerVisible = true;
      $$('jr-m-show-traveller').checked = true;
      $$('jr-m-show-paths').addEventListener('change', e => {
        self.settings.pathsVisible = e.target.checked;
        self.rebuildPaths(); refreshBtns();
      });
      $$('jr-m-show-anchors').addEventListener('change', e => {
        self.settings.anchorsVisible = e.target.checked;
        for (const a of self.anchors) if (a.billboard) a.billboard.visible = e.target.checked;
        refreshBtns();
      });
      $$('jr-m-show-traveller').addEventListener('change', e => {
        self.settings.travellerVisible = e.target.checked;
        self.travContainer.visible = e.target.checked;
      });
      $$('jr-m-debug').checked = document.getElementById('jr-debug').classList.contains('show');
      $$('jr-m-debug').addEventListener('change', e => {
        document.getElementById('jr-debug').classList.toggle('show', e.target.checked);
      });

      // ─── Presets tab ───────────────────────────────────
      document.querySelectorAll('#jr-m-journey-presets .jr-preset').forEach(p => {
        p.addEventListener('click', () => {
          const key = p.dataset.preset;
          const preset = self.JOURNEY_PRESETS[key];
          if (!preset) return;
          // Apply preset values
          Object.assign(self.settings.traveller, preset.traveller);
          Object.assign(self.settings.path, preset.path);
          self.rebuildTraveller();
          self.rebuildPaths();
          // Sync UI to new values
          $$('jr-m-color').value = self.settings.traveller.color;
          $$('jr-m-scale').value = self.settings.traveller.scale;
          $$('jr-m-scale-v').textContent = self.settings.traveller.scale.toFixed(1) + '×';
          $$('jr-m-dur').value = self.settings.path.duration;
          $$('jr-m-dur-v').textContent = self.settings.path.duration + 'ms';
          chipGrid('jr-m-shapes', () => self.settings.traveller.shape, v => { self.settings.traveller.shape = v; }, () => self.rebuildTraveller());
          chipGrid('jr-m-easings', () => self.settings.path.easing, v => { self.settings.path.easing = v; }, null);
          chipGrid('jr-m-curves', () => self.settings.path.curve, v => { self.settings.path.curve = v; self.rebuildPaths(); }, null);
          // Flash the active preset
          document.querySelectorAll('#jr-m-journey-presets .jr-preset').forEach(x => x.classList.remove('active'));
          p.classList.add('active');
        });
      });

      refreshBtns();
    },
  });


})(); // end IIFE
