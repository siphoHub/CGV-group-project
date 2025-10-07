// Game Controller to manage HUD and game state
import * as THREE from 'three';
import { HUD } from './hud.js';

export class GameController {
  constructor(scene, camera, lights, controls, initialLightingState = 'normal') {
    this.scene = scene;
    this.camera = camera;
    this.hud = new HUD();
    this.lights = lights;
    this.flashlight = lights.flashlight;
    this.controls = controls;

    this.generatorActivated = false;   // Track generator state
    this.powerTurnedOn = false;        // Progressive objectives
    this.flashlightPickedUp = false;   // Progressive objectives
    this._lastDoorT = null;            // Remember last T-door

    // Make sure generator interactable & progressive objectives
    this.initializeProgressiveObjectives();
    this.ensureGeneratorInteractable();

    // Audio
    this.itemPickupSound = new Audio('../public/models/assets/ItemPickupSound.mp3');
    this.itemPickupSound.volume = 0.5;

    this.flashlightSwitchSound = new Audio('../public/models/assets/FlashlightSwitch.mp3');
    this.flashlightSwitchSound.volume = 1;

    this.generatorSound = new Audio('../public/models/assets/GeneratorTurnedOn.mp3');
    this.generatorSound.volume = 1.0;

    this.scaryScreamSound = new Audio('../public/models/assets/ScaryScream.mp3');
    this.scaryScreamSound.volume = 0.7;

    // Lighting
    this.setLightingState(initialLightingState);

    this.setupEventListeners();
  }

  // ---------- helpers ----------
  _isUsableDoor(obj) {
    return !!(obj && obj.parent && obj.userData && obj.userData.isDoor && obj.userData.toggleDoor);
  }

  _nearestDoorRequiringKey(requiredKey, maxDist = 2.2) {
    const list = Array.isArray(window.cachedInteractables) ? window.cachedInteractables : [];
    const cam = this.camera;
    let nearest = null;
    let best = maxDist;

    for (const obj of list) {
      if (!this._isUsableDoor(obj)) continue;
      if ((obj.userData.requiredKey || "E") !== requiredKey) continue;
      const d = cam.position.distanceTo(obj.getWorldPosition(new THREE.Vector3()));
      if (d <= maxDist && d < best) { best = d; nearest = obj; }
    }
    return nearest;
  }

  setupEventListeners() {
    document.addEventListener('keydown', (event) => {
      const paused = this.isPaused();

      // ----- T key: toggle doors that require T -----
      if (event.code === 'KeyT') {
        event.preventDefault();
        if (paused || !this.controls?.isLocked) return;

        let doorT = this._nearestDoorRequiringKey("T", 2.2);
        if (!doorT && this._isUsableDoor(this._lastDoorT)) {
          const d = this.camera.position.distanceTo(this._lastDoorT.getWorldPosition(new THREE.Vector3()));
          if (d <= 3.5) doorT = this._lastDoorT;
        }
        if (doorT?.userData?.toggleDoor) {
          try { doorT.userData.toggleDoor(); } catch (e) { console.warn('[Door-T] toggleDoor error:', e); }
          this._lastDoorT = doorT;
        }
        return;
      }

      // ----- F key flashlight -----
      if (event.code === 'KeyF') {
        event.preventDefault();
        if (paused) return;
        const flashlightState = this.hud.getFlashlightState();
        if (flashlightState.hasFlashlight) {
          const isOn = this.hud.toggleFlashlight();
          this.playFlashlightSwitchSound();
          this.updateFlashlightInScene(isOn);
        }
      }

      // ----- P key pause -----
      if (event.code === 'KeyP') {
        event.preventDefault();
        const isPaused = this.togglePause();
        if (isPaused && this.controls) this.controls.unlock();
      }
    });

    // External generator trigger
    window.addEventListener('generator:triggered', () => {
      this.triggerGenerator();
    });

    // End the level when level3 exit is triggered
    window.addEventListener('level3:exit', () => {
      this.onLevel3ExitReached();
    });
  }

  // Handle object interactions from main.js
  handleInteraction(object) {
    if (!object.userData?.interactable) return;
    // Exit door (level 3)
    if (object.userData?.interactionType === 'exit') {
      // allow both: main calling handleInteraction, or node.userData.onInteract hitting the event
      this.onLevel3ExitReached();
      return;
    }

    switch (object.name) {
      case 'Flash_Light_Body_high':
      case 'Flash_Light_Cover_high':
      case 'Flash_Light_Metal_high': {
        // Only allow pickup if power has been turned on
        if (!this.powerTurnedOn) {
          this.hud.showMessage('The flashlight seems to need power first...', 2000);
          return;
        }
        this.playPickupSound();
        this.hud.onFlashlightInteraction();
        this.removeFlashlightParts();
        this.dimSceneLights(true);
        this.onFlashlightPickedUp();
        setTimeout(() => this.playScaryScream(), 500);
        break;
      }

      case 'AA Battery.001':
        this.hud.onBatteryInteraction();
        this.scene.remove(object);
        break;

      default: {
        // Doors via E or T
        if (object.userData?.toggleDoor && object.userData?.isDoor) {
          const req = object.userData.requiredKey || "E";
          if (req === "E") {
            try { object.userData.toggleDoor(); } catch (e) { console.warn('[Door-E] toggleDoor error:', e); }
          } else { // T
            this.hud?.showMessage?.("Press T to interact", 1200);
            this._lastDoorT = object;
          }
          return;
        }

        // Generator
        if (object.name === "powerpulse1") {
          if (!this.generatorActivated) {
            this.playGeneratorSound();
            this.generatorActivated = true;
            object.userData.interactable = false;

            if (window.refreshInteractableCache) window.refreshInteractableCache();

            // Emergency lighting after 3s
            setTimeout(() => {
              this.setLightingState('emergency');
              this.onPowerTurnedOn();
              console.log(`[Generator] Emergency lights activated after delay: ${object.name}`);
            }, 3000);

            console.log(`[Generator] Generator started, emergency lights in 3s: ${object.name}`);
          }
          return;
        }
        break;
      }
    }
  }

  // Update the actual flashlight in the 3D scene
  updateFlashlightInScene(isOn) {
    const flashlightState = this.hud.getFlashlightState();
    if (!flashlightState.hasFlashlight) return;

    if (isOn && flashlightState.energy > 0) {
      this.flashlight.visible = true;
      this.flashlight.intensity = Math.max(0.1, flashlightState.energy / 100);
    } else {
      this.flashlight.visible = false;
    }
  }

  // Per-frame update
  update() {
    if (this.flashlight) {
      this.flashlight.position.copy(this.camera.position);
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      const targetPos = this.camera.position.clone().add(direction.multiplyScalar(10));
      this.flashlight.target.position.copy(targetPos);

      const flashlightState = this.hud.getFlashlightState();
      this.flashlight.visible = flashlightState.isOn && flashlightState.energy > 0;
      this.flashlight.intensity = Math.max(0.1, flashlightState.energy / 100);

      if (this.lights.updateFlashlightBeam) this.lights.updateFlashlightBeam();
    }
  }

  // Lighting state management
  setLightingState(state) {
    if (!this.lights) return;

    switch (state) {
      case 'normal':
        if (this.lights.hemi) this.lights.hemi.intensity = 0.8;
        if (this.lights.dirLight) this.lights.dirLight.intensity = 1.2;
        if (this.lights.redLights) this.lights.redLights.forEach(l => l.intensity = 0);
        break;

      case 'dark':
        if (this.lights.hemi) this.lights.hemi.intensity = 0;
        if (this.lights.dirLight) this.lights.dirLight.intensity = 0;
        if (this.lights.redLights) this.lights.redLights.forEach(l => l.intensity = 0);
        break;

      case 'emergency':
        if (this.lights.hemi) this.lights.hemi.intensity = 0.1;
        if (this.lights.dirLight) this.lights.dirLight.intensity = 0.2;
        if (this.lights.redLights) this.lights.redLights.forEach(l => l.intensity = 4);
        break;

      case 'flashing':
        this.startRoomFlashing();
        break;
    }
  }

  // Convenience
  dimSceneLights(dim = true) { this.setLightingState(dim ? 'dark' : 'normal'); }

  // --- Flashing light loop ---
  startRoomFlashing() {
    if (!this.lights) return;
    if (this.flashTimeout) clearTimeout(this.flashTimeout);

    const flashOnDuration = 3000;
    const flashOffDuration = 2000;

    const flashCycle = () => {
      // ON
      if (this.lights.hemi) { this.lights.hemi.color.set(0xff0000); this.lights.hemi.intensity = 0.8; }
      if (this.lights.dirLight) { this.lights.dirLight.color.set(0xff0000); this.lights.dirLight.intensity = 1.2; }

      this.flashTimeout = setTimeout(() => {
        // OFF
        if (this.lights.hemi) this.lights.hemi.intensity = 0;
        if (this.lights.dirLight) this.lights.dirLight.intensity = 0;

        // next ON
        this.flashTimeout = setTimeout(flashCycle, flashOffDuration);
      }, flashOnDuration);
    };

    flashCycle();
  }

  stopRoomFlashing() {
    if (this.flashTimeout) {
      clearTimeout(this.flashTimeout);
      this.flashTimeout = null;
    }
    if (this.lights) {
      if (this.lights.hemi) this.lights.hemi.intensity = 0;
      if (this.lights.dirLight) this.lights.dirLight.intensity = 0;
    }
  }

  // Getter for flashlight state
  get hasFlashlight() {
    const flashlightState = this.hud.getFlashlightState();
    return flashlightState.hasFlashlight;
  }

  // Give keycard to player via HUD inventory system
  giveKeycard() {
    this.hud.foundKeycard();
    console.log('[GameController] Keycard added to HUD inventory');
  }

  // Generator trigger (external)
  triggerGenerator() {
    console.log('Generator triggered - switching to emergency lighting');
    const generatorSound = new Audio('../public/models/assets/GeneratorTurnedOn.mp3');
    generatorSound.volume = 0.7;
    generatorSound.play().catch(() => console.log('Generator sound failed to play'));
    this.setLightingState('emergency');
    window.dispatchEvent(new CustomEvent('generator:activated'));
  }

  // Enable interactions
  enableGeneratorInteraction() {
    console.log('[Generator] Looking for generator to enable...');
    let generatorFound = false;
    this.scene.traverse((child) => {
      if (child.name === "powerpulse1") {
        child.userData.interactable = true;
        generatorFound = true;
      }
    });
    if (!generatorFound) console.log('[Generator] WARNING: powerpulse1 not found in scene!');
    if (window.updateInteractableCache) window.updateInteractableCache();
  }

  enableFlashLightInteraction() {
    console.log('[Flashlight] Enabling flashlight pickups...');
    let flashlightFound = false;
    this.scene.traverse((child) => {
      if (child.name === "Flashlight Camping" ||
          child.name === "Flash_Light_Body_high" || 
          child.name === "Flash_Light_Cover_high" || 
          child.name === "Flash_Light_Metal_high" || 
          child.name === "AA Battery.001") {
        child.userData.interactable = true;
        flashlightFound = true;
      }
    });
    if (!flashlightFound) console.log('[Flashlight] WARNING: flashlight parts not found!');
    if (window.updateInteractableCache) window.updateInteractableCache();
  }

  // SFX
  playGeneratorSound() {
    this.generatorSound.currentTime = 0;
    this.generatorSound.play().catch(() => console.log('[Generator] Failed to play generator sound'));
  }
  playScaryScream() {
    this.scaryScreamSound.currentTime = 0;
    this.scaryScreamSound.play().catch(() => console.log('[ScaryScream] Failed to play scream'));
  }
  playPickupSound() {
    this.itemPickupSound.currentTime = 0;
    this.itemPickupSound.play().catch(() => {});
  }
  playFlashlightSwitchSound() {
    this.flashlightSwitchSound.currentTime = 0;
    this.flashlightSwitchSound.play().catch(() => {});
  }

  // Objectives (generic)
  addObjective(text) {
    const newId = this.hud.objectives.length + 1;
    this.hud.objectives.push({ id: newId, text, completed: false });
    this.hud.updateObjectivesDisplay();
    return newId;
  }
  completeObjective(identifier) {
    if (typeof identifier === 'string') {
      const objective = this.hud.objectives.find(obj => obj.text === identifier);
      if (objective) this.hud.completeObjective(objective.id);
    } else {
      this.hud.completeObjective(identifier);
    }
  }

  // Battery management
  setBatteryDrainTime(seconds) { this.hud.setBatteryDrainTime(seconds); }
  getBatteryState() { return this.hud.getBatteryState(); }
  restoreBatteryLife(amount) { this.hud.restoreBatteryLife(amount); }

  // Elevator activation after flashlight
  activateElevator() {
    this.scene.traverse((child) => {
      if (child.name === 'Mesh_0001' && child.userData.interactionType === 'elevator') {
        child.userData.interactable = true;
        console.log('Elevator activated - flashlight obtained!');
      }
    });
  }

  // Remove flashlight parts when picked up
  removeFlashlightParts() {
    const flashlightParts = ['Flash_Light_Body_high', 'Flash_Light_Cover_high', 'Flash_Light_Metal_high'];
    const toRemove = [];
    const auras = [];
    this.scene.traverse((child) => {
      if (flashlightParts.includes(child.name)) {
        toRemove.push(child);
        if (child.userData.aura) auras.push({ aura: child.userData.aura, parent: child.parent });
      }
    });
    auras.forEach(({ aura, parent }) => { if (parent) parent.remove(aura); });
    toRemove.forEach((o) => { if (o.parent) o.parent.remove(o); });
    const indicator = document.getElementById('interaction-indicator');
    if (indicator) indicator.style.display = 'none';
  }

  // Pause
  togglePause() { return this.hud.togglePause(); }
  isPaused() { return this.hud.getPauseState(); }

  // ---------- Progressive objectives ----------
  initializeProgressiveObjectives() {
    this.hud.objectives = [
      { id: 1, text: "Explore lab and Find exit", completed: false }
    ];
    this.hud.updateObjectivesDisplay();
    console.log('[Objectives] Initialized with first objective: Turn on the power');
  }

  // Level 2 specific objectives
  initializeLevel2Objectives() {
    this.hud.objectives = [
      { id: 1, text: "Find a clue to open office door", completed: false }
    ];
    this.hud.updateObjectivesDisplay();
    console.log('[Level2 Objectives] Initialized with first objective: Find a clue to open office door');
  }

  // Called when power is turned on
  onPowerTurnedOn() {
    this.powerTurnedOn = true;
    this.completeObjective(1);
    this.hud.objectives.push({ id: 2, text: "Find the Flashlight", completed: false });
    this.hud.updateObjectivesDisplay();
    this.enableFlashLightInteraction();
    console.log('[Objectives] Power turned on - added flashlight objective');
  }

  // Called when flashlight is picked up
  onFlashlightPickedUp() {
    this.flashlightPickedUp = true;
    this.completeObjective(2);
    this.hud.objectives.push({ id: 3, text: "Enter the elevator", completed: false });
    this.hud.updateObjectivesDisplay();
    this.activateElevator();
    console.log('[Objectives] Flashlight picked up - added elevator objective');
  }

  // Level 2 progression hooks
  onEmailViewed() {
    this.completeObjective(1);
    this.hud.objectives.push({ id: 2, text: "Figure out the office code", completed: false });
    this.hud.updateObjectivesDisplay();
    console.log('[Level2] Email viewed - added office code objective');
  }

  onOfficeCodeEntered() {
    this.completeObjective(2);
    this.hud.objectives.push({ id: 3, text: "Find a way to open the safebox", completed: false });
    this.hud.updateObjectivesDisplay();
    console.log('[Level2] Office code entered - added safebox objective');
  }

  onSafeboxCodeEntered() {
    this.completeObjective(3);
    this.hud.objectives.push({ id: 4, text: "Open the Main door", completed: false });
    this.hud.updateObjectivesDisplay();
    console.log('[Level2] Safebox opened - added main door objective');
  }

  onMainDoorOpened() {
    this.completeObjective(4);
    console.log('[Level2] Main door opened - all objectives complete!');
  }

  onOfficeDoorUnlocked() {
    this.completeObjective(1);
    console.log('[Level2] Office door unlocked - objective completed!');
  }

  onOfficeDoor2Unlocked() {
    console.log('[Level2] Office door 2 unlocked via keycode - can now be controlled with E key');
  }

  // Ensure generator is interactable from the start
  ensureGeneratorInteractable() {
    this.scene.traverse((child) => {
      if (child.name === "powerpulse1") {
        child.userData.interactable = true;
        console.log('[Generator] Made generator interactable from start');
      }
    });
  }

  onLevel3ExitReached() {
  // Complete the level 3 objective (id 1 = "Explore lab and Find exit")
  this.completeObjective(1);
  this.showEndCredits();
  console.log('[Level3] Exit reached – rolling credits');
}

showEndCredits() {
  // stop input & show overlay
  try { this.controls?.unlock(); } catch {
    // Ignore errors when unlocking controls
  }
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.95); color:#fff; 
    display:flex; align-items:center; justify-content:center; 
    z-index:99999; overflow:hidden; font-family:monospace;
  `;

  const inner = document.createElement('div');
  inner.style.cssText = `
    width: min(700px, 90vw);
    max-height: 90vh;
    text-align:center;
    font-size: 16px;
    line-height: 1.8;
    white-space: pre-line;
    animation: scrollUp 18s linear forwards;
  `;
  inner.textContent =
`CREDITS

Facility Run

Group memebers
• Lauren
• Kaylee
• Adrusha
• Colby
• Sipho 

Tools
• three.js
• Blender
• Vite

Thanks for playing!`;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes scrollUp {
      from { transform: translateY(50vh); opacity: 0; }
      10%  { opacity: 1; }
      to   { transform: translateY(-120%); opacity: 1; }
    }
    #credits-btn { 
      position:absolute; bottom:24px; left:50%; transform:translateX(-50%);
      border:1px solid #777; background:#111; color:#eee; padding:10px 14px; 
      border-radius:6px; cursor:pointer; font-family:monospace;
    }
    #credits-btn:hover { background:#222; }
  `;

  const btn = document.createElement('button');
  btn.id = 'credits-btn';
  btn.textContent = 'Close';
  btn.onclick = () => {
    overlay.remove();
  };

  overlay.appendChild(inner);
  overlay.appendChild(btn);
  document.head.appendChild(style);
  document.body.appendChild(overlay);
}

}