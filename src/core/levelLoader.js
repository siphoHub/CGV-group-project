//levelloader
import loadLevel1 from "../env/level1.js";
import loadLevel2 from "../env/level2.js";

export function loadLevel(levelName, scene) {
  switch (levelName) {
    case "level1":
      loadLevel1(scene);
      break;
    case "level2":
      loadLevel2(scene);
      break;
    default:
      console.warn(`Level ${levelName} not found`);
  }
}