import { Schema, type } from "@colyseus/schema";

/**
 * Server-authoritative NPC state, synced to every client.
 * Driven by NpcDef in @pr/shared/npcs.ts.
 */
export class NpcState extends Schema {
  @type("string") id: string = "";
  /** Which map this NPC lives on — clients hide NPCs from other maps. */
  @type("string") mapId: string = "town";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  /** Facing direction ("up" | "down" | "left" | "right"). */
  @type("string") dir: string = "down";
  /** True while walking between waypoints (drives client animation hints). */
  @type("boolean") moving: boolean = false;
  /** Currently displayed speech line. Empty when no bubble is active. */
  @type("string") line: string = "";
  /** Epoch ms when the line should disappear. */
  @type("number") lineEnd: number = 0;
}
