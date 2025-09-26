
//level1
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function loadLevel1(scene) {
  const loader = new GLTFLoader();

  loader.load("/models/blenderLevel1.glb", 

    (gltf) => {                    
      const lobby = gltf.scene;
      lobby.scale.set(1, 1, 1);
      
      // Compute bounds and lift model so its base sits on y=0
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

         // mark objects as interactable. person doing interactions to replace
          if (child.name === "Flashlight Camping" || child.name === "AA Battery.001"){
            child.userData.interactable = true;
          }
        }
      });

      scene.add(lobby);

      //test if the model loads in browser
      console.log("GLB loaded");
    },

    undefined,                     
    (error) => {                   
      console.error("Error loading GLB:", error);
    }
  );
}
