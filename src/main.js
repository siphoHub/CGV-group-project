// src/main.js
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
camera.position.set(0, 1.7, 5);

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

// Controls (we also grab setColliders)
const { controls, update, setColliders } = createControls(camera, renderer.domElement);

// --- collision state we receive from the level ---
const collisionState = {
  colliders: [],
  passthrough: [],
  rayTargets: []
};

window.addEventListener("level:colliders", (e) => {
  const d = e.detail || {};
  collisionState.colliders   = d.colliders   || [];
  collisionState.passthrough = d.passthrough || [];
  collisionState.rayTargets  = d.rayTargets  || [];
  setColliders(collisionState);
  console.log("[main] received colliders:", collisionState.colliders.length, "passthrough:", collisionState.passthrough.length);
});

// ====== ONE-KEY “STAMP A DOOR HERE” ======
const doorHelpers = [];
function addDoorAtCrosshair() {
  // Ray from screen center
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2(0, 0);
  ray.setFromCamera(mouse, camera);
  // try to hit real geometry first
  const hits = ray.intersectObjects(collisionState.rayTargets.length ? collisionState.rayTargets : scene.children, true);

  // Doorway box parameters (tweak if needed)
  const DOOR_WIDTH  = 1.2;   // meters
  const DOOR_HEIGHT = 2.2;   // meters
  const DOOR_DEPTH  = 0.6;   // meters (how deep the pass region is)

  let center;
  if (hits.length) {
    center = hits[0].point.clone();
  } else {
    // No hit? Put it ~2m in front of camera.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    center = camera.position.clone().addScaledVector(forward, 2.0);
  }

  // Build a Box3 centered at 'center'
  const min = new THREE.Vector3(
    center.x - DOOR_WIDTH * 0.5,
    center.y - DOOR_HEIGHT * 0.5,
    center.z - DOOR_DEPTH * 0.5
  );
  const max = new THREE.Vector3(
    center.x + DOOR_WIDTH * 0.5,
    center.y + DOOR_HEIGHT * 0.5,
    center.z + DOOR_DEPTH * 0.5
  );
  const doorBox = new THREE.Box3(min, max);

  // Add to passthrough list and push to controls
  collisionState.passthrough.push(doorBox);
  setColliders(collisionState);

  // Visual helper so you see where the door is
  const helper = new THREE.Box3Helper(doorBox, 0x22cc22);
  helper.userData.ignoreInteract = true;
  scene.add(helper);
  doorHelpers.push(helper);

  console.log("[main] stamped doorway. passthrough count:", collisionState.passthrough.length);
}

// Key: press P to stamp a doorway where you’re looking
addEventListener("keydown", (e) => {
  if (e.code === "KeyP") addDoorAtCrosshair();
});

// --- Interaction (unchanged) ---
const raycaster = new THREE.Raycaster();
const interactionDistance = 3;
const interactKey = "KeyE";

document.addEventListener("keydown", (event) => {
  if (event.code !== interactKey || !controls.isLocked) return;

  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  raycaster.set(camera.position, cameraDirection);

  const candidates = [];
  scene.traverse(obj => { if (!obj.userData?.ignoreInteract) candidates.push(obj); });

  const intersects = raycaster.intersectObjects(candidates, true);

  if (intersects.length > 0 && intersects[0].distance <= interactionDistance) {
    const obj = intersects[0].object;
    if (obj.userData.interactable) {
      console.log("Interacted with:", obj.name);
      if (obj.material?.color) obj.material.color.set(0xff0000);
    }
  }
});


function resetPlayer() {
  camera.position.set(0, 1.7, -5);
  camera.lookAt(0, 1.7, 0);
}
resetPlayer();
addEventListener("keydown", (e) => { if (e.code === "KeyR") resetPlayer(); });


addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});


const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(0.1, clock.getDelta());
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
