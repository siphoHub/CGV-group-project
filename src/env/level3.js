//level3
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default async function loadLevel3(scene) {
  const loader = new GLTFLoader();

  try{
    const gltf = await loader.loadAsync("/models/blenderL3.glb");


     const lab = gltf.scene;
      lab.scale.set(1, 1, 1);
      lab.position.set(0, 1.5, 0);

      // Enable shadows on all meshes
      const colliders = [];
      const rayTargets = [];

      lab.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // collect collider bounds
          const box = new THREE.Box3().setFromObject(child);
          if (isFinite(box.min.x) && isFinite(box.min.y) && isFinite(box.min.z) &&
              isFinite(box.max.x) && isFinite(box.max.y) && isFinite(box.max.z)) {
            colliders.push(box);
            rayTargets.push(child);
          }
          // If this mesh is the named door J_2b17, mark it as interactable for the game
          if (child.name) {
            if (child.name === 'J_2b17') {
              child.userData.interactable = true;
              child.userData.interactionType = 'door';
              child.userData.locked = !!child.userData.locked;
              console.log('[Level3] Marked J_2b17 as interactable door (will create hinge)');
            }
            // Make Cube_Door_0 explicitly uninteractable
            if (child.name === 'Cube_Door_0') {
              child.userData.interactable = false;
              delete child.userData.interactionType;
              console.log('[Level3] Cube_Door_0 set to uninteractable');
            }
            // Make supplyRoomdoor001 an interactable door if present
            if (child.name === 'supplyRoomdoor001') {
              child.userData.interactable = true;
              child.userData.interactionType = 'door';
              child.userData.locked = !!child.userData.locked;
              console.log('[Level3] Marked supplyRoomdoor001 as interactable door');
            }
            //mark level 3 map as interactable
            if (child.name === 'map'){
              child.userData.interactable = true;
              child.userData.interactionType = 'map';
              console.log(`[Level3] Marked ${child.name} as mapL3`);
            }
          }
        }
      });

      scene.add(lab);

      if (typeof window !== 'undefined') {
        const bounds = new THREE.Box3().setFromObject(lab);
        if (
          Number.isFinite(bounds.min.x) && Number.isFinite(bounds.max.x) &&
          Number.isFinite(bounds.min.z) && Number.isFinite(bounds.max.z)
        ) {
          const minimapDetail = {
            level: 'level3',
            min: { x: bounds.min.x, z: bounds.min.z },
            max: { x: bounds.max.x, z: bounds.max.z },
            flipY: true
          };
          window.__pendingMinimapDetail = minimapDetail;
          window.dispatchEvent(new CustomEvent('minimap:configure', {
            detail: minimapDetail
          }));
        } else {
          console.warn('[Level3] Unable to compute minimap bounds for level 3');
        }
      }

      // --- Simple hinge helper and HingedDoor class (lightweight, per-level)
      // Robust hinge helper: compute hinge point using local geometry bbox when available,
      // fallback to world AABB, convert to parent-local, create pivot, and reparent preserving visual transform.
      function computeHingePoint(node, side = 'left') {
        node.updateWorldMatrix(true, false);

        // Prefer geometry bounding box in local space if available
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
          // convert local hinge to world
          return hingeLocal.applyMatrix4(node.matrixWorld);
        }

        // Fallback: world AABB
        const box = new THREE.Box3().setFromObject(node);
        if (!isFinite(box.min.x)) return null;
        const center = box.getCenter(new THREE.Vector3());
        const min = box.min, max = box.max;
        const hingeWorld = new THREE.Vector3(side === 'right' ? max.x : min.x, center.y, center.z);
        return hingeWorld;
      }

      function wrapWithHingePivotRobust(node, side = 'left', debug = false) {
        const parent = node.parent;
        if (!parent) return null;

        const hingeWorld = computeHingePoint(node, side);
        if (!hingeWorld) {
          console.warn('[level3] hinge point not found for', node.name);
          return null;
        }

        const parentInv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
        const hingeLocal = hingeWorld.clone().applyMatrix4(parentInv);

        const pivot = new THREE.Object3D();
        pivot.name = node.name + '_hingePivot';
        pivot.position.copy(hingeLocal);
        parent.add(pivot);
        pivot.updateWorldMatrix(true, false);

        // preserve node world transform while reparenting
        const nodeWorldMatrix = node.matrixWorld.clone();
        parent.remove(node);
        pivot.add(node);
        const invPivotWorld = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
        node.matrix.copy(new THREE.Matrix4().multiplyMatrices(invPivotWorld, nodeWorldMatrix));
        node.matrix.decompose(node.position, node.quaternion, node.scale);
        node.updateWorldMatrix(true, false);
        node.userData.hinged = true;

        // Always add a small axes helper so we can visually confirm the pivot in-game
        try {
          pivot.add(new THREE.AxesHelper(0.5));
          if (debug) {
            const box = new THREE.Box3().setFromObject(node);
            const helper = new THREE.Box3Helper(box, 0xff0000);
            helper.userData.ignoreInteract = true;
            node.add(helper);
          }
        } catch (err) {
          console.warn('[level3] hinge helper debug add failed', err && err.message);
        }

        return pivot;
      }

      // Heuristic: pick hinge side ('left'|'right') such that when the door
      // opens by openAngle radians the door's centroid moves closer to the
      // parent (room) center — this approximates "opening inward".
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
            // rotate centroid around hinge by +openAngleRad about Y
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
        constructor(node, { side = 'left', openAngleDeg = 90, speed = 6.0 } = {}) {
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
        update(dt){
          const next = THREE.MathUtils.damp(this.current, this.target, this.speed, dt);
          const delta = next - this.current;
          this.current = next;
          this.pivot.rotateOnAxis(new THREE.Vector3(0,1,0), delta);
        }
      }

      // Instantiate HingedDoor for named doors (create for both Cube_Door_0 and J_2b17 if present)
      try {
        // Create hinged doors for important doors in this level (exclude Cube_Door_0)
        const doorNames = ['J_2b17', 'supplyRoomdoor001'];
        window.levelHingedDoors = window.levelHingedDoors || [];
          for (const name of doorNames) {
          let node = lab.getObjectByName(name) || lab.getObjectByProperty('name', name);
          if (!node) {
            // fuzzy fallback: contains
            const want = name.toLowerCase();
            lab.traverse(o => {
              if (!node && o.name && o.name.toLowerCase().includes(want)) node = o;
            });
          }
          if (!node) {
            console.log('[Level3] Door node not found for', name);
            continue;
          }

          // avoid creating duplicate hinged door for the same mesh
          const already = window.levelHingedDoors.find(h => h.mesh === node || h.mesh.name === node.name);
          if (already) {
            console.log('[Level3] HingedDoor already exists for', node.name);
            continue;
          }

            // choose hinge side to open inward (toward parent center)
            let preferredSide = 'right';
            try { preferredSide = chooseHingeSideInward(node, THREE.MathUtils.degToRad(90)); } catch { preferredSide = 'right'; }
            const hd = new HingedDoor(node, { side: preferredSide, openAngleDeg: 90, speed: 6.0 });
          window.levelHingedDoors.push(hd);
          console.log('[Level3] Created HingedDoor for', node.name);
        }
      } catch (err) {
        console.warn('[Level3] Could not create hinged doors:', err && err.message);
      }

      // Dispatch colliders and rayTargets collected from the GLB so physics,
      // collision queries and spawn raycasts work in Level 3 again.
      window.dispatchEvent(new CustomEvent('level:colliders', {
        detail: { colliders: colliders, passthrough: [], rayTargets: rayTargets }
      }));

      // Dispatch level loaded event
      window.dispatchEvent(new CustomEvent('level:loaded', {
        detail: { levelName: 'level3' }
      }));

      console.log("[Level3] GLB loaded | Colliders:", colliders.length);
  }

  catch(error){
    console.error("Error loading GLB:", error);
  }

}
