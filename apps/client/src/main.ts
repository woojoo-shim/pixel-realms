import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { WorldScene } from "./scenes/WorldScene.js";

// Zoom in only on narrow (mobile) screens so sprites stay readable.
// On wide desktop screens, zoom=1 so the world fills the viewport.
const isMobileViewport = window.innerWidth < 900;
const zoom = isMobileViewport ? 2 : 1;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: window.innerWidth,
  height: window.innerHeight,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: "#0a0a0a",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom,
  },
  input: {
    activePointers: 3,
    touch: true,
  },
  scene: [BootScene, MenuScene, WorldScene],
  fps: { target: 60 },
});
