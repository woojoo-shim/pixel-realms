/**
 * Multi-map system for Pixel Realms.
 *
 *  - "town" is the central village (smaller than before).
 *  - Each gate path ends at a portal that teleports to a biome map:
 *      N gate → forest
 *      E gate → desert
 *      S gate → mountain
 *      W gate → lake
 *  - Each biome map has a single return portal at its south edge.
 *
 *  All tile/decoration/obstacle/portal coords are local to the map
 *  (each map's origin is (0, 0)). Players carry a `mapId` and their
 *  (x, y) are interpreted relative to that map.
 */

export type TileType =
  | "grass"
  | "sand"
  | "water"
  | "stone"
  | "path"
  | "plaza"
  | "farmland";

export const TILE_COLORS: Record<TileType, { base: number; accent: number }> = {
  grass: { base: 0x2a3a26, accent: 0x344a2e },
  sand: { base: 0xc9a96a, accent: 0xb89858 },
  water: { base: 0x2c5f8d, accent: 0x356a99 },
  stone: { base: 0x4a4a52, accent: 0x5a5a62 },
  path: { base: 0x8a7548, accent: 0x9b8454 },
  plaza: { base: 0xa89878, accent: 0xb8a888 },
  farmland: { base: 0x6b4a26, accent: 0x7a5530 },
};

export type DecorationType =
  | "tree"
  | "pine"
  | "rock"
  | "rock-small"
  | "cactus"
  | "house"
  | "inn"
  | "shop"
  | "smithy"
  | "fountain"
  | "lilypad"
  | "fence-h"
  | "fence-v"
  | "fence-post"
  | "crop"
  | "well"
  | "sign"
  | "portal";

export interface Decoration {
  type: DecorationType;
  x: number;
  y: number;
}

export interface Aabb {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAP_IDS = ["town", "forest", "desert", "mountain", "lake"] as const;
export type MapId = (typeof MAP_IDS)[number];

export const MAP_LABELS: Record<MapId, string> = {
  town: "Town",
  forest: "Forest",
  desert: "Desert",
  mountain: "Mountain",
  lake: "Lake",
};

export interface Portal {
  /** Trigger AABB (player overlapping it teleports). Map-local coords. */
  aabb: Aabb;
  toMap: MapId;
  toX: number;
  toY: number;
  label: string;
}

export interface MapData {
  id: MapId;
  tiles: (TileType | null)[][];
  cols: number;
  rows: number;
  tileSize: number;
  decorations: Decoration[];
  obstacles: Aabb[];
  portals: Portal[];
  /** Initial spawn / death respawn point. Currently only town uses this. */
  spawn: { x: number; y: number };
  /** Where the player lands when entering from the south side. */
  southArrival?: { x: number; y: number };
  /** Where the player lands when entering from the north side. */
  northArrival?: { x: number; y: number };
}

/** Linear progression chain (Diablo-style). One story, one road. */
export const MAP_CHAIN: MapId[] = ["town", "forest", "desert", "mountain", "lake"];

/* ────────────────────────────────────────────────────────────────── */
/* RNG                                                                */
/* ────────────────────────────────────────────────────────────────── */

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number) {
    return min + this.next() * (max - min);
  }
  intRange(min: number, max: number) {
    return Math.floor(this.range(min, max + 1));
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* Town (smaller than before)                                         */
/* ────────────────────────────────────────────────────────────────── */

function generateTown(
  worldWidth: number,
  worldHeight: number,
  tileSize: number,
  seed = 1337
): MapData {
  const cols = Math.floor(worldWidth / tileSize);
  const rows = Math.floor(worldHeight / tileSize);
  const cx = cols / 2;
  const cy = rows / 2;
  const rng = new Rng(seed);

  /* Smaller, cleaner island: 29x29 tiles ≈ 928 px */
  const islandHalfTiles = 14;
  const islandMinX = Math.floor(cx) - islandHalfTiles;
  const islandMaxX = Math.floor(cx) + islandHalfTiles;
  const islandMinY = Math.floor(cy) - islandHalfTiles;
  const islandMaxY = Math.floor(cy) + islandHalfTiles;

  const tiles: (TileType | null)[][] = Array.from({ length: rows }, () =>
    Array<TileType | null>(cols).fill(null)
  );

  // Pure grass island — no biome ring, no noise
  for (let y = islandMinY; y <= islandMaxY; y++) {
    for (let x = islandMinX; x <= islandMaxX; x++) {
      tiles[y][x] = "grass";
    }
  }

  /* Stone paths radiating from the central plaza: north exit + side
   * branches to each building so the town feels walkable. */
  const pathHalf = 1;
  const ix = Math.floor(cx);
  const iy = Math.floor(cy);
  // North arm — leads to the only gate
  for (let y = islandMinY; y <= iy; y++) {
    for (let w = -pathHalf; w <= pathHalf; w++) {
      const px = ix + w;
      if (px >= 0 && px < cols && tiles[y][px]) tiles[y][px] = "path";
    }
  }
  // East arm — to the shop (lies at +7 tiles east, y ≈ cy)
  for (let x = ix; x <= ix + 6; x++) {
    for (let w = -pathHalf; w <= pathHalf; w++) {
      const py = iy + w;
      if (tiles[py]?.[x]) tiles[py][x] = "path";
    }
  }
  // West arm — to the smithy
  for (let x = ix - 6; x <= ix; x++) {
    for (let w = -pathHalf; w <= pathHalf; w++) {
      const py = iy + w;
      if (tiles[py]?.[x]) tiles[py][x] = "path";
    }
  }
  // South arm — to the well between the two south houses
  for (let y = iy; y <= iy + 7; y++) {
    for (let w = -pathHalf; w <= pathHalf; w++) {
      const px = ix + w;
      if (tiles[y]?.[px]) tiles[y][px] = "path";
    }
  }
  // Short branches off the south arm to each south house (±5 tiles east/west)
  for (let x = ix - 5; x <= ix - 1; x++) {
    const py = iy + 6;
    if (tiles[py]?.[x]) tiles[py][x] = "path";
  }
  for (let x = ix + 1; x <= ix + 5; x++) {
    const py = iy + 6;
    if (tiles[py]?.[x]) tiles[py][x] = "path";
  }

  /* Small central plaza */
  const plazaHalf = 2;
  for (let y = Math.floor(cy) - plazaHalf; y <= Math.floor(cy) + plazaHalf; y++) {
    for (let x = Math.floor(cx) - plazaHalf; x <= Math.floor(cx) + plazaHalf; x++) {
      if (tiles[y]?.[x]) tiles[y][x] = "plaza";
    }
  }

  const deco: Decoration[] = [];
  const obstacles: Aabb[] = [];

  /* Helper: push a building with its sign in front */
  const addBuilding = (
    type: DecorationType,
    txOff: number,
    tyOff: number,
    w: number,
    h: number,
    signOff: { dx: number; dy: number } | null
  ) => {
    const wx = (cx + txOff) * tileSize;
    const wy = (cy + tyOff) * tileSize;
    deco.push({ type, x: wx, y: wy });
    obstacles.push({ x: wx - w / 2, y: wy - h, w, h });
    if (signOff) {
      deco.push({ type: "sign", x: wx + signOff.dx, y: wy + signOff.dy });
      obstacles.push({
        x: wx + signOff.dx - 6,
        y: wy + signOff.dy - 12,
        w: 12,
        h: 12,
      });
    }
  };

  /* Central fountain */
  deco.push({ type: "fountain", x: cx * tileSize, y: cy * tileSize });
  obstacles.push({
    x: cx * tileSize - 20,
    y: cy * tileSize - 20,
    w: 40,
    h: 40,
  });

  /*
   * Classic RPG village layout (ALttP Kakariko / Pokemon Pallet vibes):
   *
   *                     [INN] (north of plaza, biggest)
   *    [SMITHY] ────────── ● ────────── [SHOP]
   *      (west)         fountain         (east)
   *                     [WELL]
   *                  [HOUSE] [HOUSE]    (south)
   */
  // Inn — north of plaza
  addBuilding("inn", 0, -7, 80, 56, { dx: -30, dy: 14 });
  // Shop — east
  addBuilding("shop", 7, -1, 64, 56, { dx: -26, dy: 14 });
  // Smithy — west
  addBuilding("smithy", -7, -1, 64, 56, { dx: 22, dy: 14 });
  // Two houses — south
  addBuilding("house", -5, 7, 56, 48, null);
  addBuilding("house", 5, 7, 56, 48, null);

  /* Well between the two south houses */
  const wellX = cx * tileSize;
  const wellY = (cy + 7) * tileSize;
  deco.push({ type: "well", x: wellX, y: wellY });
  obstacles.push({ x: wellX - 12, y: wellY - 22, w: 24, h: 22 });

  /* Fence — only ONE gate at the north (Diablo-style single exit). */
  const gateHalf = 2;
  // Top row: gap around cx for the gate
  for (let tx = islandMinX; tx <= islandMaxX; tx++) {
    if (Math.abs(tx - Math.floor(cx)) <= gateHalf) continue;
    const wx = tx * tileSize + tileSize / 2;
    const wy = islandMinY * tileSize + tileSize / 2;
    deco.push({ type: "fence-h", x: wx, y: wy });
    obstacles.push({ x: wx - 16, y: wy - 8, w: 32, h: 10 });
  }
  // Bottom row: solid (no gate)
  for (let tx = islandMinX; tx <= islandMaxX; tx++) {
    const wx = tx * tileSize + tileSize / 2;
    const wy = islandMaxY * tileSize + tileSize / 2;
    deco.push({ type: "fence-h", x: wx, y: wy });
    obstacles.push({ x: wx - 16, y: wy - 8, w: 32, h: 10 });
  }
  // Left + right columns: solid
  for (let ty = islandMinY; ty <= islandMaxY; ty++) {
    for (const tx of [islandMinX, islandMaxX]) {
      const wx = tx * tileSize + tileSize / 2;
      const wy = ty * tileSize + tileSize / 2;
      deco.push({ type: "fence-v", x: wx, y: wy });
      obstacles.push({ x: wx - 6, y: wy - 16, w: 10, h: 32 });
    }
  }
  for (const [tx, ty] of [
    [islandMinX, islandMinY],
    [islandMaxX, islandMinY],
    [islandMinX, islandMaxY],
    [islandMaxX, islandMaxY],
  ] as [number, number][]) {
    const wx = tx * tileSize + tileSize / 2;
    const wy = ty * tileSize + tileSize / 2;
    deco.push({ type: "fence-post", x: wx, y: wy });
    obstacles.push({ x: wx - 8, y: wy - 16, w: 16, h: 16 });
  }

  /*
   * Trees as a windbreak just inside the fence, skipping near gates and
   * skipping anywhere a building / obstacle already lives.
   */
  const isFreeForTree = (tx: number, ty: number) => {
    if (tiles[ty]?.[tx] !== "grass") return false;
    const wx = (tx + 0.5) * tileSize;
    const wy = (ty + 0.5) * tileSize;
    const probe: Aabb = { x: wx - 8, y: wy - 8, w: 16, h: 16 };
    for (const o of obstacles) {
      if (
        probe.x < o.x + o.w &&
        probe.x + probe.w > o.x &&
        probe.y < o.y + o.h &&
        probe.y + probe.h > o.y
      )
        return false;
    }
    return true;
  };
  const placeTree = (tx: number, ty: number) => {
    if (!isFreeForTree(tx, ty)) return;
    const wx = (tx + rng.range(0.35, 0.65)) * tileSize;
    const wy = (ty + rng.range(0.35, 0.65)) * tileSize;
    deco.push({ type: "tree", x: wx, y: wy });
    obstacles.push({ x: wx - 6, y: wy - 6, w: 12, h: 6 });
  };
  // Top row: skip near the north gate (it's our only exit path)
  for (let tx = islandMinX + 2; tx <= islandMaxX - 2; tx++) {
    if (Math.abs(tx - Math.floor(cx)) <= gateHalf + 1) continue;
    if (rng.next() < 0.7) placeTree(tx, islandMinY + 2);
  }
  // Bottom + sides: walls are solid → trees can fill entire inner row
  for (let tx = islandMinX + 2; tx <= islandMaxX - 2; tx++) {
    if (rng.next() < 0.7) placeTree(tx, islandMaxY - 2);
  }
  for (let ty = islandMinY + 2; ty <= islandMaxY - 2; ty++) {
    if (rng.next() < 0.7) placeTree(islandMinX + 2, ty);
    if (rng.next() < 0.7) placeTree(islandMaxX - 2, ty);
  }

  /* Single portal at the north gate — the only way out of town. */
  const portals: Portal[] = [];
  const portalTile = 2;
  portals.push(
    makePortal(
      (Math.floor(cx) - 1) * tileSize,
      islandMinY * tileSize,
      portalTile * tileSize,
      portalTile * tileSize,
      "forest",
      "→ Forest"
    )
  );
  deco.push({
    type: "portal",
    x: Math.floor(cx) * tileSize,
    y: (islandMinY + 1) * tileSize,
  });

  const spawn = {
    x: cx * tileSize,
    y: (cy + plazaHalf + 1) * tileSize,
  };
  // Where players land coming back from the forest (just inside N gate).
  const northArrival = {
    x: cx * tileSize,
    y: (islandMinY + 3) * tileSize,
  };

  deco.sort((a, b) => a.y - b.y);

  return {
    id: "town",
    tiles,
    cols,
    rows,
    tileSize,
    decorations: deco,
    obstacles,
    portals,
    spawn,
    northArrival,
  };
}

function makePortal(
  x: number,
  y: number,
  w: number,
  h: number,
  toMap: MapId,
  label: string
): Portal {
  return {
    aabb: { x, y, w, h },
    toMap,
    toX: 0, // patched later
    toY: 0,
    label,
  };
}

/* ────────────────────────────────────────────────────────────────── */
/* Biome maps (forest / desert / mountain / lake)                     */
/* ────────────────────────────────────────────────────────────────── */

/**
 * Each biome's path follows its own curve.
 * `t` is normalized 0..1 from south (entry) to north (exit).
 * Endpoints must return 0 so the path lines up with the arrival points.
 */
const BIOME_PATH_CURVE: Record<Exclude<MapId, "town">, (t: number) => number> =
  {
    // Forest: gentle single S
    forest: (t) => Math.sin(t * Math.PI * 2) * 4,
    // Desert: serpentine (longer winds)
    desert: (t) => Math.sin(t * Math.PI * 3) * 5,
    // Mountain: kinked switchback feel
    mountain: (t) =>
      Math.sin(t * Math.PI * 2) * 3 + Math.sin(t * Math.PI * 4) * 2,
    // Lake: gentle sway across the lily pads
    lake: (t) => Math.sin(t * Math.PI * 2) * 3,
  };

interface BiomeOpts {
  id: MapId;
  baseTile: TileType;
  decorations: Array<{
    type: DecorationType;
    density: number;
    collision?: { w: number; h: number };
  }>;
  /** Previous map in the chain — south portal returns there. */
  prevMap: MapId;
  /** Next map in the chain — north portal advances there. null on the final map. */
  nextMap: MapId | null;
}

const BIOME_CONFIG: Record<Exclude<MapId, "town">, BiomeOpts> = {
  forest: {
    id: "forest",
    baseTile: "grass",
    decorations: [
      { type: "tree", density: 0.18, collision: { w: 12, h: 6 } },
      { type: "pine", density: 0.06, collision: { w: 10, h: 6 } },
      { type: "rock-small", density: 0.02, collision: { w: 8, h: 4 } },
    ],
    prevMap: "town",
    nextMap: "desert",
  },
  desert: {
    id: "desert",
    baseTile: "sand",
    decorations: [
      { type: "cactus", density: 0.06, collision: { w: 10, h: 6 } },
      { type: "rock-small", density: 0.03, collision: { w: 8, h: 4 } },
      { type: "rock", density: 0.01, collision: { w: 16, h: 8 } },
    ],
    prevMap: "forest",
    nextMap: "mountain",
  },
  mountain: {
    id: "mountain",
    baseTile: "stone",
    decorations: [
      { type: "rock", density: 0.08, collision: { w: 16, h: 8 } },
      { type: "rock-small", density: 0.06, collision: { w: 8, h: 4 } },
      { type: "pine", density: 0.03, collision: { w: 10, h: 6 } },
    ],
    prevMap: "desert",
    nextMap: "lake",
  },
  lake: {
    id: "lake",
    baseTile: "water",
    decorations: [{ type: "lilypad", density: 0.08 }],
    prevMap: "mountain",
    nextMap: null, // final zone
  },
};

function generateBiome(
  opts: BiomeOpts,
  worldWidth: number,
  worldHeight: number,
  tileSize: number,
  seed: number
): MapData {
  const cols = Math.floor(worldWidth / tileSize);
  const rows = Math.floor(worldHeight / tileSize);
  const cx = cols / 2;
  const cy = rows / 2;
  const rng = new Rng(seed);

  const halfTiles = 24; // 49x49 tile biome map ≈ 1568 px (about 4x area)
  const minX = Math.floor(cx) - halfTiles;
  const maxX = Math.floor(cx) + halfTiles;
  const minY = Math.floor(cy) - halfTiles;
  const maxY = Math.floor(cy) + halfTiles;

  const tiles: (TileType | null)[][] = Array.from({ length: rows }, () =>
    Array<TileType | null>(cols).fill(null)
  );
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      tiles[y][x] = opts.baseTile;
    }
  }

  /* Sprinkle small contrast patches inside the biome for visual variety. */
  const patchTile: TileType | null = (() => {
    switch (opts.id) {
      case "forest":
        return "farmland"; // small dirt clearings
      case "desert":
        return "stone"; // rocky outcrops in the sand
      case "mountain":
        return "grass"; // tufts of grass between rocks
      default:
        return null;
    }
  })();
  if (patchTile) {
    const patchCount = 6 + Math.floor(rng.next() * 4);
    for (let i = 0; i < patchCount; i++) {
      const px = rng.intRange(minX + 3, maxX - 3);
      const py = rng.intRange(minY + 3, maxY - 3);
      const r = 1 + rng.next() * 2.4;
      for (let y = py - 3; y <= py + 3; y++) {
        for (let x = px - 3; x <= px + 3; x++) {
          if (
            Math.hypot(x - px, y - py) < r &&
            tiles[y]?.[x] === opts.baseTile
          ) {
            tiles[y][x] = patchTile;
          }
        }
      }
    }
  }

  /* For lake biome, add some grass "islands" you can walk on */
  if (opts.id === "lake") {
    const islandSpots = [
      [cx, cy],
      [cx - 5, cy - 4],
      [cx + 5, cy + 3],
      [cx + 4, cy - 5],
      [cx - 5, cy + 5],
    ];
    for (const [ix, iy] of islandSpots) {
      const r = 2 + rng.next() * 1.5;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (Math.hypot(x - ix, y - iy) < r) tiles[y][x] = "sand";
        }
      }
    }
  }

  /*
   * Winding path running through the biome from south to north.
   * Each biome has its own curve signature. Endpoints always sit at cx
   * so they line up perfectly with the south/north arrival portals.
   */
  const pathHalf = 2;
  const curve = BIOME_PATH_CURVE[opts.id];
  for (let i = minY; i <= maxY; i++) {
    const t = (i - minY) / Math.max(1, maxY - minY); // 0..1
    const offset = curve(t);
    const center = Math.floor(cx + offset);
    for (let w = -pathHalf; w <= pathHalf; w++) {
      const px = center + w;
      if (tiles[i]?.[px]) tiles[i][px] = "path";
    }
  }

  /*
   * Side branches off the main winding path. Each branch is a short spur
   * heading perpendicular into the biome with a small clearing at the end —
   * a hint at where a mob pack or a treasure might be lurking.
   */
  const NUM_BRANCHES = 6;
  for (let b = 0; b < NUM_BRANCHES; b++) {
    const branchY = rng.intRange(minY + 4, maxY - 4);
    const tAlong = (branchY - minY) / Math.max(1, maxY - minY);
    const startX = Math.floor(cx + curve(tAlong));
    const sideSign = rng.next() < 0.5 ? -1 : 1;
    const len = rng.intRange(4, 8);
    let curY = branchY;
    let endX = startX;
    for (let step = 1; step <= len; step++) {
      endX = startX + step * sideSign;
      // Gentle wobble in y so the spur curves a little
      if (rng.next() < 0.3) curY += rng.next() < 0.5 ? -1 : 1;
      for (let w = -1; w <= 1; w++) {
        const py = curY + w;
        if (tiles[py]?.[endX]) tiles[py][endX] = "path";
      }
    }
    // Small clearing at the spur's end — a natural pack spawn / loot spot
    for (let y = curY - 1; y <= curY + 1; y++) {
      for (let x = endX - 1; x <= endX + 1; x++) {
        if (tiles[y]?.[x]) tiles[y][x] = "path";
      }
    }
  }

  const deco: Decoration[] = [];
  const obstacles: Aabb[] = [];

  /* Sprinkle decorations on non-path tiles */
  for (const d of opts.decorations) {
    const total = Math.floor((maxX - minX) * (maxY - minY) * d.density);
    for (let i = 0; i < total; i++) {
      const tx = rng.intRange(minX, maxX);
      const ty = rng.intRange(minY, maxY);
      const t = tiles[ty]?.[tx];
      // Skip path/plaza/null
      if (!t || t === "path" || t === "plaza") continue;
      // For lake, only place lilypads on water
      if (opts.id === "lake" && d.type === "lilypad" && t !== "water") continue;
      // For other biomes, skip water tiles
      if (opts.id !== "lake" && t === "water") continue;
      const wx = (tx + rng.range(0.2, 0.8)) * tileSize;
      const wy = (ty + rng.range(0.2, 0.8)) * tileSize;
      deco.push({ type: d.type, x: wx, y: wy });
      if (d.collision) {
        obstacles.push({
          x: wx - d.collision.w / 2,
          y: wy - d.collision.h,
          w: d.collision.w,
          h: d.collision.h,
        });
      }
    }
  }

  /* Portals: south = back to prev, north = forward to next (if any). */
  const portalTile = 2;
  const portals: Portal[] = [];

  // South portal (return to previous map)
  portals.push(
    makePortal(
      (Math.floor(cx) - 1) * tileSize,
      (maxY - 1) * tileSize,
      portalTile * tileSize,
      portalTile * tileSize,
      opts.prevMap,
      `→ ${MAP_LABELS[opts.prevMap]}`
    )
  );
  deco.push({
    type: "portal",
    x: Math.floor(cx) * tileSize,
    y: maxY * tileSize,
  });

  // North portal (advance to next map) — omitted on final zone
  if (opts.nextMap) {
    portals.push(
      makePortal(
        (Math.floor(cx) - 1) * tileSize,
        minY * tileSize,
        portalTile * tileSize,
        portalTile * tileSize,
        opts.nextMap,
        `→ ${MAP_LABELS[opts.nextMap]}`
      )
    );
    deco.push({
      type: "portal",
      x: Math.floor(cx) * tileSize,
      y: (minY + 1) * tileSize,
    });
  }

  // Arrival points — use the path's actual entry/exit x so the player
  // doesn't land on a tree or off-path.
  const southArrival = {
    x: (cx + curve(1)) * tileSize,
    y: (maxY - 3) * tileSize,
  };
  const northArrival = {
    x: (cx + curve(0)) * tileSize,
    y: (minY + 3) * tileSize,
  };

  deco.sort((a, b) => a.y - b.y);

  return {
    id: opts.id,
    tiles,
    cols,
    rows,
    tileSize,
    decorations: deco,
    obstacles,
    portals,
    spawn: { x: cx * tileSize, y: cy * tileSize },
    southArrival,
    northArrival,
  };
}

/* ────────────────────────────────────────────────────────────────── */
/* Public                                                             */
/* ────────────────────────────────────────────────────────────────── */

export function generateAllMaps(
  worldWidth: number,
  worldHeight: number,
  tileSize: number
): Record<MapId, MapData> {
  const town = generateTown(worldWidth, worldHeight, tileSize);
  const forest = generateBiome(BIOME_CONFIG.forest, worldWidth, worldHeight, tileSize, 2001);
  const desert = generateBiome(BIOME_CONFIG.desert, worldWidth, worldHeight, tileSize, 2002);
  const mountain = generateBiome(BIOME_CONFIG.mountain, worldWidth, worldHeight, tileSize, 2003);
  const lake = generateBiome(BIOME_CONFIG.lake, worldWidth, worldHeight, tileSize, 2004);

  /*
   * Patch portal destinations along the linear chain.
   * Going forward (higher index) → land at target's southArrival.
   * Going backward (lower index) → land at target's northArrival.
   */
  const byId: Record<MapId, MapData> = { town, forest, desert, mountain, lake };
  const idx = (id: MapId) => MAP_CHAIN.indexOf(id);
  for (const map of Object.values(byId)) {
    for (const p of map.portals) {
      const target = byId[p.toMap];
      const goingForward = idx(p.toMap) > idx(map.id);
      const arrival = goingForward ? target.southArrival : target.northArrival;
      if (arrival) {
        p.toX = arrival.x;
        p.toY = arrival.y;
      } else {
        // Fallback: spawn (shouldn't happen with the current chain).
        p.toX = target.spawn.x;
        p.toY = target.spawn.y;
      }
    }
  }

  return { town, forest, desert, mountain, lake };
}

/* ────────────────────────────────────────────────────────────────── */
/* Collision                                                          */
/* ────────────────────────────────────────────────────────────────── */

export class ObstacleGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private cells: Aabb[][];

  constructor(map: MapData, cellSize = 128) {
    this.cellSize = cellSize;
    this.cols = Math.ceil((map.cols * map.tileSize) / cellSize);
    this.rows = Math.ceil((map.rows * map.tileSize) / cellSize);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
    for (const o of map.obstacles) {
      const x0 = Math.max(0, Math.floor(o.x / cellSize));
      const x1 = Math.min(this.cols - 1, Math.floor((o.x + o.w) / cellSize));
      const y0 = Math.max(0, Math.floor(o.y / cellSize));
      const y1 = Math.min(this.rows - 1, Math.floor((o.y + o.h) / cellSize));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          this.cells[y * this.cols + x].push(o);
        }
      }
    }
  }

  query(aabb: Aabb, cb: (o: Aabb) => boolean | void) {
    const x0 = Math.max(0, Math.floor(aabb.x / this.cellSize));
    const x1 = Math.min(this.cols - 1, Math.floor((aabb.x + aabb.w) / this.cellSize));
    const y0 = Math.max(0, Math.floor(aabb.y / this.cellSize));
    const y1 = Math.min(this.rows - 1, Math.floor((aabb.y + aabb.h) / this.cellSize));
    const seen = new Set<Aabb>();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (const o of this.cells[y * this.cols + x]) {
          if (seen.has(o)) continue;
          seen.add(o);
          if (cb(o) === false) return;
        }
      }
    }
  }
}

export interface StandOptions {
  /** Tile types the entity is *not* allowed to stand on. Defaults to ['water']. */
  blockedTiles?: ReadonlyArray<TileType>;
  /** If true, null tiles (void outside the playable area) are allowed. */
  allowVoid?: boolean;
}

export function canStandAt(
  map: MapData,
  grid: ObstacleGrid,
  x: number,
  y: number,
  radius: number,
  opts?: StandOptions
): boolean {
  const TS = map.tileSize;
  if (x - radius < 0 || x + radius > map.cols * TS) return false;
  if (y - radius < 0 || y + radius > map.rows * TS) return false;

  const blocked = opts?.blockedTiles ?? ["water"];
  const allowVoid = opts?.allowVoid ?? false;

  const checkPoints: Array<[number, number]> = [
    [x, y],
    [x - radius, y],
    [x + radius, y],
    [x, y - radius],
    [x, y + radius],
  ];
  for (const [px, py] of checkPoints) {
    const t = map.tiles[Math.floor(py / TS)]?.[Math.floor(px / TS)];
    if (t === null || t === undefined) {
      if (!allowVoid) return false;
      continue;
    }
    if (blocked.includes(t)) return false;
  }

  const box: Aabb = { x: x - radius, y: y - radius, w: radius * 2, h: radius * 2 };
  let hit = false;
  grid.query(box, (o) => {
    if (
      box.x < o.x + o.w &&
      box.x + box.w > o.x &&
      box.y < o.y + o.h &&
      box.y + box.h > o.y
    ) {
      hit = true;
      return false;
    }
  });
  return !hit;
}

/** Returns the portal the player is currently standing on, or null. */
export function getPortalAt(
  map: MapData,
  x: number,
  y: number,
  radius: number
): Portal | null {
  for (const p of map.portals) {
    if (
      x + radius > p.aabb.x &&
      x - radius < p.aabb.x + p.aabb.w &&
      y + radius > p.aabb.y &&
      y - radius < p.aabb.y + p.aabb.h
    ) {
      return p;
    }
  }
  return null;
}
