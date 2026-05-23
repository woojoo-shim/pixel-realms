// Item catalog: weapons, armor, accessories. Each item has a base stat
// payload that is multiplied by rarity at drop time.

export type ItemSlot = "weapon" | "head" | "chest" | "ring";

export type ItemRarity = "common" | "magic" | "rare";

export const RARITY = {
  COLOR: { common: "#cbd5e1", magic: "#60a5fa", rare: "#fde047" } as Record<
    ItemRarity,
    string
  >,
  HEX: { common: 0xcbd5e1, magic: 0x60a5fa, rare: 0xfde047 } as Record<
    ItemRarity,
    number
  >,
  /** Stat multiplier applied to base item stats at roll time. */
  MULT: { common: 1, magic: 1.35, rare: 1.75 } as Record<ItemRarity, number>,
  /** Name prefix to mark a rarity tier (kept brief). */
  PREFIX: {
    common: "",
    magic: "Glowing",
    rare: "Mythic",
  } as Record<ItemRarity, string>,
} as const;

export interface ItemDef {
  id: string;
  name: string;
  slot: ItemSlot;
  stats: { damage?: number; maxHp?: number; maxMp?: number; speed?: number };
  /** Color used for the on-ground icon and the inventory tile background. */
  color: number;
  /** Lowest monster level that can drop this item. */
  dropLevel: number;
}

export const ITEMS = {
  // ── Weapons ──────────────────────────────────────────────────────
  "wooden-sword": {
    id: "wooden-sword",
    name: "Wooden Sword",
    slot: "weapon",
    stats: { damage: 2 },
    color: 0x8d6e63,
    dropLevel: 1,
  },
  "iron-sword": {
    id: "iron-sword",
    name: "Iron Sword",
    slot: "weapon",
    stats: { damage: 5 },
    color: 0xb0bec5,
    dropLevel: 3,
  },
  "steel-blade": {
    id: "steel-blade",
    name: "Steel Blade",
    slot: "weapon",
    stats: { damage: 8 },
    color: 0xeceff1,
    dropLevel: 5,
  },
  "elven-edge": {
    id: "elven-edge",
    name: "Elven Edge",
    slot: "weapon",
    stats: { damage: 11, speed: 8 },
    color: 0x84ffff,
    dropLevel: 7,
  },
  // ── Head ─────────────────────────────────────────────────────────
  "leather-cap": {
    id: "leather-cap",
    name: "Leather Cap",
    slot: "head",
    stats: { maxHp: 6 },
    color: 0x6d4c41,
    dropLevel: 1,
  },
  "iron-helm": {
    id: "iron-helm",
    name: "Iron Helm",
    slot: "head",
    stats: { maxHp: 16 },
    color: 0x90a4ae,
    dropLevel: 3,
  },
  "crown-of-mind": {
    id: "crown-of-mind",
    name: "Crown of Mind",
    slot: "head",
    stats: { maxHp: 10, maxMp: 14 },
    color: 0xfdd835,
    dropLevel: 6,
  },
  // ── Chest ────────────────────────────────────────────────────────
  "leather-tunic": {
    id: "leather-tunic",
    name: "Leather Tunic",
    slot: "chest",
    stats: { maxHp: 12 },
    color: 0x6d4c41,
    dropLevel: 1,
  },
  chainmail: {
    id: "chainmail",
    name: "Chainmail",
    slot: "chest",
    stats: { maxHp: 28, speed: -6 },
    color: 0x9e9e9e,
    dropLevel: 4,
  },
  "warlord-plate": {
    id: "warlord-plate",
    name: "Warlord Plate",
    slot: "chest",
    stats: { maxHp: 50, damage: 3, speed: -10 },
    color: 0xff6f00,
    dropLevel: 7,
  },
  // ── Ring ─────────────────────────────────────────────────────────
  "ring-of-vigor": {
    id: "ring-of-vigor",
    name: "Ring of Vigor",
    slot: "ring",
    stats: { maxHp: 8, maxMp: 6 },
    color: 0xfdd835,
    dropLevel: 2,
  },
  "ring-of-haste": {
    id: "ring-of-haste",
    name: "Ring of Haste",
    slot: "ring",
    stats: { speed: 14 },
    color: 0x84ffff,
    dropLevel: 4,
  },
  "ring-of-fury": {
    id: "ring-of-fury",
    name: "Ring of Fury",
    slot: "ring",
    stats: { damage: 4, maxMp: -4 },
    color: 0xef4444,
    dropLevel: 5,
  },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

export const SLOT_LABEL: Record<ItemSlot, string> = {
  weapon: "Weapon",
  head: "Head",
  chest: "Chest",
  ring: "Ring",
};

export const SLOT_ORDER: ItemSlot[] = ["weapon", "head", "chest", "ring"];

export const INVENTORY = {
  MAX_SLOTS: 24,
  /** Probability a monster kill drops an item (per drop roll). */
  ITEM_DROP_CHANCE: 0.14,
  /** Champion item-drop chance multiplier. */
  CHAMPION_DROP_MULT: 2.5,
  RARITY_MAGIC_CHANCE: 0.25,
  RARITY_RARE_CHANCE: 0.06,
} as const;

export function rollItemId(
  monsterLevel: number,
  rng: () => number = Math.random
): ItemId | null {
  const pool: ItemId[] = (Object.keys(ITEMS) as ItemId[]).filter(
    (id) => ITEMS[id].dropLevel <= monsterLevel + 1
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)] as ItemId;
}

export function rollRarity(rng: () => number = Math.random): ItemRarity {
  const r = rng();
  if (r < INVENTORY.RARITY_RARE_CHANCE) return "rare";
  if (r < INVENTORY.RARITY_RARE_CHANCE + INVENTORY.RARITY_MAGIC_CHANCE)
    return "magic";
  return "common";
}

export interface ItemStats {
  damage: number;
  maxHp: number;
  maxMp: number;
  speed: number;
}

export function itemStats(itemId: string, rarity: ItemRarity): ItemStats {
  const def = (ITEMS as Record<string, ItemDef>)[itemId];
  if (!def) return { damage: 0, maxHp: 0, maxMp: 0, speed: 0 };
  const m = RARITY.MULT[rarity];
  return {
    damage: Math.round((def.stats.damage ?? 0) * m),
    maxHp: Math.round((def.stats.maxHp ?? 0) * m),
    maxMp: Math.round((def.stats.maxMp ?? 0) * m),
    speed: Math.round((def.stats.speed ?? 0) * m),
  };
}

export function itemFullName(itemId: string, rarity: ItemRarity): string {
  const def = (ITEMS as Record<string, ItemDef>)[itemId];
  if (!def) return "Unknown";
  const prefix = RARITY.PREFIX[rarity];
  return prefix ? `${prefix} ${def.name}` : def.name;
}

/** Messages */
export interface EquipMessage {
  /** Inventory instance id. */
  itemId: string;
}

export interface UnequipMessage {
  slot: ItemSlot;
}

export interface DropItemMessage {
  /** Inventory instance id. */
  itemId: string;
}

/* ─── Vendor pricing ──────────────────────────────────────────────── */

export const VENDOR = {
  POTION_PRICE: 25,
  /** Base sell-back price per rarity tier. */
  SELL_RARITY: { common: 8, magic: 28, rare: 90 } as Record<
    ItemRarity,
    number
  >,
  /** Extra gold per dropLevel above 1 (scales price with item tier). */
  SELL_LEVEL_BONUS: 4,
} as const;

export function sellPriceFor(itemId: string, rarity: ItemRarity): number {
  const def = (ITEMS as Record<string, ItemDef>)[itemId];
  if (!def) return 1;
  const base = VENDOR.SELL_RARITY[rarity];
  const lvl = Math.max(0, def.dropLevel - 1);
  return Math.round(base + lvl * VENDOR.SELL_LEVEL_BONUS);
}

export interface BuyPotionMessage {}
export interface SellItemMessage {
  itemId: string;
}
