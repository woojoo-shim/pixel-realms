import { CLASSES, type StatKey } from "@pr/shared";

/**
 * Stat / character sheet panel. Uses the shared design tokens
 * (.pr-panel, .pr-btn, Cinzel/IM Fell English) so it visually matches
 * the menu and character creation modals.
 */

interface StatRow {
  key: StatKey;
  valueEl: HTMLDivElement;
  derivedEl: HTMLDivElement;
  plusBtn: HTMLButtonElement;
}

export interface PlayerStatView {
  name: string;
  classId: string;
  level: number;
  exp: number;
  expNext: number;
  hp: number;
  mp: number;
  gold: number;
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

/** Visual theme per stat. */
const STAT_THEME: Record<
  StatKey,
  { icon: string; name: string; tagline: string; color: string; accent: string }
> = {
  vit: {
    icon: "♥",
    name: "Vitality",
    tagline: "건장한 체력 — 더 많은 HP",
    color: "#ef4444",
    accent: "rgba(239,68,68,0.4)",
  },
  mnd: {
    icon: "✦",
    name: "Mind",
    tagline: "맑은 정신 — 더 많은 MP",
    color: "#60a5fa",
    accent: "rgba(96,165,250,0.4)",
  },
  str: {
    icon: "⚔",
    name: "Strength",
    tagline: "강한 일격 — 더 큰 데미지",
    color: "#fb923c",
    accent: "rgba(251,146,60,0.4)",
  },
  qck: {
    icon: "❯",
    name: "Quickness",
    tagline: "재빠른 발 — 더 빠른 이동",
    color: "#34d399",
    accent: "rgba(52,211,153,0.4)",
  },
};

const STAT_ORDER: StatKey[] = ["vit", "mnd", "str", "qck"];

export class CharacterPanel {
  private overlay: HTMLDivElement;
  private panel: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private classLineEl: HTMLDivElement;
  private portraitEl: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private hpText: HTMLSpanElement;
  private mpFill: HTMLDivElement;
  private mpText: HTMLSpanElement;
  private expFill: HTMLDivElement;
  private expText: HTMLSpanElement;
  private pointsEl: HTMLDivElement;
  private goldEl: HTMLSpanElement;
  private rows: Record<StatKey, StatRow>;
  private listener: ((key: StatKey) => void) | null = null;
  private visible = false;

  constructor(parent: HTMLElement = document.body) {
    // ── Overlay (dimmed backdrop, click-to-close) ───────────────────
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.72)",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "35",
      pointerEvents: "auto",
      padding: "16px",
      backdropFilter: "blur(2px)",
    } as CSSStyleDeclaration);
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    // ── Main panel ──────────────────────────────────────────────────
    this.panel = document.createElement("div");
    this.panel.className = "pr-panel pr-fade-in";
    Object.assign(this.panel.style, {
      width: "min(420px, 94vw)",
      maxHeight: "92vh",
      overflowY: "auto",
      padding: "24px 22px 22px",
      color: "var(--pr-parchment)",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    } as CSSStyleDeclaration);

    // ── Close button ────────────────────────────────────────────────
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    Object.assign(closeBtn.style, {
      position: "absolute",
      top: "10px",
      right: "10px",
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      border: "1px solid rgba(200,152,52,0.5)",
      background: "rgba(0,0,0,0.6)",
      color: "var(--pr-gold)",
      fontSize: "14px",
      cursor: "pointer",
      fontFamily: "var(--pr-display)",
      zIndex: "2",
    } as CSSStyleDeclaration);
    closeBtn.onmouseenter = () => {
      closeBtn.style.color = "var(--pr-gold-bright)";
      closeBtn.style.borderColor = "var(--pr-gold-bright)";
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.color = "var(--pr-gold)";
      closeBtn.style.borderColor = "rgba(200,152,52,0.5)";
    };
    closeBtn.addEventListener("click", () => this.close());
    this.panel.appendChild(closeBtn);

    // ── Header: portrait + name + class line ────────────────────────
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      gap: "14px",
      alignItems: "center",
      paddingBottom: "12px",
      borderBottom: "1px solid rgba(200,152,52,0.25)",
    } as CSSStyleDeclaration);

    this.portraitEl = document.createElement("div");
    Object.assign(this.portraitEl.style, {
      width: "64px",
      height: "64px",
      flexShrink: "0",
      borderRadius: "50%",
      fontSize: "34px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "2px solid var(--pr-gold)",
      boxShadow:
        "inset 0 0 12px rgba(0,0,0,0.7), 0 0 16px rgba(252,209,64,0.25)",
      background:
        "radial-gradient(circle at 40% 30%, #3a2410, #0b070d 70%)",
    } as CSSStyleDeclaration);

    const nameWrap = document.createElement("div");
    Object.assign(nameWrap.style, {
      flex: "1",
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    } as CSSStyleDeclaration);
    this.nameEl = document.createElement("div");
    Object.assign(this.nameEl.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "22px",
      fontWeight: "700",
      letterSpacing: "4px",
      color: "var(--pr-gold-bright)",
      textShadow: "0 0 12px rgba(252,209,64,0.5)",
      lineHeight: "1.1",
    } as CSSStyleDeclaration);
    this.classLineEl = document.createElement("div");
    Object.assign(this.classLineEl.style, {
      fontFamily: "var(--pr-story)",
      fontSize: "12px",
      letterSpacing: "3px",
      color: "var(--pr-gold)",
    } as CSSStyleDeclaration);
    nameWrap.append(this.nameEl, this.classLineEl);
    header.append(this.portraitEl, nameWrap);
    this.panel.appendChild(header);

    // ── HP / MP / EXP bars ──────────────────────────────────────────
    const bars = document.createElement("div");
    Object.assign(bars.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    } as CSSStyleDeclaration);

    const hp = this.makeBar("HP", "#dc2626", "#f87171");
    const mp = this.makeBar("MP", "#1d4ed8", "#60a5fa");
    const exp = this.makeBar("EXP", "#92400e", "#fbbf24");
    this.hpFill = hp.fill;
    this.hpText = hp.text;
    this.mpFill = mp.fill;
    this.mpText = mp.text;
    this.expFill = exp.fill;
    this.expText = exp.text;
    bars.append(hp.row, mp.row, exp.row);
    this.panel.appendChild(bars);

    // ── Gold + stat-points row ──────────────────────────────────────
    const meta = document.createElement("div");
    Object.assign(meta.style, {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "8px",
    } as CSSStyleDeclaration);

    const goldBox = this.makeMetaBox("💰", "GOLD", "var(--pr-gold-bright)");
    this.goldEl = goldBox.value;
    const ptsBox = this.makeMetaBox("✦", "POINTS", "#fde047");
    this.pointsEl = ptsBox.value;
    meta.append(goldBox.box, ptsBox.box);
    this.panel.appendChild(meta);

    // ── Stat rows ───────────────────────────────────────────────────
    this.rows = {} as Record<StatKey, StatRow>;
    const statsHeader = document.createElement("div");
    statsHeader.textContent = "스탯";
    Object.assign(statsHeader.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "13px",
      letterSpacing: "6px",
      color: "var(--pr-gold)",
      marginTop: "6px",
      textAlign: "center",
    } as CSSStyleDeclaration);
    this.panel.appendChild(statsHeader);

    for (const key of STAT_ORDER) {
      this.addRow(key);
    }

    this.overlay.appendChild(this.panel);
    parent.appendChild(this.overlay);
  }

  private makeBar(
    label: string,
    bgColor: string,
    fillColor: string
  ): { row: HTMLDivElement; fill: HTMLDivElement; text: HTMLSpanElement } {
    const row = document.createElement("div");
    Object.assign(row.style, {
      position: "relative",
      height: "20px",
      borderRadius: "3px",
      background: "rgba(0,0,0,0.7)",
      border: `1px solid ${bgColor}`,
      overflow: "hidden",
      boxShadow: "inset 0 1px 4px rgba(0,0,0,0.7)",
    } as CSSStyleDeclaration);
    const fill = document.createElement("div");
    Object.assign(fill.style, {
      position: "absolute",
      left: "0",
      top: "0",
      height: "100%",
      width: "0%",
      background: `linear-gradient(180deg, ${fillColor}, ${bgColor})`,
      transition: "width 220ms ease",
      boxShadow: `0 0 8px ${fillColor}`,
    } as CSSStyleDeclaration);
    const text = document.createElement("span");
    Object.assign(text.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--pr-display)",
      fontSize: "11px",
      letterSpacing: "2px",
      color: "#fff",
      textShadow: "0 0 6px #000, 0 1px 2px #000",
      fontWeight: "700",
    } as CSSStyleDeclaration);
    text.textContent = `${label}  0 / 0`;
    row.append(fill, text);
    (text as HTMLSpanElement & { _label?: string })._label = label;
    return { row, fill, text };
  }

  private setBar(
    fill: HTMLDivElement,
    text: HTMLSpanElement,
    cur: number,
    max: number
  ) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
    fill.style.width = `${pct}%`;
    const label = (text as HTMLSpanElement & { _label?: string })._label ?? "";
    text.textContent = `${label}  ${Math.round(cur)} / ${Math.round(max)}`;
  }

  private makeMetaBox(
    icon: string,
    label: string,
    color: string
  ): { box: HTMLDivElement; value: HTMLDivElement } {
    const box = document.createElement("div");
    Object.assign(box.style, {
      padding: "8px 10px",
      borderRadius: "4px",
      border: "1px solid rgba(200,152,52,0.3)",
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    } as CSSStyleDeclaration);
    const ic = document.createElement("div");
    ic.textContent = icon;
    Object.assign(ic.style, {
      fontSize: "18px",
      color: color,
    } as CSSStyleDeclaration);
    const right = document.createElement("div");
    Object.assign(right.style, {
      flex: "1",
      display: "flex",
      flexDirection: "column",
      lineHeight: "1.1",
    } as CSSStyleDeclaration);
    const lbl = document.createElement("div");
    lbl.textContent = label;
    Object.assign(lbl.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "9px",
      letterSpacing: "3px",
      color: "var(--pr-gold)",
    } as CSSStyleDeclaration);
    const value = document.createElement("div");
    value.textContent = "0";
    Object.assign(value.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "16px",
      fontWeight: "700",
      letterSpacing: "1.5px",
      color: color,
    } as CSSStyleDeclaration);
    right.append(lbl, value);
    box.append(ic, right);
    return { box, value };
  }

  private addRow(key: StatKey) {
    const theme = STAT_THEME[key];
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "grid",
      gridTemplateColumns: "44px 1fr auto",
      gap: "12px",
      alignItems: "center",
      padding: "10px 8px",
      borderRadius: "4px",
      border: "1px solid rgba(200,152,52,0.18)",
      background: "rgba(8,5,12,0.55)",
      transition: "all 0.15s ease",
    } as CSSStyleDeclaration);
    row.addEventListener("mouseenter", () => {
      row.style.borderColor = theme.color;
      row.style.background = "rgba(20,12,18,0.75)";
    });
    row.addEventListener("mouseleave", () => {
      row.style.borderColor = "rgba(200,152,52,0.18)";
      row.style.background = "rgba(8,5,12,0.55)";
    });

    // Icon disk
    const icon = document.createElement("div");
    icon.textContent = theme.icon;
    Object.assign(icon.style, {
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      background: `radial-gradient(circle at 40% 30%, ${theme.color}, #0b070d 80%)`,
      border: `2px solid ${theme.color}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
      color: "#fff",
      textShadow: "0 0 6px #000",
      boxShadow: `inset 0 0 8px rgba(0,0,0,0.7), 0 0 10px ${theme.accent}`,
    } as CSSStyleDeclaration);

    // Info column
    const info = document.createElement("div");
    Object.assign(info.style, {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    } as CSSStyleDeclaration);

    const nameRow = document.createElement("div");
    Object.assign(nameRow.style, {
      display: "flex",
      alignItems: "baseline",
      gap: "10px",
    } as CSSStyleDeclaration);
    const name = document.createElement("div");
    name.textContent = theme.name;
    Object.assign(name.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "14px",
      letterSpacing: "3px",
      fontWeight: "700",
      color: theme.color,
    } as CSSStyleDeclaration);
    const valueEl = document.createElement("div");
    valueEl.textContent = "0";
    Object.assign(valueEl.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "18px",
      fontWeight: "900",
      letterSpacing: "1px",
      color: "var(--pr-gold-bright)",
    } as CSSStyleDeclaration);
    nameRow.append(name, valueEl);

    const derivedEl = document.createElement("div");
    Object.assign(derivedEl.style, {
      fontFamily: "var(--pr-story)",
      fontSize: "11px",
      color: "#94a3b8",
      letterSpacing: "1.5px",
    } as CSSStyleDeclaration);

    const tag = document.createElement("div");
    tag.textContent = theme.tagline;
    Object.assign(tag.style, {
      fontFamily: "var(--pr-body)",
      fontSize: "10px",
      color: "#71717a",
      letterSpacing: "1px",
    } as CSSStyleDeclaration);

    info.append(nameRow, derivedEl, tag);

    // + button
    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.textContent = "+";
    Object.assign(plusBtn.style, {
      width: "44px",
      height: "44px",
      borderRadius: "50%",
      border: `2px solid ${theme.color}`,
      background: "rgba(0,0,0,0.7)",
      color: theme.color,
      fontSize: "22px",
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: "var(--pr-display)",
      touchAction: "manipulation",
      transition: "all 0.12s ease",
      boxShadow: `0 0 0 1px var(--pr-ink) inset, 0 0 10px ${theme.accent}`,
    } as CSSStyleDeclaration);
    plusBtn.addEventListener("mouseenter", () => {
      if (plusBtn.disabled) return;
      plusBtn.style.background = theme.color;
      plusBtn.style.color = "#0b070d";
      plusBtn.style.transform = "scale(1.05)";
    });
    plusBtn.addEventListener("mouseleave", () => {
      plusBtn.style.background = "rgba(0,0,0,0.7)";
      plusBtn.style.color = theme.color;
      plusBtn.style.transform = "scale(1)";
    });
    plusBtn.addEventListener("click", () => this.listener?.(key));

    row.append(icon, info, plusBtn);
    this.panel.appendChild(row);
    this.rows[key] = { key, valueEl, derivedEl, plusBtn };
  }

  setView(v: PlayerStatView) {
    // Header
    const def = CLASSES.find((c) => c.id === v.classId);
    this.nameEl.textContent = v.name || "영웅";
    this.classLineEl.textContent = def
      ? `${def.name}  ·  Lv ${v.level}`
      : `Lv ${v.level}`;
    this.portraitEl.textContent = def?.icon ?? "⚔";
    if (def) {
      this.portraitEl.style.borderColor = `hsl(${def.suggestedHue}, 70%, 55%)`;
      this.portraitEl.style.boxShadow =
        "inset 0 0 12px rgba(0,0,0,0.7), 0 0 16px " +
        `hsla(${def.suggestedHue}, 70%, 55%, 0.45)`;
    }
    // Bars
    this.setBar(this.hpFill, this.hpText, v.hp, v.maxHp);
    this.setBar(this.mpFill, this.mpText, v.mp, v.maxMp);
    this.setBar(this.expFill, this.expText, v.exp, v.expNext);
    // Gold / points
    this.goldEl.textContent = String(v.gold);
    this.pointsEl.textContent = String(v.statPoints);
    this.pointsEl.style.color = v.statPoints > 0 ? "#fde047" : "#71717a";

    const setRow = (key: StatKey, value: number, derived: string) => {
      const r = this.rows[key];
      r.valueEl.textContent = String(value);
      r.derivedEl.textContent = `→  ${derived}`;
      r.plusBtn.disabled = v.statPoints <= 0;
      r.plusBtn.style.opacity = v.statPoints > 0 ? "1" : "0.35";
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
