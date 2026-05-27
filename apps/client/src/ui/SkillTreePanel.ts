import { SKILL_TREE, type SkillBranch, type SkillDef } from "@pr/shared";

/**
 * D2-style skill tree. 3 branches (combat / magic / survival) shown as
 * columns. Each skill has a + button enabled when the player has unspent
 * skill points and the skill isn't already maxed.
 *
 * Open with the K key or the "Skills" button on the side rail.
 */

interface SkillRow {
  def: SkillDef;
  levelEl: HTMLSpanElement;
  effectEl: HTMLDivElement;
  plusBtn: HTMLButtonElement;
}

export interface SkillView {
  skillPoints: number;
  levels: Record<string, number>;
}

const BRANCH_LABEL: Record<SkillBranch, string> = {
  combat: "Combat",
  magic: "Magic",
  survival: "Survival",
};

const BRANCH_COLOR: Record<SkillBranch, string> = {
  combat: "#ef4444",
  magic: "#60a5fa",
  survival: "#22c55e",
};

export class SkillTreePanel {
  private overlay: HTMLDivElement;
  private panel: HTMLDivElement;
  private points: HTMLSpanElement;
  private rows: Map<string, SkillRow> = new Map();
  private listener: ((skillId: string) => void) | null = null;
  private visible = false;

  constructor(parent: HTMLElement = document.body) {
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.66)",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "60",
      pointerEvents: "auto",
    });
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });

    this.panel = document.createElement("div");
    Object.assign(this.panel.style, {
      background: "linear-gradient(180deg, #1f2937 0%, #0b1118 100%)",
      border: "3px solid #c9a96a",
      borderRadius: "10px",
      padding: "18px 22px",
      width: "min(560px, 92vw)",
      maxHeight: "88vh",
      overflowY: "auto",
      color: "#e7e7e7",
      fontFamily: "monospace",
      boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
    });

    // ── Header ─────────────────────────────────────────────────────
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "14px",
    });
    const title = document.createElement("div");
    title.textContent = "SKILL TREE";
    Object.assign(title.style, {
      fontSize: "20px",
      fontWeight: "bold",
      letterSpacing: "2px",
      color: "#fde047",
    });
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    Object.assign(closeBtn.style, {
      background: "transparent",
      color: "#cbd5e1",
      border: "1px solid #475569",
      borderRadius: "4px",
      width: "28px",
      height: "28px",
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: "14px",
    });
    closeBtn.addEventListener("click", () => this.hide());
    header.append(title, closeBtn);

    // ── Points display ──────────────────────────────────────────────
    const ptsRow = document.createElement("div");
    Object.assign(ptsRow.style, {
      fontSize: "13px",
      color: "#cbd5e1",
      marginBottom: "14px",
    });
    ptsRow.innerHTML =
      "Unspent skill points: <span id='skp'>0</span> &nbsp;<span style='color:#94a3b8'>(1 per level up)</span>";
    this.points = ptsRow.querySelector("#skp") as HTMLSpanElement;

    // ── Branch columns ──────────────────────────────────────────────
    const cols = document.createElement("div");
    Object.assign(cols.style, {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "10px",
    });

    for (const branch of ["combat", "magic", "survival"] as SkillBranch[]) {
      const col = document.createElement("div");
      Object.assign(col.style, {
        background: "rgba(0,0,0,0.35)",
        border: `2px solid ${BRANCH_COLOR[branch]}`,
        borderRadius: "8px",
        padding: "10px",
      });

      const colTitle = document.createElement("div");
      colTitle.textContent = BRANCH_LABEL[branch];
      Object.assign(colTitle.style, {
        fontSize: "13px",
        fontWeight: "bold",
        color: BRANCH_COLOR[branch],
        textAlign: "center",
        marginBottom: "8px",
        letterSpacing: "1px",
      });
      col.append(colTitle);

      const branchSkills = SKILL_TREE.filter((s) => s.branch === branch);
      for (const def of branchSkills) {
        col.append(this.buildSkillRow(def));
      }
      cols.append(col);
    }

    this.panel.append(header, ptsRow, cols);
    this.overlay.append(this.panel);
    parent.append(this.overlay);
  }

  private buildSkillRow(def: SkillDef): HTMLElement {
    const row = document.createElement("div");
    Object.assign(row.style, {
      background: "rgba(0,0,0,0.45)",
      border: "1px solid #334155",
      borderRadius: "5px",
      padding: "8px",
      marginBottom: "6px",
    });

    const head = document.createElement("div");
    Object.assign(head.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginBottom: "4px",
    });
    const icon = document.createElement("span");
    icon.textContent = def.icon;
    Object.assign(icon.style, { fontSize: "16px", width: "20px" });
    const name = document.createElement("span");
    name.textContent = def.name;
    Object.assign(name.style, {
      fontSize: "12px",
      fontWeight: "bold",
      color: "#e7e7e7",
      flex: "1",
    });
    const lv = document.createElement("span");
    lv.textContent = `0/${def.maxLevel}`;
    Object.assign(lv.style, {
      fontSize: "11px",
      color: "#fde047",
      minWidth: "30px",
      textAlign: "right",
    });
    const plus = document.createElement("button");
    plus.textContent = "+";
    Object.assign(plus.style, {
      background: "#15803d",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      width: "22px",
      height: "22px",
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: "14px",
      fontWeight: "bold",
    });
    plus.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.listener) this.listener(def.id);
    });
    head.append(icon, name, lv, plus);

    const effect = document.createElement("div");
    effect.textContent = def.perLevel;
    Object.assign(effect.style, {
      fontSize: "10px",
      color: "#94a3b8",
      lineHeight: "1.3",
    });

    row.append(head, effect);
    this.rows.set(def.id, {
      def,
      levelEl: lv,
      effectEl: effect,
      plusBtn: plus,
    });
    return row;
  }

  onPlus(fn: (skillId: string) => void) {
    this.listener = fn;
  }

  show() {
    this.overlay.style.display = "flex";
    this.visible = true;
  }
  hide() {
    this.overlay.style.display = "none";
    this.visible = false;
  }
  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }
  isVisible(): boolean {
    return this.visible;
  }

  update(view: SkillView) {
    this.points.textContent = String(view.skillPoints);
    for (const [id, row] of this.rows.entries()) {
      const lv = view.levels[id] ?? 0;
      row.levelEl.textContent = `${lv}/${row.def.maxLevel}`;
      const maxed = lv >= row.def.maxLevel;
      const canAlloc = view.skillPoints > 0 && !maxed;
      row.plusBtn.disabled = !canAlloc;
      row.plusBtn.style.opacity = canAlloc ? "1" : "0.35";
      row.plusBtn.style.cursor = canAlloc ? "pointer" : "not-allowed";
      row.plusBtn.style.background = maxed ? "#475569" : "#15803d";
      // Highlight invested skills
      const baseColor = lv > 0 ? "#fde047" : "#cbd5e1";
      row.levelEl.style.color = maxed ? "#22c55e" : baseColor;
    }
  }

  destroy() {
    this.overlay.remove();
  }
}
