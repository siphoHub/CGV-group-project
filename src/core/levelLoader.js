//levelloader
import loadLevel1 from "../env/level1.js";

export function loadLevel(levelName, scene) {
  switch (levelName) {
    case "level1":
      loadLevel1(scene);
      break;
    default:
      console.warn(`Level ${levelName} not found`);
  }
}