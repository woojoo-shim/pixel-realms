import { Schema, ArraySchema, MapSchema, type } from "@colyseus/schema";
import { InventoryItemState } from "./InventoryItemState.js";

export class PlayerState extends Schema {
  @type("string") name: string = "";
  @type("string") mapId: string = "town";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") dir: string = "down";
  @type("boolean") moving: boolean = false;

  // ── Combat / progression ──────────────────────────────────────────
  @type("number") hp: number = 30;
  @type("number") maxHp: number = 30;
  @type("number") level: number = 1;
  @type("number") exp: number = 0;
  @type("number") gold: number = 0;
  @type("boolean") alive: boolean = true;
  /** Server timestamp (ms). While < now, the player is mid-swing. */
  @type("number") attackUntil: number = 0;
  /** Health potions in inventory. */
  @type("number") potions: number = 3;
  /** Mana for spells. */
  @type("number") mp: number = 20;
  @type("number") maxMp: number = 20;
  /** Server timestamp until which the casting pose is shown. */
  @type("number") castUntil: number = 0;
  // ── Stat allocation (D2-style attribute points) ─────────────────
  @type("number") statPoints: number = 0;
  @type("number") statVit: number = 0;
  @type("number") statMnd: number = 0;
  @type("number") statStr: number = 0;
  @type("number") statQck: number = 0;

  /** CSV of MapId this player has visited (eligible for waypoint travel). */
  @type("string") discoveredMaps: string = "town";

  // ── Quests ─────────────────────────────────────────────────────
  /** Progress counter per quest id. */
  @type({ map: "number" }) questProgress = new MapSchema<number>();
  /** CSV of completed quest ids. */
  @type("string") questCompleted: string = "";

  // ── Shrine buff ────────────────────────────────────────────────
  /** Epoch ms when the current buff expires. 0 = no buff. */
  @type("number") buffEnd: number = 0;
  /** ShrineKind string identifying the active buff. */
  @type("string") buffKind: string = "";

  // ── Skill tree ─────────────────────────────────────────────────
  /** Unspent skill points (1 per level up). */
  @type("number") skillPoints: number = 0;
  /** Skill id → invested level. */
  @type({ map: "number" }) skillLevels = new MapSchema<number>();

  // ── Inventory & equipment ─────────────────────────────────────────
  /** Items in the player's bag. */
  @type([InventoryItemState]) inventory =
    new ArraySchema<InventoryItemState>();
  /** Equipped items keyed by slot ("weapon", "head", "chest", "ring"). */
  @type({ map: InventoryItemState }) equipment =
    new MapSchema<InventoryItemState>();

  // ── Tutorial ───────────────────────────────────────────────────
  /** Onboarding step index. 0 = first step, >= TUTORIAL_STEPS = finished. */
  @type("number") tutorialStep: number = 0;

  // ── Character appearance + class (chosen during char creation) ──
  /** Sprite hue rotation in degrees (0..360). Synced to other clients. */
  @type("number") colorHue: number = 170;
  /** Class id from CLASSES catalog. Empty = unset (pre-creation). */
  @type("string") classId: string = "";
}
