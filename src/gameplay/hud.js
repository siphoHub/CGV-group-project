// HUD System for Mutation Detective Horror Game (three.js DOM overlay, parchment objectives)
export class HUD {
  constructor() {
    // --- Objectives ---
    this.objectives = [
      { id: 1, text: "Turn on the power", completed: false },
      { id: 2, text: "Find the Flashlight", completed: false },
      { id: 3, text: "Enter the elevator", completed: false },
    ];

    // --- Flashlight smooth % ---
    this.flashlightEnergy = 100;                         // 0–100%
    this.flashlightDrainTotalMs = 5 * 60 * 1000;         // 5 min for 0→100%
    this.isFlashlightOn = false;
    this.hasFlashlight = false;

    // --- Discrete battery bars (10) ---
    this.maxBatteryLife = 10;
    this.batteryLife = 10;                               // bars remaining
    this.batteryDrainTime = 300000;                      // 5 min total
    this.batteryDrainRate = this.maxBatteryLife / this.batteryDrainTime; // bars/ms
    this._barAccum = 0;                                  // ms accumulator for bar steps

    // timers
    this._lastTS = performance.now();

    // --- Pause state ---
    this.isPaused = false;

    this.createHudElements();
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  // ---------------- UI ----------------
  createHudElements() {
    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'game-hud';
    this.hudContainer.innerHTML = `
      <div id="objectives-panel" class="parchment">
        <div class="parchment-inner">
          <h3>OBJECTIVES</h3>
          <ul id="objectives-list"></ul>
        </div>
      </div>

      <div id="battery-life-panel" class="hidden">
        <h4>FLASHLIGHT</h4>
        <div id="battery-bars-container"><div id="battery-bars"></div></div>
        <div id="battery-time-remaining">Time: 5:00</div>
        <div id="flashlight-status">Press F to toggle</div>
      </div>

      <div id="inventory-panel">
        <h4>INVENTORY</h4>
        <div id="inventory-items">
          <div id="flashlight-item" class="inventory-item hidden">
            <img src="/models/assets/FlashlightIcon.jpg"
                 alt="Flashlight" class="inventory-icon flashlight-image">
            <span class="inventory-label">Flashlight</span>
          </div>
          <div id="battery-item" class="inventory-item hidden">
            <div class="inventory-icon battery-icon">
              <pre>╔══╤══╗
║▓▓│▓▓║
╚══╧══╝</pre>
            </div>
            <span class="inventory-label">Batteries</span>
          </div>
          <div id="keycard-item" class="inventory-item hidden">
            <img src="/models/assets/KeycardIcon.png"
                 alt="Keycard" class="inventory-icon keycard-image">
            <span class="inventory-label">Keycard</span>
          </div>
        </div>
      </div>

      <div id="game-messages" class="hidden"><div id="message-text"></div></div>

      <div id="pause-menu" class="hidden">
        <div id="pause-content">
          <h2>GAME PAUSED</h2>

          <div id="pause-sections">
            <div id="controls-section">
              <h3>CONTROLS</h3>
              <div class="control-list">
                <div class="control-item"><span class="key">W A S D</span> - Move</div>
                <div class="control-item"><span class="key">Mouse</span> - Look around</div>
                <div class="control-item"><span class="key">E</span> - Interact</div>
                <div class="control-item"><span class="key">F</span> - Toggle flashlight</div>
                <div class="control-item"><span class="key">C</span> - Crouch</div>
                <div class="control-item"><span class="key">M</span> - Toggle music</div>
                <div class="control-item"><span class="key">P</span> - Pause/Resume game</div>
              </div>
            </div>

            <div id="pause-objectives-section">
              <h3>OBJECTIVES</h3>
              <ul id="pause-objectives-list"></ul>
            </div>
          </div>

          <div id="pause-footer">
            <button id="resume-button">▶️ RESUME GAME</button>
            <button id="pause-exit-button">⏻ EXIT GAME</button>
          </div>
        </div>
      </div>
    `;

    this.addStyles();
    document.body.appendChild(this.hudContainer);

    this.updateObjectivesDisplay();
    this.createBatteryBars();
    this.updateBatteryDisplay();
    this.setupPauseEventListeners();
  }

  addStyles() {
    // Remove any old HUD styles once (hot reload safety)
    const old = document.getElementById('hud-theme-styles');
    if (old) old.remove();

    const styles = document.createElement('style');
    styles.id = 'hud-theme-styles';
    styles.textContent = `
      :root{
        --hud-green:#7CFF7A;
        --hud-amber:#FFC84A;
        --hud-cyan:#94FFEC;
        --hud-red:#FF3131;
        --hud-fg:#e9f1ee;
        --hud-dim:#a4b0b5;
        --hud-bg:#050507;
        --hud-panel:#0b0d11;
        --hud-border:#1b1f26;
        --hud-shadow:0 18px 60px rgba(0,0,0,.55);
      }

      /* GLOBAL LAYER */
      #game-hud{
        position:fixed; inset:0; width:100%; height:100%;
        pointer-events:none; z-index:1000;
        color:var(--hud-fg);
        font-family:"IBM Plex Mono","Courier New",monospace;
        letter-spacing:.03em;
      }
      /* scanline + vignette for whole HUD */
      #game-hud::before{
        content:""; position:absolute; inset:0; pointer-events:none;
        background:
          radial-gradient(120% 120% at 50% 50%, transparent 60%, rgba(0,0,0,.9) 100%),
          repeating-linear-gradient(180deg, rgba(255,255,255,.03) 0 2px, transparent 2px 4px);
        mix-blend-mode: overlay; opacity:.2;
        animation: hudFlicker 1.8s infinite;
      }
      @keyframes hudFlicker { 0%,100%{opacity:.18} 50%{opacity:.27} }

      /* ===== OBJECTIVES (formerly "parchment") ===== */
      #objectives-panel.parchment{
        position:absolute; top:20px; left:20px;
        width:min(380px, 34vw); min-height:180px;
        background: linear-gradient(180deg, rgba(255,255,255,.04), transparent 22%) , var(--hud-panel);
        border:1px solid var(--hud-border);
        border-radius:12px;
        box-shadow: var(--hud-shadow), inset 0 0 0 1px rgba(255,255,255,.02);
        transform: none; /* override old tilt */
        filter:none;     /* override old drop-shadow line */
        pointer-events:none;
      }
      .parchment-inner{
        position:relative; inset:auto; padding:16px 18px 14px 18px;
        display:flex; flex-direction:column; gap:6px;
      }
      .parchment-inner::before{
        content:"CLASS-Δ OBJECTIVES";
        display:block; padding:6px 10px; margin:-4px 0 8px 0;
        font-size:.82rem; font-weight:900; letter-spacing:.18em;
        color:#121314; text-transform:uppercase;
        background: linear-gradient(90deg, var(--hud-amber), #ff8359);
        border-radius:4px; width:max-content; box-shadow:0 0 14px rgba(255,130,60,.25);
      }
      .parchment-inner h3 { display:none; } /* keep DOM but hide */
      .parchment-inner ul{ list-style:none; margin:0; padding:0; display:grid; gap:8px; }
      .parchment-inner li{
        position:relative; padding-left:28px; color:var(--hud-fg); letter-spacing:.06em;
      }
      .parchment-inner li::before{
        content:""; position:absolute; left:0; top:4px; width:14px; height:14px; border-radius:3px;
        border:1px solid rgba(148,255,236,.5);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.02), 0 0 10px rgba(148,255,236,.25);
      }
      .parchment-inner li.completed{
        color:var(--hud-dim); text-decoration:line-through;
      }
      .parchment-inner li.completed::before{
        background:linear-gradient(180deg, var(--hud-green), #3fdc89);
        border-color:transparent;
        box-shadow:0 0 10px rgba(124,255,122,.45);
      }

      /* ===== FLASHLIGHT / BATTERY ===== */
      #battery-life-panel{
        position:absolute; right:20px; top:20px;
        background: linear-gradient(180deg, rgba(255,255,255,.04), transparent 22%) , var(--hud-panel);
        border:1px solid var(--hud-border);
        border-radius:12px; padding:14px;
        min-width:220px; pointer-events:none;
        box-shadow: var(--hud-shadow), inset 0 0 0 1px rgba(255,255,255,.02);
        animation: smallFlicker 4s infinite ease-in-out;
      }
      @keyframes smallFlicker { 0%,92%{opacity:1} 96%{opacity:.86} 100%{opacity:.97} }
      #battery-life-panel h4{
        margin:0 0 10px 0; text-align:center; letter-spacing:.16em; text-transform:uppercase;
        color:var(--hud-cyan); font-weight:900;
        text-shadow:0 0 12px rgba(148,255,236,.35);
      }
      #battery-bars-container{ background:#0f1216; border:1px solid var(--hud-border); border-radius:10px; padding:6px; }
      #battery-bars{ display:grid; grid-template-columns: repeat(10, 1fr); gap:4px; height:20px; }
      .battery-bar{
        background:#1a2128; border-radius:4px; transition: all .25s ease;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.03);
      }
      .battery-bar.active{
        background: linear-gradient(180deg, #19c37d, #0f8a58);
        box-shadow: 0 0 8px rgba(25,195,125,.55);
      }
      .battery-bar.low-energy{
        background: linear-gradient(180deg, #d98a1a, #926100);
        box-shadow: 0 0 8px rgba(255,200,74,.45);
        animation: barPulse 1.6s infinite ease-in-out;
      }
      .battery-bar.critical-energy{
        background: linear-gradient(180deg, #ff3131, #a30c0c);
        box-shadow: 0 0 10px rgba(255,49,49,.65);
        animation: barPulseFast .8s infinite ease-in-out;
      }
      @keyframes barPulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.25)} }
      @keyframes barPulseFast { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.35)} }

      #battery-time-remaining{
        margin-top:8px; text-align:center; color:var(--hud-dim);
        font-weight:700; letter-spacing:.08em;
      }
      #flashlight-status{
        margin-top:6px; text-align:center; color:#768087; font-size:.95rem;
      }
      .flashlight-on #flashlight-status{
        color:var(--hud-cyan); text-shadow:0 0 10px rgba(148,255,236,.35);
        font-weight:900;
      }

      /* ===== INVENTORY ===== */
      #inventory-panel{
        position:absolute; left:20px; bottom:20px; pointer-events:none;
        background: linear-gradient(180deg, rgba(255,255,255,.04), transparent 22%) , var(--hud-panel);
        border:1px solid var(--hud-border);
        border-radius:12px; padding:14px; min-width:220px;
        box-shadow: var(--hud-shadow), inset 0 0 0 1px rgba(255,255,255,.02);
      }
      #inventory-panel h4{
        margin:0 0 10px 0; text-align:center; letter-spacing:.16em; text-transform:uppercase;
        color:var(--hud-amber); font-weight:900;
        text-shadow:0 0 12px rgba(255,200,74,.35);
      }
      #inventory-items{ display:flex; flex-direction:column; gap:8px; }
      .inventory-item{
        display:flex; align-items:center; gap:12px; padding:8px 10px;
        background:#0f1216; border:1px solid var(--hud-border); border-radius:8px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
      }
      .inventory-icon{ width:44px; height:44px; display:grid; place-items:center; }
      .inventory-label{ color:var(--hud-fg); opacity:.8; }

      /* ===== TOAST / GAME MESSAGES ===== */
      #game-messages{
        position:absolute; bottom:22%; left:50%; transform:translateX(-50%);
        pointer-events:none;
      }
      #game-messages #message-text{
        padding:12px 18px; border-radius:10px;
        background: linear-gradient(180deg, rgba(255,255,255,.06), transparent 30%), #0d1411;
        color:var(--hud-fg); border:1px solid rgba(124,255,122,.45);
        text-shadow:0 1px 0 rgba(0,0,0,.9);
        box-shadow:0 16px 40px rgba(0,0,0,.55), 0 0 18px rgba(124,255,122,.25);
        animation: toastIn .18s ease-out;
      }
      @keyframes toastIn { from{ opacity:0; transform:translate(-50%, 8px)} to{opacity:1; transform:translate(-50%,0)} }

      /* ===== PAUSE MENU ===== */
      #pause-menu{
        position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
        background: rgba(0,0,0,.86); backdrop-filter: blur(4px);
        pointer-events:all; z-index:2000;
      }
      #pause-content{
        background: linear-gradient(180deg, rgba(255,255,255,.04), transparent 22%), var(--hud-panel);
        border:1px solid var(--hud-border); border-radius:16px;
        padding:28px; width:min(860px, 92%); max-height:80vh; overflow:auto;
        box-shadow: var(--hud-shadow), inset 0 0 0 1px rgba(255,255,255,.02);
      }
      #pause-content h2{
        margin:0 0 18px 0; text-align:center; font-weight:900; letter-spacing:.2em; color:#fff;
        text-transform:uppercase; text-shadow:0 0 18px rgba(124,255,122,.25);
      }
      #pause-sections{ display:flex; gap:24px; margin:10px 0 14px 0; flex-wrap:wrap; }
      #controls-section, #pause-objectives-section{ flex:1 1 320px; }

      #pause-content h3{
        margin:0 0 10px 0; font-weight:800; letter-spacing:.18em; text-transform:uppercase;
        color:var(--hud-cyan); border-bottom:1px solid var(--hud-border); padding-bottom:8px;
      }
      .control-list{ display:grid; gap:8px; }
      .control-item{ color:var(--hud-fg); opacity:.9; }
      .key{
        background:#0f1418; border:1px solid var(--hud-border); border-radius:6px;
        padding:3px 8px; color:#fff; min-width:64px; text-align:center;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.03);
      }

      #pause-objectives-list{ list-style:none; margin:0; padding:0; display:grid; gap:8px; }
      #pause-objectives-list li{ position:relative; padding-left:26px; color:var(--hud-fg); }
      #pause-objectives-list li::before{
        content:""; position:absolute; left:0; top:4px; width:12px; height:12px; border-radius:3px;
        border:1px solid rgba(148,255,236,.45);
      }
      #pause-objectives-list li.completed{
        color:var(--hud-dim); text-decoration:line-through;
      }
      #pause-objectives-list li.completed::before{
        background:linear-gradient(180deg, var(--hud-green), #3fdc89); border-color:transparent;
      }

      #pause-footer{
        display:flex;
        justify-content:center;
        gap:12px;
        flex-wrap:wrap;
        padding-top:14px;
        border-top:1px solid var(--hud-border);
      }
      #resume-button,
      #pause-exit-button{
        pointer-events:all; cursor:pointer;
        border:1px solid rgba(124,255,122,.45);
        color:var(--hud-fg); font-weight:800; letter-spacing:.14em; text-transform:uppercase;
        padding:10px 16px; border-radius:10px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.03), 0 10px 26px rgba(0,0,0,.5);
        transition: transform .08s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;
      }
      #resume-button{
        background: linear-gradient(180deg, #0ef0951a, #0d1411);
      }
      #pause-exit-button{
        background: linear-gradient(180deg, rgba(255, 49, 49, 0.18), rgba(20, 6, 6, 0.9));
        border-color: rgba(255, 49, 49, 0.55);
      }
      #resume-button:hover,
      #pause-exit-button:hover{ transform: translateY(-1px); box-shadow:0 12px 30px rgba(0,0,0,.55); }
      #resume-button:active,
      #pause-exit-button:active{ transform: translateY(0); }

      /* UTILS */
      .hidden{ display:none !important; }

      /* keep your older energy bar APIs if used elsewhere */
      #energy-bar-container{ display:none; }
    `;
    document.head.appendChild(styles);
  }


  // ---------------- Objectives ----------------
  updateObjectivesDisplay() {
    const ul = document.getElementById('objectives-list');
    ul.innerHTML = '';
    this.objectives.forEach(o => {
      const li = document.createElement('li');
      li.textContent = o.text;
      if (o.completed) li.classList.add('completed');
      ul.appendChild(li);
    });
  }

  // ---------------- Battery Bars ----------------
  createBatteryBars() {
    const c = document.getElementById('battery-bars');
    c.innerHTML = '';
    for (let i = 0; i < this.maxBatteryLife; i++) {
      const bar = document.createElement('div');
      bar.className = 'battery-bar active';
      bar.id = `battery-bar-${i}`;
      c.appendChild(bar);
    }
  }

  updateBatteryDisplay() {
    const activeBars = Math.ceil(this.batteryLife);
    for (let i = 0; i < this.maxBatteryLife; i++) {
      const el = document.getElementById(`battery-bar-${i}`);
      if (!el) continue;
      el.classList.remove('active','low-energy','critical-energy');
      if (i < activeBars) {
        if (this.batteryLife <= 2) el.classList.add('critical-energy');
        else if (this.batteryLife <= 4) el.classList.add('low-energy');
        else el.classList.add('active');
      }
    }
    const timeDisplay = document.getElementById('battery-time-remaining');
    if (timeDisplay) {
      // Calculate remaining time based on current battery life and accumulated drain for smooth countdown
      const barMsPerUnit = this.batteryDrainTime / this.maxBatteryLife;
      const currentBarRemainingMs = Math.max(0, barMsPerUnit - this._barAccum);
      const totalRemainingMs = (this.batteryLife - 1) * barMsPerUnit + currentBarRemainingMs;
      const secs = Math.max(0, totalRemainingMs / 1000);
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60).toString().padStart(2,'0');
      timeDisplay.textContent = `Time: ${m}:${s}`;
      // Brighter color progression for better visibility
      if (this.batteryLife <= 2) {
        timeDisplay.style.color = '#cc4444'; // Brighter red for critical
        timeDisplay.style.textShadow = '0 0 6px rgba(204, 68, 68, 0.6)';
      } else if (this.batteryLife <= 4) {
        timeDisplay.style.color = '#cc7700'; // Brighter orange for low
        timeDisplay.style.textShadow = '0 0 4px rgba(204, 119, 0, 0.4)';
      } else {
        timeDisplay.style.color = '#4a7a4a'; // Brighter green for normal
        timeDisplay.style.textShadow = '0 0 4px rgba(74, 122, 74, 0.4)';
      }
    }
  }

  // ---------------- Flashlight UI ----------------
  _updateFlashlightUI() {
    const panel = document.getElementById('battery-life-panel');
    const status = document.getElementById('flashlight-status');

    if (panel) {
      panel.classList.toggle('flashlight-on', this.isFlashlightOn);
      panel.classList.toggle('flashlight-off', !this.isFlashlightOn);
    }
    if (status) status.textContent = `${this.isFlashlightOn ? 'ON' : 'OFF'} - Press F to toggle`;
  }

  // ---------------- Public actions ----------------
  completeObjective(id) {
    const o = this.objectives.find(x => x.id === id);
    if (o && !o.completed) {
      o.completed = true;
      this.updateObjectivesDisplay();
      this.showMessage(`Objective Complete: ${o.text}`, 3000);
    }
  }

  foundFlashlight() {
    this.hasFlashlight = true;
    this.completeObjective(1);
    document.getElementById('flashlight-item')?.classList.remove('hidden');
    document.getElementById('battery-life-panel')?.classList.remove('hidden');
    this.showMessage('You found the flashlight! Press F to use it.', 3000);
  }

  foundBatteries() {
    this.hasBatteries = true;
    this.completeObjective(2);
    document.getElementById('battery-item')?.classList.remove('hidden');
    this.showMessage('You found batteries! Restored power.', 2500);
    // restore both systems
    this.flashlightEnergy = 100;
    this.batteryLife = this.maxBatteryLife;
    this.updateBatteryDisplay();
    this._updateFlashlightUI();
  }

  foundKeycard() {
    this.hasKeycard = true;
    document.getElementById('keycard-item')?.classList.remove('hidden');
    this.showMessage('You found a keycard! This might open locked doors.', 3000);
  }

  toggleFlashlight() {
    if (!this.hasFlashlight) return false;
    if (this.flashlightEnergy <= 0 || this.batteryLife <= 0) {
      this.showMessage('Flashlight battery is dead! Find batteries.', 1600);
      return false;
    }
    this.isFlashlightOn = !this.isFlashlightOn;
    this._updateFlashlightUI();
    return this.isFlashlightOn;
  }

  // ---------------- Main loop ----------------
  _tick(now) {
    const dtMs = now - this._lastTS;                 // ms
    this._lastTS = now;

    // discrete bars drain (only when flashlight ON)
    if (this.isFlashlightOn && this.batteryLife > 0) {
      this._barAccum += dtMs;
      const barMsPerUnit = this.batteryDrainTime / this.maxBatteryLife; // e.g., 300000/10 = 30000ms per bar
      while (this._barAccum >= barMsPerUnit && this.batteryLife > 0) {
        this._barAccum -= barMsPerUnit;
        this.batteryLife = Math.max(0, this.batteryLife - 1);
        if (this.batteryLife <= 0) {
          this.onBatteryDepleted();
          this.isFlashlightOn = false;
          this._updateFlashlightUI();
        }
      }
      // Update display continuously while flashlight is on for smooth timer countdown
      this.updateBatteryDisplay();
    }

    // smooth % drain (visual nicety, synced to total time)
    if (this.isFlashlightOn && this.flashlightEnergy > 0) {
      const dPct = (dtMs / this.flashlightDrainTotalMs) * 100;
      this.flashlightEnergy = Math.max(0, this.flashlightEnergy - dPct);
      this._updateFlashlightUI();
      if (this.flashlightEnergy <= 0) {
        this.isFlashlightOn = false;
        this.showMessage('Flashlight battery died!', 2000);
        this._updateFlashlightUI();
      }
    }

    requestAnimationFrame(this._tick);
  }

  // ---------------- Misc ----------------
  showMessage(text, duration = 3000) {
    const box = document.getElementById('game-messages');
    const msg = document.getElementById('message-text');
    if (!box || !msg) return;
    msg.textContent = text;
    box.classList.remove('hidden');
    clearTimeout(this._toastTO);
    this._toastTO = setTimeout(() => box.classList.add('hidden'), duration);
  }

  onFlashlightInteraction(){ this.foundFlashlight(); }
  onBatteryInteraction(){ this.foundBatteries(); }

  getFlashlightState() {
    return { hasFlashlight: this.hasFlashlight, isOn: this.isFlashlightOn, energy: this.flashlightEnergy };
  }
  getBatteryState() {
    return {
      currentLife: this.batteryLife,
      maxLife: this.maxBatteryLife,
      percentageRemaining: (this.batteryLife / this.maxBatteryLife) * 100,
      timeRemainingSeconds: (this.batteryLife / this.maxBatteryLife) * (this.batteryDrainTime / 1000)
    };
  }

  setBatteryDrainTime(seconds) {
    this.batteryDrainTime = seconds * 1000;
    this.batteryDrainRate = this.maxBatteryLife / this.batteryDrainTime;
    this._barAccum = 0;
    this.updateBatteryDisplay();
  }

  restoreBatteryLife(amount = this.maxBatteryLife) {
    const oldLife = this.batteryLife;
    this.batteryLife=Math.min(this.maxBatteryLife, this.batteryLife + amount);
    const actualAdd=this.batteryLife - oldLife;

    if(actualAdd >0)
    {
      this._barAccum = 0;
    }

    this.updateBatteryDisplay();
  }

  // --- Pause Menu Methods ---
  setupPauseEventListeners() {
    // Resume button click listener
    const resumeButton = document.getElementById('resume-button');
    if (resumeButton) {
      resumeButton.addEventListener('click', () => {
        this.togglePause();
      });
    }

    const exitButton = document.getElementById('pause-exit-button');
    if (exitButton) {
      exitButton.addEventListener('click', () => {
        if (this.isPaused) {
          this.togglePause();
        }
        window.dispatchEvent(new Event('credits:restart'));
      });
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    const pauseMenu = document.getElementById('pause-menu');

    if (this.isPaused) {
      this.showPauseMenu();
      pauseMenu.classList.remove('hidden');
    } else {
      pauseMenu.classList.add('hidden');
    }

    return this.isPaused;
  }

  showPauseMenu() {
    // Update objectives in pause menu
    this.updatePauseObjectives();
  }

  updatePauseObjectives() {
    const pauseObjectivesList = document.getElementById('pause-objectives-list');
    if (!pauseObjectivesList) return;

    pauseObjectivesList.innerHTML = '';
    this.objectives.forEach(obj => {
      const li = document.createElement('li');
      li.textContent = obj.text;
      if (obj.completed) li.classList.add('completed');
      pauseObjectivesList.appendChild(li);
    });
  }

  getPauseState() {
    return this.isPaused;
  }

  // game over battlety depleted
  onBatteryDepleted() {
    console.log('[HUD] Battery depleted - triggering game over');
    this.showMessage('Battery depleted! Game Over.', 4000);
    window.dispatchEvent(new CustomEvent('battery:depleted'));
  }

  showGameOverScreen() {
    // Check if game over screen already exists
    let gameOverScreen = document.getElementById('game-over-screen');

    if (!gameOverScreen) {
      gameOverScreen = document.createElement('div');
      gameOverScreen.id = 'game-over-screen';
      gameOverScreen.innerHTML = `
        <div id="game-over-content">
          <h1>GAME OVER</h1>
          <p>Your flashlight died...</p>
          <p class="game-over-subtitle">You couldn't survive in the darkness</p>
          <button id="restart-button" onclick="window.location.reload()">TRY AGAIN</button>
        </div>
      `;

      // Add styles for game over screen
      const styles = document.createElement('style');
      styles.textContent = `
        #game-over-screen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(10px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 1s ease-in;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        #game-over-content {
          text-align: center;
          color: #fff;
          max-width: 600px;
          padding: 40px;
        }

        #game-over-content h1 {
          font-size: 4rem;
          margin: 0 0 20px 0;
          color: #cc4444;
          text-shadow: 0 0 20px rgba(204, 68, 68, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.8);
          letter-spacing: 5px;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.02); }
        }

        #game-over-content p {
          font-size: 1.5rem;
          margin: 15px 0;
          color: #ccc;
          font-family: 'Courier New', monospace;
        }

        .game-over-subtitle {
          font-size: 1.2rem !important;
          color: #888 !important;
          font-style: italic;
        }

        #restart-button {
          margin-top: 30px;
          background: linear-gradient(135deg, #cc4444, #994444);
          border: 2px solid #cc4444;
          border-radius: 8px;
          padding: 15px 30px;
          font-size: 1.3rem;
          font-weight: bold;
          color: #fff;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 2px;
          box-shadow: 0 4px 15px rgba(204, 68, 68, 0.4);
        }

        #restart-button:hover {
          background: linear-gradient(135deg, #dd5555, #aa5555);
          border-color: #dd5555;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(204, 68, 68, 0.6);
        }

        #restart-button:active {
          transform: translateY(0);
          box-shadow: 0 3px 10px rgba(204, 68, 68, 0.4);
        }
      `;

      document.head.appendChild(styles);
      document.body.appendChild(gameOverScreen);
    } else {
      gameOverScreen.style.display = 'flex';
    }
  }
}
