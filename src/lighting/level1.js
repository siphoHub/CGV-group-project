import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";


export function createLighting(scene,camera)
{
//global lights

//const hemi= new THREE.HemisphereLight(0x88aaff,0x202030,0.4);
//scene.add(hemi);

//const dirLight=new THREE.DirectionalLight(0xffffff,0.8);
//dirLight.position.set(10,15,10);
//scene.add(dirLight);

//flashlight

const flashlight=new THREE.SpotLight(
    0xffffff,   //colour
    10,          //intensity
    50,         //distance
    Math.PI/6,  //angle
    0.5         //edges
    );
flashlight.visible=false;
flashlight.position.set(0, 0, 0); // adjust to your desired position
scene.add(flashlight);

const flashLightTarget=new THREE.Object3D();
scene.add(flashLightTarget);
flashlight.target=flashLightTarget;

//red emergency lights
const redLights = [];
const positions = [
  [-0.8, 1, 1.5],
  [0.8, 1, 1.5],
  [4.6, -3, 1.5],
  [-4.6, -3, 1.5],
  [1.9,2.6,1.5],
  [-2.1,2.7,1.5],
  [0.5,-3.2,1.5],
  [1.3,3.4,1.5],
  [-2.1,2.7,1.5]

];

positions.forEach(pos => {
  const light = new THREE.PointLight(0xff0000, 4, 50, 2);
  light.position.set(...pos);
  light.castShadow = true;

  scene.add(light);
  redLights.push(light);
});




return  { flashlight,redLights}

}
