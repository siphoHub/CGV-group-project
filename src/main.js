//main.js
import * as THREE from "three";
import { loadLevel } from "./core/levelLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { createControls } from "./controls/controls.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0,0.3,15);
camera.lookAt(0, 0.3, 0);


//LOADL LEVELS
loadLevel("level1", scene);

scene.add(camera);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
scene.add(new THREE.HemisphereLight(0x88aaff, 0x202030, 0.4));
scene.add(new THREE.GridHelper(40, 40));
scene.add(new THREE.AxesHelper(2));

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




//for interaction, person doing this to replace
const raycaster = new THREE.Raycaster();
const interactionDistance = 3; 
const interactKey = "KeyE";

// Listen for key press
document.addEventListener("keydown", (event) => {
  if (event.code !== interactKey) return;

  // Shoot a ray from camera forward
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);

  raycaster.set(camera.position, cameraDirection);

  // Check all objects in the scene
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0 && intersects[0].distance <= interactionDistance) {
    const obj = intersects[0].object;
    if (obj.userData.interactable) {
      console.log("Interacted with:", obj.name);

      obj.material.color.set(0xff0000);

    }
  }
});




function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function resetPlayer(){
  camera.position.set(0,1.7,5);
  camera.lookAt(0,1,0);
}
resetPlayer();
addEventListener('keydown', e => { if (e.code === 'KeyR') resetPlayer(); });


addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});


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

