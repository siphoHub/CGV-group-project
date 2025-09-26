//main.js
import * as THREE from "three";
import { loadLevel } from "./core/levelLoader.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GameController } from "./gameplay/gameController.js";
import { OpeningCutscene } from "./gameplay/cutscene.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 8, 30);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0,0,-15);
camera.lookAt(0, 0.3, 0);

// Initialize cutscene
const cutscene = new OpeningCutscene();

// Start cutscene and load level in parallel
let levelLoaded = false;
let gameInitialized = false;

// Start cutscene with parallel level loading
cutscene.play(
  // Callback when cutscene completes
  () => {
    if (levelLoaded) {
      initializeGame();
    } else {
      gameInitialized = true; // Mark that we're ready to initialize when level loads
    }
  },
  // Callback to start level loading during cutscene
  () => {
    loadLevelInBackground();
  }
);

function loadLevelInBackground() {
  
  // Load the level
  loadLevel("level1", scene);
  
  // Add lights
  scene.add(new THREE.HemisphereLight(0x555577, 0x111122, 0.6));
  const spot = new THREE.SpotLight(0xffffff, 1.0, 20, Math.PI / 6, 0.3);
  spot.position.set(4, 6, 4);
  spot.castShadow = true;
  scene.add(spot);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);
  
  levelLoaded = true;
  console.log("Level loaded!");
  
  // If cutscene already finished, initialize game now
  if (gameInitialized) {
    initializeGame();
  }
}

// Audio system for background music by DELOSound on pixabay
let backgroundMusic = null;

function startBackgroundMusic() {
  if (!backgroundMusic) {
    backgroundMusic = new Audio('./assets/scary-horror-music-351315.mp3');
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.3; // Set volume to 30% so it's not too loud
    
    // Play with user interaction (modern browsers require this)
    backgroundMusic.play().catch(error => {
      
      // Add a one-time click listener to start music
      const playAudio = () => {
        backgroundMusic.play().catch(err => console.log("Failed to play audio:", err));
        document.removeEventListener('click', playAudio);
      };
      document.addEventListener('click', playAudio);
    });
    
  }
}

function stopBackgroundMusic() {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    backgroundMusic = null;
  }
}

function toggleBackgroundMusic() {
  if (backgroundMusic) {
    if (backgroundMusic.paused) {
      backgroundMusic.play().catch(err => console.log("Failed to resume audio:", err));
      console.log("Background music resumed");
    } else {
      backgroundMusic.pause();
    }
  }
}

function initializeGame() {
  console.log("Initializing game...");
  
  // Start background music
  startBackgroundMusic();
  
  // Initialize Game Controller with HUD
  const gameController = new GameController(scene, camera);

  //CONTROLS
  const controls = new PointerLockControls(camera, renderer.domElement);

  // Click to lock pointer
  document.body.addEventListener('click', () => controls.lock());

  // Movement
  const move = { forward: 0, backward: 0, left: 0, right: 0 };
  document.addEventListener('keydown', (e) => {
    if(e.code === 'KeyW') move.forward = 1;
    if(e.code === 'KeyS') move.backward = 1;
    if(e.code === 'KeyA') move.left = 1;
    if(e.code === 'KeyD') move.right = 1;
    if(e.code === 'KeyM') toggleBackgroundMusic(); // M key to toggle music
  });
  document.addEventListener('keyup', (e) => {
    if(e.code === 'KeyW') move.forward = 0;
    if(e.code === 'KeyS') move.backward = 0;
    if(e.code === 'KeyA') move.left = 0;
    if(e.code === 'KeyD') move.right = 0;
  });

  // Start the animation loop after everything is initialized
  startAnimationLoop(controls, move, gameController);
}

function startAnimationLoop(controls, move, gameController) {
  //for interaction, person doing this to replace
  const raycaster = new THREE.Raycaster();
  const interactionDistance = 1.8; // Set to 2 units for close interaction (around 1.76 distance)
  const interactKey = "KeyE";

  // Create interaction indicator
  const interactionIndicator = document.createElement('div');
  interactionIndicator.id = 'interaction-indicator';
  interactionIndicator.innerHTML = 'Press E to interact';
  interactionIndicator.style.cssText = `
    position: absolute;
    background: rgba(255, 255, 255, 0.9);
    color: black;
    padding: 8px 12px;
    border-radius: 5px;
    font-family: monospace;
    font-weight: bold;
    font-size: 12px;
    pointer-events: none;
    z-index: 1000;
    border: 1px solid rgba(255, 255, 255, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    display: none;
  `;
  document.body.appendChild(interactionIndicator);

  // Function to convert 3D world coordinates to 2D screen coordinates
  function worldToScreen(worldPosition, camera, renderer) {
    const vector = worldPosition.clone();
    vector.project(camera);
    
    const screenX = (vector.x + 1) * renderer.domElement.width / 2;
    const screenY = (-vector.y + 1) * renderer.domElement.height / 2;
    
    return { x: screenX, y: screenY };
  }

  // Check for nearby interactables in animation loop
  function checkForInteractables() {
    let nearbyInteractable = null;
    let closestDistance = interactionDistance;
    let hasFlashlightInRange = false;
    
    // Check proximity to all interactable objects
    scene.traverse((child) => {
      if (child.userData.interactable) {
        const distance = camera.position.distanceTo(child.getWorldPosition(new THREE.Vector3()));
        
        // Handle aura visibility for flashlight objects
        if (child.name.includes("Flash_Light") && child.userData.aura) {
          if (distance <= interactionDistance) {
            child.userData.aura.material.opacity = 0.2;
            if (!hasFlashlightInRange) {
              // Only set the first flashlight part as the interactable
              nearbyInteractable = child;
              closestDistance = distance;
              hasFlashlightInRange = true;
            }
          } else {
            child.userData.aura.material.opacity = 0;
          }
        } else if (distance <= interactionDistance && distance < closestDistance && !hasFlashlightInRange) {
          // For non-flashlight objects, only set if no flashlight is in range
          nearbyInteractable = child;
          closestDistance = distance;
        }
      }
    });
    
    // Show interaction indicator for nearest object
    if (nearbyInteractable) {
      interactionIndicator.style.display = 'block';
      interactionIndicator.innerHTML = `Press E to interact`;
      
      // Position indicator at the object's world position
      const worldPosition = nearbyInteractable.getWorldPosition(new THREE.Vector3());
      // Offset the indicator slightly above the object
      worldPosition.y += 0.5;
      
      const screenPosition = worldToScreen(worldPosition, camera, renderer);
      
      interactionIndicator.style.left = screenPosition.x + 'px';
      interactionIndicator.style.top = screenPosition.y + 'px';
      interactionIndicator.style.transform = 'translate(-50%, -100%)'; // Center horizontally, place above
      
    } else {
      interactionIndicator.style.display = 'none';
    }
  }

  // Listen for key press
  document.addEventListener("keydown", (event) => {
    if (event.code !== interactKey) return;

    // Find nearest interactable object within range
    let nearestObject = null;
    let closestDistance = interactionDistance;
    
    scene.traverse((child) => {
      if (child.userData.interactable) {
        const distance = camera.position.distanceTo(child.getWorldPosition(new THREE.Vector3()));
        if (distance <= interactionDistance && distance < closestDistance) {
          nearestObject = child;
          closestDistance = distance;
        }
      }
    });

    if (nearestObject) {
      // Use game controller to handle interaction
      gameController.handleInteraction(nearestObject);
    }
  });

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);

  function animate() {
    // Check if game is paused
    if (!gameController.isPaused()) {
      const speed = 0.1;
      if(move.forward) controls.moveForward(speed);
      if(move.backward) controls.moveForward(-speed);
      if(move.left) controls.moveRight(-speed);
      if(move.right) controls.moveRight(speed);

      // Check for nearby interactable objects
      checkForInteractables();

      // Update game controller (handles flashlight and HUD)
      gameController.update();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

