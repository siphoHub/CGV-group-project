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
  }

  // Handle object interactions from main.js
  handleInteraction(object) {
    if (!object.userData.interactable) return;

    switch (object.name) {
      case 'Flash_Light_Body_high':
      case 'Flash_Light_Cover_high':
      case 'Flash_Light_Metal_high':
        this.playPickupSound(); // Play sound effect
        this.hud.onFlashlightInteraction();
        // Remove all flashlight parts from the scene (picked up)
        this.removeFlashlightParts();

        //no main lights since the flashlight is picked up
        this.dimSceneLights(true);
        
        // Play scary scream 0.5 seconds after pickup
        setTimeout(() => {
          this.playScaryScream();
          this.completeObjective("Find a Flashlight");
        }, 500); // 0.5 seconds delay
        break;

      case 'AA Battery.001':
        this.hud.onBatteryInteraction();
        // Remove the battery from the scene (picked up)
        this.scene.remove(object);
        break;

      default:
        // Handle generator object (only powerpulse1 and only after flashlight is obtained)
        if (object.name === "powerpulse1") {

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

            // Make generator interactable now that flashlight is obtained
            this.enableFlashLightInteraction();
            
            // Activate emergency lighting after 7 seconds (without sound)
            setTimeout(() => {
              this.setLightingState('emergency'); // Direct lighting change without sound
              
              // Mark "Get Power Back Up" objective as completed
              this.completeObjective("Turn on power");
              this.addObjective("Find a Flashlight");
              
              console.log(`[Generator] Emergency lights activated after delay: ${object.name}`);
            }, 3000); // 3 seconds delay
            
            console.log(`[Generator] Generator started, emergency lights will activate in 7 seconds: ${object.name}`);
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
    if (this.flashlight) {

      // Always move flashlight to camera
      this.flashlight.position.copy(this.camera.position);

      // Point in the direction camera is facing
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);

      const targetPos = this.camera.position.clone().add(direction.multiplyScalar(10));
      this.flashlight.target.position.copy(targetPos);

      // Only make it visible if toggled on
      const flashlightState = this.hud.getFlashlightState();
      this.flashlight.visible = flashlightState.isOn && flashlightState.energy > 0;

      // Update intensity
      this.flashlight.intensity = Math.max(0.1, flashlightState.energy / 100);
    }
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
    }
  }

  //lights off when torch picked up (keeping old method for backwards compatibility)
  dimSceneLights(dim=true)
  {
    this.setLightingState(dim ? 'dark' : 'normal');
  }

  // Trigger generator and switch to emergency lighting
  triggerGenerator() {
    console.log('Generator triggered - switching to emergency lighting');
    
    // Play generator sound effect if available
    const generatorSound = new Audio('../public/models/assets/GeneratorTurnedOn.mp3');
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
    return isPaused;
  }

  // Get pause state
  isPaused() {
    return this.hud.getPauseState();
  }
}
