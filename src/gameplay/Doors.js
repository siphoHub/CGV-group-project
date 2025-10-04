// src/gameplay/Doors.js
import * as THREE from "three";

const DEBUG = false; // set to true temporarily if you want a few frames of logs

export class DoorManager {
  /**
   * @param {THREE.Scene} scene
   * @param {() => THREE.Vector3} getPlayerPos - returns current player world position
   * @param {{onOpenBoxAdd?: (name:string, box:THREE.Box3)=>void, onOpenBoxRemove?: (name:string, box:THREE.Box3)=>void}} hooks
   * @param {Array<{name:string, openAxis?:'x'|'y'|'z', openAngleDeg?:number, triggerRadius?:number, speed?:number, doorWidth?:number, doorHeight?:number, doorDepth?:number}>} doorConfigs
   */
  constructor(scene, getPlayerPos, hooks = {}, doorConfigs = []) {
    this.scene = scene;
    this.getPlayerPos = getPlayerPos;
    this.onOpenBoxAdd = hooks.onOpenBoxAdd || (() => {});
    this.onOpenBoxRemove = hooks.onOpenBoxRemove || (() => {});
    this.doors = [];
    this._debugFrames = 120; // ~2 seconds of light logs when DEBUG

    const findDoorNode = (root, wantName) => {
      if (!wantName) return null;

      // 1) exact
      let n = root.getObjectByName(wantName);
      if (n) return n;

      // 2) case-insensitive exact
      const wantLC = wantName.toLowerCase();
      let best = null;
      root.traverse(o => {
        if (!o.name) return;
        if (o.name.toLowerCase() === wantLC) best = best || o;
      });
      if (best) return best;

      // 3) case-insensitive contains
      root.traverse(o => {
        if (!o.name) return;
        if (o.name.toLowerCase().includes(wantLC)) best = best || o;
      });
      return best;
    };

    doorConfigs.forEach(cfg => {
      const node = findDoorNode(this.scene, cfg.name);
      if (!node) {
        console.warn(`[DoorManager] Door not found (fuzzy): ${cfg.name}`);
        return;
      }
      if (DEBUG) console.log(`[DoorManager] Hooked "${node.name}" for requested "${cfg.name}"`);

      node.updateWorldMatrix(true, false);

      // Rotation (swing) setup
      const axisName = (cfg.openAxis || "y").toLowerCase();
      const axis = new THREE.Vector3(
        axisName === "x" ? 1 : 0,
        axisName === "y" ? 1 : 0,
        axisName === "z" ? 1 : 0
      );

      const startQuat = node.quaternion.clone();
      const endQuat = startQuat.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(cfg.openAngleDeg ?? 100))
      );

      // Build a world-space doorway AABB from current bounds (robust even if pivot is off)
      const worldBox = new THREE.Box3().setFromObject(node);
      const center   = worldBox.getCenter(new THREE.Vector3());
      const size     = worldBox.getSize(new THREE.Vector3());

      // Use bounds as baseline; inflate slightly so collisions are friendly
      const width  = (cfg.doorWidth  ?? Math.max(1.0, size.x)) * 1.10;
      const height = (cfg.doorHeight ?? Math.max(2.0, size.y)) * 1.10;
      const depth  = (cfg.doorDepth  ?? Math.max(0.4, size.z)) * 1.50;

      const min = new THREE.Vector3(center.x - width*0.5,  center.y - height*0.5, center.z - depth*0.5);
      const max = new THREE.Vector3(center.x + width*0.5,  center.y + height*0.5, center.z + depth*0.5);
      const passBox = new THREE.Box3(min, max);

      this.doors.push({
        name: cfg.name,
        node,
        startQuat,
        endQuat,
        t: 0,                                   // 0=closed → 1=open
        speed: cfg.speed ?? 2.0,                // seconds to open/close
        triggerRadius: cfg.triggerRadius ?? 3.0,
        locked: !!node.userData.locked,
        addedPassBox: false,
        passBox,
        tmp: new THREE.Vector3()
      });
    });
  }

  setLocked(name, locked = true) {
    const d = this.doors.find(x => x.name === name || x.node?.name === name);
    if (d) d.locked = locked;
  }

  update(dt) {
    if (!this.doors.length) return;

    const player = this.getPlayerPos();

    for (const d of this.doors) {
      // Measure proximity to the *current* bounding-box center (not pivot)
      const liveBox = new THREE.Box3().setFromObject(d.node);
      liveBox.getCenter(d.tmp);
      const dist = d.tmp.distanceTo(player);

      const shouldOpen = dist <= d.triggerRadius && !d.locked;

      // Move t toward target (0/1) at the configured speed
      const target = shouldOpen ? 1 : 0;
      if (d.t !== target) {
        const step = dt / Math.max(0.0001, d.speed);
        d.t = THREE.MathUtils.clamp(d.t + Math.sign(target - d.t) * step, 0, 1);
      }

      // Smoothstep easing and slerp rotation
      const s = d.t * d.t * (3 - 2 * d.t);
      THREE.Quaternion.slerp(d.startQuat, d.endQuat, d.node.quaternion, s);

      // Dynamic passthrough: add when partly open, remove when almost closed
      if (s >= 0.25 && !d.addedPassBox) {
        this.onOpenBoxAdd(d.node.name, d.passBox);
        d.addedPassBox = true;
        if (DEBUG) console.log(`[DoorManager] +passBox ${d.node.name}`);
      } else if (s <= 0.05 && d.addedPassBox) {
        this.onOpenBoxRemove(d.node.name, d.passBox);
        d.addedPassBox = false;
        if (DEBUG) console.log(`[DoorManager] -passBox ${d.node.name}`);
      }

      if (DEBUG && this._debugFrames-- > 0) {
        console.log(`[DoorManager] ${d.node.name} dist=${dist.toFixed(2)} t=${d.t.toFixed(2)} locked=${d.locked}`);
      }
    }
  }
}
