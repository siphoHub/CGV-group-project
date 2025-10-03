//level3
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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

      //test if the model loads in browser
      console.log("GLB loaded");
  }

  catch(error){
    console.error("Error loading GLB:", error);
  }

}