//main.js
import * as THREE from "three";
import { loadLevel } from "./core/levelLoader.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GameController } from "./gameplay/gameController.js";
import { OpeningCutscene } from "./gameplay/cutscene.js";
import { createControls } from "./controls/controls.js";

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);
scene.fog = new THREE.Fog(0x000000, 8, 30);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0,1.7,-15);
camera.lookAt(0, 1.7, 0);

// --- Dev helpers (ignored by interaction) ---
const grid = new THREE.GridHelper(40, 40);
const axes = new THREE.AxesHelper(2);
grid.userData.ignoreInteract = true;
axes.userData.ignoreInteract = true;
scene.add(grid, axes);

// --- Controls ---
const { controls, update } = createControls(camera, renderer.domElement);

// --- Music ---
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

// --- Cutscene + parallel level load ---
const cutscene = new OpeningCutscene();
let levelLoaded = false;
let readyToInit = false;

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
// --- Game init (HUD + interaction loop) ---
let gameController;
let interactionIndicator;

function initializeGame() {
  // place player at spawn (you can tune this)
  resetPlayer();

  // HUD / gameplay systems
  gameController = new GameController(scene, camera);

  // music
  startBackgroundMusic();
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
  camera.position.set(0, 1.7, 5);   // <- your gameplay spawn
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

function checkForInteractables() {
  if (!interactionIndicator || !controls.isLocked) return;

  const interactionDistance = 1.8;
  let target = null;
  let best = interactionDistance;
  let flashlightTaken = false;

  scene.traverse((obj) => {
    if (!obj.userData?.interactable) return;
    const d = camera.position.distanceTo(obj.getWorldPosition(new THREE.Vector3()));

    // optional special casing for flashlight aura
    if (obj.name?.includes("Flash_Light") && obj.userData.aura) {
      obj.userData.aura.material.opacity = d <= interactionDistance ? 0.2 : 0.0;
      if (d <= interactionDistance && !flashlightTaken) { target = obj; best = d; flashlightTaken = true; }
      return;
    }

    if (!flashlightTaken && d <= interactionDistance && d < best) { target = obj; best = d; }
  });

  if (target) {
    interactionIndicator.style.display = "block";
    const p = target.getWorldPosition(new THREE.Vector3()); p.y += 0.5;
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
function animate() {
  const dt = Math.min(0.1, clock.getDelta());   // clamp large frame gaps

  update(dt);                                   // drive unified controls
  if (gameController && !gameController.isPaused()) {
    gameController.update();                    // HUD / flashlight / gameplay ticks
    checkForInteractables();                    // proximity UI
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
