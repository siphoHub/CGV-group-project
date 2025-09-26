
//level1
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function loadLevel1(scene) {
  const loader = new GLTFLoader();

  loader.load(
    "/blenderLevel1.glb", 

    (gltf) => {                    
      const lobby = gltf.scene;
      lobby.scale.set(1, 1, 1);
      lobby.position.set(0, 0, 0);

      // Enable shadows on all meshes
      lobby.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

         // mark objects as interactable. person doing interactions to replace
          if (child.name === "Flash_Light_Body_high" || 
              child.name === "Flash_Light_Cover_high" || 
              child.name === "Flash_Light_Metal_high" || 
              child.name === "AA Battery.001"){
            child.userData.interactable = true;
            
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

