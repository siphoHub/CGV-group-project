import * as THREE from "three";
import { loadLevel, progressToLevel2, isLevelTransitioning, transitionToLevel } from "./core/levelLoader.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GameController } from "./gameplay/gameController.js";
import { OpeningCutscene } from "./gameplay/cutscene.js";
import { createControls } from "./controls/controls.js";
import {createLighting} from "./lighting/level1.js"
import { DoorManager } from "./gameplay/Doors.js";

addEventListener("keydown", (e) => {
  if (e.code === "KeyO" && controls.isLocked && !gameController?.isPaused()){
    addDoorAtCrosshair();
  } 
  
  // L key for level progression
  if (e.code === "KeyL" && controls.isLocked && !gameController?.isPaused() && !isLevelTransitioning()) {
    // Immediately transition to Level 3 (blenderL3) when L is pressed
    transitionToLevel('level3', scene, gameController, camera, 'Entering the experiment testing room')
      .then(success => {
        if (success) console.log('[Main] Successfully progressed to Level 3');
        else console.warn('[Main] Failed to progress to Level 3');
      });
  }
});

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ 
  antialias: window.devicePixelRatio === 1, // Only enable antialias on low-DPI displays
  powerPreference: "high-performance",
  stencil: false,  // Disable stencil buffer if not used
  depth: true,
  logarithmicDepthBuffer: false // Disable for better performance
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // Use faster shadow map type
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance

// Additional performance optimizations
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Enable frustum culling optimizations
renderer.sortObjects = true;

document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);
scene.fog = new THREE.Fog(0x000000, 8, 30);

// --- Door Manager ---
let doorManager = null;

// --- Camera ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0,1.7,-5);
camera.lookAt(0, 1.7, 0);



// --- Dev helpers (ignored by interaction) ---
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
  console.log("[main] updated colliders:", collisionState.colliders.length, "passthrough:", collisionState.passthrough.length);
});

// Initialize DoorManager when Level 2 is loaded
window.addEventListener("level:loaded", (e) => {
  const levelName = e.detail?.levelName;
  if (levelName === "level2" || levelName === 'level3') {
    console.log(`[main] ${levelName} loaded, initializing DoorManager...`);
    initializeDoorManager();
  }
});

// Listen for keycard usage event from level2 and transition to level3 with a custom message
window.addEventListener('keycard:used', async (e) => {
  const detail = e.detail || {};
  const target = detail.targetLevel || 'level3';
  const message = detail.loadingMessage || 'Loading...';
  console.log('[main] Keycard used, transitioning to', target, 'with message:', message);

  // Use the level loader to show the custom message and load target
  // We rely on loadLevel to accept side-effects; show loading screen first
  const loadingEl = document.getElementById('loading-screen');
  if (loadingEl) {
    // Update message if loading screen already exists
    const p = loadingEl.querySelector('.loading-content p');
    if (p) p.textContent = message;
    loadingEl.style.display = 'flex';
  } else {
    // Create a simple loading screen if none exists
    const ls = document.createElement('div');
    ls.id = 'loading-screen';
    ls.innerHTML = `<div class="loading-content"><h2>LOADING...</h2><div class="loading-spinner"></div><p>${message}</p></div>`;
    ls.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;justify-content:center;align-items:center;background:rgba(0,0,0,0.9);z-index:10000;color:white;font-family:monospace;';
    document.body.appendChild(ls);
  }

  try {
    const success = await transitionToLevel(target, scene, gameController, camera, message);
    if (success) {
      console.log('[main] Transition to', target, 'complete');
    } else {
      console.warn('[main] Transition to', target, 'failed');
    }
  } catch (err) {
    console.error('[main] Error during keycard transition:', err);
  }
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
  if (backgroundMusic && !backgroundMusic.paused) {
    stopBackgroundMusic();
  } else {
    startBackgroundMusic();
  }
}

// --- Keycode Sound Effects ---
let accessGrantedSound = null;
let accessDeniedSound = null;

function loadKeycodeSounds() {
  if (!accessGrantedSound) {
    accessGrantedSound = new Audio('/models/assets/access-granted.mp3');
    accessGrantedSound.volume = 0.5;
  }
  if (!accessDeniedSound) {
    accessDeniedSound = new Audio('/models/assets/denied-sound.mp3');
    accessDeniedSound.volume = 0.5;
  }
}

function playAccessGrantedSound() {
  if (!accessGrantedSound) loadKeycodeSounds();
  accessGrantedSound.currentTime = 0; // Reset to start
  accessGrantedSound.play().catch(err => console.log("Failed to play access granted sound:", err));
}

function playAccessDeniedSound() {
  if (!accessDeniedSound) loadKeycodeSounds();
  accessDeniedSound.currentTime = 0; // Reset to start
  accessDeniedSound.play().catch(err => console.log("Failed to play access denied sound:", err));
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

async function loadLevelInBackground() {

  // Load the level
  await loadLevel("level1", scene);

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

  // DoorManager will be initialized when Level 2 loads
  console.log('[Game] Game initialized, DoorManager will be set up when Level 2 loads');

  document.addEventListener("keydown", (e) => { 
    if (e.code === "KeyM") toggleBackgroundMusic(); 
  });

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

  // Create keycode interface
  const keycodeInterface = document.createElement("div");
  keycodeInterface.id = "keycode-interface";
  keycodeInterface.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9); color: white; padding: 30px;
    border-radius: 10px; font-family: monospace; text-align: center;
    z-index: 2000; display: none; border: 2px solid #00ff00;
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
  `;
  
  keycodeInterface.innerHTML = `
    <h3 style="margin-top: 0; color: #00ff00;">SECURITY TERMINAL</h3>
    <p>Enter Access Code:</p>
    <div id="keycode-display" style="font-size: 24px; letter-spacing: 8px; margin: 20px 0; color: #00ff00; border: 1px solid #333; padding: 10px; background: #111;">______</div>
    <div id="keycode-keypad" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 200px; margin: 0 auto;">
      <button onclick="addDigit('1')">1</button>
      <button onclick="addDigit('2')">2</button>
      <button onclick="addDigit('3')">3</button>
      <button onclick="addDigit('4')">4</button>
      <button onclick="addDigit('5')">5</button>
      <button onclick="addDigit('6')">6</button>
      <button onclick="addDigit('7')">7</button>
      <button onclick="addDigit('8')">8</button>
      <button onclick="addDigit('9')">9</button>
      <button onclick="clearCode()">C</button>
      <button onclick="addDigit('0')">0</button>
      <button onclick="submitCode()">✓</button>
    </div>
    <div style="margin-top: 20px;">
      <button onclick="closeKeycode()" style="background: #ff0000; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">CANCEL</button>
    </div>
  `;
  
  // Style the keypad buttons
  const style = document.createElement('style');
  style.textContent = `
    #keycode-keypad button {
      background: #333; color: white; border: 1px solid #555; 
      padding: 15px; font-size: 18px; font-family: monospace; 
      cursor: pointer; border-radius: 4px; transition: background 0.2s;
    }
    #keycode-keypad button:hover {
      background: #555;
    }
    #keycode-keypad button:active {
      background: #777;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(keycodeInterface);

  // Create email interface
  const emailInterface = document.createElement("div");
  emailInterface.id = "email-interface";
  emailInterface.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: #1a1a2e; color: #eee; padding: 0; border-radius: 12px;
    font-family: 'Courier New', monospace; z-index: 2000; display: none;
    width: 95%; max-width: 1400px; height: 95%; max-height: 900px;
    border: 3px solid #0f3460; box-shadow: 0 0 40px rgba(15, 52, 96, 0.7);
    overflow: hidden;
  `;

  emailInterface.innerHTML = `
    <div style="background: #0f3460; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #16213e;">
      <h3 style="margin: 0; font-size: 20px;">📧 Research Station Email Terminal</h3>
      <button onclick="closeEmail()" style="background: #e74c3c; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 16px;">✕ Close</button>
    </div>
    <div style="padding: 30px; height: calc(100% - 80px); overflow-y: auto;">
      <div style="background: #16213e; padding: 30px; border-radius: 8px; border-left: 6px solid #3498db;">
        <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px solid #2c3e50;">
          <div style="margin-bottom: 12px; font-size: 16px;"><strong style="color: #3498db;">From:</strong> Dr. Elara Voss, Lead Scientist &lt;e.voss@facility.gov&gt;</div>
          <div style="margin-bottom: 12px; font-size: 16px;"><strong style="color: #3498db;">To:</strong> Night Maintenance &lt;maint.night@facility.gov&gt;</div>
          <div style="margin-bottom: 12px; font-size: 16px;"><strong style="color: #3498db;">Subject:</strong> tag tonight's items correctly</div>
          <div style="color: #95a5a6; font-size: 14px;">Sent: Today 14:32</div>
        </div>
        <div style="line-height: 1.8; color: #ecf0f1; font-size: 16px;">
          <p style="margin-bottom: 20px;">Night team,</p>
          <p style="margin-bottom: 20px;">Please log tonight's items by <strong style="color: #f39c12;">atomic number</strong> in the inventory ledger. As always, <strong style="color: #e74c3c;">the pad outside my office only uses the last digit</strong>.</p>
          <p style="margin-bottom: 20px;">The <strong style="color: #2ecc71;">Hydrogen</strong> cylinder by Freezer 3 is rattling—secure the strap.</p>
          <p style="margin-bottom: 20px;">Replace the worn o-rings on the <strong style="color: #2ecc71;">Oxygen</strong> manifold in Bay B.</p>
          <p style="margin-bottom: 20px;">Bag the cracked <strong style="color: #2ecc71;">Boron</strong>-doped wafer from Microfab—do not rework.</p>
          <p style="margin-bottom: 20px;">Top off the <strong style="color: #2ecc71;">Helium</strong> dewar; gauge is reading a slow boiloff.</p>
          <p style="margin-bottom: 20px;">Recalibrate the <strong style="color: #2ecc71;">Nitrogen</strong> flowmeter to 2 L/min; it's drifting.</p>
          <p style="margin-bottom: 20px;">Record the "green" status on the <strong style="color: #2ecc71;">Fluorine</strong> scrubber even if it lies.</p>
          <p style="margin-bottom: 20px;"><strong style="color: #e67e22;">Remember</strong> to lock my office when you're done.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #34495e;">
            <p style="margin-bottom: 8px; font-size: 16px;">—E. Voss</p>
            <p style="font-style: italic; color: #95a5a6; font-size: 15px;">"the table remembers what we forget."</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(emailInterface);

  // Create handwritten note interface
  const noteInterface = document.createElement("div");
  noteInterface.id = "note-interface";
  noteInterface.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: url('/models/assets/ObjectivesPage.png') no-repeat center center;
    background-size: cover; color: #2c2c2c; padding: 0; border-radius: 15px;
    font-family: 'Georgia', 'Times New Roman', serif; z-index: 2000; display: none;
    width: 90%; max-width: 1400px; height: 90%; max-height: 900px;
    border: 5px solid #8b7355; box-shadow: 0 0 50px rgba(139, 115, 85, 0.8);
    overflow: hidden;
  `;

  noteInterface.innerHTML = `
    <div style="position: absolute; top: 20px; right: 20px; z-index: 10;">
      <button onclick="closeNote()" style="background: rgba(192, 57, 43, 0.9); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">✕ Close</button>
    </div>
    <div style="padding: 120px 180px; height: 100%; overflow-y: auto; line-height: 40px;">
      <div style="font-family: 'Georgia', 'Times New Roman', serif; font-size: 24px; color: #2c1810; text-align: left; text-shadow: 1px 1px 2px rgba(255,255,255,0.8);">
        <p style="margin-bottom: 30px; font-style: italic;">The experiments… I thought they could be taught—that they had some semblance of intelligence. All attempts to teach them have amounted to naught. The colourful objects we presented them with… how foolish. We mistook them for infants when they are mutations. Now we face the consequences.</p>
        
        <p style="margin-bottom: 30px;">If anyone is reading this, find a way to escape.</p>
        
        <p style="margin-bottom: 30px;">The keycard for the main door is locked in the small box on my desk.<br/>
        The code is there for those who can still order their thoughts.</p>
        
        <p style="margin-bottom: 30px;">Go to the other room and look at the colours we used. Use their numbers—you'll know which—then place them in the order the sky arranges them after rain.</p>
        
        <p style="margin-bottom: 35px;">When your hands stop shaking, enter them from first light to last.</p>
        
        <div style="text-align: right; margin-top: 40px; border-top: 2px dashed rgba(44, 24, 16, 0.4); padding-top: 25px;">
          <p style="margin: 0; font-size: 28px; font-weight: bold;">— E. V.</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(noteInterface);

  // Create safe box interface
  const safeboxInterface = document.createElement("div");
  safeboxInterface.id = "safebox-interface";
  safeboxInterface.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #2c3e50, #34495e); color: #ecf0f1; padding: 30px; border-radius: 15px;
    font-family: 'Courier New', monospace; z-index: 2000; display: none;
    width: 400px; box-shadow: 0 0 50px rgba(0,0,0,0.8);
    border: 3px solid #95a5a6; text-align: center;
  `;

  safeboxInterface.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 10px 0; color: #e74c3c; font-size: 24px;">SECURE SAFE BOX</h2>
      <p style="margin: 0; color: #bdc3c7; font-size: 14px;">Enter 4-digit access code</p>
    </div>
    <div style="background: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <div id="safebox-display" style="font-size: 36px; font-weight: bold; color: #2ecc71; letter-spacing: 8px; min-height: 50px; display: flex; align-items: center; justify-content: center;"></div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
      <button onclick="safeboxInput('1')" style="background: #34495e; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">1</button>
      <button onclick="safeboxInput('2')" style="background: #34495e; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">2</button>
      <button onclick="safeboxInput('3')" style="background: #34495e; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">3</button>
      <button onclick="safeboxInput('4')" style="background: #34495e; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">4</button>
      <button onclick="safeboxInput('5')" style="background: #34495e; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">5</button>
      <button onclick="safeboxInput('6')" style="background: #34495e; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">6</button>
      <button onclick="safeboxInput('7')" style="background: #34495e; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">7</button>
      <button onclick="safeboxInput('8')" style="background: #34495e; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">8</button>
      <button onclick="safeboxInput('9')" style="background: #34495e; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">9</button>
      <button onclick="safeboxClear()" style="background: #e74c3c; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">CLEAR</button>
      <button onclick="safeboxInput('0')" style="background: #34495e; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">0</button>
      <button onclick="safeboxSubmit()" style="background: #27ae60; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">ENTER</button>
    </div>
    <div style="margin-top: 20px;">
      <button onclick="closeSafeBox()" style="background: #95a5a6; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 16px;">✕ Close</button>
    </div>
  `;

  document.body.appendChild(safeboxInterface);

  // Note interface functions
  window.closeNote = function() {
    noteInterface.style.display = 'none';
    controls.lock(); // Re-enable mouse look
  };

  // Safe box interface functions
  let safeboxCode = '';
  
  window.closeSafeBox = function() {
    safeboxInterface.style.display = 'none';
    controls.lock(); // Re-enable mouse look
    safeboxCode = '';
    updateSafeboxDisplay();
  };

  window.safeboxInput = function(digit) {
    if (safeboxCode.length < 4) {
      safeboxCode += digit;
      updateSafeboxDisplay();
    }
  };

  window.safeboxClear = function() {
    safeboxCode = '';
    updateSafeboxDisplay();
  };

  window.safeboxSubmit = function() {
    if (safeboxCode === '4261') {
      // Correct code - play sound and award keycard
      if (gameController.playPickupSound) {
        gameController.playPickupSound();
      }
      
      // Add keycard to HUD inventory system
      gameController.giveKeycard();
      
      // Remove safe box from interactable objects
      const safeBoxObject = scene.getObjectByName('Cube014_1');
      if (safeBoxObject) {
        safeBoxObject.userData.interactable = false;
        // Refresh the cache to remove this object from interaction prompts
        if (window.refreshInteractableCache) {
          window.refreshInteractableCache();
        }
      }
      
      // Trigger level 2 objective progression if in level 2
      if (gameController && typeof gameController.onSafeboxCodeEntered === 'function') {
        gameController.onSafeboxCodeEntered();
      }
      
      console.log('[SafeBox] Keycard obtained via HUD, safe box disabled');
      window.closeSafeBox();
    } else {
      // Wrong code
      alert('Access denied. Incorrect code.');
      safeboxCode = '';
      updateSafeboxDisplay();
    }
  };

  function updateSafeboxDisplay() {
    const display = document.getElementById('safebox-display');
    if (display) {
      display.textContent = safeboxCode.padEnd(4, '_');
    }
  }

  // Email interface functions
  window.closeEmail = function() {
    emailInterface.style.display = 'none';
    controls.lock(); // Re-enable mouse look
  };

  // Keycode interface functions
  let currentCode = '';
  
  window.closeKeycode = function() {
    keycodeInterface.style.display = 'none';
    controls.lock(); // Re-enable mouse look
    currentCode = '';
    updateKeycodeDisplay();
  };
  
  window.addDigit = function(digit) {
    if (currentCode.length < 6) {
      currentCode += digit;
      updateKeycodeDisplay();
    }
  };
  
  window.clearCode = function() {
    currentCode = '';
    updateKeycodeDisplay();
  };
  
  window.submitCode = function() {
    if (currentCode.length === 6) {
      if (currentCode === '185279') {
        // Correct code - play success sound and unlock door
        playAccessGrantedSound();
        
        // Trigger level 2 objective progression if in level 2
        if (gameController && typeof gameController.onOfficeCodeEntered === 'function') {
          gameController.onOfficeCodeEntered();
        }
        
        console.log('[Keycode] Access granted! Unlocking door...');
        unlockOfficeDoor2();
        window.closeKeycode();
      } else {
        // Wrong code - play denied sound
        playAccessDeniedSound();
        console.log('[Keycode] Access denied!');
        const display = document.getElementById('keycode-display');
        display.style.color = '#ff0000';
        display.textContent = 'ACCESS DENIED';
        setTimeout(() => {
          currentCode = '';
          updateKeycodeDisplay();
          display.style.color = '#00ff00';
        }, 1500);
      }
    }
  };
  
  function updateKeycodeDisplay() {
    const display = document.getElementById('keycode-display');
    const masked = currentCode.padEnd(6, '_');
    display.textContent = masked.split('').join(' ');
  }
  
  function unlockOfficeDoor2() {
    // Unlock officeDoor2 using DoorManager instead of removing it
    if (doorManager && doorManager.doors) {
      const door2Data = doorManager.doors.find(d => d.node.name === 'officeDoor2');
      if (door2Data) {
        door2Data.locked = false;
        console.log('[Door] officeDoor2 unlocked via keycode - can now be opened/closed with E key');
        
        // Show feedback to player
        showDoorFeedback('officeDoor2', 'unlocked');
        
        // Update objectives if needed
        if (gameController && typeof gameController.onOfficeDoor2Unlocked === 'function') {
          gameController.onOfficeDoor2Unlocked();
        }
      } else {
        console.warn('[Door] officeDoor2 not found in DoorManager');
      }
    } else {
      console.warn('[Door] DoorManager not initialized when trying to unlock officeDoor2');
    }
    // Ensure the mesh itself is marked interactable and cached so HUD shows the prompt
    try {
      const mesh = scene.getObjectByName('officeDoor2');
      if (mesh) {
        mesh.userData.interactable = true;
        mesh.userData.interactionType = 'door';
        // Remove any custom getInteractLabel so default 'Press E to open door' is shown
        if (typeof mesh.userData.getInteractLabel === 'function') delete mesh.userData.getInteractLabel;
        // Refresh cached interactables so the indicator system picks it up immediately
        if (typeof refreshInteractableCache === 'function') refreshInteractableCache();
        console.log('[Door] officeDoor2 mesh marked interactable and cache refreshed');
      } else {
        console.warn('[Door] officeDoor2 mesh not found in scene while unlocking');
      }
    } catch (err) { console.warn('[Door] Error ensuring officeDoor2 interactable', err && err.message); }
    // Also disable the keycode terminal so it cannot be reused after successful entry
    try {
      const keypad = scene.getObjectByName('Object_7');
      if (keypad) {
        // mark as no longer interactable and change interactionType so HUD won't show 'Enter Code'
        keypad.userData.interactable = false;
        keypad.userData.interactionType = 'keycode-used';
        // Refresh cache to remove it from the interactable list
        if (typeof refreshInteractableCache === 'function') refreshInteractableCache();
        console.log('[Keycode] Disabled Object_7 after successful code entry');
      }
    } catch (err) { console.warn('[Keycode] Error disabling Object_7', err && err.message); }
  }

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
    
  if (nearest) {
      console.log('[Interact] E pressed. nearest=', nearest.name, 'interactionType=', nearest.userData?.interactionType, 'hasOnInteract=', typeof nearest.userData?.onInteract === 'function');
      // Debug: list hinged doors
      if (Array.isArray(window.levelHingedDoors)) {
        console.log('[Interact] levelHingedDoors count=', window.levelHingedDoors.length, window.levelHingedDoors.map(h=>h.mesh.name));
      }
      // Check if this is Object_7 (keycode terminal)
  if (nearest.name === 'Object_7' && nearest.userData.interactionType === 'keycode') {
        // Require a tighter distance for the keycode terminal so player must be very close
        const distToTerminal = camera.position.distanceTo(nearest.getWorldPosition(new THREE.Vector3()));
        const KEYCODE_INTERACT_DISTANCE = 1.0; // meters (reduced from global interactionDistance)
        if (distToTerminal > KEYCODE_INTERACT_DISTANCE) {
          console.log(`[Keycode] Too far to interact (dist=${distToTerminal.toFixed(2)} > ${KEYCODE_INTERACT_DISTANCE})`);
        } else {
          // Show keycode interface
          keycodeInterface.style.display = 'block';
          // Unlock controls so player can interact with UI
          controls.unlock();
          console.log('[Keycode] Opening security terminal interface');
        }
      } else if (nearest.name === 'defaultMaterial001_1' && nearest.userData.interactionType === 'computer') {
        // Show email interface
        emailInterface.style.display = 'block';
        // Unlock controls so player can interact with UI
        controls.unlock();
        
        // Trigger level 2 objective progression if in level 2
        if (gameController && typeof gameController.onEmailViewed === 'function') {
          gameController.onEmailViewed();
        }
        
        console.log('[Computer] Opening email terminal interface');
      } else if (nearest.name === 'office2_Log1' && nearest.userData.interactionType === 'note') {
        // Show note interface
        noteInterface.style.display = 'block';
        // Unlock controls so player can interact with UI
        controls.unlock();
        console.log('[Note] Opening handwritten note interface');
      } else if (nearest.name === 'Cube014_1' && nearest.userData.interactionType === 'safebox') {
        // Show safe box interface
        safeboxInterface.style.display = 'block';
        // Clear any previous input
        document.getElementById('safebox-display').textContent = '';
        // Unlock controls so player can interact with UI
        controls.unlock();
        console.log('[SafeBox] Opening safe box interface');
      } else if (nearest.userData.interactionType === 'door') {
        // Prefer calling object-defined interaction (e.g. HingedDoor provides onInteract)
        if (typeof nearest.userData.onInteract === 'function') {
          try { nearest.userData.onInteract(); } catch (e) { console.warn('onInteract failed', e); }
        } else {
          // Fallback to DoorManager lock/unlock toggle
          handleDoorInteraction(nearest);
        }
      } else if (nearest.name === 'Cube003_keyPad_0' && nearest.userData.interactionType === 'keycard-reader') {
        // Check if player has keycard
        if (gameController && gameController.hud && gameController.hud.hasKeycard) {
          console.log('[KeycardReader] Using keycard on reader');
          // Dispatch event to trigger level transition to level3 (blenderL3)
          window.dispatchEvent(new CustomEvent('keycard:used', {
            detail: { targetLevel: 'level3', loadingMessage: 'Entering the experiment testing room' }
          }));
          if (gameController.playPickupSound) gameController.playPickupSound();
        } else {
          console.log('[KeycardReader] No keycard in inventory');
        }
      } else if (nearest.name === 'Mesh_0001' && nearest.userData.interactionType === 'elevator') {
        // Check if flashlight has been obtained
        if (gameController && gameController.hasFlashlight) {
          // Take elevator to level 2
          console.log('[Elevator] Taking elevator to Level 2...');
          progressToLevel2(scene, gameController, camera).then(success => {
            if (success) {
              console.log("[Elevator] Successfully progressed to Level 2");
            }
          });
        } else {
          console.log('[Elevator] Flashlight required to use elevator');
        }
      } else {
        // Regular interaction
        gameController.handleInteraction(nearest);
      }
    }
  });
}

// --- Helpers ---
function resetPlayer() {
  camera.position.set(0, 1.7, -5);
  camera.lookAt(0, 1.7, 0);
  console.log('[reset] Player position reset');
}

function initializeDoorManager() {
  console.log('[DoorManager] Initializing DoorManager for Level 2...');
  
  // Initialize DoorManager with door configurations
  const doorConfigs = [
    { name: 'testingRoom1_Door', openAxis: 'y', openAngleDeg: 90, triggerRadius: 3, speed: 1.5 },
    { name: 'officeDoor1', openAxis: 'y', openAngleDeg: 90, triggerRadius: 3, speed: 1.5 },
    // officeDoor2 and J_2b17002 are intentionally omitted so they won't auto-open by proximity.
    // They are handled via per-mesh HingedDoor onInteract (require explicit E press).
  ];

  // Merge per-level registered door configs (if any)
  if (Array.isArray(window.levelDoorConfigs) && window.levelDoorConfigs.length) {
    for (const c of window.levelDoorConfigs) {
      if (!doorConfigs.find(x => x.name === c.name)) doorConfigs.push(c);
    }
    console.log('[DoorManager] Merged per-level door configs:', window.levelDoorConfigs.map(d => d.name));
  }

  doorManager = new DoorManager(
    scene,
    () => camera.position.clone(),
    {
      onOpenBoxAdd: (name, box) => {
        console.log(`[DoorManager] Adding passthrough box for ${name}`);
        collisionState.passthrough.push(box);
        setColliders(collisionState);
      },
      onOpenBoxRemove: (name, box) => {
        console.log(`[DoorManager] Removing passthrough box for ${name}`);
        const index = collisionState.passthrough.indexOf(box);
        if (index > -1) {
          collisionState.passthrough.splice(index, 1);
          setColliders(collisionState);
        }
      }
    },
    doorConfigs
  );

  // Set initial door lock states
  if (doorManager && doorManager.doors) {
    console.log(`[DoorManager] Found ${doorManager.doors.length} doors:`, doorManager.doors.map(d => d.node.name));
    doorManager.doors.forEach(door => {
      // Initially lock doors that require keys/progression
      if (door.node.name === 'officeDoor1' || door.node.name === 'testingRoom1_Door') {
        door.locked = true;
        console.log(`[DoorManager] Initially locked ${door.node.name}`);
      } else {
        door.locked = false;
        console.log(`[DoorManager] Initially unlocked ${door.node.name}`);
      }
    });
  } else {
    console.warn('[DoorManager] No doors found during initialization');
  }
}

// Dev helper: force open all hinged doors (useful when debugging)
window.openAllHingedDoors = function() {
  if (!Array.isArray(window.levelHingedDoors)) return;
  for (const hd of window.levelHingedDoors) {
    try { hd.open(); console.log('[Dev] Opening hinged door', hd.mesh.name); } catch (e) { console.warn('openAllHingedDoors failed', e); }
  }
};

function handleDoorInteraction(doorObject = null) {
  // Fallback: try to initialize DoorManager if it's not ready yet
  if (!doorManager) {
    console.log('[Door] DoorManager not initialized, attempting to initialize now...');
    initializeDoorManager();
    if (!doorManager) {
      console.warn('[Door] Failed to initialize DoorManager');
      return;
    }
  }
  
  console.log(`[Door] DoorManager has ${doorManager.doors.length} doors:`, doorManager.doors.map(d => d.node.name));
  
  let targetDoor = doorObject;
  
  // If no door object provided, find nearest door (fallback)
  if (!targetDoor) {
    const interactionDistance = 3.5;
    let nearestDoor = null;
    let bestDistance = interactionDistance;
    
    scene.traverse((obj) => {
      if (obj.userData?.interactionType === 'door') {
        const distance = camera.position.distanceTo(obj.getWorldPosition(new THREE.Vector3()));
        if (distance <= interactionDistance && distance < bestDistance) {
          bestDistance = distance;
          nearestDoor = obj;
        }
      }
    });
    targetDoor = nearestDoor;
  }
  
  if (targetDoor) {
    console.log(`[Door] Interacting with door: ${targetDoor.name}`);
    // Toggle door lock state
    const doorData = doorManager.doors.find(d => d.node.name === targetDoor.name);
    if (doorData) {
      doorData.locked = !doorData.locked;
      const state = doorData.locked ? 'locked' : 'unlocked';
      console.log(`[Door] ${targetDoor.name} is now ${state}`);
      
      // Show feedback to player
      showDoorFeedback(targetDoor.name, state);
      
      // Update objectives if this is a significant door
      if (targetDoor.name === 'officeDoor1' && !doorData.locked && gameController) {
        if (typeof gameController.onOfficeDoorUnlocked === 'function') {
          gameController.onOfficeDoorUnlocked();
        }
      }
    } else {
      console.log(`[Door] No door manager data found for ${targetDoor.name}`);
      console.log(`[Door] Available doors in manager:`, doorManager.doors.map(d => d.node.name));
    }
  } else {
    console.log('[Door] No door found for E key interaction');
  }
}

function showDoorFeedback(doorName, state) {
  // Create temporary feedback element
  const feedback = document.createElement('div');
  feedback.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8); color: white; padding: 15px 25px;
    border-radius: 8px; font-family: monospace; font-size: 14px;
    z-index: 1500; border: 2px solid ${state === 'unlocked' ? '#00ff00' : '#ff0000'};
    text-align: center;
  `;
  feedback.textContent = `${doorName} is now ${state.toUpperCase()}`;
  document.body.appendChild(feedback);
  
  // Remove after 2 seconds
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.parentNode.removeChild(feedback);
    }
  }, 2000);
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

// Function to log the object currently being looked at
function logCurrentlyLookingAt() {
  if (!controls.isLocked) return;

  // Create raycaster from camera center
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(0, 0); // Screen center
  raycaster.setFromCamera(mouse, camera);

  // Cast ray and get intersections
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    const hitObject = intersects[0].object;
    const distance = intersects[0].distance.toFixed(2);
    
    // Create detailed info about the object
    const objectInfo = {
      name: hitObject.name || 'unnamed',
      type: hitObject.type,
      distance: `${distance}m`,
      position: {
        x: hitObject.position.x.toFixed(2),
        y: hitObject.position.y.toFixed(2), 
        z: hitObject.position.z.toFixed(2)
      },
      isInteractable: hitObject.userData?.interactable || false,
      userData: hitObject.userData
    };

    console.log(`[Looking At] ${objectInfo.name} (${objectInfo.type}) - Distance: ${objectInfo.distance}`, objectInfo);
  } else {
    console.log('[Looking At] Nothing in sight');
  }
}

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
  
  // Also check for keycard reader even if not marked as interactable
  scene.traverse((obj) => {
    if (obj.name === 'Cube003_keyPad_0' && obj.userData?.interactionType === 'keycard-reader') {
      const d = camera.position.distanceTo(obj.getWorldPosition(new THREE.Vector3()));
      if (d <= interactionDistance && d < best) { target = obj; best = d; }
    }
  });

  if (target) {
    interactionIndicator.style.display = "block";
    const p = target.getWorldPosition(new THREE.Vector3()); 
    
    // Check if target is a generator to customize the prompt
    const isGenerator = target.name === "powerpulse1";
    const isKeycodTerminal = target.name === "Object_7" && target.userData.interactionType === "keycode";
    const isComputer = target.name === "defaultMaterial001_1" && target.userData.interactionType === "computer";
    const isNote = target.name === "office2_Log1" && target.userData.interactionType === "note";
    const isSafeBox = target.name === "Cube014_1" && target.userData.interactionType === "safebox";
    const isElevator = target.name === "Mesh_0001" && target.userData.interactionType === "elevator";
    const isDoor = target.userData.interactionType === "door";
    const isKeycardReader = target.name === "Cube003_keyPad_0" && target.userData.interactionType === "keycard-reader";
    
    if (isGenerator) {
      p.y += 0.2; // Lower position for generator
      interactionIndicator.textContent = "Press E to Turn on";
    } else if (isKeycodTerminal) {
      p.y += 0.5; // Higher position for keycode terminal
      interactionIndicator.textContent = "Press E to Enter Code";
    } else if (isComputer) {
      p.y += 0.5; // Higher position for computer
      interactionIndicator.textContent = "Press E to use Computer";
    } else if (isNote) {
      p.y += 0.5; // Higher position for note
      interactionIndicator.textContent = "Press E to read note";
    } else if (isSafeBox) {
      p.y += 0.5; // Higher position for safe box
      interactionIndicator.textContent = "Press E to unlock SafeBox";
    } else if (isDoor) {
      p.y += 0.5; // Higher position for doors
      // If the object provides a custom interact label (e.g. HingedDoor), use it
      if (typeof target.userData?.getInteractLabel === 'function') {
        interactionIndicator.textContent = target.userData.getInteractLabel();
      } else {
        // Check door lock state and show appropriate prompt
        const doorData = doorManager?.doors.find(d => d.node.name === target.name);
        const isLocked = doorData?.locked ?? false;
        interactionIndicator.textContent = isLocked ? 'Press E to unlock door' : 'Press E to open door';
      }
    } else if (isKeycardReader) {
      p.y += 0.5; // Higher position for keycard reader
      if (gameController && gameController.hud && gameController.hud.hasKeycard) {
        interactionIndicator.textContent = "Press E to use KeyCard";
        target.userData.interactable = true; // Make it interactable when player has keycard
      } else {
        interactionIndicator.textContent = "Keycard required";
        target.userData.interactable = false; // Not interactable without keycard
      }
    } else if (isElevator) {
      p.y += 0.5; // Higher position for elevator
      if (gameController && gameController.hasFlashlight) {
        interactionIndicator.textContent = "Press E to take Elevator";
      } else {
        interactionIndicator.textContent = "Flashlight required";
      }
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
let lastFrameTime = 0;
let averageFPS = 60;

// Performance debug display (optional)
let fpsDisplay = null;
if (window.location.search.includes('debug')) {
  fpsDisplay = document.createElement('div');
  fpsDisplay.style.cssText = `
    position: fixed; top: 10px; right: 10px; 
    background: rgba(0,0,0,0.7); color: white; 
    padding: 5px 10px; font-family: monospace; 
    font-size: 12px; border-radius: 3px; z-index: 9999;
  `;
  document.body.appendChild(fpsDisplay);
}

function animate() {
  const dt = Math.min(0.1, clock.getDelta());   // clamp large frame gaps
  frameCount++;
  
  // Performance monitoring
  const currentTime = performance.now();
  const frameDelta = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  
  // Calculate rolling average FPS
  if (frameDelta > 0) {
    const instantFPS = 1000 / frameDelta;
    averageFPS = averageFPS * 0.95 + instantFPS * 0.05; // Smooth average
  }
  
  // Update FPS display every 30 frames
  if (fpsDisplay && frameCount % 30 === 0) {
    const meshCount = scene.children.filter(child => child.isMesh).length;
    fpsDisplay.textContent = `FPS: ${Math.round(averageFPS)} | Meshes: ${meshCount}`;
  }

  update(dt);                                   // drive unified controls
  if (doorManager) {
    doorManager.update(dt);                     // update door animations
  }
  // Update any lightweight hinged doors created by level loaders
  if (Array.isArray(window.levelHingedDoors) && window.levelHingedDoors.length) {
    for (const hd of window.levelHingedDoors) {
      try { hd.update(dt); } catch (e) { console.warn('HingedDoor update failed', e); }
    }
  }
  if (gameController && !gameController.isPaused()) {
    gameController.update();                    // HUD / flashlight / gameplay ticks
    
    // Log what object we're currently looking at (every 60 frames to avoid spam)
    if (frameCount % 60 === 0) {
      logCurrentlyLookingAt();
    }
    
    // Adaptive performance: reduce interaction check frequency if FPS is low
    const checkInterval = averageFPS < 30 ? 6 : (averageFPS < 45 ? 4 : 3);
    if (frameCount % checkInterval === 0) {
      checkForInteractables();                  // proximity UI
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
