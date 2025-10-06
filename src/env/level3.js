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

      // Dispatch to controls (your main.js listens to this)
      window.dispatchEvent(new CustomEvent("level:colliders", {
        detail: { colliders, passthrough: [], rayTargets }
      }));

      // ------------ DOORS: final confirmed list (rotate-in-place, robust matching) ------------
      const DOOR_NAMES = [
        "door1",
        "door1.001",
        "doorBlue.001",
        "Green Metal Door.001",
        "doorBlue",
        "Green Metal Door",
      ];

      const doors = [];
      for (const name of DOOR_NAMES) {
        const node = getNodeByLooseName(lab, name);
        if (!node) {
          console.warn("[level3] door not found:", name);
          continue;
        }
        const d = new SimpleRotatingDoor(node, 100 /*openAngleDeg*/, 6.0 /*speed*/);
        doors.push(d);

        // Helpful log: the exact node we resolved
        const wp = new THREE.Vector3();
        (node.isObject3D ? node : d.node).getWorldPosition(wp);
        console.log(`[level3] door wired (rotate-in-place): "${name}" (resolved "${node.name}") at`, wp.toArray().map(n=>+n.toFixed(2)));
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
