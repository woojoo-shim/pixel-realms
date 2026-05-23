import {
  ITEMS,
  type ItemDef,
  type ItemRarity,
  RARITY,
  VENDOR,
  itemFullName,
  sellPriceFor,
} from "@pr/shared";

export interface VendorItemView {
  id: string;
  itemId: string;
  rarity: ItemRarity;
}

type SellCb = (instId: string) => void;
type BuyPotionCb = () => void;

/** Town vendor — buy potions for gold, sell unwanted items. */
export class VendorPanel {
  private root: HTMLDivElement;
  private buyTab: HTMLDivElement;
  private sellTab: HTMLDivElement;
  private goldBadge: HTMLDivElement;
  private potionsBadge: HTMLDivElement;
  private buyBody: HTMLDivElement;
  private sellBody: HTMLDivElement;
  private currentTab: "buy" | "sell" = "buy";
  private buyCb: BuyPotionCb = () => {};
  private sellCb: SellCb = () => {};
  private inventory: VendorItemView[] = [];
  private gold = 0;
  private potions = 0;

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
      width: "min(420px, 92vw)",
      maxHeight: "90vh",
      display: "flex",
      flexDirection: "column",
      background: "linear-gradient(180deg, #1a1410, #0e0a07)",
      border: "3px solid #8b5a2b",
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
    title.textContent = "MERCHANT";
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
      background: "rgba(127,73,29,0.7)",
      border: "2px solid rgba(245,158,11,0.7)",
      borderRadius: "6px",
      color: "#fff",
      fontSize: "20px",
      fontWeight: "bold",
      cursor: "pointer",
    });
    close.onclick = () => this.hide();
    header.appendChild(title);
    header.appendChild(close);

    // Balance bar
    const balance = document.createElement("div");
    Object.assign(balance.style, {
      display: "flex",
      gap: "10px",
      fontSize: "12px",
      marginBottom: "10px",
    });
    this.goldBadge = document.createElement("div");
    this.potionsBadge = document.createElement("div");
    [this.goldBadge, this.potionsBadge].forEach((el) =>
      Object.assign(el.style, {
        background: "rgba(0,0,0,0.5)",
        padding: "4px 10px",
        borderRadius: "4px",
        border: "1px solid rgba(245,158,11,0.4)",
      } as CSSStyleDeclaration)
    );
    balance.appendChild(this.goldBadge);
    balance.appendChild(this.potionsBadge);

    // Tabs row
    const tabs = document.createElement("div");
    Object.assign(tabs.style, {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "4px",
      marginBottom: "10px",
    });
    this.buyTab = this.makeTab("BUY", "buy");
    this.sellTab = this.makeTab("SELL", "sell");
    tabs.appendChild(this.buyTab);
    tabs.appendChild(this.sellTab);

    // Tab bodies
    this.buyBody = document.createElement("div");
    this.sellBody = document.createElement("div");
    Object.assign(this.buyBody.style, {
      flex: "1",
      overflow: "auto",
      paddingRight: "4px",
    });
    Object.assign(this.sellBody.style, {
      flex: "1",
      overflow: "auto",
      paddingRight: "4px",
      display: "none",
    });

    panel.appendChild(header);
    panel.appendChild(balance);
    panel.appendChild(tabs);
    panel.appendChild(this.buyBody);
    panel.appendChild(this.sellBody);
    root.appendChild(panel);
    document.body.appendChild(root);
    this.root = root;

    this.renderBuy();
    this.renderSell();
    this.refreshBalance();
  }

  private makeTab(label: string, key: "buy" | "sell"): HTMLDivElement {
    const t = document.createElement("div");
    t.textContent = label;
    Object.assign(t.style, {
      padding: "8px 0",
      textAlign: "center",
      cursor: "pointer",
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(245,158,11,0.4)",
      borderRadius: "4px",
      fontSize: "12px",
      letterSpacing: "2px",
      fontWeight: "bold",
    } as CSSStyleDeclaration);
    t.onclick = () => this.switchTab(key);
    return t;
  }

  private switchTab(key: "buy" | "sell") {
    this.currentTab = key;
    this.buyTab.style.background =
      key === "buy" ? "rgba(245,158,11,0.4)" : "rgba(0,0,0,0.4)";
    this.sellTab.style.background =
      key === "sell" ? "rgba(245,158,11,0.4)" : "rgba(0,0,0,0.4)";
    this.buyBody.style.display = key === "buy" ? "block" : "none";
    this.sellBody.style.display = key === "sell" ? "block" : "none";
  }

  onBuyPotion(cb: BuyPotionCb) {
    this.buyCb = cb;
  }
  onSell(cb: SellCb) {
    this.sellCb = cb;
  }
  setBalance(gold: number, potions: number) {
    this.gold = gold;
    this.potions = potions;
    this.refreshBalance();
  }
  setInventory(items: VendorItemView[]) {
    this.inventory = items;
    this.renderSell();
  }
  isOpen() {
    return this.root.style.display !== "none";
  }
  show() {
    this.root.style.display = "flex";
    this.switchTab(this.currentTab);
  }
  hide() {
    this.root.style.display = "none";
  }
  destroy() {
    this.root.remove();
  }

  private refreshBalance() {
    this.goldBadge.innerHTML = `<span style='color:#fde047'>●</span> ${this.gold}g`;
    this.potionsBadge.innerHTML = `<span style='color:#f87171'>🧪</span> ${this.potions}`;
  }

  private renderBuy() {
    this.buyBody.innerHTML = "";
    const row = this.makeShopRow({
      icon: "🧪",
      iconColor: "#f87171",
      name: "HP Potion",
      desc: "Restores 40% of your max HP.",
      price: VENDOR.POTION_PRICE,
      onClick: () => this.buyCb(),
    });
    this.buyBody.appendChild(row);
  }

  private renderSell() {
    this.sellBody.innerHTML = "";
    if (this.inventory.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "Your bag is empty.";
      Object.assign(empty.style, {
        textAlign: "center",
        padding: "30px 0",
        color: "#64748b",
        fontSize: "12px",
      });
      this.sellBody.appendChild(empty);
      return;
    }
    for (const inst of this.inventory) {
      const def = (ITEMS as Record<string, ItemDef>)[inst.itemId];
      if (!def) continue;
      const price = sellPriceFor(inst.itemId, inst.rarity);
      const colorHex = `#${def.color.toString(16).padStart(6, "0")}`;
      const row = this.makeShopRow({
        icon: "■",
        iconColor: colorHex,
        name: itemFullName(inst.itemId, inst.rarity),
        nameColor: RARITY.COLOR[inst.rarity],
        desc: this.itemStatLine(inst.itemId, inst.rarity),
        price,
        sellLabel: "Sell",
        onClick: () => this.sellCb(inst.id),
      });
      this.sellBody.appendChild(row);
    }
  }

  private itemStatLine(itemId: string, rarity: ItemRarity): string {
    const def = (ITEMS as Record<string, ItemDef>)[itemId];
    if (!def) return "";
    const m = RARITY.MULT[rarity];
    const parts: string[] = [];
    if (def.stats.damage)
      parts.push(`⚔ ${Math.round(def.stats.damage * m)}`);
    if (def.stats.maxHp) parts.push(`❤ ${Math.round(def.stats.maxHp * m)}`);
    if (def.stats.maxMp) parts.push(`✦ ${Math.round(def.stats.maxMp * m)}`);
    if (def.stats.speed)
      parts.push(`→ ${Math.round(def.stats.speed * m)}`);
    return parts.join("  ");
  }

  private makeShopRow(opts: {
    icon: string;
    iconColor: string;
    name: string;
    nameColor?: string;
    desc: string;
    price: number;
    sellLabel?: string;
    onClick: () => void;
  }): HTMLDivElement {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px",
      marginBottom: "6px",
      background: "rgba(0,0,0,0.45)",
      borderRadius: "6px",
      border: "1px solid rgba(245,158,11,0.25)",
    });
    const ic = document.createElement("div");
    ic.textContent = opts.icon;
    Object.assign(ic.style, {
      width: "30px",
      height: "30px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
      color: opts.iconColor,
      background: "rgba(0,0,0,0.4)",
      borderRadius: "4px",
    });
    const body = document.createElement("div");
    Object.assign(body.style, { flex: "1", minWidth: "0" });
    const nameEl = document.createElement("div");
    nameEl.textContent = opts.name;
    Object.assign(nameEl.style, {
      fontSize: "13px",
      color: opts.nameColor ?? "#fde047",
      fontWeight: "bold",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    });
    const desc = document.createElement("div");
    desc.textContent = opts.desc;
    Object.assign(desc.style, {
      fontSize: "10px",
      color: "#94a3b8",
      marginTop: "2px",
    });
    body.appendChild(nameEl);
    body.appendChild(desc);
    const btn = document.createElement("button");
    btn.textContent = `${opts.sellLabel ?? "Buy"}  ${opts.price}g`;
    Object.assign(btn.style, {
      padding: "8px 14px",
      background: "linear-gradient(180deg, #b45309, #78350f)",
      border: "2px solid #fbbf24",
      borderRadius: "6px",
      color: "#fff",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "12px",
      cursor: "pointer",
    });
    btn.onclick = (e) => {
      e.stopPropagation();
      opts.onClick();
    };
    row.appendChild(ic);
    row.appendChild(body);
    row.appendChild(btn);
    return row;
  }
}
