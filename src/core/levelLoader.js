//levelloader
import loadLevel1 from "../env/level1.js";
import loadLevel3 from "../env/level3.js";

export function loadLevel(levelName, scene) {
  switch (levelName) {
    case "level1":
      loadLevel1(scene);
      break;
    case "level3":
      loadLevel3(scene);
      break;
    default:
      console.warn(`Level ${levelName} not found`);
  }
}