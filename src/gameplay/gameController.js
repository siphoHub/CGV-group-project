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

    // remember last interacted T-door so you can close it even if not "nearest"
    this._lastDoorT = null;

    this.addObjective("Turn on Power");

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
        this.playPickupSound();
        this.hud.onFlashlightInteraction();
        this.removeFlashlightParts();
        this.dimSceneLights(true);
        setTimeout(() => {
          this.playScaryScream();
          this.completeObjective("Find a Flashlight");
        }, 500);
        break;

      case 'AA Battery.001':
        this.hud.onBatteryInteraction();
        this.scene.remove(object);
        break;

      default:
        // Doors via E: only allow if door requires E; show hint if door requires T
        if (object.userData?.toggleDoor && object.userData?.isDoor) {
          const req = object.userData.requiredKey || "E";
          if (req === "E") {
            try { object.userData.toggleDoor(); } catch (e) { console.warn('[Door-E] toggleDoor error:', e); }
          } else if (req === "T") {
            this.hud?.showMessage?.("Press T to interact", 1200);
            // remember it so KeyT can still close it even if not "nearest" later
            this._lastDoorT = object;
          }
          break;
        }

        // Generator
        if (object.name === "powerpulse1") {
          if (!this.generatorActivated) {
            this.playGeneratorSound();
            this.generatorActivated = true;
            object.userData.interactable = false;
            if (window.refreshInteractableCache) window.refreshInteractableCache();
            this.enableFlashLightInteraction();
            setTimeout(() => {
              this.setLightingState('emergency');
              this.completeObjective("Turn on power");
              this.addObjective("Find a Flashlight");
            }, 3000);
            console.log(`[Generator] Generator started, emergency lights in 3s: ${object.name}`);
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

  dimSceneLights(dim=true){ this.setLightingState(dim ? 'dark' : 'normal'); }

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

  togglePause() { return this.hud.togglePause(); }
  isPaused() { return this.hud.getPauseState(); }
}
