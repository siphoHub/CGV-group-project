
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function loadLevel1(scene) {
  const loader = new GLTFLoader();

  loader.load("/models/blenderLevel1.glb",
    (gltf) => {
      const lobby = gltf.scene;
      lobby.scale.set(1, 1, 1);

    
      const box = new THREE.Box3().setFromObject(lobby);
      if (Number.isFinite(box.min.y)) lobby.position.y += -box.min.y;

     
      lobby.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.name === "Flashlight Camping" || child.name === "AA Battery.001") {
            child.userData.interactable = true;
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
    },
    undefined,
    (error) => console.error("Error loading GLB:", error)
  );
}

function growBox(b, { x = 0, y = 0, z = 0 }) {
  const out = new THREE.Box3(b.min.clone(), b.max.clone());
  out.min.x -= x; out.max.x += x;
  out.min.y -= y; out.max.y += y;
  out.min.z -= z; out.max.z += z;
  return out;
}
