import { Schema, type } from "@colyseus/schema";

/** A single item instance owned by a player. */
export class InventoryItemState extends Schema {
  /** Unique instance id (scoped to this room session). */
  @type("string") id: string = "";
  /** Catalog id — index into ITEMS. */
  @type("string") itemId: string = "";
  /** "common" | "magic" | "rare". */
  @type("string") rarity: string = "common";
}
