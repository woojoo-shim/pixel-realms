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
  TUTORIAL_STEPS,
  CLASSES,
  STORY_SLIDES,
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
import { SkillTreePanel } from "../ui/SkillTreePanel.js";
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

/**
 * Convert an HSL hue (degrees) into a hex tint that lightly colorizes the
 * player sprite. Saturation/lightness fixed so all hues read clearly on the
 * pixel sprite without washing it out.
 */
function hueToTint(hue: number): number {
  const h = ((hue % 360) + 360) % 360;
  // s=0.55, l=0.65 — soft pastel-ish wash that keeps sprite features readable
  const s = 0.55;
  const l = 0.65;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return (R << 16) | (G << 8) | B;
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
  private skillTreePanel!: SkillTreePanel;
  private kKey?: Phaser.Input.Keyboard.Key;
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
  private skillBtn?: HTMLButtonElement;
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
  private tutorialEl?: HTMLDivElement;
  private tutorialIconEl?: HTMLSpanElement;
  private tutorialTextEl?: HTMLSpanElement;
  private tutorialStepNumEl?: HTMLSpanElement;
  private tutorialDismissed = false;

  // ── Character creation modal ──────────────────────────────────
  private charCreateEl?: HTMLDivElement;
  private charCreateErrEl?: HTMLDivElement;

  // ── Juice: kill streak / boss banner ───────────────────────────
  private killStreakCount = 0;
  /** Streak resets if no kills within this many ms. */
  private killStreakResetAt = 0;
  private killStreakBanner?: HTMLDivElement;
  private bossesSeen = new Set<string>(); // monster ids we've already banner'd
  private sideStack?: HTMLDivElement;
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
  private token: string = "";
  private authMode: "login" | "register" = "login";

  constructor() {
    super("world");
  }

  init(data?: {
    mode?: JoinMode;
    roomId?: string;
    username?: string;
    password?: string;
    token?: string;
    authMode?: "login" | "register";
  }) {
    this.mode = data?.mode ?? "quick";
    this.roomId = data?.roomId;
    this.username = data?.username ?? "";
    this.password = data?.password ?? "";
    this.token = data?.token ?? "";
    this.authMode = data?.authMode ?? "login";
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
      this.kKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.K
      );
      this.kKey.on("down", () => this.toggleSkillTreePanel());
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
    this.skillTreePanel = new SkillTreePanel();
    this.skillTreePanel.onPlus((skillId) => this.sendAllocateSkill(skillId));
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

    // Global stylesheet — D2-themed utility classes shared by all UI bits.
    if (!document.getElementById("pr-ui-style")) {
      const style = document.createElement("style");
      style.id = "pr-ui-style";
      style.textContent = `
        @keyframes pr-badge-pulse {
          0%, 100% { box-shadow: 0 0 6px rgba(252,211,77,0.35); }
          50%      { box-shadow: 0 0 14px rgba(252,211,77,0.85); }
        }
        .pr-btn {
          font-family: monospace;
          color: #f3e9c6;
          background: linear-gradient(180deg, rgba(30,20,12,0.92), rgba(12,8,5,0.96));
          border: 1px solid rgba(180,140,80,0.6);
          border-radius: 6px;
          cursor: pointer;
          touch-action: manipulation;
          transition: border-color 120ms, transform 80ms;
        }
        .pr-btn:hover  { border-color: rgba(252,211,77,0.9); }
        .pr-btn:active { transform: translateY(1px); }
        .pr-icon-btn {
          width:  clamp(32px, 6.5vmin, 44px);
          height: clamp(32px, 6.5vmin, 44px);
          font-size: clamp(14px, 3vmin, 22px);
          display: flex; align-items: center; justify-content: center;
          z-index: 22;
        }
        .pr-side-stack {
          position: fixed;
          top: clamp(70px, 12vmin, 110px); left: clamp(6px, 1.4vmin, 14px);
          display: flex; flex-direction: column; gap: 6px;
          z-index: 22;
        }
        .pr-badge {
          width: clamp(64px, 13vmin, 90px);
          padding: clamp(4px, 0.8vmin, 7px) 0;
          font-size: clamp(9px, 1.6vmin, 12px);
          font-weight: bold;
          letter-spacing: 1px;
          text-align: center;
          color: #fde047;
          background: linear-gradient(180deg, rgba(30,20,12,0.96), rgba(12,8,5,0.98));
          border: 1px solid #fde047;
          animation: pr-badge-pulse 1.8s ease-in-out infinite;
        }
      `;
      document.head.appendChild(style);
    }

    // Persistent on-screen bag button (mobile + desktop)
    const bagBtn = document.createElement("button");
    bagBtn.type = "button";
    bagBtn.textContent = "🎒";
    bagBtn.title = "Inventory (I)";
    bagBtn.className = "pr-btn pr-icon-btn";
    Object.assign(bagBtn.style, {
      position: "fixed",
      top: "clamp(6px, 1.4vmin, 14px)",
      left: "calc(50% + clamp(72px, 16vmin, 110px))",
    } as CSSStyleDeclaration);
    bagBtn.addEventListener("click", () => this.inventoryPanel.toggle());
    document.body.appendChild(bagBtn);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bagBtn.remove());

    // Vignette — subtle corner shading. Heavy alpha-blended overlay
    // costs a lot on mobile GPUs (full-screen rebleed every frame), so
    // we skip it on touch devices.
    const _isTouch =
      "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
    if (!_isTouch) {
      this.vignette = this.add
        .image(0, 0, "vignette")
        .setScrollFactor(0)
        .setOrigin(0.5)
        .setDepth(50)
        .setAlpha(0.6);
    }

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
      this.skillBtn?.remove();
      this.skillTreePanel?.destroy();
      this.tutorialEl?.remove();
      this.killStreakBanner?.remove();
      this.charCreateEl?.remove();
      this.tearDownHud();
    });

    this.setupHud();

    this.cameras.main.setBackgroundColor("#0a0a0a");
    this.cameras.main.setRoundPixels(true);

    try {
      if (!this.token && (!this.username || !this.password)) {
        // No credentials — return to menu.
        this.scene.start("menu");
        return;
      }
      const { room } = await joinWorld({
        username: this.username,
        password: this.password,
        token: this.token,
        mode: this.mode,
        roomId: this.roomId,
        authMode: this.authMode,
      });
      this.room = room;
      this.mySessionId = room.sessionId;

      // Auth + duplicate-session errors come back as a custom message,
      // followed by the server closing the socket.
      room.onMessage("auth-error", (msg: { reason: string }) => {
        alert(msg.reason ?? "Login failed.");
      });
      room.onMessage("needs-character", (msg: { suggested?: string }) =>
        this.showCharacterCreateModal(room, msg?.suggested ?? "")
      );
      room.onMessage("character-created", () => {
        this.dismissCharacterCreateModal();
      });
      room.onMessage("character-error", (msg: { reason: string }) => {
        this.setCharacterCreateError(msg?.reason ?? "");
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
      // Per-monster attack motions
      room.onMessage(
        "fx:monster-bolt",
        (msg: {
          fromX: number; fromY: number; toX: number; toY: number;
          monsterType?: string;
        }) => this.showMonsterBoltFx(msg)
      );
      room.onMessage(
        "fx:monster-slam",
        (msg: { x: number; y: number; radius: number; monsterType?: string }) =>
          this.showMonsterSlamFx(msg)
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

    // Side stack — host for stat/skill badges so they share one column
    if (!this.sideStack) {
      const stack = document.createElement("div");
      stack.className = "pr-side-stack";
      document.body.appendChild(stack);
      this.sideStack = stack;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stack.remove());
    }

    // Stat-points badge — only shown when there are unspent points
    if (me.statPoints > 0) {
      if (!this.statBtn) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pr-btn pr-badge";
        b.addEventListener("click", () => this.toggleCharacterPanel());
        this.sideStack.appendChild(b);
        this.statBtn = b;
      }
      this.statBtn.textContent = `+${me.statPoints} STATS`;
    } else if (this.statBtn) {
      this.statBtn.remove();
      this.statBtn = undefined;
    }

    // Tutorial overlay — shows current step until all done
    this.updateTutorialOverlay(me.tutorialStep ?? 0);

    // Skill-points badge — same unified style as the stats one
    if ((me.skillPoints ?? 0) > 0) {
      if (!this.skillBtn) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pr-btn pr-badge";
        b.addEventListener("click", () => this.toggleSkillTreePanel());
        this.sideStack.appendChild(b);
        this.skillBtn = b;
      }
      this.skillBtn.textContent = `+${me.skillPoints} SKILLS`;
    } else if (this.skillBtn) {
      this.skillBtn.remove();
      this.skillBtn = undefined;
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
    const isMyHit = msg.target === "monster"; // any monster hit credited as juice for me
    if (msg.target === "monster") {
      const m = this.monsters.get(msg.targetId);
      if (!m || m.mapId !== this.currentMap) return;
      this.flashSprite(m.sprite, 0xff5252);
      // Hitstop on monster kill — brief slow-motion makes kills feel weighty
      if (msg.fatal) {
        this.hitstop(70);
        this.cameras.main.shake(160, 0.008);
        this.bumpKillStreak();
      } else if (msg.crit) {
        this.cameras.main.shake(80, 0.005);
      }
    } else {
      const s = this.sprites.get(msg.targetId);
      if (!s || s.mapId !== this.currentMap) return;
      this.flashSprite(s.sprite, 0xff5252);
      if (msg.targetId === this.mySessionId) {
        this.shakeCamera();
        this.flashHurtVignette(msg.dmg);
        if (msg.fatal) this.cameras.main.shake(420, 0.018);
      }
    }
    this.spawnDamageNumber(
      msg.x,
      msg.y,
      msg.dmg,
      msg.target === "player",
      !!msg.crit
    );
    void isMyHit;
  }

  /** Brief slow-motion — pauses physics/tweens for `ms` then resumes. */
  private hitstop(ms: number) {
    const cur = this.tweens.timeScale;
    this.tweens.timeScale = 0.08;
    this.time.delayedCall(ms, () => {
      this.tweens.timeScale = cur;
    });
  }

  private bumpKillStreak() {
    const now = Date.now();
    // Reset streak if more than 4s since last kill
    if (now > this.killStreakResetAt) this.killStreakCount = 0;
    this.killStreakCount += 1;
    this.killStreakResetAt = now + 4000;
    if (this.killStreakCount < 2) return; // only show from 2+
    this.showKillStreakBanner(this.killStreakCount);
  }

  private showKillStreakBanner(n: number) {
    if (!this.killStreakBanner) {
      const b = document.createElement("div");
      Object.assign(b.style, {
        position: "fixed",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        color: "#fde047",
        fontFamily: "monospace",
        fontWeight: "bold",
        textShadow:
          "0 0 12px rgba(220,38,38,0.9), 0 0 22px rgba(220,38,38,0.6), 0 2px 4px #000",
        letterSpacing: "3px",
        pointerEvents: "none",
        zIndex: "40",
      } as CSSStyleDeclaration);
      document.body.append(b);
      this.killStreakBanner = b;
    }
    const b = this.killStreakBanner;
    const size = Math.min(64, 22 + n * 4);
    b.style.fontSize = `${size}px`;
    b.textContent = `${n} KILLS!`;
    b.style.opacity = "1";
    b.style.transform = "translate(-50%, -50%) scale(0.4)";
    b.style.transition = "transform 220ms cubic-bezier(.2,1.6,.4,1)";
    requestAnimationFrame(() => {
      b.style.transform = "translate(-50%, -50%) scale(1)";
    });
    // fade out
    if ((b as any)._fadeTimer) clearTimeout((b as any)._fadeTimer);
    (b as any)._fadeTimer = setTimeout(() => {
      b.style.transition = "opacity 380ms ease, transform 380ms ease";
      b.style.opacity = "0";
      b.style.transform = "translate(-50%, -50%) scale(1.2)";
    }, 700);
  }

  private maybeShowBossBanner(id: string, m: MonsterSprite) {
    if (!m.boss || this.bossesSeen.has(id)) return;
    if (m.mapId !== this.currentMap) return;
    this.bossesSeen.add(id);
    const subtitle = m.title?.text ?? "BOSS";
    const banner = document.createElement("div");
    Object.assign(banner.style, {
      position: "fixed",
      top: "22%",
      left: "0",
      right: "0",
      textAlign: "center",
      color: "#fde047",
      fontFamily: "monospace",
      fontSize: "min(40px, 8vmin)",
      fontWeight: "bold",
      letterSpacing: "4px",
      textShadow:
        "0 0 14px rgba(220,38,38,0.95), 0 0 28px rgba(120,0,0,0.7), 0 3px 6px #000",
      pointerEvents: "none",
      zIndex: "40",
      transform: "translateX(-100vw)",
      transition: "transform 480ms cubic-bezier(.15,1.4,.3,1), opacity 600ms ease",
    } as CSSStyleDeclaration);
    banner.innerHTML = `<div style="font-size:0.5em;letter-spacing:8px;color:#fda4af;margin-bottom:4px">BOSS ENCOUNTER</div>${subtitle}`;
    document.body.append(banner);
    requestAnimationFrame(() => {
      banner.style.transform = "translateX(0)";
    });
    setTimeout(() => {
      banner.style.opacity = "0";
      banner.style.transform = "translateX(100vw)";
    }, 1800);
    setTimeout(() => banner.remove(), 2600);
    // Dramatic shake
    this.cameras.main.shake(360, 0.012);
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
      sprite.setTint(hueToTint(player.colorHue ?? 170));

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

        // Live tint + name updates (e.g. after char creation)
        s.sprite.setTint(hueToTint(player.colorHue ?? 170));
        if (s.label.text !== player.name) s.label.setText(player.name);

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
    let ang = 0;
    let dx = 0, dy = 0;
    switch (dir) {
      case "right": ang = 0; dx = 1; break;
      case "down":  ang = Math.PI / 2; dy = 1; break;
      case "left":  ang = Math.PI; dx = -1; break;
      case "up":    ang = -Math.PI / 2; dy = -1; break;
    }
    const r = COMBAT.ATTACK_RANGE;
    const span = Math.PI / 1.7; // wider, more dramatic arc
    const dur = COMBAT.ATTACK_SWING_MS;
    const cx = remote.sprite.x;
    const cy0 = remote.sprite.y;
    const cy = cy0 - 12;

    // 1) Sprite squash: punch toward target then snap back.
    //    We use position tween + scale tween in parallel.
    const origScaleX = remote.sprite.scaleX;
    const origScaleY = remote.sprite.scaleY;
    const origX = remote.sprite.x;
    const origY = remote.sprite.y;
    this.tweens.add({
      targets: remote.sprite,
      x: origX + dx * 4,
      y: origY + dy * 4,
      scaleX: origScaleX * 1.18,
      scaleY: origScaleY * 0.88,
      duration: dur * 0.28,
      ease: "Cubic.easeOut",
      yoyo: true,
      onComplete: () => {
        remote.sprite.x = origX;
        remote.sprite.y = origY;
        remote.sprite.setScale(origScaleX, origScaleY);
      },
    });

    // 2) Sweeping crescent — the arc itself moves through its span over
    //    the swing duration. We redraw each frame using a tween proxy.
    const g = this.add.graphics().setDepth(cy0 + 1);
    const sweepWidth = span * 0.55; // bright leading-edge slice width
    const phase = { t: -1 }; // -1 (start) → +1 (end of sweep)
    this.tweens.add({
      targets: phase,
      t: 1,
      duration: dur,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        const head = ang + (phase.t * span) / 2;
        const tail = head - sweepWidth;
        const alpha = Math.max(0, 1 - Math.abs(phase.t)); // peaks mid-swing
        g.clear();
        // Outer faint trail (full span the swing has covered)
        g.fillStyle(0xfff3c4, 0.25 * alpha);
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, r, ang - span / 2, head, false);
        g.closePath();
        g.fillPath();
        // Leading-edge bright crescent
        g.fillStyle(0xfffac9, 0.85 * alpha);
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, r, tail, head, false);
        g.closePath();
        g.fillPath();
        // Hot rim line at the very leading edge
        g.lineStyle(2.5, 0xffffff, 0.95 * alpha);
        g.beginPath();
        g.arc(cx, cy, r, head - 0.05, head + 0.05, false);
        g.strokePath();
        // Tip sparkle following the blade
        const tipX = cx + Math.cos(head) * r;
        const tipY = cy + Math.sin(head) * r;
        g.fillStyle(0xffffff, alpha);
        g.fillCircle(tipX, tipY, 2.5);
        g.fillStyle(0xfff7d6, 0.6 * alpha);
        g.fillCircle(tipX, tipY, 5);
      },
      onComplete: () => g.destroy(),
    });

    // 3) Quick anticipation flash at the player's chest
    const flash = this.add.graphics().setDepth(cy0 + 1);
    flash.fillStyle(0xffffff, 0.85);
    flash.fillCircle(cx, cy, 6);
    flash.fillStyle(0xfff7d6, 0.5);
    flash.fillCircle(cx, cy, 12);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: dur * 0.5,
      onComplete: () => flash.destroy(),
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

  /* ── Character creation modal ──────────────────────────────────── */

  private showCharacterCreateModal(room: Room, suggestedName: string) {
    if (this.charCreateEl) return;

    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      background:
        "radial-gradient(circle at 50% 40%, rgba(40,12,20,0.92), rgba(2,4,8,0.98))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "60",
      fontFamily: "monospace",
      padding: "16px",
    } as CSSStyleDeclaration);

    document.body.appendChild(overlay);
    this.charCreateEl = overlay;

    // Local picker state — captured across the 3 steps
    let storyIdx = 0;
    let pickedClassId = "warrior";
    let pickedHue = 0; // overridden by class default when class chosen

    const renderStory = () => this.renderStoryStep(overlay, storyIdx, () => {
      storyIdx += 1;
      if (storyIdx >= STORY_SLIDES.length) renderClassPicker();
      else renderStory();
    });
    const renderClassPicker = () =>
      this.renderClassStep(overlay, pickedClassId, (id) => {
        pickedClassId = id;
        const def = CLASSES.find((c) => c.id === id);
        if (def) pickedHue = def.suggestedHue;
        renderNameForm();
      });
    const renderNameForm = () =>
      this.renderNameStep(
        overlay,
        suggestedName,
        pickedClassId,
        pickedHue,
        (name, hue) => {
          room.send("createCharacter", {
            name,
            colorHue: hue,
            classId: pickedClassId,
          });
        },
        (h) => (pickedHue = h),
        () => renderClassPicker()
      );

    // Skip story if already seen on this device.
    if (localStorage.getItem("pr:storySeen") === "1") {
      storyIdx = STORY_SLIDES.length;
      renderClassPicker();
    } else {
      renderStory();
    }
  }

  /* ── Step 1: Story slide ───────────────────────────────────────── */
  private renderStoryStep(
    overlay: HTMLDivElement,
    idx: number,
    onNext: () => void
  ) {
    overlay.innerHTML = "";
    const slide = STORY_SLIDES[idx];
    if (!slide) return;
    // Vibe-based tint colour per slide
    const tints: Record<string, string> = {
      ruins: "rgba(80, 40, 20, 0.35)",
      darkLords: "rgba(127, 29, 29, 0.4)",
      awakening: "rgba(127, 100, 30, 0.35)",
      departure: "rgba(30, 80, 60, 0.35)",
    };
    const tint = tints[slide.vibe] ?? "rgba(40,20,40,0.3)";
    const card = document.createElement("div");
    card.className = "pr-panel pr-fade-in";
    Object.assign(card.style, {
      width: "min(440px, 92vw)",
      padding: "32px 28px 24px",
      backgroundImage: `radial-gradient(circle at 50% 0%, ${tint}, transparent 70%), linear-gradient(180deg, rgba(20,16,22,0.96), rgba(8,6,10,0.99))`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "18px",
      textAlign: "center",
    } as CSSStyleDeclaration);
    const step = document.createElement("div");
    step.textContent = `${idx + 1} / ${STORY_SLIDES.length}`;
    Object.assign(step.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "11px",
      color: "var(--pr-gold)",
      letterSpacing: "6px",
    } as CSSStyleDeclaration);
    const body = document.createElement("div");
    body.textContent = slide.body;
    Object.assign(body.style, {
      fontFamily: "var(--pr-story)",
      fontSize: "16px",
      lineHeight: "2",
      color: "var(--pr-parchment)",
      whiteSpace: "pre-line",
      padding: "12px 0",
      minHeight: "120px",
      letterSpacing: "1px",
    } as CSSStyleDeclaration);
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.textContent =
      idx === STORY_SLIDES.length - 1 ? "▶  계속" : "▶  다음";
    nextBtn.className = "pr-btn pr-btn-blood";
    nextBtn.onclick = () => onNext();
    const skip = document.createElement("button");
    skip.type = "button";
    skip.textContent = "스킵 →";
    skip.className = "pr-btn pr-btn-ghost";
    skip.onclick = () => {
      localStorage.setItem("pr:storySeen", "1");
      this.renderClassStep(overlay, "warrior", (id) => {
        // Re-route to name step from inside the closure of show...Modal
        // by re-dispatching: easier path is to dismiss + show again with
        // story flag set, but we're inside the existing flow so just call
        // renderClassStep here and rely on the same picker callback.
        const onPick = (cid: string) => {
          const def = CLASSES.find((c) => c.id === cid);
          const hue = def?.suggestedHue ?? 0;
          this.renderNameStep(
            overlay,
            "",
            cid,
            hue,
            (n, h) => {
              // captured room reference — pull from charCreateEl owner
              // but we don't have it here; use a custom event instead.
              overlay.dispatchEvent(
                new CustomEvent("char-submit", {
                  detail: { name: n, colorHue: h, classId: cid },
                })
              );
            },
            (_) => {},
            () => this.renderClassStep(overlay, cid, onPick)
          );
        };
        onPick(id);
      });
    };
    card.append(step, body, nextBtn, skip);
    overlay.appendChild(card);
    // Mark seen as soon as the first slide is shown.
    localStorage.setItem("pr:storySeen", "1");
  }

  /* ── Step 2: Class picker (3 cards) ────────────────────────────── */
  private renderClassStep(
    overlay: HTMLDivElement,
    initialId: string,
    onPicked: (classId: string) => void
  ) {
    overlay.innerHTML = "";
    const card = document.createElement("div");
    card.className = "pr-panel pr-fade-in";
    Object.assign(card.style, {
      width: "min(560px, 94vw)",
      maxHeight: "92vh",
      overflowY: "auto",
      padding: "28px 24px 22px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    } as CSSStyleDeclaration);
    const heading = document.createElement("div");
    heading.textContent = "직업을 골라라";
    Object.assign(heading.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "24px",
      fontWeight: "900",
      letterSpacing: "8px",
      color: "var(--pr-gold-bright)",
      textAlign: "center",
      textShadow: "0 0 18px rgba(252,209,64,0.5), 0 3px 6px #000",
    } as CSSStyleDeclaration);
    const sub = document.createElement("div");
    sub.textContent = "기본 스탯과 시작 스킬이 달라집니다";
    Object.assign(sub.style, {
      fontFamily: "var(--pr-story)",
      fontSize: "12px",
      color: "var(--pr-gold)",
      textAlign: "center",
      letterSpacing: "3px",
      marginBottom: "4px",
    } as CSSStyleDeclaration);

    let selected = initialId;
    const cards: HTMLDivElement[] = [];
    const grid = document.createElement("div");
    Object.assign(grid.style, {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    } as CSSStyleDeclaration);

    const refresh = () => {
      cards.forEach((c, i) => {
        const def = CLASSES[i];
        const isPicked = def.id === selected;
        if (isPicked) {
          c.style.borderColor = "var(--accent)";
          c.style.background =
            "linear-gradient(180deg, rgba(40,30,12,0.9), rgba(15,10,4,0.95))";
          c.style.boxShadow =
            "0 0 22px var(--accent-soft), inset 0 0 20px rgba(0,0,0,0.55)";
          c.style.transform = "translateX(4px)";
        } else {
          c.style.borderColor = "rgba(252,165,165,0.18)";
          c.style.background = "rgba(8,5,12,0.75)";
          c.style.boxShadow = "none";
          c.style.transform = "translateX(0)";
        }
      });
    };

    CLASSES.forEach((def) => {
      const c = document.createElement("div");
      c.className = `pr-class-${def.id}`;
      Object.assign(c.style, {
        padding: "14px 16px",
        border: "2px solid rgba(252,165,165,0.18)",
        borderRadius: "6px",
        background: "rgba(8,5,12,0.75)",
        cursor: "pointer",
        display: "flex",
        gap: "14px",
        alignItems: "stretch",
        transition: "all 0.18s ease",
      } as CSSStyleDeclaration);
      // Class portrait — coloured circle with emoji
      const portrait = document.createElement("div");
      portrait.textContent = def.icon;
      Object.assign(portrait.style, {
        fontSize: "30px",
        lineHeight: "1",
        width: "56px",
        height: "56px",
        flexShrink: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        background: `radial-gradient(circle at 40% 30%, hsl(${def.suggestedHue}, 60%, 35%), hsl(${def.suggestedHue}, 70%, 12%) 70%)`,
        border: "2px solid var(--accent)",
        boxShadow:
          "inset 0 0 10px rgba(0,0,0,0.6), 0 0 14px var(--accent-soft)",
      } as CSSStyleDeclaration);
      const right = document.createElement("div");
      Object.assign(right.style, {
        flex: "1",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      } as CSSStyleDeclaration);
      const nameRow = document.createElement("div");
      Object.assign(nameRow.style, {
        display: "flex",
        gap: "10px",
        alignItems: "baseline",
        flexWrap: "wrap",
      } as CSSStyleDeclaration);
      const nm = document.createElement("div");
      nm.textContent = def.name;
      Object.assign(nm.style, {
        fontFamily: "var(--pr-display)",
        fontSize: "18px",
        fontWeight: "700",
        color: "var(--accent)",
        letterSpacing: "4px",
      } as CSSStyleDeclaration);
      const tag = document.createElement("div");
      tag.textContent = `「 ${def.tagline} 」`;
      Object.assign(tag.style, {
        fontFamily: "var(--pr-story)",
        fontSize: "12px",
        color: "var(--pr-gold)",
        letterSpacing: "2px",
      } as CSSStyleDeclaration);
      nameRow.append(nm, tag);
      const desc = document.createElement("div");
      desc.textContent = def.description;
      Object.assign(desc.style, {
        fontFamily: "var(--pr-body)",
        fontSize: "12px",
        color: "#d1d5db",
        whiteSpace: "pre-line",
        lineHeight: "1.5",
      } as CSSStyleDeclaration);
      const stats = document.createElement("div");
      const sBits: string[] = [];
      if (def.baseHpBonus) sBits.push(`HP ${def.baseHpBonus > 0 ? "+" : ""}${def.baseHpBonus}`);
      if (def.baseMpBonus) sBits.push(`MP ${def.baseMpBonus > 0 ? "+" : ""}${def.baseMpBonus}`);
      if (def.baseStr) sBits.push(`STR +${def.baseStr}`);
      if (def.baseVit) sBits.push(`VIT +${def.baseVit}`);
      if (def.baseMnd) sBits.push(`MND +${def.baseMnd}`);
      if (def.baseQck) sBits.push(`QCK +${def.baseQck}`);
      stats.textContent = sBits.join(" · ");
      Object.assign(stats.style, {
        fontFamily: "var(--pr-body)",
        fontSize: "11px",
        color: "var(--accent)",
        letterSpacing: "1.5px",
        marginTop: "2px",
        opacity: "0.85",
      } as CSSStyleDeclaration);
      right.append(nameRow, desc, stats);
      c.append(portrait, right);
      c.onclick = () => {
        selected = def.id;
        refresh();
      };
      cards.push(c);
      grid.appendChild(c);
    });
    refresh();

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "▶  다음 (이름 짓기)";
    next.className = "pr-btn pr-btn-blood";
    next.style.marginTop = "6px";
    next.onclick = () => onPicked(selected);

    card.append(heading, sub, grid, next);
    overlay.appendChild(card);
  }

  /* ── Step 3: Name + colour ─────────────────────────────────────── */
  private renderNameStep(
    overlay: HTMLDivElement,
    suggestedName: string,
    classId: string,
    initialHue: number,
    onSubmit: (name: string, colorHue: number) => void,
    onHueChange: (hue: number) => void,
    onBack: () => void
  ) {
    overlay.innerHTML = "";
    const def = CLASSES.find((c) => c.id === classId);
    const card = document.createElement("div");
    card.className = `pr-panel pr-fade-in pr-class-${classId}`;
    Object.assign(card.style, {
      width: "min(380px, 92vw)",
      padding: "28px 24px 22px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      textAlign: "center",
    } as CSSStyleDeclaration);

    const heading = document.createElement("div");
    heading.textContent = `${def?.icon ?? "⚔"}  ${def?.name ?? "영웅"}`;
    Object.assign(heading.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "24px",
      fontWeight: "900",
      letterSpacing: "6px",
      color: "var(--accent)",
      textShadow: "0 0 18px var(--accent-soft)",
    } as CSSStyleDeclaration);

    const sub = document.createElement("div");
    sub.textContent = `「 ${def?.tagline ?? ""} 」`;
    Object.assign(sub.style, {
      fontFamily: "var(--pr-story)",
      fontSize: "13px",
      color: "var(--pr-gold)",
      letterSpacing: "3px",
      marginBottom: "4px",
    } as CSSStyleDeclaration);

    const nameInput = document.createElement("input");
    nameInput.placeholder = "내 영웅의 이름";
    nameInput.maxLength = 16;
    nameInput.value = suggestedName || "";
    nameInput.className = "pr-input";

    let pickedHue = initialHue;
    const palette = document.createElement("div");
    Object.assign(palette.style, {
      display: "grid",
      gridTemplateColumns: "repeat(8, 1fr)",
      gap: "6px",
      justifyItems: "center",
      marginTop: "4px",
    } as CSSStyleDeclaration);
    const hues = [0, 30, 60, 110, 170, 210, 260, 310];
    let pickedSwatch: HTMLButtonElement | undefined;
    const refresh = () => {
      Array.from(palette.children).forEach((c) => {
        const s = c as HTMLButtonElement;
        s.style.outline =
          s === pickedSwatch
            ? "3px solid #fde047"
            : "2px solid rgba(255,255,255,0.15)";
        s.style.transform = s === pickedSwatch ? "scale(1.12)" : "scale(1)";
      });
    };
    hues.forEach((h) => {
      const sw = document.createElement("button");
      sw.type = "button";
      Object.assign(sw.style, {
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        border: "none",
        background: `hsl(${h}, 70%, 55%)`,
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
        transition: "transform 0.1s",
      } as CSSStyleDeclaration);
      sw.addEventListener("click", () => {
        pickedHue = h;
        pickedSwatch = sw;
        onHueChange(h);
        refresh();
      });
      palette.appendChild(sw);
      if (Math.abs(h - initialHue) < 20) pickedSwatch = sw;
    });
    if (!pickedSwatch) pickedSwatch = palette.children[4] as HTMLButtonElement;
    refresh();

    const err = document.createElement("div");
    Object.assign(err.style, {
      minHeight: "14px",
      fontSize: "11px",
      color: "#fca5a5",
      letterSpacing: "1px",
    } as CSSStyleDeclaration);
    this.charCreateErrEl = err;

    const submit = document.createElement("button");
    submit.type = "button";
    submit.textContent = "⚔  모험 시작";
    submit.className = "pr-btn pr-btn-blood";
    const send = () => {
      err.textContent = "";
      const name = nameInput.value.trim();
      if (name.length < 2) {
        err.textContent = "이름이 너무 짧아요";
        return;
      }
      onSubmit(name, pickedHue);
    };
    submit.addEventListener("click", send);
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });

    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "← 직업 다시 고르기";
    back.className = "pr-btn pr-btn-ghost";
    back.onclick = onBack;

    card.append(heading, sub, nameInput, palette, err, submit, back);
    overlay.appendChild(card);
    setTimeout(() => nameInput.focus(), 50);
  }

  private dismissCharacterCreateModal() {
    if (!this.charCreateEl) return;
    this.charCreateEl.style.transition = "opacity 250ms ease";
    this.charCreateEl.style.opacity = "0";
    const el = this.charCreateEl;
    setTimeout(() => el.remove(), 260);
    this.charCreateEl = undefined;
    this.charCreateErrEl = undefined;
  }

  private setCharacterCreateError(msg: string) {
    if (this.charCreateErrEl) this.charCreateErrEl.textContent = msg;
  }

  private isTouchDevice(): boolean {
    return (
      "ontouchstart" in window ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
    );
  }

  private updateTutorialOverlay(step: number) {
    // Tutorial complete OR user dismissed → tear down and bail
    if (step >= TUTORIAL_STEPS.length || this.tutorialDismissed) {
      if (this.tutorialEl) {
        this.tutorialEl.remove();
        this.tutorialEl = undefined;
      }
      return;
    }
    if (!this.tutorialEl) {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position: "fixed",
        top: "clamp(6px, 1.4vmin, 14px)",
        left: "50%",
        transform: "translateX(-50%)",
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(7,11,18,0.96))",
        border: "2px solid #fde047",
        borderRadius: "8px",
        padding: "clamp(6px, 1.2vmin, 10px) clamp(8px, 1.6vmin, 14px)",
        color: "#e7e7e7",
        fontFamily: "monospace",
        fontSize: "clamp(11px, 1.8vmin, 14px)",
        display: "flex",
        alignItems: "center",
        gap: "clamp(6px, 1.2vmin, 10px)",
        maxWidth: "min(480px, 92vw)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.55)",
        zIndex: "30",
        pointerEvents: "auto",
      } as CSSStyleDeclaration);
      const stepNum = document.createElement("span");
      Object.assign(stepNum.style, {
        background: "#fde047",
        color: "#0b1118",
        fontWeight: "bold",
        fontSize: "clamp(9px, 1.5vmin, 12px)",
        padding: "2px 6px",
        borderRadius: "10px",
        minWidth: "clamp(28px, 5vmin, 36px)",
        textAlign: "center",
      } as CSSStyleDeclaration);
      const icon = document.createElement("span");
      Object.assign(icon.style, { fontSize: "clamp(15px, 2.6vmin, 20px)" });
      const text = document.createElement("span");
      Object.assign(text.style, {
        flex: "1",
        lineHeight: "1.3",
        color: "#fde047",
        fontWeight: "bold",
      });
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "✕";
      Object.assign(close.style, {
        background: "transparent",
        color: "#94a3b8",
        border: "1px solid #475569",
        borderRadius: "4px",
        cursor: "pointer",
        width: "22px",
        height: "22px",
        fontSize: "11px",
        fontFamily: "inherit",
        marginLeft: "4px",
      } as CSSStyleDeclaration);
      close.addEventListener("click", () => {
        this.tutorialDismissed = true;
        this.tutorialEl?.remove();
        this.tutorialEl = undefined;
      });
      el.append(stepNum, icon, text, close);
      document.body.append(el);
      this.tutorialEl = el;
      this.tutorialStepNumEl = stepNum;
      this.tutorialIconEl = icon;
      this.tutorialTextEl = text;
    }
    const def = TUTORIAL_STEPS[step];
    if (!def) return;
    const touch = this.isTouchDevice();
    if (this.tutorialStepNumEl)
      this.tutorialStepNumEl.textContent = `${step + 1}/${TUTORIAL_STEPS.length}`;
    if (this.tutorialIconEl) this.tutorialIconEl.textContent = def.icon;
    if (this.tutorialTextEl)
      this.tutorialTextEl.textContent = touch ? def.mobile : def.pc;
  }

  private sendAllocateSkill(skillId: string) {
    if (!this.room) return;
    this.room.send("allocateSkill", { skillId });
  }

  private toggleSkillTreePanel() {
    if (this.skillTreePanel.isVisible()) this.skillTreePanel.hide();
    else {
      this.refreshSkillTreePanel();
      this.skillTreePanel.show();
    }
  }

  private refreshSkillTreePanel() {
    if (!this.room) return;
    const state = this.room.state as any;
    const me = state?.players?.get?.(this.mySessionId);
    if (!me) return;
    const levels: Record<string, number> = {};
    me.skillLevels?.forEach?.((lv: number, id: string) => {
      levels[id] = lv;
    });
    this.skillTreePanel.update({
      skillPoints: me.skillPoints ?? 0,
      levels,
    });
  }

  private refreshCharacterPanel() {
    if (!this.room) return;
    const state = this.room.state as any;
    const me = state?.players?.get?.(this.mySessionId);
    if (!me) return;
    this.characterPanel.setView({
      name: me.name ?? "영웅",
      classId: me.classId ?? "warrior",
      level: me.level,
      exp: me.exp,
      expNext: expToNextLevel(me.level),
      hp: me.hp,
      mp: me.mp,
      gold: me.gold,
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

  /**
   * Sandworm / eel ranged attack — a bolt streaks from monster to target.
   * Per monster type the colour theme changes (sand for sandworm, electric
   * cyan for eel, default purple for anything else).
   */
  private showMonsterBoltFx(msg: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    monsterType?: string;
  }) {
    if (this.currentMap == null) return;
    const palette: Record<string, { core: number; glow: number }> = {
      sandworm: { core: 0xfde68a, glow: 0xf59e0b },
      eel: { core: 0xa7f3d0, glow: 0x06b6d4 },
    };
    const { core, glow } = palette[msg.monsterType ?? ""] ?? {
      core: 0xddd6fe,
      glow: 0x7c3aed,
    };
    // Outer glow line
    const outer = this.add.graphics().setDepth(99998);
    outer.lineStyle(7, glow, 0.45);
    outer.beginPath();
    outer.moveTo(msg.fromX, msg.fromY);
    outer.lineTo(msg.toX, msg.toY);
    outer.strokePath();
    // Bright core line
    const inner = this.add.graphics().setDepth(99999);
    inner.lineStyle(2.5, core, 1);
    inner.beginPath();
    inner.moveTo(msg.fromX, msg.fromY);
    inner.lineTo(msg.toX, msg.toY);
    inner.strokePath();
    // Impact burst at the target
    const burst = this.add.graphics().setDepth(99999);
    burst.fillStyle(core, 0.9);
    burst.fillCircle(msg.toX, msg.toY, 5);
    burst.fillStyle(glow, 0.45);
    burst.fillCircle(msg.toX, msg.toY, 11);
    [outer, inner, burst].forEach((g) =>
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 260,
        onComplete: () => g.destroy(),
      })
    );
    this.tweens.add({
      targets: burst,
      scale: 1.6,
      duration: 260,
    });
  }

  /**
   * Golem ground slam — expanding ring at the slam centre, dust puff and
   * brief camera shake when the centre is on this map.
   */
  private showMonsterSlamFx(msg: {
    x: number;
    y: number;
    radius: number;
    monsterType?: string;
  }) {
    if (this.currentMap == null) return;
    // Bright initial flash
    const flash = this.add.graphics().setDepth(99998);
    flash.fillStyle(0xfff3cd, 0.65);
    flash.fillCircle(msg.x, msg.y, msg.radius * 0.5);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 240,
      onComplete: () => flash.destroy(),
    });
    // Expanding shock ring
    const ring = this.add.graphics().setDepth(99998);
    ring.lineStyle(5, 0xfde68a, 0.95);
    ring.strokeCircle(msg.x, msg.y, 8);
    ring.lineStyle(2.5, 0xfffbeb, 0.7);
    ring.strokeCircle(msg.x, msg.y, 14);
    // Crude "scale" by retweening a custom property each frame
    let r = 8;
    const tweenObj = { r };
    this.tweens.add({
      targets: tweenObj,
      r: msg.radius,
      duration: 380,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(5, 0xfde68a, Math.max(0, 0.95 * (1 - tweenObj.r / msg.radius)));
        ring.strokeCircle(msg.x, msg.y, tweenObj.r);
        ring.lineStyle(2.5, 0xfffbeb, Math.max(0, 0.6 * (1 - tweenObj.r / msg.radius)));
        ring.strokeCircle(msg.x, msg.y, tweenObj.r + 6);
      },
      onComplete: () => ring.destroy(),
    });
    // Dust puffs scattered around the slam
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const d = msg.radius * (0.4 + Math.random() * 0.4);
      const px = msg.x + Math.cos(a) * d;
      const py = msg.y + Math.sin(a) * d;
      const puff = this.add.graphics().setDepth(99997);
      puff.fillStyle(0xd6c69a, 0.65);
      puff.fillCircle(px, py, 4 + Math.random() * 3);
      this.tweens.add({
        targets: puff,
        alpha: 0,
        x: puff.x + (Math.cos(a) * 8),
        y: puff.y + (Math.sin(a) * 4) - 4,
        duration: 480 + Math.random() * 160,
        onComplete: () => puff.destroy(),
      });
    }
    // Camera shake when the slam centre is reasonably close to me
    const me = this.sprites.get(this.mySessionId ?? "");
    if (me) {
      const d = Math.hypot(me.sprite.x - msg.x, me.sprite.y - msg.y);
      if (d < msg.radius * 2) {
        const power = Math.max(0.003, 0.012 * (1 - d / (msg.radius * 2)));
        this.cameras.main.shake(220, power);
      }
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

    const meSprite = this.sprites.get(this.mySessionId)?.sprite;
    this.monsters.forEach((m, mid) => {
      m.sprite.x += (m.targetX - m.sprite.x) * t;
      m.sprite.y += (m.targetY - m.sprite.y) * t;
      m.sprite.setDepth(m.sprite.y);
      const def = MONSTER_DEFS[m.type];
      const hpY = m.sprite.y - def.radius * 2 - 6;
      m.hpBg.x = m.sprite.x;
      m.hpBg.y = hpY;
      m.hpFill.x = m.sprite.x - 10;
      m.hpFill.y = hpY;
      // Boss banner — first time you get within 240px of a boss
      if (m.boss && meSprite && m.mapId === this.currentMap) {
        const d = Math.hypot(m.sprite.x - meSprite.x, m.sprite.y - meSprite.y);
        if (d < 240) this.maybeShowBossBanner(mid, m);
      }
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
    if (this.skillTreePanel?.isVisible()) {
      this.refreshSkillTreePanel();
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
