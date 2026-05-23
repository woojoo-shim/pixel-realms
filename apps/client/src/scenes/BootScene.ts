import Phaser from "phaser";
import { MONSTER_DEFS, type MonsterType, type MonsterDef } from "@pr/shared";

/* ────────────────────────────────────────────────────────────────── */
/* Helpers                                                            */
/* ────────────────────────────────────────────────────────────────── */

function tex(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void
) {
  const g = scene.add.graphics({ x: 0, y: 0 });
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

/* ────────────────────────────────────────────────────────────────── */
/* Player                                                             */
/* ────────────────────────────────────────────────────────────────── */

function makePlayer(scene: Phaser.Scene, key: string, body: number, outline: number) {
  tex(scene, key, 24, 24, (g) => {
    g.fillStyle(outline, 1);
    g.fillRect(0, 0, 24, 24);
    g.fillStyle(body, 1);
    g.fillRect(2, 2, 20, 20);
    g.fillStyle(0x0a0a0a, 1);
    g.fillRect(7, 9, 3, 3);
    g.fillRect(14, 9, 3, 3);
    g.fillStyle(0x000000, 0.35);
    g.fillRect(2, 20, 20, 2);
  });
}

/* ────────────────────────────────────────────────────────────────── */
/* Buildings                                                          */
/* ────────────────────────────────────────────────────────────────── */

function makeHouse(scene: Phaser.Scene) {
  tex(scene, "deco-house", 64, 64, (g) => {
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(32, 62, 50, 6);
    // walls
    g.fillStyle(0xb89870, 1);
    g.fillRect(6, 26, 52, 34);
    g.fillStyle(0x9c805a, 1);
    g.fillRect(6, 56, 52, 4);
    // wood beams
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(6, 26, 4, 34);
    g.fillRect(54, 26, 4, 34);
    g.fillRect(6, 26, 52, 3);
    // roof
    g.fillStyle(0x9c3a28, 1);
    g.fillTriangle(0, 30, 32, 0, 64, 30);
    g.fillStyle(0x782718, 1);
    g.fillTriangle(0, 30, 32, 6, 64, 30);
    g.fillStyle(0x5a1a10, 1);
    g.fillRect(0, 28, 64, 4);
    // chimney
    g.fillStyle(0x6a4030, 1);
    g.fillRect(44, 4, 8, 14);
    // door
    g.fillStyle(0x3a2410, 1);
    g.fillRect(27, 42, 10, 18);
    g.fillStyle(0xd4a44a, 1);
    g.fillRect(34, 51, 2, 2);
    // window
    g.fillStyle(0x1a2a3a, 1);
    g.fillRect(14, 36, 8, 8);
    g.fillRect(42, 36, 8, 8);
    g.fillStyle(0xa8c8e8, 0.8);
    g.fillRect(14, 36, 8, 4);
    g.fillRect(42, 36, 8, 4);
    g.lineStyle(1, 0x4a2e15, 1);
    g.strokeLineShape(new Phaser.Geom.Line(18, 36, 18, 44));
    g.strokeLineShape(new Phaser.Geom.Line(46, 36, 46, 44));
  });
}

function makeInn(scene: Phaser.Scene) {
  tex(scene, "deco-inn", 96, 72, (g) => {
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(48, 70, 76, 6);
    g.fillStyle(0xc8a878, 1);
    g.fillRect(6, 30, 84, 38);
    g.fillStyle(0xa88858, 1);
    g.fillRect(6, 64, 84, 4);
    // wood frame
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(6, 30, 4, 38);
    g.fillRect(86, 30, 4, 38);
    g.fillRect(46, 30, 4, 38);
    g.fillRect(6, 30, 84, 3);
    g.fillRect(6, 48, 84, 2);
    // roof — gabled
    g.fillStyle(0x6a3a28, 1);
    g.fillTriangle(0, 34, 48, 0, 96, 34);
    g.fillStyle(0x4a261c, 1);
    g.fillTriangle(0, 34, 48, 6, 96, 34);
    g.fillStyle(0x3a1a10, 1);
    g.fillRect(0, 32, 96, 4);
    // sign
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(40, 22, 16, 10);
    g.fillStyle(0xd4a44a, 1);
    g.fillRect(42, 24, 12, 6);
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(47, 22, 2, 2);
    // door
    g.fillStyle(0x3a2410, 1);
    g.fillRect(42, 50, 12, 18);
    g.fillStyle(0xd4a44a, 1);
    g.fillRect(51, 60, 2, 2);
    // windows (warm light)
    g.fillStyle(0xf5c870, 1);
    g.fillRect(16, 38, 10, 8);
    g.fillRect(70, 38, 10, 8);
    g.fillRect(16, 54, 10, 8);
    g.fillRect(70, 54, 10, 8);
    g.lineStyle(1, 0x4a2e15, 1);
    g.strokeLineShape(new Phaser.Geom.Line(21, 38, 21, 46));
    g.strokeLineShape(new Phaser.Geom.Line(75, 38, 75, 46));
    g.strokeLineShape(new Phaser.Geom.Line(21, 54, 21, 62));
    g.strokeLineShape(new Phaser.Geom.Line(75, 54, 75, 62));
  });
}

function makeShop(scene: Phaser.Scene) {
  tex(scene, "deco-shop", 72, 64, (g) => {
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(36, 62, 58, 6);
    // walls
    g.fillStyle(0xa8c0a0, 1);
    g.fillRect(6, 28, 60, 32);
    g.fillStyle(0x88a080, 1);
    g.fillRect(6, 56, 60, 4);
    // roof
    g.fillStyle(0x3a6a8a, 1);
    g.fillTriangle(0, 32, 36, 4, 72, 32);
    g.fillStyle(0x254a6a, 1);
    g.fillTriangle(0, 32, 36, 10, 72, 32);
    // awning stripes
    g.fillStyle(0xc8484a, 1);
    g.fillRect(8, 34, 56, 6);
    g.fillStyle(0xe8e0d0, 1);
    for (let i = 0; i < 7; i++) {
      g.fillRect(10 + i * 8, 34, 4, 6);
    }
    // door + display window
    g.fillStyle(0x3a2410, 1);
    g.fillRect(28, 42, 12, 18);
    g.fillStyle(0x1a2a3a, 1);
    g.fillRect(46, 42, 16, 12);
    g.fillStyle(0xa8c8e8, 0.8);
    g.fillRect(46, 42, 16, 6);
    // wares display
    g.fillStyle(0xd4a44a, 1);
    g.fillRect(50, 48, 2, 4);
    g.fillRect(55, 48, 3, 4);
    g.fillStyle(0xc84848, 1);
    g.fillRect(8, 46, 6, 10);
  });
}

function makeSmithy(scene: Phaser.Scene) {
  tex(scene, "deco-smithy", 72, 64, (g) => {
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(36, 62, 58, 6);
    // dark stone walls
    g.fillStyle(0x6a5048, 1);
    g.fillRect(6, 28, 60, 32);
    g.fillStyle(0x4a3a32, 1);
    g.fillRect(6, 56, 60, 4);
    // brick pattern
    g.fillStyle(0x5a4038, 1);
    for (let row = 0; row < 4; row++) {
      const yy = 30 + row * 7;
      const off = row % 2 === 0 ? 0 : 6;
      for (let col = 0; col < 6; col++) {
        g.fillRect(8 + off + col * 10, yy, 8, 1);
      }
    }
    // roof
    g.fillStyle(0x4a4a52, 1);
    g.fillTriangle(0, 32, 36, 4, 72, 32);
    g.fillStyle(0x2a2a32, 1);
    g.fillTriangle(0, 32, 36, 10, 72, 32);
    // chimney with smoke glow
    g.fillStyle(0x3a2818, 1);
    g.fillRect(50, 0, 10, 18);
    g.fillStyle(0xff8030, 0.55);
    g.fillCircle(55, 4, 4);
    // open door — forge glow
    g.fillStyle(0xff6020, 1);
    g.fillRect(26, 38, 16, 22);
    g.fillStyle(0xffe080, 1);
    g.fillRect(30, 46, 8, 8);
    g.fillStyle(0x000000, 1);
    g.fillRect(28, 38, 2, 22);
    g.fillRect(38, 38, 2, 22);
    // anvil outside
    g.fillStyle(0x2a2a32, 1);
    g.fillRect(48, 50, 12, 6);
    g.fillStyle(0x4a4a52, 1);
    g.fillRect(50, 48, 8, 4);
  });
}

/* ────────────────────────────────────────────────────────────────── */
/* Decorations: trees / rocks / etc.                                  */
/* ────────────────────────────────────────────────────────────────── */

function makeTree(scene: Phaser.Scene) {
  tex(scene, "deco-tree", 28, 36, (g) => {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(14, 33, 18, 5);
    g.fillStyle(0x5b3a1a, 1);
    g.fillRect(12, 22, 4, 10);
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(12, 22, 1, 10);
    g.fillStyle(0x1a3a14, 1);
    g.fillCircle(14, 14, 12);
    g.fillStyle(0x2b5a22, 1);
    g.fillCircle(11, 12, 8);
    g.fillStyle(0x3e7a31, 1);
    g.fillCircle(9, 11, 4);
  });
}

function makePine(scene: Phaser.Scene) {
  tex(scene, "deco-pine", 24, 40, (g) => {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(12, 37, 14, 4);
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(10, 28, 4, 8);
    g.fillStyle(0x163a18, 1);
    g.fillTriangle(12, 6, 0, 30, 24, 30);
    g.fillStyle(0x255a26, 1);
    g.fillTriangle(12, 10, 3, 26, 21, 26);
    g.fillStyle(0x357a36, 1);
    g.fillTriangle(12, 14, 6, 22, 18, 22);
  });
}

function makeRock(scene: Phaser.Scene) {
  tex(scene, "deco-rock", 22, 18, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(11, 16, 18, 3);
    g.fillStyle(0x4a4a52, 1);
    g.fillEllipse(11, 9, 18, 12);
    g.fillStyle(0x6a6a72, 1);
    g.fillEllipse(8, 6, 8, 5);
    g.fillStyle(0x3a3a42, 1);
    g.fillEllipse(15, 11, 4, 2);
  });
}

function makeRockSmall(scene: Phaser.Scene) {
  tex(scene, "deco-rock-small", 12, 10, (g) => {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(6, 9, 10, 2);
    g.fillStyle(0x5a5a62, 1);
    g.fillEllipse(6, 5, 10, 6);
    g.fillStyle(0x7a7a82, 1);
    g.fillEllipse(4, 3, 4, 3);
  });
}

function makeCactus(scene: Phaser.Scene) {
  tex(scene, "deco-cactus", 18, 28, (g) => {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(9, 26, 12, 3);
    g.fillStyle(0x2d6a3c, 1);
    g.fillRect(7, 4, 4, 22);
    g.fillRect(2, 10, 4, 8);
    g.fillRect(12, 12, 4, 6);
    g.fillRect(2, 10, 2, 10);
    g.fillRect(14, 12, 2, 8);
    g.fillStyle(0x3e8a4d, 1);
    g.fillRect(7, 4, 1, 22);
  });
}

function makeLilypad(scene: Phaser.Scene) {
  tex(scene, "deco-lilypad", 16, 12, (g) => {
    g.fillStyle(0x1a4a3a, 1);
    g.fillEllipse(8, 6, 14, 8);
    g.fillStyle(0x2a6a5a, 1);
    g.fillEllipse(8, 6, 10, 5);
    g.fillStyle(0xf5b5d5, 1);
    g.fillRect(7, 4, 2, 2);
  });
}

function makeFountain(scene: Phaser.Scene) {
  tex(scene, "deco-fountain", 48, 48, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(24, 44, 36, 6);
    g.fillStyle(0x9a8a6a, 1);
    g.fillCircle(24, 24, 22);
    g.fillStyle(0x7a6a4a, 1);
    g.fillCircle(24, 24, 20);
    g.fillStyle(0x4a7aaa, 1);
    g.fillCircle(24, 24, 16);
    g.fillStyle(0x6a9aca, 1);
    g.fillCircle(24, 24, 14);
    g.fillStyle(0x9a8a6a, 1);
    g.fillCircle(24, 24, 6);
    g.fillStyle(0xb5d5f5, 0.85);
    g.fillCircle(24, 18, 4);
  });
}

function makeWell(scene: Phaser.Scene) {
  tex(scene, "deco-well", 24, 28, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(12, 26, 20, 4);
    // stone base
    g.fillStyle(0x6a6a72, 1);
    g.fillEllipse(12, 20, 20, 10);
    g.fillStyle(0x4a4a52, 1);
    g.fillEllipse(12, 22, 20, 6);
    // water
    g.fillStyle(0x1a3a5a, 1);
    g.fillEllipse(12, 18, 14, 5);
    // posts
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(4, 4, 3, 16);
    g.fillRect(17, 4, 3, 16);
    // roof
    g.fillStyle(0x782718, 1);
    g.fillTriangle(2, 6, 12, 0, 22, 6);
    g.fillStyle(0x5a1a10, 1);
    g.fillRect(2, 5, 20, 2);
  });
}

function makeFenceH(scene: Phaser.Scene) {
  tex(scene, "deco-fence-h", 32, 16, (g) => {
    g.fillStyle(0x000000, 0.3);
    g.fillRect(0, 14, 32, 2);
    g.fillStyle(0x6a4828, 1);
    g.fillRect(0, 6, 32, 3);
    g.fillRect(0, 10, 32, 3);
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(4, 2, 3, 12);
    g.fillRect(15, 2, 3, 12);
    g.fillRect(26, 2, 3, 12);
  });
}

function makeFenceV(scene: Phaser.Scene) {
  tex(scene, "deco-fence-v", 16, 32, (g) => {
    g.fillStyle(0x000000, 0.3);
    g.fillRect(0, 30, 16, 2);
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(6, 0, 3, 32);
    g.fillRect(11, 0, 3, 32);
    g.fillStyle(0x6a4828, 1);
    g.fillRect(2, 6, 12, 3);
    g.fillRect(2, 18, 12, 3);
  });
}

function makeFencePost(scene: Phaser.Scene) {
  tex(scene, "deco-fence-post", 16, 22, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(8, 20, 12, 3);
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(5, 0, 6, 20);
    g.fillStyle(0x6a4828, 1);
    g.fillRect(5, 0, 1, 20);
    g.fillStyle(0x2a1a08, 1);
    g.fillRect(3, 0, 10, 3);
  });
}

function makeCrop(scene: Phaser.Scene) {
  tex(scene, "deco-crop", 14, 14, (g) => {
    g.fillStyle(0x3e7a31, 1);
    g.fillTriangle(7, 2, 2, 12, 12, 12);
    g.fillStyle(0x5a9a4a, 1);
    g.fillTriangle(7, 4, 3, 11, 11, 11);
    g.fillStyle(0xd4a44a, 1);
    g.fillRect(6, 1, 2, 4);
  });
}

function makePortal(scene: Phaser.Scene) {
  tex(scene, "deco-portal", 32, 40, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(16, 38, 22, 4);
    // arch frame
    g.fillStyle(0x4a4a52, 1);
    g.fillRect(2, 8, 28, 32);
    g.fillStyle(0x2a2a32, 1);
    g.fillRect(2, 8, 28, 4);
    // inner void
    g.fillStyle(0x1a1a2a, 1);
    g.fillRect(6, 12, 20, 26);
    // glowing portal
    g.fillStyle(0x6ee7b7, 0.8);
    g.fillEllipse(16, 24, 14, 22);
    g.fillStyle(0xb5f5d8, 0.9);
    g.fillEllipse(16, 24, 8, 14);
    g.fillStyle(0xffffff, 0.7);
    g.fillEllipse(16, 22, 3, 6);
    // base step
    g.fillStyle(0x5a5a62, 1);
    g.fillRect(0, 38, 32, 2);
  });
}

/* ────────────────────────────────────────────────────────────────── */
/* Monsters                                                           */
/* ────────────────────────────────────────────────────────────────── */

/** Lighten/darken a hex color by a fixed RGB delta. */
function shade(hex: number, delta: number): number {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 0xff) + delta));
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, (hex & 0xff) + delta));
  return (r << 16) | (g << 8) | b;
}

function eyes(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  spread: number,
  size: number,
  glow?: number
) {
  if (glow !== undefined) {
    g.fillStyle(glow, 0.35);
    g.fillCircle(cx - spread, cy, size + 1.6);
    g.fillCircle(cx + spread, cy, size + 1.6);
    g.fillStyle(glow, 1);
    g.fillCircle(cx - spread, cy, size);
    g.fillCircle(cx + spread, cy, size);
    return;
  }
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - spread, cy, size);
  g.fillCircle(cx + spread, cy, size);
  g.fillStyle(0x000000, 1);
  g.fillCircle(cx - spread, cy, size * 0.55);
  g.fillCircle(cx + spread, cy, size * 0.55);
}

function drawMonster(
  g: Phaser.GameObjects.Graphics,
  type: MonsterType,
  def: MonsterDef,
  cx: number,
  cy: number
) {
  const base = def.color;
  const light = shade(base, 30);
  const dark = shade(base, -35);
  const deep = shade(base, -55);
  const acc = def.accent;

  switch (type) {
    case "slime": {
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy + 2, 26, 22);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy, 24, 20);
      g.fillStyle(light, 1);
      g.fillEllipse(cx - 3, cy - 3, 14, 8);
      g.fillStyle(acc, 0.85);
      g.fillEllipse(cx, cy + 3, 8, 5);
      g.fillStyle(0xffffff, 0.6);
      g.fillEllipse(cx - 6, cy - 5, 5, 3);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(cx - 8, cy - 2, 1.5);
      eyes(g, cx, cy - 1, 5, 2);
      g.fillStyle(0x000000, 1);
      g.fillRect(cx - 3, cy + 5, 6, 1);
      g.fillRect(cx - 4, cy + 4, 1, 1);
      g.fillRect(cx + 3, cy + 4, 1, 1);
      break;
    }
    case "wolf": {
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy + 4, 24, 16);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy + 2, 22, 14);
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy - 4, 22, 18);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy - 5, 20, 16);
      g.fillStyle(dark, 1);
      g.fillTriangle(cx - 9, cy - 11, cx - 5, cy - 18, cx - 3, cy - 11);
      g.fillTriangle(cx + 9, cy - 11, cx + 5, cy - 18, cx + 3, cy - 11);
      g.fillStyle(acc, 1);
      g.fillTriangle(cx - 7, cy - 12, cx - 5, cy - 16, cx - 4, cy - 12);
      g.fillTriangle(cx + 7, cy - 12, cx + 5, cy - 16, cx + 4, cy - 12);
      g.fillStyle(light, 1);
      g.fillEllipse(cx, cy + 1, 9, 6);
      g.fillStyle(0x1a0e08, 1);
      g.fillRect(cx - 1, cy - 1, 2, 2);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(cx - 3, cy + 3, cx - 2, cy + 6, cx - 1, cy + 3);
      g.fillTriangle(cx + 1, cy + 3, cx + 2, cy + 6, cx + 3, cy + 3);
      eyes(g, cx, cy - 6, 4, 1.8, 0xfde047);
      break;
    }
    case "spider": {
      g.lineStyle(2, deep, 1);
      for (let i = 0; i < 4; i++) {
        const ay = (i - 1.5) * 4;
        g.beginPath();
        g.moveTo(cx - 6, cy);
        g.lineTo(cx - 13, cy + ay - 2);
        g.lineTo(cx - 16, cy + ay + 3);
        g.strokePath();
        g.beginPath();
        g.moveTo(cx + 6, cy);
        g.lineTo(cx + 13, cy + ay - 2);
        g.lineTo(cx + 16, cy + ay + 3);
        g.strokePath();
      }
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy + 3, 14, 10);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy + 2, 12, 9);
      g.fillStyle(acc, 1);
      g.fillCircle(cx, cy + 1, 3);
      g.fillStyle(dark, 1);
      g.fillCircle(cx, cy - 4, 7);
      g.fillStyle(base, 1);
      g.fillCircle(cx, cy - 4, 6);
      g.fillStyle(0xff1744, 1);
      g.fillCircle(cx - 3, cy - 5, 1.2);
      g.fillCircle(cx + 3, cy - 5, 1.2);
      g.fillCircle(cx - 1, cy - 6, 1);
      g.fillCircle(cx + 1, cy - 6, 1);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(cx - 3, cy - 1, cx - 2, cy + 2, cx - 1, cy - 1);
      g.fillTriangle(cx + 1, cy - 1, cx + 2, cy + 2, cx + 3, cy - 1);
      break;
    }
    case "scorpion": {
      g.fillStyle(dark, 1);
      for (let i = 0; i < 5; i++) {
        const tx = cx + 6 - i * 1.5;
        const ty = cy - 4 - i * 3;
        g.fillRect(tx - 2, ty, 4, 4);
      }
      g.fillStyle(deep, 1);
      g.fillTriangle(cx - 1, cy - 18, cx + 4, cy - 20, cx + 1, cy - 13);
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy + 3, 22, 14);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy + 2, 20, 12);
      g.fillStyle(deep, 1);
      g.fillRect(cx - 9, cy, 18, 1);
      g.fillRect(cx - 9, cy + 4, 18, 1);
      g.fillStyle(dark, 1);
      g.fillRect(cx - 14, cy - 1, 6, 3);
      g.fillRect(cx + 8, cy - 1, 6, 3);
      g.fillStyle(base, 1);
      g.fillTriangle(cx - 16, cy - 3, cx - 10, cy - 3, cx - 13, cy + 2);
      g.fillTriangle(cx + 16, cy - 3, cx + 10, cy - 3, cx + 13, cy + 2);
      g.fillStyle(deep, 1);
      g.fillTriangle(cx - 15, cy + 1, cx - 11, cy + 1, cx - 13, cy + 4);
      g.fillTriangle(cx + 15, cy + 1, cx + 11, cy + 1, cx + 13, cy + 4);
      g.lineStyle(1.5, deep, 1);
      for (let i = 0; i < 3; i++) {
        const lx = cx - 6 + i * 6;
        g.beginPath();
        g.moveTo(lx, cy + 5);
        g.lineTo(lx - 2, cy + 9);
        g.strokePath();
        g.beginPath();
        g.moveTo(lx, cy + 5);
        g.lineTo(lx + 2, cy + 9);
        g.strokePath();
      }
      g.fillStyle(0x000000, 1);
      g.fillCircle(cx - 2, cy - 1, 0.8);
      g.fillCircle(cx + 2, cy - 1, 0.8);
      break;
    }
    case "sandworm": {
      for (let i = 0; i < 4; i++) {
        const w = 24 - i * 2;
        const yy = cy + 4 - i * 5;
        g.fillStyle(deep, 1);
        g.fillEllipse(cx, yy + 1, w + 2, 8);
        g.fillStyle(dark, 1);
        g.fillEllipse(cx, yy, w, 7);
        g.fillStyle(base, 1);
        g.fillEllipse(cx, yy - 1, w - 4, 5);
      }
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy - 12, 18, 12);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy - 13, 16, 10);
      g.fillStyle(0x1a0a08, 1);
      g.fillCircle(cx, cy - 11, 6);
      g.fillStyle(0xfff7d6, 1);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const tx = cx + Math.cos(a) * 6;
        const ty = cy - 11 + Math.sin(a) * 6;
        const tx2 = cx + Math.cos(a) * 3;
        const ty2 = cy - 11 + Math.sin(a) * 3;
        g.fillTriangle(tx, ty, tx2, ty2, tx + 1, ty + 1);
      }
      g.fillStyle(0xd9c188, 1);
      g.fillRect(cx - 14, cy + 10, 2, 2);
      g.fillRect(cx + 12, cy + 9, 2, 2);
      g.fillRect(cx + 14, cy + 12, 1, 1);
      break;
    }
    case "mummy": {
      g.fillStyle(0x8d6e63, 1);
      g.fillEllipse(cx, cy + 4, 20, 18);
      g.fillEllipse(cx, cy - 7, 16, 14);
      g.fillStyle(base, 1);
      g.fillRect(cx - 10, cy - 12, 20, 3);
      g.fillRect(cx - 11, cy - 8, 22, 3);
      g.fillRect(cx - 8, cy - 4, 17, 3);
      g.fillRect(cx - 11, cy + 1, 22, 3);
      g.fillRect(cx - 10, cy + 5, 21, 3);
      g.fillRect(cx - 11, cy + 9, 22, 3);
      g.fillStyle(shade(base, -25), 1);
      g.fillRect(cx - 10, cy - 10, 20, 1);
      g.fillRect(cx - 11, cy - 6, 22, 1);
      g.fillRect(cx - 11, cy + 3, 22, 1);
      g.fillRect(cx - 11, cy + 7, 22, 1);
      g.fillStyle(base, 1);
      g.fillRect(cx - 8, cy + 12, 3, 6);
      g.fillRect(cx + 5, cy + 12, 3, 5);
      g.fillStyle(0x000000, 1);
      g.fillRect(cx - 8, cy - 4, 17, 3);
      g.fillStyle(0xfde047, 0.5);
      g.fillCircle(cx - 4, cy - 3, 2.5);
      g.fillCircle(cx + 4, cy - 3, 2.5);
      g.fillStyle(0xfde047, 1);
      g.fillCircle(cx - 4, cy - 3, 1.5);
      g.fillCircle(cx + 4, cy - 3, 1.5);
      break;
    }
    case "bat": {
      g.fillStyle(deep, 1);
      g.fillTriangle(cx - 4, cy - 2, cx - 18, cy - 6, cx - 16, cy + 4);
      g.fillTriangle(cx + 4, cy - 2, cx + 18, cy - 6, cx + 16, cy + 4);
      g.fillStyle(dark, 1);
      g.fillTriangle(cx - 4, cy - 1, cx - 11, cy - 3, cx - 10, cy + 2);
      g.fillTriangle(cx + 4, cy - 1, cx + 11, cy - 3, cx + 10, cy + 2);
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy + 2, 12, 14);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy + 1, 10, 12);
      g.fillStyle(dark, 1);
      g.fillTriangle(cx - 4, cy - 6, cx - 2, cy - 11, cx - 1, cy - 6);
      g.fillTriangle(cx + 4, cy - 6, cx + 2, cy - 11, cx + 1, cy - 6);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(cx - 2, cy + 4, cx - 1, cy + 7, cx, cy + 4);
      g.fillTriangle(cx + 2, cy + 4, cx + 1, cy + 7, cx, cy + 4);
      eyes(g, cx, cy - 1, 3, 2, 0xff1744);
      break;
    }
    case "golem": {
      g.fillStyle(deep, 1);
      g.fillRect(cx - 9, cy + 8, 6, 8);
      g.fillRect(cx + 3, cy + 8, 6, 8);
      g.fillStyle(dark, 1);
      g.fillRect(cx - 9, cy + 8, 5, 7);
      g.fillRect(cx + 3, cy + 8, 5, 7);
      g.fillStyle(deep, 1);
      g.fillRect(cx - 18, cy - 4, 7, 14);
      g.fillRect(cx + 11, cy - 4, 7, 14);
      g.fillStyle(dark, 1);
      g.fillRect(cx - 17, cy - 3, 5, 12);
      g.fillRect(cx + 12, cy - 3, 5, 12);
      g.fillStyle(base, 1);
      g.fillRect(cx - 19, cy + 8, 9, 7);
      g.fillRect(cx + 10, cy + 8, 9, 7);
      g.fillStyle(deep, 1);
      g.fillRect(cx - 11, cy - 4, 22, 14);
      g.fillStyle(dark, 1);
      g.fillRect(cx - 10, cy - 3, 20, 12);
      g.fillStyle(base, 1);
      g.fillRect(cx - 10, cy - 3, 20, 2);
      g.fillStyle(deep, 1);
      g.fillRect(cx - 8, cy - 14, 16, 10);
      g.fillStyle(dark, 1);
      g.fillRect(cx - 7, cy - 13, 14, 9);
      g.fillStyle(base, 1);
      g.fillRect(cx - 7, cy - 13, 14, 2);
      eyes(g, cx, cy - 9, 3, 1.6, 0x84ffff);
      g.fillStyle(0x84ffff, 0.5);
      g.fillCircle(cx, cy + 3, 4);
      g.fillStyle(0x84ffff, 1);
      g.fillRect(cx - 1, cy + 1, 2, 5);
      g.fillRect(cx - 3, cy + 3, 6, 1);
      g.fillStyle(deep, 1);
      g.fillRect(cx + 4, cy - 1, 1, 4);
      g.fillRect(cx - 5, cy + 5, 1, 3);
      break;
    }
    case "goblin": {
      g.fillStyle(dark, 1);
      g.fillRect(cx - 5, cy + 8, 4, 8);
      g.fillRect(cx + 1, cy + 8, 4, 8);
      g.fillStyle(0x3e2723, 1);
      g.fillRect(cx - 6, cy + 14, 5, 3);
      g.fillRect(cx + 1, cy + 14, 5, 3);
      g.fillStyle(0x6d4c41, 1);
      g.fillEllipse(cx, cy + 6, 14, 10);
      g.fillStyle(0x4e342e, 1);
      g.fillRect(cx - 5, cy + 10, 10, 1);
      g.fillStyle(0x3e2723, 1);
      g.fillRect(cx - 6, cy + 9, 12, 2);
      g.fillStyle(0xfdd835, 1);
      g.fillRect(cx - 1, cy + 9, 2, 2);
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy - 3, 16, 14);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy - 4, 14, 12);
      g.fillStyle(dark, 1);
      g.fillTriangle(cx - 8, cy - 4, cx - 13, cy - 9, cx - 6, cy - 1);
      g.fillTriangle(cx + 8, cy - 4, cx + 13, cy - 9, cx + 6, cy - 1);
      g.fillStyle(base, 1);
      g.fillTriangle(cx - 8, cy - 3, cx - 11, cy - 7, cx - 7, cy - 1);
      g.fillTriangle(cx + 8, cy - 3, cx + 11, cy - 7, cx + 7, cy - 1);
      g.fillStyle(shade(base, -20), 1);
      g.fillTriangle(cx, cy - 4, cx + 3, cy - 1, cx, cy);
      g.fillStyle(0x000000, 1);
      g.fillRect(cx - 3, cy + 1, 6, 1);
      g.fillStyle(0xffffff, 1);
      g.fillRect(cx + 2, cy + 1, 1, 2);
      eyes(g, cx, cy - 5, 4, 1.6);
      g.fillStyle(0x5d4037, 1);
      g.fillRect(cx + 7, cy + 1, 3, 10);
      g.fillStyle(0x3e2723, 1);
      g.fillRect(cx + 7, cy + 1, 3, 2);
      g.fillRect(cx + 9, cy + 4, 1, 1);
      break;
    }
    case "crab": {
      g.lineStyle(2, deep, 1);
      for (let i = 0; i < 3; i++) {
        const lx = cx - 6 + i * 2;
        g.beginPath();
        g.moveTo(lx, cy + 4);
        g.lineTo(lx - 4, cy + 10);
        g.lineTo(lx - 6, cy + 13);
        g.strokePath();
        g.beginPath();
        g.moveTo(lx + 8, cy + 4);
        g.lineTo(lx + 12, cy + 10);
        g.lineTo(lx + 14, cy + 13);
        g.strokePath();
      }
      g.fillStyle(dark, 1);
      g.fillRect(cx - 18, cy - 4, 6, 3);
      g.fillRect(cx + 12, cy - 4, 6, 3);
      g.fillStyle(base, 1);
      g.fillEllipse(cx - 18, cy - 3, 10, 8);
      g.fillEllipse(cx + 18, cy - 3, 10, 8);
      g.fillStyle(deep, 1);
      g.fillTriangle(cx - 20, cy - 7, cx - 14, cy - 4, cx - 20, cy - 1);
      g.fillTriangle(cx + 20, cy - 7, cx + 14, cy - 4, cx + 20, cy - 1);
      g.fillStyle(deep, 1);
      g.fillEllipse(cx, cy + 2, 24, 14);
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy + 1, 22, 12);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy, 20, 10);
      g.fillStyle(light, 1);
      g.fillEllipse(cx - 3, cy - 3, 8, 3);
      g.fillStyle(deep, 1);
      g.fillCircle(cx - 5, cy + 1, 1.5);
      g.fillCircle(cx + 5, cy + 1, 1.5);
      g.fillCircle(cx, cy - 2, 1);
      g.fillStyle(deep, 1);
      g.fillRect(cx - 4, cy - 5, 1, 3);
      g.fillRect(cx + 3, cy - 5, 1, 3);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(cx - 4, cy - 6, 1.6);
      g.fillCircle(cx + 4, cy - 6, 1.6);
      g.fillStyle(0x000000, 1);
      g.fillCircle(cx - 4, cy - 6, 0.8);
      g.fillCircle(cx + 4, cy - 6, 0.8);
      break;
    }
    case "fish": {
      g.fillStyle(deep, 1);
      g.fillTriangle(cx + 10, cy, cx + 18, cy - 7, cx + 18, cy + 7);
      g.fillStyle(dark, 1);
      g.fillTriangle(cx + 10, cy, cx + 16, cy - 5, cx + 16, cy + 5);
      g.fillStyle(dark, 1);
      g.fillEllipse(cx + 1, cy, 22, 14);
      g.fillStyle(base, 1);
      g.fillEllipse(cx + 1, cy - 1, 20, 11);
      g.fillStyle(light, 1);
      g.fillEllipse(cx + 1, cy + 3, 16, 5);
      g.fillStyle(deep, 1);
      g.fillTriangle(cx - 3, cy - 6, cx + 3, cy - 11, cx + 5, cy - 5);
      g.fillStyle(deep, 1);
      g.fillTriangle(cx - 1, cy + 3, cx + 4, cy + 7, cx + 6, cy + 3);
      g.fillStyle(deep, 1);
      g.fillRect(cx - 3, cy - 2, 1, 5);
      g.fillStyle(0x000000, 1);
      g.fillRect(cx - 10, cy + 1, 5, 2);
      g.fillStyle(0xffffff, 1);
      for (let i = 0; i < 3; i++) {
        g.fillTriangle(cx - 10 + i * 2, cy + 1, cx - 9 + i * 2, cy + 3, cx - 8 + i * 2, cy + 1);
      }
      g.fillStyle(0xffffff, 1);
      g.fillCircle(cx - 5, cy - 2, 2);
      g.fillStyle(0xff1744, 1);
      g.fillCircle(cx - 5, cy - 2, 1.2);
      g.fillStyle(0x000000, 1);
      g.fillCircle(cx - 5, cy - 2, 0.6);
      break;
    }
    case "eel": {
      g.fillStyle(deep, 1);
      g.fillEllipse(cx - 8, cy + 1, 12, 9);
      g.fillEllipse(cx + 3, cy - 2, 14, 9);
      g.fillEllipse(cx + 13, cy + 2, 10, 7);
      g.fillStyle(dark, 1);
      g.fillEllipse(cx - 8, cy, 10, 7);
      g.fillEllipse(cx + 3, cy - 3, 12, 7);
      g.fillEllipse(cx + 13, cy + 1, 8, 5);
      g.fillStyle(base, 1);
      g.fillEllipse(cx - 8, cy - 1, 8, 4);
      g.fillEllipse(cx + 3, cy - 4, 10, 4);
      g.fillEllipse(cx + 13, cy, 6, 3);
      g.fillStyle(0xfff59d, 1);
      g.fillRect(cx - 12, cy - 2, 4, 1);
      g.fillRect(cx - 6, cy - 1, 3, 1);
      g.fillRect(cx, cy - 4, 4, 1);
      g.fillRect(cx + 8, cy - 2, 3, 1);
      g.fillRect(cx + 14, cy, 2, 1);
      g.fillStyle(0xfff59d, 0.9);
      g.fillRect(cx + 17, cy - 6, 1, 1);
      g.fillRect(cx + 19, cy - 4, 1, 1);
      g.fillRect(cx - 14, cy + 4, 1, 1);
      g.fillRect(cx - 11, cy + 7, 1, 1);
      g.fillStyle(0xffffff, 1);
      g.fillRect(cx + 18, cy - 5, 1, 1);
      g.fillStyle(0x000000, 1);
      g.fillRect(cx - 16, cy - 1, 2, 1);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(cx - 16, cy, cx - 15, cy + 2, cx - 14, cy);
      g.fillStyle(0xfff59d, 1);
      g.fillCircle(cx - 11, cy - 2, 1.2);
      g.fillStyle(0x000000, 1);
      g.fillCircle(cx - 11, cy - 2, 0.6);
      break;
    }
  }
}

function makeMonster(scene: Phaser.Scene, type: MonsterType, def: MonsterDef) {
  const W = 48;
  const H = 48;
  const cx = W / 2;
  const cy = H - def.radius - 8;
  tex(scene, `monster-${type}`, W, H, (g) => {
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(cx, H - 4, def.radius * 2.2, 5);
    drawMonster(g, type, def, cx, cy);
  });
}

function makeSign(scene: Phaser.Scene) {
  tex(scene, "deco-sign", 18, 22, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(9, 20, 12, 3);
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(8, 8, 2, 12);
    g.fillStyle(0x8a5a30, 1);
    g.fillRect(2, 2, 14, 8);
    g.fillStyle(0x4a2e15, 1);
    g.fillRect(2, 2, 14, 1);
    g.fillRect(2, 9, 14, 1);
  });
}

/* ────────────────────────────────────────────────────────────────── */
/* Loot                                                               */
/* ────────────────────────────────────────────────────────────────── */

function makeGoldPile(scene: Phaser.Scene) {
  tex(scene, "loot-gold", 24, 18, (g) => {
    g.fillStyle(0x000000, 0.45);
    g.fillEllipse(12, 16, 18, 4);
    // small coin pile
    g.fillStyle(0xb8860b, 1);
    g.fillEllipse(12, 12, 16, 6);
    g.fillStyle(0xf6c244, 1);
    g.fillEllipse(8, 9, 8, 4);
    g.fillEllipse(15, 9, 8, 4);
    g.fillEllipse(12, 7, 8, 4);
    g.fillStyle(0xfff7a8, 1);
    g.fillEllipse(8, 8, 5, 2);
    g.fillEllipse(12, 6, 5, 2);
    g.fillStyle(0x6b4a0c, 1);
    g.fillRect(7, 8, 1, 1);
    g.fillRect(14, 8, 1, 1);
    g.fillRect(11, 6, 1, 1);
  });
}

function makePotion(scene: Phaser.Scene) {
  tex(scene, "loot-potion", 16, 22, (g) => {
    g.fillStyle(0x000000, 0.45);
    g.fillEllipse(8, 20, 12, 3);
    // bottle body (red potion)
    g.fillStyle(0x4a1010, 1);
    g.fillRect(3, 9, 10, 11);
    g.fillStyle(0xc0392b, 1);
    g.fillRect(4, 10, 8, 9);
    g.fillStyle(0xe74c3c, 1);
    g.fillRect(4, 10, 8, 4);
    g.fillStyle(0xff8b7a, 1);
    g.fillRect(5, 11, 2, 2);
    // neck
    g.fillStyle(0x3a3a3a, 1);
    g.fillRect(6, 5, 4, 4);
    // cork
    g.fillStyle(0xa0633a, 1);
    g.fillRect(5, 3, 6, 2);
    g.fillStyle(0x6b3e22, 1);
    g.fillRect(5, 5, 6, 1);
    // shine
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(5, 11, 1, 5);
  });

  // Waypoint — glowing rune circle on the ground.
  tex(scene, "waypoint", 36, 32, (g) => {
    g.fillStyle(0x000000, 0.5);
    g.fillEllipse(18, 30, 28, 5);
    // Stone slab base
    g.fillStyle(0x37474f, 1);
    g.fillEllipse(18, 24, 28, 8);
    g.fillStyle(0x546e7a, 1);
    g.fillEllipse(18, 22, 26, 7);
    g.fillStyle(0x78909c, 1);
    g.fillEllipse(18, 21, 22, 5);
    // Glowing rune circle
    g.lineStyle(2, 0x84ffff, 0.9);
    g.strokeCircle(18, 20, 8);
    g.lineStyle(1, 0x4dd0e1, 0.7);
    g.strokeCircle(18, 20, 6);
    // Inner sigil — diamond
    g.fillStyle(0x84ffff, 0.95);
    g.fillTriangle(18, 14, 22, 20, 18, 26);
    g.fillTriangle(18, 14, 14, 20, 18, 26);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(18, 20, 2);
    // Soft glow
    g.fillStyle(0x4dd0e1, 0.15);
    g.fillCircle(18, 20, 14);
  });

  // Shrine — pixel-art stone altar. Tinted by kind at render time.
  tex(scene, "shrine", 28, 36, (g) => {
    // Shadow
    g.fillStyle(0x000000, 0.45);
    g.fillEllipse(14, 33, 22, 4);
    // Base
    g.fillStyle(0x3a3a3a, 1);
    g.fillRect(2, 26, 24, 6);
    g.fillStyle(0x555555, 1);
    g.fillRect(3, 26, 22, 5);
    g.fillStyle(0x707070, 1);
    g.fillRect(3, 26, 22, 1);
    // Pillar
    g.fillStyle(0x3a3a3a, 1);
    g.fillRect(8, 8, 12, 18);
    g.fillStyle(0x6a6a6a, 1);
    g.fillRect(9, 9, 10, 16);
    g.fillStyle(0x808080, 1);
    g.fillRect(9, 9, 10, 2);
    // Crystal / flame socket on top — solid white so we can tint outside
    g.fillStyle(0xffffff, 1);
    g.fillCircle(14, 6, 4);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(14, 6, 6);
    // Engraving
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(11, 14, 6, 1);
    g.fillRect(12, 18, 4, 1);
  });

  // Treasure chest — pixel-art wooden chest with brass trim.
  tex(scene, "loot-chest", 28, 24, (g) => {
    g.fillStyle(0x000000, 0.5);
    g.fillEllipse(14, 22, 22, 4);
    // Body
    g.fillStyle(0x3e2723, 1);
    g.fillRect(2, 10, 24, 12);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(3, 11, 22, 10);
    g.fillStyle(0x6d4c41, 1);
    g.fillRect(3, 11, 22, 3);
    // Lid (rounded top via stepped bars)
    g.fillStyle(0x3e2723, 1);
    g.fillRect(2, 4, 24, 7);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(3, 5, 22, 5);
    g.fillStyle(0x795548, 1);
    g.fillRect(4, 5, 20, 2);
    // Brass bands
    g.fillStyle(0xfdd835, 1);
    g.fillRect(2, 9, 24, 2);
    g.fillRect(2, 16, 24, 1);
    // Brass corners
    g.fillStyle(0xffeb3b, 1);
    g.fillRect(2, 4, 2, 2);
    g.fillRect(24, 4, 2, 2);
    g.fillRect(2, 19, 2, 2);
    g.fillRect(24, 19, 2, 2);
    // Lock
    g.fillStyle(0xfdd835, 1);
    g.fillRect(12, 9, 4, 5);
    g.fillStyle(0x4e2c0f, 1);
    g.fillRect(13, 11, 2, 2);
    // Highlight on lid
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(4, 5, 8, 1);
    // Faint golden glow
    g.fillStyle(0xfde047, 0.18);
    g.fillCircle(14, 13, 14);
  });

  // Generic item drop — small white gem that gets tinted by rarity.
  tex(scene, "loot-item", 18, 20, (g) => {
    g.fillStyle(0x000000, 0.45);
    g.fillEllipse(9, 18, 12, 3);
    // Outer crystal facets
    g.fillStyle(0xb8c5d0, 1);
    g.fillTriangle(9, 2, 2, 11, 9, 18);
    g.fillTriangle(9, 2, 16, 11, 9, 18);
    g.fillStyle(0xe2e8f0, 1);
    g.fillTriangle(9, 2, 5, 11, 9, 14);
    g.fillTriangle(9, 2, 13, 11, 9, 14);
    // Highlight
    g.fillStyle(0xffffff, 0.85);
    g.fillTriangle(9, 4, 7, 9, 9, 11);
    // Soft glow
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(9, 11, 8);
  });
}

function makeFirebolt(scene: Phaser.Scene) {
  // Small flaming bolt sprite (used as a one-shot FX along a path)
  tex(scene, "fx-firebolt", 16, 16, (g) => {
    // Outer glow
    g.fillStyle(0xff7043, 0.4);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xff8a50, 0.7);
    g.fillCircle(8, 8, 6);
    // Core
    g.fillStyle(0xffd54f, 1);
    g.fillCircle(8, 8, 4);
    g.fillStyle(0xfff59d, 1);
    g.fillCircle(7, 7, 2);
  });
}

function makeVignette(scene: Phaser.Scene) {
  // Subtle radial darkening at the corners only — center stays clear.
  const W = 1024;
  const H = 1024;
  const cx = W / 2;
  const cy = H / 2;
  const inner = 380; // wide clear center
  const outer = 560;
  tex(scene, "vignette", W, H, (g) => {
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = outer - (outer - inner) * (1 - t);
      const a = Math.pow(t, 1.4) * 0.35; // gentle, max ~35%
      g.fillStyle(0x000000, a);
      g.fillCircle(cx, cy, r);
    }
    // Hard black past the outer band (covers anything off the edge)
    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, 0, W, cy - outer);
    g.fillRect(0, cy + outer, W, H - (cy + outer));
    g.fillRect(0, 0, cx - outer, H);
    g.fillRect(cx + outer, 0, W - (cx + outer), H);
  });
}

/* ────────────────────────────────────────────────────────────────── */
/* Scene                                                              */
/* ────────────────────────────────────────────────────────────────── */

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    makePlayer(this, "player-self", 0x6ee7b7, 0x065f46);
    makePlayer(this, "player-other", 0xfca5a5, 0x7f1d1d);
    makeTree(this);
    makePine(this);
    makeRock(this);
    makeRockSmall(this);
    makeCactus(this);
    makeLilypad(this);
    makeFountain(this);
    makeWell(this);
    makeHouse(this);
    makeInn(this);
    makeShop(this);
    makeSmithy(this);
    makeFenceH(this);
    makeFenceV(this);
    makeFencePost(this);
    makeCrop(this);
    makeSign(this);
    makePortal(this);
    makeGoldPile(this);
    makePotion(this);
    makeFirebolt(this);
    makeVignette(this);

    for (const [type, def] of Object.entries(MONSTER_DEFS)) {
      makeMonster(this, type as MonsterType, def);
    }

    this.scene.start("menu");
  }
}
