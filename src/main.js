import * as THREE from "three";
import { loadLevel } from "./core/levelLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";


const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 8, 30);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0,1.7,15);
camera.lookAt(0, 1, 0);

//LOAD LEVELS
loadLevel(scene, 1);

// temp lights (Person 3 will replace)
scene.add(new THREE.HemisphereLight(0x555577, 0x111122, 0.6));
const spot = new THREE.SpotLight(0xffffff, 1.0, 20, Math.PI / 6, 0.3);
spot.position.set(4, 6, 4);
spot.castShadow = true;
scene.add(spot);

const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

//CONTROLS
const controls = new PointerLockControls(camera, renderer.domElement);

// Click to lock pointer
document.body.addEventListener('click', () => controls.lock());

// Movement
const move = { forward: 0, backward: 0, left: 0, right: 0 };
document.addEventListener('keydown', (e) => {
  if(e.code === 'KeyW') move.forward = 1;
  if(e.code === 'KeyS') move.backward = 1;
  if(e.code === 'KeyA') move.left = 1;
  if(e.code === 'KeyD') move.right = 1;
});
document.addEventListener('keyup', (e) => {
  if(e.code === 'KeyW') move.forward = 0;
  if(e.code === 'KeyS') move.backward = 0;
  if(e.code === 'KeyA') move.left = 0;
  if(e.code === 'KeyD') move.right = 0;
});



function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);

function animate(t) {
  const speed = 0.1;
  if(move.forward) controls.moveForward(speed);
  if(move.backward) controls.moveForward(-speed);
  if(move.left) controls.moveRight(-speed);
  if(move.right) controls.moveRight(speed);


  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);