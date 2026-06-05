/**
 * Monster catalog — data-driven, region-aware.
 *
 * To add a new monster: append to MonsterType + MONSTER_DEFS.
 * To add a new region's monsters: append to MAP_MONSTER_SPAWNS.
 *
 * This is the single source of truth for both server (spawn + AI tuning)
 * and client (rendering).
 */

import type { MapId, TileType } from "./map.js";

export type MonsterType =
  // Forest
  | "slime"
  | "wolf"
  | "spider"
  // Desert
  | "scorpion"
  | "sandworm"
  | "mummy"
  // Mountain
  | "bat"
  | "golem"
  | "goblin"
  // Lake
  | "crab"
  | "fish"
  | "eel";

/**
 * Combat archetypes. Server tick implements distinct behavior per kind:
 *  - melee:  walk into the player, deal contact damage on touch (default)
 *  - charge: lock target, wind-up ~600ms, dash hard for 0.4s, then recover
 *  - ranged: stand off at preferred distance, fire a homing projectile
 *  - slam:   walk close, wind-up 800ms, instant ring AOE
 */
export type AttackKind = "melee" | "charge" | "ranged" | "slam";

export interface MonsterDef {
  type: MonsterType;
  displayName: string;
  /** Suggested player level — used for difficulty sorting + UI hints. */
  level: number;
  maxHp: number;
  speed: number; // px / sec
  damage: number;
  expReward: number;
  goldReward: number;
  /** Body radius for rendering + (later) collision. */
  radius: number;
  /** Primary body color (hex). */
  color: number;
  /** Secondary accent color (eyes, stripes, etc). */
  accent: number;
  /** Pixels within which the monster aggros onto a player. 0 = passive. */
  aggroRange: number;
  /** How far the monster wanders from its home spawn point. */
  wanderRange: number;
  /** Combat archetype. Defaults to "melee" if omitted. */
  attackKind?: AttackKind;
  /** For "ranged": preferred distance from target while attacking. */
  rangedDistance?: number;
  /** For "ranged" / "slam" / "charge": attack action cooldown ms. */
  attackCooldownMs?: number;
  /** For "slam": AOE radius. For "ranged": projectile travel radius. */
  attackRadius?: number;
  /** For "charge": dash speed multiplier vs base speed. */
  chargeSpeedMult?: number;
}

export const MONSTER_DEFS: Record<MonsterType, MonsterDef> = {
  // ── Forest ────────────────────────────────────────────────────────
  // slime: passive blob, contact damage only
  slime: {
    type: "slime", displayName: "Slime",
    level: 1, maxHp: 12, speed: 30, damage: 2,
    expReward: 4, goldReward: 2,
    radius: 9, color: 0x4caf50, accent: 0x2e7d32,
    aggroRange: 0, wanderRange: 60,
    attackKind: "melee",
  },
  // wolf: stalks, then dashes
  wolf: {
    type: "wolf", displayName: "Wolf",
    level: 4, maxHp: 28, speed: 70, damage: 6,
    expReward: 12, goldReward: 6,
    radius: 11, color: 0x6d4c41, accent: 0x3e2723,
    aggroRange: 180, wanderRange: 120,
    attackKind: "charge", chargeSpeedMult: 3.2, attackCooldownMs: 2400,
  },
  // spider: scuttles, contact bite (legacy — not in current rotation)
  spider: {
    type: "spider", displayName: "Spider",
    level: 3, maxHp: 18, speed: 55, damage: 4,
    expReward: 8, goldReward: 3,
    radius: 9, color: 0x4a148c, accent: 0xe91e63,
    aggroRange: 100, wanderRange: 80,
    attackKind: "melee",
  },

  // ── Desert ────────────────────────────────────────────────────────
  // scorpion: pincer melee
  scorpion: {
    type: "scorpion", displayName: "Scorpion",
    level: 5, maxHp: 30, speed: 45, damage: 8,
    expReward: 14, goldReward: 7,
    radius: 10, color: 0xc28840, accent: 0x6d4c1f,
    aggroRange: 120, wanderRange: 80,
    attackKind: "melee",
  },
  // sandworm: burrows + spits sand projectiles at range
  sandworm: {
    type: "sandworm", displayName: "Sandworm",
    level: 8, maxHp: 60, speed: 40, damage: 12,
    expReward: 25, goldReward: 14,
    radius: 14, color: 0xa1887f, accent: 0x5d4037,
    aggroRange: 220, wanderRange: 40,
    attackKind: "ranged", rangedDistance: 150, attackCooldownMs: 1800,
    attackRadius: 16,
  },
  // mummy: slow shambling melee (legacy)
  mummy: {
    type: "mummy", displayName: "Mummy",
    level: 7, maxHp: 45, speed: 30, damage: 10,
    expReward: 22, goldReward: 11,
    radius: 11, color: 0xece0c0, accent: 0x8d6e63,
    aggroRange: 160, wanderRange: 60,
    attackKind: "melee",
  },

  // ── Mountain ──────────────────────────────────────────────────────
  // bat: dive-bombs in short charges
  bat: {
    type: "bat", displayName: "Bat",
    level: 2, maxHp: 10, speed: 90, damage: 3,
    expReward: 6, goldReward: 2,
    radius: 7, color: 0x37474f, accent: 0xb71c1c,
    aggroRange: 140, wanderRange: 160,
    attackKind: "charge", chargeSpeedMult: 2.6, attackCooldownMs: 1500,
  },
  // golem: lumbers close, slams the ground for a big AOE
  golem: {
    type: "golem", displayName: "Stone Golem",
    level: 10, maxHp: 100, speed: 25, damage: 18,
    expReward: 40, goldReward: 22,
    radius: 16, color: 0x607d8b, accent: 0x37474f,
    aggroRange: 130, wanderRange: 40,
    attackKind: "slam", attackCooldownMs: 2800, attackRadius: 60,
  },
  // goblin: light melee (legacy)
  goblin: {
    type: "goblin", displayName: "Goblin",
    level: 6, maxHp: 35, speed: 60, damage: 9,
    expReward: 18, goldReward: 9,
    radius: 10, color: 0x689f38, accent: 0x33691e,
    aggroRange: 130, wanderRange: 90,
    attackKind: "melee",
  },

  // ── Lake ──────────────────────────────────────────────────────────
  // crab: sidesteps in close — melee pincer
  crab: {
    type: "crab", displayName: "Crab",
    level: 3, maxHp: 22, speed: 35, damage: 5,
    expReward: 10, goldReward: 5,
    radius: 10, color: 0xe57373, accent: 0x9c2222,
    aggroRange: 80, wanderRange: 50,
    attackKind: "melee",
  },
  // piranha: frenzied dash-bite swarm
  fish: {
    type: "fish", displayName: "Piranha",
    level: 2, maxHp: 8, speed: 75, damage: 3,
    expReward: 5, goldReward: 2,
    radius: 7, color: 0x4fc3f7, accent: 0x01579b,
    aggroRange: 110, wanderRange: 120,
    attackKind: "charge", chargeSpeedMult: 2.4, attackCooldownMs: 1300,
  },
  // electric eel: keeps distance, fires shock bolts
  eel: {
    type: "eel", displayName: "Electric Eel",
    level: 6, maxHp: 32, speed: 65, damage: 11,
    expReward: 20, goldReward: 10,
    radius: 9, color: 0x9575cd, accent: 0x311b92,
    aggroRange: 200, wanderRange: 80,
    attackKind: "ranged", rangedDistance: 140, attackCooldownMs: 1600,
    attackRadius: 14,
  },
};

/**
 * Per-map spawn config.
 *  - `count`: how many of this type to spawn.
 *  - `allowedTiles`: tile types where they may spawn (if omitted, any walkable).
 *
 * The server runs this once at room creation. To add a new region's monsters,
 * just add another entry — no other code changes needed.
 */
export interface MonsterSpawn {
  type: MonsterType;
  count: number;
  allowedTiles?: TileType[];
  /** When true this is the area's boss — spawns a single empowered unique. */
  boss?: boolean;
  /** Boss display name (overrides champion prefix). */
  bossTitle?: string;
}

/** Boss multipliers applied on top of the base MonsterDef. */
export const BOSS = {
  HP_MULT: 12,
  DMG_MULT: 2.4,
  SIZE_MULT: 2.0,
  EXP_MULT: 25,
  GOLD_MULT: 15,
  AGGRO_BONUS: 80,
  RESPAWN_MS: 180_000, // 3 min
} as const;

/**
 * Per region: cap at 3 monster types (usually 2). Each type in a region
 * should use a *different* attackKind so encounters feel distinct.
 *
 * Forest:    slime (melee)    + wolf (charge)
 * Desert:    scorpion (melee) + sandworm (ranged)
 * Mountain:  bat (charge)     + golem (slam)
 * Lake:      crab (melee)     + piranha (charge) + eel (ranged)   ← 3 types
 */
export const MAP_MONSTER_SPAWNS: Record<MapId, MonsterSpawn[]> = {
  town: [],
  forest: [
    { type: "slime", count: 26, allowedTiles: ["grass"] },
    { type: "wolf", count: 12, allowedTiles: ["grass"] },
    { type: "wolf", count: 1, allowedTiles: ["grass"], boss: true,
      bossTitle: "Tor'kal, the Forest Lord" },
  ],
  desert: [
    { type: "scorpion", count: 24, allowedTiles: ["sand"] },
    { type: "sandworm", count: 8, allowedTiles: ["sand"] },
    { type: "sandworm", count: 1, allowedTiles: ["sand"], boss: true,
      bossTitle: "Sahkris, the Sand Maw" },
  ],
  mountain: [
    { type: "bat", count: 22, allowedTiles: ["stone"] },
    { type: "golem", count: 7, allowedTiles: ["stone"] },
    { type: "golem", count: 1, allowedTiles: ["stone"], boss: true,
      bossTitle: "Korgaroth the Stoneborn" },
  ],
  lake: [
    { type: "crab", count: 14, allowedTiles: ["sand", "water"] },
    { type: "fish", count: 22, allowedTiles: ["water"] },
    { type: "eel", count: 10, allowedTiles: ["water"] },
    { type: "eel", count: 1, allowedTiles: ["water"], boss: true,
      bossTitle: "Vashka, the Drowned Queen" },
  ],
};
