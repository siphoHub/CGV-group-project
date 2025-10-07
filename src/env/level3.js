//level3
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ---- Auto-collider heuristics (non-invasive; works even if you don't rename meshes) ----
const NAME_EXCLUDE = [/^DOOR_/i, /glass/i, /decal/i, /wire/i, /screen/i, /fx/i];
const MATERIAL_EXCLUDE = [/glass/i, /transparent/i, /fx/i];
const MIN_BLOCK_HEIGHT = 0.15;
const MIN_BLOCK_AREA_XZ = 0.25;
const BIG_FLOOR_NAME = /floor|ground|tile/i;

// ---- Ultra-loose name matching (strips spaces, _, -, and .) ----
function normalizeName(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[\s_\-.]+/g, ""); // strip spaces/underscores/hyphens/dots
}
function getNodeByLooseName(root, targetName) {
  if (!targetName) return null;

  // 1) exact fast path
  let node = root.getObjectByName(targetName);
  if (node) return node;

  // 2) collect all named nodes once
  const all = [];
  root.traverse(o => { if (o.name) all.push(o); });

  // 3) case-insensitive exact
  const tLower = targetName.toLowerCase();
  node = all.find(o => o.name.toLowerCase() === tLower);
  if (node) return node;

  // 4) normalized equal
  const tNorm = normalizeName(targetName);
  // try exact normalized equality first
  node = all.find(o => normalizeName(o.name) === tNorm);
  if (node) return node;

  // 5) startsWith either way (normalized) — good for “doorBlue” vs “doorBlue001”
  node = all.find(o => {
    const n = normalizeName(o.name);
    return n.startsWith(tNorm) || tNorm.startsWith(n);
  });
  if (node) return node;

  // 6) includes either way (normalized)
  node = all.find(o => {
    const n = normalizeName(o.name);
    return n.includes(tNorm) || tNorm.includes(n);
  });
  if (node) return node;

  console.warn("[level3] could not find node by name:", targetName);
  return null;
}

/** Rotates the door object (mesh or group) around its own local Y — no handle, no hinge */
class SimpleRotatingDoor {
  constructor(obj, openAngleDeg = 100, speed = 6.0) {
    this.node = obj;
    this.speed = speed;
    this.current = 0;
    this.target = 0;
    this.openAngle = THREE.MathUtils.degToRad(openAngleDeg);

    // Make the door itself interactable; your main.js will show prompt + run E handler
    this.node.userData.interactable = true;
    this.node.userData.onInteract = () => this.toggle();
    this.node.userData.getInteractLabel = () => "Press E to open/close";
  }
  open(){ this.target = this.openAngle; }
  close(){ this.target = 0; }
  toggle(){ this.target = (Math.abs(this.target) > 1e-3) ? 0 : this.openAngle; }
  update(dt) {
    const next = THREE.MathUtils.damp(this.current, this.target, this.speed, dt);
    const delta = next - this.current;
    this.current = next;
    this.node.rotateOnAxis(new THREE.Vector3(0,1,0), delta);
  }
}


// *** Add/remove names here later; we resolve them loosely (case/spacing/dots don't matter).
const PASSABLE_DOOR_NAMES = [
  "door1.001",
  "Green Metal Door.001",
  "doorBlue",
  "Green Metal Door",
];

// *** Makes the given nodes passable
function makeDoorsPassable(root, names, colliders) {
  const passthrough = [];
  const toRemove = [];

  const tmpBox = new THREE.Box3();

  for (const nm of names) {
    const node = getNodeByLooseName(root, nm);
    if (!node) {
      console.warn("[level3] passable door not found:", nm);
      continue;
    }

    // Build a generous box around the door to allow walking through
    const b = new THREE.Box3().setFromObject(node);
    if (!isFinite(b.min.x)) continue;

    // Slightly inflate to be safe (walk-through feels better)
    const size = new THREE.Vector3();
    b.getSize(size);
    const inflate = new THREE.Vector3(
      Math.max(0.2, size.x * 0.15),
      Math.max(0.2, size.y * 0.10),
      Math.max(0.4, size.z * 0.70) // depth gets the biggest bump
    );
    b.expandByVector(inflate);

    passthrough.push(b);
    toRemove.push(b);

    console.log(`[level3] made passable: "${nm}" (resolved "${node.name}")`);
  }

  // Strip any collider boxes that intersect our passthrough zones
  const filtered = colliders.filter(c => {
    for (const r of toRemove) {
      // quick reject
      tmpBox.copy(c);
      if (tmpBox.intersectsBox(r)) return false;
    }
    return true;
  });

  return { passthrough, colliders: filtered };
}

// --- HINGE HELPERS (drop-in) -----------------------------------------------

// Wrap a node in a pivot placed at its hinge edge and keep the door visually unchanged.
function wrapWithHingePivot(node, side = 'left') {
  // 1) make sure world matrices are current
  node.updateWorldMatrix(true, false);

  // 2) compute world AABB of the door
  const box = new THREE.Box3().setFromObject(node);
  if (!isFinite(box.min.x)) {
    console.warn("[level3] couldn't make hinge pivot: invalid bounds for", node.name);
    return null;
  }
  const center = box.getCenter(new THREE.Vector3());
  const min = box.min, max = box.max;

  // Choose hinge along the "X edge" of the door's world AABB.
  // If your doors are modeled on Z, swap to min.z/max.z. (Most doors are wider in X.)
  const hingeWorld = new THREE.Vector3(
    side === 'right' ? max.x : min.x,
    center.y,
    center.z
  );

  const parent = node.parent;
  if (!parent) return null;

  // 3) create pivot at hingeWorld under the same parent as the node
  const pivot = new THREE.Object3D();
  parent.add(pivot);

  // 4) position pivot in the parent's local space
  const parentInv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const hingeLocal = hingeWorld.clone().applyMatrix4(parentInv);
  pivot.position.copy(hingeLocal);
  pivot.updateWorldMatrix(true, false);

  // 5) reparent node under pivot without moving it visually
  const nodeWorld = node.matrixWorld.clone();
  parent.remove(node);
  pivot.add(node);
  node.matrix.copy(new THREE.Matrix4().multiplyMatrices(pivot.matrixWorld.clone().invert(), nodeWorld));
  node.matrix.decompose(node.position, node.quaternion, node.scale);
  node.updateWorldMatrix(true, false);

  // mark as interactable (so your main shows E prompt etc.)
  node.userData.interactable = true;

  return pivot;
}

// A hinged door that rotates the pivot (not the mesh center)
class HingedDoor {
  constructor(node, { side = 'left', openAngleDeg = 100, speed = 6.0 } = {}) {
    this.mesh = node;
    this.pivot = wrapWithHingePivot(node, side);
    if (!this.pivot) throw new Error("Failed to create hinge pivot for " + node.name);

    this.openAngle = THREE.MathUtils.degToRad(openAngleDeg);
    this.speed = speed;
    this.current = 0;
    this.target = 0;

    // hook up interaction
    this.mesh.userData.onInteract = () => this.toggle();
    this.mesh.userData.getInteractLabel = () => "Press E to open/close";
    this.mesh.userData.isDoor = true;
    this.mesh.userData.toggleDoor = () => this.toggle(); // for your GameController fallback
    this.mesh.userData.requiredKey = "E";
  }
  open(){ this.target = this.openAngle; }
  close(){ this.target = 0; }
  toggle(){ this.target = (Math.abs(this.target) > 1e-3) ? 0 : this.openAngle; }
  update(dt){
    const next = THREE.MathUtils.damp(this.current, this.target, this.speed, dt);
    const delta = next - this.current;
    this.current = next;
    // rotate around local Y of the pivot (typical door hinge axis)
    this.pivot.rotateOnAxis(new THREE.Vector3(0,1,0), delta);
  }
}

// --- EXIT DOOR WIRING -------------------------------------------------------
const EXIT_DOOR_NAMES = [
  "Sketchfab_model.002",
];

function findExitNode(root) {
  // try candidates by loose name
  for (const nm of EXIT_DOOR_NAMES) {
    const n = getNodeByLooseName(root, nm);
    if (n) return n;
  }
  // last resort: pick the *largest door-like* object by bounding box height+width
  let best = null, bestScore = -Infinity;
  root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    const name = (o.name || "").toLowerCase();
    if (!name.includes("door")) return;
    const box = new THREE.Box3().setFromObject(o);
    if (!isFinite(box.min.x)) return;
    const size = new THREE.Vector3(); box.getSize(size);
    const score = size.x + size.y; // “big door-ish”
    if (score > bestScore) { bestScore = score; best = o; }
  });
  return best;
}

function wireExitInteractable(root) {
  const node = findExitNode(root);
  if (!node) { console.warn("[level3] no exit door found"); return null; }

  node.userData.interactable = true;
  node.userData.interactionType = "exit";
  node.userData.getInteractLabel = () => "Press E to Exit";
  // If your main ever calls onInteract directly, this still works:
  node.userData.onInteract = () => {
    window.dispatchEvent(new CustomEvent("level3:exit"));
  };

  console.log(`[level3] exit wired on "${node.name}"`);
  return node;
}

export default async function loadLevel3(scene) {
  const loader = new GLTFLoader();

  try{
    const gltf = await loader.loadAsync("/models/blenderL3.glb");


     const lab = gltf.scene;
      lab.scale.set(1, 1, 1);
      lab.position.set(0, 0, 0);

      // Enable shadows on all meshes
      lab.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

         //mark interactable objects
        }
      });

      scene.add(lab);

      // ------------ Build rayTargets (all visible meshes) ------------
      const rayTargets = [];
      lab.traverse(o => { if (o.isMesh && o.visible !== false) rayTargets.push(o); });

      // ------------ Build colliders ------------
      const colliders = [];
      let namedColliders = 0;

      // Prefer explicit COL_* nodes first (authoring-friendly)
      lab.traverse(o => {
        if (!o.isMesh || o.visible === false) return;
        if ((o.name || "").startsWith("COL_")) {
          const b = new THREE.Box3().setFromObject(o);
          if (isFinite(b.min.x) && b.max.distanceTo(b.min) > 0.02) { colliders.push(b); namedColliders++; }
        }
      });

      if (namedColliders === 0) {
        // Fallback heuristics if no explicit colliders exist
        lab.traverse(o => {
          if (!o.isMesh || o.visible === false) return;
          const name = o.name || "";
          const matName = (o.material?.name || "");
          if (NAME_EXCLUDE.some(rx => rx.test(name))) return;
          if (MATERIAL_EXCLUDE.some(rx => rx.test(matName))) return;

          const box = new THREE.Box3().setFromObject(o);
          if (!isFinite(box.min.x)) return;

          const size = new THREE.Vector3(); box.getSize(size);
          const areaXZ = size.x * size.z;
          const isFloor = BIG_FLOOR_NAME.test(name) || (areaXZ > 4.0 && size.y < 0.4);
          const tallEnough = size.y >= MIN_BLOCK_HEIGHT;
          const areaEnough = areaXZ >= MIN_BLOCK_AREA_XZ;

          if (isFloor || (tallEnough && areaEnough)) colliders.push(box);
        });
        console.log(`[level3] auto-collider mode: ${colliders.length}`);
      } else {
        console.log(`[level3] explicit collider mode: ${colliders.length}`);
      }

      // ---- Explicit blockers (robust matching; handles dots/underscores) ----
      const EXTRA_BLOCKERS = [
        "Wooden Box",
        "Wooden Crate.001",
      ];
      for (const nm of EXTRA_BLOCKERS) {
        const node = getNodeByLooseName(lab, nm);
        if (!node) { console.warn("[level3] extra blocker not found:", nm); continue; }
        const b = new THREE.Box3().setFromObject(node);
        if (isFinite(b.min.x) && b.max.distanceTo(b.min) > 0.02) {
          colliders.push(b);
          console.log("[level3] added explicit collider:", node.name);
        }
      }

      // *** Make specific doors walk-through
      const { passthrough, colliders: filteredColliders } =
      makeDoorsPassable(lab, PASSABLE_DOOR_NAMES, colliders);

      // Dispatch to controls (your main.js listens to this)
      window.dispatchEvent(new CustomEvent("level:colliders", {
        detail: { colliders, filteredColliders, passthrough, rayTargets }
      }));

      wireExitInteractable(lab);

      // ------------ DOORS: configure by name + hinge side ----------------
    const DOOR_CONFIG = [
      { name: "door1",         side: "left",  openAngleDeg: 100, speed: 6.0 },
      { name: "door1.001",     side: "left",  openAngleDeg: 100, speed: 6.0 },
      { name: "doorBlue.001",  side: "right", openAngleDeg: 100, speed: 6.0 },
      { name: "Green Metal Door.001", side: "right", openAngleDeg: 100, speed: 6.0 },
      { name: "doorBlue",      side: "right", openAngleDeg: 100, speed: 6.0 },
      { name: "Green Metal Door", side: "right", openAngleDeg: 100, speed: 6.0 },
    ];

    const doors = [];
    for (const cfg of DOOR_CONFIG) {
      const node = getNodeByLooseName(lab, cfg.name);
      if (!node) { console.warn("[level3] door not found:", cfg.name); continue; }
      try {
        const d = new HingedDoor(node, cfg);
        doors.push(d);

        const wp = new THREE.Vector3(); node.getWorldPosition(wp);
        console.log(`[level3] door hinged: "${cfg.name}" → "${node.name}" (side=${cfg.side}) at`, wp.toArray().map(n => +n.toFixed(2)));
      } catch (e) {
        console.warn("[level3] failed to hinge door", cfg.name, e);
      }
    }
      // drive door animations each frame (main.js calls this if present)
      scene.userData.levelTick = (dt) => { for (const d of doors) d.update(dt); };

      //test if the model loads in browser
      console.log("GLB loaded");
  }

  catch(error){
    console.error("Error loading GLB:", error);
  }

}
