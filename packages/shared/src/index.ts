// Shared constants and types between client and server

export * from "./map.js";
export * from "./monsters.js";
export * from "./items.js";
export * from "./quests.js";

export const WORLD = {
  WIDTH: 3200,
  HEIGHT: 3200,
  TILE_SIZE: 32,
} as const;

export const PLAYER = {
  SPEED: 160, // pixels per second
  SIZE: 24,
} as const;

export const NETWORK = {
  TICK_RATE: 20, // server ticks per second
  PORT: 2567,
} as const;

// Input flags sent from client to server every tick
export interface InputMessage {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  seq: number; // sequence number for client-side prediction reconciliation
}

export type Direction = "up" | "down" | "left" | "right";

/* ────────────────────────────────────────────────────────────────── */
/* Combat                                                             */
/* ────────────────────────────────────────────────────────────────── */

export const COMBAT = {
  /** How far in front the player's melee swing reaches. */
  ATTACK_RANGE: 44,
  /** Cooldown between player attacks (ms). */
  ATTACK_COOLDOWN_MS: 420,
  /** Visual swing duration (ms). */
  ATTACK_SWING_MS: 240,
  /** Reach of a monster's attack (px) — how close it must be. */
  MONSTER_ATTACK_RANGE: 24,
  /** Cooldown between a single monster's attacks (ms). */
  MONSTER_ATTACK_COOLDOWN_MS: 1100,
  /** Time before a dead player is sent back to town (ms). */
  RESPAWN_DELAY_MS: 4000,
  /** Time before a dead monster respawns somewhere in its map (ms). */
  MONSTER_RESPAWN_MS: 8000,
  /** I-frames after taking damage so HP doesn't drain instantly (ms). */
  PLAYER_IFRAMES_MS: 350,
} as const;

export const PROGRESSION = {
  BASE_HP: 30,
  HP_PER_LEVEL: 8,
  BASE_DMG: 5,
  DMG_PER_LEVEL: 2,
  /** EXP needed to go from level L to L+1: floor(BASE * GROWTH^(L-1)). */
  EXP_BASE: 12,
  EXP_GROWTH: 1.55,
} as const;

export function playerMaxHp(level: number, vit: number = 0): number {
  return (
    PROGRESSION.BASE_HP +
    (level - 1) * PROGRESSION.HP_PER_LEVEL +
    vit * STATS.HP_PER_VIT
  );
}

export function playerDamage(level: number, str: number = 0): number {
  return (
    PROGRESSION.BASE_DMG +
    (level - 1) * PROGRESSION.DMG_PER_LEVEL +
    str * STATS.DMG_PER_STR
  );
}

export function playerSpeed(qck: number = 0): number {
  return PLAYER.SPEED + qck * STATS.SPEED_PER_QCK;
}

export function expToNextLevel(level: number): number {
  return Math.floor(
    PROGRESSION.EXP_BASE * Math.pow(PROGRESSION.EXP_GROWTH, level - 1)
  );
}

export function playerMaxMp(level: number, mnd: number = 0): number {
  return (
    SPELLS.BASE_MP +
    (level - 1) * SPELLS.MP_PER_LEVEL +
    mnd * STATS.MP_PER_MND
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Stat allocation (Diablo-style attribute points)                    */
/* ────────────────────────────────────────────────────────────────── */

export const STATS = {
  POINTS_PER_LEVEL: 3,
  HP_PER_VIT: 5,
  MP_PER_MND: 3,
  DMG_PER_STR: 1,
  SPEED_PER_QCK: 4,
} as const;

export type StatKey = "vit" | "mnd" | "str" | "qck";

export interface AllocateMessage {
  stat: StatKey;
}

/* ────────────────────────────────────────────────────────────────── */
/* Spells (Diablo-style ranged attack with mana cost)                 */
/* ────────────────────────────────────────────────────────────────── */

export const SPELLS = {
  BASE_MP: 20,
  MP_PER_LEVEL: 5,
  /** Mana regenerated per second. */
  MANA_REGEN: 2,
  FIRE_BOLT_COST: 8,
  FIRE_BOLT_RANGE: 160,
  FIRE_BOLT_DMG_MULT: 1.6,
  FIRE_BOLT_COOLDOWN_MS: 700,
  FIRE_BOLT_SWING_MS: 220,

  // Frost Nova — AOE ice ring around the caster
  FROST_NOVA_COST: 14,
  FROST_NOVA_RADIUS: 95,
  FROST_NOVA_DMG_MULT: 1.3,
  FROST_NOVA_COOLDOWN_MS: 1400,
  FROST_NOVA_SLOW_MS: 1500,
  FROST_NOVA_SLOW_FACTOR: 0.3,

  // Teleport — instant short-range blink in the facing direction
  TELEPORT_COST: 16,
  TELEPORT_RANGE: 180,
  TELEPORT_COOLDOWN_MS: 1200,

  // Meteor — delayed area-of-effect strike at a target spot
  METEOR_COST: 24,
  METEOR_RANGE: 220,        // max distance from caster
  METEOR_RADIUS: 70,        // impact AOE
  METEOR_DELAY_MS: 1100,    // warning -> impact
  METEOR_DMG_MULT: 2.5,
  METEOR_COOLDOWN_MS: 2800,
} as const;

export interface FxTeleportPayload {
  sessionId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface FxMeteorWarningPayload {
  mapId: string;
  x: number;
  y: number;
  radius: number;
  delayMs: number;
}

export interface FxMeteorImpactPayload {
  mapId: string;
  x: number;
  y: number;
  radius: number;
  hits: { id: string; dmg: number; fatal: boolean; crit: boolean }[];
}

export interface FxNovaPayload {
  x: number;
  y: number;
  radius: number;
  hits: { id: string; dmg: number; fatal: boolean; crit: boolean }[];
}

/* ────────────────────────────────────────────────────────────────── */
/* Champion monsters (D2 elite enemies)                               */
/* ────────────────────────────────────────────────────────────────── */

export const CHAMPION = {
  /** Probability a spawn is a champion (per individual monster). */
  CHANCE: 0.08,
  HP_MULT: 2.5,
  DMG_MULT: 1.5,
  EXP_MULT: 3,
  GOLD_MULT: 4,
  SIZE_MULT: 1.4,
  /** Champion name prefix pool. */
  PREFIXES: [
    "Bloodthirsty",
    "Cursed",
    "Vile",
    "Putrid",
    "Wretched",
    "Savage",
    "Stygian",
    "Tainted",
    "Doomed",
    "Ghoulish",
    "Festering",
    "Hateful",
  ] as const,
} as const;

export interface CastMessage {
  seq: number;
  spell: "firebolt" | "frostnova";
}

export interface FxCastPayload {
  /** Where the projectile/effect originated. */
  fromX: number;
  fromY: number;
  /** Where it hit (or its trajectory endpoint). */
  toX: number;
  toY: number;
  spell: "firebolt";
}

/** Discrete attack request (separate from per-tick input). */
export interface AttackMessage {
  seq: number;
}

/** FX broadcast when something takes damage. */
export interface FxHitPayload {
  x: number;
  y: number;
  dmg: number;
  /** What kind of entity was hit. */
  target: "monster" | "player";
  /** Session id for a player, monster id for a monster. */
  targetId: string;
  /** True when this hit was a killing blow. */
  fatal?: boolean;
  /** True when this was a critical hit. */
  crit?: boolean;
}

/** FX broadcast when a player levels up. */
export interface FxLevelUpPayload {
  sessionId: string;
  level: number;
}

/* ────────────────────────────────────────────────────────────────── */
/* Loot                                                                */
/* ────────────────────────────────────────────────────────────────── */

export type LootKind = "gold" | "potion" | "item" | "chest";

export const CHEST = {
  /** Walking within this many px auto-opens the chest. */
  PICKUP_RADIUS: 24,
  /** How many chests to scatter per biome map. */
  PER_MAP: 3,
  /** Gold pile range from a chest. */
  GOLD_MIN: 25,
  GOLD_MAX: 90,
  /** Number of bonus loot drops scattered when a chest pops. */
  EXTRA_LOOT_MIN: 2,
  EXTRA_LOOT_MAX: 4,
  /** Inside the extra drops, chance to be a (better) item vs gold/potion. */
  ITEM_CHANCE: 0.55,
  /** Within item drops, chance to roll the rarity tier upward. */
  RARITY_BIAS_UP: 0.4,
} as const;

export const LOOT = {
  /** Player must be within this many px of a loot pile to pick it up. */
  PICKUP_RADIUS: 18,
  /** Fraction of maxHp restored by one potion. */
  POTION_HEAL_FRAC: 0.4,
  /** Max stack of potions a player can carry. */
  MAX_POTIONS: 8,
  /** Crit chance and multiplier (D2-style). */
  CRIT_CHANCE: 0.12,
  CRIT_MULT: 2,
  /** Probability a monster drops a potion instead of gold. */
  POTION_DROP_CHANCE: 0.2,
  /** Time before unpicked loot despawns (ms). */
  TTL_MS: 60_000,
} as const;

export interface FxPickupPayload {
  sessionId: string;
  kind: LootKind;
  amount: number;
  x: number;
  y: number;
}

/* ────────────────────────────────────────────────────────────────── */
/* Shrines                                                            */
/* ────────────────────────────────────────────────────────────────── */

export type ShrineKind = "damage" | "speed" | "defense" | "regen" | "mana";

export const SHRINE = {
  PICKUP_RADIUS: 28,
  PER_MAP: 4,
  /** How long the buff stays active after activation. */
  BUFF_DURATION_MS: 60_000,
  /** Combat / movement modifiers. */
  DAMAGE_MULT: 1.6,
  SPEED_MULT: 1.5,
  /** Damage taken from monsters is multiplied by this (lower = better). */
  DEFENSE_INCOMING_MULT: 0.55,
  /** Fraction of maxHp regenerated per second while buff is active. */
  REGEN_FRAC_PER_SEC: 0.04,
  /** Mana regen multiplier. */
  MANA_REGEN_MULT: 4,
} as const;

export const SHRINE_LABEL: Record<ShrineKind, string> = {
  damage: "Wrath",
  speed: "Swiftness",
  defense: "Stoneskin",
  regen: "Vitality",
  mana: "Insight",
};

export const SHRINE_COLOR: Record<ShrineKind, string> = {
  damage: "#ef4444",
  speed: "#84ffff",
  defense: "#a3a3a3",
  regen: "#86efac",
  mana: "#60a5fa",
};

export interface FxShrinePayload {
  sessionId: string;
  kind: ShrineKind;
  x: number;
  y: number;
}

/* ────────────────────────────────────────────────────────────────── */
/* Waypoints                                                          */
/* ────────────────────────────────────────────────────────────────── */

export const WAYPOINT = {
  /** Range at which a player can interact with a waypoint. */
  ACTIVATE_RADIUS: 34,
} as const;

export interface UseWaypointMessage {
  /** Destination MapId. */
  to: string;
}

export interface FxWaypointPayload {
  sessionId: string;
  /** Destination MapId after travel. */
  to: string;
}


export * from "./skills.js";
export type { SkillBranch, SkillDef } from "./skills.js";

