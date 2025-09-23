import * as THREE from "three";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 8, 30);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 5);

// temp floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// temp cube
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x6aa0ff, metalness: 0.2, roughness: 0.6 })
);
cube.position.set(0, 0.5, 0);
cube.castShadow = true;
scene.add(cube);

// temp lights (Person 3 will replace)
scene.add(new THREE.HemisphereLight(0x555577, 0x111122, 0.6));
const spot = new THREE.SpotLight(0xffffff, 1.0, 20, Math.PI / 6, 0.3);
spot.position.set(4, 6, 4);
spot.castShadow = true;
scene.add(spot);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);

function animate(t) {
  cube.rotation.y = t * 0.0007;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
