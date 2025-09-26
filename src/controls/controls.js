
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

  
  const SPEED_WALK   = 3.5;
  const SPEED_SPRINT = 5.5;
  const SPEED_CROUCH = 1.8;

  const HEAD_STAND  = 1.7;
  const HEAD_CROUCH = 1.2;

  function update(dt) {
    if (!controls.isLocked) return;

    
    let forward = 0, right = 0;
    if (keys.get('KeyW') || keys.get('ArrowUp'))    forward += 1;
    if (keys.get('KeyS') || keys.get('ArrowDown'))  forward -= 1;
    if (keys.get('KeyD') || keys.get('ArrowRight')) right   += 1;
    if (keys.get('KeyA') || keys.get('ArrowLeft'))  right   -= 1;

  
    const sprinting = keys.get('ShiftLeft')   || keys.get('ShiftRight');
    const crouching = keys.get('ControlLeft') || keys.get('ControlRight');

    
    const speed =
      crouching ? SPEED_CROUCH :
      sprinting ? SPEED_SPRINT :
                  SPEED_WALK;

    if (forward !== 0 || right !== 0) {
      const inv = 1 / Math.hypot(forward, right);
      forward *= inv; right *= inv;
      const dist = speed * dt;
      controls.moveForward(forward * dist);
      controls.moveRight(right * dist);
    }

   
    const targetY = crouching ? HEAD_CROUCH : HEAD_STAND;
    camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 10);
  }

  return { controls, update };
}
