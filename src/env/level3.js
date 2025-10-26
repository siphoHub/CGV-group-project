//level3
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { endcutscene as EndCutscene } from "../gameplay/endcutscene.js";

export default async function loadLevel3(scene) {
  const loader = new GLTFLoader();

  try{
    const gltf = await loader.loadAsync("/models/blenderL3.glb");


     const lab = gltf.scene;
      lab.scale.set(1, 1, 1);
      lab.position.set(0, 1.5, 0);

      // Track if we've already started the end cutscene (prevents double trigger)
      let hasPlayedLevel3Ending = false;

      // Enable shadows on all meshes
      const colliders = [];
      const rayTargets = [];
      const mapMeshes = [];

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
              child.userData.getInteractLabel = () => 'Press E to pick up map';
              child.userData.isMapPickup = true;
              mapMeshes.push(child);
              console.log(`[Level3] Marked ${child.name} as mapL3`);
            }
          }
        }
      });

      if (mapMeshes.length > 0) {
        // Add a translucent highlight sphere so players can spot the map pickup easily
        const highlightGeometry = new THREE.SphereGeometry(1, 24, 24);
        const baseMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.25,
          depthTest: false,
          depthWrite: false,
        });
        mapMeshes.forEach((mapMesh) => {
          try {
            const highlight = new THREE.Mesh(highlightGeometry, baseMaterial.clone());
            highlight.name = `${mapMesh.name || 'map'}_highlight`;
            highlight.castShadow = false;
            highlight.receiveShadow = false;
            highlight.renderOrder = 999;
            highlight.userData.isMapHighlight = true;
            highlight.userData.ignoreInteract = true;
            highlight.userData.isHelper = true;

            let radius = 0.6;
            const center = new THREE.Vector3();
            if (mapMesh.geometry) {
              if (!mapMesh.geometry.boundingSphere) {
                mapMesh.geometry.computeBoundingSphere();
              }
              if (mapMesh.geometry.boundingSphere) {
                const { center: bsCenter, radius: bsRadius } = mapMesh.geometry.boundingSphere;
                center.copy(bsCenter);
                radius = Math.max(radius, bsRadius * 1.4);
              } else {
                mapMesh.geometry.computeBoundingBox();
                if (mapMesh.geometry.boundingBox) {
                  mapMesh.geometry.boundingBox.getCenter(center);
                  const size = mapMesh.geometry.boundingBox.getSize(new THREE.Vector3());
                  radius = Math.max(radius, Math.max(size.x, size.y, size.z) * 0.75);
                }
              }
            }

            highlight.position.copy(center);
            highlight.scale.setScalar(radius);
            mapMesh.add(highlight);
            mapMesh.userData.mapHighlight = highlight;
          } catch (err) {
            console.warn('[Level3] Failed to create map highlight', err);
          }
        });
      }

      scene.add(lab);

      if (typeof window !== 'undefined') {
        const bounds = new THREE.Box3().setFromObject(lab);
        if (
          Number.isFinite(bounds.min.x) && Number.isFinite(bounds.max.x) &&
          Number.isFinite(bounds.min.z) && Number.isFinite(bounds.max.z)
        ) {
          const mapContentScale = 400 / 512;
          const mapContentOffset = (1 - mapContentScale) / 2;
          const minimapDetail = {
            level: 'level3',
            min: { x: bounds.min.x, z: bounds.min.z },
            max: { x: bounds.max.x, z: bounds.max.z },
            flipY: true,
            mirrorY: true,
            imageScale: { x: mapContentScale, y: mapContentScale },
            imageOffset: { x: mapContentOffset, y: mapContentOffset }
          };
          if (typeof window.__level3MinimapDetail === 'undefined') {
            window.__level3MinimapDetail = null;
          }
          window.__level3MinimapDetail = minimapDetail;
          window.__level3MinimapUnlocked = false;
          window.__pendingMinimapDetail = null;
          window.__activeMinimapConfig = null;
          window.dispatchEvent(new Event('minimap:clear'));
          console.log('[Level3] Minimap prepared but hidden until map is collected');
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
        toggle(){
          // determine whether this action will open the door (target currently closed)
          const willOpen = Math.abs(this.target) < 1e-3;
          this.target = willOpen ? this.openAngle : 0;
          // special-case: when J_2b17 opens, trigger cube movement + rat squeaks
          try {
            if (willOpen && this.mesh && this.mesh.name === 'J_2b17') {
              try { triggerJ2b17Effects(); } catch (err) { console.warn('[HingedDoor] triggerJ2b17Effects failed', err); }
            }
          } catch (err) { void err; }
        }
        update(dt){
          const next = THREE.MathUtils.damp(this.current, this.target, this.speed, dt);
          const delta = next - this.current;
          this.current = next;
          this.pivot.rotateOnAxis(new THREE.Vector3(0,1,0), delta);
        }
      }

      // Helper: animate a local translation on an object over duration (ms)
      function animateTranslateX(object, deltaX, duration = 3000) {
        if (!object) return null;
        const startTime = performance.now();
        const fromX = object.position.x;
        const toX = fromX + deltaX;
        let raf = null;
        const step = (ts) => {
          const t = Math.min(1, (ts - startTime) / duration);
          object.position.x = fromX + (toX - fromX) * t;
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => { if (raf) cancelAnimationFrame(raf); };
      }

      // Trigger special effects when J_2b17 is opened: move two cubes and play rat squeaks
      function triggerJ2b17Effects() {
        try {
          const names = ['Cube017', 'Cube017_1'];
          for (const n of names) {
            let node = lab.getObjectByName(n) || null;
            if (!node) {
              // loose fallback
              lab.traverse(o => { if (!node && o.name && o.name.toLowerCase() === n.toLowerCase()) node = o; });
            }
            if (node) {
              // move -20m in X over 3s
              try { animateTranslateX(node, -20, 3000); } catch (err) { console.warn('[level3] animateTranslateX failed for', n, err); }
            } else {
              console.warn('[level3] could not find', n, 'to move');
            }
          }

          // Play rat squeaks audio (non-positional)
          try {
            const rat = new Audio('/models/assets/rat squeaks.mp3');
            rat.volume = 0.85;
            rat.play().catch(() => {
              // resume on next user gesture if autoplay blocked
              const resume = () => { rat.play().catch(() => {}); document.removeEventListener('click', resume); };
              document.addEventListener('click', resume);
            });
          } catch (err) { console.warn('[level3] failed to play rat squeaks', err); }
        } catch (err) { console.warn('[level3] triggerJ2b17Effects failed', err); }
      }

      // --- EXIT DOOR WIRING -------------------------------------------------------
      const EXIT_DOOR_NAMES = [
        "Object_2011",
        "5ff867c60d244fe1bbf25826980a7c3b.obj.cleaner.materialmerger.gle",
        "Object_2.011",
        "exitDoor",
        "Sketchfab_model.002",
      ];

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

      function collectExitNodes(root) {
        const set = new Set();
        for (const nm of EXIT_DOOR_NAMES) {
          const node = getNodeByLooseName(root, nm);
          if (node) set.add(node);
        }
        if (set.size === 0) {
          const fallback = findExitNode(root);
          if (fallback) set.add(fallback);
        }
        return Array.from(set);
      }


       // Call this before starting the end cutscene
  function preEndCleanup() {
    // Block further input
    try { window.__suppressInput = true; } catch {}
    try { controls?.unlock?.(); } catch {}
    try { controls && (controls.enabled = false); } catch {}

    // Stop any level timer (cover common patterns + broadcast)
    try { window.dispatchEvent(new Event('timer:stop')); } catch {}
    try { gameController?.timer?.stop?.(); } catch {}
    try { if (window.__levelTimerInterval) clearInterval(window.__levelTimerInterval); } catch {}

    // Fade/stop audio
    try { gameController?.audio?.stopFootsteps?.(); } catch {}
    try { gameController?.audio?.fadeAmbient?.(0, 600); } catch {}
    try { gameController?.audio?.muteGroup?.('sfx'); } catch {}

    // Pause/minimize HUD systems
    try { window.dispatchEvent(new Event('minimap:pause')); } catch {}
    try { document.getElementById('interaction-indicator')?.style && (document.getElementById('interaction-indicator').style.display = 'none'); } catch {}
    try { document.getElementById('crosshair')?.style && (document.getElementById('crosshair').style.display = 'none'); } catch {}
  }

      function applyExitInteraction(node) {
        console.log(`[level3] tagging exit root "${node.name}" (uuid=${node.uuid})`);
        // const dispatchExit = () => {
        //   console.log(`[level3] dispatching level3:exit from "${node.name}"`);
        //   window.dispatchEvent(new CustomEvent("level3:exit", {
        //     detail: { source: node.name }
        //   }));
        // };

         const dispatchExit = () => {
          // Play end cutscene first, then dispatch level3:exit so credits run after it
          if (!hasPlayedLevel3Ending) {
            hasPlayedLevel3Ending = true;

             // Stop timers, HUD, input, audio before cutscene
        try { preEndCleanup(); } catch {}
        
            try { document.exitPointerLock && document.exitPointerLock(); } catch {}

            try {
              const cs = new EndCutscene('/models/assets/endcutscene.png');
              cs.play(() => {
                console.log(`[level3] cutscene complete, dispatching level3:exit from "${node.name}"`);
                window.dispatchEvent(new CustomEvent("level3:exit", {
                  detail: { source: node.name }
                }));
              });
            } catch (err) {
              console.warn('[level3] endcutscene failed, falling back to direct exit:', err);
              window.dispatchEvent(new CustomEvent("level3:exit", {
                detail: { source: node.name, error: String(err) }
              }));
            }
          } else {
            // Already played; go straight to exit
            window.dispatchEvent(new CustomEvent("level3:exit", {
              detail: { source: node.name, skippedCutscene: true }
            }));
          }
        };

        const tagNode = (target) => {
          const prevType = target.userData.interactionType;
          target.userData.interactable = true;
          target.userData.interactionType = "exit";
          target.userData.getInteractLabel = () => "Press E to Exit";
          target.userData.onInteract = dispatchExit;
          console.log(`[level3]  ↳ tagged "${target.name || "(unnamed)"}" as exit (was ${prevType || "unset"})`);
        };

        tagNode(node);
        node.traverse((child) => {
          if (child !== node && child.isMesh) {
            tagNode(child);
          }
        });
      }

      function wireExitInteractable(root) {
        const nodes = collectExitNodes(root);
        if (nodes.length === 0) {
          console.warn("[level3] no exit door found");
          return [];
        }

        for (const node of nodes) {
          applyExitInteraction(node);
          console.log(`[level3] exit wired on "${node.name}"`);
        }

        if (typeof window !== "undefined") {
          window.level3ExitNodes = nodes;
          try {
            window.dispatchEvent(new CustomEvent("debug:level3:exitNodes", {
              detail: nodes.map(n => ({ name: n.name, uuid: n.uuid }))
            }));
          } catch (err) {
            console.warn("[level3] failed to emit debug exit nodes event:", err);
          }

          if (typeof window.updateInteractableCache === "function") {
            window.updateInteractableCache();
            setTimeout(() => {
              try { window.updateInteractableCache?.(); } catch (err) {
                console.warn("[level3] deferred interactable cache refresh failed:", err);
              }
            }, 0);
          } else {
            console.warn("[level3] updateInteractableCache unavailable when wiring exit; retrying soon");
            setTimeout(() => {
              try {
                window.updateInteractableCache?.();
              } catch (err) {
                console.warn("[level3] retry interactable cache refresh failed:", err);
              }
            }, 500);
          }
        }

        return nodes;
      }

      wireExitInteractable(lab);

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
