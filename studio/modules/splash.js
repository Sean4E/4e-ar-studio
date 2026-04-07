// ═══════════════════════════════════════════════════════════
// 4E AR Studio — Splash Screen Designer
// ═══════════════════════════════════════════════════════════

Studio.Splash = {
  init() {
    Studio.EventBus.on('project:loaded', () => this.render());
    Studio.EventBus.on('project:reset', () => this.render());

    this.render();
    Studio.log('Splash module ready');
  },

  render() {
    const container = document.getElementById('splash-editor-container');
    if (!container) return;

    const splash = Studio.Project.state.splash;

    container.innerHTML = `
      <div style="
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        height:100%; color:var(--muted); font-family:var(--font-mono,'Space Mono',monospace);
        gap:16px; padding:32px; text-align:center;
      ">
        <div style="font-size:40px; opacity:0.4;">🎨</div>
        <div style="font-size:14px; font-weight:600; color:var(--text,#e2e8f0);">Splash Designer</div>
        <div style="font-size:11px; max-width:320px; line-height:1.5; opacity:0.6;">
          Splash screen designer — coming soon.<br>
          Configure the loading screen your users see before the AR experience starts.
        </div>
        <div style="
          margin-top:12px; padding:12px 20px; border:1px solid var(--border,#1e293b);
          border-radius:8px; font-size:10px; opacity:0.4;
        ">
          Current: bg ${splash.bgColor} &middot; accent ${splash.accentColor} &middot; spinner ${splash.showSpinner ? 'on' : 'off'}
        </div>
      </div>
    `;
  }
};
