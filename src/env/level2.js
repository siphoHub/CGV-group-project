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

    // Performance optimization: Reduce polygon count for distant objects
    let meshCount = 0;
    let optimizedCount = 0;
    const colliders = [];
    const rayTargets = [];

    // Enable shadows and optimize meshes
    facility.traverse((child) => {
      if (child.isMesh) {
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
      }
    });

    scene.add(facility);

    // Add Level 2 specific lighting
    addLevel2Lighting(scene);

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

// Level 2 specific lighting setup
function addLevel2Lighting(scene) {
  // Very dim facility ambient lighting (much darker, more ominous)
  const hemi = new THREE.HemisphereLight(0x333355, 0x080812, 0.2); // Reduced from 0.6 to 0.2
  hemi.userData.isPersistent = true;
  scene.add(hemi);

  // Very dim main facility lighting
  const mainLight = new THREE.DirectionalLight(0xccddff, 0.3); // Reduced from 0.8 to 0.3
  mainLight.position.set(5, 10, 5);
  mainLight.castShadow = true;
  // Reduced shadow quality for better performance
  mainLight.shadow.mapSize.width = 512;
  mainLight.shadow.mapSize.height = 512;
  mainLight.shadow.camera.near = 1;
  mainLight.shadow.camera.far = 30;
  mainLight.userData.isPersistent = true;
  scene.add(mainLight);

  // Very dim secondary light
  const secondaryLight = new THREE.DirectionalLight(0x223344, 0.15); // Reduced from 0.4 to 0.15
  secondaryLight.position.set(-5, 8, -3);
  secondaryLight.userData.isPersistent = true;
  scene.add(secondaryLight);

  // Dim emergency light (barely visible)
  const redLight = new THREE.PointLight(0xff2222, 0.2, 6); // Reduced intensity and range
  redLight.position.set(0, 3, 0);
  redLight.userData.isPersistent = true;
  scene.add(redLight);

  console.log("[Level2] Very dim lighting system initialized - flashlight recommended!");
}
