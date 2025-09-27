//main.js
import * as THREE from "three";
import { loadLevel } from "./core/levelLoader.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GameController } from "./gameplay/gameController.js";
import { OpeningCutscene } from "./gameplay/cutscene.js";
import { createControls } from "./controls/controls.js";
import {createLighting} from "./lighting/level1.js"


// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ 
  antialias: true,
  powerPreference: "high-performance",
  stencil: false,  // Disable stencil buffer if not used
  depth: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // Use faster shadow map type
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);
scene.fog = new THREE.Fog(0x000000, 8, 30);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0,1.7,-5);
camera.lookAt(0, 1.7, 0);


// --- Dev helpers (ignored by interaction) ---
const grid = new THREE.GridHelper(40, 40);
const axes = new THREE.AxesHelper(2);
grid.userData.ignoreInteract = true;
axes.userData.ignoreInteract = true;
scene.add(grid, axes);

// Controls (we also grab setColliders)
const { controls, update, setColliders } = createControls(camera, renderer.domElement);

// --- collision state we receive from the level ---
const collisionState = {
  colliders: [],
  passthrough: [],
  rayTargets: []
};

window.addEventListener("level:colliders", (e) => {
  const d = e.detail || {};
  collisionState.colliders   = d.colliders   || [];
  collisionState.passthrough = d.passthrough || [];
  collisionState.rayTargets  = d.rayTargets  || [];
  setColliders(collisionState);
  console.log("[main] received colliders:", collisionState.colliders.length, "passthrough:", collisionState.passthrough.length);
});

// ====== ONE-KEY “STAMP A DOOR HERE” ======
const doorHelpers = [];
function addDoorAtCrosshair() {
  // Ray from screen center
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2(0, 0);
  ray.setFromCamera(mouse, camera);
  // try to hit real geometry first
  const hits = ray.intersectObjects(collisionState.rayTargets.length ? collisionState.rayTargets : scene.children, true);

  // Doorway box parameters (tweak if needed)
  const DOOR_WIDTH  = 1.2;   // meters
  const DOOR_HEIGHT = 2.2;   // meters
  const DOOR_DEPTH  = 0.6;   // meters (how deep the pass region is)

  let center;
  if (hits.length) {
    center = hits[0].point.clone();
  } else {
    // No hit? Put it ~2m in front of camera.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    center = camera.position.clone().addScaledVector(forward, 2.0);
  }

  // Build a Box3 centered at 'center'
  const min = new THREE.Vector3(
    center.x - DOOR_WIDTH * 0.5,
    center.y - DOOR_HEIGHT * 0.5,
    center.z - DOOR_DEPTH * 0.5
  );
  const max = new THREE.Vector3(
    center.x + DOOR_WIDTH * 0.5,
    center.y + DOOR_HEIGHT * 0.5,
    center.z + DOOR_DEPTH * 0.5
  );
  const doorBox = new THREE.Box3(min, max);

  // Add to passthrough list and push to controls
  collisionState.passthrough.push(doorBox);
  setColliders(collisionState);

  // Visual helper so you see where the door is
  const helper = new THREE.Box3Helper(doorBox, 0x22cc22);
  helper.userData.ignoreInteract = true;
  scene.add(helper);
  doorHelpers.push(helper);

  console.log("[main] stamped doorway. passthrough count:", collisionState.passthrough.length);
}

// Key: press P to stamp a doorway where you’re looking
addEventListener("keydown", (e) => {
  if (e.code === "KeyO" && controls.isLocked && !gameController?.isPaused()){
    addDoorAtCrosshair();
  } 
});

// --- Music ---
// Audio system for background music by DELOSound on pixabay
let backgroundMusic = null;

function startBackgroundMusic() {
  if (!backgroundMusic) {
    backgroundMusic = new Audio('/models/assets/scary-horror-music-351315.mp3');
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
  }
}

function fadeBackgroundMusic() {
  if (backgroundMusic) {
    const fadeDuration = 2000; // milliseconds
    const fadeSteps = 20;
    const stepTime = fadeDuration / fadeSteps;
    let currentStep = 0;
    const initialVolume = backgroundMusic.volume;

    const fadeInterval = setInterval(() => {
      currentStep++;
      backgroundMusic.volume = initialVolume * (1 - currentStep / fadeSteps);
      if (currentStep >= fadeSteps) {
        clearInterval(fadeInterval);
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
      }
    }, stepTime);
  }
}

function toggleBackgroundMusic() {
  if (backgroundMusic) {
    if (backgroundMusic.paused) {
      backgroundMusic.volume = 0.3;
      backgroundMusic.play().catch(err => console.log("Failed to resume audio:", err));
      console.log("Background music resumed");
    } else {
      backgroundMusic.pause();
    }
  }
}

// --- Start Music ---
startBackgroundMusic();

// --- Cutscene + parallel level load ---
const cutscene = new OpeningCutscene();
let levelLoaded = false;
let readyToInit = false;

// Start cutscene with parallel level loading
cutscene.play(
  // Callback when cutscene completes
  () => {
    // Stop cutscene music the moment cutscene finishes/skips

    if (levelLoaded) {
      initializeGame(lights);
      fadeBackgroundMusic();
    } else {
      readyToInit = true; // Mark that we're ready to initialize when level loads
    }
  },
  // Callback to start level loading during cutscene
  () => {
    loadLevelInBackground();
  }
);

let gameController;
let lights;

function loadLevelInBackground() {

  // Load the level
  loadLevel("level1", scene);

  lights=createLighting(scene,camera);
  gameController=new GameController(scene,camera,lights, controls);

  // Add lights
  //scene.add(new THREE.HemisphereLight(0x555577, 0x111122, 0.6));
  const spot = new THREE.SpotLight(0xffffff, 1.0, 20, Math.PI / 6, 0.3);
  spot.position.set(4, 6, 4);
  spot.castShadow = true;
  scene.add(spot);

  //const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  //dirLight.position.set(5, 10, 5);
  //scene.add(dirLight);

  levelLoaded = true;
  console.log("Level loaded!");

  // If cutscene already finished, initialize game now
  if (readyToInit) {
    initializeGame(lights); //passing lights to the initializeGame function
  }
}
// --- Game init (HUD + interaction loop) --
let interactionIndicator;

function initializeGame(lights) {
  // place player at spawn (you can tune this)
  resetPlayer();

  document.addEventListener("keydown", (e) => { if (e.code === "KeyM") toggleBackgroundMusic(); });

  // interaction indicator UI
  interactionIndicator = document.createElement("div");
  interactionIndicator.id = "interaction-indicator";
  interactionIndicator.textContent = "Press E to interact";
  interactionIndicator.style.cssText = `
    position:absolute; background:rgba(255,255,255,0.9); color:#000; padding:8px 12px;
    border-radius:5px; font-family:monospace; font-weight:bold; font-size:12px;
    pointer-events:none; z-index:1000; border:1px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,.3);
    display:none;
  `;
  document.body.appendChild(interactionIndicator);

  // key to interact (nearest-in-range)
  const interactKey = "KeyE";
  const interactionDistance = 1.8;

  document.addEventListener("keydown", (event) => {
    if (event.code !== interactKey || !controls.isLocked) return;

    let nearest = null;
    let best = interactionDistance;
    scene.traverse((obj) => {
      if (obj.userData?.interactable) {
        const d = camera.position.distanceTo(obj.getWorldPosition(new THREE.Vector3()));
        if (d <= interactionDistance && d < best) { best = d; nearest = obj; }
      }
    });
    if (nearest) gameController.handleInteraction(nearest);
  });
}

// --- Helpers ---
function resetPlayer() {
  camera.position.set(0, 1.7, -5);   // <- your gameplay spawn
  camera.lookAt(0, 1.7, 0);
}

addEventListener("keydown", (e) => { if (e.code === "KeyR") resetPlayer(); });

// world->screen (for indicator)
function worldToScreen(worldPos) {
  const v = worldPos.clone().project(camera);
  const x = (v.x + 1) * renderer.domElement.width / 2;
  const y = (-v.y + 1) * renderer.domElement.height / 2;
  return { x, y };
}

// Cache interactable objects to avoid scene traversal every frame
let cachedInteractables = [];

// Make cache globally accessible for GameController
window.cachedInteractables = cachedInteractables;

function updateInteractableCache() {
  cachedInteractables = [];
  scene.traverse((obj) => {
    if (obj.userData?.interactable) {
      cachedInteractables.push(obj);
    }
  });
  // Update global reference
  window.cachedInteractables = cachedInteractables;
  console.log(`[Performance] Cached ${cachedInteractables.length} interactable objects`);
}

// Add function to refresh cache when objects become non-interactable
function refreshInteractableCache() {
  cachedInteractables = cachedInteractables.filter(obj => 
    obj.parent && obj.userData?.interactable
  );
}

// Make refresh function globally accessible
window.refreshInteractableCache = refreshInteractableCache;

// Make update function globally accessible  
window.updateInteractableCache = updateInteractableCache;

// Update cache when level loads
window.addEventListener("level:colliders", () => {
  setTimeout(updateInteractableCache, 100); // Small delay to ensure scene is fully loaded
});

function checkForInteractables() {
  if (!interactionIndicator || !controls.isLocked) return;

  const interactionDistance = 1.8;
  let target = null;
  let best = interactionDistance;
  let flashlightTaken = false;

  // Use cached interactables instead of scene.traverse
  for (const obj of cachedInteractables) {
    if (!obj.parent || !obj.userData?.interactable) continue; // Skip if object was removed or no longer interactable
    
    const d = camera.position.distanceTo(obj.getWorldPosition(new THREE.Vector3()));

    // Special casing for flashlight aura
    if (obj.name?.includes("Flash_Light") && obj.userData.aura) {
      obj.userData.aura.material.opacity = d <= interactionDistance ? 0.2 : 0.0;
      if (d <= interactionDistance && !flashlightTaken) { target = obj; best = d; flashlightTaken = true; }
      continue;
    }

    // Handle generators and other interactables (no aura effect for generators)
    if (!flashlightTaken && d <= interactionDistance && d < best) { target = obj; best = d; }
  }

  if (target) {
    interactionIndicator.style.display = "block";
    const p = target.getWorldPosition(new THREE.Vector3()); 
    
    // Check if target is a generator to customize the prompt
    const isGenerator = target.name === "powerpulse1";
    
    if (isGenerator) {
      p.y += 0.2; // Lower position for generator
      interactionIndicator.textContent = "Press E to Turn on";
    } else {
      p.y += 0.5; // Higher position for other objects
      interactionIndicator.textContent = "Press E to interact";
    }
    
    const s = worldToScreen(p);
    interactionIndicator.style.left = `${s.x}px`;
    interactionIndicator.style.top = `${s.y}px`;
    interactionIndicator.style.transform = "translate(-50%, -100%)";
  } else {
    interactionIndicator.style.display = "none";
  }
}

// --- Resize ---
addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// --- Animate ---
const clock = new THREE.Clock();
let frameCount = 0;
function animate() {
  const dt = Math.min(0.1, clock.getDelta());   // clamp large frame gaps
  frameCount++;

  update(dt);                                   // drive unified controls
  if (gameController && !gameController.isPaused()) {
    gameController.update();                    // HUD / flashlight / gameplay ticks
    
    // Only check for interactables every 3 frames to reduce performance impact
    if (frameCount % 3 === 0) {
      checkForInteractables();                  // proximity UI
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
