import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import * as THREE from 'three';

export function createControls(camera, domElement) {
  const controls = new PointerLockControls(camera, domElement);
  domElement.addEventListener('click', () => controls.lock());
  controls.addEventListener('lock',   () => console.log('[controls] LOCKED'));
  controls.addEventListener('unlock', () => console.log('[controls] UNLOCKED'));

  // --- Footstep SFX ---------------------------------------------------------
  // Drop 4–8 eerie footstep clips into /public/models/assets/
  const FOOTSTEP_PATHS = [
    '../public/models/assets/step1.mp3',
    '../public/models/assets/step2.mp3',
    '../public/models/assets/step3.mp3',
    '../public/models/assets/step4.mp3',
    '../public/models/assets/step5.mp3',
    '../public/models/assets/step5.mp3',
    '../public/models/assets/step6.mp3',
    '../public/models/assets/step7.mp3',
    '../public/models/assets/step8.mp3',
    '../public/models/assets/step9.mp3',
    '../public/models/assets/step10.mp3',
  ];
  // Preload a small pool so rapid steps don’t get cut off
  const footstepPool = FOOTSTEP_PATHS.map(p => {
    const a = new Audio(p);
    a.preload = 'auto';
    a.volume = 0.35;         // global footstep volume
    return a;
  });
  let footIdx = 0;           // round-robin in the pool
  let sinceLastStep = 0;     // seconds
  let wasMoving = false;     // edge detect start/stop
 
 function playFootstep() {
    const a = footstepPool[footIdx];
    footIdx = (footIdx + 1) % footstepPool.length;
    a.playbackRate = 0.95 + Math.random() * 0.1;
    try { a.currentTime = 0; a.play(); } catch {
      // Ignore playback errors (e.g., user gesture required)
    }
  }

  // input
  const keys = new Map();
  const set = (e, v) => keys.set(e.code, v);
  addEventListener('keydown', e => set(e, true));
  addEventListener('keyup',   e => set(e, false));

  // speeds / head
  const SPEED_WALK   = 3.5;
  const SPEED_SPRINT = 5.5;
  const SPEED_CROUCH = 1.8;
  const HEAD_STAND   = 1.7; // camera target height
  const HEAD_CROUCH  = 1.2;

  // capsule & padding
  const PLAYER_RADIUS = 0.22; // a touch wider helps with “threading the needle”
  const COLLIDER_PAD  = 0.08;

  // world data (from level)
  let COLLIDERS = [];   // THREE.Box3[]
  let PASSTHROUGH = []; // THREE.Box3[] (optional; not required anymore)
  let RAY_TARGETS = []; // Mesh[] — used for precise clearance test

  function setColliders({ colliders = [], passthrough = [], rayTargets = [] } = {}) {
    COLLIDERS   = colliders;
    PASSTHROUGH = passthrough;
    RAY_TARGETS = rayTargets;
    console.log('[controls] colliders:', COLLIDERS.length, 'passthrough:', PASSTHROUGH.length, 'rayTargets:', RAY_TARGETS.length);
  }

  // helpers
  const tmpFwd   = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const tmpNext  = new THREE.Vector3();
  const UP       = new THREE.Vector3(0,1,0);
  const raycaster = new THREE.Raycaster();

  function insideBoxXZ(p, b, pad = 0) {
    const minX = b.min.x + pad, maxX = b.max.x - pad;
    const minZ = b.min.z + pad, maxZ = b.max.z - pad;
    return (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ);
  }

  // Collide with anything between knee (~0.45m) and head
  function overlapsBodyBand(p, b) {
    const feetY = p.y - HEAD_STAND;
    const kneeY = feetY + 0.45;
    const headY = p.y;
    return !(b.max.y < kneeY || b.min.y > headY);
  }

  function pointInPassthrough(p) {
    for (let i=0;i<PASSTHROUGH.length;i++) {
      const z = PASSTHROUGH[i];
      if (!overlapsBodyBand(p, z)) continue;
      if (insideBoxXZ(p, z, 0)) return true;
    }
    return false;
  }

  // Coarse block test using expanded AABBs
  function positionLooksBlocked(p) {
    if (pointInPassthrough(p)) return false; // named doors still work
    for (let i=0;i<COLLIDERS.length;i++) {
      const b = COLLIDERS[i];
      if (!overlapsBodyBand(p, b)) continue;
      const minX = (b.min.x - PLAYER_RADIUS) + COLLIDER_PAD;
      const maxX = (b.max.x + PLAYER_RADIUS) - COLLIDER_PAD;
      const minZ = (b.min.z - PLAYER_RADIUS) + COLLIDER_PAD;
      const maxZ = (b.max.z + PLAYER_RADIUS) - COLLIDER_PAD;
      if (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ) return true;
    }
    return false;
  }

  // ---------- OPTIMIZED MULTI-RAY CLEARANCE TEST ----------
  // Reduced from 9 rays to 5 rays (3 heights × center + 2 heights × sides) for better performance
  function volumeClear(origin, intendedDir, stepDist) {
    if (!RAY_TARGETS.length || stepDist <= 0) return false; // no targets -> be conservative (blocked)

    const dir = intendedDir.clone().normalize();
    const side = new THREE.Vector3().crossVectors(dir, UP).normalize();

    // Heights relative to feet (reduced to 3: knee, hip, shoulder)
    const hFeet = origin.y - HEAD_STAND;
    const heights = [hFeet + 0.45, hFeet + 0.95, hFeet + 1.35];

    // Side offsets: center and sides (reduced rays)
    const s = PLAYER_RADIUS * 0.9;
    
    // Ray length slightly beyond step to avoid scraping through edges
    const FAR = Math.max(0.25, stepDist + PLAYER_RADIUS * 0.2);

    // Test center rays at all heights
    for (let hi = 0; hi < heights.length; hi++) {
      const start = origin.clone();
      start.y = heights[hi];

      raycaster.set(start, dir);
      raycaster.far = FAR;

      const hits = raycaster.intersectObjects(RAY_TARGETS, true);
      if (hits.length > 0) {
        return false; // something in the way at center
      }
    }

    // Test side rays only at middle height for performance
    const midHeight = hFeet + 0.95;
    for (const offset of [+s, -s]) {
      const start = new THREE.Vector3()
        .copy(origin)
        .addScaledVector(side, offset);
      start.y = midHeight;

      raycaster.set(start, dir);
      raycaster.far = FAR;

      const hits = raycaster.intersectObjects(RAY_TARGETS, true);
      if (hits.length > 0) {
        return false; // something in the way at sides
      }
    }
    
    return true; // no hits on any ray -> real opening ahead
  }

  function update(dt) {
    if (!controls.isLocked) return;

    let forward = 0, right = 0;
    if (keys.get('KeyW') || keys.get('ArrowUp'))    forward += 1;
    if (keys.get('KeyS') || keys.get('ArrowDown'))  forward -= 1;
    if (keys.get('KeyD') || keys.get('ArrowRight')) right   += 1;
    if (keys.get('KeyA') || keys.get('ArrowLeft'))  right   -= 1;

    const sprinting = keys.get('ShiftLeft')   || keys.get('ShiftRight');
    const crouching = keys.get('KeyC');
    const speed = crouching ? SPEED_CROUCH : (sprinting ? SPEED_SPRINT : SPEED_WALK);

    // Footstep cadence
    const STEP_INTERVAL = crouching ? 0.65 : (sprinting ? 0.35 : 0.50);

    const moving = (forward !== 0 || right !== 0);
    if (moving) {
      const inv = 1 / Math.hypot(forward, right);
      forward *= inv; right *= inv;

      controls.getDirection(tmpFwd);
      tmpFwd.y = 0; tmpFwd.normalize();
      tmpRight.crossVectors(tmpFwd, UP).normalize();

      const dist = speed * dt;
      const base = camera.position;
      const intendedDir = tmpFwd.clone().multiplyScalar(forward).add(tmpRight.clone().multiplyScalar(right));

      tmpNext.copy(base)
        .addScaledVector(tmpFwd,  forward * dist)
        .addScaledVector(tmpRight, right   * dist);

      // Collision detection enabled
      if (COLLIDERS.length === 0 && PASSTHROUGH.length === 0) {
        base.copy(tmpNext);
      } else if (!positionLooksBlocked(tmpNext)) {
        base.copy(tmpNext);
      } else if (volumeClear(base, intendedDir, dist)) {
        base.copy(tmpNext);
      } else {
        const dx = tmpFwd.x * forward * dist + tmpRight.x * right * dist;
        const dz = tmpFwd.z * forward * dist + tmpRight.z * right * dist;
        const tryAxis = (ax, az) => {
          tmpNext.set(base.x + ax, base.y, base.z + az);
          if (!positionLooksBlocked(tmpNext) || volumeClear(base, new THREE.Vector3(ax,0,az), Math.hypot(ax,az))) {
            base.set(tmpNext.x, tmpNext.y, tmpNext.z);
            return true;
          }
          return false;
        };
        if (!tryAxis(dx, 0)) tryAxis(0, dz);
      }
    }

    // footsteps timing
    if (moving) {
      sinceLastStep += dt;
      if (!wasMoving) {
        sinceLastStep = Math.min(sinceLastStep, STEP_INTERVAL * 0.6);
      }
      if (sinceLastStep >= STEP_INTERVAL) {
        sinceLastStep = 0;
        playFootstep();
      }
    } else {
      sinceLastStep = 0;
    }
    wasMoving = moving;

    // smooth head height
    const targetY = crouching ? HEAD_CROUCH : HEAD_STAND;
    camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 10);
  }
  return { controls, update, setColliders };
}
