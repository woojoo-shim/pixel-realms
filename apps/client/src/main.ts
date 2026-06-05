import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { WorldScene } from "./scenes/WorldScene.js";

const isTouch =
  "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
// Tighter view — the world reads MUCH bigger when you can only see a small
// slice at once. Mobile: 3× (was 2×). Desktop: 1.8× (was 1×). Sprites stay
// crisp because pixelArt + nearest-neighbor scaling do the up-resing.
const isMobileViewport = window.innerWidth < 900;
const zoom = isMobileViewport ? 3 : 1.8;

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
