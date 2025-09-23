import { createLevel1 } from "../env/level1.js";

export function loadLevel(scene, levelNumber) {
  switch (levelNumber) {
    case 1:
      createLevel1(scene);
      break;
    // later you’ll add level2, level3
    default:
      console.warn("Unknown level:", levelNumber);
  }
}

