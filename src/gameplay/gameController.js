// Game Controller to manage HUD and game state
import * as THREE from 'three';
import { HUD } from './hud.js';

export class GameController {
  constructor(scene, camera,lights, controls) {
    this.scene = scene;
    this.camera = camera;
    this.hud = new HUD();
    this.lights=lights;
    this.flashlight = lights.flashlight;
    this.controls = controls;
    this.generatorActivated = false; // Track generator state
    this.powerTurnedOn = false; // Track power state for progressive objectives
    this.flashlightPickedUp = false; // Track flashlight pickup for progressive objectives

    // Initialize with first objective only
    this.initializeProgressiveObjectives();
    
    // Make sure generator is interactable from start
    this.ensureGeneratorInteractable();

    // Audio system for sound effects
    this.itemPickupSound = new Audio('../public/models/assets/ItemPickupSound.mp3');
    this.itemPickupSound.volume = 0.5; // Set volume to 50%

    this.flashlightSwitchSound = new Audio('../public/models/assets/FlashlightSwitch.mp3');
    this.flashlightSwitchSound.volume = 1; // Set volume to 100%
    
    this.generatorSound = new Audio('../public/models/assets/GeneratorTurnedOn.mp3');
    this.generatorSound.volume = 1.0; // Set volume to 100% (increased)
    
    this.scaryScreamSound = new Audio('../public/models/assets/ScaryScream.mp3');
    this.scaryScreamSound.volume = 0.7; // Set volume to 70%

    // Initialize lighting to normal state
    this.setLightingState('normal');

    this.setupEventListeners();
  }

  // ---------- helpers ----------
  _isUsableDoor(obj) {
    return !!(obj && obj.parent && obj.userData && obj.userData.isDoor && obj.userData.toggleDoor);
  }

  _nearestDoorRequiringKey(requiredKey, maxDist = 2.2) { // a touch more generous than 1.8
    const list = (window.cachedInteractables && Array.isArray(window.cachedInteractables))
      ? window.cachedInteractables
      : [];
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
    document.addEventListener('keydown', (event) =>
    {
      const paused = this.isPaused();

      // ----- T key: toggle doors that require T -----
      if (event.code === 'KeyT') {
        event.preventDefault();
        if (paused || !this.controls?.isLocked) return;

        // prefer nearest T-door; else fallback to last interacted T-door
        let doorT = this._nearestDoorRequiringKey("T", 2.2);
        if (!doorT && this._isUsableDoor(this._lastDoorT)) {
          const d = this.camera.position.distanceTo(
            this._lastDoorT.getWorldPosition(new THREE.Vector3())
          );
          if (d <= 3.5) {
            doorT = this._lastDoorT;
          }
        }

        if (doorT && doorT.userData?.toggleDoor) {
          try { doorT.userData.toggleDoor(); } catch (e) { console.warn('[Door-T] toggleDoor error:', e); }
          this._lastDoorT = doorT;
        }
        return; // handled
      }

      // ----- F key flashlight (unchanged) -----
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

      // ----- P key pause (unchanged) -----
      if (event.code === 'KeyP') {
        event.preventDefault();
        const isPaused = this.togglePause();
        if (isPaused && this.controls) {
          this.controls.unlock();
        }
      }
    });

    // Listen for generator events from other parts of the game
    window.addEventListener('generator:triggered', () => {
      this.triggerGenerator();
    });
  }

  // Handle object interactions from main.js
  handleInteraction(object) {
    if (!object.userData.interactable) return;

    switch (object.name) {
      case 'Flash_Light_Body_high':
      case 'Flash_Light_Cover_high':
      case 'Flash_Light_Metal_high':
        // Only allow pickup if power has been turned on
        if (!this.powerTurnedOn) {
          this.hud.showMessage('The flashlight seems to need power first...', 2000);
          return;
        }
        
        this.playPickupSound(); // Play sound effect
        this.hud.onFlashlightInteraction();
        this.removeFlashlightParts();
        this.dimSceneLights(true);
        
        // Complete flashlight objective and show next objective
        this.onFlashlightPickedUp();
        
        // Play scary scream 0.5 seconds after pickup
        setTimeout(() => {
          this.playScaryScream();
        }, 500); // 0.5 seconds delay
        break;

      case 'AA Battery.001':
        this.hud.onBatteryInteraction();
        this.scene.remove(object);
        break;

      default:
        // Handle generator object (only powerpulse1)
        if (object.name === "powerpulse1") {

        // Generator
        if (object.name === "powerpulse1") {
          if (!this.generatorActivated) {
            this.playGeneratorSound();
            this.generatorActivated = true;
            object.userData.interactable = false;
            
            // Refresh the interactable cache to remove this object from prompts
            if (window.refreshInteractableCache) {
              window.refreshInteractableCache();
            }
            
            // Activate emergency lighting after 3 seconds
            setTimeout(() => {
              this.setLightingState('emergency'); // Switch to red lights
              
              // Complete power objective and show next objective
              this.onPowerTurnedOn();
              
              console.log(`[Generator] Emergency lights activated after delay: ${object.name}`);
            }, 3000); // 3 seconds delay
            
            console.log(`[Generator] Generator started, emergency lights will activate in 3 seconds: ${object.name}`);
          }
        }
        break;
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

  // Update method to be called in the main animation loop
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
    }
  }

  // Lighting state management
  setLightingState(state) {
    if(!this.lights) return;

    switch(state) {
      case 'normal':
        if(this.lights.hemi) this.lights.hemi.intensity = 0.8;
        if(this.lights.dirLight) this.lights.dirLight.intensity = 1.2;
        if(this.lights.redLights) {
          this.lights.redLights.forEach(light => { light.intensity = 0; });
        }
        break;
      case 'dark':
        if(this.lights.hemi) this.lights.hemi.intensity = 0;
        if(this.lights.dirLight) this.lights.dirLight.intensity = 0;
        if(this.lights.redLights) {
          this.lights.redLights.forEach(light => { light.intensity = 0; });
        }
        break;
      case 'emergency':
        if(this.lights.hemi) this.lights.hemi.intensity = 0.1;
        if(this.lights.dirLight) this.lights.dirLight.intensity = 0.2;
        if(this.lights.redLights) {
          this.lights.redLights.forEach(light => { light.intensity = 4; });
        }
        break;
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

  //lights off when torch picked up (keeping old method for backwards compatibility)
  dimSceneLights(dim=true)
  {
    this.setLightingState(dim ? 'dark' : 'normal');
  }

  triggerGenerator() {
    console.log('Generator triggered - switching to emergency lighting');
    const generatorSound = new Audio('../public/models/assets/GeneratorTurnedOn.mp3');
    generatorSound.volume = 0.7;
    generatorSound.play().catch(() => console.log('Generator sound failed to play'));
    this.setLightingState('emergency');
    window.dispatchEvent(new CustomEvent('generator:activated'));
  }

  enableGeneratorInteraction() {
    console.log('[Generator] Looking for generator to enable...');
    let generatorFound = false;
    this.scene.traverse((child) => {
      if (child.name === "powerpulse1") {
        child.userData.interactable = true;
        generatorFound = true;
        console.log('[Generator] Generator is now interactable after flashlight pickup');
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
  setBatteryDrainTime(seconds) { this.hud.setBatteryDrainTime(seconds); }
  getBatteryState() { return this.hud.getBatteryState(); }
  restoreBatteryLife(amount) { this.hud.restoreBatteryLife(amount); }

  // Battery management methods
  setBatteryDrainTime(seconds) {
    this.hud.setBatteryDrainTime(seconds);
  }

  getBatteryState() {
    return this.hud.getBatteryState();
  }

  restoreBatteryLife(amount) {
    this.hud.restoreBatteryLife(amount);
  }

  // Activate elevator when flashlight is obtained
  activateElevator() {
    // Find the elevator object in the scene
    this.scene.traverse((child) => {
      if (child.name === 'Mesh_0001' && child.userData.interactionType === 'elevator') {
        // Mark as interactable now that flashlight is obtained
        child.userData.interactable = true;
        console.log('Elevator activated - flashlight obtained!');
      }
    });
  }

  // Remove all flashlight parts when one is picked up
  removeFlashlightParts() {
    const flashlightParts = ['Flash_Light_Body_high', 'Flash_Light_Cover_high', 'Flash_Light_Metal_high'];
    const objectsToRemove = [];
    const aurasToRemove = [];
    this.scene.traverse((child) => {
      if (flashlightParts.includes(child.name)) {
        objectsToRemove.push(child);
        if (child.userData.aura) aurasToRemove.push({ aura: child.userData.aura, parent: child.parent });
      }
    });
    aurasToRemove.forEach(({ aura, parent }) => { if (parent) parent.remove(aura); });
    objectsToRemove.forEach((object) => { if (object.parent) object.parent.remove(object); });
    const interactionIndicator = document.getElementById('interaction-indicator');
    if (interactionIndicator) interactionIndicator.style.display = 'none';
  }

  // Get pause state
  isPaused() {
    return this.hud.getPauseState();
  }

  // Initialize progressive objectives - start with only the first one
  initializeProgressiveObjectives() {
    // Set only the first objective as visible, others hidden initially
    this.hud.objectives = [
      { id: 1, text: "Turn on the power", completed: false }
    ];
    this.hud.updateObjectivesDisplay();
    
    console.log('[Objectives] Initialized with first objective: Turn on the power');
  }

  // Initialize level 2 specific objectives
  initializeLevel2Objectives() {
    // Clear any existing objectives and set level 2 objectives
    this.hud.objectives = [
      { id: 1, text: "Find a clue to open office door", completed: false }
    ];
    this.hud.updateObjectivesDisplay();

    console.log('[Level2 Objectives] Initialized with first objective: Find a clue to open office door');
  }

  // Called when power is turned on (red lights appear)
  onPowerTurnedOn() {
    this.powerTurnedOn = true;
    
    // Complete "Turn on power" objective
    this.completeObjective(1);
    
    // Add next objective
    this.hud.objectives.push({ id: 2, text: "Find the Flashlight", completed: false });
    this.hud.updateObjectivesDisplay();
    
    // Make flashlight interactable now that power is on
    this.enableFlashLightInteraction();
    
    console.log('[Objectives] Power turned on - added flashlight objective');
  }

  // Called when flashlight is picked up
  onFlashlightPickedUp() {
    this.flashlightPickedUp = true;
    
    // Complete "Find the Flashlight" objective
    this.completeObjective(2);
    
    // Add final objective
    this.hud.objectives.push({ id: 3, text: "Enter the elevator", completed: false });
    this.hud.updateObjectivesDisplay();
    
    // Activate elevator so player can go to next level
    this.activateElevator();
    
    console.log('[Objectives] Flashlight picked up - added elevator objective');
  }

  // Level 2 progression: Called when email is viewed
  onEmailViewed() {
    // Complete "Find Keycard" objective and add office code objective
    this.completeObjective(1);
    
    // Add next objective
    this.hud.objectives.push({ id: 2, text: "Figure out the office code", completed: false });
    this.hud.updateObjectivesDisplay();
    
    console.log('[Level2] Email viewed - added office code objective');
  }

  // Level 2 progression: Called when office code is entered successfully
  onOfficeCodeEntered() {
    // Complete "Figure out the office code" objective
    this.completeObjective(2);
    
    // Add safebox objective
    this.hud.objectives.push({ id: 3, text: "Find a way to open the safebox", completed: false });
    this.hud.updateObjectivesDisplay();
    
    console.log('[Level2] Office code entered - added safebox objective');
  }

  // Level 2 progression: Called when safebox code is entered successfully
  onSafeboxCodeEntered() {
    // Complete "Find a way to open the safebox" objective
    this.completeObjective(3);
    
    // Add final objective
    this.hud.objectives.push({ id: 4, text: "Open the Main door", completed: false });
    this.hud.updateObjectivesDisplay();
    
    console.log('[Level2] Safebox opened - added main door objective');
  }

  // Level 2 progression: Called when main door is opened
  onMainDoorOpened() {
    // Complete final objective
    this.completeObjective(4);
    
    console.log('[Level2] Main door opened - all objectives complete!');
  }

  // Level 2 progression: Called when office door is unlocked with E key
  onOfficeDoorUnlocked() {
    // Complete the office door objective if it exists
    this.completeObjective(1);
    console.log('[Level2] Office door unlocked - objective completed!');
  }

  // Level 2 progression: Called when office door 2 is unlocked via keycode
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
}
