import { Schema, type } from "@colyseus/schema";

/** A waypoint stone — fast-travel hub. Persistent and shared by all
 *  players. Stays visible once a player has discovered it. */
export class WaypointState extends Schema {
  @type("string") id: string = "";
  @type("string") mapId: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}
