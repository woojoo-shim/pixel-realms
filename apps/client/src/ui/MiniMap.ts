import type { MapData, TileType } from "@pr/shared";

export interface MiniEntities {
  selfX: number;
  selfY: number;
  others: { x: number; y: number }[];
  monsters: { x: number; y: number; champion?: boolean; boss?: boolean }[];
  loots: { x: number; y: number; kind: string; rarity?: string }[];
  shrines: { x: number; y: number; kind: string }[];
  waypoints: { x: number; y: number }[];
}

const TILE_COLOR: Partial<Record<TileType, string>> = {
  path: "#7a5a32",
  plaza: "#a08868",
  grass: "#3b5a2c",
  sand: "#c8a55c",
  water: "#1f4a78",
  stone: "#4a4a52",
  farmland: "#6b5a3a",
};

/** A small radar canvas in the top-right corner showing the current map. */
export class MiniMap {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** Cached background image for the current map tiles. */
  private mapBackground: HTMLCanvasElement | null = null;
  private currentMapId: string | null = null;
  /** World pixel bounds of the displayed map area. */
  private wx0 = 0;
  private wy0 = 0;
  private wW = 1;
  private wH = 1;
  /** Display size in CSS pixels. */
  private readonly size = 140;

  constructor() {
    const root = document.createElement("div");
    Object.assign(root.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      width: `${this.size}px`,
      height: `${this.size}px`,
      borderRadius: "8px",
      border: "2px solid rgba(180,120,60,0.9)",
      background: "rgba(0,0,0,0.7)",
      boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "22",
    });
    const canvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = this.size * dpr;
    canvas.height = this.size * dpr;
    canvas.style.width = `${this.size}px`;
    canvas.style.height = `${this.size}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("MiniMap: no canvas context");
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    root.appendChild(canvas);
    document.body.appendChild(root);
    this.root = root;
    this.canvas = canvas;
    this.ctx = ctx;
  }

  destroy() {
    this.root.remove();
  }

  /** Re-cache the tile background for the given map. */
  setMap(mapId: string, map: MapData) {
    if (this.currentMapId === mapId) return;
    this.currentMapId = mapId;

    // Determine actual non-null bounds so we don't pad with empty space
    let minX = map.cols,
      maxX = -1,
      minY = map.rows,
      maxY = -1;
    for (let y = 0; y < map.rows; y++) {
      const row = map.tiles[y];
      if (!row) continue;
      for (let x = 0; x < map.cols; x++) {
        if (row[x] != null) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return;

    // Add 1 tile padding
    minX = Math.max(0, minX - 1);
    minY = Math.max(0, minY - 1);
    maxX = Math.min(map.cols - 1, maxX + 1);
    maxY = Math.min(map.rows - 1, maxY + 1);

    const wTiles = maxX - minX + 1;
    const hTiles = maxY - minY + 1;
    this.wx0 = minX * map.tileSize;
    this.wy0 = minY * map.tileSize;
    this.wW = wTiles * map.tileSize;
    this.wH = hTiles * map.tileSize;

    // Render tiles to an offscreen canvas, then we draw it scaled
    const off = document.createElement("canvas");
    off.width = wTiles;
    off.height = hTiles;
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.fillStyle = "#0a0a0a";
    octx.fillRect(0, 0, wTiles, hTiles);
    for (let y = minY; y <= maxY; y++) {
      const row = map.tiles[y];
      if (!row) continue;
      for (let x = minX; x <= maxX; x++) {
        const t = row[x];
        if (t == null) continue;
        octx.fillStyle = TILE_COLOR[t] ?? "#222";
        octx.fillRect(x - minX, y - minY, 1, 1);
      }
    }
    this.mapBackground = off;
  }

  /** Convert a world coord to mini-map canvas coord. */
  private toMini(x: number, y: number): [number, number] {
    const mx = ((x - this.wx0) / this.wW) * this.size;
    const my = ((y - this.wy0) / this.wH) * this.size;
    return [mx, my];
  }

  draw(e: MiniEntities) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);
    if (this.mapBackground) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.mapBackground, 0, 0, this.size, this.size);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, this.size, this.size);
    }
    // Waypoints
    ctx.fillStyle = "#84ffff";
    for (const w of e.waypoints) {
      const [x, y] = this.toMini(w.x, w.y);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // Shrines
    for (const s of e.shrines) {
      const [x, y] = this.toMini(s.x, s.y);
      ctx.fillStyle = "#fde047";
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Loot
    for (const l of e.loots) {
      const [x, y] = this.toMini(l.x, l.y);
      ctx.fillStyle =
        l.kind === "chest"
          ? "#ffd54f"
          : l.kind === "gold"
            ? "#facc15"
            : l.kind === "potion"
              ? "#ef4444"
              : l.rarity === "rare"
                ? "#fde047"
                : l.rarity === "magic"
                  ? "#60a5fa"
                  : "#e2e8f0";
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Monsters
    for (const m of e.monsters) {
      const [x, y] = this.toMini(m.x, m.y);
      ctx.fillStyle = m.boss ? "#ff6b00" : m.champion ? "#ffd54f" : "#ef4444";
      const s = m.boss ? 5 : m.champion ? 3 : 2;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    // Other players
    ctx.fillStyle = "#60a5fa";
    for (const o of e.others) {
      const [x, y] = this.toMini(o.x, o.y);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Self
    const [sx, sy] = this.toMini(e.selfX, e.selfY);
    ctx.fillStyle = "#84ffff";
    ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 2.5, sy - 2.5, 5, 5);
  }
}
