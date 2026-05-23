import { Schema, type } from "@colyseus/schema";

export class MonsterState extends Schema {
  @type("string") id: string = "";
  @type("string") mtype: string = ""; // MonsterType
  @type("string") mapId: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 0;
  @type("number") maxHp: number = 0;
  @type("string") dir: string = "down";
  @type("boolean") moving: boolean = false;
  /** Elite/champion modifier (D2-style — bigger, stronger, named). */
  @type("boolean") champion: boolean = false;
  /** Boss modifier (act unique — huge, devastating, named, guaranteed drop). */
  @type("boolean") boss: boolean = false;
  /** Display title for champion or boss monsters, e.g. "Bloodthirsty Wolf". */
  @type("string") title: string = "";
}
