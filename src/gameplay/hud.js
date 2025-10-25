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
    const styles = document.createElement('style');
    styles.textContent = `
      #game-hud {
        position: fixed; inset: 0; width: 100%; height: 100%;
        pointer-events: none; z-index: 1000;
        font-family: 'Courier New', monospace; color: #00ff00;
      }

      /* --- parchment objectives --- */
      #objectives-panel.parchment{
        position: absolute; top: 20px; left: 20px;
        width: 360px; height: 240px;              /* keep ratio with your PNG */
        background: url('/models/assets/ObjectivesPage.png') center/contain no-repeat; /* use the PNG with transparent edges */
        filter: drop-shadow(0 6px 16px rgba(0,0,0,0.35));
        transform: rotate(-1.2deg); transform-origin: top left; /* small diegetic tilt */
      }
      .parchment-inner{
        position: absolute; inset: 20px 26px 26px 26px;  /* inner safe area */
        pointer-events: none; display: flex; flex-direction: column;
      }
      .parchment-inner h3{
        margin: 0 0 8px 0; font: 700 18px 'Times New Roman', serif;
        color: #2a1a0d; letter-spacing: 2px; text-align: center; text-transform: uppercase;
        text-shadow: 0 1px 0 rgba(255,255,255,.25);
      }
      .parchment-inner ul{ list-style:none; margin:0; padding:0; }
      .parchment-inner li{
        color:#3a2a1b; font-size:16px; font-weight:bold; line-height:1.35; padding:4px 0; position:relative;
      }
      .parchment-inner li::before{ content:"□ "; color:#3a2a1b; }
      .parchment-inner li.completed{ color:#6b5a45; text-decoration:line-through; opacity:.85; }
      .parchment-inner li.completed::before{ content:"☑ "; }

      /* --- battery panel (combined flashlight functionality) --- */
      #battery-life-panel {
        position: absolute; right: 20px; top: 20px; background: rgba(15, 15, 15, 0.95);
        padding: 12px; border: none; border-radius: 6px;
        backdrop-filter: blur(2px); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4); min-width: 200px;
        animation: horrorFlicker 4s infinite alternate;
        transform: scale(1.0);
        transform-origin: top right;
      }
      #battery-life-panel h4 {
        margin: 0 0 12px 0; color: #bbb; font-size: 16.5px; text-align:center; letter-spacing:1px; text-transform:uppercase;
        text-shadow: 0 0 6px rgba(187, 187, 187, 0.4);
      }
      @keyframes horrorFlicker {
        0%, 90% { opacity: 1; }
        95% { opacity: 0.8; }
        97% { opacity: 1; }
        100% { opacity: 0.9; }
      }
      #battery-bars{ display:flex; gap:3px; height:27px; }
      .battery-bar{
        flex:1; border: none; border-radius:3px; background:#2a2a2a;
        transition: all 0.3s ease;
      }
      .battery-bar.active{
        background: linear-gradient(180deg, #4a7a4a, #336633);
        box-shadow: 0 0 4px rgba(74, 122, 74, 0.6);
      }
      .battery-bar.low-energy{
        background:linear-gradient(180deg, #cc7700, #996600);
        box-shadow:0 0 5px rgba(204, 119, 0, 0.5);
        animation: lowEnergyPulse 2s infinite ease-in-out;
      }
      .battery-bar.critical-energy{
        background:linear-gradient(180deg, #cc4444, #994444);
        animation: criticalPulse 0.8s infinite ease-in-out;
        box-shadow: 0 0 8px rgba(204, 68, 68, 0.7);
      }
      @keyframes criticalPulse{
        0%{opacity:1; transform: scale(1);}
        50%{opacity:0.6; transform: scale(1.02);}
        100%{opacity:1; transform: scale(1);}
      }
      @keyframes lowEnergyPulse{
        0%{opacity:1;}
        50%{opacity:0.75;}
        100%{opacity:1;}
      }
      #battery-time-remaining{
        text-align:center; font-size:18px; color:#bbb;
        text-shadow: 0 0 4px rgba(187, 187, 187, 0.4);
      }

      #energy-bar-container{ display:flex; align-items:center; gap:10px; }
      #energy-bar{
        flex:1; height:16px; background:#2a2a2a; border: none; border-radius:10px; overflow:hidden;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
      }
      #energy-fill{
        height:100%;
        background: linear-gradient(90deg, #cc4444, #cc7700, #4a7a4a);
        width:100%; transition: width .15s linear;
        box-shadow: 0 0 6px rgba(74, 122, 74, 0.4);
      }
      #energy-percentage{ font-size:18px; color:#bbb; min-width:54px; text-align:right; text-shadow: 0 0 4px rgba(187, 187, 187, 0.4); }
      #flashlight-status{ text-align:center; font-size:18px; color:#666; margin-top:9px; }

      /* inventory area styling */
      #inventory-panel{
        position:absolute; left:20px; bottom:20px; pointer-events:none;
        background: rgba(15, 15, 15, 0.9);
        padding: 15px;
        border-radius: 9px;
        min-width: 180px;
      }
      #inventory-panel h4 {
        margin: 0 0 12px 0;
        color: #bbb;
        font-size: 17px;
        text-align: center;
        letter-spacing: 1px;
        text-transform: uppercase;
        text-shadow: 0 0 4px rgba(187, 187, 187, 0.3);
      }
      #inventory-items {
        display: flex;
        flex-direction: column;
        gap: 9px;
      }
      .inventory-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px;
        background: rgba(25, 25, 25, 0.8);
        border-radius: 6px;
      }
      .inventory-icon {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .inventory-icon img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      .inventory-label {
        color: #999;
        font-size: 17px;
        flex: 1;
      }
      .battery-icon {
        color: #666;
        font-size: 8px;
        line-height: 1;
      }
      .hidden { display: none !important; }
      @keyframes horrorPulse{
        0%{opacity:1; filter: brightness(1);}
        50%{opacity:.6; filter: brightness(0.7);}
        100%{opacity:1; filter: brightness(1);}
      }
      .flashlight-on #flashlight-status{
        color:#bbb; font-weight:bold;
        text-shadow: 0 0 4px rgba(187, 187, 187, 0.5);
      }
      .flashlight-off #flashlight-status{ color:#777; }

      /* --- Pause Menu --- */
      #pause-menu {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(5px);
        z-index: 2000;
        pointer-events: all;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #pause-content {
        background: rgba(15, 15, 15, 0.95);
        border: 2px solid #444;
        border-radius: 12px;
        padding: 40px;
        max-width: 800px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      }

      #pause-content h2 {
        text-align: center;
        color: #fff;
        font-size: 2.5rem;
        margin: 0 0 30px 0;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        letter-spacing: 3px;
      }

      #pause-sections {
        display: flex;
        gap: 40px;
        margin-bottom: 30px;
      }

      #controls-section, #pause-objectives-section {
        flex: 1;
      }

      #pause-content h3 {
        color: #bbb;
        font-size: 1.5rem;
        margin: 0 0 15px 0;
        text-transform: uppercase;
        letter-spacing: 2px;
        border-bottom: 2px solid #444;
        padding-bottom: 8px;
      }

      .control-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .control-item {
        color: #ccc;
        font-size: 1.1rem;
        display: flex;
        align-items: center;
        gap: 15px;
      }

      .key {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid #555;
        border-radius: 4px;
        padding: 4px 8px;
        font-weight: bold;
        color: #fff;
        min-width: 60px;
        text-align: center;
        font-size: 0.9rem;
      }

      #pause-objectives-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      #pause-objectives-list li {
        color: #ccc;
        font-size: 1.1rem;
        padding: 8px 0;
        position: relative;
        padding-left: 25px;
      }

      #pause-objectives-list li::before {
        content: "□ ";
        position: absolute;
        left: 0;
        color: #888;
      }

      #pause-objectives-list li.completed {
        color: #888;
        text-decoration: line-through;
      }

      #pause-objectives-list li.completed::before {
        content: "☑ ";
        color: #6a6;
      }

      #pause-footer {
        text-align: center;
        padding-top: 20px;
        border-top: 1px solid #444;
      }

      #resume-button {
        background: linear-gradient(135deg, #4a7c59, #3d6b47);
        border: 2px solid #5a8c69;
        border-radius: 8px;
        padding: 12px 24px;
        font-size: 1.2rem;
        font-weight: bold;
        color: #fff;
        cursor: pointer;
        transition: all 0.3s ease;
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      #resume-button:hover {
        background: linear-gradient(135deg, #5a8c69, #4a7c59);
        border-color: #6a9c79;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
      }

      #resume-button:active {
        transform: translateY(0);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
      }

      #pause-footer p {
        color: #aaa;
        font-size: 1.2rem;
        margin: 0;
      }

      @media (max-width: 768px) {
        #pause-sections {
          flex-direction: column;
          gap: 25px;
        }

        #pause-content {
          padding: 25px;
        }

        #pause-content h2 {
          font-size: 2rem;
        }
      }
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
