import { Room, Client } from "colyseus";
import { WorldState } from "../state/WorldState.js";
import {
  accountStore,
  type CharacterData,
  type InventoryItemData,
} from "../accounts.js";
import { PlayerState } from "../state/PlayerState.js";
import { MonsterState } from "../state/MonsterState.js";
import { LootState } from "../state/LootState.js";
import { ShrineState } from "../state/ShrineState.js";
import { WaypointState } from "../state/WaypointState.js";
import { InventoryItemState } from "../state/InventoryItemState.js";
import {
  InputMessage,
  AttackMessage,
  AllocateMessage,
  CastMessage,
  EquipMessage,
  UnequipMessage,
  DropItemMessage,
  BuyPotionMessage,
  SellItemMessage,
  VENDOR,
  sellPriceFor,
  FxHitPayload,
  FxLevelUpPayload,
  FxPickupPayload,
  FxCastPayload,
  FxNovaPayload,
  FxTeleportPayload,
  FxMeteorWarningPayload,
  FxMeteorImpactPayload,
  BOSS,
  CHAMPION,
  CHEST,
  COMBAT,
  SHRINE,
  WAYPOINT,
  type ShrineKind,
  type FxShrinePayload,
  type UseWaypointMessage,
  type FxWaypointPayload,
  QUESTS,
  QUESTS_BY_ID,
  questMatches,
  type FxQuestCompletePayload,
  INVENTORY,
  ITEMS,
  ItemDef,
  ItemRarity,
  ItemSlot,
  LOOT,
  NETWORK,
  PLAYER,
  SPELLS,
  STATS,
  WORLD,
  generateAllMaps,
  itemFullName,
  itemStats,
  ObstacleGrid,
  canStandAt,
  getPortalAt,
  MAP_MONSTER_SPAWNS,
  MONSTER_DEFS,
  playerMaxHp,
  playerMaxMp,
  playerDamage,
  playerSpeed,
  expToNextLevel,
  rollItemId,
  rollRarity,
  type LootKind,
  type MapData,
  type MapId,
  type MonsterType,
  type StatKey,
  type TileType,
} from "@pr/shared";

interface EquipBonus {
  damage: number;
  maxHp: number;
  maxMp: number;
  speed: number;
}
const ZERO_BONUS: EquipBonus = { damage: 0, maxHp: 0, maxMp: 0, speed: 0 };

function equipBonus(p: PlayerState): EquipBonus {
  const b: EquipBonus = { damage: 0, maxHp: 0, maxMp: 0, speed: 0 };
  p.equipment.forEach((it) => {
    const s = itemStats(it.itemId, it.rarity as ItemRarity);
    b.damage += s.damage;
    b.maxHp += s.maxHp;
    b.maxMp += s.maxMp;
    b.speed += s.speed;
  });
  return b;
}

function buffActive(p: PlayerState, kind: ShrineKind): boolean {
  return p.buffKind === kind && Date.now() < p.buffEnd;
}

function recomputeDerived(p: PlayerState): void {
  const b = equipBonus(p);
  const newMaxHp = playerMaxHp(p.level, p.statVit) + b.maxHp;
  const newMaxMp = playerMaxMp(p.level, p.statMnd) + b.maxMp;
  // Floor at 1 so a stat-debuff item can't kill the player.
  p.maxHp = Math.max(1, newMaxHp);
  p.maxMp = Math.max(0, newMaxMp);
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  if (p.mp > p.maxMp) p.mp = p.maxMp;
}

/** Tile types each monster type cannot walk onto. */
const MONSTER_BLOCKED_TILES: Record<MonsterType, ReadonlyArray<TileType>> = {
  slime: ["water"],
  wolf: ["water"],
  spider: ["water"],
  scorpion: ["water"],
  sandworm: ["water"],
  mummy: ["water"],
  bat: [], // flies
  golem: ["water"],
  goblin: ["water"],
  crab: ["grass", "stone", "path", "plaza", "farmland"],
  fish: ["grass", "sand", "stone", "path", "plaza", "farmland"],
  eel: ["grass", "sand", "stone", "path", "plaza", "farmland"],
};

interface InputBuffer {
  current: InputMessage;
  lastSeq: number;
}

interface MonsterRuntime {
  state: MonsterState;
  type: MonsterType;
  homeX: number;
  homeY: number;
  /** Current wander destination. */
  targetX: number;
  targetY: number;
  /** Wait timer (ms) before picking the next destination. */
  waitMs: number;
  /** Cooldown timestamp for next attack (ms, epoch). */
  nextAttackAt: number;
  /** Currently aggro'd player's session id, "" = none. */
  aggroSession: string;
  /** Epoch ms until which the monster moves at slow factor (Frost Nova). */
  slowedUntil: number;
}

interface RespawnTask {
  /** "" means a monster, otherwise a player session id. */
  sessionId: string;
  /** Only for monster respawns. */
  monsterType?: MonsterType;
  monsterMap?: MapId;
  /** When set, the respawn re-creates this boss with the same title. */
  monsterBoss?: boolean;
  monsterBossTitle?: string;
  /** Epoch ms when to execute. */
  at: number;
}

const PLAYER_RADIUS = 10;
const PORTAL_COOLDOWN_MS = 800;
const MONSTER_WAIT_MIN_MS = 800;
const MONSTER_WAIT_MAX_MS = 2800;
const MONSTER_ARRIVE_DIST = 4;
/** When a monster strays this far past aggro range, it drops the target. */
const AGGRO_DROP_MULTIPLIER = 1.7;

export class WorldRoom extends Room<WorldState> {
  maxClients = 100;

  private maps!: Record<MapId, { data: MapData; grid: ObstacleGrid }>;
  private inputs = new Map<string, InputBuffer>();
  private portalCooldown = new Map<string, number>();
  private monsters = new Map<string, MonsterRuntime>();
  private monsterIdSeq = 0;
  /** Per-player attack cooldown timestamps (epoch ms). */
  private playerAttackCd = new Map<string, number>();
  /** Per-player spell cooldown timestamps (epoch ms). */
  private playerCastCd = new Map<string, number>();
  /** Per-player i-frames (epoch ms). */
  private playerIFrames = new Map<string, number>();
  private respawnQueue: RespawnTask[] = [];
  private lootIdSeq = 0;
  private itemInstIdSeq = 0;
  /** sessionId → username, for persistence on leave. */
  private sessionAccount = new Map<string, string>();
  private saveTicker: NodeJS.Timeout | null = null;
  /** TTL bookkeeping: lootId → epoch ms when it despawns. */
  private lootDespawn = new Map<string, number>();

  onCreate(options: { private?: boolean } = {}) {
    this.state = new WorldState();

    // Private rooms are removed from public matchmaking so only direct
    // joinById() calls (or our own client) can enter.
    if (options.private) {
      this.setPrivate(true);
    }

    const generated = generateAllMaps(WORLD.WIDTH, WORLD.HEIGHT, WORLD.TILE_SIZE);
    this.maps = {} as Record<MapId, { data: MapData; grid: ObstacleGrid }>;
    for (const [id, data] of Object.entries(generated)) {
      this.maps[id as MapId] = { data, grid: new ObstacleGrid(data) };
      console.log(
        `[WorldRoom] map ${id}: ${data.obstacles.length} obstacles, ${data.portals.length} portals`
      );
    }

    this.onMessage<InputMessage>("input", (client, msg) => {
      const buf = this.inputs.get(client.sessionId);
      if (buf) {
        buf.current = msg;
        buf.lastSeq = msg.seq;
      }
    });

    this.onMessage<AttackMessage>("attack", (client) => {
      this.handleAttack(client.sessionId);
    });

    this.onMessage("heal", (client) => {
      this.handleHeal(client.sessionId);
    });

    this.onMessage<CastMessage>("cast", (client, msg) => {
      if (msg?.spell === "frostnova") this.handleNova(client.sessionId);
      else this.handleCast(client.sessionId);
    });

    this.onMessage<{ tx: number; ty: number }>("teleport", (client, msg) => {
      this.handleTeleport(client.sessionId, msg?.tx, msg?.ty);
    });
    this.onMessage<{ tx: number; ty: number }>("meteor", (client, msg) => {
      this.handleMeteor(client.sessionId, msg?.tx, msg?.ty);
    });

    this.onMessage<EquipMessage>("equip", (client, msg) => {
      this.handleEquip(client.sessionId, msg.itemId);
    });
    this.onMessage<UnequipMessage>("unequip", (client, msg) => {
      this.handleUnequip(client.sessionId, msg.slot);
    });
    this.onMessage<DropItemMessage>("dropItem", (client, msg) => {
      this.handleDropItem(client.sessionId, msg.itemId);
    });
    this.onMessage<BuyPotionMessage>("buyPotion", (client) => {
      this.handleBuyPotion(client.sessionId);
    });
    this.onMessage<SellItemMessage>("sellItem", (client, msg) => {
      this.handleSellItem(client.sessionId, msg?.itemId);
    });
    this.onMessage<UseWaypointMessage>("useWaypoint", (client, msg) => {
      this.handleUseWaypoint(client.sessionId, msg?.to);
    });
    this.onMessage<AllocateMessage>("allocate", (client, msg) => {
      this.handleAllocate(client.sessionId, msg?.stat);
    });

    this.onMessage("requestMaps", (client) => {
      client.send("maps", this.serializeMaps());
    });

    this.spawnAllMonsters();
    this.spawnAllChests();
    this.spawnAllShrines();
    this.spawnAllWaypoints();

    // Periodic autosave so progress isn't lost on a crash
    this.saveTicker = setInterval(() => this.autosaveAll(), 30_000);

    this.setSimulationInterval((dt) => this.tick(dt), 1000 / NETWORK.TICK_RATE);
    console.log(`[WorldRoom] created. tick=${NETWORK.TICK_RATE}Hz`);
  }

  /* ─────────────────────────────────────────────────────────────── */
  /* Monsters                                                        */
  /* ─────────────────────────────────────────────────────────────── */

  private spawnAllMonsters() {
    let total = 0;
    let champions = 0;
    for (const [mapId, spawns] of Object.entries(MAP_MONSTER_SPAWNS)) {
      const pair = this.maps[mapId as MapId];
      if (!pair) continue;
      for (const spawn of spawns) {
        if (spawn.boss) {
          // Bosses spawn solo, anywhere on a valid tile
          for (let i = 0; i < spawn.count; i++) {
            const pos = this.findSpawnTile(pair.data, spawn.allowedTiles);
            if (!pos) continue;
            this.createMonster(
              spawn.type,
              mapId as MapId,
              pos.x,
              pos.y,
              false,
              true,
              spawn.bossTitle
            );
            total++;
          }
          continue;
        }
        // Varied pack spawning — mix solo wanderers with dense pack camps.
        // Each pack rolls a weighted size:
        //   55%  solo / pair    (1–2 monsters, sparse)
        //   30%  small pack     (4–6 monsters)
        //   15%  dense camp     (8–11 monsters, tightly clustered)
        // Tighter clusters use a smaller pack radius so they feel like camps.
        let remaining = spawn.count;
        while (remaining > 0) {
          const r = Math.random();
          let target: number;
          let packRadius: number;
          if (r < 0.55) {
            target = 1 + Math.floor(Math.random() * 2); // 1–2
            packRadius = 40;
          } else if (r < 0.85) {
            target = 4 + Math.floor(Math.random() * 3); // 4–6
            packRadius = 90;
          } else {
            target = 8 + Math.floor(Math.random() * 4); // 8–11
            packRadius = 70; // tighter for dense camp feel
          }
          const members = Math.min(target, remaining);
          remaining -= members;

          const center = this.findSpawnTile(pair.data, spawn.allowedTiles);
          if (!center) continue;
          for (let i = 0; i < members; i++) {
            const pos =
              i === 0
                ? center
                : this.findNearbyTile(
                    pair.data,
                    center.x,
                    center.y,
                    packRadius,
                    spawn.allowedTiles
                  ) ?? center;
            const isChamp = Math.random() < CHAMPION.CHANCE;
            this.createMonster(
              spawn.type,
              mapId as MapId,
              pos.x,
              pos.y,
              isChamp
            );
            if (isChamp) champions++;
            total++;
          }
        }
      }
    }
    console.log(
      `[WorldRoom] spawned ${total} monsters (${champions} champions)`
    );
  }

  /** Drop a handful of treasure chests on each biome map. */
  private spawnAllChests() {
    let total = 0;
    for (const mapId of ["forest", "desert", "mountain", "lake"] as MapId[]) {
      const pair = this.maps[mapId];
      if (!pair) continue;
      const allowed: TileType[] = ["path", "grass", "sand", "stone", "plaza"];
      for (let i = 0; i < CHEST.PER_MAP; i++) {
        const pos = this.findSpawnTile(pair.data, allowed);
        if (!pos) continue;
        const id = `l${++this.lootIdSeq}`;
        const loot = new LootState();
        loot.id = id;
        loot.mapId = mapId;
        loot.x = pos.x;
        loot.y = pos.y;
        loot.kind = "chest";
        loot.amount = 1;
        this.state.loots.set(id, loot);
        // Chests never auto-despawn — leave the lootDespawn map empty for them.
        total++;
      }
    }
    console.log(`[WorldRoom] spawned ${total} chests`);
  }

  /** Scatter a few buff shrines across each biome map. */
  private spawnAllShrines() {
    const KINDS: ShrineKind[] = [
      "damage",
      "speed",
      "defense",
      "regen",
      "mana",
    ];
    let total = 0;
    let shrineIdSeq = 0;
    for (const mapId of ["forest", "desert", "mountain", "lake"] as MapId[]) {
      const pair = this.maps[mapId];
      if (!pair) continue;
      const allowed: TileType[] = ["path", "grass", "sand", "stone", "plaza"];
      for (let i = 0; i < SHRINE.PER_MAP; i++) {
        const pos = this.findSpawnTile(pair.data, allowed);
        if (!pos) continue;
        const id = `s${++shrineIdSeq}`;
        const s = new ShrineState();
        s.id = id;
        s.mapId = mapId;
        s.x = pos.x;
        s.y = pos.y;
        s.kind = KINDS[Math.floor(Math.random() * KINDS.length)];
        this.state.shrines.set(id, s);
        total++;
      }
    }
    console.log(`[WorldRoom] spawned ${total} shrines`);
  }

  /** Place exactly one waypoint per map at a fixed, predictable spot. */
  private spawnAllWaypoints() {
    let seq = 0;
    const ALL_MAPS: MapId[] = ["town", "forest", "desert", "mountain", "lake"];
    for (const mapId of ALL_MAPS) {
      const pair = this.maps[mapId];
      if (!pair) continue;
      const m = pair.data;
      // Town waypoint near the plaza fountain; biome waypoints near the
      // south arrival portal so you land next to one when you first arrive.
      let wx: number;
      let wy: number;
      if (mapId === "town") {
        wx = m.cols * 0.5 * m.tileSize + 60;
        wy = m.rows * 0.5 * m.tileSize + 6;
      } else {
        // South-side, slightly offset from the path so it doesn't block it
        wx = m.cols * 0.5 * m.tileSize - 50;
        wy = (m.rows * 0.5 + 16) * m.tileSize;
      }
      // Snap to a walkable tile near the target
      const fallback = this.findNearbyTile(m, wx, wy, 60, [
        "path",
        "grass",
        "sand",
        "stone",
        "plaza",
      ]);
      const pos = fallback ?? { x: wx, y: wy };
      const w = new WaypointState();
      w.id = `wp-${mapId}`;
      w.mapId = mapId;
      w.x = pos.x;
      w.y = pos.y;
      this.state.waypoints.set(w.id, w);
      seq++;
    }
    console.log(`[WorldRoom] spawned ${seq} waypoints`);
  }

  private handleUseWaypoint(sessionId: string, to?: string) {
    if (!to) return;
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    // Must be standing on a waypoint in their current map
    let onWaypoint = false;
    this.state.waypoints.forEach((w) => {
      if (onWaypoint) return;
      if (w.mapId !== p.mapId) return;
      if (
        Math.hypot(w.x - p.x, w.y - p.y) <=
        WAYPOINT.ACTIVATE_RADIUS + PLAYER_RADIUS
      ) {
        onWaypoint = true;
      }
    });
    if (!onWaypoint) return;
    // Must have discovered the destination map
    const discovered = (p.discoveredMaps || "town").split(",");
    if (!discovered.includes(to)) return;
    // Teleport to that map's waypoint position
    const target = this.state.waypoints.get(`wp-${to}`);
    if (!target) return;
    p.mapId = to;
    p.x = target.x;
    p.y = target.y + 8; // a hair south so you don't immediately re-trigger
    this.broadcast("fx:waypoint", {
      sessionId,
      to,
    } satisfies FxWaypointPayload);
  }

  private findSpawnTile(
    map: MapData,
    allowed?: readonly string[]
  ): { x: number; y: number } | null {
    const TS = map.tileSize;
    for (let attempt = 0; attempt < 80; attempt++) {
      const tx = Math.floor(Math.random() * map.cols);
      const ty = Math.floor(Math.random() * map.rows);
      const t = map.tiles[ty]?.[tx];
      if (!t) continue;
      if (allowed && !allowed.includes(t)) continue;
      return {
        x: (tx + 0.5) * TS,
        y: (ty + 0.5) * TS,
      };
    }
    return null;
  }

  /** Find a walkable tile near (cx, cy) for pack-style spawn clustering. */
  private findNearbyTile(
    map: MapData,
    cx: number,
    cy: number,
    maxRadius: number,
    allowed?: readonly string[]
  ): { x: number; y: number } | null {
    const TS = map.tileSize;
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      // Sqrt for uniform area distribution
      const r = Math.sqrt(Math.random()) * maxRadius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      const tx = Math.floor(x / TS);
      const ty = Math.floor(y / TS);
      const t = map.tiles[ty]?.[tx];
      if (!t) continue;
      if (allowed && !allowed.includes(t)) continue;
      return { x, y };
    }
    return null;
  }

  private createMonster(
    type: MonsterType,
    mapId: MapId,
    x: number,
    y: number,
    champion: boolean = false,
    boss: boolean = false,
    bossTitle?: string
  ) {
    const def = MONSTER_DEFS[type];
    const id = `m${++this.monsterIdSeq}`;
    const state = new MonsterState();
    state.id = id;
    state.mtype = type;
    state.mapId = mapId;
    state.x = x;
    state.y = y;
    let maxHp = def.maxHp;
    if (boss) maxHp = Math.round(def.maxHp * BOSS.HP_MULT);
    else if (champion) maxHp = Math.round(def.maxHp * CHAMPION.HP_MULT);
    state.hp = maxHp;
    state.maxHp = maxHp;
    state.dir = "down";
    state.champion = champion;
    state.boss = boss;
    if (boss) {
      state.title = bossTitle || `${def.displayName} Lord`;
    } else if (champion) {
      const prefix =
        CHAMPION.PREFIXES[
          Math.floor(Math.random() * CHAMPION.PREFIXES.length)
        ];
      state.title = `${prefix} ${def.displayName}`;
    }

    this.state.monsters.set(id, state);
    this.monsters.set(id, {
      state,
      type,
      homeX: x,
      homeY: y,
      targetX: x,
      targetY: y,
      waitMs: Math.random() * MONSTER_WAIT_MAX_MS,
      nextAttackAt: 0,
      aggroSession: "",
      slowedUntil: 0,
    });
  }

  private pickWanderTarget(rt: MonsterRuntime) {
    const def = MONSTER_DEFS[rt.type];
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * def.wanderRange;
    rt.targetX = rt.homeX + Math.cos(angle) * dist;
    rt.targetY = rt.homeY + Math.sin(angle) * dist;
  }

  private tickMonsters(dtSec: number) {
    const dtMs = dtSec * 1000;
    const now = Date.now();

    this.monsters.forEach((rt) => {
      const def = MONSTER_DEFS[rt.type];
      const s = rt.state;
      const pair = this.maps[s.mapId as MapId];
      if (!pair) return;
      const speedMul =
        now < rt.slowedUntil ? SPELLS.FROST_NOVA_SLOW_FACTOR : 1;
      const effSpeed = def.speed * speedMul;

      // Acquire / drop aggro target
      let target: PlayerState | null = null;
      let targetSession = "";
      // Bosses get extended aggro reach.
      const effAggro = s.boss
        ? Math.max(def.aggroRange, 60) + BOSS.AGGRO_BONUS
        : def.aggroRange;
      if (effAggro > 0) {
        // First, see if our previous target is still valid
        if (rt.aggroSession) {
          const prev = this.state.players.get(rt.aggroSession);
          if (
            prev &&
            prev.alive &&
            prev.mapId === s.mapId &&
            Math.hypot(prev.x - s.x, prev.y - s.y) <
              effAggro * AGGRO_DROP_MULTIPLIER
          ) {
            target = prev;
            targetSession = rt.aggroSession;
          } else {
            rt.aggroSession = "";
          }
        }
        // Otherwise scan for a new target
        if (!target) {
          let bestD = effAggro;
          this.state.players.forEach((p, sid) => {
            if (!p.alive) return;
            if (p.mapId !== s.mapId) return;
            const d = Math.hypot(p.x - s.x, p.y - s.y);
            if (d < bestD) {
              bestD = d;
              target = p;
              targetSession = sid;
            }
          });
          if (target) rt.aggroSession = targetSession;
        }
      }

      if (target) {
        // Chase / attack
        const tp = target as PlayerState;
        const dx = tp.x - s.x;
        const dy = tp.y - s.y;
        const dist = Math.hypot(dx, dy);

        if (Math.abs(dx) > Math.abs(dy)) s.dir = dx > 0 ? "right" : "left";
        else s.dir = dy > 0 ? "down" : "up";

        if (dist < COMBAT.MONSTER_ATTACK_RANGE + PLAYER_RADIUS + def.radius) {
          s.moving = false;
          if (now >= rt.nextAttackAt) {
            rt.nextAttackAt = now + COMBAT.MONSTER_ATTACK_COOLDOWN_MS;
            const dmg = s.boss
              ? Math.round(def.damage * BOSS.DMG_MULT)
              : s.champion
                ? Math.round(def.damage * CHAMPION.DMG_MULT)
                : def.damage;
            this.applyDamageToPlayer(tp, targetSession, dmg);
          }
        } else {
          const step = Math.min(dist, effSpeed * dtSec);
          const nx = s.x + (dx / dist) * step;
          const ny = s.y + (dy / dist) * step;
          const stand = { blockedTiles: MONSTER_BLOCKED_TILES[rt.type] };
          if (canStandAt(pair.data, pair.grid, nx, s.y, def.radius, stand))
            s.x = nx;
          if (canStandAt(pair.data, pair.grid, s.x, ny, def.radius, stand))
            s.y = ny;
          s.moving = true;
        }
        return;
      }

      // ── Wander ────────────────────────────────────────────────
      if (rt.waitMs > 0) {
        rt.waitMs -= dtMs;
        s.moving = false;
        return;
      }

      const dx = rt.targetX - s.x;
      const dy = rt.targetY - s.y;
      const dist = Math.hypot(dx, dy);

      if (dist < MONSTER_ARRIVE_DIST) {
        rt.waitMs =
          MONSTER_WAIT_MIN_MS +
          Math.random() * (MONSTER_WAIT_MAX_MS - MONSTER_WAIT_MIN_MS);
        this.pickWanderTarget(rt);
        s.moving = false;
        return;
      }

      const step = Math.min(dist, effSpeed * dtSec);
      const nx = s.x + (dx / dist) * step;
      const ny = s.y + (dy / dist) * step;
      const stand = { blockedTiles: MONSTER_BLOCKED_TILES[rt.type] };
      if (canStandAt(pair.data, pair.grid, nx, s.y, def.radius, stand)) s.x = nx;
      if (canStandAt(pair.data, pair.grid, s.x, ny, def.radius, stand)) s.y = ny;

      s.moving = true;
      if (Math.abs(dx) > Math.abs(dy)) s.dir = dx > 0 ? "right" : "left";
      else s.dir = dy > 0 ? "down" : "up";
    });
  }

  /* ─────────────────────────────────────────────────────────────── */
  /* Combat                                                          */
  /* ─────────────────────────────────────────────────────────────── */

  private handleAttack(sessionId: string) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    const now = Date.now();
    const cd = this.playerAttackCd.get(sessionId) ?? 0;
    if (now < cd) return;
    this.playerAttackCd.set(sessionId, now + COMBAT.ATTACK_COOLDOWN_MS);
    p.attackUntil = now + COMBAT.ATTACK_SWING_MS;

    // D2 hack-n-slash: auto-target NEAREST monster in any direction within reach.
    type Hit = { id: string; m: MonsterState; dist: number };
    let best: Hit | null = null;
    const reach = COMBAT.ATTACK_RANGE;
    this.state.monsters.forEach((m, id) => {
      if (m.mapId !== p.mapId) return;
      if (m.hp <= 0) return;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > reach) return;
      if (!best || d < best.dist) best = { id, m, dist: d };
    });

    if (!best) return;
    const hit = best as Hit;

    // Face the target so swing FX points the right way
    const fdx = hit.m.x - p.x;
    const fdy = hit.m.y - p.y;
    if (Math.abs(fdx) > Math.abs(fdy)) p.dir = fdx > 0 ? "right" : "left";
    else p.dir = fdy > 0 ? "down" : "up";

    const crit = Math.random() < LOOT.CRIT_CHANCE;
    const baseDmg =
      (playerDamage(p.level, p.statStr) + equipBonus(p).damage) *
      (buffActive(p, "damage") ? SHRINE.DAMAGE_MULT : 1);
    const dmg = baseDmg * (crit ? LOOT.CRIT_MULT : 1);
    hit.m.hp = Math.max(0, hit.m.hp - dmg);
    const fatal = hit.m.hp <= 0;

    this.broadcast("fx:hit", {
      x: hit.m.x,
      y: hit.m.y - 14,
      dmg,
      target: "monster",
      targetId: hit.id,
      fatal,
      crit,
    } satisfies FxHitPayload);

    if (fatal) {
      this.killMonster(hit.id, sessionId);
    }
  }

  private handleHeal(sessionId: string) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    if (p.potions <= 0) return;
    if (p.hp >= p.maxHp) return;
    p.potions -= 1;
    const heal = Math.ceil(p.maxHp * LOOT.POTION_HEAL_FRAC);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    this.broadcast("fx:heal", {
      sessionId,
      amount: heal,
      x: p.x,
      y: p.y - 18,
    });
  }

  private applyDamageToPlayer(
    player: PlayerState,
    sessionId: string,
    dmg: number
  ) {
    const now = Date.now();
    const iframe = this.playerIFrames.get(sessionId) ?? 0;
    if (now < iframe) return;
    this.playerIFrames.set(sessionId, now + COMBAT.PLAYER_IFRAMES_MS);

    const adjusted = buffActive(player, "defense")
      ? dmg * SHRINE.DEFENSE_INCOMING_MULT
      : dmg;
    player.hp = Math.max(0, player.hp - adjusted);
    const fatal = player.hp <= 0;

    this.broadcast("fx:hit", {
      x: player.x,
      y: player.y - 18,
      dmg,
      target: "player",
      targetId: sessionId,
      fatal,
    } satisfies FxHitPayload);

    if (fatal) {
      player.alive = false;
      player.moving = false;
      this.respawnQueue.push({
        sessionId,
        at: now + COMBAT.RESPAWN_DELAY_MS,
      });
      // Drop aggro on this player from all monsters
      this.monsters.forEach((rt) => {
        if (rt.aggroSession === sessionId) rt.aggroSession = "";
      });
    }
  }

  private killMonster(id: string, killerSession: string) {
    const rt = this.monsters.get(id);
    if (!rt) return;
    const type = rt.type;
    const mapId = rt.state.mapId as MapId;
    const def = MONSTER_DEFS[type];
    const dropX = rt.state.x;
    const dropY = rt.state.y;

    // Drop aggro everywhere
    this.monsters.forEach((other) => {
      if (other.aggroSession && other.state.id === id) other.aggroSession = "";
    });

    const wasChampion = rt.state.champion;
    const wasBoss = rt.state.boss;
    const bossTitle = rt.state.title;

    this.state.monsters.delete(id);
    this.monsters.delete(id);

    // Schedule respawn — bosses take much longer and re-spawn as bosses.
    this.respawnQueue.push({
      sessionId: "",
      monsterType: type,
      monsterMap: mapId,
      monsterBoss: wasBoss,
      monsterBossTitle: wasBoss ? bossTitle : undefined,
      at: Date.now() + (wasBoss ? BOSS.RESPAWN_MS : COMBAT.MONSTER_RESPAWN_MS),
    });

    const expMult = wasBoss
      ? BOSS.EXP_MULT
      : wasChampion
        ? CHAMPION.EXP_MULT
        : 1;
    const goldMult = wasBoss
      ? BOSS.GOLD_MULT
      : wasChampion
        ? CHAMPION.GOLD_MULT
        : 1;

    // Grant EXP directly to killer (loot is rendered on the ground)
    const killer = this.state.players.get(killerSession);
    if (killer) {
      killer.exp += def.expReward * expMult;
      this.checkLevelUp(killer, killerSession);
      this.advanceQuests(killer, killerSession, type, mapId, wasBoss);
    }

    // Boss kill: announce to everyone + guaranteed rare drop
    if (wasBoss) {
      this.broadcast("fx:boss-slain", {
        title: bossTitle,
        killerName: killer?.name ?? "an adventurer",
      });
      const itemId = rollItemId(def.level + 5);
      if (itemId) {
        this.spawnItemLoot(mapId, dropX, dropY, itemId, "rare");
      }
    }

    // ── Drop loot on the ground ─────────────────────────────────
    const drops = wasBoss ? 8 : wasChampion ? 3 : 1;
    for (let i = 0; i < drops; i++) {
      const jitterX = (Math.random() - 0.5) * 30;
      const jitterY = (Math.random() - 0.5) * 22;
      const itemChance =
        INVENTORY.ITEM_DROP_CHANCE *
        (wasChampion ? INVENTORY.CHAMPION_DROP_MULT : 1);
      const roll = Math.random();
      if (roll < itemChance) {
        const itemId = rollItemId(def.level);
        if (itemId) {
          const rarity = rollRarity();
          this.spawnItemLoot(mapId, dropX + jitterX, dropY + jitterY, itemId, rarity);
          continue;
        }
      }
      if (Math.random() < LOOT.POTION_DROP_CHANCE) {
        this.spawnLoot(mapId, dropX + jitterX, dropY + jitterY, "potion", 1);
      } else {
        const baseGold = Math.max(
          1,
          Math.round(def.goldReward * goldMult * (0.8 + Math.random() * 1.0))
        );
        this.spawnLoot(mapId, dropX + jitterX, dropY + jitterY, "gold", baseGold);
      }
    }
  }

  /* ── Inventory ──────────────────────────────────────────────────── */

  private spawnItemLoot(
    mapId: MapId,
    x: number,
    y: number,
    itemId: string,
    rarity: ItemRarity
  ) {
    const id = `l${++this.lootIdSeq}`;
    const loot = new LootState();
    loot.id = id;
    loot.mapId = mapId;
    loot.x = x + (Math.random() - 0.5) * 14;
    loot.y = y + (Math.random() - 0.5) * 10;
    loot.kind = "item";
    loot.amount = 1;
    loot.itemId = itemId;
    loot.rarity = rarity;
    this.state.loots.set(id, loot);
    this.lootDespawn.set(id, Date.now() + LOOT.TTL_MS);
  }

  private handleEquip(sessionId: string, itemInstId: string) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    const idx = p.inventory.findIndex((it) => it.id === itemInstId);
    if (idx < 0) return;
    const inst = p.inventory[idx];
    const def = (ITEMS as Record<string, ItemDef>)[inst.itemId];
    if (!def) return;
    const slot = def.slot;
    const prev = p.equipment.get(slot);
    // Remove from bag first.
    p.inventory.splice(idx, 1);
    // Swap with currently equipped (if any).
    if (prev) p.inventory.push(prev);
    p.equipment.set(slot, inst);
    recomputeDerived(p);
  }

  private handleUnequip(sessionId: string, slot: ItemSlot) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    const prev = p.equipment.get(slot);
    if (!prev) return;
    if (p.inventory.length >= INVENTORY.MAX_SLOTS) return; // bag full
    p.equipment.delete(slot);
    p.inventory.push(prev);
    recomputeDerived(p);
  }

  private handleDropItem(sessionId: string, itemInstId: string) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    const idx = p.inventory.findIndex((it) => it.id === itemInstId);
    if (idx < 0) return;
    const inst = p.inventory[idx];
    p.inventory.splice(idx, 1);
    // Drop it on the ground next to the player.
    const jx = (Math.random() - 0.5) * 24;
    const jy = (Math.random() - 0.5) * 20;
    this.spawnItemLoot(
      p.mapId as MapId,
      p.x + jx,
      p.y + jy + 4,
      inst.itemId,
      inst.rarity as ItemRarity
    );
  }

  /* ── Quests ─────────────────────────────────────────────────────── */

  private advanceQuests(
    killer: PlayerState,
    sessionId: string,
    monsterType: MonsterType,
    mapId: MapId,
    wasBoss: boolean
  ) {
    const completedSet = new Set(
      (killer.questCompleted || "").split(",").filter(Boolean)
    );
    for (const q of QUESTS) {
      if (completedSet.has(q.id)) continue;
      if (!questMatches(q, monsterType, mapId, wasBoss)) continue;
      const prev = killer.questProgress.get(q.id) ?? 0;
      const next = Math.min(q.targetCount, prev + 1);
      killer.questProgress.set(q.id, next);
      if (next >= q.targetCount) {
        completedSet.add(q.id);
        killer.questCompleted = Array.from(completedSet).join(",");
        killer.gold += q.rewardGold;
        killer.exp += q.rewardExp;
        this.checkLevelUp(killer, sessionId);
        this.broadcast("fx:quest-complete", {
          sessionId,
          questId: q.id,
          title: q.title,
          rewardGold: q.rewardGold,
          rewardExp: q.rewardExp,
        } satisfies FxQuestCompletePayload);
      }
    }
  }

  /* ── Vendor ─────────────────────────────────────────────────────── */

  private handleBuyPotion(sessionId: string) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    // Must be in town to buy
    if (p.mapId !== "town") return;
    if (p.gold < VENDOR.POTION_PRICE) return;
    if (p.potions >= LOOT.MAX_POTIONS) return;
    p.gold -= VENDOR.POTION_PRICE;
    p.potions += 1;
  }

  private handleSellItem(sessionId: string, itemInstId: string) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    if (p.mapId !== "town") return;
    if (!itemInstId) return;
    const idx = p.inventory.findIndex((it) => it.id === itemInstId);
    if (idx < 0) return;
    const inst = p.inventory[idx];
    const price = sellPriceFor(inst.itemId, inst.rarity as ItemRarity);
    p.inventory.splice(idx, 1);
    p.gold += price;
  }

  /* ── Spells ──────────────────────────────────────────────────────── */

  private handleCast(sessionId: string) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    const now = Date.now();
    const cd = this.playerCastCd.get(sessionId) ?? 0;
    if (now < cd) return;
    if (p.mp < SPELLS.FIRE_BOLT_COST) return;

    // Find nearest monster in range first — if nobody, don't waste mana
    type Hit = { id: string; m: MonsterState; dist: number };
    let best: Hit | null = null;
    const reach = SPELLS.FIRE_BOLT_RANGE;
    this.state.monsters.forEach((m, id) => {
      if (m.mapId !== p.mapId) return;
      if (m.hp <= 0) return;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > reach) return;
      if (!best || d < best.dist) best = { id, m, dist: d };
    });
    if (!best) return;
    const hit = best as Hit;

    this.playerCastCd.set(sessionId, now + SPELLS.FIRE_BOLT_COOLDOWN_MS);
    p.mp -= SPELLS.FIRE_BOLT_COST;
    p.castUntil = now + SPELLS.FIRE_BOLT_SWING_MS;

    // Face the target
    const fdx = hit.m.x - p.x;
    const fdy = hit.m.y - p.y;
    if (Math.abs(fdx) > Math.abs(fdy)) p.dir = fdx > 0 ? "right" : "left";
    else p.dir = fdy > 0 ? "down" : "up";

    const crit = Math.random() < LOOT.CRIT_CHANCE;
    const dmg = Math.round(
      (playerDamage(p.level, p.statStr) + equipBonus(p).damage) *
        (buffActive(p, "damage") ? SHRINE.DAMAGE_MULT : 1) *
        SPELLS.FIRE_BOLT_DMG_MULT *
        (crit ? LOOT.CRIT_MULT : 1)
    );
    hit.m.hp = Math.max(0, hit.m.hp - dmg);
    const fatal = hit.m.hp <= 0;

    this.broadcast("fx:cast", {
      fromX: p.x,
      fromY: p.y - 14,
      toX: hit.m.x,
      toY: hit.m.y - 12,
      spell: "firebolt",
    } satisfies FxCastPayload);

    this.broadcast("fx:hit", {
      x: hit.m.x,
      y: hit.m.y - 14,
      dmg,
      target: "monster",
      targetId: hit.id,
      fatal,
      crit,
    } satisfies FxHitPayload);

    if (fatal) this.killMonster(hit.id, sessionId);
  }

  private handleNova(sessionId: string) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    const now = Date.now();
    const cd = this.playerCastCd.get(sessionId) ?? 0;
    if (now < cd) return;
    if (p.mp < SPELLS.FROST_NOVA_COST) return;

    // Find all monsters in radius
    interface NHit {
      id: string;
      m: MonsterState;
      rt: MonsterRuntime;
    }
    const hits: NHit[] = [];
    const r = SPELLS.FROST_NOVA_RADIUS;
    this.monsters.forEach((rt, id) => {
      const m = rt.state;
      if (m.mapId !== p.mapId) return;
      if (m.hp <= 0) return;
      if (Math.hypot(m.x - p.x, m.y - p.y) > r) return;
      hits.push({ id, m, rt });
    });
    if (hits.length === 0) return; // don't waste mana with no targets

    this.playerCastCd.set(sessionId, now + SPELLS.FROST_NOVA_COOLDOWN_MS);
    p.mp -= SPELLS.FROST_NOVA_COST;
    p.castUntil = now + 280;

    const baseDmg =
      (playerDamage(p.level, p.statStr) + equipBonus(p).damage) *
      (buffActive(p, "damage") ? SHRINE.DAMAGE_MULT : 1);
    const broadcastHits: FxNovaPayload["hits"] = [];

    for (const h of hits) {
      const crit = Math.random() < LOOT.CRIT_CHANCE;
      const dmg = Math.round(
        baseDmg * SPELLS.FROST_NOVA_DMG_MULT * (crit ? LOOT.CRIT_MULT : 1)
      );
      h.m.hp = Math.max(0, h.m.hp - dmg);
      h.rt.slowedUntil = now + SPELLS.FROST_NOVA_SLOW_MS;
      const fatal = h.m.hp <= 0;
      broadcastHits.push({ id: h.id, dmg, fatal, crit });
    }

    this.broadcast("fx:nova", {
      x: p.x,
      y: p.y - 10,
      radius: r,
      hits: broadcastHits,
    } satisfies FxNovaPayload);

    // Process fatalities after broadcast so client sees the ring before death
    for (const h of broadcastHits) {
      if (h.fatal) this.killMonster(h.id, sessionId);
    }
  }

  /* ── Teleport ───────────────────────────────────────────────────── */

  private handleTeleport(sessionId: string, tx?: number, ty?: number) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    if (typeof tx !== "number" || typeof ty !== "number") return;
    const now = Date.now();
    const cd = this.playerCastCd.get(sessionId) ?? 0;
    if (now < cd) return;
    if (p.mp < SPELLS.TELEPORT_COST) return;

    const pair = this.maps[p.mapId as MapId];
    if (!pair) return;

    // Clamp the requested target to TELEPORT_RANGE from the player.
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    const clamp =
      dist > SPELLS.TELEPORT_RANGE ? SPELLS.TELEPORT_RANGE / dist : 1;
    let targetX = p.x + dx * clamp;
    let targetY = p.y + dy * clamp;

    // Walk back along the line until we find a walkable spot.
    let landedX = targetX;
    let landedY = targetY;
    let stepBack = 0;
    while (
      !canStandAt(pair.data, pair.grid, landedX, landedY, PLAYER_RADIUS) &&
      stepBack < 12
    ) {
      stepBack++;
      const t = 1 - stepBack / 12;
      landedX = p.x + (targetX - p.x) * t;
      landedY = p.y + (targetY - p.y) * t;
    }
    if (!canStandAt(pair.data, pair.grid, landedX, landedY, PLAYER_RADIUS)) {
      return; // nothing valid — abort, no mana spent
    }

    p.mp -= SPELLS.TELEPORT_COST;
    this.playerCastCd.set(sessionId, now + SPELLS.TELEPORT_COOLDOWN_MS);
    p.castUntil = now + 180;

    const fromX = p.x;
    const fromY = p.y;
    p.x = landedX;
    p.y = landedY;

    this.broadcast("fx:teleport", {
      sessionId,
      fromX,
      fromY,
      toX: landedX,
      toY: landedY,
    } satisfies FxTeleportPayload);
  }

  /* ── Meteor ─────────────────────────────────────────────────────── */

  private handleMeteor(sessionId: string, tx?: number, ty?: number) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    if (typeof tx !== "number" || typeof ty !== "number") return;
    const now = Date.now();
    const cd = this.playerCastCd.get(sessionId) ?? 0;
    if (now < cd) return;
    if (p.mp < SPELLS.METEOR_COST) return;

    // Clamp the impact point to METEOR_RANGE from the caster.
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    const clamp =
      dist > SPELLS.METEOR_RANGE ? SPELLS.METEOR_RANGE / dist : 1;
    const ix = p.x + dx * clamp;
    const iy = p.y + dy * clamp;

    p.mp -= SPELLS.METEOR_COST;
    this.playerCastCd.set(sessionId, now + SPELLS.METEOR_COOLDOWN_MS);
    p.castUntil = now + 240;

    const mapId = p.mapId;
    // Warning telegraph
    this.broadcast("fx:meteor-warning", {
      mapId,
      x: ix,
      y: iy,
      radius: SPELLS.METEOR_RADIUS,
      delayMs: SPELLS.METEOR_DELAY_MS,
    } satisfies FxMeteorWarningPayload);

    // Impact after a short delay
    this.clock.setTimeout(() => {
      this.applyMeteorImpact(ix, iy, mapId, sessionId);
    }, SPELLS.METEOR_DELAY_MS);
  }

  private applyMeteorImpact(
    x: number,
    y: number,
    mapId: string,
    casterSession: string
  ) {
    const caster = this.state.players.get(casterSession);
    if (!caster) return;
    const baseDmg =
      (playerDamage(caster.level, caster.statStr) +
        equipBonus(caster).damage) *
      (buffActive(caster, "damage") ? SHRINE.DAMAGE_MULT : 1);
    const r = SPELLS.METEOR_RADIUS;
    const r2 = r * r;

    const hits: FxMeteorImpactPayload["hits"] = [];
    this.state.monsters.forEach((m, id) => {
      if (m.mapId !== mapId) return;
      if (m.hp <= 0) return;
      const dx2 = m.x - x;
      const dy2 = m.y - y;
      if (dx2 * dx2 + dy2 * dy2 > r2) return;
      const crit = Math.random() < LOOT.CRIT_CHANCE;
      const dmg = Math.round(
        baseDmg * SPELLS.METEOR_DMG_MULT * (crit ? LOOT.CRIT_MULT : 1)
      );
      m.hp = Math.max(0, m.hp - dmg);
      const fatal = m.hp <= 0;
      hits.push({ id, dmg, fatal, crit });
    });

    this.broadcast("fx:meteor-impact", {
      mapId,
      x,
      y,
      radius: r,
      hits,
    } satisfies FxMeteorImpactPayload);

    for (const h of hits) {
      if (h.fatal) this.killMonster(h.id, casterSession);
    }
  }

  /* ── Stat allocation ─────────────────────────────────────────────── */

  private handleAllocate(sessionId: string, stat?: StatKey) {
    const p = this.state.players.get(sessionId);
    if (!p || !p.alive) return;
    if (p.statPoints <= 0) return;
    if (stat !== "vit" && stat !== "mnd" && stat !== "str" && stat !== "qck")
      return;

    p.statPoints -= 1;
    if (stat === "vit") p.statVit += 1;
    else if (stat === "mnd") p.statMnd += 1;
    else if (stat === "str") p.statStr += 1;
    else if (stat === "qck") p.statQck += 1;
    // Recompute maxes (vit/mnd shift them; str/qck don't but it's cheap).
    const prevMaxHp = p.maxHp;
    const prevMaxMp = p.maxMp;
    recomputeDerived(p);
    if (stat === "vit") p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - prevMaxHp));
    if (stat === "mnd") p.mp = Math.min(p.maxMp, p.mp + (p.maxMp - prevMaxMp));
  }

  private spawnLoot(
    mapId: MapId,
    x: number,
    y: number,
    kind: LootKind,
    amount: number
  ) {
    const id = `l${++this.lootIdSeq}`;
    const loot = new LootState();
    loot.id = id;
    loot.mapId = mapId;
    // Scatter a few pixels for visual variety
    loot.x = x + (Math.random() - 0.5) * 14;
    loot.y = y + (Math.random() - 0.5) * 10;
    loot.kind = kind;
    loot.amount = amount;
    this.state.loots.set(id, loot);
    this.lootDespawn.set(id, Date.now() + LOOT.TTL_MS);
  }

  private tryActivateShrine(p: PlayerState, sessionId: string) {
    if (!p.alive) return;
    let activated: string | null = null;
    this.state.shrines.forEach((s, id) => {
      if (activated) return;
      if (s.mapId !== p.mapId) return;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d > SHRINE.PICKUP_RADIUS + PLAYER_RADIUS) return;
      activated = id;
      p.buffKind = s.kind;
      p.buffEnd = Date.now() + SHRINE.BUFF_DURATION_MS;
      // Insight (mana) and Vitality (regen) restore on activation too.
      if (s.kind === "mana") p.mp = p.maxMp;
      if (s.kind === "regen") p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
      this.broadcast("fx:shrine", {
        sessionId,
        kind: s.kind as ShrineKind,
        x: s.x,
        y: s.y,
      } satisfies FxShrinePayload);
    });
    if (activated) {
      this.state.shrines.delete(activated);
    }
  }

  private tryPickup(p: PlayerState, sessionId: string) {
    if (!p.alive) return;
    let pickedIds: string[] = [];
    this.state.loots.forEach((l, id) => {
      if (l.mapId !== p.mapId) return;
      const d = Math.hypot(l.x - p.x, l.y - p.y);
      const radius =
        l.kind === "chest" ? CHEST.PICKUP_RADIUS : LOOT.PICKUP_RADIUS;
      if (d > radius + PLAYER_RADIUS) return;

      if (l.kind === "potion") {
        if (p.potions >= LOOT.MAX_POTIONS) return; // can't carry more
        p.potions += l.amount;
      } else if (l.kind === "item") {
        if (p.inventory.length >= INVENTORY.MAX_SLOTS) return; // bag full
        const inst = new InventoryItemState();
        inst.id = `i${++this.itemInstIdSeq}`;
        inst.itemId = l.itemId;
        inst.rarity = l.rarity || "common";
        p.inventory.push(inst);
      } else if (l.kind === "chest") {
        this.popChest(l, p);
      } else {
        p.gold += l.amount;
      }
      pickedIds.push(id);
      this.broadcast("fx:pickup", {
        sessionId,
        kind: l.kind as LootKind,
        amount: l.amount,
        x: l.x,
        y: l.y,
      } satisfies FxPickupPayload);
    });
    for (const id of pickedIds) {
      this.state.loots.delete(id);
      this.lootDespawn.delete(id);
    }
  }

  /** A treasure chest pops into a fanned spray of loot piles. */
  private popChest(chest: LootState, p: PlayerState) {
    const mapId = chest.mapId as MapId;
    // Guaranteed gold pile
    const baseGold = Math.round(
      CHEST.GOLD_MIN + Math.random() * (CHEST.GOLD_MAX - CHEST.GOLD_MIN)
    );
    p.gold += baseGold;
    this.broadcast("fx:pickup", {
      sessionId: "",
      kind: "gold" as LootKind,
      amount: baseGold,
      x: chest.x,
      y: chest.y,
    } satisfies FxPickupPayload);
    // Bonus drops fan out around the chest
    const extras =
      CHEST.EXTRA_LOOT_MIN +
      Math.floor(Math.random() * (CHEST.EXTRA_LOOT_MAX - CHEST.EXTRA_LOOT_MIN + 1));
    for (let i = 0; i < extras; i++) {
      const ang = (i / extras) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 28 + Math.random() * 22;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const isItem = Math.random() < CHEST.ITEM_CHANCE;
      if (isItem) {
        const itemId = rollItemId(p.level + 2);
        if (itemId) {
          let rarity = rollRarity();
          if (rarity === "common" && Math.random() < CHEST.RARITY_BIAS_UP) {
            rarity = "magic";
          } else if (
            rarity === "magic" &&
            Math.random() < CHEST.RARITY_BIAS_UP / 2
          ) {
            rarity = "rare";
          }
          this.spawnItemLoot(mapId, chest.x + dx, chest.y + dy, itemId, rarity);
        }
      } else if (Math.random() < 0.5) {
        this.spawnLoot(mapId, chest.x + dx, chest.y + dy, "potion", 1);
      } else {
        this.spawnLoot(
          mapId,
          chest.x + dx,
          chest.y + dy,
          "gold",
          10 + Math.floor(Math.random() * 30)
        );
      }
    }
  }

  private checkLevelUp(p: PlayerState, sessionId: string) {
    while (p.exp >= expToNextLevel(p.level)) {
      p.exp -= expToNextLevel(p.level);
      p.level += 1;
      const b = equipBonus(p);
      p.maxHp = playerMaxHp(p.level, p.statVit) + b.maxHp;
      p.maxMp = playerMaxMp(p.level, p.statMnd) + b.maxMp;
      p.hp = p.maxHp;
      p.mp = p.maxMp; // full refill on level up
      p.statPoints += STATS.POINTS_PER_LEVEL;
      this.broadcast("fx:levelup", {
        sessionId,
        level: p.level,
      } satisfies FxLevelUpPayload);
    }
  }

  /* ─────────────────────────────────────────────────────────────── */
  /* Lifecycle                                                       */
  /* ─────────────────────────────────────────────────────────────── */

  private serializeMaps() {
    const out: Record<string, MapData> = {};
    for (const [id, m] of Object.entries(this.maps)) {
      out[id] = m.data;
    }
    return out;
  }

  onJoin(
    client: Client,
    options: { username?: string; password?: string } = {}
  ) {
    const auth = accountStore.loginOrRegister(
      options.username ?? "",
      options.password ?? ""
    );
    if (!auth.ok) {
      // Send error to the client and close the session.
      const reason =
        auth.reason === "bad_password"
          ? "Wrong password for this name."
          : "Invalid username (2-16 chars, letters/numbers/_/-).";
      client.send("auth-error", { reason });
      client.leave(4001, reason);
      return;
    }
    // Reject duplicate active logins
    let duplicate = false;
    this.state.players.forEach((existing) => {
      if (existing.name.toLowerCase() === auth.username.toLowerCase())
        duplicate = true;
    });
    if (duplicate) {
      client.send("auth-error", {
        reason: "This character is already in the world.",
      });
      client.leave(4002, "duplicate session");
      return;
    }

    const player = this.hydratePlayer(auth.character);
    this.sessionAccount.set(client.sessionId, auth.username);
    this.state.players.set(client.sessionId, player);
    this.inputs.set(client.sessionId, {
      current: { up: false, down: false, left: false, right: false, seq: 0 },
      lastSeq: 0,
    });

    console.log(
      `[WorldRoom] +${player.name} (${client.sessionId}) → ${player.mapId} — ${this.state.players.size} players`
    );
  }

  /** Build a fresh PlayerState from saved character data. */
  private hydratePlayer(c: CharacterData): PlayerState {
    const p = new PlayerState();
    p.name = c.name;
    p.mapId = c.mapId;
    p.x = c.x;
    p.y = c.y;
    p.dir = "down";
    p.hp = c.hp;
    p.maxHp = c.maxHp;
    p.mp = c.mp;
    p.maxMp = c.maxMp;
    p.level = c.level;
    p.exp = c.exp;
    p.gold = c.gold;
    p.potions = c.potions;
    p.statPoints = c.statPoints;
    p.statVit = c.statVit;
    p.statMnd = c.statMnd;
    p.statStr = c.statStr;
    p.statQck = c.statQck;
    p.discoveredMaps = c.discoveredMaps || "town";
    p.questCompleted = c.questCompleted || "";
    p.alive = true;
    // Inventory
    for (const it of c.inventory ?? []) {
      const inst = new InventoryItemState();
      inst.id = it.id;
      inst.itemId = it.itemId;
      inst.rarity = it.rarity;
      p.inventory.push(inst);
      // Bump the item id counter past any saved ids
      const num = parseInt(it.id.replace(/[^0-9]/g, ""), 10);
      if (!Number.isNaN(num) && num > this.itemInstIdSeq)
        this.itemInstIdSeq = num;
    }
    // Equipment
    for (const [slot, it] of Object.entries(c.equipment ?? {})) {
      const inst = new InventoryItemState();
      inst.id = it.id;
      inst.itemId = it.itemId;
      inst.rarity = it.rarity;
      p.equipment.set(slot, inst);
    }
    // Quest progress
    for (const [qid, n] of Object.entries(c.questProgress ?? {})) {
      p.questProgress.set(qid, n);
    }
    return p;
  }

  /** Serialize a live PlayerState to a CharacterData snapshot. */
  private serializePlayer(p: PlayerState): CharacterData {
    const inv: InventoryItemData[] = [];
    p.inventory.forEach((it) =>
      inv.push({ id: it.id, itemId: it.itemId, rarity: it.rarity })
    );
    const eq: Record<string, InventoryItemData> = {};
    p.equipment.forEach((it, slot) => {
      eq[slot] = { id: it.id, itemId: it.itemId, rarity: it.rarity };
    });
    const qp: Record<string, number> = {};
    p.questProgress.forEach((n, k) => {
      qp[k] = n;
    });
    return {
      name: p.name,
      mapId: p.mapId,
      x: p.x,
      y: p.y,
      hp: p.hp,
      maxHp: p.maxHp,
      mp: p.mp,
      maxMp: p.maxMp,
      level: p.level,
      exp: p.exp,
      gold: p.gold,
      potions: p.potions,
      statPoints: p.statPoints,
      statVit: p.statVit,
      statMnd: p.statMnd,
      statStr: p.statStr,
      statQck: p.statQck,
      discoveredMaps: p.discoveredMaps,
      questCompleted: p.questCompleted,
      questProgress: qp,
      inventory: inv,
      equipment: eq,
    };
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    const username = this.sessionAccount.get(client.sessionId);
    // Persist on disconnect so progress isn't lost.
    if (p && username) {
      accountStore.saveCharacter(username, this.serializePlayer(p));
    }
    this.sessionAccount.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.portalCooldown.delete(client.sessionId);
    this.playerAttackCd.delete(client.sessionId);
    this.playerCastCd.delete(client.sessionId);
    this.playerIFrames.delete(client.sessionId);
    // Drop monster aggro
    this.monsters.forEach((rt) => {
      if (rt.aggroSession === client.sessionId) rt.aggroSession = "";
    });
    console.log(
      `[WorldRoom] -${p?.name ?? "?"} — ${this.state.players.size} players`
    );
  }

  /** Snapshot every connected player to disk. Called on a 30s timer. */
  private autosaveAll() {
    this.state.players.forEach((p, sid) => {
      const username = this.sessionAccount.get(sid);
      if (!username) return;
      accountStore.saveCharacter(username, this.serializePlayer(p));
    });
  }

  onDispose() {
    if (this.saveTicker) clearInterval(this.saveTicker);
    this.autosaveAll();
    accountStore.flushNow();
    console.log("[WorldRoom] disposed");
  }

  private tryMove(
    p: PlayerState,
    dx: number,
    dy: number,
    map: MapData,
    grid: ObstacleGrid
  ) {
    if (dx !== 0) {
      const nx = p.x + dx;
      if (canStandAt(map, grid, nx, p.y, PLAYER_RADIUS)) p.x = nx;
    }
    if (dy !== 0) {
      const ny = p.y + dy;
      if (canStandAt(map, grid, p.x, ny, PLAYER_RADIUS)) p.y = ny;
    }
  }

  /* ─────────────────────────────────────────────────────────────── */
  /* Main tick                                                       */
  /* ─────────────────────────────────────────────────────────────── */

  tick(dt: number) {
    const dtSec = dt / 1000;
    const now = Date.now();

    // Resolve any respawns whose timer is up
    if (this.respawnQueue.length > 0) {
      const remaining: RespawnTask[] = [];
      for (const r of this.respawnQueue) {
        if (now < r.at) {
          remaining.push(r);
          continue;
        }
        if (r.sessionId) {
          const p = this.state.players.get(r.sessionId);
          if (p) {
            p.alive = true;
            p.hp = p.maxHp;
            p.mapId = "town";
            const town = this.maps.town.data;
            p.x = town.spawn.x + (Math.random() - 0.5) * 30;
            p.y = town.spawn.y;
          }
        } else if (r.monsterType && r.monsterMap) {
          const pair = this.maps[r.monsterMap];
          if (pair) {
            const spawn = MAP_MONSTER_SPAWNS[r.monsterMap].find(
              (s) => s.type === r.monsterType
            );
            const pos = this.findSpawnTile(pair.data, spawn?.allowedTiles);
            if (pos) {
              if (r.monsterBoss) {
                this.createMonster(
                  r.monsterType,
                  r.monsterMap,
                  pos.x,
                  pos.y,
                  false,
                  true,
                  r.monsterBossTitle
                );
              } else {
                const isChamp = Math.random() < CHAMPION.CHANCE;
                this.createMonster(
                  r.monsterType,
                  r.monsterMap,
                  pos.x,
                  pos.y,
                  isChamp
                );
              }
            }
          }
        }
      }
      this.respawnQueue = remaining;
    }

    this.tickMonsters(dtSec);

    // Despawn old loot
    if (this.lootDespawn.size > 0) {
      this.lootDespawn.forEach((expireAt, id) => {
        if (now >= expireAt) {
          this.state.loots.delete(id);
          this.lootDespawn.delete(id);
        }
      });
    }

    const manaRegenStep = SPELLS.MANA_REGEN * dtSec;
    this.state.players.forEach((p, sessionId) => {
      if (!p.alive) {
        p.moving = false;
        return;
      }
      // Mana regen (Insight shrine boosts the rate)
      if (p.mp < p.maxMp) {
        const step =
          manaRegenStep * (buffActive(p, "mana") ? SHRINE.MANA_REGEN_MULT : 1);
        p.mp = Math.min(p.maxMp, p.mp + step);
      }
      // Vitality shrine: passive HP regen while buff is active
      if (buffActive(p, "regen") && p.hp < p.maxHp) {
        p.hp = Math.min(
          p.maxHp,
          p.hp + p.maxHp * SHRINE.REGEN_FRAC_PER_SEC * dtSec
        );
      }
      // Expire stale buff
      if (p.buffKind && Date.now() >= p.buffEnd) {
        p.buffKind = "";
        p.buffEnd = 0;
      }
      const buf = this.inputs.get(sessionId);
      if (!buf) return;
      const mapPair = this.maps[p.mapId as MapId];
      if (!mapPair) return;

      const i = buf.current;
      let dx = 0;
      let dy = 0;
      if (i.left) dx -= 1;
      if (i.right) dx += 1;
      if (i.up) dy -= 1;
      if (i.down) dy += 1;

      if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.sqrt(2);
        dx *= inv;
        dy *= inv;
      }

      p.moving = dx !== 0 || dy !== 0;

      const stepSpeed =
        Math.max(40, playerSpeed(p.statQck) + equipBonus(p).speed) *
        (buffActive(p, "speed") ? SHRINE.SPEED_MULT : 1) *
        dtSec;
      if (p.moving) {
        this.tryMove(
          p,
          dx * stepSpeed,
          dy * stepSpeed,
          mapPair.data,
          mapPair.grid
        );

        if (Math.abs(dx) > Math.abs(dy)) {
          p.dir = dx > 0 ? "right" : "left";
        } else {
          p.dir = dy > 0 ? "down" : "up";
        }
      }

      // Loot pickup (walk over to grab)
      this.tryPickup(p, sessionId);
      this.tryActivateShrine(p, sessionId);

      // Portal check
      const cd = this.portalCooldown.get(sessionId) ?? 0;
      if (now >= cd) {
        const portal = getPortalAt(mapPair.data, p.x, p.y, PLAYER_RADIUS);
        if (portal) {
          console.log(
            `[WorldRoom] ${p.name}: ${p.mapId} → ${portal.toMap}`
          );
          p.mapId = portal.toMap;
          p.x = portal.toX;
          p.y = portal.toY;
          // Unlock waypoint discovery for the destination map
          const discovered = new Set(
            (p.discoveredMaps || "town").split(",").filter(Boolean)
          );
          discovered.add(portal.toMap);
          p.discoveredMaps = Array.from(discovered).join(",");
          this.portalCooldown.set(sessionId, now + PORTAL_COOLDOWN_MS);
        }
      }
    });
  }

}
