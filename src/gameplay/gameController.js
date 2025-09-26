// Game Controller to manage HUD and game state
import * as THREE from 'three';
import { HUD } from './hud.js';

export class GameController {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.hud = new HUD();
    this.flashlight = null; // Will hold the flashlight light object
    
    // Audio system for sound effects
    this.itemPickupSound = new Audio('./assets/ItemPickupSound.mp3');
    this.itemPickupSound.volume = 0.5; // Set volume to 50%
    
    this.flashlightSwitchSound = new Audio('./assets/FlashlightSwitch.mp3');
    this.flashlightSwitchSound.volume = 1; // Set volume to 100%
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // F key for flashlight toggle
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyF') {
        event.preventDefault();
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
        this.togglePause();
      }
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
        break;
        
      case 'AA Battery.001':
        this.hud.onBatteryInteraction();
        // Remove the battery from the scene (picked up)
        this.scene.remove(object);
        break;
    }
  }

  // Update the actual flashlight in the 3D scene
  updateFlashlightInScene(isOn) {
    const flashlightState = this.hud.getFlashlightState();
    
    if (!flashlightState.hasFlashlight) return;

    if (isOn && flashlightState.energy > 0) {
      // Create or enable flashlight
      if (!this.flashlight) {
        this.createFlashlight();
      }
      this.flashlight.visible = true;
      this.flashlight.intensity = Math.max(0.1, flashlightState.energy / 100);
    } else {
      // Disable flashlight
      if (this.flashlight) {
        this.flashlight.visible = false;
      }
    }
  }

  createFlashlight() {
    // Create a spotlight that follows the camera
    this.flashlight = new THREE.SpotLight(0xffffff, 1, 15, Math.PI / 6, 0.5);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.width = 1024;
    this.flashlight.shadow.mapSize.height = 1024;
    
    // Attach to camera
    this.camera.add(this.flashlight);
    this.flashlight.position.set(0.2, -0.1, 0);
    this.flashlight.target.position.set(0, 0, -1);
    
    this.scene.add(this.flashlight.target);
  }

  // Update method to be called in the main animation loop
  update() {
    if (this.flashlight && this.flashlight.visible) {
      // Update flashlight direction to match camera
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      
      const flashlightTarget = this.camera.position.clone();
      flashlightTarget.add(direction.multiplyScalar(10));
      this.flashlight.target.position.copy(flashlightTarget);
      
      // Update intensity based on remaining energy
      const flashlightState = this.hud.getFlashlightState();
      this.flashlight.intensity = Math.max(0.1, flashlightState.energy / 100);
    }
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