import { Schema, type } from "@colyseus/schema";

/** A pile of gold, a potion, or an item lying on the ground for pickup. */
export class LootState extends Schema {
  @type("string") id: string = "";
  @type("string") mapId: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  /** "gold" | "potion" | "item" */
  @type("string") kind: string = "gold";
  @type("number") amount: number = 1;
  /** For item drops: catalog id (e.g. "iron-sword"). Empty for gold/potion. */
  @type("string") itemId: string = "";
  /** For item drops: "common" | "magic" | "rare". */
  @type("string") rarity: string = "common";
}
