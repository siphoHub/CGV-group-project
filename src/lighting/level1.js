import * as THREE from "three";

export function createLighting(scene,camera)
{
//global lights - start with normal lighting

const hemi= new THREE.HemisphereLight(0x88aaff,0x202030,0.8);
scene.add(hemi);

const dirLight=new THREE.DirectionalLight(0xffffff,1.2);
dirLight.position.set(10,15,10);
dirLight.castShadow = true;
// Optimize shadow map for performance
dirLight.shadow.mapSize.width = 1024;  // Reduced from default 2048
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
scene.add(dirLight);

const flashlight=new THREE.SpotLight(
    0xffffff,   //colour
    100,          //intensity (increased from 10 to 100)
    250,         //distance (increased from 100 to 250)
    Math.PI/6,  //angle
    0.3,        //edges
    1
    );
flashlight.visible=false;
flashlight.position.set(0, 0, 0); // adjust to your desired position
flashlight.userData.isPersistent = true; // Mark as persistent for level transitions
scene.add(flashlight);

const flashLightTarget=new THREE.Object3D();
flashLightTarget.userData.isPersistent = true; // Mark target as persistent too
scene.add(flashLightTarget);
flashlight.target=flashLightTarget;

const coneGeometry = new THREE.ConeGeometry(0.4, 2, 32, 1, true);
const coneMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffaa,
    transparent: true,
    opacity: 0.00,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false
});

const lightCone = new THREE.Mesh(coneGeometry, coneMaterial);
lightCone.rotation.x = -Math.PI / 2;
lightCone.castShadow = false;
lightCone.receiveShadow = false;
flashlight.add(lightCone);

function updateFlashlightBeam() {
  const length = flashlight.distance / 15;
  const radius = Math.tan(flashlight.angle) * length/2;
  lightCone.scale.set(radius, length, radius);
}

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

positions.forEach((pos, index) => {
  const light = new THREE.PointLight(0xff0000, 0, 50, 2); // Start with intensity 0
  light.position.set(...pos);
  // Only let first 2 red lights cast shadows for performance
  if (index < 2) {
    light.castShadow = true;
    light.shadow.mapSize.width = 512;  // Small shadow map for point lights
    light.shadow.mapSize.height = 512;
  }

  scene.add(light);
  redLights.push(light);
});

return  { flashlight, redLights, hemi, dirLight, updateFlashlightBeam }

}
