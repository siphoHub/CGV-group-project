// src/core/levelLoader.js
import loadLevel1 from "../env/level1.js";
import loadLevel2 from "../env/level2.js";
import loadLevel3 from "../env/level3.js";

let currentLevel = null;
let currentRoot  = null;   // <- the Group returned by the env loader
let isTransitioning = false;

export function getCurrentLevel() { 
  return currentLevel; 
}

export function isLevelTransitioning() { 
  return isTransitioning; 
}

//Load a level and set currentRoot/currentLevel. 
//Returns a Promise<Group|null>.
export function loadLevel(levelName, scene) {
  let p;
  if (levelName === "level1") p = loadLevel1(scene);
  else if (levelName === "level2") p = loadLevel2(scene);
  else if (levelName === "level3") p = loadLevel3(scene);
  else return Promise.reject(new Error(`Level ${levelName} not found`));

  return p.then(root => {
    currentRoot  = root;
    currentLevel = levelName;
    // Some env loaders already dispatch "level:loaded" — that's fine.
    // Keeping this central assignment ensures we can dispose later.
    return root;
  });
}

//Dispose geometries/materials/textures in a subtree
function disposeObject3D(root) {
  if (!root) return;
  root.traverse(node => {
    // geometry
    if (node.geometry) node.geometry.dispose?.();
    // materials + textures
    const mats = node.material
      ? (Array.isArray(node.material) ? node.material : [node.material])
      : [];
    for (const m of mats) {
      for (const k in m) {
        const val = m[k];
        if (val && val.isTexture) val.dispose?.();
      }
      m.dispose?.();
    }
  });
}

/** Clear ONLY the active level’s root (and free GPU resources) */
export function clearCurrentLevel(scene) {
  if (!currentRoot) return;

  // detach from scene
  if (currentRoot.parent) currentRoot.parent.remove(currentRoot);

  // free GPU memory
  disposeObject3D(currentRoot);

  currentRoot = null;
  currentLevel = null;

  // also clear colliders for controls
  window.dispatchEvent(new CustomEvent("level:colliders", {
    detail: { colliders: [], passthrough: [], rayTargets: [] }
  }));

  // stop any per-level ticking
  if (scene.userData?.levelTick) delete scene.userData.levelTick;

  console.log("[LevelLoader] Active level disposed & cleared.");
}


// Progress to next level with loading screen
export async function progressToLevel2(scene, gameController, camera) {
  if (currentLevel !== "level1" || isTransitioning) {
    return false;
  }
  
  console.log("[LevelLoader] Starting transition to Level 2...");
  isTransitioning = true;
  
  // Show loading screen
  showLoadingScreen();
  
  try {
    // Clear current level
    clearCurrentLevel(scene);
    
    // Clear cached interactables
    if (window.cachedInteractables) {
      window.cachedInteractables = [];
    }

    // Load level 2 and wait for it to complete
    console.log("[LevelLoader] Loading Level 2...");
    await loadLevel("level2", scene);
    currentLevel = "level2";

    if (gameController && typeof gameController.setLightingState === 'function')
    {
      gameController.setLightingState("dark");
      console.log("[LevelLoader] Lighting set to dark mode for Level 2")
   }

    // Reset player position for level 2
    if (camera) {
      camera.position.set(0, 1.7, -5);
      camera.lookAt(0, 1.7, 0);
      console.log("[LevelLoader] Player position reset for Level 2");
    }

    // Ensure flashlight functionality is preserved in level 2
    if (gameController && gameController.lights && gameController.lights.flashlight) {
      // Re-attach flashlight to camera for level 2
      const flashlight = gameController.lights.flashlight;
      flashlight.userData.isPersistent = true; // Mark as persistent
      console.log("[LevelLoader] Flashlight functionality preserved for Level 2");
    }
    
    // Update objectives for level 2
    if (gameController) {
      // Initialize level 2 specific objectives
      if (typeof gameController.initializeLevel2Objectives === 'function') {
        gameController.initializeLevel2Objectives();
      } else {
        // Fallback if method doesn't exist
        gameController.addObjective("Find clue to open office door");
      }
    }
    
    // Update collision detection for new level
    setTimeout(() => {
      if (window.updateInteractableCache) {
        window.updateInteractableCache();
      }
    }, 100);
    
    console.log("[LevelLoader] Level 2 loading complete!");
    
    // Hide loading screen only after everything is loaded
    setTimeout(() => {
      hideLoadingScreen();
      isTransitioning = false;
      console.log("[LevelLoader] Transition to Level 2 complete!");
    }, 300); // Small delay to ensure everything is ready
    
    return true;
    
  } catch (error) {
    console.error("[LevelLoader] Error during level transition:", error);
    hideLoadingScreen();
    isTransitioning = false;
    return false;
  }
}

// Loading screen functions
function showLoadingScreen() {
  let loadingScreen = document.getElementById('loading-screen');
  
  if (!loadingScreen) {
    loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.innerHTML = `
      <div class="loading-content">
        <h2>LOADING...</h2>
        <div class="loading-spinner"></div>
        <p>Entering new facility...</p>
      </div>
    `;
    loadingScreen.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: monospace;
      color: white;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .loading-content {
        text-align: center;
      }
      .loading-content h2 {
        font-size: 2em;
        margin-bottom: 20px;
        letter-spacing: 2px;
      }
      .loading-spinner {
        width: 50px;
        height: 50px;
        border: 3px solid #333;
        border-top: 3px solid #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 20px auto;
      }
      .loading-content p {
        font-size: 1.2em;
        margin-top: 20px;
        opacity: 0.8;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(loadingScreen);
  }
  
  loadingScreen.style.display = 'flex';
  console.log("[LevelLoader] Loading screen shown");
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
    console.log("[LevelLoader] Loading screen hidden");
  }
}
