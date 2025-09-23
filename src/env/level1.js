import * as THREE from "three";

export function createLevel1(scene) {
    //entrance lobby room
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x444444, side:THREE.DoubleSide});
    const wallHeight = 5;
    const elWidth = 15;
    const elDepth=15;

    const elfloor = new THREE.Mesh(new THREE.PlaneGeometry(elWidth, elDepth), new THREE.MeshStandardMaterial({color:0x222222}));
    elfloor.rotation.x = -Math.PI/2;
    elfloor.receiveShadow = true;
    scene.add(elfloor);

    const backELWall = new THREE.Mesh(new THREE.BoxGeometry(elWidth, wallHeight, 0.5), wallMat);
    backELWall.position.set(0, wallHeight/2, -elDepth/2);
    scene.add(backELWall);

    const leftELWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, wallHeight, elDepth), wallMat);
    leftELWall.position.set(-elWidth/2, wallHeight/2, 0);
    scene.add(leftELWall);

    const rightELWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, wallHeight, elDepth), wallMat);
    rightELWall.position.set(elWidth/2, wallHeight/2, 0);
    scene.add(rightELWall);

    const frontELWall = new THREE.Mesh(new THREE.BoxGeometry(elWidth, wallHeight, 0.5), wallMat);
    frontELWall.position.set(0, wallHeight/2, elDepth/2);
    scene.add(frontELWall);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(elWidth, elDepth), new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide }));
    ceiling.position.set(0, wallHeight, 0);
    ceiling.rotation.x = Math.PI / 2;
    scene.add(ceiling);

    const deskMat = new THREE.MeshStandardMaterial({ color: 0x777777, side:THREE.DoubleSide});
    const lobbyDesk = new THREE.Mesh(new THREE.BoxGeometry(7.5,1,1.5));
    lobbyDesk.material=deskMat;
    lobbyDesk.castShadow = true;
    lobbyDesk.receiveShadow = true;
    lobbyDesk.position.set(0,0.5,0);
    scene.add(lobbyDesk);

    const elevator = new THREE.Mesh(
    new THREE.BoxGeometry(3, 4, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
    elevator.position.set(0,2,-elDepth/2+0.4);
    elevator.castShadow = true;
    elevator.receiveShadow = true;
    scene.add(elevator);

    // Chairs for waiting area
const chairMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
// Left wall chairs
for (let i = 0; i < 3; i++) {
    const chair = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    chair.position.set(
        -elWidth/2 + 0.5,       // near left wall
        0.5,                    // floor height
        elDepth/2 - 1 - i*2  // offset from back wall, moving toward front but not too close to elevator
    );
    chair.rotation.y = 0;      // face into room
    scene.add(chair);
}

// Right wall chairs
for (let i = 0; i < 3; i++) {
    const chair = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    chair.position.set(
        elWidth/2 - 0.5,         // near right wall
        0.5,                     // floor height
        elDepth/2 - 1 - i*2    // same offset as left side
    );
    chair.rotation.y = Math.PI; // face into room
    scene.add(chair);
}


// Right side plant (your existing one)
const potMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const plantMat = new THREE.MeshStandardMaterial({ color: 0x00aa00 });

const potRight = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5), potMat);
potRight.position.set(elWidth/2 - 0.5, 0.25,1 );
scene.add(potRight);

const plantRight = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 8), plantMat);
plantRight.position.set(elWidth/2 - 0.5, 0.75, 1);
scene.add(plantRight);

// Left side plant
const potLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5), potMat);
potLeft.position.set(-elWidth/2 + 0.5, 0.25, 1);
scene.add(potLeft);

const plantLeft = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 8), plantMat);
plantLeft.position.set(-elWidth/2 + 0.5, 0.75, 1);
scene.add(plantLeft);






//////////////////////////////////////////
    //SECURITY ROOM ON LEFT
    const secRoomWidth = 6;
    const secRoomDepth = 6;
    const secRoomHeight = wallHeight;

    const secFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(secRoomWidth, secRoomDepth),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    secFloor.rotation.x = -Math.PI / 2;
    secFloor.position.set(-elWidth/2 - secRoomWidth/2 + 0.25, 0, -elDepth/4); 
    secFloor.receiveShadow = true;
    scene.add(secFloor);

    const secWallMat = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide });

    const secBackWall = new THREE.Mesh(new THREE.BoxGeometry(secRoomWidth, secRoomHeight, 0.5), secWallMat);
    secBackWall.position.set(-elWidth/2 - secRoomWidth/2 , secRoomHeight/2, -elDepth/4 - secRoomDepth/2);
    scene.add(secBackWall);

    const secFrontWall = new THREE.Mesh(new THREE.BoxGeometry(secRoomWidth, secRoomHeight, 0.5), secWallMat);
    secFrontWall.position.set(-elWidth/2 - secRoomWidth/2 , secRoomHeight/2, -elDepth/4 + secRoomDepth/2);
    scene.add(secFrontWall);

    const secLeftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, secRoomHeight, secRoomDepth), secWallMat);
    secLeftWall.position.set(-elWidth/2-secRoomWidth, secRoomHeight/2, -elDepth/4);
    scene.add(secLeftWall);

    const secRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, secRoomHeight, secRoomDepth), secWallMat);
    secRightWall.position.set(-elWidth/2, secRoomHeight/2, -elDepth/4);
    scene.add(secRightWall);

    const doorWidth = 2;
    const doorHeight = 3;
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x663300, side: THREE.DoubleSide });

    const secDoor = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.1),doorMat);
    secDoor.rotation.y = Math.PI / 2;
    secDoor.position.set(-elWidth/2 + 0.25,doorHeight / 2,-elDepth/4);

    scene.add(secDoor);

// --- SECURITY ROOM PROPS ---

// Security desk
const secDeskMat = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide });
const secDesk = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 0.8), secDeskMat);
secDesk.position.set(-elWidth/2-secRoomWidth+0.8, 0.5, -elDepth/4);
secDesk.rotation.y=-Math.PI/2
scene.add(secDesk);

// Computer monitor
const monitorMat = new THREE.MeshStandardMaterial({ color: 0x0000ff }); // blue screen
const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), monitorMat);
monitor.position.set(secDesk.position.x-0.2, 1.2, secDesk.position.z );
monitor.rotation.y=-Math.PI/2;
scene.add(monitor);

const mouseMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.2), mouseMat);

mouse.position.set(
  monitor.position.x+0.1, 
  secDesk.position.y + 0.55,
  monitor.position.z-0.8
);
mouse.rotation.y=-Math.PI/2;

scene.add(mouse);

const keyboardMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.2), keyboardMat);

// Position it just in front of the monitor
keyboard.position.set(
  monitor.position.x+0.3,                 
  secDesk.position.y + 0.55,         // just above desk surface
  monitor.position.z           // slightly in front of monitor
);
keyboard.rotation.y=-Math.PI/2;
scene.add(keyboard);

// Chair
const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), chairMat);
chair.position.set(secDesk.position.x+0.8, 0.25, secDesk.position.z);
chair.rotation.y=-Math.PI/2;
scene.add(chair);

// Wall security screens
const screenMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const screen1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, .8, 0.05), screenMat);
screen1.position.set(secDesk.position.x, 2, secDesk.position.z-0.9);
screen1.rotation.y=-Math.PI/2;
scene.add(screen1);

const screen2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, .8, 0.05), screenMat);
screen2.position.set(secDesk.position.x, 2, secDesk.position.z + 0.9);
screen2.rotation.y=-Math.PI/2;
scene.add(screen2);

// Security camera on wall
const cameraBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x555555 }));
cameraBody.rotation.z = Math.PI / 2;
cameraBody.position.set(-elWidth/2 - secRoomWidth/2 + 0.25, 3, -elDepth/4);
scene.add(cameraBody);


//////////////////////////////////////////////////////////
    //GENERATOR ROOM ON RIGHT
    const genRoomWidth = 9;
    const genRoomDepth = 7;
    const genRoomHeight = wallHeight;

    const genFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(genRoomWidth, genRoomDepth),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    genFloor.rotation.x = -Math.PI/2;
    genFloor.position.set(elWidth/2+genRoomWidth/2-0.25, 0, -elDepth/4); 
    genFloor.receiveShadow = true;
    scene.add(genFloor);

    const genWallMat = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide });
    
    const genBackWall = new THREE.Mesh(new THREE.BoxGeometry(genRoomWidth, genRoomHeight, 0.5), genWallMat);
    genBackWall.position.set(elWidth/2 + genRoomWidth/2 , genRoomHeight/2, -elDepth/4 - genRoomDepth/2);
    scene.add(genBackWall);

    const genFrontWall = new THREE.Mesh(new THREE.BoxGeometry(genRoomWidth, genRoomHeight, 0.5), genWallMat);
    genFrontWall.position.set(elWidth/2 + genRoomWidth/2 , genRoomHeight/2, -elDepth/4 + genRoomDepth/2);
    scene.add(genFrontWall);

    const genLeftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, genRoomHeight, genRoomDepth), genWallMat);
    genLeftWall.position.set(elWidth/2, genRoomHeight/2, -elDepth/4);
    scene.add(genLeftWall);

    const genRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, genRoomHeight, genRoomDepth), genWallMat);
    genRightWall.position.set(elWidth/2+genRoomWidth, genRoomHeight/2, -elDepth/4);
    scene.add(genRightWall);

    const genDoor = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.1),doorMat);
    genDoor.rotation.y = -Math.PI / 2;
    genDoor.position.set(elWidth/2+0.25,doorHeight / 2,-elDepth/4);

    scene.add(genDoor);

    const generator = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.5, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    generator.position.set(elWidth/2 + 5, 1, -elDepth/4);
    scene.add(generator);

    const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x00ff00 })
    );
    panel.rotation.y=-Math.PI/2;
    panel.position.set(elWidth/2 + genRoomWidth - 0.5, 1, -elDepth/4);
    scene.add(panel);

    // --- FIRE EXTINGUISHER ---
const extinguisherBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.2, 1),
  new THREE.MeshStandardMaterial({ color: 0xff0000 }) // red
);
extinguisherBody.position.set(elWidth/2 + 2, 0.5, -elDepth/4 + 2);
scene.add(extinguisherBody);

// Top nozzle (cone)
const extinguisherNozzle = new THREE.Mesh(
  new THREE.ConeGeometry(0.1, 0.3, 8),
  new THREE.MeshStandardMaterial({ color: 0x333333 }) // dark grey
);
extinguisherNozzle.position.set(elWidth/2 + 2, 1.15, -elDepth/4 + 2);
scene.add(extinguisherNozzle);

// Optional small handle
const extinguisherHandle = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.05, 0.3),
  new THREE.MeshStandardMaterial({ color: 0x000000 })
);
extinguisherHandle.position.set(elWidth/2 + 2, 1.05, -elDepth/4 + 1.85);
scene.add(extinguisherHandle);


// --- WARNING SIGNS ---
// Yellow/black warning sign on wall
const warningMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, side: THREE.DoubleSide });
const warningSign1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), warningMat);
warningSign1.position.set(elWidth/2 + genRoomWidth - 0.5, 2, -elDepth/4 + 2); // right wall
warningSign1.rotation.y = -Math.PI / 2;
scene.add(warningSign1);

const warningSign2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), warningMat);
warningSign2.position.set(elWidth/2 + genRoomWidth - 0.5, 2, -elDepth/4 - 2); // right wall, another spot
warningSign2.rotation.y = -Math.PI / 2;
scene.add(warningSign2);


}