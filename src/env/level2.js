// env/level2.js
// Level 2: swing doors on correct local hinge; stable colliders; reliable interactables
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default async function loadLevel2(scene) {
  const loader = new GLTFLoader();

  const colliders = [];
  const rayTargets = [];
  const passthrough = [];

  // ------------ Door config ------------
  // Map the names you actually have. You can add more entries or rely on the heuristic below.
  const DOOR_CONFIGS = [
    // Doors that must use T:
    { name: "testingRoom1_Door", hinge: "left",  openDeg: 100, speed: 0.60, requiredKey: "T" },
    { name: "officeDoor1",       hinge: "left",  openDeg: 100, speed: 0.60, requiredKey: "T" },

    // Doors that use E:
    { name: "officeDoor2",       hinge: "left",  openDeg: 100, speed: 0.60, requiredKey: "E" },

    // Other named doors (default E if not matched by heuristic):
    { name: "LabDoor",                        hinge: "left",  openDeg: 100, speed: 0.60, requiredKey: "E" },
    { name: "Old Wood White Door Metal",     hinge: "left",  openDeg: 100, speed: 0.60, requiredKey: "E" },
    { name: "Old Wood White Door Metal.001", hinge: "left",  openDeg: 100, speed: 0.60, requiredKey: "E" },
    { name: "Old_Wood_White_Door_Metal",     hinge: "left",  openDeg: 100, speed: 0.60, requiredKey: "E" },
    { name: "Old_Wood_White_Door_Metal001",  hinge: "left",  openDeg: 100, speed: 0.60, requiredKey: "E" },
  ];

  const normalize = s => (s||"").toLowerCase().replace(/[\s_.]/g, "");
  const EXACT = new Map(DOOR_CONFIGS.map(c => [c.name.toLowerCase(), c]));
  const NORM  = new Map(DOOR_CONFIGS.map(c => [normalize(c.name), c]));

  function configForName(name) {
    if (!name) return null;
    const low = name.toLowerCase();
    const exact = EXACT.get(low);
    if (exact) return { ...exact };
    const norm = normalize(name);
    const fuzzy = NORM.get(norm);
    if (fuzzy) return { ...fuzzy };
    // Heuristic: any door name that looks like testing*1 or office*1 → T, else E
    if ((/testing.*1/.test(norm) || /office.*1/.test(norm))) {
      return { name, hinge: "left", openDeg: 100, speed: 0.6, requiredKey: "T" };
    }
    // Otherwise E
    return { name, hinge: "left", openDeg: 100, speed: 0.6, requiredKey: "E" };
  }

  function dispatchColliders() {
    window.dispatchEvent(new CustomEvent("level:colliders", {
      detail: { colliders, passthrough, rayTargets }
    }));
  }
  function addPassBoxOnce(box) {
    if (!passthrough.includes(box)) {
      passthrough.push(box);
      dispatchColliders();
    }
  }
  function removePassBox(box) {
    const i = passthrough.indexOf(box);
    if (i !== -1) {
      passthrough.splice(i, 1);
      dispatchColliders();
    }
  }

  /** door animation records */
  const doors = [];

  // --- Correct hinge setup: rotate around the DOOR'S local Y axis (expressed in world space) ---
  function setupDoor(node, cfg) {
    node.updateWorldMatrix(true, false);
    const baseMatrix = node.matrixWorld.clone();

    // World AABB (stable; won’t cause “holes”)
    const worldBox = new THREE.Box3().setFromObject(node);
    const sizeW   = worldBox.getSize(new THREE.Vector3());
    const centerW = worldBox.getCenter(new THREE.Vector3());

    // Keep faces visible from both sides so doors never disappear
    node.traverse((c) => {
      if (c.isMesh) {
        c.frustumCulled = false;
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          for (const m of mats) if (m) m.side = THREE.DoubleSide;
        }
      }
    });

    // LOCAL AABB by transforming world box back by inverse(baseMatrix)
    const invBase = new THREE.Matrix4().copy(baseMatrix).invert();
    const localBox = worldBox.clone().applyMatrix4(invBase);
    const sizeL = localBox.getSize(new THREE.Vector3());

    // Hinge local X at min/max in LOCAL SPACE (hinge: left => min.x, right => max.x)
    const hingeLocalX = (cfg.hinge === "right") ? localBox.max.x : localBox.min.x;
    const localPivot = new THREE.Vector3(
      hingeLocalX,
      (localBox.min.y + localBox.max.y) * 0.5,
      (localBox.min.z + localBox.max.z) * 0.5
    );
    // Convert pivot to world
    const pivotWorld = localPivot.clone().applyMatrix4(baseMatrix);

    // Axis: door’s local +Y axis, expressed in world space
    const axisY = new THREE.Vector3().setFromMatrixColumn(baseMatrix, 1).normalize();

    // Build world basis to place the invisible “handle/anchor”
    const axisX = new THREE.Vector3().setFromMatrixColumn(baseMatrix, 0).normalize();
    const axisZ = new THREE.Vector3().setFromMatrixColumn(baseMatrix, 2).normalize();

    const handleSide = (cfg.hinge === "right") ? -1 : +1;

    // ⬇️ Anchor is closer so the player is within your 1.8m interact range by default.
    const anchorPos = centerW.clone()
      .add(axisZ.clone().multiplyScalar(0.25))                                 // was 0.35
      .add(axisX.clone().multiplyScalar(handleSide * Math.max(0.45, sizeL.x*0.4))); // was 0.6/0.45

    const anchor = new THREE.Object3D();
    anchor.name = `${node.name}_Interact`;
    anchor.position.copy(anchorPos);
    anchor.userData.interactable = true;
    anchor.userData.isDoor = true;
    anchor.userData.requiredKey = (cfg.requiredKey === "T") ? "T" : "E";
    anchor.userData.toggleDoor = () => {
      const d = doors.find(x => x.node === node);
      if (!d) return;
      d.target = d.target > 0 ? 0 : 1;   // toggle open/close
    };
    scene.add(anchor);

    // Also mark the actual door mesh as interactable (so “E” scanning finds it too)
    node.userData.interactable = true;
    node.userData.isDoor = true;
    node.userData.requiredKey = anchor.userData.requiredKey;
    node.userData.toggleDoor  = anchor.userData.toggleDoor;

    // Pro-pass region that opens when door is 25% opened (lets you walk through)
    const passW  = Math.max(0.8, sizeW.x) * 1.05;
    const passH  = Math.max(2.0, sizeW.y) * 1.10;
    const passD  = Math.max(0.3, sizeW.z) * 1.50;
    const passMin = new THREE.Vector3(centerW.x - passW * 0.5, centerW.y - passH * 0.5, centerW.z - passD * 0.5);
    const passMax = new THREE.Vector3(centerW.x + passW * 0.5, centerW.y + passH * 0.5, centerW.z + passD * 0.5);
    const passBox = new THREE.Box3(passMin, passMax);

    // Opportunistically seed your cache immediately (safe if not present)
    if (Array.isArray(window.cachedInteractables)) {
      window.cachedInteractables.push(anchor);
      window.cachedInteractables.push(node);
    }

    return {
      node,
      name: node.name,
      baseMatrix,
      pivotWorld,
      axisY,                                // rotate around this axis (world-space)
      openRad: THREE.MathUtils.degToRad(cfg.openDeg ?? 100),
      speed: Math.max(0.15, cfg.speed ?? 0.6),
      t: 0,          // 0..1 opened amount (animation param)
      target: 0,     // desired t (0 closed, 1 open)
      passBox,
      added: false,  // passBox added yet?
      anchor,
      requiredKey: anchor.userData.requiredKey,
    };
  }

  // Compose rotation about arbitrary world axis at world-space pivot:
  // M = T(p) * R_axis(angle) * T(-p) * baseMatrix
  const _T1 = new THREE.Matrix4();
  const _T2 = new THREE.Matrix4();
  const _R  = new THREE.Matrix4();
  function applyDoorPose(d) {
    const angle = d.t * d.openRad;
    _T1.makeTranslation(d.pivotWorld.x, d.pivotWorld.y, d.pivotWorld.z);
    _T2.makeTranslation(-d.pivotWorld.x, -d.pivotWorld.y, -d.pivotWorld.z);
    _R.makeRotationAxis(d.axisY, angle);
    const M = new THREE.Matrix4().multiplyMatrices(_T1, _R).multiply(_T2).multiply(d.baseMatrix);
    d.node.matrixAutoUpdate = false;
    d.node.matrix.copy(M);
  }

  // Animate doors
  let lastTS = performance.now();
  function tickDoors() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTS) / 1000);
    lastTS = now;

    for (const d of doors) {
      if (d.t !== d.target) {
        const step = dt / d.speed;
        d.t = THREE.MathUtils.clamp(d.t + Math.sign(d.target - d.t) * step, 0, 1);

        // smoothstep without distorting the state variable we compare against
        const s = d.t * d.t * (3 - 2 * d.t);
        const saved = d.t; d.t = s;
        applyDoorPose(d);
        d.t = saved;

        if (s >= 0.25 && !d.added) { addPassBoxOnce(d.passBox); d.added = true; }
        else if (s <= 0.05 && d.added) { removePassBox(d.passBox); d.added = false; }
      }
    }
    requestAnimationFrame(tickDoors);
  }

  try {
    const gltf = await loader.loadAsync("/models/blenderL2.glb");
    const facility = gltf.scene;
    facility.scale.set(1, 1, 1);
    facility.position.set(0, 0, 0);

    let meshCount = 0;
    let optimizedCount = 0;

    // Collect colliders and ray targets; avoid heavy material tweaks
    facility.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        child.castShadow = true;
        child.receiveShadow = true;

        // Small perf save on tiny meshes
        if (child.geometry?.boundingSphere) {
          const r = child.geometry.boundingSphere.radius;
          if (r < 0.5) { child.castShadow = false; optimizedCount++; }
        }

        // Don’t mess with UVs/textures, just skip mipmap regen to save memory
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const m of mats) if (m?.map) m.map.generateMipmaps = false;
        }

        const box = new THREE.Box3().setFromObject(child);
        if (
          isFinite(box.min.x) && isFinite(box.min.y) && isFinite(box.min.z) &&
          isFinite(box.max.x) && isFinite(box.max.y) && isFinite(box.max.z)
        ) {
          colliders.push(box);
          rayTargets.push(child);
        }
      }
    });

    scene.add(facility);
    addLevel2Lighting(scene);

    // Build / attach door behaviors
    const hooked = [];
    facility.traverse((o) => {
      if (!o.name) return;
      const cfg = configForName(o.name);
      if (!cfg) return;
      const rec = setupDoor(o, cfg);
      if (rec) { doors.push(rec); hooked.push(`${o.name}[${rec.requiredKey}]`); }
    });

    dispatchColliders();

    // Make sure main picks up interactables even if it cached earlier
    const refresh = () => {
      try {
        if (typeof window.updateInteractableCache === "function") {
          window.updateInteractableCache();
        }
      } catch {}
    };
    refresh();
    setTimeout(refresh, 80);
    requestAnimationFrame(refresh);
    setTimeout(refresh, 300);

    console.log(`[Level2] GLB loaded | Meshes: ${meshCount} | Optimized: ${optimizedCount} | Colliders: ${colliders.length}`);
    console.log(hooked.length ? `[Level2] Swing doors ready: ${hooked.join(", ")}` : "[Level2] No doors matched; check names.");

    requestAnimationFrame(tickDoors);
  } catch (error) {
    console.error("Error loading Level 2 GLB:", error);
  }
}

// ---------------- Lighting (unchanged) ----------------
function addLevel2Lighting(scene) {
  // Very dim facility ambient lighting (dark vibe)
  const hemi = new THREE.HemisphereLight(0x333355, 0x080812, 0.2);
  hemi.userData.isPersistent = true;
  scene.add(hemi);

  const mainLight = new THREE.DirectionalLight(0xccddff, 0.3);
  mainLight.position.set(5, 10, 5);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 512;
  mainLight.shadow.mapSize.height = 512;
  mainLight.shadow.camera.near = 1;
  mainLight.shadow.camera.far = 30;
  mainLight.userData.isPersistent = true;
  scene.add(mainLight);

  const secondaryLight = new THREE.DirectionalLight(0x223344, 0.15);
  secondaryLight.position.set(-5, 8, -3);
  secondaryLight.userData.isPersistent = true;
  scene.add(secondaryLight);

  const redLight = new THREE.PointLight(0xff2222, 0.2, 6);
  redLight.position.set(0, 3, 0);
  redLight.userData.isPersistent = true;
  scene.add(redLight);

  console.log("[Level2] Very dim lighting system initialized - flashlight recommended!");
}
