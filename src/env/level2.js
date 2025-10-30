//level2
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { assetUrl } from "../utils/assets.js";

export default async function loadLevel2(scene) {
  const loader = new GLTFLoader();

  try{
    const gltf = await loader.loadAsync(assetUrl("blenderL2.glb"));

    const facility = gltf.scene;
    facility.scale.set(1, 1, 1);
    facility.position.set(0, 0, 0);

    // Performance optimization: Reduce polygon count for distant objects
    let meshCount = 0;
    let optimizedCount = 0;
    const colliders = [];
    const rayTargets = [];

    // Enable shadows and optimize meshes
    facility.traverse((child) => {
      if (child.isMesh) {
        if (child.name === 'map') {
          child.visible = false;
          if (child.userData) {
            child.userData.interactable = false;
            delete child.userData.interactionType;
          }
          console.log('[Level2] Disabled unused map mesh');
          return;
        }

        meshCount++;
        child.castShadow = true;
        child.receiveShadow = true;

        // Performance optimization: Reduce shadow quality for smaller objects
        if (child.geometry.boundingSphere) {
          const radius = child.geometry.boundingSphere.radius;
          if (radius < 0.5) {
            child.castShadow = false; // Small objects don't cast shadows
            optimizedCount++;
          }
        }

        // Optimize materials for better performance
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              if (mat.map) {
                mat.map.generateMipmaps = false; // Reduce texture memory
              }
            });
          } else {
            if (child.material.map) {
              child.material.map.generateMipmaps = false;
            }
          }
        }

        // Add to collision detection
        const box = new THREE.Box3().setFromObject(child);
        if (isFinite(box.min.x) && isFinite(box.min.y) && isFinite(box.min.z) &&
            isFinite(box.max.x) && isFinite(box.max.y) && isFinite(box.max.z)) {
          colliders.push(box);
          rayTargets.push(child);
        }

        // Mark interactable objects
        if (child.name && (child.name.toLowerCase().includes('door') || child.name.toLowerCase().includes('log'))) {
          child.userData.interactable = true;
          console.log(`[Level2] Marked as interactable: ${child.name}`);
        }
        // Make Cube_Door_0 explicitly uninteractable
        if (child.name === 'Cube_Door_0') {
          child.userData.interactable = false;
          delete child.userData.interactionType;
          console.log('[Level2] Cube_Door_0 set to uninteractable');
        }

        // Mark Object_7 as special keycode terminal
        if (child.name === 'Object_7') {
          child.userData.interactable = true;
          child.userData.interactionType = 'keycode';
          console.log(`[Level2] Marked Object_7 as keycode terminal`);
        }

        // Mark defaultMaterial001_1 as computer terminal
        if (child.name === 'defaultMaterial001_1') {
          child.userData.interactable = true;
          child.userData.interactionType = 'computer';
          console.log(`[Level2] Marked defaultMaterial001_1 as computer terminal`);
        }

        // Mark office2_Log1 as handwritten note
        if (child.name === 'office2_Log1') {
          child.userData.interactable = true;
          child.userData.interactionType = 'note';
          console.log(`[Level2] Marked office2_Log1 as handwritten note`);
        }

        // Mark Cube014_1 as safe box
        if (child.name === 'Cube014_1') {
          child.userData.interactable = true;
          child.userData.interactionType = 'safebox';
          console.log(`[Level2] Marked Cube014_1 as safe box`);
        }

        // Mark doors as interactable
        // Mark doors as interactable
        if (child.name === 'testingRoom1_Door' || child.name === 'officeDoor1' || child.name === 'officeDoor2' || child.name === 'J_2b17002') {
          child.userData.interactable = true;
          child.userData.interactionType = 'door';
          console.log(`[Level2] Marked ${child.name} as door`);
        }

        // Mark keycard reader as interactable (conditionally)
        if (child.name === 'Cube003_keyPad_0') {
          child.userData.interactionType = 'keycard-reader';
          console.log(`[Level2] Found ${child.name} as keycard reader`);
        }

        //logs for level 2
        if (child.name === 'testingRoom1_Log1' || child.name === 'testingRoom1_Log2' || child.name === 'testingRoom2_Log1' || child.name === 'testingRoom2_Log2' 
          || child.name === 'office2_Log2' || child.name === 'office1_Log1') {
          child.userData.interactable = true;
          child.userData.interactionType = 'log';
          console.log(`[Level2] Marked ${child.name} as log`);
        }

      }
    });

    scene.add(facility);

    console.log('[Level2] Setting up battery interactables...');

    const batteryNames = [
      'battery1', 'battery2', 'battery3.001', 'battery3.002',
      'battery3.003', 'battery3.004', 'battery3.005', 'battery3.006'
    ];

    let batteriesMarked = 0;

    // First pass: exact name matches
    facility.traverse((child) => {
      if (batteryNames.includes(child.name)) {
        child.userData.interactable = true;
        child.userData.interactionType = 'battery';
        batteriesMarked++;
        console.log(`[Level2] ✅ Battery marked (exact): ${child.name}`);
      }
    });

    facility.traverse((child) => {
      if (child.name && !child.userData.interactable) {
        const nameLower = child.name.toLowerCase();
        if (nameLower.includes('battery') || nameLower.includes('batt')) {
          child.userData.interactable = true;
          child.userData.interactionType = 'battery';
          batteriesMarked++;
          console.log(`[Level2] ✅ Battery marked (partial): ${child.name}`);
        }
      }
    });

    console.log(`[Level2] Total batteries marked: ${batteriesMarked}`);

    // Debug: List all objects if no batteries found
    if (batteriesMarked === 0) {
      console.warn('[Level2] ⚠️ NO BATTERIES FOUND! Listing all objects:');
      let count = 0;
      facility.traverse((child) => {
        if (child.name && count < 100) {
          console.log(`  - ${child.name}`);
          count++;
        }
      });
    }



    // Add hinged door helper and create HingedDoor for supplyRoomdoor001 and other doors
    function computeHingePoint(node, side = 'right') {
      node.updateWorldMatrix(true, false);
      let localBox = null;
      if (node.geometry) {
        if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
        if (node.geometry.boundingBox) localBox = node.geometry.boundingBox.clone();
      }
      if (localBox) {
        const min = localBox.min.clone();
        const max = localBox.max.clone();
        const size = localBox.getSize(new THREE.Vector3());
        const hingeAlongX = size.x >= size.z;
        const hingeLocal = new THREE.Vector3();
        if (hingeAlongX) {
          hingeLocal.set(side === 'right' ? max.x : min.x, (min.y + max.y) * 0.5, (min.z + max.z) * 0.5);
        } else {
          hingeLocal.set((min.x + max.x) * 0.5, (min.y + max.y) * 0.5, side === 'right' ? max.z : min.z);
        }
        return hingeLocal.applyMatrix4(node.matrixWorld);
      }
      const box = new THREE.Box3().setFromObject(node);
      if (!isFinite(box.min.x)) return null;
      const center = box.getCenter(new THREE.Vector3());
      const min = box.min, max = box.max;
      return new THREE.Vector3(side === 'right' ? max.x : min.x, center.y, center.z);
    }

    function wrapWithHingePivotRobust(node, side = 'right', debug = false) {
      const parent = node.parent;
      if (!parent) return null;
      const hingeWorld = computeHingePoint(node, side);
      if (!hingeWorld) { console.warn('[level2] hinge point not found for', node.name); return null; }
      const parentInv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
      const hingeLocal = hingeWorld.clone().applyMatrix4(parentInv);
      const pivot = new THREE.Object3D();
      pivot.name = node.name + '_hingePivot';
      pivot.position.copy(hingeLocal);
      parent.add(pivot);
      pivot.updateWorldMatrix(true, false);
      const nodeWorldMatrix = node.matrixWorld.clone();
      parent.remove(node);
      pivot.add(node);
      const invPivotWorld = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
      node.matrix.copy(new THREE.Matrix4().multiplyMatrices(invPivotWorld, nodeWorldMatrix));
      node.matrix.decompose(node.position, node.quaternion, node.scale);
      node.updateWorldMatrix(true, false);
      node.userData.hinged = true;
      try {
        if (debug) {
          const box = new THREE.Box3().setFromObject(node);
          const helper = new THREE.Box3Helper(box, 0xff0000);
          helper.userData.ignoreInteract = true;
          node.add(helper);
        }
      } catch(err) {
        console.warn('[level2] hinge helper debug add failed', err && err.message);
      }
      return pivot;
    }

    // Heuristic: choose hinge side so the door opens inward (toward parent center)
    function chooseHingeSideInward(node, openAngleRad = Math.PI/2) {
      try {
        const parent = node.parent;
        if (!parent) return 'right';
        const parentBox = new THREE.Box3().setFromObject(parent);
        const parentCenter = parentBox.getCenter(new THREE.Vector3());

        const box = new THREE.Box3().setFromObject(node);
        const centroid = box.getCenter(new THREE.Vector3());

        const sides = ['left','right'];
        let bestSide = 'right';
        let bestDelta = Infinity;

        for (const s of sides) {
          const hinge = computeHingePoint(node, s);
          if (!hinge) continue;
          const v = centroid.clone().sub(hinge);
          const cos = Math.cos(openAngleRad), sin = Math.sin(openAngleRad);
          const rx = v.x * cos - v.z * sin;
          const rz = v.x * sin + v.z * cos;
          const rotated = new THREE.Vector3(rx, v.y, rz).add(hinge);
          const dist = rotated.distanceTo(parentCenter);
          if (dist < bestDelta) { bestDelta = dist; bestSide = s; }
        }
        return bestSide;
      } catch {
        return 'right';
      }
    }

    class HingedDoor {
      constructor(node, { side = 'right', openAngleDeg = 90, speed = 6.0 } = {}) {
        this.mesh = node;
        this.pivot = wrapWithHingePivotRobust(node, side);
        if (!this.pivot) throw new Error('Failed to create hinge pivot for ' + node.name);
        this.openAngle = THREE.MathUtils.degToRad(openAngleDeg);
        this.speed = speed;
        this.current = 0;
        this.target = 0;
        this.mesh.userData.interactable = true;
        this.mesh.userData.interactionType = 'door';
        this.mesh.userData.onInteract = () => { this.toggle(); console.log('[HingedDoor] onInteract called for', node.name); };
        this.mesh.userData.getInteractLabel = () => 'Press E to open/close';
        console.log('[HingedDoor] created for', node.name, 'pivot:', this.pivot ? this.pivot.name : 'none');
      }
      open(){ this.target = this.openAngle; }
      close(){ this.target = 0; }
      toggle(){ this.target = (Math.abs(this.target) > 1e-3) ? 0 : this.openAngle; }
      update(dt){ const next = THREE.MathUtils.damp(this.current, this.target, this.speed, dt); const delta = next - this.current; this.current = next; this.pivot.rotateOnAxis(new THREE.Vector3(0,1,0), delta); }
    }

    // create hinged doors for supply room and other doors
    try {
      const doorNames = ['supplyRoomdoor001','testingRoom1_Door','officeDoor1','officeDoor2','J_2b17002'];
      // Per-door forced hinge side overrides when heuristic fails for a specific mesh.
      const forcedHingeSides = {
        // J_2b17002 was observed to open outward and block corridor; force it to open 'left' (inward)
        'J_2b17002': 'left'
      };
      window.levelHingedDoors = window.levelHingedDoors || [];
      for (const name of doorNames) {
        let node = facility.getObjectByName(name) || facility.getObjectByProperty('name', name);
        if (!node) { const want = name.toLowerCase(); facility.traverse(o => { if (!node && o.name && o.name.toLowerCase().includes(want)) node = o; }); }
        if (!node) { console.log('[Level2] Door node not found for', name); continue; }
        const already = window.levelHingedDoors.find(h => h.mesh === node || h.mesh.name === node.name);
        if (already) { console.log('[Level2] HingedDoor already exists for', node.name); continue; }
        // Allow explicit override per door name first, otherwise use heuristic
        let preferredSide = forcedHingeSides[node.name] || 'right';
        if (!forcedHingeSides[node.name]) {
          try { preferredSide = chooseHingeSideInward(node, THREE.MathUtils.degToRad(90)); } catch { preferredSide = 'right'; }
        } else {
          console.log('[Level2] Forcing hinge side for', node.name, '->', preferredSide);
        }
        const hd = new HingedDoor(node, { side: preferredSide, openAngleDeg: 90, speed: 6.0 });
        window.levelHingedDoors.push(hd);
        console.log('[Level2] Created HingedDoor for', node.name);
      }
    } catch(err) { console.warn('[Level2] Could not create hinged doors:', err && err.message); }

    // Dispatch collision event
    window.dispatchEvent(new CustomEvent("level:colliders", {
      detail: { colliders, passthrough: [], rayTargets }
    }));

    // Dispatch level loaded event
    window.dispatchEvent(new CustomEvent("level:loaded", {
      detail: { levelName: "level2" }
    }));

    console.log(`[Level2] GLB loaded | Meshes: ${meshCount} | Optimized: ${optimizedCount} | Colliders: ${colliders.length}`);

  } catch(error){
    console.error("Error loading Level 2 GLB:", error);
  }
}
