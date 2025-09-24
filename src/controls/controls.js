
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export function createControls(camera, domElement) {
  const controls = new PointerLockControls(camera, domElement);


  domElement.addEventListener('click', () => controls.lock());
  controls.addEventListener('lock',   () => console.log('[controls] LOCKED'));
  controls.addEventListener('unlock', () => console.log('[controls] UNLOCKED'));


  const keys = new Map();
  const set = (e, v) => keys.set(e.code, v);
  addEventListener('keydown', e => set(e, true));
  addEventListener('keyup',   e => set(e, false));

  const SPEED = 3.5; 

  function update(dt) {
    if (!controls.isLocked) return;

 
    let forward = 0, right = 0;
    if (keys.get('KeyW') || keys.get('ArrowUp'))    forward += 1;
    if (keys.get('KeyS') || keys.get('ArrowDown'))  forward -= 1;
    if (keys.get('KeyD') || keys.get('ArrowRight')) right   += 1;
    if (keys.get('KeyA') || keys.get('ArrowLeft'))  right   -= 1;

    // Normalize diagonal speed
    if (forward !== 0 || right !== 0) {
      const inv = 1 / Math.hypot(forward, right);
      forward *= inv; right *= inv;
      const dist = SPEED * dt;
      controls.moveForward(forward * dist);
      controls.moveRight(right * dist);
    }
  }

  return { controls, update };
}
