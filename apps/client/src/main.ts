import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { WorldScene } from "./scenes/WorldScene.js";

const isTouch =
  "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
// Zoom in only on narrow (mobile) screens so sprites stay readable.
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
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
    // Hint the GPU about workload — low-power on mobile saves battery
    // and stops the OS from throttling us.
    powerPreference: isTouch ? "low-power" : "high-performance",
  },
  input: {
    activePointers: 3,
    touch: true,
  },
  scene: [BootScene, MenuScene, WorldScene],
  // 45fps on phones leaves headroom for renderer + WS sync.
  fps: { target: isTouch ? 45 : 60 },
});
