
import * as THREE from "three";
import { createControls } from "./controls/controls.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 100);
scene.add(camera);


const { controls, update } = createControls(camera, renderer.domElement);


scene.add(new THREE.AmbientLight(0xffffff, 0.8));
scene.add(new THREE.HemisphereLight(0x88aaff, 0x202030, 0.4));
scene.add(new THREE.GridHelper(40, 40));
scene.add(new THREE.AxesHelper(2));


const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1,1,1),
  new THREE.MeshStandardMaterial({ color: 0x6aa0ff })
);
cube.position.y = 0.5;
scene.add(cube);


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


const clock = new THREE.Clock();
function loop(t){
  const dt = Math.min(0.033, clock.getDelta());
  update(dt);
  cube.rotation.y = t * 0.0012;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
