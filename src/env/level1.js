
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default async function loadLevel1(scene) {
  const loader = new GLTFLoader();

  try {
    const gltf = await loader.loadAsync("/models/blenderLevel1.glb");
    const lobby = gltf.scene;
    lobby.scale.set(1, 1, 1);

    
      const box = new THREE.Box3().setFromObject(lobby);
      const min = box.min; // lowest corner in world space
      if (Number.isFinite(min.y)) {
        lobby.position.y += -min.y; // lift by the amount below y=0
      }
      // Enable shadows on all meshes
      lobby.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Log all mesh names to help identify generator objects
          if (child.name) {
            console.log(`[Level1] Found mesh: ${child.name}`);
            
            // Check for potential generator-related names
            const name = child.name.toLowerCase();
            if (name === 'powerpulse1') {
              console.log(`[POTENTIAL GENERATOR] Found generator object: ${child.name}`);
            }
          }
          
         // mark objects as interactable. person doing interactions to replace
          if (child.name === "Flashlight Camping" ||
              child.name === "Flash_Light_Body_high" || 
              child.name === "Flash_Light_Cover_high" || 
              child.name === "Flash_Light_Metal_high" || 
              child.name === "AA Battery.001"){
                 child.userData.interactable = false; // Not interactable until generator on
                 console.log(`[Interactable] Marked as interactable: ${child.name}`);
          }
            
          // Mark generator as found but not initially interactable
          if (child.name === "powerpulse1") {
            child.userData.interactable = true; // Interactable from the start
            child.userData.isGenerator = true; // Flag to identify it as generator
            console.log(`[Generator] Found powerpulse1 generator object - interactable from start`);
          }
          
          // Move flashlight parts to reception desk location
          if (child.name.includes("Flash_Light")) {
              child.position.set(0.1, -0.4, 0); // Reception desk position (adjust as needed)
              
              // Rotate flashlight 135 degrees around X axis (horizontal)
              child.rotation.y = THREE.MathUtils.degToRad(135);
              
              // Add faint white aura effect (initially hidden)
              const auraGeometry = new THREE.SphereGeometry(0.3, 16, 16);
              const auraMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                wireframe: false
              });
              const whiteAura = new THREE.Mesh(auraGeometry, auraMaterial);
              whiteAura.position.copy(child.position);
              whiteAura.name = `${child.name}_aura`;
              child.parent.add(whiteAura);
              
              // Store reference to aura for interaction detection
              child.userData.aura = whiteAura;
            }
        }
      });

      scene.add(lobby);

     
      const colliders   = [];
      const passthrough = [];
      const rayTargets  = [];

      
      const DOORLIKE = /(door|doorway|entrance|portal|gate|opening|arch|archway|door_frame|doorframe)/i;

      
      const FORCE_COLLIDE = [
        /^dog skeleton$/i,
        /^reception desk$/i,
        /^office desk industrial$/i,
        /^industrial elevator dc$/i,
        /^chair karlstad$/i,
        /^chair karlstad 001$/i,
        /^office desk industrial design$/i,
        /^wood side table$/i,
        /^japandi narrow wood black console table$/i
      ];
      const forceMatch = (name) => FORCE_COLLIDE.some(rx => rx.test(name || ""));

      
      function isTiny(b) {
        const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)) return true;
        return (sx < 0.02 && sz < 0.02) || sy < 0.02;
      }

      lobby.updateWorldMatrix(true, true);

     
      lobby.traverse((obj) => { if (obj.isMesh) rayTargets.push(obj); });

     
      const topLevelNodes = new Set();
      lobby.traverse((obj) => {
        if (!obj.isMesh) return;
        let top = obj;
        while (top.parent && top.parent !== lobby) top = top.parent;
        topLevelNodes.add(top);
      });

     
      for (const node of topLevelNodes) {
        const lname = (node.name || "").toLowerCase();
        if (!DOORLIKE.test(lname)) continue;
        const b = new THREE.Box3().setFromObject(node);
        if (!isTiny(b)) passthrough.push(growBox(b, { x: 0.22, z: 0.35, y: 0 }));
      }

      
      for (const node of topLevelNodes) {
        const name  = node.name || "";
        const lname = name.toLowerCase();

        if (/^col_ignore_/i.test(name)) continue;
        if (DOORLIKE.test(lname)) continue; 

        let hasInteractable = false;
        node.traverse((n) => { if (n.userData?.interactable) hasInteractable = true; });
        if (hasInteractable) continue;

        
        const b = new THREE.Box3().setFromObject(node);
        if (isTiny(b)) continue;

        
        if (forceMatch(name) || true) {
          colliders.push(b);
        }
      }

      window.dispatchEvent(new CustomEvent("level:colliders", {
        detail: { colliders, passthrough, rayTargets }
      }));

      console.log("[level1] GLB loaded | colliders:", colliders.length, "passthrough:", passthrough.length);
      
  } catch (error) {
    console.error("Error loading GLB:", error);
  }
}

function growBox(b, { x = 0, y = 0, z = 0 }) {
  const out = new THREE.Box3(b.min.clone(), b.max.clone());
  out.min.x -= x; out.max.x += x;
  out.min.y -= y; out.max.y += y;
  out.min.z -= z; out.max.z += z;
  return out;
}
