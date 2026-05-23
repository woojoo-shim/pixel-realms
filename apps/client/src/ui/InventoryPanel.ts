import {
  ITEMS,
  type ItemDef,
  type ItemId,
  type ItemRarity,
  type ItemSlot,
  RARITY,
  SLOT_LABEL,
  SLOT_ORDER,
  INVENTORY,
  itemFullName,
  itemStats,
} from "@pr/shared";

export interface InventoryItemView {
  /** Unique inventory instance id (server-assigned). */
  id: string;
  itemId: string;
  rarity: ItemRarity;
}

export type EquipmentView = Partial<Record<ItemSlot, InventoryItemView>>;

type ActionCallback = (instId: string) => void;
type UnequipCallback = (slot: ItemSlot) => void;

/** Sliding panel showing equipment + backpack. Mobile-friendly: tap-to-toggle. */
export class InventoryPanel {
  private root: HTMLDivElement;
  private bagGrid: HTMLDivElement;
  private equipRow: HTMLDivElement;
  private statSummary: HTMLDivElement;
  private equipCb: ActionCallback = () => {};
  private unequipCb: UnequipCallback = () => {};
  private dropCb: ActionCallback = () => {};
  /** When set, tapping again on this slot will execute the action and clear it. */
  private pendingId: string | null = null;
  private inventory: InventoryItemView[] = [];
  private equipment: EquipmentView = {};

  constructor() {
    const root = document.createElement("div");
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(2px)",
      zIndex: "60",
      fontFamily: "monospace",
      color: "#e2e8f0",
    });
    root.addEventListener("click", (e) => {
      if (e.target === root) this.hide();
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      width: "min(440px, 92vw)",
      maxHeight: "92vh",
      overflow: "auto",
      background: "linear-gradient(180deg, #181014, #0f0a0e)",
      border: "3px solid #5e2c2c",
      borderRadius: "10px",
      padding: "14px",
      boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
    });

    // Header
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "10px",
    });
    const title = document.createElement("div");
    title.textContent = "INVENTORY";
    Object.assign(title.style, {
      fontSize: "16px",
      letterSpacing: "3px",
      color: "#fde047",
    });
    const close = document.createElement("button");
    close.textContent = "×";
    Object.assign(close.style, {
      width: "32px",
      height: "32px",
      background: "rgba(127,29,29,0.7)",
      border: "2px solid rgba(248,113,113,0.7)",
      borderRadius: "6px",
      color: "#fff",
      fontSize: "20px",
      fontWeight: "bold",
      cursor: "pointer",
    });
    close.onclick = () => this.hide();
    header.appendChild(title);
    header.appendChild(close);

    // Equipment row
    this.equipRow = document.createElement("div");
    Object.assign(this.equipRow.style, {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "8px",
      marginBottom: "12px",
    });

    // Stats summary
    this.statSummary = document.createElement("div");
    Object.assign(this.statSummary.style, {
      background: "rgba(0,0,0,0.45)",
      padding: "8px 10px",
      borderRadius: "6px",
      fontSize: "11px",
      lineHeight: "1.5",
      marginBottom: "10px",
      color: "#cbd5e1",
    });

    // Bag grid
    const bagLabel = document.createElement("div");
    bagLabel.textContent = "BACKPACK";
    Object.assign(bagLabel.style, {
      fontSize: "11px",
      letterSpacing: "2px",
      color: "#94a3b8",
      marginBottom: "6px",
    });
    this.bagGrid = document.createElement("div");
    Object.assign(this.bagGrid.style, {
      display: "grid",
      gridTemplateColumns: "repeat(6, 1fr)",
      gap: "5px",
    });

    // Footer hint
    const hint = document.createElement("div");
    hint.innerHTML =
      "Tap bag item ↦ equip · Tap equipped ↦ unequip · Tap twice ↦ drop";
    Object.assign(hint.style, {
      fontSize: "10px",
      color: "#64748b",
      marginTop: "10px",
      textAlign: "center",
    });

    panel.appendChild(header);
    panel.appendChild(this.equipRow);
    panel.appendChild(this.statSummary);
    panel.appendChild(bagLabel);
    panel.appendChild(this.bagGrid);
    panel.appendChild(hint);
    root.appendChild(panel);
    document.body.appendChild(root);
    this.root = root;

    this.renderEquipment();
    this.renderBag();
    this.renderStats();
  }

  onEquip(cb: ActionCallback) {
    this.equipCb = cb;
  }
  onUnequip(cb: UnequipCallback) {
    this.unequipCb = cb;
  }
  onDrop(cb: ActionCallback) {
    this.dropCb = cb;
  }

  setInventory(items: InventoryItemView[]) {
    this.inventory = items;
    this.renderBag();
    this.renderStats();
  }

  setEquipment(eq: EquipmentView) {
    this.equipment = eq;
    this.renderEquipment();
    this.renderStats();
  }

  isOpen(): boolean {
    return this.root.style.display !== "none";
  }

  toggle() {
    this.isOpen() ? this.hide() : this.show();
  }

  show() {
    this.root.style.display = "flex";
    this.pendingId = null;
  }

  hide() {
    this.root.style.display = "none";
    this.pendingId = null;
  }

  destroy() {
    this.root.remove();
  }

  private renderEquipment() {
    this.equipRow.innerHTML = "";
    for (const slot of SLOT_ORDER) {
      const inst = this.equipment[slot];
      const cell = this.makeSlotCell({
        inst,
        emptyLabel: SLOT_LABEL[slot],
        isEquipped: true,
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
        isEquipped: false,
      });
      this.bagGrid.appendChild(cell);
    }
  }

  private renderStats() {
    let damage = 0;
    let maxHp = 0;
    let maxMp = 0;
    let speed = 0;
    for (const slot of SLOT_ORDER) {
      const inst = this.equipment[slot];
      if (!inst) continue;
      const s = itemStats(inst.itemId, inst.rarity);
      damage += s.damage;
      maxHp += s.maxHp;
      maxMp += s.maxMp;
      speed += s.speed;
    }
    const fmt = (n: number, color = "#cbd5e1") =>
      `<span style="color:${color}">${n >= 0 ? "+" : ""}${n}</span>`;
    this.statSummary.innerHTML =
      `<b style="color:#fde047">Equipment Bonus</b><br>` +
      `⚔ Damage ${fmt(damage, "#fca5a5")} &nbsp; ` +
      `❤ Max HP ${fmt(maxHp, "#86efac")}<br>` +
      `✦ Max MP ${fmt(maxMp, "#93c5fd")} &nbsp; ` +
      `→ Speed ${fmt(speed, "#fcd34d")}`;
  }

  private makeSlotCell(opts: {
    inst: InventoryItemView | undefined;
    emptyLabel: string;
    isEquipped: boolean;
    slot?: ItemSlot;
  }): HTMLDivElement {
    const { inst, emptyLabel, isEquipped, slot } = opts;
    const cell = document.createElement("div");
    Object.assign(cell.style, {
      aspectRatio: "1",
      background: "rgba(0,0,0,0.55)",
      border: "2px solid rgba(94,44,44,0.7)",
      borderRadius: "6px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      cursor: inst ? "pointer" : "default",
      padding: "2px",
      position: "relative",
      overflow: "hidden",
    });

    if (!inst) {
      if (emptyLabel) {
        const label = document.createElement("div");
        label.textContent = emptyLabel;
        Object.assign(label.style, {
          fontSize: "9px",
          color: "#64748b",
          letterSpacing: "1px",
        });
        cell.appendChild(label);
      }
      return cell;
    }

    const def = (ITEMS as Record<string, ItemDef>)[inst.itemId];
    if (!def) return cell;

    // Rarity border
    cell.style.borderColor = RARITY.COLOR[inst.rarity];

    // Icon (colored square per item type)
    const icon = document.createElement("div");
    Object.assign(icon.style, {
      width: "60%",
      height: "60%",
      background: `#${def.color.toString(16).padStart(6, "0")}`,
      borderRadius: "3px",
      boxShadow: `0 0 8px ${RARITY.COLOR[inst.rarity]}66`,
    });
    cell.appendChild(icon);

    // Name (tiny)
    const nm = document.createElement("div");
    nm.textContent = itemFullName(inst.itemId, inst.rarity);
    Object.assign(nm.style, {
      fontSize: "8px",
      color: RARITY.COLOR[inst.rarity],
      marginTop: "2px",
      textAlign: "center",
      lineHeight: "1",
      maxWidth: "100%",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    });
    cell.appendChild(nm);

    // Pending visual ring
    if (this.pendingId === inst.id) {
      cell.style.boxShadow = `inset 0 0 0 3px ${RARITY.COLOR[inst.rarity]}`;
    }

    // Tooltip on hover (desktop)
    cell.title = this.tooltipText(inst);

    cell.onclick = (e) => {
      e.stopPropagation();
      if (isEquipped && slot) {
        // Equipped: first tap unequips; double-tap (within pending) drops.
        if (this.pendingId === inst.id) {
          this.pendingId = null;
          this.dropCb(inst.id);
        } else {
          this.pendingId = null;
          this.unequipCb(slot);
        }
      } else {
        // Bag: first tap equips; double-tap drops.
        if (this.pendingId === inst.id) {
          this.pendingId = null;
          this.dropCb(inst.id);
        } else {
          this.pendingId = inst.id;
          this.renderBag();
          this.renderEquipment();
          // Auto-clear pending after a moment so single-tap doesn't lurk forever
          setTimeout(() => {
            if (this.pendingId === inst.id) {
              this.pendingId = null;
              this.equipCb(inst.id);
              this.renderBag();
              this.renderEquipment();
            }
          }, 250);
        }
      }
    };

    return cell;
  }

  private tooltipText(inst: InventoryItemView): string {
    const def = (ITEMS as Record<string, ItemDef>)[inst.itemId];
    if (!def) return "";
    const s = itemStats(inst.itemId, inst.rarity);
    const lines = [
      itemFullName(inst.itemId, inst.rarity),
      `Slot: ${SLOT_LABEL[def.slot]}  ·  Rarity: ${inst.rarity}`,
    ];
    if (s.damage) lines.push(`Damage ${s.damage > 0 ? "+" : ""}${s.damage}`);
    if (s.maxHp) lines.push(`Max HP ${s.maxHp > 0 ? "+" : ""}${s.maxHp}`);
    if (s.maxMp) lines.push(`Max MP ${s.maxMp > 0 ? "+" : ""}${s.maxMp}`);
    if (s.speed) lines.push(`Speed ${s.speed > 0 ? "+" : ""}${s.speed}`);
    return lines.join("\n");
  }
}
