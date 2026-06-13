import {
  ITEMS,
  type ItemDef,
  type ItemRarity,
  type ItemSlot,
  RARITY,
  SLOT_LABEL,
  SLOT_ORDER,
  INVENTORY,
  itemFullName,
  itemStats,
  canEquip,
  WEAPON_CLASS_LABEL,
} from "@pr/shared";

/**
 * Inventory panel — App-Store grade rewrite.
 *
 * UI structure (vertical):
 *   1. Cinzel header w/ floating ✕ close.
 *   2. Four equipment slots themed by purpose (weapon ⚔ / head 🪖 /
 *      chest 🛡 / ring 💍). Each shows its current item or an empty
 *      placeholder; selection state is reflected by an animated glow.
 *   3. Total equipment-bonus summary (Damage · Max HP · Max MP · Speed).
 *   4. "BACKPACK" divider + 6×N grid of bag slots.
 *   5. Bottom detail card — appears only when an item is selected.
 *      Shows name (rarity-colored), slot, stat lines and class
 *      restriction warnings. Three action buttons:  [장착 / 해제]
 *      [버리기]  [✕].
 *
 * Interaction model (clear, single-tap):
 *   - Tap a bag item        → select it (detail card appears)
 *   - Tap an equipment slot → select that equipped item
 *   - Click [장착]           → equip the selected bag item (server validates)
 *   - Click [해제]           → unequip the selected equipped item
 *   - Click [버리기]         → drop the selected item
 *   - Tap outside the panel → close
 *
 * Replaces the old "tap once to arm, tap again to drop" double-tap
 * pattern which was confusing on touch.
 *
 * Inherits global polish from `ui/premium.ts`:
 *   .pr-panel  → gold conic-gradient shimmer border + one-shot shine sweep
 *   .pr-btn    → cursor spotlight + click ripple
 */

export interface InventoryItemView {
  /** Unique inventory instance id (server-assigned). */
  id: string;
  itemId: string;
  rarity: ItemRarity;
}

export type EquipmentView = Partial<Record<ItemSlot, InventoryItemView>>;

type ActionCallback = (instId: string) => void;
type UnequipCallback = (slot: ItemSlot) => void;

const SLOT_ICON: Record<ItemSlot, string> = {
  weapon: "⚔",
  head: "♚",
  chest: "✠",
  ring: "◉",
};

const STYLES_INJECTED = Symbol.for("pr-inventory-styles-installed");
function installStyles() {
  const w = window as unknown as Record<symbol, true | undefined>;
  if (w[STYLES_INJECTED]) return;
  w[STYLES_INJECTED] = true;
  const css = `
    @keyframes pr-inv-pop {
      0%   { opacity: 0; transform: translateY(10px) scale(0.97); }
      100% { opacity: 1; transform: translateY(0)   scale(1); }
    }
    @keyframes pr-inv-fadein {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pr-inv-shine {
      0%   { transform: translateX(-110%); }
      100% { transform: translateX(110%); }
    }
    .pr-inv-overlay { animation: pr-inv-fadein 200ms ease; }
    .pr-inv-panel   { animation: pr-inv-pop     320ms cubic-bezier(0.2, 0.95, 0.4, 1); }
    .pr-inv-slot {
      position: relative;
      transition: transform 160ms cubic-bezier(0.2, 0.9, 0.3, 1),
                  border-color 160ms ease,
                  box-shadow   200ms ease;
      overflow: hidden;
    }
    .pr-inv-slot:hover { transform: translateY(-1px); }
    .pr-inv-slot.pr-inv-selected {
      animation: pr-inv-fadein 220ms ease;
    }
    .pr-inv-detail {
      animation: pr-inv-fadein 240ms cubic-bezier(0.2, 0.9, 0.3, 1);
    }
  `;
  const tag = document.createElement("style");
  tag.textContent = css;
  document.head.appendChild(tag);
}

export class InventoryPanel {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  private equipRow: HTMLDivElement;
  private bagGrid: HTMLDivElement;
  private statSummary: HTMLDivElement;
  private detail: HTMLDivElement;
  private bagCountEl: HTMLSpanElement;
  private equipCb: ActionCallback = () => {};
  private unequipCb: UnequipCallback = () => {};
  private dropCb: ActionCallback = () => {};
  /** Currently selected item — drives the detail panel. */
  private selected:
    | { kind: "bag"; inst: InventoryItemView }
    | { kind: "equipped"; slot: ItemSlot; inst: InventoryItemView }
    | null = null;
  private inventory: InventoryItemView[] = [];
  private equipment: EquipmentView = {};
  /** Owning character class — drives weapon-restriction rendering. */
  private classId: string = "warrior";

  constructor() {
    installStyles();

    /* ── Overlay ───────────────────────────────────────────────── */
    this.root = document.createElement("div");
    this.root.className = "pr-inv-overlay";
    Object.assign(this.root.style, {
      position: "fixed",
      inset: "0",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      background:
        "radial-gradient(circle at 50% 30%, rgba(60,20,10,0.55), rgba(0,0,0,0.86))",
      zIndex: "60",
      padding: "16px",
      backdropFilter: "blur(10px) saturate(120%)",
    } as unknown as CSSStyleDeclaration);
    (this.root.style as unknown as {
      webkitBackdropFilter?: string;
    }).webkitBackdropFilter = "blur(10px) saturate(120%)";
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.hide();
    });

    /* ── Main panel ────────────────────────────────────────────── */
    this.panel = document.createElement("div");
    this.panel.className = "pr-panel pr-inv-panel";
    Object.assign(this.panel.style, {
      position: "relative",
      width: "min(460px, 96vw)",
      maxHeight: "92vh",
      overflow: "hidden auto",
      padding: "0",
      color: "var(--pr-parchment)",
      borderRadius: "10px",
      background:
        "linear-gradient(180deg, rgba(28,16,24,0.94), rgba(11,7,13,0.97))",
      boxShadow:
        "0 24px 60px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,152,52,0.18), inset 0 0 36px rgba(0,0,0,0.65), inset 0 1px 0 rgba(252,209,64,0.15)",
      display: "flex",
      flexDirection: "column",
    } as unknown as CSSStyleDeclaration);

    /* ── Close ─────────────────────────────────────────────────── */
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.title = "Close";
    Object.assign(closeBtn.style, {
      position: "absolute",
      top: "12px",
      right: "12px",
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      border: "1px solid rgba(200,152,52,0.4)",
      background: "rgba(0,0,0,0.6)",
      color: "var(--pr-gold)",
      fontSize: "13px",
      cursor: "pointer",
      fontFamily: "var(--pr-display)",
      zIndex: "3",
      transition: "all 150ms ease",
    } as unknown as CSSStyleDeclaration);
    closeBtn.onmouseenter = () => {
      closeBtn.style.color = "var(--pr-gold-bright)";
      closeBtn.style.borderColor = "var(--pr-gold-bright)";
      closeBtn.style.transform = "rotate(90deg)";
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.color = "var(--pr-gold)";
      closeBtn.style.borderColor = "rgba(200,152,52,0.4)";
      closeBtn.style.transform = "rotate(0)";
    };
    closeBtn.addEventListener("click", () => this.hide());
    this.panel.appendChild(closeBtn);

    /* ── Header ─────────────────────────────────────────────── */
    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "20px 22px 14px",
      borderBottom: "1px solid rgba(200,152,52,0.2)",
      display: "flex",
      alignItems: "baseline",
      gap: "12px",
    } as unknown as CSSStyleDeclaration);
    const title = document.createElement("div");
    title.textContent = "인벤토리";
    Object.assign(title.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "20px",
      fontWeight: "700",
      letterSpacing: "6px",
      color: "var(--pr-gold-bright)",
      textShadow: "0 0 14px rgba(252,209,64,0.45), 0 2px 4px #000",
    } as unknown as CSSStyleDeclaration);
    const titleSub = document.createElement("div");
    titleSub.textContent = "장비와 가방";
    Object.assign(titleSub.style, {
      fontFamily: "var(--pr-story)",
      fontStyle: "italic",
      fontSize: "12px",
      color: "var(--pr-gold)",
      opacity: "0.7",
    } as unknown as CSSStyleDeclaration);
    header.append(title, titleSub);
    this.panel.appendChild(header);

    /* ── Content area (scrollable) ─────────────────────────────── */
    const content = document.createElement("div");
    Object.assign(content.style, {
      padding: "16px 20px 18px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    } as unknown as CSSStyleDeclaration);

    /* Equipment row */
    const eqLabel = this.makeDivider("장비");
    this.equipRow = document.createElement("div");
    Object.assign(this.equipRow.style, {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "9px",
    } as unknown as CSSStyleDeclaration);

    /* Stat summary */
    this.statSummary = document.createElement("div");
    Object.assign(this.statSummary.style, {
      padding: "10px 12px",
      borderRadius: "6px",
      border: "1px solid rgba(200,152,52,0.22)",
      background:
        "linear-gradient(180deg, rgba(20,12,18,0.6), rgba(8,5,10,0.85))",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "6px 14px",
      fontFamily: "var(--pr-mono, ui-monospace, monospace)",
      fontSize: "12px",
      lineHeight: "1.4",
    } as unknown as CSSStyleDeclaration);

    /* Backpack */
    const bagHead = document.createElement("div");
    Object.assign(bagHead.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      marginTop: "4px",
    } as unknown as CSSStyleDeclaration);
    const bagDivL = this.dividerLine();
    const bagTitle = document.createElement("div");
    bagTitle.innerHTML = `가방 <span style="opacity:0.7; font-size:11px"></span>`;
    Object.assign(bagTitle.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "12px",
      letterSpacing: "6px",
      color: "var(--pr-gold)",
      textShadow: "0 0 8px rgba(252,209,64,0.25)",
      display: "flex",
      alignItems: "baseline",
      gap: "6px",
    } as unknown as CSSStyleDeclaration);
    this.bagCountEl =
      bagTitle.querySelector("span") as HTMLSpanElement;
    const bagDivR = this.dividerLine();
    bagHead.append(bagDivL, bagTitle, bagDivR);
    this.bagGrid = document.createElement("div");
    Object.assign(this.bagGrid.style, {
      display: "grid",
      gridTemplateColumns: "repeat(6, 1fr)",
      gap: "6px",
    } as unknown as CSSStyleDeclaration);

    /* Detail panel (hidden until something is selected) */
    this.detail = document.createElement("div");
    this.detail.className = "pr-inv-detail";
    this.detail.style.display = "none";

    content.append(
      eqLabel,
      this.equipRow,
      this.statSummary,
      bagHead,
      this.bagGrid,
      this.detail
    );
    this.panel.appendChild(content);

    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);

    this.renderEquipment();
    this.renderBag();
    this.renderStats();
  }

  /* ── Public API (unchanged) ───────────────────────────────────── */

  onEquip(cb: ActionCallback)   { this.equipCb = cb; }
  onUnequip(cb: UnequipCallback) { this.unequipCb = cb; }
  onDrop(cb: ActionCallback)    { this.dropCb = cb; }

  setClassId(classId: string) {
    this.classId = classId;
    this.renderBag();
    this.renderDetail();
  }

  setInventory(items: InventoryItemView[]) {
    this.inventory = items;
    // If the selected bag instance vanished (server removed it),
    // clear the detail panel.
    if (this.selected?.kind === "bag") {
      const stillThere = items.find((i) => i.id === this.selected!.inst.id);
      if (!stillThere) this.selected = null;
    }
    this.renderBag();
    this.renderStats();
    this.renderDetail();
  }

  setEquipment(eq: EquipmentView) {
    this.equipment = eq;
    if (this.selected?.kind === "equipped") {
      const cur = eq[this.selected.slot];
      if (!cur || cur.id !== this.selected.inst.id) this.selected = null;
    }
    this.renderEquipment();
    this.renderStats();
    this.renderDetail();
  }

  isOpen(): boolean {
    return this.root.style.display !== "none";
  }
  toggle() { this.isOpen() ? this.hide() : this.show(); }
  show()  { this.root.style.display = "flex"; }
  hide()  { this.root.style.display = "none"; this.selected = null; this.renderDetail(); }
  destroy() { this.root.remove(); }

  /* ── Private renderers ────────────────────────────────────────── */

  private makeDivider(text: string): HTMLDivElement {
    const head = document.createElement("div");
    Object.assign(head.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    } as unknown as CSSStyleDeclaration);
    const l = this.dividerLine();
    const t = document.createElement("div");
    t.textContent = text;
    Object.assign(t.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "12px",
      letterSpacing: "6px",
      color: "var(--pr-gold)",
      textShadow: "0 0 8px rgba(252,209,64,0.25)",
    } as unknown as CSSStyleDeclaration);
    const r = this.dividerLine();
    head.append(l, t, r);
    return head;
  }
  private dividerLine(): HTMLDivElement {
    const d = document.createElement("div");
    Object.assign(d.style, {
      flex: "1",
      height: "1px",
      background:
        "linear-gradient(90deg, transparent, rgba(200,152,52,0.6), transparent)",
    } as unknown as CSSStyleDeclaration);
    return d;
  }

  private renderEquipment() {
    this.equipRow.innerHTML = "";
    for (const slot of SLOT_ORDER) {
      const inst = this.equipment[slot];
      const cell = this.makeSlotCell({
        inst,
        emptyLabel: SLOT_LABEL[slot],
        emptyIcon: SLOT_ICON[slot],
        kind: "equipped",
        slot,
      });
      this.equipRow.appendChild(cell);
    }
  }

  private renderBag() {
    this.bagGrid.innerHTML = "";
    for (let i = 0; i < INVENTORY.MAX_SLOTS; i++) {
      const inst = this.inventory[i];
      const cell = this.makeSlotCell({
        inst,
        emptyLabel: "",
        emptyIcon: "",
        kind: "bag",
      });
      this.bagGrid.appendChild(cell);
    }
    this.bagCountEl.textContent = `${this.inventory.length} / ${INVENTORY.MAX_SLOTS}`;
  }

  private renderStats() {
    let damage = 0, maxHp = 0, maxMp = 0, speed = 0;
    for (const slot of SLOT_ORDER) {
      const inst = this.equipment[slot];
      if (!inst) continue;
      const s = itemStats(inst.itemId, inst.rarity);
      damage += s.damage; maxHp += s.maxHp;
      maxMp  += s.maxMp;  speed += s.speed;
    }
    const tile = (icon: string, label: string, value: number, color: string) => {
      const sign = value >= 0 ? "+" : "";
      return (
        `<div style="display:flex; align-items:center; gap:6px;">` +
        `<span style="color:${color}; font-size:14px; width:14px; text-align:center; filter:drop-shadow(0 0 4px ${color}55)">${icon}</span>` +
        `<span style="color:var(--pr-gold); font-family:var(--pr-display); font-size:9px; letter-spacing:2px; flex:1;">${label}</span>` +
        `<span style="color:${color}; font-weight:700; font-family:var(--pr-display);">${sign}${value}</span>` +
        `</div>`
      );
    };
    this.statSummary.innerHTML =
      tile("⚔", "DAMAGE",  damage, "#fb923c") +
      tile("♥", "MAX HP",  maxHp,  "#ef4444") +
      tile("✦", "MAX MP",  maxMp,  "#60a5fa") +
      tile("❯", "SPEED",   speed,  "#34d399");
  }

  private renderDetail() {
    if (!this.selected) {
      this.detail.style.display = "none";
      this.detail.innerHTML = "";
      return;
    }
    const { inst } = this.selected;
    const def = (ITEMS as Record<string, ItemDef>)[inst.itemId];
    if (!def) {
      this.detail.style.display = "none";
      return;
    }
    const s = itemStats(inst.itemId, inst.rarity);
    const color = RARITY.COLOR[inst.rarity];
    const isEquipped = this.selected.kind === "equipped";
    const locked =
      !isEquipped &&
      def.slot === "weapon" &&
      def.weaponClass !== undefined &&
      !canEquip(this.classId, inst.itemId);

    const statLine = (n: number, label: string, col: string, sign = true) => {
      if (!n) return "";
      const prefix = sign && n > 0 ? "+" : "";
      return (
        `<div style="display:flex; gap:6px; align-items:baseline;">` +
        `<span style="color:${col}; font-weight:700; font-family:var(--pr-display); min-width:48px;">${prefix}${n}</span>` +
        `<span style="font-size:11px; color:#94a3b8; letter-spacing:2px;">${label}</span>` +
        `</div>`
      );
    };

    this.detail.style.display = "flex";
    Object.assign(this.detail.style, {
      marginTop: "8px",
      padding: "14px 14px 12px",
      borderRadius: "6px",
      border: `1px solid ${color}66`,
      background:
        `linear-gradient(180deg, ${color}1a 0%, rgba(8,5,10,0.85) 70%)`,
      boxShadow: `inset 0 0 12px ${color}22, 0 2px 8px rgba(0,0,0,0.4)`,
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    } as unknown as CSSStyleDeclaration);

    this.detail.innerHTML = `
      <div>
        <div style="display:flex; gap:6px; align-items:baseline; flex-wrap:wrap;">
          <span style="color:${color}; font-family:var(--pr-display); font-size:16px; font-weight:700; letter-spacing:2px; text-shadow:0 0 10px ${color}66;">
            ${escapeHtml(itemFullName(inst.itemId, inst.rarity))}
          </span>
        </div>
        <div style="font-family:var(--pr-story); font-style:italic; font-size:11px; color:#94a3b8; letter-spacing:1px; margin-top:2px;">
          ${escapeHtml(SLOT_LABEL[def.slot])}
          ${def.weaponClass ? `<span style="opacity:0.6; margin-left:8px;">· ${escapeHtml(WEAPON_CLASS_LABEL[def.weaponClass])}</span>` : ""}
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        ${statLine(s.damage, "데미지",  "#fb923c")}
        ${statLine(s.maxHp,  "최대 HP", "#ef4444")}
        ${statLine(s.maxMp,  "최대 MP", "#60a5fa")}
        ${statLine(s.speed,  "이속",     "#34d399")}
      </div>
      ${locked
        ? `<div style="padding:6px 8px; border-radius:4px; background:rgba(127,29,29,0.45); border:1px solid rgba(220,38,38,0.6); color:#fecaca; font-size:11px; letter-spacing:0.5px;">
             이 직업은 ${escapeHtml(WEAPON_CLASS_LABEL[def.weaponClass!])}을(를) 사용할 수 없습니다.
           </div>`
        : ""}
      <div id="pr-inv-actions" style="display:flex; gap:8px; margin-top:2px;"></div>
    `;

    const actions = this.detail.querySelector(
      "#pr-inv-actions"
    ) as HTMLDivElement;

    // Primary action: equip / unequip
    if (isEquipped) {
      actions.appendChild(
        this.makeActionButton("해제", color, () => {
          if (this.selected?.kind === "equipped") {
            this.unequipCb(this.selected.slot);
          }
        })
      );
    } else if (!locked) {
      actions.appendChild(
        this.makeActionButton("장착", color, () => {
          if (this.selected?.kind === "bag") {
            this.equipCb(this.selected.inst.id);
          }
        })
      );
    }
    // Drop is always available (gives users an out)
    actions.appendChild(
      this.makeActionButton("버리기", "#ef4444", () => {
        if (this.selected) this.dropCb(this.selected.inst.id);
      }, /*danger*/ true)
    );
  }

  private makeActionButton(
    label: string,
    color: string,
    onClick: () => void,
    danger = false
  ): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.className = "pr-btn";
    Object.assign(b.style, {
      flex: "1",
      padding: "10px 14px",
      borderRadius: "5px",
      border: `1.5px solid ${color}`,
      background: danger
        ? "linear-gradient(180deg, rgba(127,29,29,0.85), rgba(60,10,10,0.95))"
        : "linear-gradient(180deg, rgba(40,28,16,0.9), rgba(20,12,8,0.95))",
      color: danger ? "#fecaca" : "var(--pr-gold-bright)",
      fontFamily: "var(--pr-display)",
      fontSize: "12px",
      letterSpacing: "4px",
      fontWeight: "700",
      cursor: "pointer",
      transition: "transform 140ms ease, box-shadow 200ms ease",
      boxShadow: `0 2px 8px rgba(0,0,0,0.5), 0 0 12px ${color}33`,
    } as unknown as CSSStyleDeclaration);
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  private makeSlotCell(opts: {
    inst: InventoryItemView | undefined;
    emptyLabel: string;
    emptyIcon: string;
    kind: "bag" | "equipped";
    slot?: ItemSlot;
  }): HTMLDivElement {
    const { inst, emptyLabel, emptyIcon, kind, slot } = opts;
    const cell = document.createElement("div");
    cell.className = "pr-inv-slot";
    const isSelected =
      (kind === "bag" &&
        this.selected?.kind === "bag" &&
        this.selected.inst.id === inst?.id) ||
      (kind === "equipped" &&
        this.selected?.kind === "equipped" &&
        this.selected.slot === slot);

    Object.assign(cell.style, {
      position: "relative",
      aspectRatio: "1",
      borderRadius: "5px",
      background:
        "radial-gradient(circle at 30% 25%, rgba(40,28,18,0.6), rgba(8,5,10,0.85))",
      border: "1.5px solid rgba(200,152,52,0.22)",
      boxShadow: "inset 0 0 12px rgba(0,0,0,0.55)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      cursor: inst ? "pointer" : "default",
      padding: "4px",
      overflow: "hidden",
    } as unknown as CSSStyleDeclaration);

    if (!inst) {
      // Empty slot — show stylised slot icon + label
      if (emptyIcon) {
        const ic = document.createElement("div");
        ic.textContent = emptyIcon;
        Object.assign(ic.style, {
          fontSize: "22px",
          color: "rgba(252,209,64,0.32)",
          textShadow: "0 1px 2px #000",
        } as unknown as CSSStyleDeclaration);
        cell.appendChild(ic);
      }
      if (emptyLabel) {
        const label = document.createElement("div");
        label.textContent = emptyLabel;
        Object.assign(label.style, {
          fontFamily: "var(--pr-display)",
          fontSize: "9px",
          color: "rgba(200,152,52,0.55)",
          letterSpacing: "2px",
          marginTop: "2px",
        } as unknown as CSSStyleDeclaration);
        cell.appendChild(label);
      }
      return cell;
    }

    const def = (ITEMS as Record<string, ItemDef>)[inst.itemId];
    if (!def) return cell;

    const rcolor = RARITY.COLOR[inst.rarity];
    cell.style.borderColor = rcolor;
    cell.style.boxShadow =
      `inset 0 0 12px rgba(0,0,0,0.55), 0 0 10px ${rcolor}33`;

    // Selected ring
    if (isSelected) {
      cell.classList.add("pr-inv-selected");
      cell.style.boxShadow =
        `inset 0 0 0 2px ${rcolor}, 0 0 16px ${rcolor}88, inset 0 0 12px rgba(0,0,0,0.4)`;
      cell.style.transform = "translateY(-1px)";
    }

    // Body icon — coloured rounded rect with a subtle inner gloss
    const icon = document.createElement("div");
    const hexColor = `#${def.color.toString(16).padStart(6, "0")}`;
    Object.assign(icon.style, {
      width: "62%",
      aspectRatio: "1",
      borderRadius: "4px",
      background:
        `linear-gradient(160deg, ${hexColor} 0%, ${hexColor}cc 50%, ${darken(def.color, -0.25)} 100%)`,
      boxShadow:
        `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 6px rgba(0,0,0,0.45), 0 0 10px ${rcolor}55`,
    } as unknown as CSSStyleDeclaration);
    cell.appendChild(icon);

    // Tiny name label
    const nm = document.createElement("div");
    nm.textContent = itemFullName(inst.itemId, inst.rarity);
    Object.assign(nm.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "8px",
      color: rcolor,
      marginTop: "3px",
      textAlign: "center",
      lineHeight: "1",
      maxWidth: "100%",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      letterSpacing: "0.5px",
      textShadow: "0 1px 2px #000",
    } as unknown as CSSStyleDeclaration);
    cell.appendChild(nm);

    // Rarity gem in the corner
    if (inst.rarity !== "common") {
      const gem = document.createElement("div");
      Object.assign(gem.style, {
        position: "absolute",
        top: "3px",
        right: "3px",
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: rcolor,
        boxShadow: `0 0 6px ${rcolor}, 0 0 12px ${rcolor}66`,
      } as unknown as CSSStyleDeclaration);
      cell.appendChild(gem);
    }

    // Weapon class lock for bag items
    if (
      kind === "bag" &&
      def.slot === "weapon" &&
      def.weaponClass !== undefined &&
      !canEquip(this.classId, inst.itemId)
    ) {
      icon.style.filter = "grayscale(0.85) brightness(0.5)";
      nm.style.opacity = "0.55";
      const lock = document.createElement("div");
      lock.textContent = WEAPON_CLASS_LABEL[def.weaponClass];
      Object.assign(lock.style, {
        position: "absolute",
        bottom: "3px",
        left: "3px",
        right: "3px",
        textAlign: "center",
        fontFamily: "var(--pr-display)",
        fontSize: "8px",
        padding: "1px 0",
        borderRadius: "2px",
        background: "rgba(127,29,29,0.85)",
        color: "#fecaca",
        letterSpacing: "1px",
        border: "1px solid rgba(220,38,38,0.7)",
        pointerEvents: "none",
        fontWeight: "bold",
      } as unknown as CSSStyleDeclaration);
      cell.appendChild(lock);
      cell.style.cursor = "not-allowed";
    }

    cell.title = this.tooltipText(inst);

    cell.addEventListener("click", (e) => {
      e.stopPropagation();
      if (kind === "equipped" && slot) {
        this.selected = { kind: "equipped", slot, inst };
      } else {
        this.selected = { kind: "bag", inst };
      }
      this.renderEquipment();
      this.renderBag();
      this.renderDetail();
    });

    return cell;
  }

  private tooltipText(inst: InventoryItemView): string {
    const def = (ITEMS as Record<string, ItemDef>)[inst.itemId];
    if (!def) return "";
    const s = itemStats(inst.itemId, inst.rarity);
    const lines = [
      itemFullName(inst.itemId, inst.rarity),
      `${SLOT_LABEL[def.slot]} · ${inst.rarity}`,
    ];
    if (s.damage) lines.push(`DMG ${s.damage > 0 ? "+" : ""}${s.damage}`);
    if (s.maxHp)  lines.push(`HP  ${s.maxHp  > 0 ? "+" : ""}${s.maxHp}`);
    if (s.maxMp)  lines.push(`MP  ${s.maxMp  > 0 ? "+" : ""}${s.maxMp}`);
    if (s.speed)  lines.push(`SPD ${s.speed  > 0 ? "+" : ""}${s.speed}`);
    return lines.join("\n");
  }
}

/* ── Small helpers ────────────────────────────────────────────── */

function darken(hex: number, amount: number): string {
  // amount: -1..1 (negative = darker)
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const m = 1 + amount;
  const c = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v * m)))
      .toString(16)
      .padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" : "&quot;"
  );
}
