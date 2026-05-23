import type { StatKey } from "@pr/shared";

/**
 * D2-style attribute allocation panel. Opened by tapping the
 * "stat points available" badge near the player level display.
 */

interface StatRow {
  key: StatKey;
  label: string;
  description: string;
  valueEl: HTMLSpanElement;
  derivedEl: HTMLSpanElement;
  plusBtn: HTMLButtonElement;
}

export interface PlayerStatView {
  level: number;
  statPoints: number;
  vit: number;
  mnd: number;
  str: number;
  qck: number;
  maxHp: number;
  maxMp: number;
  damage: number;
  speed: number;
}

export class CharacterPanel {
  private overlay: HTMLDivElement;
  private panel: HTMLDivElement;
  private title: HTMLDivElement;
  private points: HTMLSpanElement;
  private rows: Record<StatKey, StatRow>;
  private listener: ((key: StatKey) => void) | null = null;
  private visible = false;

  constructor(parent: HTMLElement = document.body) {
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.55)",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "35",
      pointerEvents: "auto",
    } as CSSStyleDeclaration);
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.panel = document.createElement("div");
    Object.assign(this.panel.style, {
      width: "min(360px, 90vw)",
      maxHeight: "min(560px, 88vh)",
      overflowY: "auto",
      background: "linear-gradient(180deg, #2a1006, #120705)",
      border: "3px solid rgba(252,165,165,0.7)",
      borderRadius: "10px",
      padding: "18px",
      boxShadow:
        "0 12px 30px rgba(0,0,0,0.7), inset 0 0 12px rgba(0,0,0,0.5)",
      fontFamily: "monospace",
      color: "#fff",
    } as CSSStyleDeclaration);

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "12px",
    } as CSSStyleDeclaration);

    this.title = document.createElement("div");
    this.title.textContent = "ATTRIBUTES";
    Object.assign(this.title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      color: "#fde047",
      letterSpacing: "3px",
    } as CSSStyleDeclaration);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    Object.assign(closeBtn.style, {
      background: "transparent",
      border: "none",
      color: "#a8a29e",
      fontSize: "20px",
      cursor: "pointer",
      fontFamily: "monospace",
    } as CSSStyleDeclaration);
    closeBtn.addEventListener("click", () => this.close());

    header.appendChild(this.title);
    header.appendChild(closeBtn);

    const pointsRow = document.createElement("div");
    Object.assign(pointsRow.style, {
      textAlign: "center",
      padding: "8px",
      marginBottom: "10px",
      background: "rgba(0,0,0,0.4)",
      borderRadius: "6px",
      fontSize: "12px",
      letterSpacing: "1px",
    } as CSSStyleDeclaration);
    this.points = document.createElement("span");
    this.points.textContent = "0";
    Object.assign(this.points.style, {
      color: "#fde047",
      fontWeight: "bold",
      fontSize: "16px",
    } as CSSStyleDeclaration);
    pointsRow.append("Points to spend: ", this.points);

    this.rows = {} as Record<StatKey, StatRow>;
    this.panel.appendChild(header);
    this.panel.appendChild(pointsRow);
    this.addRow("vit", "Vitality", "+HP / sturdier body");
    this.addRow("mnd", "Mind", "+Mana / faster casting");
    this.addRow("str", "Strength", "+Damage per swing");
    this.addRow("qck", "Quickness", "+Move speed");

    this.overlay.appendChild(this.panel);
    parent.appendChild(this.overlay);
  }

  private addRow(key: StatKey, label: string, description: string) {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: "8px",
      alignItems: "center",
      padding: "10px 6px",
      borderTop: "1px solid rgba(255,255,255,0.08)",
    } as CSSStyleDeclaration);

    const info = document.createElement("div");
    const labelEl = document.createElement("div");
    labelEl.innerHTML = `<b style="color:#fca5a5">${label}</b>`;
    Object.assign(labelEl.style, { fontSize: "13px" } as CSSStyleDeclaration);

    const valueRow = document.createElement("div");
    Object.assign(valueRow.style, {
      fontSize: "11px",
      color: "#cbd5e1",
      marginTop: "2px",
    } as CSSStyleDeclaration);
    const valueEl = document.createElement("span");
    valueEl.textContent = "0";
    Object.assign(valueEl.style, {
      color: "#fde047",
      fontWeight: "bold",
    } as CSSStyleDeclaration);
    const derivedEl = document.createElement("span");
    derivedEl.textContent = "";
    Object.assign(derivedEl.style, {
      color: "#94a3b8",
      marginLeft: "8px",
    } as CSSStyleDeclaration);
    valueRow.append("Pts: ", valueEl, derivedEl);

    const descEl = document.createElement("div");
    descEl.textContent = description;
    Object.assign(descEl.style, {
      fontSize: "10px",
      color: "#71717a",
      marginTop: "2px",
    } as CSSStyleDeclaration);

    info.appendChild(labelEl);
    info.appendChild(valueRow);
    info.appendChild(descEl);

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.textContent = "+";
    Object.assign(plusBtn.style, {
      width: "40px",
      height: "40px",
      borderRadius: "8px",
      border: "2px solid rgba(248,113,113,0.95)",
      background:
        "linear-gradient(180deg, rgba(127,29,29,0.92), rgba(60,10,10,0.97))",
      color: "#fde047",
      fontSize: "22px",
      fontWeight: "bold",
      cursor: "pointer",
      touchAction: "manipulation",
    } as CSSStyleDeclaration);
    plusBtn.addEventListener("click", () => this.listener?.(key));

    row.appendChild(info);
    row.appendChild(plusBtn);
    this.panel.appendChild(row);

    this.rows[key] = { key, label, description, valueEl, derivedEl, plusBtn };
  }

  setView(v: PlayerStatView) {
    this.title.textContent = `LEVEL ${v.level}  ATTRIBUTES`;
    this.points.textContent = String(v.statPoints);

    const setRow = (key: StatKey, value: number, derived: string) => {
      const r = this.rows[key];
      r.valueEl.textContent = String(value);
      r.derivedEl.textContent = `  →  ${derived}`;
      r.plusBtn.disabled = v.statPoints <= 0;
      r.plusBtn.style.opacity = v.statPoints > 0 ? "1" : "0.4";
      r.plusBtn.style.cursor = v.statPoints > 0 ? "pointer" : "default";
    };

    setRow("vit", v.vit, `Max HP ${v.maxHp}`);
    setRow("mnd", v.mnd, `Max MP ${v.maxMp}`);
    setRow("str", v.str, `DMG ${v.damage}`);
    setRow("qck", v.qck, `SPD ${v.speed}`);
  }

  onPlus(fn: (key: StatKey) => void) {
    this.listener = fn;
  }

  open() {
    this.visible = true;
    this.overlay.style.display = "flex";
  }
  close() {
    this.visible = false;
    this.overlay.style.display = "none";
  }
  isOpen() {
    return this.visible;
  }

  destroy() {
    this.overlay.remove();
  }
}
