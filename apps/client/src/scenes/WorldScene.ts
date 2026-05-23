import Phaser from "phaser";
import { getStateCallbacks, type Room } from "colyseus.js";
import { joinWorld, type JoinMode } from "../net/room.js";
import {
  InputMessage,
  AttackMessage,
  AllocateMessage,
  CastMessage,
  FxHitPayload,
  FxLevelUpPayload,
  FxPickupPayload,
  FxCastPayload,
  FxNovaPayload,
  FxTeleportPayload,
  FxMeteorWarningPayload,
  FxMeteorImpactPayload,
  FxShrinePayload,
  SHRINE,
  SHRINE_LABEL,
  SHRINE_COLOR,
  WAYPOINT,
  type ShrineKind,
  type FxWaypointPayload,
  QUESTS,
  type FxQuestCompletePayload,
  COMBAT,
  SPELLS,
  PLAYER,
  WORLD,
  TILE_COLORS,
  MAP_LABELS,
  MONSTER_DEFS,
  expToNextLevel,
  playerDamage,
  playerSpeed,
  type LootKind,
  type MapData,
  type MapId,
  type MonsterType,
  type StatKey,
} from "@pr/shared";
import { Joystick } from "../ui/Joystick.js";
import { AttackButton } from "../ui/AttackButton.js";
import { PotionButton } from "../ui/PotionButton.js";
import { SpellButton } from "../ui/SpellButton.js";
import { NovaButton } from "../ui/NovaButton.js";
import { CharacterPanel } from "../ui/CharacterPanel.js";
import { InventoryPanel, type InventoryItemView, type EquipmentView } from "../ui/InventoryPanel.js";
import { VendorPanel, type VendorItemView } from "../ui/VendorPanel.js";
import { WaypointPanel } from "../ui/WaypointPanel.js";
import { MiniMap } from "../ui/MiniMap.js";
import { QuestPanel, type QuestStatus } from "../ui/QuestPanel.js";
import { TeleportButton } from "../ui/TeleportButton.js";
import { MeteorButton } from "../ui/MeteorButton.js";
import type { ItemSlot } from "@pr/shared";

const JOYSTICK_DEAD_ZONE = 0.2;

interface RemoteSprite {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
  mapId: MapId;
  prevHp: number;
  prevAttackUntil: number;
  swing?: Phaser.GameObjects.Graphics;
}

interface MonsterSprite {
  sprite: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  title?: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
  mapId: MapId;
  type: MonsterType;
  champion: boolean;
  boss: boolean;
}

interface LootSprite {
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Graphics;
  mapId: MapId;
  kind: LootKind;
}

export class WorldScene extends Phaser.Scene {
  private room?: Room;
  private mySessionId = "";
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private healKey?: Phaser.Input.Keyboard.Key;
  private eKey?: Phaser.Input.Keyboard.Key;
  private fKey?: Phaser.Input.Keyboard.Key;
  private cKey?: Phaser.Input.Keyboard.Key;
  private iKey?: Phaser.Input.Keyboard.Key;
  private key1?: Phaser.Input.Keyboard.Key;
  private key2?: Phaser.Input.Keyboard.Key;
  private key3?: Phaser.Input.Keyboard.Key;
  private shiftKey?: Phaser.Input.Keyboard.Key;
  private joystick!: Joystick;
  private attackBtn!: AttackButton;
  private potionBtn!: PotionButton;
  private spellBtn!: SpellButton;
  private novaBtn!: NovaButton;
  private teleportBtn!: TeleportButton;
  private meteorBtn!: MeteorButton;
  private characterPanel!: CharacterPanel;
  private inventoryPanel!: InventoryPanel;
  private vendorPanel!: VendorPanel;
  private vendorBtn?: HTMLButtonElement;
  private waypointPanel!: WaypointPanel;
  private waypointBtn?: HTMLButtonElement;
  private miniMap!: MiniMap;
  private questPanel!: QuestPanel;
  private questBtn?: HTMLButtonElement;
  private waypoints = new Map<
    string,
    {
      sprite: Phaser.GameObjects.Image;
      glow: Phaser.GameObjects.Graphics;
      mapId: MapId;
    }
  >();
  private statBtn?: HTMLButtonElement;
  private sprites = new Map<string, RemoteSprite>();
  private monsters = new Map<string, MonsterSprite>();
  private loots = new Map<string, LootSprite>();
  private shrines = new Map<
    string,
    {
      sprite: Phaser.GameObjects.Image;
      glow: Phaser.GameObjects.Graphics;
      mapId: MapId;
    }
  >();
  private seq = 0;
  /** When the local input loop may next send "attack" / "cast". */
  private nextAttackAt = 0;
  private nextCastAt = 0;
  private nextNovaAt = 0;
  private nextTeleportAt = 0;
  private nextMeteorAt = 0;
  /** Vignette overlay following the camera. */
  private vignette?: Phaser.GameObjects.Image;

  // ── D2-style HUD orbs (DOM)
  private hudHpOrb?: HTMLDivElement;
  private hudHpFillOrb?: HTMLDivElement;
  private hudHpText?: HTMLSpanElement;
  private buffEl?: HTMLDivElement;
  private hurtEl?: HTMLDivElement;
  private hurtFadeAt = 0;
  private hudMpOrb?: HTMLDivElement;
  private hudMpFillOrb?: HTMLDivElement;
  private hudMpText?: HTMLSpanElement;
  private hudCenter?: HTMLDivElement;

  // HUD elements (DOM)
  private hud = document.getElementById("hud") as HTMLDivElement;
  private hudStats?: HTMLDivElement;
  private hudExpFill?: HTMLDivElement;
  private hudLabel?: HTMLDivElement;
  private deathOverlay?: HTMLDivElement;

  private maps: Record<MapId, MapData> | null = null;
  private currentMap: MapId | null = null;
  private mapContainer?: Phaser.GameObjects.Container;
  private mapTransitionUntil = 0;

  // Set by MenuScene via scene.start("world", data)
  private mode: JoinMode = "quick";
  private roomId?: string;
  private username: string = "";
  private password: string = "";

  constructor() {
    super("world");
  }

  init(data?: {
    mode?: JoinMode;
    roomId?: string;
    username?: string;
    password?: string;
  }) {
    this.mode = data?.mode ?? "quick";
    this.roomId = data?.roomId;
    this.username = data?.username ?? "";
    this.password = data?.password ?? "";
  }

  async create() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        up: this.input.keyboard.addKey("W"),
        down: this.input.keyboard.addKey("S"),
        left: this.input.keyboard.addKey("A"),
        right: this.input.keyboard.addKey("D"),
      };
      this.spaceKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
      );
      this.healKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.Q
      );
      this.healKey.on("down", () => this.sendHeal());
      this.eKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.E
      );
      this.fKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.F
      );
      this.cKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.C
      );
      this.cKey.on("down", () => this.toggleCharacterPanel());
      this.iKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
      this.iKey.on("down", () => this.inventoryPanel?.toggle());

      // T → Teleport, M → Meteor (one-shot, not held)
      this.input.keyboard
        .addKey(Phaser.Input.Keyboard.KeyCodes.T)
        .on("down", () => this.castTeleport());
      this.input.keyboard
        .addKey(Phaser.Input.Keyboard.KeyCodes.M)
        .on("down", () => this.castMeteor());
      this.input.keyboard
        .addKey(Phaser.Input.Keyboard.KeyCodes.J)
        .on("down", () => this.questPanel?.toggle());

      // Number hotkeys — quick alternatives that don't need finger gymnastics
      this.key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
      this.key1.on("down", () => this.sendHeal());
      this.key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      this.key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);

      this.shiftKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SHIFT
      );
    }

    // Mouse: left click = attack, right click = Fire Bolt,
    // shift + right click (or middle click) = Frost Nova.
    // Right-click context menu is disabled so it never interrupts play.
    this.input.mouse?.disableContextMenu();

    this.joystick = new Joystick();
    this.attackBtn = new AttackButton();
    this.spellBtn = new SpellButton();
    this.novaBtn = new NovaButton();
    this.teleportBtn = new TeleportButton();
    this.teleportBtn.onPress(() => this.castTeleport());
    this.meteorBtn = new MeteorButton();
    this.meteorBtn.onPress(() => this.castMeteor());
    this.potionBtn = new PotionButton();
    this.potionBtn.onPress(() => this.sendHeal());
    this.characterPanel = new CharacterPanel();
    this.characterPanel.onPlus((stat) => this.sendAllocate(stat));
    this.inventoryPanel = new InventoryPanel();
    this.inventoryPanel.onEquip((id) =>
      this.room?.send("equip", { itemId: id })
    );
    this.inventoryPanel.onUnequip((slot: ItemSlot) =>
      this.room?.send("unequip", { slot })
    );
    this.inventoryPanel.onDrop((id) =>
      this.room?.send("dropItem", { itemId: id })
    );

    this.vendorPanel = new VendorPanel();
    this.vendorPanel.onBuyPotion(() => this.room?.send("buyPotion", {}));
    this.vendorPanel.onSell((id) =>
      this.room?.send("sellItem", { itemId: id })
    );

    this.waypointPanel = new WaypointPanel();
    this.waypointPanel.onTravel((to) =>
      this.room?.send("useWaypoint", { to })
    );

    this.miniMap = new MiniMap();

    // Pain overlay — red radial-gradient vignette that flashes on hit
    const hurt = document.createElement("div");
    Object.assign(hurt.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      background:
        "radial-gradient(ellipse at center," +
        " rgba(255,0,0,0) 40%," +
        " rgba(190,15,15,0.55) 78%," +
        " rgba(120,0,0,0.85) 100%)",
      opacity: "0",
      transition: "opacity 0.45s ease-out",
      mixBlendMode: "screen",
      zIndex: "50",
    } as CSSStyleDeclaration);
    document.body.appendChild(hurt);
    this.hurtEl = hurt;
    this.questPanel = new QuestPanel();

    // Persistent J / quest-log button (always visible)
    const qb = document.createElement("button");
    qb.type = "button";
    qb.textContent = "📜 Quests";
    Object.assign(qb.style, {
      position: "fixed",
      top: "160px",
      right: "10px",
      padding: "6px 12px",
      background:
        "linear-gradient(180deg, rgba(180,83,9,0.92), rgba(120,53,15,0.97))",
      border: "2px solid rgba(251,191,36,0.95)",
      borderRadius: "6px",
      color: "#fde047",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "12px",
      cursor: "pointer",
      zIndex: "22",
      touchAction: "manipulation",
    } as CSSStyleDeclaration);
    qb.addEventListener("click", () => this.questPanel.toggle());
    document.body.appendChild(qb);
    this.questBtn = qb;

    // Persistent on-screen bag button (mobile + desktop)
    const bagBtn = document.createElement("button");
    bagBtn.type = "button";
    bagBtn.textContent = "🎒";
    bagBtn.title = "Inventory (I)";
    Object.assign(bagBtn.style, {
      position: "fixed",
      top: "10px",
      left: "calc(50% + 90px)",
      width: "44px",
      height: "44px",
      background:
        "linear-gradient(180deg, rgba(60,40,20,0.9), rgba(30,18,8,0.95))",
      border: "2px solid rgba(180,120,60,0.9)",
      borderRadius: "8px",
      color: "#fde047",
      fontSize: "22px",
      cursor: "pointer",
      zIndex: "22",
      touchAction: "manipulation",
    } as CSSStyleDeclaration);
    bagBtn.addEventListener("click", () => this.inventoryPanel.toggle());
    document.body.appendChild(bagBtn);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bagBtn.remove());

    // Vignette — subtle corner shading
    this.vignette = this.add
      .image(0, 0, "vignette")
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0.6);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.joystick.destroy();
      this.attackBtn.destroy();
      this.spellBtn.destroy();
      this.novaBtn.destroy();
      this.potionBtn.destroy();
      this.characterPanel.destroy();
      this.inventoryPanel?.destroy();
      this.vendorPanel?.destroy();
      this.vendorBtn?.remove();
      this.waypointPanel?.destroy();
      this.waypointBtn?.remove();
      this.miniMap?.destroy();
      this.questPanel?.destroy();
      this.questBtn?.remove();
      this.teleportBtn?.destroy();
      this.meteorBtn?.destroy();
      this.buffEl?.remove();
      this.hurtEl?.remove();
      this.statBtn?.remove();
      this.tearDownHud();
    });

    this.setupHud();

    this.cameras.main.setBackgroundColor("#0a0a0a");
    this.cameras.main.setRoundPixels(true);

    try {
      if (!this.username || !this.password) {
        // No credentials — return to menu.
        this.scene.start("menu");
        return;
      }
      const { room } = await joinWorld({
        username: this.username,
        password: this.password,
        mode: this.mode,
        roomId: this.roomId,
      });
      this.room = room;
      this.mySessionId = room.sessionId;

      // Auth + duplicate-session errors come back as a custom message,
      // followed by the server closing the socket.
      room.onMessage("auth-error", (msg: { reason: string }) => {
        alert(msg.reason ?? "Login failed.");
      });
      room.onLeave((code) => {
        if (code === 4001 || code === 4002) {
          this.scene.start("menu");
        }
      });

      if (this.mode === "create") {
        this.showRoomCode(room.roomId);
      }

      room.send("requestMaps");
      room.onMessage("maps", (msg: Record<MapId, MapData>) => {
        this.maps = msg;
        const players = (room.state as any)?.players;
        const myPlayer = players?.get?.(this.mySessionId);
        if (myPlayer && myPlayer.mapId) {
          this.switchToMap(myPlayer.mapId as MapId);
        }
      });

      room.onMessage("fx:hit", (msg: FxHitPayload) => this.showHitFx(msg));
      room.onMessage("fx:levelup", (msg: FxLevelUpPayload) =>
        this.showLevelUpFx(msg)
      );
      room.onMessage("fx:pickup", (msg: FxPickupPayload) =>
        this.showPickupFx(msg)
      );
      room.onMessage(
        "fx:heal",
        (msg: { sessionId: string; amount: number; x: number; y: number }) =>
          this.showHealFx(msg)
      );
      room.onMessage("fx:cast", (msg: FxCastPayload) => this.showCastFx(msg));
      room.onMessage("fx:nova", (msg: FxNovaPayload) => this.showNovaFx(msg));
      room.onMessage("fx:shrine", (msg: FxShrinePayload) =>
        this.showShrineActivateFx(msg)
      );
      room.onMessage("fx:waypoint", (_msg: FxWaypointPayload) => {
        this.cameras.main.flash(180, 132, 208, 255);
      });
      room.onMessage("fx:quest-complete", (msg: FxQuestCompletePayload) =>
        this.showQuestCompleteFx(msg)
      );
      room.onMessage("fx:teleport", (msg: FxTeleportPayload) =>
        this.showTeleportFx(msg)
      );
      room.onMessage("fx:meteor-warning", (msg: FxMeteorWarningPayload) =>
        this.showMeteorWarningFx(msg)
      );
      room.onMessage("fx:meteor-impact", (msg: FxMeteorImpactPayload) =>
        this.showMeteorImpactFx(msg)
      );
      room.onMessage(
        "fx:boss-slain",
        (msg: { title: string; killerName: string }) =>
          this.showBossSlainBanner(msg.title, msg.killerName)
      );

      this.bindRoomEvents(room);
    } catch (err) {
      console.error(err);
      this.showConnectionError((err as Error).message);
    }

    this.time.addEvent({
      delay: 1000 / 30,
      loop: true,
      callback: () => this.sendInput(),
    });
  }

  /* ──────────────────────────────────────────────────────────────── */
  /* HUD (DOM)                                                        */
  /* ──────────────────────────────────────────────────────────────── */

  private setupHud() {
    if (!this.hud) return;
    this.hud.innerHTML = "";
    Object.assign(this.hud.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "15",
      color: "#fff",
      fontFamily: "monospace",
      fontSize: "12px",
      pointerEvents: "none",
    } as CSSStyleDeclaration);

    /* Build a Diablo-style orb. */
    const buildOrb = (
      side: "left" | "right",
      fillColor: string,
      rimColor: string
    ) => {
      const orb = document.createElement("div");
      Object.assign(orb.style, {
        position: "fixed",
        bottom: "10px",
        [side]: "10px",
        width: "84px",
        height: "84px",
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 32% 28%, #4a3a30 0%, #1a0e08 60%, #050302 100%)",
        border: `3px solid ${rimColor}`,
        boxShadow:
          `inset 0 0 8px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.6)`,
        overflow: "hidden",
        pointerEvents: "none",
      } as CSSStyleDeclaration);

      // Fill div fills from the bottom up
      const fill = document.createElement("div");
      Object.assign(fill.style, {
        position: "absolute",
        left: "0",
        right: "0",
        bottom: "0",
        height: "100%",
        background: fillColor,
        transition: "height 0.15s ease",
        boxShadow: "inset 0 -10px 20px rgba(0,0,0,0.4)",
      } as CSSStyleDeclaration);
      // Specular highlight on top
      const shine = document.createElement("div");
      Object.assign(shine.style, {
        position: "absolute",
        top: "8%",
        left: "20%",
        width: "40%",
        height: "20%",
        borderRadius: "50%",
        background:
          "radial-gradient(ellipse, rgba(255,255,255,0.45), rgba(255,255,255,0) 70%)",
        pointerEvents: "none",
      } as CSSStyleDeclaration);
      const text = document.createElement("span");
      Object.assign(text.style, {
        position: "absolute",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "monospace",
        fontWeight: "bold",
        fontSize: "13px",
        textShadow: "0 1px 3px #000, 0 0 4px #000",
        pointerEvents: "none",
      } as CSSStyleDeclaration);
      orb.appendChild(fill);
      orb.appendChild(shine);
      orb.appendChild(text);
      return { orb, fill, text };
    };

    const hpOrb = buildOrb(
      "left",
      "linear-gradient(180deg, #b91c1c 0%, #7f1d1d 60%, #450a0a 100%)",
      "rgba(220,38,38,0.7)"
    );
    const mpOrb = buildOrb(
      "right",
      "linear-gradient(180deg, #2563eb 0%, #1e3a8a 60%, #0c1e4e 100%)",
      "rgba(96,165,250,0.7)"
    );
    this.hudHpOrb = hpOrb.orb;
    this.hudHpFillOrb = hpOrb.fill;
    this.hudHpText = hpOrb.text;
    this.hudMpOrb = mpOrb.orb;
    this.hudMpFillOrb = mpOrb.fill;
    this.hudMpText = mpOrb.text;

    /* Center: Lv / EXP bar / Gold / Map name — sits between the two orbs at the bottom */
    this.hudCenter = document.createElement("div");
    Object.assign(this.hudCenter.style, {
      position: "fixed",
      bottom: "14px",
      left: "108px",
      right: "108px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "4px",
      pointerEvents: "none",
    } as CSSStyleDeclaration);

    this.hudLabel = document.createElement("div");
    Object.assign(this.hudLabel.style, {
      background: "rgba(0,0,0,0.6)",
      padding: "3px 12px",
      borderRadius: "4px",
      border: "1px solid rgba(255,255,255,0.15)",
      fontSize: "11px",
      letterSpacing: "1px",
    } as CSSStyleDeclaration);
    this.hudLabel.textContent = "connecting…";

    const expBarWrap = document.createElement("div");
    Object.assign(expBarWrap.style, {
      position: "relative",
      width: "min(220px, 60vw)",
      height: "8px",
      background: "rgba(0,0,0,0.6)",
      borderRadius: "4px",
      border: "1px solid rgba(255,255,255,0.15)",
      overflow: "hidden",
    } as CSSStyleDeclaration);
    const expFill = document.createElement("div");
    Object.assign(expFill.style, {
      position: "absolute",
      left: "0",
      top: "0",
      bottom: "0",
      width: "0%",
      background: "linear-gradient(90deg, #facc15, #fde047)",
      transition: "width 0.2s ease",
    } as CSSStyleDeclaration);
    expBarWrap.appendChild(expFill);
    this.hudExpFill = expFill;

    this.hudStats = document.createElement("div");
    Object.assign(this.hudStats.style, {
      background: "rgba(0,0,0,0.5)",
      padding: "3px 10px",
      borderRadius: "4px",
      fontSize: "11px",
    } as CSSStyleDeclaration);
    const statsLine = document.createElement("div");
    statsLine.id = "stats-line";
    this.hudStats.appendChild(statsLine);

    this.hudCenter.appendChild(this.hudLabel);
    this.hudCenter.appendChild(expBarWrap);
    this.hudCenter.appendChild(this.hudStats);

    document.body.appendChild(this.hudHpOrb);
    document.body.appendChild(this.hudMpOrb);
    document.body.appendChild(this.hudCenter);
  }

  private tearDownHud() {
    if (this.deathOverlay) this.deathOverlay.remove();
    this.deathOverlay = undefined;
    this.hudHpOrb?.remove();
    this.hudMpOrb?.remove();
    this.hudCenter?.remove();
  }

  private updateHud() {
    if (!this.room) return;
    const state = this.room.state as any;
    if (!state || !state.players || typeof state.players.get !== "function") return;
    const me = state.players.get(this.mySessionId);
    if (!me) return;

    if (this.hudLabel) {
      const mapName = this.currentMap ? MAP_LABELS[this.currentMap] : "…";
      const visibleCount = Array.from(this.sprites.values()).filter(
        (s) => s.mapId === this.currentMap
      ).length;
      this.hudLabel.textContent = `${mapName}  ·  players here: ${visibleCount}`;
    }

    // Active shrine buff indicator
    const buffMs = (me.buffEnd ?? 0) - Date.now();
    if (me.buffKind && buffMs > 0) {
      if (!this.buffEl) {
        const el = document.createElement("div");
        Object.assign(el.style, {
          position: "fixed",
          top: "10px",
          left: "10px",
          padding: "6px 12px",
          background: "rgba(0,0,0,0.7)",
          border: "2px solid #fff",
          borderRadius: "6px",
          fontFamily: "monospace",
          fontWeight: "bold",
          fontSize: "12px",
          letterSpacing: "1px",
          pointerEvents: "none",
          zIndex: "23",
          textShadow: "0 1px 2px #000",
        } as CSSStyleDeclaration);
        document.body.appendChild(el);
        this.buffEl = el;
      }
      const kind = me.buffKind as ShrineKind;
      const color = (SHRINE_COLOR as Record<string, string>)[kind] ?? "#fff";
      const label = (SHRINE_LABEL as Record<string, string>)[kind] ?? kind;
      this.buffEl.style.borderColor = color;
      this.buffEl.style.color = color;
      this.buffEl.textContent = `✦ ${label}  ${(buffMs / 1000).toFixed(0)}s`;
    } else if (this.buffEl) {
      this.buffEl.remove();
      this.buffEl = undefined;
    }
    if (this.hudStats) {
      const line = this.hudStats.querySelector("#stats-line") as HTMLDivElement;
      if (line) {
        line.innerHTML =
          `<b>Lv ${me.level}</b>  ` +
          `<span style="color:#fde047">${me.gold}g</span>  ` +
          `<span style="color:#fca5a5">🧪 ${me.potions}</span>`;
      }
    }
    this.potionBtn?.setCount(me.potions);

    // Vendor button — visible only while in town
    const inTown = this.currentMap === "town";
    if (inTown) {
      if (!this.vendorBtn) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "🛒 Shop";
        Object.assign(b.style, {
          position: "fixed",
          top: "60px",
          left: "10px",
          padding: "8px 14px",
          background:
            "linear-gradient(180deg, rgba(180,83,9,0.92), rgba(120,53,15,0.97))",
          border: "2px solid rgba(251,191,36,0.95)",
          borderRadius: "6px",
          color: "#fde047",
          fontFamily: "monospace",
          fontWeight: "bold",
          fontSize: "13px",
          letterSpacing: "1px",
          cursor: "pointer",
          zIndex: "22",
          touchAction: "manipulation",
        } as CSSStyleDeclaration);
        b.addEventListener("click", () => this.openVendor(me));
        document.body.appendChild(b);
        this.vendorBtn = b;
      }
    } else if (this.vendorBtn) {
      this.vendorBtn.remove();
      this.vendorBtn = undefined;
      this.vendorPanel?.hide();
    }

    // Keep vendor balance + sell list fresh while open
    if (this.vendorPanel?.isOpen()) {
      this.vendorPanel.setBalance(me.gold, me.potions);
      const items: VendorItemView[] = [];
      me.inventory?.forEach?.((it: any) =>
        items.push({ id: it.id, itemId: it.itemId, rarity: it.rarity })
      );
      this.vendorPanel.setInventory(items);
    }

    // Waypoint proximity button — shown when standing on a waypoint
    let nearWp = false;
    this.waypoints.forEach((w) => {
      if (w.mapId !== this.currentMap) return;
      const d = Math.hypot(w.sprite.x - me.x, w.sprite.y - me.y);
      if (d <= WAYPOINT.ACTIVATE_RADIUS + 20) nearWp = true;
    });
    if (nearWp) {
      if (!this.waypointBtn) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "✧ WAYPOINT";
        Object.assign(b.style, {
          position: "fixed",
          top: "60px",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 18px",
          background:
            "linear-gradient(180deg, rgba(10,28,45,0.95), rgba(5,15,30,0.97))",
          border: "2px solid #4dd0e1",
          borderRadius: "8px",
          color: "#84ffff",
          fontFamily: "monospace",
          fontWeight: "bold",
          fontSize: "14px",
          letterSpacing: "3px",
          cursor: "pointer",
          zIndex: "23",
          boxShadow: "0 0 18px rgba(77,208,225,0.6)",
          textShadow: "0 0 8px #4dd0e1",
          touchAction: "manipulation",
        } as CSSStyleDeclaration);
        b.addEventListener("click", () => this.tryOpenWaypoint());
        document.body.appendChild(b);
        this.waypointBtn = b;
      }
    } else if (this.waypointBtn) {
      this.waypointBtn.remove();
      this.waypointBtn = undefined;
    }

    // Quest progress
    this.refreshQuestPanel(me);

    // Mini-map draw
    if (this.miniMap && this.currentMap != null) {
      const others: { x: number; y: number }[] = [];
      this.sprites.forEach((s, sid) => {
        if (sid === this.mySessionId) return;
        if (s.mapId !== this.currentMap) return;
        others.push({ x: s.sprite.x, y: s.sprite.y });
      });
      const monsters: {
        x: number;
        y: number;
        champion?: boolean;
        boss?: boolean;
      }[] = [];
      this.monsters.forEach((m) => {
        if (m.mapId !== this.currentMap) return;
        monsters.push({
          x: m.sprite.x,
          y: m.sprite.y,
          champion: m.champion,
          boss: m.boss,
        });
      });
      const loots: {
        x: number;
        y: number;
        kind: string;
        rarity?: string;
      }[] = [];
      const stateLoots = (this.room?.state as any)?.loots;
      if (stateLoots?.forEach) {
        stateLoots.forEach((l: any) => {
          if (l.mapId !== this.currentMap) return;
          loots.push({ x: l.x, y: l.y, kind: l.kind, rarity: l.rarity });
        });
      }
      const shrines: { x: number; y: number; kind: string }[] = [];
      this.shrines.forEach((_s, id) => {
        const sd = (this.room?.state as any)?.shrines?.get?.(id);
        if (!sd) return;
        if (sd.mapId !== this.currentMap) return;
        shrines.push({ x: sd.x, y: sd.y, kind: sd.kind });
      });
      const waypoints: { x: number; y: number }[] = [];
      this.waypoints.forEach((w) => {
        if (w.mapId !== this.currentMap) return;
        waypoints.push({ x: w.sprite.x, y: w.sprite.y });
      });
      this.miniMap.draw({
        selfX: me.x,
        selfY: me.y,
        others,
        monsters,
        loots,
        shrines,
        waypoints,
      });
    }

    // Stat-points badge — only shown when there are unspent points
    if (me.statPoints > 0) {
      if (!this.statBtn) {
        const b = document.createElement("button");
        b.type = "button";
        Object.assign(b.style, {
          position: "fixed",
          top: "100px",
          left: "10px",
          width: "80px",
          padding: "6px 0",
          background:
            "linear-gradient(180deg, rgba(127,29,29,0.92), rgba(60,10,10,0.97))",
          border: "2px solid rgba(248,113,113,0.95)",
          borderRadius: "6px",
          color: "#fde047",
          fontFamily: "monospace",
          fontWeight: "bold",
          fontSize: "12px",
          letterSpacing: "1px",
          cursor: "pointer",
          zIndex: "22",
          boxShadow: "0 0 10px rgba(220,38,38,0.5)",
          animation: "pulse-glow 1.4s infinite alternate",
          touchAction: "manipulation",
        } as CSSStyleDeclaration);
        b.addEventListener("click", () => this.toggleCharacterPanel());
        document.body.appendChild(b);
        // Inject keyframes once
        if (!document.getElementById("pr-pulse-style")) {
          const style = document.createElement("style");
          style.id = "pr-pulse-style";
          style.textContent = `@keyframes pulse-glow {
            from { box-shadow: 0 0 8px rgba(220,38,38,0.4); }
            to   { box-shadow: 0 0 18px rgba(252,165,165,0.85); }
          }`;
          document.head.appendChild(style);
        }
        this.statBtn = b;
      }
      this.statBtn.textContent = `+${me.statPoints} STATS`;
    } else if (this.statBtn) {
      this.statBtn.remove();
      this.statBtn = undefined;
    }

    // HP orb
    if (this.hudHpFillOrb && this.hudHpText) {
      const pct = Math.max(0, (me.hp / me.maxHp) * 100);
      this.hudHpFillOrb.style.height = `${pct}%`;
      this.hudHpText.textContent = `${Math.ceil(me.hp)}/${me.maxHp}`;
    }
    // MP orb
    if (this.hudMpFillOrb && this.hudMpText) {
      const pct = Math.max(0, (me.mp / me.maxMp) * 100);
      this.hudMpFillOrb.style.height = `${pct}%`;
      this.hudMpText.textContent = `${Math.floor(me.mp)}/${me.maxMp}`;
    }
    if (this.hudExpFill) {
      const need = expToNextLevel(me.level);
      const pct = need > 0 ? (me.exp / need) * 100 : 0;
      this.hudExpFill.style.width = `${pct}%`;
    }

    // Death overlay
    if (!me.alive && !this.deathOverlay) {
      this.showDeathOverlay();
    } else if (me.alive && this.deathOverlay) {
      this.deathOverlay.remove();
      this.deathOverlay = undefined;
    }
  }

  private showRoomCode(roomId: string) {
    const card = document.createElement("div");
    Object.assign(card.style, {
      position: "fixed",
      top: "100px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "linear-gradient(180deg, rgba(30,58,138,0.92), rgba(8,20,60,0.95))",
      border: "3px solid rgba(96,165,250,0.95)",
      borderRadius: "10px",
      padding: "12px 22px",
      color: "#fff",
      fontFamily: "monospace",
      textAlign: "center",
      zIndex: "25",
      boxShadow: "0 4px 18px rgba(0,0,0,0.6)",
      pointerEvents: "auto",
      cursor: "pointer",
      userSelect: "all",
    } as CSSStyleDeclaration);
    card.innerHTML = `
      <div style="font-size:10px;letter-spacing:2px;color:#bfdbfe;margin-bottom:4px">
        ROOM CODE — share to play together
      </div>
      <div style="font-size:22px;font-weight:bold;letter-spacing:4px;color:#fde047">
        ${roomId}
      </div>
      <div style="font-size:10px;color:#94a3b8;margin-top:4px">tap to copy · tap card to close</div>
    `;
    card.addEventListener("click", async () => {
      try {
        await navigator.clipboard?.writeText(roomId);
      } catch {
        /* ignore */
      }
      card.style.opacity = "0";
      setTimeout(() => card.remove(), 300);
    });
    setTimeout(() => {
      card.style.transition = "opacity 0.4s ease";
      card.style.opacity = "0";
      setTimeout(() => card.remove(), 500);
    }, 12_000);
    document.body.appendChild(card);
  }

  private showConnectionError(message: string) {
    const err = document.createElement("div");
    Object.assign(err.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.85)",
      color: "#fff",
      fontFamily: "monospace",
      zIndex: "40",
      padding: "20px",
      gap: "16px",
      textAlign: "center",
    } as CSSStyleDeclaration);
    err.innerHTML = `
      <div style="font-size:22px;color:#fca5a5;letter-spacing:3px">CONNECTION FAILED</div>
      <div style="font-size:13px;color:#a8a29e;max-width:400px">${message}</div>
    `;
    const back = document.createElement("button");
    back.textContent = "← BACK TO MENU";
    Object.assign(back.style, {
      padding: "10px 24px",
      background:
        "linear-gradient(180deg, rgba(127,29,29,0.92), rgba(60,10,10,0.97))",
      border: "2px solid rgba(248,113,113,0.95)",
      borderRadius: "6px",
      color: "#fde047",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "14px",
      letterSpacing: "0.2em",
      cursor: "pointer",
    } as CSSStyleDeclaration);
    back.addEventListener("click", () => {
      err.remove();
      this.scene.start("menu");
    });
    err.appendChild(back);
    document.body.appendChild(err);
  }

  private showDeathOverlay() {
    const div = document.createElement("div");
    Object.assign(div.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(127,29,29,0.5)",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "monospace",
      fontSize: "32px",
      zIndex: "30",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    div.innerHTML = `
      <div style="text-shadow:0 2px 6px #000">YOU DIED</div>
      <div style="font-size:14px;margin-top:8px;opacity:0.9">Respawning in town…</div>
    `;
    document.body.appendChild(div);
    this.deathOverlay = div;
  }

  /* ──────────────────────────────────────────────────────────────── */
  /* Map rendering                                                    */
  /* ──────────────────────────────────────────────────────────────── */

  private switchToMap(mapId: MapId) {
    if (!this.maps || this.currentMap === mapId) return;
    this.currentMap = mapId;
    const map = this.maps[mapId];
    if (!map) return;

    if (this.mapContainer) {
      this.mapContainer.destroy(true);
    }
    this.mapContainer = this.add.container(0, 0);
    this.mapContainer.setDepth(0);

    const TS = map.tileSize;
    const g = this.add.graphics();
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const t = map.tiles[y][x];
        if (t === null) continue;
        const { base, accent } = TILE_COLORS[t];
        g.fillStyle(base, 1);
        g.fillRect(x * TS, y * TS, TS, TS);
        g.fillStyle(accent, 1);
        g.fillRect(x * TS, y * TS, TS / 2, TS / 2);
        g.fillRect(x * TS + TS / 2, y * TS + TS / 2, TS / 2, TS / 2);
      }
    }
    g.setDepth(-1000);
    this.mapContainer.add(g);

    for (const d of map.decorations) {
      const key = `deco-${d.type}`;
      const img = this.add.image(d.x, d.y, key);
      img.setOrigin(0.5, 1);
      img.setDepth(d.y);
      this.mapContainer.add(img);
    }

    this.cameras.main.setBounds(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    this.flashMapLabel(MAP_LABELS[mapId]);

    this.sprites.forEach((s) => {
      const visible = s.mapId === this.currentMap;
      s.sprite.setVisible(visible);
      s.label.setVisible(visible);
    });
    this.monsters.forEach((m) => {
      const visible = m.mapId === this.currentMap;
      m.sprite.setVisible(visible);
      m.hpBg.setVisible(false);
      m.hpFill.setVisible(false);
      if (m.title) m.title.setVisible(visible);
    });
    this.loots.forEach((l) => {
      const visible = l.mapId === this.currentMap;
      l.sprite.setVisible(visible);
      l.glow.setVisible(visible);
    });
    this.shrines.forEach((s) => {
      const visible = s.mapId === this.currentMap;
      s.sprite.setVisible(visible);
      s.glow.setVisible(visible);
    });
    this.waypoints.forEach((w) => {
      const visible = w.mapId === this.currentMap;
      w.sprite.setVisible(visible);
      w.glow.setVisible(visible);
    });
    if (this.miniMap && this.maps) {
      const m = this.maps[mapId];
      if (m) this.miniMap.setMap(mapId, m);
    }
  }

  private flashMapLabel(text: string) {
    const cam = this.cameras.main;
    const t = this.add
      .text(cam.midPoint.x, cam.midPoint.y - 100, text, {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(99999)
      .setScrollFactor(0);
    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 1500,
      delay: 500,
      onComplete: () => t.destroy(),
    });
  }

  /* ──────────────────────────────────────────────────────────────── */
  /* FX                                                               */
  /* ──────────────────────────────────────────────────────────────── */

  /** Flash a red vignette around the screen edge — intensity scales with
   *  damage relative to my max HP so big hits feel chunky. */
  private flashHurtVignette(dmg: number) {
    if (!this.hurtEl) return;
    const me = (this.room?.state as any)?.players?.get?.(this.mySessionId);
    const maxHp = me?.maxHp ?? 60;
    const ratio = Math.min(1, dmg / Math.max(20, maxHp * 0.35));
    const peak = 0.45 + ratio * 0.55; // 0.45 - 1.0
    // Snap to peak instantly, then fade out smoothly.
    this.hurtEl.style.transition = "none";
    this.hurtEl.style.opacity = String(peak);
    // Force reflow so the next transition kicks in
    void this.hurtEl.offsetHeight;
    this.hurtEl.style.transition = "opacity 0.55s ease-out";
    this.hurtEl.style.opacity = "0";
    this.hurtFadeAt = Date.now() + 550;
  }

  private showHitFx(msg: FxHitPayload) {
    if (this.currentMap == null) return;
    if (msg.target === "monster") {
      const m = this.monsters.get(msg.targetId);
      if (!m || m.mapId !== this.currentMap) return;
      this.flashSprite(m.sprite, 0xff5252);
    } else {
      const s = this.sprites.get(msg.targetId);
      if (!s || s.mapId !== this.currentMap) return;
      this.flashSprite(s.sprite, 0xff5252);
      if (msg.targetId === this.mySessionId) {
        this.shakeCamera();
        this.flashHurtVignette(msg.dmg);
      }
    }
    this.spawnDamageNumber(
      msg.x,
      msg.y,
      msg.dmg,
      msg.target === "player",
      !!msg.crit
    );
  }

  private showPickupFx(msg: FxPickupPayload) {
    if (this.currentMap == null) return;
    const isMine = msg.sessionId === this.mySessionId;
    const color = msg.kind === "gold" ? "#fde047" : "#fca5a5";
    const label =
      msg.kind === "gold" ? `+${msg.amount}g` : `+${msg.amount} 🧪`;
    const t = this.add
      .text(msg.x, msg.y, label, {
        fontFamily: "monospace",
        fontSize: isMine ? "16px" : "13px",
        color,
        stroke: "#000",
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(99999);
    this.tweens.add({
      targets: t,
      y: msg.y - 30,
      alpha: 0,
      duration: 900,
      ease: "Cubic.Out",
      onComplete: () => t.destroy(),
    });
  }

  private showHealFx(msg: {
    sessionId: string;
    amount: number;
    x: number;
    y: number;
  }) {
    const t = this.add
      .text(msg.x, msg.y, `+${msg.amount}`, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#4ade80",
        stroke: "#000",
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(99999);
    this.tweens.add({
      targets: t,
      y: msg.y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => t.destroy(),
    });
  }

  private flashSprite(sprite: Phaser.GameObjects.Image, color: number) {
    sprite.setTint(color);
    this.time.delayedCall(120, () => sprite.clearTint());
  }

  private shakeCamera() {
    this.cameras.main.shake(120, 0.005);
  }

  private spawnDamageNumber(
    x: number,
    y: number,
    dmg: number,
    onSelf: boolean,
    crit: boolean
  ) {
    const label = crit ? `${dmg}!` : String(dmg);
    const t = this.add
      .text(x, y, label, {
        fontFamily: "monospace",
        fontSize: crit ? "22px" : onSelf ? "18px" : "16px",
        color: crit ? "#fb923c" : onSelf ? "#fca5a5" : "#fde047",
        stroke: "#000",
        strokeThickness: crit ? 5 : 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(99999);
    if (crit) {
      t.setScale(0.6);
      this.tweens.add({
        targets: t,
        scale: 1.25,
        duration: 180,
        ease: "Back.Out",
      });
    }
    this.tweens.add({
      targets: t,
      y: y - (crit ? 32 : 24),
      alpha: 0,
      duration: crit ? 900 : 700,
      ease: "Cubic.Out",
      onComplete: () => t.destroy(),
    });
  }

  private showLevelUpFx(msg: FxLevelUpPayload) {
    const s = this.sprites.get(msg.sessionId);
    if (!s || s.mapId !== this.currentMap) return;
    const t = this.add
      .text(s.sprite.x, s.sprite.y - 30, `LEVEL ${msg.level}!`, {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#fde047",
        stroke: "#000",
        strokeThickness: 5,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(99999);
    this.tweens.add({
      targets: t,
      y: t.y - 36,
      alpha: 0,
      duration: 1300,
      onComplete: () => t.destroy(),
    });

    // Big golden ring at feet
    const ring = this.add
      .circle(s.sprite.x, s.sprite.y, 6, 0xfde047, 0.5)
      .setDepth(s.sprite.y - 1)
      .setStrokeStyle(3, 0xfacc15, 1);
    this.tweens.add({
      targets: ring,
      radius: 50,
      alpha: 0,
      duration: 800,
      onComplete: () => ring.destroy(),
    });
  }

  /* ──────────────────────────────────────────────────────────────── */
  /* Networking                                                       */
  /* ──────────────────────────────────────────────────────────────── */

  private bindRoomEvents(room: Room) {
    const $ = getStateCallbacks(room);
    const state = room.state as any;

    $(state).players.onAdd((player: any, sessionId: string) => {
      const isMe = sessionId === this.mySessionId;
      const sprite = this.add.image(
        player.x,
        player.y,
        isMe ? "player-self" : "player-other"
      );
      sprite.setDepth(player.y);

      const label = this.add
        .text(player.x, player.y - 20, player.name, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#e4e4e7",
          stroke: "#000",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(99999);

      const remote: RemoteSprite = {
        sprite,
        label,
        targetX: player.x,
        targetY: player.y,
        mapId: player.mapId as MapId,
        prevHp: player.hp,
        prevAttackUntil: 0,
      };
      this.sprites.set(sessionId, remote);

      const visible = this.currentMap != null && remote.mapId === this.currentMap;
      sprite.setVisible(visible);
      label.setVisible(visible);

      if (isMe) {
        if (this.maps) this.switchToMap(remote.mapId);
        this.cameras.main.centerOn(sprite.x, sprite.y);
        this.cameras.main.startFollow(sprite, true, 0.18, 0.18);
      }

      $(player).onChange(() => {
        const s = this.sprites.get(sessionId);
        if (!s) return;
        const prevMap = s.mapId;
        s.mapId = player.mapId as MapId;
        s.targetX = player.x;
        s.targetY = player.y;

        // Detect new attack
        if (player.attackUntil > s.prevAttackUntil) {
          s.prevAttackUntil = player.attackUntil;
          this.playSwingFx(s, player.dir as string);
        }
        s.prevHp = player.hp;

        // Death dimming
        s.sprite.setAlpha(player.alive ? 1 : 0.4);

        if (sessionId === this.mySessionId && prevMap !== s.mapId) {
          this.mapTransitionUntil = performance.now() + 200;
          s.sprite.x = player.x;
          s.sprite.y = player.y;
          this.switchToMap(s.mapId);
          this.cameras.main.centerOn(s.sprite.x, s.sprite.y);
        }

        const visible = this.currentMap != null && s.mapId === this.currentMap;
        s.sprite.setVisible(visible);
        s.label.setVisible(visible);
      });
    });

    $(state).players.onRemove((_p: any, sessionId: string) => {
      const s = this.sprites.get(sessionId);
      if (s) {
        s.sprite.destroy();
        s.label.destroy();
        s.swing?.destroy();
        this.sprites.delete(sessionId);
      }
    });

    /* ── Monsters ───────────────────────────────────────────────── */
    $(state).monsters.onAdd((m: any, id: string) => {
      const type = m.mtype as MonsterType;
      const def = MONSTER_DEFS[type];
      if (!def) return;
      const sprite = this.add.image(m.x, m.y, `monster-${type}`);
      sprite.setOrigin(0.5, 1);
      sprite.setDepth(m.y);

      const isChamp = !!m.champion;
      const isBoss = !!m.boss;
      if (isBoss) {
        sprite.setScale(2.0);
        sprite.setTint(0xffd54f); // deep gold
      } else if (isChamp) {
        sprite.setScale(1.4);
        sprite.setTint(0xfff176); // gold glow
      }

      const HP_W = isBoss ? 56 : isChamp ? 32 : 22;
      const HP_H = isBoss ? 6 : isChamp ? 4 : 3;
      const hpBg = this.add
        .rectangle(m.x, m.y - def.radius * 2 - 6, HP_W, HP_H, 0x000000, 0.7)
        .setOrigin(0.5, 0.5)
        .setDepth(99998);
      const hpFill = this.add
        .rectangle(
          m.x - HP_W / 2 + 1,
          m.y - def.radius * 2 - 6,
          HP_W - 2,
          HP_H - 1,
          isBoss ? 0xff6b00 : isChamp ? 0xfde047 : 0xef4444,
          1
        )
        .setOrigin(0, 0.5)
        .setDepth(99999);
      hpBg.setVisible(false);
      hpFill.setVisible(false);

      let title: Phaser.GameObjects.Text | undefined;
      if ((isChamp || isBoss) && m.title) {
        title = this.add
          .text(m.x, m.y - def.radius * 2 - 18, m.title, {
            fontFamily: "monospace",
            fontSize: isBoss ? "14px" : "11px",
            color: isBoss ? "#ffb300" : "#fde047",
            stroke: "#000",
            strokeThickness: isBoss ? 4 : 3,
            fontStyle: "bold",
          })
          .setOrigin(0.5, 1)
          .setDepth(99999);
      }

      const ms: MonsterSprite = {
        sprite,
        hpBg,
        hpFill,
        title,
        targetX: m.x,
        targetY: m.y,
        mapId: m.mapId as MapId,
        type,
        champion: isChamp,
        boss: isBoss,
      };
      this.monsters.set(id, ms);

      const visible = this.currentMap != null && ms.mapId === this.currentMap;
      sprite.setVisible(visible);
      if (title) title.setVisible(visible);

      $(m).onChange(() => {
        const x = this.monsters.get(id);
        if (!x) return;
        x.targetX = m.x;
        x.targetY = m.y;
        x.mapId = m.mapId as MapId;
        const vis = this.currentMap != null && x.mapId === this.currentMap;
        x.sprite.setVisible(vis);
        if (x.title) x.title.setVisible(vis);
        const damaged = m.hp < m.maxHp;
        const showHp = vis && damaged && m.hp > 0;
        x.hpBg.setVisible(showHp);
        x.hpFill.setVisible(showHp);
        if (damaged) {
          const ratio = Math.max(0, m.hp / m.maxHp);
          x.hpFill.width = (x.boss ? 54 : x.champion ? 30 : 20) * ratio;
        }
      });
    });

    /* ── Loot ───────────────────────────────────────────────────── */
    if (state.loots) {
      $(state).loots.onAdd((l: any, id: string) => {
        const key =
          l.kind === "gold"
            ? "loot-gold"
            : l.kind === "potion"
              ? "loot-potion"
              : l.kind === "chest"
                ? "loot-chest"
                : "loot-item";
        const sprite = this.add.image(l.x, l.y, key);
        sprite.setOrigin(0.5, 1);
        sprite.setDepth(l.y - 1);
        if (l.kind === "item") {
          // Tint the icon by rarity color so it reads at a glance.
          const tint =
            l.rarity === "rare"
              ? 0xfde047
              : l.rarity === "magic"
                ? 0x60a5fa
                : 0xffffff;
          sprite.setTint(tint);
        }

        // Pulsing glow circle below it
        const glow = this.add.graphics();
        const glowColor =
          l.kind === "gold"
            ? 0xfde047
            : l.kind === "potion"
              ? 0xef4444
              : l.kind === "chest"
                ? 0xffd54f
                : l.rarity === "rare"
                  ? 0xfde047
                  : l.rarity === "magic"
                    ? 0x60a5fa
                    : 0xe2e8f0;
        glow.fillStyle(glowColor, 0.25);
        glow.fillCircle(0, 0, 12);
        glow.setPosition(l.x, l.y);
        glow.setDepth(l.y - 2);
        this.tweens.add({
          targets: glow,
          alpha: 0.7,
          scale: 1.2,
          duration: 700,
          yoyo: true,
          repeat: -1,
        });

        const ls: LootSprite = {
          sprite,
          glow,
          mapId: l.mapId as MapId,
          kind: l.kind as LootKind,
        };
        this.loots.set(id, ls);
        const vis = this.currentMap != null && ls.mapId === this.currentMap;
        sprite.setVisible(vis);
        glow.setVisible(vis);

        // Drop animation
        sprite.y -= 14;
        this.tweens.add({
          targets: sprite,
          y: l.y,
          duration: 280,
          ease: "Bounce.Out",
        });
      });

      $(state).loots.onRemove((_l: any, id: string) => {
        const x = this.loots.get(id);
        if (!x) return;
        x.sprite.destroy();
        x.glow.destroy();
        this.loots.delete(id);
      });
    }

    /* ── Waypoints ─────────────────────────────────────────────── */
    if (state.waypoints) {
      $(state).waypoints.onAdd((w: any, id: string) => {
        const sprite = this.add.image(w.x, w.y, "waypoint");
        sprite.setOrigin(0.5, 1);
        sprite.setDepth(w.y - 1);
        const glow = this.add.graphics().setDepth(w.y - 2);
        glow.fillStyle(0x4dd0e1, 0.3);
        glow.fillCircle(0, 0, 26);
        glow.setPosition(w.x, w.y - 10);
        this.tweens.add({
          targets: glow,
          alpha: 0.7,
          scale: 1.3,
          duration: 1300,
          yoyo: true,
          repeat: -1,
        });
        this.waypoints.set(id, {
          sprite,
          glow,
          mapId: w.mapId as MapId,
        });
        const vis = this.currentMap != null && w.mapId === this.currentMap;
        sprite.setVisible(vis);
        glow.setVisible(vis);
      });
      $(state).waypoints.onRemove((_w: any, id: string) => {
        const x = this.waypoints.get(id);
        if (!x) return;
        x.sprite.destroy();
        x.glow.destroy();
        this.waypoints.delete(id);
      });
    }

    /* ── Shrines ───────────────────────────────────────────────── */
    if (state.shrines) {
      $(state).shrines.onAdd((s: any, id: string) => {
        const tint = parseInt(
          (SHRINE_COLOR as Record<string, string>)[s.kind].slice(1),
          16
        );
        const sprite = this.add.image(s.x, s.y, "shrine");
        sprite.setOrigin(0.5, 1);
        sprite.setDepth(s.y - 1);
        sprite.setTint(tint);
        const glow = this.add.graphics().setDepth(s.y - 2);
        glow.fillStyle(tint, 0.3);
        glow.fillCircle(0, 0, 22);
        glow.setPosition(s.x, s.y - 6);
        this.tweens.add({
          targets: glow,
          alpha: 0.7,
          scale: 1.25,
          duration: 1100,
          yoyo: true,
          repeat: -1,
        });
        this.shrines.set(id, { sprite, glow, mapId: s.mapId as MapId });
        const vis = this.currentMap != null && s.mapId === this.currentMap;
        sprite.setVisible(vis);
        glow.setVisible(vis);
      });
      $(state).shrines.onRemove((_s: any, id: string) => {
        const x = this.shrines.get(id);
        if (!x) return;
        x.sprite.destroy();
        x.glow.destroy();
        this.shrines.delete(id);
      });
    }

    $(state).monsters.onRemove((_m: any, id: string) => {
      const x = this.monsters.get(id);
      if (!x) return;
      // Death poof
      const poof = this.add
        .circle(x.sprite.x, x.sprite.y - 8, 4, 0xffffff, 0.7)
        .setDepth(99999);
      this.tweens.add({
        targets: poof,
        radius: 28,
        alpha: 0,
        duration: 320,
        onComplete: () => poof.destroy(),
      });
      x.sprite.destroy();
      x.hpBg.destroy();
      x.hpFill.destroy();
      x.title?.destroy();
      this.monsters.delete(id);
    });
  }

  /** Visual arc in front of the attacking player. */
  private playSwingFx(remote: RemoteSprite, dir: string) {
    const g = this.add.graphics();
    let ang = 0;
    switch (dir) {
      case "right": ang = 0; break;
      case "down":  ang = Math.PI / 2; break;
      case "left":  ang = Math.PI; break;
      case "up":    ang = -Math.PI / 2; break;
    }
    const span = Math.PI / 2.2;
    const r = COMBAT.ATTACK_RANGE;
    g.fillStyle(0xfff7d6, 0.6);
    g.lineStyle(2, 0xfffac9, 0.95);
    g.beginPath();
    g.moveTo(remote.sprite.x, remote.sprite.y - 12);
    g.arc(remote.sprite.x, remote.sprite.y - 12, r, ang - span / 2, ang + span / 2, false);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.setDepth(remote.sprite.y + 1);
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: COMBAT.ATTACK_SWING_MS,
      onComplete: () => g.destroy(),
    });
  }

  /* ──────────────────────────────────────────────────────────────── */
  /* Input                                                            */
  /* ──────────────────────────────────────────────────────────────── */

  private sendInput() {
    if (!this.room) return;

    let up = !!(this.cursors?.up.isDown || this.wasd?.up.isDown);
    let down = !!(this.cursors?.down.isDown || this.wasd?.down.isDown);
    let left = !!(this.cursors?.left.isDown || this.wasd?.left.isDown);
    let right = !!(this.cursors?.right.isDown || this.wasd?.right.isDown);

    const j = this.joystick.getVector();
    if (j.active && Math.hypot(j.x, j.y) > JOYSTICK_DEAD_ZONE) {
      up = j.y < -JOYSTICK_DEAD_ZONE;
      down = j.y > JOYSTICK_DEAD_ZONE;
      left = j.x < -JOYSTICK_DEAD_ZONE;
      right = j.x > JOYSTICK_DEAD_ZONE;
    }

    const msg: InputMessage = { up, down, left, right, seq: ++this.seq };
    this.room.send("input", msg);
  }

  private sendAttack() {
    if (!this.room) return;
    const msg: AttackMessage = { seq: ++this.seq };
    this.room.send("attack", msg);
  }

  private sendHeal() {
    if (!this.room) return;
    this.room.send("heal", {});
  }

  private sendCast() {
    if (!this.room) return;
    const msg: CastMessage = { seq: ++this.seq, spell: "firebolt" };
    this.room.send("cast", msg);
  }

  private sendNova() {
    if (!this.room) return;
    const msg: CastMessage = { seq: ++this.seq, spell: "frostnova" };
    this.room.send("cast", msg);
  }

  /** Compute a target world position the player wants to aim at. Uses the
   *  mouse cursor for PC and the facing direction (or current movement) for
   *  touch devices. */
  private getAimTarget(maxRange: number): { tx: number; ty: number } {
    const me = this.sprites.get(this.mySessionId);
    const myX = me?.sprite.x ?? 0;
    const myY = me?.sprite.y ?? 0;
    const ptr = this.input.activePointer;
    const isMouse =
      ((ptr.event as PointerEvent | undefined)?.pointerType ?? "mouse") ===
      "mouse";
    let tx = myX;
    let ty = myY;
    if (isMouse && ptr) {
      const wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      tx = wp.x;
      ty = wp.y;
    } else {
      // Touch / no mouse — use facing direction from server state.
      const state = (this.room?.state as any)?.players?.get?.(
        this.mySessionId
      );
      const dir = state?.dir ?? "down";
      const offset = maxRange;
      if (dir === "up") ty = myY - offset;
      else if (dir === "down") ty = myY + offset;
      else if (dir === "left") tx = myX - offset;
      else tx = myX + offset;
    }
    return { tx, ty };
  }

  private castTeleport() {
    if (!this.room) return;
    const now = Date.now();
    if (now < this.nextTeleportAt) return;
    this.nextTeleportAt = now + SPELLS.TELEPORT_COOLDOWN_MS;
    const { tx, ty } = this.getAimTarget(SPELLS.TELEPORT_RANGE);
    this.room.send("teleport", { tx, ty });
  }

  private castMeteor() {
    if (!this.room) return;
    const now = Date.now();
    if (now < this.nextMeteorAt) return;
    this.nextMeteorAt = now + SPELLS.METEOR_COOLDOWN_MS;
    const { tx, ty } = this.getAimTarget(SPELLS.METEOR_RANGE);
    this.room.send("meteor", { tx, ty });
  }

  private sendAllocate(stat: StatKey) {
    if (!this.room) return;
    const msg: AllocateMessage = { stat };
    this.room.send("allocate", msg);
  }

  private toggleCharacterPanel() {
    if (this.characterPanel.isOpen()) this.characterPanel.close();
    else {
      this.refreshCharacterPanel();
      this.characterPanel.open();
    }
  }

  private refreshCharacterPanel() {
    if (!this.room) return;
    const state = this.room.state as any;
    const me = state?.players?.get?.(this.mySessionId);
    if (!me) return;
    this.characterPanel.setView({
      level: me.level,
      statPoints: me.statPoints,
      vit: me.statVit,
      mnd: me.statMnd,
      str: me.statStr,
      qck: me.statQck,
      maxHp: me.maxHp,
      maxMp: me.maxMp,
      damage: playerDamage(me.level, me.statStr),
      speed: Math.round(playerSpeed(me.statQck)),
    });
    this.refreshInventoryPanel(me);
  }

  private showQuestCompleteFx(msg: FxQuestCompletePayload) {
    if (msg.sessionId !== this.mySessionId) return;
    const banner = document.createElement("div");
    banner.innerHTML =
      `<div style='font-size:11px; color:#fff; letter-spacing:3px; margin-bottom:6px'>✦ QUEST COMPLETE ✦</div>` +
      `<div>${msg.title}</div>` +
      `<div style='font-size:11px; color:#fde047; margin-top:6px'>+${msg.rewardGold}g · +${msg.rewardExp} xp</div>`;
    Object.assign(banner.style, {
      position: "fixed",
      top: "30%",
      left: "50%",
      transform: "translate(-50%, -50%) scale(0.6)",
      padding: "14px 28px",
      background:
        "linear-gradient(180deg, rgba(46,80,30,0.95), rgba(20,40,15,0.95))",
      border: "3px solid #84df76",
      borderRadius: "10px",
      color: "#bbf7d0",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "18px",
      letterSpacing: "2px",
      textShadow: "0 0 8px #84df76, 0 2px 4px #000",
      boxShadow: "0 0 30px rgba(132,222,118,0.6), 0 8px 30px rgba(0,0,0,0.6)",
      zIndex: "90",
      pointerEvents: "none",
      opacity: "0",
      transition: "all 0.5s ease",
      textAlign: "center",
    } as CSSStyleDeclaration);
    document.body.appendChild(banner);
    requestAnimationFrame(() => {
      banner.style.opacity = "1";
      banner.style.transform = "translate(-50%, -50%) scale(1)";
    });
    setTimeout(() => {
      banner.style.opacity = "0";
      banner.style.transform = "translate(-50%, -50%) scale(1.2)";
    }, 3000);
    setTimeout(() => banner.remove(), 3700);
  }

  private refreshQuestPanel(me: any) {
    if (!this.questPanel) return;
    const completed = new Set<string>(
      (me.questCompleted || "").split(",").filter(Boolean)
    );
    const statuses: QuestStatus[] = QUESTS.map((q) => ({
      id: q.id,
      progress: me.questProgress?.get?.(q.id) ?? 0,
      done: completed.has(q.id),
    }));
    this.questPanel.setStatuses(statuses);
  }

  private tryOpenWaypoint() {
    if (!this.room || !this.waypointPanel) return;
    const state = this.room.state as any;
    const me = state?.players?.get?.(this.mySessionId);
    if (!me) return;
    const discovered = (me.discoveredMaps || "town").split(",") as MapId[];
    this.waypointPanel.setDiscovered(discovered);
    this.waypointPanel.setCurrent(me.mapId as MapId);
    this.waypointPanel.show();
  }

  private openVendor(me: any) {
    if (!this.vendorPanel) return;
    this.vendorPanel.setBalance(me.gold, me.potions);
    const items: VendorItemView[] = [];
    me.inventory?.forEach?.((it: any) =>
      items.push({ id: it.id, itemId: it.itemId, rarity: it.rarity })
    );
    this.vendorPanel.setInventory(items);
    this.vendorPanel.show();
  }

  private refreshInventoryPanel(me: any) {
    if (!this.inventoryPanel) return;
    const items: InventoryItemView[] = [];
    me.inventory?.forEach?.((it: any) => {
      items.push({ id: it.id, itemId: it.itemId, rarity: it.rarity });
    });
    this.inventoryPanel.setInventory(items);
    const eq: EquipmentView = {};
    me.equipment?.forEach?.((it: any, slot: string) => {
      (eq as any)[slot] = { id: it.id, itemId: it.itemId, rarity: it.rarity };
    });
    this.inventoryPanel.setEquipment(eq);
  }

  private showBossSlainBanner(title: string, killerName: string) {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      position: "fixed",
      top: "30%",
      left: "50%",
      transform: "translate(-50%, -50%) scale(0.6)",
      padding: "16px 30px",
      background:
        "linear-gradient(180deg, rgba(120,30,5,0.95), rgba(50,8,2,0.95))",
      border: "3px solid #ffb300",
      borderRadius: "10px",
      color: "#fde047",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "20px",
      letterSpacing: "2px",
      textShadow: "0 0 8px #f87171, 0 2px 4px #000",
      boxShadow:
        "0 0 30px rgba(255,179,0,0.6), 0 8px 30px rgba(0,0,0,0.6)",
      zIndex: "90",
      pointerEvents: "none",
      opacity: "0",
      transition: "all 0.5s ease",
    } as CSSStyleDeclaration);
    wrap.innerHTML = `<div style="font-size:11px; color:#fff; letter-spacing:3px; margin-bottom:6px">⚔ BOSS DEFEATED ⚔</div><div>${title}</div><div style="font-size:11px; color:#cbd5e1; margin-top:4px">slain by ${killerName}</div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => {
      wrap.style.opacity = "1";
      wrap.style.transform = "translate(-50%, -50%) scale(1)";
    });
    setTimeout(() => {
      wrap.style.opacity = "0";
      wrap.style.transform = "translate(-50%, -50%) scale(1.2)";
    }, 3500);
    setTimeout(() => wrap.remove(), 4200);
  }

  private showShrineActivateFx(msg: FxShrinePayload) {
    if (this.currentMap == null) return;
    const colorHex = (SHRINE_COLOR as Record<string, string>)[msg.kind];
    const tint = parseInt(colorHex.slice(1), 16);
    // Burst at shrine
    const burst = this.add.graphics().setDepth(99998);
    burst.fillStyle(tint, 0.85);
    burst.fillCircle(msg.x, msg.y - 12, 18);
    burst.fillStyle(0xffffff, 0.9);
    burst.fillCircle(msg.x, msg.y - 12, 10);
    this.tweens.add({
      targets: burst,
      alpha: 0,
      scale: 3,
      duration: 600,
      onComplete: () => burst.destroy(),
    });
    // Banner above the player who activated (if it's me, show prominently)
    if (msg.sessionId === this.mySessionId) {
      const label = (SHRINE_LABEL as Record<string, string>)[msg.kind];
      const banner = document.createElement("div");
      banner.textContent = `✦ ${label.toUpperCase()} ✦`;
      Object.assign(banner.style, {
        position: "fixed",
        top: "22%",
        left: "50%",
        transform: "translate(-50%, -50%) scale(0.6)",
        padding: "10px 22px",
        background: "rgba(0,0,0,0.85)",
        border: `2px solid ${colorHex}`,
        borderRadius: "8px",
        color: colorHex,
        fontFamily: "monospace",
        fontWeight: "bold",
        fontSize: "20px",
        letterSpacing: "4px",
        textShadow: `0 0 10px ${colorHex}, 0 2px 4px #000`,
        boxShadow: `0 0 24px ${colorHex}90`,
        zIndex: "85",
        pointerEvents: "none",
        opacity: "0",
        transition: "all 0.4s ease",
      } as CSSStyleDeclaration);
      document.body.appendChild(banner);
      requestAnimationFrame(() => {
        banner.style.opacity = "1";
        banner.style.transform = "translate(-50%, -50%) scale(1)";
      });
      setTimeout(() => {
        banner.style.opacity = "0";
        banner.style.transform = "translate(-50%, -50%) scale(1.3)";
      }, 1800);
      setTimeout(() => banner.remove(), 2400);
    }
  }

  private showTeleportFx(msg: FxTeleportPayload) {
    if (this.currentMap == null) return;
    // Purple burst at the origin
    const origin = this.add.graphics().setDepth(99997);
    origin.fillStyle(0xa855f7, 0.55);
    origin.fillCircle(msg.fromX, msg.fromY, 18);
    origin.fillStyle(0xfbf8ff, 1);
    origin.fillCircle(msg.fromX, msg.fromY, 8);
    this.tweens.add({
      targets: origin,
      alpha: 0,
      scale: 2.4,
      duration: 380,
      onComplete: () => origin.destroy(),
    });
    // Streak between origin and destination
    const streak = this.add.graphics().setDepth(99996);
    streak.lineStyle(4, 0xc4b5fd, 0.85);
    streak.beginPath();
    streak.moveTo(msg.fromX, msg.fromY);
    streak.lineTo(msg.toX, msg.toY);
    streak.strokePath();
    this.tweens.add({
      targets: streak,
      alpha: 0,
      duration: 280,
      onComplete: () => streak.destroy(),
    });
    // Arrival flash at destination
    const arrive = this.add.graphics().setDepth(99997);
    arrive.fillStyle(0xfbf8ff, 1);
    arrive.fillCircle(msg.toX, msg.toY, 10);
    arrive.fillStyle(0xa855f7, 0.55);
    arrive.fillCircle(msg.toX, msg.toY, 22);
    this.tweens.add({
      targets: arrive,
      alpha: 0,
      scale: 1.8,
      duration: 320,
      onComplete: () => arrive.destroy(),
    });
    // Snap the caster sprite to the new position so they don't slide back
    const sp = this.sprites.get(msg.sessionId);
    if (sp) {
      sp.sprite.x = msg.toX;
      sp.sprite.y = msg.toY;
      sp.targetX = msg.toX;
      sp.targetY = msg.toY;
      sp.label.x = msg.toX;
      sp.label.y = msg.toY - 28;
    }
  }

  private showMeteorWarningFx(msg: FxMeteorWarningPayload) {
    if (this.currentMap == null || msg.mapId !== this.currentMap) return;
    const ring = this.add.graphics().setDepth(99996);
    const draw = (a: number, r: number) => {
      ring.clear();
      ring.lineStyle(3, 0xff5722, a);
      ring.strokeCircle(msg.x, msg.y, r);
      ring.fillStyle(0xff5722, a * 0.18);
      ring.fillCircle(msg.x, msg.y, r);
    };
    draw(0.9, msg.radius);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: msg.delayMs,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        const pulse = 0.6 + 0.4 * Math.sin(v * Math.PI * 6);
        draw(0.7 * pulse + 0.3, msg.radius);
      },
      onComplete: () => ring.destroy(),
    });
    // Falling shadow indicator (line from the sky)
    const fall = this.add.graphics().setDepth(99996);
    fall.lineStyle(2, 0xff8a50, 0.5);
    fall.beginPath();
    fall.moveTo(msg.x, msg.y - 400);
    fall.lineTo(msg.x, msg.y);
    fall.strokePath();
    this.tweens.add({
      targets: fall,
      alpha: 0,
      duration: 350,
      onComplete: () => fall.destroy(),
    });
  }

  private showMeteorImpactFx(msg: FxMeteorImpactPayload) {
    if (this.currentMap == null || msg.mapId !== this.currentMap) return;
    // Big explosion
    const boom = this.add.graphics().setDepth(99998);
    boom.fillStyle(0xfff176, 1);
    boom.fillCircle(msg.x, msg.y, msg.radius * 0.4);
    boom.fillStyle(0xff7043, 0.7);
    boom.fillCircle(msg.x, msg.y, msg.radius * 0.75);
    boom.fillStyle(0xc62828, 0.4);
    boom.fillCircle(msg.x, msg.y, msg.radius);
    this.tweens.add({
      targets: boom,
      alpha: 0,
      scale: 1.4,
      duration: 520,
      onComplete: () => boom.destroy(),
    });
    // Camera shake when impact is on my map and within view
    this.cameras.main.shake(220, 0.006);
    // Damage numbers per hit (reuse hit fx by manually iterating)
    for (const h of msg.hits) {
      const mon = this.monsters.get(h.id);
      if (!mon) continue;
      const txt = this.add
        .text(mon.sprite.x, mon.sprite.y - 24, String(h.dmg), {
          fontFamily: "monospace",
          fontSize: h.crit ? "16px" : "13px",
          color: h.crit ? "#fde047" : "#ff8a50",
          stroke: "#000",
          strokeThickness: 3,
          fontStyle: "bold",
        })
        .setOrigin(0.5, 1)
        .setDepth(99999);
      this.tweens.add({
        targets: txt,
        y: txt.y - 28,
        alpha: 0,
        duration: 720,
        onComplete: () => txt.destroy(),
      });
    }
  }

  private showNovaFx(msg: FxNovaPayload) {
    if (this.currentMap == null) return;

    // Expanding cyan ring at the caster's position
    const ring = this.add.graphics().setDepth(99998);
    ring.lineStyle(3, 0x7dd3fc, 1);
    ring.strokeCircle(msg.x, msg.y, 6);
    const fillRing = this.add.graphics().setDepth(99997);
    fillRing.fillStyle(0xbae6fd, 0.3);
    fillRing.fillCircle(msg.x, msg.y, 6);
    this.tweens.add({
      targets: [ring, fillRing],
      alpha: { from: 1, to: 0 },
      duration: 420,
      onUpdate: (tween) => {
        const t = tween.progress;
        const r = 6 + (msg.radius - 6) * t;
        ring.clear();
        ring.lineStyle(3, 0x7dd3fc, 1 - t);
        ring.strokeCircle(msg.x, msg.y, r);
        fillRing.clear();
        fillRing.fillStyle(0xbae6fd, 0.3 * (1 - t));
        fillRing.fillCircle(msg.x, msg.y, r);
      },
      onComplete: () => {
        ring.destroy();
        fillRing.destroy();
      },
    });

    // Apply hit FX to each victim
    for (const h of msg.hits) {
      const m = this.monsters.get(h.id);
      if (m && m.mapId === this.currentMap) {
        m.sprite.setTint(0x7dd3fc);
        this.time.delayedCall(SPELLS.FROST_NOVA_SLOW_MS, () => {
          // Restore boss/champion tint if applicable
          if (m.boss) m.sprite.setTint(0xffd54f);
          else if (m.champion) m.sprite.setTint(0xfff176);
          else m.sprite.clearTint();
        });
        this.spawnDamageNumber(
          m.sprite.x,
          m.sprite.y - 14,
          h.dmg,
          false,
          h.crit
        );
      }
    }
  }

  /** Fire-bolt visual: a flaming sprite travels from caster to victim. */
  private showCastFx(msg: FxCastPayload) {
    if (this.currentMap == null) return;
    const sprite = this.add.image(msg.fromX, msg.fromY, "fx-firebolt");
    sprite.setDepth(99998);
    const dx = msg.toX - msg.fromX;
    const dy = msg.toY - msg.fromY;
    sprite.rotation = Math.atan2(dy, dx);
    const dist = Math.hypot(dx, dy);
    const dur = Math.min(220, Math.max(80, dist * 1.4));

    // Trailing sparks
    const trail = this.time.addEvent({
      delay: 18,
      loop: true,
      callback: () => {
        const spark = this.add
          .circle(sprite.x, sprite.y, 2, 0xffb74d, 0.85)
          .setDepth(99997);
        this.tweens.add({
          targets: spark,
          alpha: 0,
          scale: 0.3,
          duration: 220,
          onComplete: () => spark.destroy(),
        });
      },
    });

    this.tweens.add({
      targets: sprite,
      x: msg.toX,
      y: msg.toY,
      duration: dur,
      ease: "Quad.Out",
      onComplete: () => {
        trail.remove();
        // Explosion at impact
        const ex = this.add.circle(msg.toX, msg.toY, 4, 0xff7043, 0.85).setDepth(99998);
        this.tweens.add({
          targets: ex,
          radius: 22,
          alpha: 0,
          duration: 260,
          onComplete: () => ex.destroy(),
        });
        sprite.destroy();
      },
    });
  }

  /* ──────────────────────────────────────────────────────────────── */
  /* Update loop                                                      */
  /* ──────────────────────────────────────────────────────────────── */

  update(_t: number, dt: number) {
    const now = performance.now();
    const inTransition = now < this.mapTransitionUntil;
    const t = inTransition ? 1 : Math.min(1, (dt / 1000) * 15);

    this.sprites.forEach((s) => {
      s.sprite.x += (s.targetX - s.sprite.x) * t;
      s.sprite.y += (s.targetY - s.sprite.y) * t;
      s.sprite.setDepth(s.sprite.y);
      s.label.x = s.sprite.x;
      s.label.y = s.sprite.y - PLAYER.SIZE / 2 - 4;
    });

    this.monsters.forEach((m) => {
      m.sprite.x += (m.targetX - m.sprite.x) * t;
      m.sprite.y += (m.targetY - m.sprite.y) * t;
      m.sprite.setDepth(m.sprite.y);
      const def = MONSTER_DEFS[m.type];
      const hpY = m.sprite.y - def.radius * 2 - 6;
      m.hpBg.x = m.sprite.x;
      m.hpBg.y = hpY;
      m.hpFill.x = m.sprite.x - 10;
      m.hpFill.y = hpY;
    });

    // ── Pointer / mouse input (PC only — touch uses on-screen buttons) ─
    const ptr = this.input.activePointer;
    const isMouseDevice =
      ((ptr.event as PointerEvent | undefined)?.pointerType ?? "mouse") ===
      "mouse";
    const mouseLeft = isMouseDevice && ptr.leftButtonDown();
    const mouseRight = isMouseDevice && ptr.rightButtonDown();
    const mouseMiddle = isMouseDevice && ptr.middleButtonDown();
    const shiftHeld = !!this.shiftKey?.isDown;

    // ── Hold-to-attack ────────────────────────────────────────────────
    const wantAttack =
      this.attackBtn.isDown() ||
      !!this.spaceKey?.isDown ||
      mouseLeft;
    if (wantAttack && now >= this.nextAttackAt) {
      this.sendAttack();
      this.nextAttackAt = now + COMBAT.ATTACK_COOLDOWN_MS;
    }

    // ── Hold-to-cast Fire Bolt — right click (no shift) ──────────────
    const wantCast =
      this.spellBtn.isDown() ||
      !!this.eKey?.isDown ||
      !!this.key2?.isDown ||
      (mouseRight && !shiftHeld);
    if (wantCast && now >= this.nextCastAt) {
      this.sendCast();
      this.nextCastAt = now + SPELLS.FIRE_BOLT_COOLDOWN_MS;
    }

    // ── Hold-to-cast Frost Nova — shift+right click or middle click ──
    const wantNova =
      this.novaBtn.isDown() ||
      !!this.fKey?.isDown ||
      !!this.key3?.isDown ||
      mouseMiddle ||
      (mouseRight && shiftHeld);
    if (wantNova && now >= this.nextNovaAt) {
      this.sendNova();
      this.nextNovaAt = now + SPELLS.FROST_NOVA_COOLDOWN_MS;
    }

    // Keep character/inventory panels in sync while open.
    if (this.characterPanel?.isOpen() || this.inventoryPanel?.isOpen()) {
      this.refreshCharacterPanel();
    }

    // ── Monster title text follows sprite for champions ──────────────
    this.monsters.forEach((m) => {
      if (m.title) {
        m.title.x = m.sprite.x;
        m.title.y = m.sprite.y - MONSTER_DEFS[m.type].radius * 2 - 18;
      }
    });

    // Vignette follows the camera; scaled so it always covers the viewport
    // but the bright center stays roomy on mobile.
    if (this.vignette) {
      const cam = this.cameras.main;
      this.vignette.setPosition(cam.width / 2, cam.height / 2);
      const scale = Math.max(cam.width, cam.height) / 900;
      this.vignette.setScale(Math.max(1, scale));
    }

    this.updateHud();
  }
}
