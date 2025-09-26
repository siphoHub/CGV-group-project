// main.js
import * as THREE from "three";
import { loadLevel } from "./core/levelLoader.js";
import { createControls } from "./controls/controls.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js"; 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

// Camera
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 5); // start at standing height, slightly forward

// Level + lights
loadLevel("level1", scene);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const hemi = new THREE.HemisphereLight(0x88aaff, 0x202030, 0.4);
scene.add(hemi);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// (Dev helpers)
const grid = new THREE.GridHelper(40, 40);
const axes = new THREE.AxesHelper(2);
grid.userData.ignoreInteract = true;
axes.userData.ignoreInteract = true;
scene.add(grid, axes);

// 🔑 Unified first-person controls
const { controls, update } = createControls(camera, renderer.domElement);
// (Optional) logs already inside controls.js for lock/unlock
// document.body.addEventListener('click', () => controls.lock()); // already handled in controls.js

// --- Interaction (keep your logic) ---
const raycaster = new THREE.Raycaster();
const interactionDistance = 3;
const interactKey = "KeyE";

document.addEventListener("keydown", (event) => {
  if (event.code !== interactKey || !controls.isLocked) return;

  // Ray forward from camera
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  raycaster.set(camera.position, cameraDirection);

  // Filter out helpers and anything flagged to ignore
  const candidates = [];
  scene.traverse(obj => { if (!obj.userData?.ignoreInteract) candidates.push(obj); });

  const intersects = raycaster.intersectObjects(candidates, true);

  if (intersects.length > 0 && intersects[0].distance <= interactionDistance) {
    const obj = intersects[0].object;
    if (obj.userData.interactable) {
      console.log("Interacted with:", obj.name);
      if (obj.material?.color) obj.material.color.set(0xff0000);
      // TODO: call your interaction handler here (open door, pick battery, etc.)
    }
  }
});

// Reset spawn (dev)
function resetPlayer() {
  camera.position.set(0, 1.7, -5);
  camera.lookAt(0, 1.7, 0);
}
resetPlayer();
addEventListener('keydown', e => { if (e.code === 'KeyR') resetPlayer(); });

// Resize
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// Animate
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(0.1, clock.getDelta()); // clamp big frame gaps
  update(dt); // <- drive your controls (walk, sprint, crouch, head bob)
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
