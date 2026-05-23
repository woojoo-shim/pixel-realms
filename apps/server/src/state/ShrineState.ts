import { Schema, type } from "@colyseus/schema";

/** A consumable shrine on the ground. Walking near it grants a timed buff
 *  and removes the shrine from the world. */
export class ShrineState extends Schema {
  @type("string") id: string = "";
  @type("string") mapId: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  /** ShrineKind — one of "damage" | "speed" | "defense" | "regen" | "mana". */
  @type("string") kind: string = "damage";
}
