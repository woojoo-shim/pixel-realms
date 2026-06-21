import { Schema, MapSchema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";
import { MonsterState } from "./MonsterState.js";
import { LootState } from "./LootState.js";
import { ShrineState } from "./ShrineState.js";
import { WaypointState } from "./WaypointState.js";
import { NpcState } from "./NpcState.js";

export class WorldState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: MonsterState }) monsters = new MapSchema<MonsterState>();
  @type({ map: LootState }) loots = new MapSchema<LootState>();
  @type({ map: ShrineState }) shrines = new MapSchema<ShrineState>();
  @type({ map: WaypointState }) waypoints = new MapSchema<WaypointState>();
  @type({ map: NpcState }) npcs = new MapSchema<NpcState>();
}
