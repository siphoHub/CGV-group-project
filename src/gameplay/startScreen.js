import { showCreditsOverlay } from "./credits.js";

export class StartScreen {
  constructor() {
    this.root = document.createElement("div");
    this.root.id = "start-screen";
    this.root.innerHTML = `
      <div class="ss-bg"></div>
      <div class="ss-vignette"></div>
      <div class="ss-noise"></div>
      <div class="ss-frame">

        <!-- Top banner -->
        <div class="ss-header">
          <div class="ss-badge">BIOHAZARD</div>
          <div class="ss-title" aria-label="Mutation Detective">
            <span>MUTATION</span><span>DETECTIVE</span>
          </div>
          <div class="ss-sub">RESTRICTED FACILITY // CLASS-Δ ANOMALY</div>
        </div>

        <!-- Center CTA -->
        <div class="ss-cta">
          <button id="start-button" class="ss-btn ss-btn-primary" aria-label="Start Game">
            <span class="pulse">▶</span> START
          </button>

          <div class="ss-actions">
            <button id="controls-button" class="ss-btn ss-btn-hollow" aria-expanded="false" aria-controls="controls-panel">
              CONTROLS
            </button>
            <button id="credits-button" class="ss-btn ss-btn-hollow">
              CREDITS
            </button>
          </div>

          <div class="ss-tip">Headphones recommended. Flickering lights reported in all sectors.</div>
        </div>

        <!-- Bottom info -->
        <div class="ss-footer">
          <div class="ss-objective">
            <div class="dot"></div>
            <div class="text">OBJECTIVE: Restore power, secure gear, reach elevator. Do not engage specimens.</div>
          </div>
          <div class="ss-marquee" aria-hidden="true">
            <div class="track">
              <span>SECURITY BREACH // CONTAINMENT FAILURE // UNKNOWN MUTAGENIC VECTOR DETECTED // </span>
              <span>SECURITY BREACH // CONTAINMENT FAILURE // UNKNOWN MUTAGENIC VECTOR DETECTED // </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Controls Panel (toggle) -->
      <div id="controls-panel" class="ss-panel" hidden>
        <div class="panel-inner">
          <div class="panel-title">CONTROL SCHEMA</div>
          <div class="grid">
            <div class="row"><span class="key">W A S D</span><span>Move</span></div>
            <div class="row"><span class="key">Mouse</span><span>Look around</span></div>
            <div class="row"><span class="key">E</span><span>Interact / Use</span></div>
            <div class="row"><span class="key">F</span><span>Toggle Flashlight</span></div>
            <div class="row"><span class="key">C</span><span>Crouch</span></div>
            <div class="row"><span class="key">P</span><span>Pause</span></div>
            <div class="row"><span class="key">M</span><span>Toggle Music</span></div>
          </div>
          <button id="controls-close" class="ss-btn ss-btn-primary small" aria-label="Close Controls">CLOSE</button>
        </div>
      </div>
    `;

    this.injectStyles();
    document.body.appendChild(this.root);

    // Required existing start button
    this.startButton = this.root.querySelector("#start-button");

    // New UI hooks
    this.controlsBtn = this.root.querySelector("#controls-button");
    this.creditsBtn  = this.root.querySelector("#credits-button");
    this.controlsPanel = this.root.querySelector("#controls-panel");
    this.controlsClose = this.root.querySelector("#controls-close");

    // State/promise
    this._resolve = null;
    this._startPromise = null;
    this.hasStarted = false;

    // Bind handlers
    this.handleStartClick = this.handleStartClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.toggleControls = this.toggleControls.bind(this);
    this.closeControls = this.closeControls.bind(this);
    this.handleCredits = this.handleCredits.bind(this);

    // Wire
    this.startButton.addEventListener("click", this.handleStartClick);
    window.addEventListener("keydown", this.handleKeyDown);
    this.controlsBtn.addEventListener("click", this.toggleControls);
    this.controlsClose.addEventListener("click", this.closeControls);

    this.creditsBtn.addEventListener("click", this.handleCredits);

    this.startButton.focus();
  }

  injectStyles() {
    if (document.getElementById("start-screen-styles")) return;

    const styles = document.createElement("style");
    styles.id = "start-screen-styles";
    styles.textContent = `
      :root {
        --ss-green:#7CFF7A;
        --ss-red:#FF3131;
        --ss-amber:#FFC84A;
        --ss-fg:#d8d8d8;
        --ss-fg-dim:#9aa0a6;
        --ss-bg:#050507;
        --ss-card:#0b0d11;
        --ss-border:#1b1f26;
        --ss-accent:#94ffec;
      }

      #start-screen {
        position: fixed; inset: 0; z-index: 2500;
        background: var(--ss-bg);
        font-family: "IBM Plex Mono", "Courier New", monospace;
        color: var(--ss-fg);
        letter-spacing: .03em;
        display: grid; place-items: center;
        overflow: hidden;
        transition: opacity .35s ease;
      }
      #start-screen.start-hidden { opacity:0; pointer-events:none; }

      /* Background layers */
      .ss-bg {
        position:absolute; inset:0;
        background:
          radial-gradient(1200px 500px at 50% 120%, rgba(148,255,236,.09), transparent 60%),
          radial-gradient(600px 300px at 10% -10%, rgba(255,49,49,.06), transparent 60%),
          radial-gradient(700px 320px at 90% -15%, rgba(124,255,122,.06), transparent 60%),
          #020205;
        filter: saturate(.9) contrast(1.05);
      }
      .ss-vignette {
        position:absolute; inset:0; pointer-events:none;
        background:
          radial-gradient(120% 120% at 50% 50%, transparent 50%, rgba(0,0,0,.75) 100%);
        mix-blend-mode:multiply;
      }
      .ss-noise {
        position:absolute; inset:-50px; opacity:.08; pointer-events:none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E");
        animation: noiseShift 1.8s steps(3) infinite;
      }
      @keyframes noiseShift {
        0% { transform: translate3d(0,0,0); }
        100% { transform: translate3d(-30px,20px,0); }
      }

      .ss-frame {
        position: relative;
        width: min(1000px, 90vw);
        border: 1px solid var(--ss-border);
        background: linear-gradient(180deg, rgba(10,12,15,.85), rgba(7,8,11,.92));
        box-shadow: 0 20px 90px rgba(0,0,0,.65), inset 0 0 0 1px rgba(255,255,255,.03);
        border-radius: 14px;
        padding: clamp(24px, 3vw, 34px);
        overflow: hidden;
      }
      .ss-frame::before{
        content:""; position:absolute; inset:0; pointer-events:none;
        background:
          linear-gradient(0deg, rgba(255,255,255,.06), transparent 30%),
          repeating-linear-gradient(180deg, rgba(255,255,255,.03) 0 2px, transparent 2px 4px);
        mix-blend-mode: overlay; opacity:.25;
      }

      /* Header */
      .ss-header { text-align:center; margin-bottom: clamp(16px, 2.2vw, 22px); }
      .ss-badge {
        display:inline-block; padding:4px 10px; margin-bottom:10px;
        color:#111; background: linear-gradient(90deg, var(--ss-amber), #ff8359);
        font-weight:700; letter-spacing:.2em; font-size:.75rem; border-radius:3px;
        box-shadow: 0 0 14px rgba(255,130,60,.25);
      }
      .ss-title {
        font-weight:900; line-height: .92;
        font-size: clamp(2.2rem, 6vw, 4.4rem);
        letter-spacing:.08em; color:#fff; text-transform: uppercase;
        text-shadow: 0 3px 18px rgba(0,0,0,.7);
        position:relative; display:flex; gap:.15em; justify-content:center;
      }
      .ss-title span:nth-child(1){ color:#fff; }
      .ss-title span:nth-child(2){ color: var(--ss-green); filter: drop-shadow(0 0 6px rgba(124,255,122,.35)); }
      .ss-title::after{
        content:""; position:absolute; left:50%; top:60%;
        width:60%; height:2px; transform: translateX(-50%);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.2), transparent);
        mix-blend-mode: screen;
      }
      .ss-sub {
        margin-top:8px; color: var(--ss-fg-dim);
        letter-spacing:.25em; font-size:.8rem;
      }

      /* CTA */
      .ss-cta { margin: clamp(18px, 3vw, 28px) auto; text-align:center; }
      .ss-actions { display:flex; gap:12px; justify-content:center; margin-top:14px; flex-wrap:wrap; }
      .ss-tip { margin-top: 16px; color: var(--ss-fg-dim); font-size: .95rem; }

      .ss-btn {
        cursor:pointer; user-select:none; border-radius:10px;
        padding: 14px 22px; font-weight:800; letter-spacing:.12em;
        text-transform: uppercase; border:1px solid var(--ss-border);
        background: #0d1216; color:#e9f1ee;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.03), 0 6px 22px rgba(0,0,0,.4);
        transition: transform .08s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;
      }
      .ss-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(0,0,0,.5); }
      .ss-btn:active { transform: translateY(0); }

      .ss-btn-primary {
        background: linear-gradient(180deg, #0ef0951a, #0d1411);
        border-color: rgba(124,255,122,.5);
        text-shadow: 0 0 10px rgba(124,255,122,.2);
      }
      .ss-btn-primary .pulse { display:inline-block; margin-right:8px; animation: pulse 1s infinite; }
      @keyframes pulse {
        0%,100% { opacity:.9; transform: translateY(0); }
        50% { opacity:.35; transform: translateY(-1px); }
      }
      .ss-btn-hollow {
        background: #0b0f12; border-color:#25303a; color:#cfe7e3;
      }
      .ss-btn.small { padding:10px 16px; font-size:.85rem; }

      /* Footer & marquee */
      .ss-footer { margin-top: clamp(18px, 2.6vw, 28px); }
      .ss-objective {
        display:flex; align-items:center; gap:10px; margin-bottom:10px;
        border-left: 3px solid var(--ss-amber); padding-left:10px;
      }
      .ss-objective .dot {
        width:10px; height:10px; border-radius: 50%;
        background: var(--ss-red); box-shadow: 0 0 10px rgba(255,49,49,.8);
        animation: blink 1.4s infinite;
      }
      @keyframes blink { 0%,100%{opacity:.6} 50%{opacity:1} }
      .ss-objective .text { color:#f2f2f2; font-size:1rem; }

      .ss-marquee {
        position:relative; overflow:hidden; height:26px;
        border-top:1px solid var(--ss-border); border-bottom:1px solid var(--ss-border);
        background: linear-gradient(180deg, rgba(255,255,255,.03), transparent);
        mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
      }
      .ss-marquee .track {
        display:inline-block; white-space:nowrap;
        animation: marquee 18s linear infinite;
        color:#8fa3a0; font-size:.85rem; letter-spacing:.2em;
      }
      @keyframes marquee { 0%{ transform: translateX(0)} 100%{ transform: translateX(-50%)} }

      /* Controls panel */
      .ss-panel {
        position: fixed; inset: 0; display:grid; place-items:center;
        background: rgba(0,0,0,.65);
        backdrop-filter: blur(3px);
        z-index: 2600;
        opacity:0; pointer-events:none; transition: opacity .2s ease;
      }
      .ss-panel.show { opacity:1; pointer-events:auto; }
      .panel-inner {
        width: min(720px, 92vw);
        background: linear-gradient(180deg, #0a0f12, #080b0e);
        border:1px solid #273340; border-radius:12px;
        box-shadow: 0 30px 90px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.03);
        padding: 22px 22px 18px;
        transform: translateY(10px); opacity:.96; transition: transform .2s ease;
      }
      .ss-panel.show .panel-inner { transform: translateY(0); }
      .panel-title {
        font-weight:900; letter-spacing:.18em; color:#e9f1ee; text-align:center; margin-bottom:14px;
      }
      .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin-bottom:16px; }
      .row { display:flex; gap:12px; align-items:center; padding:8px 10px; background:#0c1114; border:1px solid #1c232a; border-radius:8px; }
      .key {
        min-width: 82px; text-align:center; padding:4px 8px; border-radius:6px;
        border:1px solid #2b3a43; background: #0f1519; font-weight:800; color:#f8fff7;
      }

      /* Hide attribute support */
      [hidden] { display:none !important; }

      @media (max-width: 620px){
        .grid { grid-template-columns: 1fr; }
      }
    `;

    document.head.appendChild(styles);
  }

  // Promise API stays compatible
  waitForStart() {
    if (this.hasStarted) return Promise.resolve();
    if (this._startPromise) return this._startPromise;
    this._startPromise = new Promise((resolve) => { this._resolve = resolve; });
    return this._startPromise;
  }

  /* ---------- Handlers ---------- */
  handleStartClick() {
    if (this.startButton.disabled || this.hasStarted) return;
    this.hasStarted = true;
    this.startButton.disabled = true;
    this.root.classList.add("start-hidden");
    this.cleanupTimer = window.setTimeout(() => this.destroy(), 400);
    if (this._resolve) this._resolve();
  }

  handleKeyDown(event) {
    // Enter/Space starts; Escape closes Controls panel
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      if (!this.hasStarted && !this.isControlsOpen()) this.handleStartClick();
    } else if (event.code === "Escape") {
      if (this.isControlsOpen()) this.closeControls();
    }
  }

  toggleControls() {
    const open = !this.isControlsOpen();
    this.controlsBtn.setAttribute("aria-expanded", String(open));
    this.controlsPanel.hidden = false;
    requestAnimationFrame(() => {
      this.controlsPanel.classList.toggle("show", open);
      if (!open) {
        // delay hiding to let fade-out finish
        setTimeout(() => { this.controlsPanel.hidden = true; }, 180);
      }
    });
  }

  closeControls() {
    this.controlsBtn.setAttribute("aria-expanded", "false");
    this.controlsPanel.classList.remove("show");
    setTimeout(() => { this.controlsPanel.hidden = true; }, 180);
  }

  isControlsOpen() {
    return this.controlsPanel.classList.contains("show");
  }

  handleCredits() {
    if (this.creditsBtn.disabled) return;
    this.creditsBtn.disabled = true;

    showCreditsOverlay({
      onClose: () => {
        this.creditsBtn.disabled = false;
        if (!this.hasStarted) {
          this.startButton.focus();
        }
      }
    }).finally(() => {
      this.creditsBtn.disabled = false;
    });
  }

  flashBadge(text, ms=1200){
    const tag = document.createElement("div");
    tag.textContent = text;
    tag.style.cssText = `
      position:fixed; top:22px; left:50%; transform:translateX(-50%);
      padding:8px 14px; background: linear-gradient(90deg, #3ef7b2, #9cfbff);
      color:#08110e; border-radius:6px; font-weight:900; letter-spacing:.2em;
      box-shadow:0 0 20px rgba(90,255,200,.35); z-index:3000; opacity:.98;
    `;
    document.body.appendChild(tag);
    setTimeout(() => tag.remove(), ms);
  }

  /* ---------- Life cycle ---------- */
  destroy() {
    this.startButton.removeEventListener("click", this.handleStartClick);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.controlsBtn.removeEventListener("click", this.toggleControls);
    this.controlsClose.removeEventListener("click", this.closeControls);
    this.creditsBtn.removeEventListener("click", this.handleCredits);

    if (this.cleanupTimer) window.clearTimeout(this.cleanupTimer);
    this._resolve = null; this._startPromise = null;

    if (this.root?.parentElement) this.root.parentElement.removeChild(this.root);
  }
}
