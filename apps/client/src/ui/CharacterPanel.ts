import { CLASSES, type StatKey } from "@pr/shared";

/**
 * Premium character sheet panel.
 *
 * Visual goals:
 * - Real glassmorphism (backdrop-filter blur on a stained-glass tint)
 * - Multi-layer shadows and subtle grain for depth
 * - Tight typographic hierarchy: Cinzel display, IM Fell story, mono numerics
 * - Restrained colour use — class-tinted glow + per-stat accent only on the
 *   tiny accent strip and the icon, not entire backgrounds
 * - Animated entrance: panel pop-in + bars sweep from 0 + rows stagger
 */

interface StatRow {
  key: StatKey;
  card: HTMLDivElement;
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

const STAT_THEME: Record<
  StatKey,
  { icon: string; name: string; tagline: string; color: string }
> = {
  vit: {
    icon: "♥",
    name: "VITALITY",
    tagline: "건장한 체력",
    color: "#ef4444",
  },
  mnd: {
    icon: "✦",
    name: "MIND",
    tagline: "맑은 정신",
    color: "#60a5fa",
  },
  str: {
    icon: "⚔",
    name: "STRENGTH",
    tagline: "강한 일격",
    color: "#fb923c",
  },
  qck: {
    icon: "❯",
    name: "QUICKNESS",
    tagline: "재빠른 발",
    color: "#34d399",
  },
};

const STAT_ORDER: StatKey[] = ["vit", "mnd", "str", "qck"];

const RANK_TIERS = [
  { min: 1, label: "초심자" },
  { min: 5, label: "수습 영웅" },
  { min: 10, label: "베테랑" },
  { min: 20, label: "정예" },
  { min: 35, label: "전설" },
  { min: 50, label: "신화" },
];
function rankFor(level: number): string {
  let label = RANK_TIERS[0]!.label;
  for (const t of RANK_TIERS) if (level >= t.min) label = t.label;
  return label;
}

let _stylesInjected = false;
function injectStylesOnce() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const css = `
    @keyframes pr-cp-pop {
      0% { opacity: 0; transform: translateY(12px) scale(0.96); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes pr-cp-fadein {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .pr-cp-overlay {
      animation: pr-cp-fadein 200ms ease;
    }
    .pr-cp-panel {
      animation: pr-cp-pop 320ms cubic-bezier(0.2, 0.95, 0.4, 1);
    }
    .pr-cp-row {
      animation: pr-cp-fadein 360ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
    }
    .pr-cp-row:nth-child(1) { animation-delay: 60ms; }
    .pr-cp-row:nth-child(2) { animation-delay: 120ms; }
    .pr-cp-row:nth-child(3) { animation-delay: 180ms; }
    .pr-cp-row:nth-child(4) { animation-delay: 240ms; }
    .pr-cp-row:hover .pr-cp-icon {
      transform: scale(1.08) rotate(-3deg);
    }
    .pr-cp-icon {
      transition: transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1);
    }
    .pr-cp-plus:hover:not(:disabled) {
      transform: scale(1.08);
      filter: brightness(1.2);
    }
    .pr-cp-plus:active:not(:disabled) {
      transform: scale(0.94);
    }
  `;
  const tag = document.createElement("style");
  tag.textContent = css;
  document.head.appendChild(tag);
}

export class CharacterPanel {
  private overlay: HTMLDivElement;
  private panel: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private classLineEl: HTMLDivElement;
  private rankBadge: HTMLDivElement;
  private portraitEl: HTMLDivElement;
  private portraitGlow: HTMLDivElement;
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
    injectStylesOnce();

    // ── Overlay (heavier blur for premium glass feel) ───────────────
    this.overlay = document.createElement("div");
    this.overlay.className = "pr-cp-overlay";
    Object.assign(this.overlay.style, {
      position: "fixed",
      inset: "0",
      background:
        "radial-gradient(circle at 50% 35%, rgba(60,20,10,0.55), rgba(0,0,0,0.85))",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "35",
      pointerEvents: "auto",
      padding: "16px",
      backdropFilter: "blur(10px) saturate(120%)",
    } as unknown as CSSStyleDeclaration);
    // Vendor prefix for Safari
    (this.overlay.style as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter =
      "blur(10px) saturate(120%)";
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    // ── Main panel (gilded glass card) ──────────────────────────────
    this.panel = document.createElement("div");
    this.panel.className = "pr-panel pr-cp-panel";
    Object.assign(this.panel.style, {
      position: "relative",
      width: "min(420px, 94vw)",
      maxHeight: "92vh",
      overflowY: "auto",
      padding: "0",
      color: "var(--pr-parchment)",
      // Subtle stained-glass tint
      background:
        "linear-gradient(180deg, rgba(28,16,24,0.94), rgba(11,7,13,0.97))," +
        // tiny grain via inline svg data URL
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
      backgroundBlendMode: "normal, overlay",
      boxShadow:
        "0 24px 60px -10px rgba(0,0,0,0.7)," +
        "0 0 0 1px rgba(200,152,52,0.18)," +
        "inset 0 0 36px rgba(0,0,0,0.65)," +
        "inset 0 1px 0 rgba(252,209,64,0.15)",
      borderRadius: "10px",
      display: "flex",
      flexDirection: "column",
    } as CSSStyleDeclaration);

    // ── Close button ────────────────────────────────────────────────
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
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
    } as CSSStyleDeclaration);
    closeBtn.onmouseenter = () => {
      closeBtn.style.color = "var(--pr-gold-bright)";
      closeBtn.style.borderColor = "var(--pr-gold-bright)";
      closeBtn.style.transform = "scale(1.1) rotate(90deg)";
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.color = "var(--pr-gold)";
      closeBtn.style.borderColor = "rgba(200,152,52,0.4)";
      closeBtn.style.transform = "scale(1) rotate(0)";
    };
    closeBtn.addEventListener("click", () => this.close());
    this.panel.appendChild(closeBtn);

    // ── Hero banner: portrait + name + class + rank ─────────────────
    const hero = document.createElement("div");
    Object.assign(hero.style, {
      position: "relative",
      padding: "26px 22px 18px",
      borderBottom: "1px solid rgba(200,152,52,0.18)",
      display: "flex",
      gap: "16px",
      alignItems: "center",
      overflow: "hidden",
    } as CSSStyleDeclaration);

    // class-coloured radial glow behind portrait
    this.portraitGlow = document.createElement("div");
    Object.assign(this.portraitGlow.style, {
      position: "absolute",
      top: "-30%",
      left: "-10%",
      width: "60%",
      height: "200%",
      background:
        "radial-gradient(circle, hsla(170,70%,55%,0.25), transparent 65%)",
      pointerEvents: "none",
      transition: "background 400ms ease",
    } as CSSStyleDeclaration);
    hero.appendChild(this.portraitGlow);

    this.portraitEl = document.createElement("div");
    Object.assign(this.portraitEl.style, {
      position: "relative",
      width: "76px",
      height: "76px",
      flexShrink: "0",
      borderRadius: "50%",
      fontSize: "38px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "2px solid var(--pr-gold)",
      boxShadow:
        "inset 0 0 16px rgba(0,0,0,0.7), 0 4px 14px rgba(0,0,0,0.55), 0 0 24px rgba(252,209,64,0.25)",
      background:
        "radial-gradient(circle at 40% 30%, #3a2410 0%, #0b070d 75%)",
      transition: "all 300ms ease",
    } as CSSStyleDeclaration);

    const nameWrap = document.createElement("div");
    Object.assign(nameWrap.style, {
      position: "relative",
      flex: "1",
      display: "flex",
      flexDirection: "column",
      gap: "3px",
      minWidth: "0",
    } as CSSStyleDeclaration);

    this.nameEl = document.createElement("div");
    Object.assign(this.nameEl.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "22px",
      fontWeight: "700",
      letterSpacing: "3px",
      color: "var(--pr-gold-bright)",
      textShadow: "0 0 16px rgba(252,209,64,0.45), 0 2px 4px #000",
      lineHeight: "1.05",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    } as CSSStyleDeclaration);

    this.classLineEl = document.createElement("div");
    Object.assign(this.classLineEl.style, {
      fontFamily: "var(--pr-story)",
      fontSize: "13px",
      letterSpacing: "2px",
      color: "var(--pr-gold)",
      fontStyle: "italic",
    } as CSSStyleDeclaration);

    this.rankBadge = document.createElement("div");
    Object.assign(this.rankBadge.style, {
      display: "inline-block",
      marginTop: "4px",
      padding: "3px 10px",
      borderRadius: "10px",
      border: "1px solid rgba(200,152,52,0.5)",
      background:
        "linear-gradient(180deg, rgba(60,40,20,0.7), rgba(20,12,8,0.85))",
      fontFamily: "var(--pr-display)",
      fontSize: "10px",
      letterSpacing: "3px",
      color: "var(--pr-gold-bright)",
      alignSelf: "flex-start",
      textShadow: "0 0 6px rgba(252,209,64,0.4)",
    } as CSSStyleDeclaration);

    nameWrap.append(this.nameEl, this.classLineEl, this.rankBadge);
    hero.append(this.portraitEl, nameWrap);
    this.panel.appendChild(hero);

    // ── Content section: bars + meta + stats ────────────────────────
    const content = document.createElement("div");
    Object.assign(content.style, {
      padding: "18px 20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    } as CSSStyleDeclaration);

    // bars
    const bars = document.createElement("div");
    Object.assign(bars.style, {
      display: "flex",
      flexDirection: "column",
      gap: "5px",
    } as CSSStyleDeclaration);
    const hp = this.makeBar("HP", "#dc2626", "#fca5a5");
    const mp = this.makeBar("MP", "#1d4ed8", "#7dd3fc");
    const exp = this.makeBar("XP", "#854d0e", "#fde68a");
    this.hpFill = hp.fill;
    this.hpText = hp.text;
    this.mpFill = mp.fill;
    this.mpText = mp.text;
    this.expFill = exp.fill;
    this.expText = exp.text;
    bars.append(hp.row, mp.row, exp.row);
    content.appendChild(bars);

    // meta row
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
    content.appendChild(meta);

    // section heading
    const statsHeader = document.createElement("div");
    Object.assign(statsHeader.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      marginTop: "4px",
    } as CSSStyleDeclaration);
    const divL = document.createElement("div");
    Object.assign(divL.style, {
      flex: "1",
      height: "1px",
      background:
        "linear-gradient(90deg, transparent, rgba(200,152,52,0.6), transparent)",
    } as CSSStyleDeclaration);
    const divR = divL.cloneNode() as HTMLDivElement;
    const titleEl = document.createElement("div");
    titleEl.textContent = "스 탯";
    Object.assign(titleEl.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "12px",
      letterSpacing: "8px",
      color: "var(--pr-gold)",
      textShadow: "0 0 8px rgba(252,209,64,0.3)",
    } as CSSStyleDeclaration);
    statsHeader.append(divL, titleEl, divR);
    content.appendChild(statsHeader);

    // stat rows
    this.rows = {} as Record<StatKey, StatRow>;
    const statList = document.createElement("div");
    Object.assign(statList.style, {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    } as CSSStyleDeclaration);
    content.appendChild(statList);
    for (const key of STAT_ORDER) {
      const row = this.makeStatRow(key);
      this.rows[key] = row;
      statList.appendChild(row.card);
    }

    this.panel.appendChild(content);

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
      display: "grid",
      gridTemplateColumns: "26px 1fr",
      gap: "8px",
      alignItems: "center",
    } as CSSStyleDeclaration);

    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "10px",
      letterSpacing: "1px",
      color: bgColor,
      fontWeight: "700",
      textAlign: "right",
    } as CSSStyleDeclaration);

    const barWrap = document.createElement("div");
    Object.assign(barWrap.style, {
      position: "relative",
      height: "16px",
      borderRadius: "2px",
      background: "rgba(0,0,0,0.72)",
      border: `1px solid ${bgColor}55`,
      boxShadow:
        "inset 0 1px 4px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,255,255,0.04)",
      overflow: "hidden",
    } as CSSStyleDeclaration);
    const fill = document.createElement("div");
    Object.assign(fill.style, {
      position: "absolute",
      left: "0",
      top: "0",
      height: "100%",
      width: "0%",
      background: `linear-gradient(180deg, ${fillColor}, ${bgColor} 75%)`,
      transition: "width 480ms cubic-bezier(0.2, 0.9, 0.3, 1)",
      boxShadow: `0 0 10px ${fillColor}88, inset 0 1px 0 rgba(255,255,255,0.3)`,
    } as CSSStyleDeclaration);
    const text = document.createElement("span");
    Object.assign(text.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--pr-mono, ui-monospace, monospace)",
      fontSize: "10px",
      letterSpacing: "0.5px",
      color: "#fff",
      textShadow: "0 0 6px #000, 0 1px 2px #000",
      fontWeight: "700",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    text.textContent = "0 / 0";
    barWrap.append(fill, text);
    row.append(labelEl, barWrap);
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
    text.textContent = `${Math.round(cur)} / ${Math.round(max)}`;
  }

  private makeMetaBox(
    icon: string,
    label: string,
    color: string
  ): { box: HTMLDivElement; value: HTMLDivElement } {
    const box = document.createElement("div");
    Object.assign(box.style, {
      padding: "10px 12px",
      borderRadius: "4px",
      border: "1px solid rgba(200,152,52,0.22)",
      background:
        "linear-gradient(180deg, rgba(20,12,18,0.6), rgba(8,5,10,0.85))",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    } as CSSStyleDeclaration);
    const ic = document.createElement("div");
    ic.textContent = icon;
    Object.assign(ic.style, {
      fontSize: "20px",
      color: color,
      filter: "drop-shadow(0 0 6px " + color + "55)",
    } as CSSStyleDeclaration);
    const right = document.createElement("div");
    Object.assign(right.style, {
      flex: "1",
      display: "flex",
      flexDirection: "column",
      lineHeight: "1",
      gap: "2px",
    } as CSSStyleDeclaration);
    const lbl = document.createElement("div");
    lbl.textContent = label;
    Object.assign(lbl.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "9px",
      letterSpacing: "3px",
      color: "var(--pr-gold)",
      opacity: "0.85",
    } as CSSStyleDeclaration);
    const value = document.createElement("div");
    value.textContent = "0";
    Object.assign(value.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "18px",
      fontWeight: "700",
      letterSpacing: "1px",
      color: color,
    } as CSSStyleDeclaration);
    right.append(lbl, value);
    box.append(ic, right);
    return { box, value };
  }

  private makeStatRow(key: StatKey): StatRow {
    const theme = STAT_THEME[key];
    const card = document.createElement("div");
    card.className = "pr-cp-row";
    Object.assign(card.style, {
      position: "relative",
      display: "grid",
      gridTemplateColumns: "44px 1fr auto",
      gap: "14px",
      alignItems: "center",
      padding: "12px 14px 12px 18px",
      borderRadius: "6px",
      border: "1px solid rgba(200,152,52,0.18)",
      background:
        "linear-gradient(135deg, rgba(15,9,16,0.7), rgba(8,5,10,0.85))",
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.03), 0 2px 6px rgba(0,0,0,0.35)",
      transition: "all 200ms ease",
      overflow: "hidden",
    } as CSSStyleDeclaration);

    // Left accent strip
    const accent = document.createElement("div");
    Object.assign(accent.style, {
      position: "absolute",
      left: "0",
      top: "0",
      bottom: "0",
      width: "4px",
      background: `linear-gradient(180deg, ${theme.color}, ${theme.color}80)`,
      boxShadow: `0 0 12px ${theme.color}66`,
    } as CSSStyleDeclaration);
    card.appendChild(accent);

    // Icon disk
    const icon = document.createElement("div");
    icon.className = "pr-cp-icon";
    icon.textContent = theme.icon;
    Object.assign(icon.style, {
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      background: `radial-gradient(circle at 35% 30%, ${theme.color}, #0b070d 78%)`,
      border: `1.5px solid ${theme.color}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
      color: "#fff",
      textShadow: "0 0 8px #000, 0 1px 2px #000",
      boxShadow: `inset 0 0 8px rgba(0,0,0,0.7), 0 0 16px ${theme.color}33`,
    } as CSSStyleDeclaration);

    // Info column
    const info = document.createElement("div");
    Object.assign(info.style, {
      display: "flex",
      flexDirection: "column",
      gap: "1px",
      minWidth: "0",
    } as CSSStyleDeclaration);

    const nameRow = document.createElement("div");
    Object.assign(nameRow.style, {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: "10px",
    } as CSSStyleDeclaration);
    const name = document.createElement("div");
    name.textContent = theme.name;
    Object.assign(name.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "11px",
      letterSpacing: "3px",
      fontWeight: "700",
      color: theme.color,
      opacity: "0.95",
    } as CSSStyleDeclaration);

    const valueEl = document.createElement("div");
    valueEl.textContent = "0";
    Object.assign(valueEl.style, {
      fontFamily: "var(--pr-display)",
      fontSize: "20px",
      fontWeight: "900",
      letterSpacing: "0.5px",
      color: "#fff7d6",
      textShadow: `0 0 10px ${theme.color}88, 0 2px 4px #000`,
      lineHeight: "1",
    } as CSSStyleDeclaration);
    nameRow.append(name, valueEl);

    const derivedEl = document.createElement("div");
    Object.assign(derivedEl.style, {
      fontFamily: "var(--pr-story)",
      fontSize: "11px",
      color: "#cbd5e1",
      letterSpacing: "0.5px",
      marginTop: "3px",
    } as CSSStyleDeclaration);

    const tag = document.createElement("div");
    tag.textContent = theme.tagline;
    Object.assign(tag.style, {
      fontFamily: "var(--pr-body)",
      fontSize: "10px",
      color: "#71717a",
      letterSpacing: "1px",
      marginTop: "1px",
    } as CSSStyleDeclaration);

    info.append(nameRow, derivedEl, tag);

    // + button (gold-rimmed circular)
    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "pr-cp-plus";
    plusBtn.textContent = "+";
    Object.assign(plusBtn.style, {
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      border: `1.5px solid ${theme.color}`,
      background: `radial-gradient(circle at 40% 30%, ${theme.color}25, #0b070d 70%)`,
      color: theme.color,
      fontSize: "22px",
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: "var(--pr-display)",
      touchAction: "manipulation",
      transition: "all 160ms ease",
      boxShadow:
        `0 0 0 1px rgba(0,0,0,0.5) inset, 0 4px 10px rgba(0,0,0,0.5), 0 0 14px ${theme.color}40`,
      lineHeight: "1",
    } as CSSStyleDeclaration);
    plusBtn.addEventListener("click", () => this.listener?.(key));

    card.append(icon, info, plusBtn);
    return { key, card, valueEl, derivedEl, plusBtn };
  }

  setView(v: PlayerStatView) {
    const def = CLASSES.find((c) => c.id === v.classId);
    this.nameEl.textContent = v.name || "영웅";
    this.classLineEl.textContent = def
      ? `${def.name}  ·  Lv ${v.level}`
      : `Lv ${v.level}`;
    this.rankBadge.textContent = rankFor(v.level);
    this.portraitEl.textContent = def?.icon ?? "⚔";
    if (def) {
      const hue = def.suggestedHue;
      this.portraitEl.style.borderColor = `hsl(${hue}, 70%, 60%)`;
      this.portraitEl.style.boxShadow =
        "inset 0 0 16px rgba(0,0,0,0.7), 0 4px 14px rgba(0,0,0,0.55), 0 0 28px " +
        `hsla(${hue}, 70%, 55%, 0.55)`;
      this.portraitGlow.style.background =
        `radial-gradient(circle, hsla(${hue}, 75%, 55%, 0.28), transparent 65%)`;
    }
    this.setBar(this.hpFill, this.hpText, v.hp, v.maxHp);
    this.setBar(this.mpFill, this.mpText, v.mp, v.maxMp);
    this.setBar(this.expFill, this.expText, v.exp, v.expNext);
    this.goldEl.textContent = String(v.gold);
    this.pointsEl.textContent = String(v.statPoints);
    this.pointsEl.style.color = v.statPoints > 0 ? "#fde047" : "#71717a";

    const setRow = (key: StatKey, value: number, derived: string) => {
      const r = this.rows[key];
      r.valueEl.textContent = String(value);
      r.derivedEl.textContent = derived;
      const enabled = v.statPoints > 0;
      r.plusBtn.disabled = !enabled;
      r.plusBtn.style.opacity = enabled ? "1" : "0.25";
      r.plusBtn.style.cursor = enabled ? "pointer" : "default";
    };

    setRow("vit", v.vit, `최대 HP  ${v.maxHp}`);
    setRow("mnd", v.mnd, `최대 MP  ${v.maxMp}`);
    setRow("str", v.str, `데미지  ${v.damage}`);
    setRow("qck", v.qck, `이속  ${v.speed}`);
  }

  onPlus(fn: (key: StatKey) => void) {
    this.listener = fn;
  }

  open() {
    this.visible = true;
    this.overlay.style.display = "flex";
    // Reset bar widths so they animate on next setView
    this.hpFill.style.width = "0%";
    this.mpFill.style.width = "0%";
    this.expFill.style.width = "0%";
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
