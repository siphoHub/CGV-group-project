//level2
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default async function loadLevel2(scene) {
  const loader = new GLTFLoader();

  try{
    const gltf = await loader.loadAsync("/models/blenderL2.glb");


     const facility = gltf.scene;
      facility.scale.set(1, 1, 1);
      facility.position.set(0, 0, 0);

      // Enable shadows on all meshes
      facility.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

         //mark interactable objects
        }
      });

      scene.add(facility);

      //test if the model loads in browser
      console.log("GLB loaded");
  }

  catch(error){
    console.error("Error loading GLB:", error);
  }

}