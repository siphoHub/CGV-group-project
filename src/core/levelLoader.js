//levelloader
import * as THREE from "three";
import loadLevel1 from "../env/level1.js";
import loadLevel3 from "../env/level3.js";
import loadLevel2 from "../env/level2.js";

let currentLevel = "level1";
let isTransitioning = false;

export function getCurrentLevel() {
  return currentLevel;
}

export function isLevelTransitioning() {
  return isTransitioning;
}

export function loadLevel(levelName, scene) {
  //levelName = "level3" //remove
  currentLevel = levelName;
  switch (levelName) {
    case "level1":
      return loadLevel1(scene);
    case "level2":
      return loadLevel2(scene);
    case "level3":
      return loadLevel3(scene);    
    default:
      console.warn(`Level ${levelName} not found`);
      return Promise.resolve();
  }
}

function waitForEventOnce(eventName, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const on = (e) => {
      window.removeEventListener(eventName, on);
      resolve(e);
    };
    window.addEventListener(eventName, on, { once: true });
    if (timeoutMs > 0) {
      setTimeout(() => {
        window.removeEventListener(eventName, on);
        reject(new Error(`Timed out waiting for ${eventName}`));
      }, timeoutMs);
    }
  });
}


// Clear all level objects from scene while preserving UI, lights, and helpers
function clearCurrentLevel(scene) {
  const objectsToRemove = [];
  
  scene.traverse((child) => {
    // Remove level geometry but preserve lights, camera, helpers, and HUD elements
    if (child.isMesh && 
        !child.userData.ignoreInteract && 
        !child.userData.isLight && 
        !child.userData.isHelper &&
        !child.userData.isPersistent) {
      objectsToRemove.push(child);
    }
    // Also remove the entire model groups
    if (child.isGroup && child.children.length > 0 && !child.userData.isPersistent) {
      let hasLevelGeometry = false;
      child.traverse((grandchild) => {
        if (grandchild.isMesh && !grandchild.userData.ignoreInteract) {
          hasLevelGeometry = true;
        }
      });
      if (hasLevelGeometry) {
        objectsToRemove.push(child);
      }
    }
    
    // Remove old lighting that's not marked as persistent
    if ((child.isDirectionalLight || child.isPointLight || child.isSpotLight || child.isHemisphereLight) && 
        !child.userData.isPersistent && 
        !child.userData.ignoreInteract) {
      objectsToRemove.push(child);
    }
  });
  
  objectsToRemove.forEach(obj => {
    if (obj.parent) {
      obj.parent.remove(obj);
    }
  });

  if (typeof window !== 'undefined') {
    window.__pendingMinimapDetail = null;
    window.__activeMinimapConfig = null;
    window.dispatchEvent(new Event('minimap:clear'));
  }
  
  console.log(`[LevelLoader] Cleared ${objectsToRemove.length} objects from scene`);
  console.log('[LevelLoader] Previous level successfully unloaded from memory');
}

// Progress to next level with loading screen
export async function progressToLevel2(scene, gameController, camera, options = {}) {
  const transitionOptions = {
    message: options.message || "Entering Level 2...",
  };
  if (options.showLoadingScreen === false) {
    transitionOptions.showLoadingScreen = false;
  }
  return transitionToLevel("level2", scene, gameController, camera, transitionOptions);
}

// Generic transition helper: show loading, clear current level, load target, wait for signals
export async function transitionToLevel(levelName, scene, gameController, camera, options) {
  let message = 'LOADING...';
  let showLoading = true;

  if (typeof options === 'string') {
    message = options || message;
  } else if (options && typeof options === 'object') {
    if (typeof options.message === 'string') {
      message = options.message;
    }
    if (options.showLoadingScreen === false) {
      showLoading = false;
    }
  }

  if (isTransitioning) return false;
  console.log(`[LevelLoader] Starting transition to ${levelName}...`);
  isTransitioning = true;

  if (showLoading) {
    showLoadingOverlay(message || 'LOADING...');
  }

  try {
    clearCurrentLevel(scene);

    if (window.cachedInteractables) window.cachedInteractables = [];

    // Start waiting for events *before* we call loadLevel so we don't miss events emitted during loading
    const pColliders = waitForEventOnce('level:colliders', 45000).catch(e => {
      console.warn('[LevelLoader] level:colliders wait failed:', e.message);
      return null;
    });
    const pLoaded = waitForEventOnce('level:loaded', 45000).catch(e => {
      console.warn('[LevelLoader] level:loaded wait failed:', e.message);
      return null;
    });

    await loadLevel(levelName, scene);
    currentLevel = levelName;

    if (gameController) {
      if (levelName === 'level2') {
        if (typeof gameController.setLightingState === 'function') {
          try {
            gameController.setLightingState('dark');
            console.log("[LevelLoader] Lighting set to dark mode for Level 2");
          } catch (err) {
            console.warn('[LevelLoader] setLightingState failed for level2', err);
          }
        }
        if (gameController.lights && gameController.lights.flashlight) {
          const flashlight = gameController.lights.flashlight;
          flashlight.userData.isPersistent = true;
          console.log("[LevelLoader] Flashlight functionality preserved for Level 2");
        }
        if (typeof gameController.initializeLevel2Objectives === 'function') {
          try {
            gameController.initializeLevel2Objectives();
          } catch (err) {
            console.warn('[LevelLoader] initializeLevel2Objectives failed', err);
          }
        } else if (typeof gameController.addObjective === 'function') {
          try {
            gameController.addObjective("Find clue to open office door");
          } catch (err) {
            console.warn('[LevelLoader] addObjective fallback for level2 failed', err);
          }
        }
      } else if (levelName === 'level3') {
        if (typeof gameController.initializeLevel3Objectives === 'function') {
          try {
            gameController.initializeLevel3Objectives();
          } catch (err) {
            console.warn('[LevelLoader] initializeLevel3Objectives failed', err);
          }
        } else {
          try {
            gameController.hud.objectives = [{ id: 1, text: 'Find the Arcade machine', completed: false }];
            gameController.hud.updateObjectivesDisplay();
          } catch (err) {
            console.warn('[LevelLoader] fallback set objectives failed', err);
          }
        }
      }
    }

    // Await colliders/loaded promises which were registered before loading started
    let collidersDetail = null;
    let rayTargetsDetail = null;
    try {
      const collidersEvent = await pColliders;
      collidersDetail = collidersEvent?.detail?.colliders || null;
      rayTargetsDetail = collidersEvent?.detail?.rayTargets || null;
    } catch (e) {
      console.warn('[LevelLoader] level:colliders event handling error:', e.message);
    }

    // Default camera reset for new levels (can be overridden by specific levels)
    if (camera) {
      if (levelName === 'level3') {
        // If colliders are available, pick the best floor-like collider to spawn above it
        let placed = false;
        if (!placed) {
          camera.position.set(5.76, 1.7, -1.07);
          camera.lookAt(-5.25, 1.7, -1.07);
          placed = true;
          console.log('[LevelLoader] Spawn override applied for Level 3');
        }
        // Try to find a named spawn marker first (highest priority)
        try {
          const findByName = (root, name) => {
            if (!root) return null;
            let n = root.getObjectByName && root.getObjectByName(name);
            if (n) return n;
            const want = name.toLowerCase();
            let best = null;
            root.traverse(o => {
              if (!o.name) return;
              if (o.name.toLowerCase() === want) best = best || o;
            });
            if (best) return best;
            root.traverse(o => {
              if (!o.name) return;
              if (o.name.toLowerCase().includes(want)) best = best || o;
            });
            return best;
          };

          const spawnNodeTop = findByName(scene, 'Cube_Door_0') || findByName(scene, 'cube_door_0') || findByName(scene, 'cube door');
          if (spawnNodeTop) {
            const worldPos = spawnNodeTop.getWorldPosition(new THREE.Vector3());
            const eyeOffset = 1.7;
            camera.position.set(worldPos.x - 1, worldPos.y + eyeOffset + 0.1, worldPos.z);
            camera.lookAt(-worldPos.x, worldPos.y + 1.0, worldPos.z);
            placed = true;
            console.log('[LevelLoader] Spawned at Cube_Door_0 (preferred) world position:', camera.position.toArray());
          }
        } catch (err) {
          console.warn('[LevelLoader] Error while checking preferred Cube_Door_0 spawn node:', err && err.message);
        }
        try {
          if (!placed && collidersDetail && Array.isArray(collidersDetail) && collidersDetail.length > 0) {
            // Prefer lowest large flat collider (likely the ground) to avoid roofs.
            let candidate = null;
            let lowestTopY = Infinity;
            const sizeVec = new THREE.Vector3();
            const centerVec = new THREE.Vector3();
            for (const c of collidersDetail) {
              if (!c || typeof c.getSize !== 'function' || typeof c.getCenter !== 'function') continue;
              c.getSize(sizeVec);
              // ignore very thin or tiny colliders
              const areaXZ = Math.abs(sizeVec.x * sizeVec.z);
              const height = Math.abs(sizeVec.y);
              if (areaXZ < 0.5) continue; // too small to be a floor
              // compute top Y of the collider
              c.getCenter(centerVec);
              const topY = centerVec.y + (sizeVec.y / 2);
              // prefer colliders that are relatively flat (not tall) and have low topY
              const heightPenalty = Math.max(0, height - 1.5); // penalize tall blocks (walls/roofs)
              const effectiveTop = topY + heightPenalty;
              if (effectiveTop < lowestTopY) {
                lowestTopY = effectiveTop;
                candidate = { box: c, size: sizeVec.clone(), center: centerVec.clone(), topY };
              }
            }

            if (candidate && candidate.box) {
              try {
                // If rayTargets were provided by the level, raycast down to find the actual surface under the candidate
                let groundY = candidate.topY;
                if (rayTargetsDetail && Array.isArray(rayTargetsDetail) && rayTargetsDetail.length > 0) {
                  const rc = new THREE.Raycaster();
                  const origin = new THREE.Vector3(candidate.center.x, candidate.topY + 10.0, candidate.center.z);
                  const dir = new THREE.Vector3(0, -1, 0);
                  rc.set(origin, dir);
                  const hits = rc.intersectObjects(rayTargetsDetail, true);
                  if (hits && hits.length > 0) {
                    groundY = hits[0].point.y;
                    console.log('[LevelLoader] Raycast snapped to ground at y=', groundY, 'hit=', hits[0].object.name || hits[0].object.id);
                  } else {
                    console.log('[LevelLoader] Raycast found no hits; using collider topY=', candidate.topY);
                  }
                }

                const eyeOffset = 1.7;
                const cameraY = groundY + eyeOffset + 0.1;
                camera.position.set(candidate.center.x, cameraY, candidate.center.z);
                camera.lookAt(candidate.center.x, groundY + 1.0, candidate.center.z);
                placed = true;
                console.log('[LevelLoader] Placed camera at', camera.position.toArray(), 'groundY=', groundY);
              } catch (err) {
                console.warn('[LevelLoader] error during raycast spawn snap:', err);
              }
            }
          }
        } catch (err) {
          console.warn('[LevelLoader] Error computing collider spawn:', err);
        }

        if (!placed) {
          // fallback spawn if colliders and preferred spawn marker are unavailable
          camera.position.set(-15, 3, 0);
          camera.lookAt(0, 1.7, 0);
          console.log('[LevelLoader] Fallback Level3 spawn used');
        }
      } else if (levelName === 'level2') {
        camera.position.set(0, 1.7, -5);
        camera.lookAt(0, 1.7, -10);
      } else if (levelName === 'level1') {
        camera.position.set(0, 1.7, -5);
        camera.lookAt(0, 1.7, -7);
      } else {
        camera.position.set(0, 1.7, -4);
        camera.lookAt(0, 1.7, -10);
      }
      console.log(`[LevelLoader] Player position reset for ${levelName}`);
    }

    // Wait for level:loaded as final signal (colliders already handled above)
    try {
      await pLoaded;
    } catch (e) {
      console.warn('[LevelLoader] level:loaded not received in time:', e?.message);
    }

    console.log(`[LevelLoader] ${levelName} loading complete!`);
    if (showLoading) {
      hideLoadingOverlay();
    }
    isTransitioning = false;
    return true;
  } catch (err) {
    console.error('[LevelLoader] Error during generic level transition:', err);
    if (showLoading) {
      hideLoadingOverlay();
    }
    isTransitioning = false;
    return false;
  }
}

// Loading screen functions
export function showLoadingOverlay(message) {
  let loadingScreen = document.getElementById('loading-screen');
  
  if (!loadingScreen) {
    loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.innerHTML = `
      <div class="loading-content">
        <h2>LOADING...</h2>
        <div class="loading-spinner"></div>
        <p>${message || 'Entering new facility...'}</p>
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
  
  if (message) {
    const msgNode = loadingScreen.querySelector('.loading-content p');
    if (msgNode) {
      msgNode.textContent = message;
    }
  }

  loadingScreen.style.display = 'flex';
  console.log("[LevelLoader] Loading screen shown");
}

export function hideLoadingOverlay() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
    console.log("[LevelLoader] Loading screen hidden");
  }
}
