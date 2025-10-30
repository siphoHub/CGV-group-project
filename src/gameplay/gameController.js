// Game Controller to manage HUD and game state
import * as THREE from 'three';
import { HUD } from './hud.js';
import ZipOverlay from './zipOverlay.js';
import { showCreditsOverlay } from './credits.js';
import { assetUrl } from '../utils/assets.js';

import { endcutscene } from './endcutscene.js';

export class GameController {
  constructor(scene, camera,lights, controls,initialLightingState='normal') {
    this.scene = scene;
    this.camera = camera;
    this.hud = new HUD();
    this.lights=lights;
    this.flashlight = lights.flashlight;
    this.controls = controls;
    this.generatorActivated = false; // Track generator state

    // remember last interacted T-door so you can close it even if not "nearest"
    this._lastDoorT = null;

    //this.addObjective("Turn on Power");
    this.powerTurnedOn = false; // Track power state for progressive objectives
    this.flashlightPickedUp = false; // Track flashlight pickup for progressive objectives

    // Initialize with first objective only
    this.initializeProgressiveObjectives();

    // Make sure generator is interactable from start
    this.ensureGeneratorInteractable();
  // Screen interaction is enabled when the appropriate level is loaded (main.js will call enableScreenInteraction for level3)


    // Audio system for sound effects
    this.itemPickupSound = new Audio(assetUrl('assets/ItemPickupSound.mp3'));
    this.itemPickupSound.volume = 0.5; // Set volume to 50%

    this.flashlightSwitchSound = new Audio(assetUrl('assets/FlashlightSwitch.mp3'));
    this.flashlightSwitchSound.volume = 1; // Set volume to 100%

    this.generatorSound = new Audio(assetUrl('assets/GeneratorTurnedOn.mp3'));
    this.generatorSound.volume = 1.0; // Set volume to 100% (increased)

    this.scaryScreamSound = new Audio(assetUrl('assets/ScaryScream.mp3'));
    this.scaryScreamSound.volume = 0.7; // Set volume to 70%

  // Mini-game audio cues
  this.deniedSound = new Audio(assetUrl('assets/denied-sound.mp3'));
  this.deniedSound.volume = 0.9;
  this.selfDestructSound = new Audio(assetUrl('assets/self destruct initiated.mp3'));
  this.selfDestructSound.volume = 0.9;
  // Extra soundtrack to play shortly after successful Zip completion
  this.surgeonAttackSound = new Audio(assetUrl('assets/Samuel_Laflamme_-_Surgeon_Attack_Outlast_OST.mp3'));
  this.surgeonAttackSound.volume = 0.9;

  // Track whether the Zip mini-game has been completed (won) so it cannot be replayed
  this._zipCompleted = false;

    // Initialize lighting to normal state
    this.setLightingState(initialLightingState);

    this.setupEventListeners();

    this._flashlightSuspendCount = 0;
    this._restoreFlashlightOnResume = false;
  }

  setupEventListeners() {
    // F key for flashlight toggle
    document.addEventListener('keydown', (event) =>
    {
      // If paused, ignore most gameplay hotkeys except unpausing
      const paused = this.isPaused();

      if (event.code === 'KeyF') {
        event.preventDefault();
        if (paused) return;
        const flashlightState = this.hud.getFlashlightState();

        // Only play sound if player has obtained the flashlight
        if (flashlightState.hasFlashlight) {
          const isOn = this.hud.toggleFlashlight();
          this.playFlashlightSwitchSound(); // Play switch sound
          this.updateFlashlightInScene(isOn);
        }
      }

      // P key for pause menu
      if (event.code === 'KeyP') {
        event.preventDefault();
        const isPaused = this.togglePause();  // updates HUD state
        if (isPaused && this.controls) {
          this.controls.unlock();
        }
      }
    });

    // Listen for generator events from other parts of the game
    window.addEventListener('generator:triggered', () => {
      this.triggerGenerator();
    });

    //listen for battery depletuon event
    window.addEventListener('battery:depleted', () => {
      // Auto turn off flashlight in scene
      this.handleGameOver();
    });

    // End the level when level3 exit is triggered
    window.addEventListener('level3:exit', () => {
      //GATE THE EXIT BY ZIP WIN
      if (!this._zipCompleted) {
        this.hud?.showMessage?.('Exit locked. Find the arcade machine first.', 1800);
        return;
      }

      this.onLevel3ExitReached();
    });

  }

  suspendFlashlight(reason = '') {
    if (!this.hud || typeof this.hud.getFlashlightState !== 'function') return;
    if (this._flashlightSuspendCount === 0) {
      const state = this.hud.getFlashlightState();
      this._restoreFlashlightOnResume = state.hasFlashlight && state.isOn;
      if (state.isOn) {
        this.hud.setFlashlightOn(false);
        this.updateFlashlightInScene(false);
      }
    }
    this._flashlightSuspendCount++;
  }

  resumeFlashlight(reason = '') {
    if (!this.hud || this._flashlightSuspendCount <= 0) {
      this._flashlightSuspendCount = Math.max(0, this._flashlightSuspendCount || 0);
      return;
    }
    this._flashlightSuspendCount--;
    if (this._flashlightSuspendCount === 0) {
      if (this._restoreFlashlightOnResume) {
        const restored = this.hud.setFlashlightOn(true);
        this.updateFlashlightInScene(restored);
      } else {
        this.updateFlashlightInScene(false);
      }
      this._restoreFlashlightOnResume = false;
    }
  }

  // Handle object interactions from main.js
  handleInteraction(object)
  {
    if (!object.userData.interactable) return;

    // Exit door (level 3)
    if (object.userData?.interactionType === 'exit') {
      // Gate by Zip completion
      if (!this._zipCompleted) {
        this.hud?.showMessage?.('Exit locked. Find the arcade machine first.', 1800);
        return;
      }

      // allow both: main calling handleInteraction, or node.userData.onInteract hitting the event
      this.onLevel3ExitReached();
      return;
    }

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
        // Remove all flashlight parts from the scene (picked up)
        this.removeFlashlightParts();

        //no main lights since the flashlight is picked up
        this.dimSceneLights(true);

        // Complete flashlight objective and show next objective
        this.onFlashlightPickedUp();

        // Play scary scream 0.5 seconds after pickup
        setTimeout(() => {
          this.playScaryScream();
        }, 500); // 0.5 seconds delay
        break;

      //batteries

      case 'Screen001':
        // Open the mini-game (Zip-like) when player interacts with the screen
        try {
          console.log('[Screen001] Interaction triggered - opening mini-game');
          // Unlock controls so the player can interact with the DOM overlay
          if (this.controls && typeof this.controls.unlock === 'function') {
            try { this.controls.unlock(); } finally { /* ignore */ }
          }
          this.openZipMiniGame();
          console.log('[Screen001] openZipMiniGame() called');
        } catch (e) {
          console.warn('[Screen001] Failed to open mini-game:', e);
        }
        break;

      default:
      if (object.name && object.name.toLowerCase().includes('battery'))
      {
        this.playPickupSound();
        const barsToAdd = 3;
        this.hud.restoreBatteryLife(barsToAdd);
        this.removeBattery(object);
        console.log('[Battery] Picked up ${object.name}, restored ${barsToAdd} battery bars');
        break;
      }
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

          // Only activate if generator hasn't been used before
          if (!this.generatorActivated) {
            // Play generator sound immediately (only once)
            this.playGeneratorSound();

            // Mark as activated immediately to prevent re-use
            this.generatorActivated = true;

            // Remove interactable property so it can't be used again
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
        break;
    }
 }

  removeBattery(object)
  {
    if (!object) return;

    if (object.parent)
    {
      object.parent.remove(object);
    }

    if (object.userData.aura && object.parent)
    {
        object.parent.remove(object.userData.aura);
    }

    const interactionIndicator = document.getElementById('interaction-indicator');
    if (interactionIndicator) {
      interactionIndicator.style.display = 'none';
    }
    console.log('[Battery]  removed ${object.name} from scene after pickup');
  }
  // Update the actual flashlight in the 3D scene
  updateFlashlightInScene(isOn) {
    const flashlightState = this.hud.getFlashlightState();

    if (!flashlightState.hasFlashlight) return;

    if (isOn && flashlightState.energy > 0) {
      // Create or enable flashlight
      this.flashlight.visible = true;
      this.flashlight.intensity = Math.max(0.1, flashlightState.energy / 100);
    } else {
      // Disable flashlight
        this.flashlight.visible = false;
    }
  }

  // Update method to be called in the main animation loop
  update() {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    if (this.flashlight) {
      this.flashlight.position.copy(this.camera.position);

      // Aim flashlight where the camera is facing
      const targetPos = this.camera.position.clone().add(direction.clone().multiplyScalar(10));
      this.flashlight.target.position.copy(targetPos);

      const flashlightState = this.hud.getFlashlightState();
      this.flashlight.visible = flashlightState.isOn && flashlightState.energy > 0;
      this.flashlight.intensity = Math.max(0.1, flashlightState.energy / 100);

      if (this.lights.updateFlashlightBeam) {
        this.lights.updateFlashlightBeam();
      }
    }

    this.hud.updateMinimap(this.camera.position, direction);
  }

  // Lighting state management
  setLightingState(state) {
    if(!this.lights) return;

    switch(state) {
      case 'normal':
        // Normal lighting: ambient and directional lights on, red lights off
        if(this.lights.hemi) this.lights.hemi.intensity = 0.8;
        if(this.lights.dirLight) this.lights.dirLight.intensity = 1.2;
        if(this.lights.redLights) {
          this.lights.redLights.forEach(light => {
            light.intensity = 0;
          });
        }
        break;

      case 'dark':
        // Dark mode: all lights off (flashlight picked up)
        if(this.lights.hemi) this.lights.hemi.intensity = 0;
        if(this.lights.dirLight) this.lights.dirLight.intensity = 0;
        if(this.lights.redLights) {
          this.lights.redLights.forEach(light => {
            light.intensity = 0;
          });
        }
        break;

      case 'emergency':
        // Emergency mode: ambient lights dim, red lights on
        if(this.lights.hemi) this.lights.hemi.intensity = 0.1;
        if(this.lights.dirLight) this.lights.dirLight.intensity = 0.2;
        if(this.lights.redLights) {
          this.lights.redLights.forEach(light => {
            light.intensity = 4;
          });
        }
        break;

      case 'flashing':
        this.startRoomFlashing();
        break;

    }
  }

  dimSceneLights(dim=true){ this.setLightingState(dim ? 'dark' : 'normal'); }

//flashing light code

startRoomFlashing() {
  if (!this.lights) return;
  if (this.flashTimeout) clearTimeout(this.flashTimeout);

  const flashOnDuration = 3000;  // 3 seconds on
  const flashOffDuration = 2000; // 2 seconds off

  const flashCycle = () => {
    // Turn room lights ON
    if (this.lights.hemi) this.lights.hemi.color.set(0xff0000); // red
    if (this.lights.dirLight) this.lights.dirLight.color.set(0xff0000);
    if (this.lights.hemi) this.lights.hemi.intensity = 0.8; // adjust as needed
    if (this.lights.dirLight) this.lights.dirLight.intensity = 1.2;

    // Schedule lights OFF
    this.flashTimeout = setTimeout(() => {
      if (this.lights.hemi) this.lights.hemi.intensity = 0;
      if (this.lights.dirLight) this.lights.dirLight.intensity = 0;

      // Schedule next ON
      this.flashTimeout = setTimeout(flashCycle, flashOffDuration);
    }, flashOnDuration);
  };

  flashCycle(); // start the cycle
}

stopRoomFlashing() {
  if (this.flashTimeout) {
    clearTimeout(this.flashTimeout);
    this.flashTimeout = null;
  }

  // Reset lights to OFF (or normal state if desired)
  if (this.lights) {
    if (this.lights.hemi) this.lights.hemi.intensity = 0;
    if (this.lights.dirLight) this.lights.dirLight.intensity = 0;
  }
}
  
  // Pause/resume helpers for audio and countdown
  _pauseAllGameAudio() {
    this._pausedAudio = this._pausedAudio || {};
    const audios = ['itemPickupSound','flashlightSwitchSound','generatorSound','scaryScreamSound','deniedSound','selfDestructSound','surgeonAttackSound'];
    for (const k of audios) {
      const a = this[k];
      if (a && !a.paused) {
        try { this._pausedAudio[k] = a.currentTime || 0; a.pause(); } catch (err) { void err; }
      }
    }
    // Also pause any escape tick sound
    if (this._escapeTickSound && !this._escapeTickSound.paused) {
      try { this._pausedAudio['_escapeTickSound'] = this._escapeTickSound.currentTime || 0; this._escapeTickSound.pause(); } catch (err) { void err; }
    }
  }

  _resumeAllGameAudio() {
    if (!this._pausedAudio) return;
    for (const k of Object.keys(this._pausedAudio)) {
      try {
        if (k === '_escapeTickSound' && this._escapeTickSound) {
          this._escapeTickSound.currentTime = this._pausedAudio[k] || 0;
          this._escapeTickSound.play().catch(() => {});
        } else if (this[k]) {
          this[k].currentTime = this._pausedAudio[k] || 0;
          this[k].play().catch(() => {});
        }
      } catch (err) { void err; }
    }
    this._pausedAudio = {};
  }

  _pauseEscapeCountdown() {
    if (this._escapeCountdownTimer) {
      clearInterval(this._escapeCountdownTimer);
      this._escapeCountdownTimer = null;
      this._escapePaused = true;
    }
  }

  _scheduleEscapeInterval() {
    // ensure any existing timer cleared
    if (this._escapeCountdownTimer) clearInterval(this._escapeCountdownTimer);
    this._escapeCountdownTimer = setInterval(() => {
      this._escapeRemaining -= 1;
      const inner = document.getElementById('escape-countdown-inner');
      if (inner) {
        inner.textContent = String(this._escapeRemaining);
        inner.style.transform = 'scale(1.06)';
        setTimeout(() => { if (inner) inner.style.transform = ''; }, 250);
      }
      try { if (this._escapeTickSound) { this._escapeTickSound.currentTime = 0; this._escapeTickSound.play().catch(() => {}); } } catch (err) { void err; }

      if (this._escapeRemaining <= 0) {
        // finalize countdown
        this.stopEscapeCountdown();
        const ov2 = document.getElementById('escape-countdown-overlay'); if (ov2) ov2.style.display = 'none';
        try {
          const ex = new Audio(assetUrl('assets/explosion.mp3'));
          ex.volume = 1.0;
          ex.play().catch(() => {});
  } catch (err) { void err; }

        try {
          const flash = document.createElement('div');
          flash.id = 'explosion-flash';
          flash.style.cssText = [
            'position:fixed',
            'inset:0',
            'pointer-events:none',
            'z-index:100001',
            "background: radial-gradient(circle at 50% 40%, rgba(255,255,255,0.98) 0%, rgba(255,245,200,0.95) 14%, rgba(255,180,90,0.85) 34%, rgba(0,0,0,0) 60%)",
            'opacity:0',
            'transition: opacity 220ms ease-out, transform 600ms ease-out'
          ].join(';');
          document.body.appendChild(flash);
          requestAnimationFrame(() => { flash.style.opacity = '1'; flash.style.transform = 'scale(1.02)'; });
          setTimeout(() => { flash.style.opacity = '0'; flash.style.transform = 'scale(1.08)'; setTimeout(() => { try { flash.remove(); } catch (err) { void err; } }, 600); }, 140);
        } catch (err) { void err; }

        try { this.handleGameOver(this._escapeFinalMessage); } catch (err) { console.warn('[GameController] handleGameOver failed', err); }
      }
    }, 1000);
  }

  _resumeEscapeCountdown() {
    if (!this._escapePaused) return;
    this._escapePaused = false;
    if (this._escapeRemaining > 0) {
      this._scheduleEscapeInterval();
    }
  }

  // Stop and reset all game audio that might be playing for the dramatic sequence
  stopAllGameAudio() {
    const audios = ['surgeonAttackSound','selfDestructSound','deniedSound','generatorSound','itemPickupSound','flashlightSwitchSound','scaryScreamSound'];
    for (const k of audios) {
      try {
        const a = this[k];
        if (a) {
          try { a.pause(); } catch (err) { void err; }
          try { a.currentTime = 0; } catch (err) { void err; }
        }
      } catch (err) { void err; }
    }
    // stop tick sound if present
    try { if (this._escapeTickSound) { this._escapeTickSound.pause(); this._escapeTickSound.currentTime = 0; } } catch (err) { void err; }
    // clear any stored paused-audio markers
    try { this._pausedAudio = {}; } catch (err) { void err; }
  }

  _removeEscapeHint() {
    try {
      // traverse and remove any interactSprite attached to exit nodes
      this.scene.traverse((o) => {
        if (o && o.userData && o.userData.interactSprite) {
          try { const s = o.userData.interactSprite; if (s.parent) s.parent.remove(s); } catch (err) { void err; }
          try { o.userData.interactSprite = null; } catch (err) { void err; }
        }
      });
    } catch (err) { void err; }
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

  // Trigger generator and switch to emergency lighting
  triggerGenerator() {
    console.log('Generator triggered - switching to emergency lighting');

    // Play generator sound effect if available
    const generatorSound = new Audio(assetUrl('assets/GeneratorTurnedOn.mp3'));
    generatorSound.volume = 0.7;
    generatorSound.play().catch(() => {
      console.log('Generator sound failed to play');
    });

    // Switch to emergency lighting (red lights)
    this.setLightingState('emergency');

    // Dispatch event to notify other systems
    window.dispatchEvent(new CustomEvent('generator:activated'));
  }

  // Enable generator interaction after flashlight is obtained
  enableGeneratorInteraction() {
    console.log('[Generator] Looking for generator to enable...');
    let generatorFound = false;

    this.scene.traverse((child) => {
      if (child.name === "powerpulse1") {
        console.log(`[Generator] Found powerpulse1 object, potentiallyInteractable: ${child.userData.potentiallyInteractable}, interactable: ${child.userData.interactable}`);

        // Make it interactable regardless of potentiallyInteractable flag
        child.userData.interactable = true;
        generatorFound = true;
        console.log('[Generator] Generator is now interactable after flashlight pickup');
      }
    });

    if (!generatorFound) {
      console.log('[Generator] WARNING: powerpulse1 object not found in scene!');
    }

    // Force refresh the entire cache
    if (window.updateInteractableCache) {
      console.log('[Generator] Refreshing interactable cache...');
      window.updateInteractableCache();
    } else {
      console.log('[Generator] WARNING: updateInteractableCache not available!');
    }
  }

  enableFlashLightInteraction() {
    console.log('[Flashlight] Looking for generator to enable...');
    let flashlightFound = false;

    this.scene.traverse((child) => {
      if (child.name === "Flashlight Camping" ||
              child.name === "Flash_Light_Body_high" ||
              child.name === "Flash_Light_Cover_high" ||
              child.name === "Flash_Light_Metal_high" ||
              child.name === "AA Battery.001") {
        console.log(`[Flashlight] Found flashlight objects, potentiallyInteractable: ${child.userData.potentiallyInteractable}, interactable: ${child.userData.interactable}`);

        // Make it interactable regardless of potentiallyInteractable flag
        child.userData.interactable = true;
        flashlightFound = true;
        console.log('[Flashlight] Generator is now interactable after flashlight pickup');
      }
    });

    if (!flashlightFound) {
      console.log('[Flashlight] WARNING: powerpulse1 object not found in scene!');
    }

    // Force refresh the entire cache
    if (window.updateInteractableCache) {
      console.log('[Flashlight] Refreshing interactable cache...');
      window.updateInteractableCache();
    } else {
      console.log('[Flashlight] WARNING: updateInteractableCache not available!');
    }
  }

  // Enable interaction for Screen001 in level3
  enableScreenInteraction() {
    console.log('[Screen] Enabling Screen001 interaction...');
    let found = false;
    this.scene.traverse((child) => {
      if (child.name === 'Screen001') {
        child.userData.interactable = true;
        // require E to interact (typical for object interactions)
        child.userData.requiredKey = 'E';
        // mark as screen so HUD can show proper label
        child.userData.interactionType = 'screen';
        found = true;
        // optional small glow
        if (!child.userData.aura && child.parent) {
          const glow = new THREE.PointLight(0x88ccff, 0.3, 2);
          glow.position.copy(child.position);
          child.userData.aura = glow;
          child.parent.add(glow);
        }
        console.log('[Screen] Screen001 made interactable');
      }
    });

    if (!found) console.log('[Screen] WARNING: Screen001 not found in scene');

    if (window.updateInteractableCache) {
      window.updateInteractableCache();
    } else if (window.refreshInteractableCache) {
      window.refreshInteractableCache();
    }
  }



// Add a helper to toggle the exit interactable on/off
  setExitInteractable(enabled) {
    try {
      const normalize = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const targetNorm = normalize('Object_2011');
      let exitObj = null;

      try { exitObj = this.scene.getObjectByName && this.scene.getObjectByName('Object_2011'); } catch (e) { void e; }
      if (!exitObj) {
        this.scene.traverse((child) => {
          if (exitObj || !child || !child.name) return;
          try {
            const n = normalize(child.name);
            if (n === targetNorm || n.includes(targetNorm) || targetNorm.includes(n)) exitObj = child;
          } catch (e) { void e; }
        });
      }

      if (!exitObj) {
        console.warn('[Exit] Exit object (Object_2011) not found.');
        return;
      }

      // Apply gating
      exitObj.userData.interactable = !!enabled;
      if (enabled) {
        exitObj.userData.requiredKey = 'E';
        exitObj.userData.interactionType = 'exit';
        exitObj.userData.getInteractLabel = function () { return 'Press E to Escape'; };
      } else {
        // Keep/clear marker to avoid accidental triggers
        exitObj.userData.requiredKey = 'E';
        exitObj.userData.interactionType = 'exit';
        exitObj.userData.getInteractLabel = function () { return 'Locked'; };
        // Remove any floating hints
        try {
          if (exitObj.userData.interactSprite && exitObj.userData.interactSprite.parent) {
            exitObj.userData.interactSprite.parent.remove(exitObj.userData.interactSprite);
          }
          exitObj.userData.interactSprite = null;
        } catch (e) { void e; }
      }

      // Refresh global interactables (whichever is available)
      try { if (window.updateInteractableCache) window.updateInteractableCache(); else if (window.refreshInteractableCache) window.refreshInteractableCache(); } catch (e) { void e; }
      // Ensure it is in/out of cache list
      try {
        if (window.cachedInteractables && Array.isArray(window.cachedInteractables)) {
          const i = window.cachedInteractables.indexOf(exitObj);
          if (enabled && i === -1) window.cachedInteractables.push(exitObj);
          if (!enabled && i !== -1) window.cachedInteractables.splice(i, 1);
        }
      } catch (e) { void e; }
    } catch (err) { console.warn('[Exit] setExitInteractable failed', err); }
  }





  // Open a simple lightweight Zip-like mini-game overlay
  openZipMiniGame() {
    // Prevent opening multiple times
    if (this._zipActive) return;
    if (this._zipCompleted) {
      // already completed - give feedback
      this.hud?.showMessage?.('Purge already initiated.', 1800);
  try { this.selfDestructSound.play().catch(() => {}); } catch (err) { console.warn('[Zip] selfDestructSound play failed', err); }
      return;
    }
    this._zipActive = true;
    this.suspendFlashlight('zip');

    // Unlock controls so the overlay can receive DOM input
    if (this.controls && typeof this.controls.unlock === 'function') {
      try { this.controls.unlock(); } catch { /* ignore */ }
    }

    // Demo level data for the ZipOverlay. Replace or extend as needed.
    const demoLevel = {
      nodes: [
        { x: 0.08, y: 0.18, label: '7*7', expr: '7*7' },        // 49
        { x: 0.28, y: 0.10, label: '94/2', expr: '94/2' },      // 47
        { x: 0.46, y: 0.16, label: '9*5', expr: '9*5' },        // 45
        { x: 0.64, y: 0.10, label: '40+1', expr: '40+1' },      // 41
        { x: 0.82, y: 0.18, label: '3*13', expr: '3*13' },      // 39
        { x: 0.12, y: 0.46, label: '6*6', expr: '6*6' },        // 36
        { x: 0.32, y: 0.52, label: '58/2', expr: '58/2' },      // 29
        { x: 0.52, y: 0.46, label: '46/2', expr: '46/2' },      // 23
        { x: 0.72, y: 0.56, label: '7+7', expr: '7+7' },        // 14
        { x: 0.92, y: 0.48, label: '12/2', expr: '12/2' }       // 6
      ],
      allowCross: false
    };

    // Open the ZipOverlay singleton and wire minimal callbacks
    try {
      ZipOverlay.open({
        level: demoLevel,
        onWin: () => {
          // mark completed so it cannot be played again
          this._zipCompleted = true;
          // disable Screen001 interactable so main loop won't offer it again
          try {
            this.scene.traverse((child) => { if (child.name === 'Screen001') { child.userData.interactable = false; } });
          } catch (err) { console.warn('[Zip] disabling Screen001 failed', err); }
          try { this.selfDestructSound.play().catch(() => {}); } catch (err) { console.warn('[Zip] selfDestructSound play failed', err); }
          // Play the surgeon attack OST 2 seconds after successful Zip completion
          try {
            setTimeout(() => {
              try { this.surgeonAttackSound.currentTime = 0; this.surgeonAttackSound.play().catch(() => {}); } catch (err) { console.warn('[Zip] surgeonAttackSound play failed', err); }
            }, 2000);
          } catch (err) { console.warn('[Zip] scheduling surgeonAttackSound failed', err); }
          // Start a dramatic escape countdown (70s) — if it reaches 0, player dies with custom message
          try { this.startEscapeCountdown(70, "You didnt escape in time"); } catch (err) { console.warn('[Zip] startEscapeCountdown failed', err); }

          // Make the escape door/object interactable so player can press E to escape
          try { this.setExitInteractable(true); } catch (err) { console.warn('[Zip] enabling exit failed', err); }
          try {
            // loose name normalizer: lowercase and strip non-alphanumeric for robust matching
            const normalize = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '');
            const targetNorm = normalize('Object_2011');

            let found = null;
            // try direct name lookup first
            try { found = this.scene.getObjectByName && this.scene.getObjectByName('Object_2011'); } catch (e) { void e; }

            // otherwise traverse and match loosely
            if (!found) {
              this.scene.traverse((child) => {
                if (found || !child || !child.name) return;
                try {
                  if (normalize(child.name) === targetNorm || normalize(child.name).includes(targetNorm) || targetNorm.includes(normalize(child.name))) {
                    found = child;
                  }
                } catch (e) { void e; }
              });
            }

            if (!found) {
              console.warn('[Zip] Object_2011 not found in scene; cannot make exit interactable');
            } else {
              const child = found;
              console.log('[Zip] making', child.name, 'an exit interactable');
              // mark as an exit interactable
              child.userData.interactable = true;
              child.userData.requiredKey = 'E';
              child.userData.interactionType = 'exit';
              // refresh the global interactable cache so main loop picks this up
              try { if (window.updateInteractableCache) window.updateInteractableCache(); else if (window.refreshInteractableCache) window.refreshInteractableCache(); } catch (e) { void e; }
              // Ensure the global cached array contains this object immediately
              try {
                if (window.cachedInteractables && Array.isArray(window.cachedInteractables) && window.cachedInteractables.indexOf(child) === -1) {
                  window.cachedInteractables.push(child);
                }
              } catch (e) { void e; }
              // Provide a custom label for the interaction indicator
              try { child.userData.getInteractLabel = function() { return 'Press E to Escape'; }; child.userData.interactLabelText = 'Press E to Escape'; } catch (e) { void e; }
            }
          } catch (err) { console.warn('[Zip] making Object_2011 interactable failed', err); }
          try { if (this.onZipWin) this.onZipWin(); } catch (err) { console.warn('[Zip] onZipWin handler error', err); }
          try { ZipOverlay.close(); } catch (err) { console.warn('[Zip] close failed', err); }
          this._zipActive = false;
          this.resumeFlashlight('zip');
          if (this.controls && typeof this.controls.lock === 'function') {
            try { this.controls.lock(); } catch (err) { console.warn('[Zip] controls.lock failed', err); }
          }
        },
        onFail: (reason) => {
          try { this.deniedSound.play().catch(() => {}); } catch (err) { console.warn('[Zip] deniedSound play failed', err); }
          try { if (this.onZipFail) this.onZipFail(reason); } catch (err) { console.warn('[Zip] onZipFail handler error', err); }
          // keep _zipActive true so player can retry without re-opening if needed
          this._zipActive = false;
        }
      });
    } catch (err) {
      console.warn('[Zip] Failed to open ZipOverlay:', err);
      this._zipActive = false;
      this.resumeFlashlight('zip');
    }
  }

  // createZipOverlay is delegated to ZipOverlay module
  createZipOverlay() {
    try { ZipOverlay.open(); } catch (e) { console.warn('[Zip] createZipOverlay failed:', e); }
  }

  endZipGame(won) {
    // delegate to ZipOverlay for consistent UX
    try { if (won) window.dispatchEvent(new CustomEvent('zip:won')); } catch (err) { console.warn('[Zip] dispatch zip:won failed', err); }
    try { ZipOverlay.close(); } catch (err) { console.warn('[Zip] close failed', err); }
    this._zipActive = false;
  }

  closeZipMiniGame() {
    try { ZipOverlay.close(); } catch (err) { console.warn('[Zip] close failed', err); }
    this._zipActive = false;
    this.resumeFlashlight('zip');
    if (this._zipCleanup) { try { this._zipCleanup(); } catch (err) { console.warn('[Zip] cleanup handler error', err); } finally { this._zipCleanup = null; } }
    if (this._zipPreviousFocus && typeof this._zipPreviousFocus.focus === 'function') {
      try { this._zipPreviousFocus.focus(); } catch { /* ignore */ }
    }
    if (this.controls && typeof this.controls.lock === 'function') {
      try { this.controls.lock(); } catch { /* ignore */ }
    }
  }

  // Play generator sound effect
  playGeneratorSound() {
    // Reset the sound to beginning in case it's already playing
    this.generatorSound.currentTime = 0;

    // Play the sound
    this.generatorSound.play().catch(() => {
      // Sound failed to play
      console.log('[Generator] Failed to play generator sound');
    });
  }

  // Play scary scream sound effect
  playScaryScream() {
    // Reset the sound to beginning in case it's already playing
    this.scaryScreamSound.currentTime = 0;

    // Play the sound
    this.scaryScreamSound.play().catch(() => {
      // Sound failed to play
      console.log('[ScaryScream] Failed to play scary scream sound');
    });
  }

  // Play pickup sound effect
  playPickupSound() {
    // Reset the sound to beginning in case it's already playing
    this.itemPickupSound.currentTime = 0;

    // Play the sound
    this.itemPickupSound.play().catch(() => {
      // Sound failed to play
    });
  }

  // Play flashlight switch sound effect
  playFlashlightSwitchSound() {
    // Reset the sound to beginning in case it's already playing
    this.flashlightSwitchSound.currentTime = 0;

    // Play the sound
    this.flashlightSwitchSound.play().catch(() => {
      // Sound failed to play
    });
  }

  // Method to add new objectives dynamically
  addObjective(text) {
    const newId = this.hud.objectives.length + 1;
    this.hud.objectives.push({ id: newId, text, completed: false });
    this.hud.updateObjectivesDisplay();
    return newId;
  }

  // Method to complete objectives by text or id
  completeObjective(identifier) {
    if (typeof identifier === 'string') {
      const objective = this.hud.objectives.find(obj => obj.text === identifier);
      if (objective) {
        this.hud.completeObjective(objective.id);
      }
    } else {
      this.hud.completeObjective(identifier);
    }
  }

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

    // Collect all objects to remove first
    this.scene.traverse((child) => {
      if (flashlightParts.includes(child.name)) {
        objectsToRemove.push(child);

        // Collect aura if it exists
        if (child.userData.aura) {
          aurasToRemove.push({ aura: child.userData.aura, parent: child.parent });
        }
      }
    });

    // Remove all collected auras
    aurasToRemove.forEach(({ aura, parent }) => {
      if (parent) {
        parent.remove(aura);
      }
    });

    // Remove all collected flashlight parts
    objectsToRemove.forEach((object) => {
      if (object.parent) {
        object.parent.remove(object);
      }
    });

    // Hide the interaction prompt
    const interactionIndicator = document.getElementById('interaction-indicator');
    if (interactionIndicator) {
      interactionIndicator.style.display = 'none';
    }
  }

  // Toggle pause menu
  togglePause() {
    const isPaused = this.hud.togglePause();

    // Pause or resume gameplay-adjacent effects (audio, escape countdown)
    try {
      if (isPaused) {
        this._pauseAllGameAudio();
        this._pauseEscapeCountdown();
      } else {
        this._resumeAllGameAudio();
        this._resumeEscapeCountdown();
      }
    } catch (err) { console.warn('[GameController] pause/resume handlers failed', err); }

    return isPaused;
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

  initializeLevel3Objectives() {
    // Reset any level-progress flags that are irrelevant for Level 3
    this.powerTurnedOn = false;
    this.flashlightPickedUp = false;
    this.generatorActivated = false;

    // Set the objectives UI to the single Level 3 objective
    if (this.hud) {
      this.hud.objectives = [ { id: 1, text: 'Find the Arcade machine', completed: false } ];
      try { this.hud.updateObjectivesDisplay(); } catch (err) { console.warn('[GameController] updateObjectivesDisplay failed', err); }
    }
    console.log('[Objectives] Level 3 objectives initialized: Find the Arcade machine');
    // Ensure exit is locked at level start
    try { this.setExitInteractable(false); } catch (e) { void e; }

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


  //END CUTSCENE
      playEndcutscene() {
    // Allow DOM overlay input if your cutscene uses it
    try { this.controls?.unlock?.(); } catch (err) { void err; }

    // Return a promise that resolves when the cutscene finishes.
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };

      try {
        // Use same asset base as the rest of the project
        const endcut = new endcutscene(assetUrl('assets/endcutscene.png'));
        // START the cutscene and resolve when it completes
        try { endcut.play(finish); } catch (e) { void e; }
      } catch (e) { /* if construction fails, fall through to timeout */ }

      // Fallback: listen for a global signal if endcutscene dispatches one
      window.addEventListener('endcutscene:finished', finish, { once: true });

      // Safety timeout so we always progress (20s)
      setTimeout(finish, 20000);
    });
  }

  // onLevel3ExitReached() {
  //   // Complete the level 3 objective (id 1 = "Explore lab and Find exit")
  //   this.completeObjective(1);
  //   // Stop any active countdowns and game music before showing credits
  // try { this.stopEscapeCountdown(); } catch (err) { void err; }
  // try { this.stopAllGameAudio(); } catch (err) { void err; }
  // // remove any interact sprite hint left behind
  // try { this._removeEscapeHint(); } catch (err) { void err; }
    
  //   this.showEndCredits();
  //   console.log('[Level3] Exit reached – rolling credits (countdown/music stopped)');
  // }

  async onLevel3ExitReached() {
    // Complete the level 3 objective (id 1 = "Explore lab and Find exit")
    this.completeObjective(1);
    // Stop any active countdowns and game music before showing credits
    try { this.stopEscapeCountdown(); } catch (err) { void err; }
    try { this.stopAllGameAudio(); } catch (err) { void err; }
    // remove any interact sprite hint left behind
    try { this._removeEscapeHint(); } catch (err) { void err; }

    // Wait for the cutscene to finish before rolling credits
    try { await this.playEndcutscene(); } catch (err) { void err; }

    this.showEndCredits();
    console.log('[Level3] Exit reached – rolling credits (countdown/music stopped)');
  }

  showEndCredits() {
    try {
      this.controls?.unlock();
    } catch (err) {
      console.warn('[GameController] Failed to unlock controls before credits:', err);
    }

    showCreditsOverlay({ restartOnFinish: true });
  }

  //game over
  handleGameOver(message) {
    console.log('[GameController] Game Over triggered', message ? `- ${message}` : '');
    if (this.flashlight) this.flashlight.visible = false;

    if (this.controls) {
      try { this.controls.unlock(); } catch (err) { void err; }
    }

    // show provided message or default
    try { this.hud.showGameOverScreen(message); } catch (err) { console.warn('[GameController] hud.showGameOverScreen failed', err); }
  setTimeout(() => { try { this.playScaryScream(); } catch (err) { void err; } }, 300);
  }

  // Escape countdown (used after successful Zip mini-game)
  startEscapeCountdown(seconds = 70, finalMessage = "You didnt escape in time") {
    this.stopEscapeCountdown();
    // Update objectives UI to reflect escape urgency
    try {
      if (this.hud) {
        this.hud.objectives = [{ id: 1, text: 'Escape in time', completed: false }];
        this.hud.updateObjectivesDisplay();
      }
    } catch (err) { console.warn('[GameController] update objectives for countdown failed', err); }

    this._escapeRemaining = Math.max(0, Math.floor(seconds));
    this._escapeFinalMessage = finalMessage;

    // create overlay
    let ov = document.getElementById('escape-countdown-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'escape-countdown-overlay';
      ov.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;z-index:100000;background:rgba(0,0,0,0.6);pointer-events:none;';
      ov.innerHTML = `<div id="escape-countdown-inner" style="pointer-events:none;color:#ffdddd;text-align:center;font-family:VT323,monospace;font-size:clamp(48px,8vw,160px);text-shadow:0 0 30px rgba(255,50,50,0.9);">${this._escapeRemaining}</div>`;
      document.body.appendChild(ov);
    } else {
      const inner = ov.querySelector('#escape-countdown-inner'); if (inner) inner.textContent = String(this._escapeRemaining);
      ov.style.display = 'grid';
    }

    // dramatic tick sound (optional) - create once and keep on the controller so it can be paused
    try { this._escapeTickSound = new Audio(assetUrl('assets/denied-sound.mp3')); this._escapeTickSound.volume = 0.8; } catch (err) { void err; this._escapeTickSound = null; }

    // If the game is currently paused, mark countdown paused and don't start ticking until resume
    if (this.isPaused && this.hud && this.hud.getPauseState && this.hud.getPauseState()) {
      this._escapePaused = true;
      return;
    }

    // start the interval loop
    this._escapePaused = false;
    this._scheduleEscapeInterval();
  }

  stopEscapeCountdown() {
    if (this._escapeCountdownTimer) { clearInterval(this._escapeCountdownTimer); this._escapeCountdownTimer = null; }
    const ov = document.getElementById('escape-countdown-overlay'); if (ov) ov.style.display = 'none';
    // stop/reset tick sound
    try { if (this._escapeTickSound && !this._escapeTickSound.paused) { this._escapeTickSound.pause(); this._escapeTickSound.currentTime = 0; } } catch (err) { void err; }
    this._escapePaused = false;
  }
}
