import {
  QUESTS,
  MAP_LABELS,
  type QuestDef,
  type MapId,
} from "@pr/shared";

export interface QuestStatus {
  id: string;
  progress: number;
  done: boolean;
}

/** Journal listing all quests with progress bars. */
export class QuestPanel {
  private root: HTMLDivElement;
  private list: HTMLDivElement;
  private statuses: Map<string, QuestStatus> = new Map();

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
      maxHeight: "88vh",
      display: "flex",
      flexDirection: "column",
      background: "linear-gradient(180deg, #181214, #0c0709)",
      border: "3px solid #b45309",
      borderRadius: "10px",
      padding: "14px",
      boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "10px",
    });
    const title = document.createElement("div");
    title.textContent = "QUEST LOG";
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

    this.list = document.createElement("div");
    Object.assign(this.list.style, {
      flex: "1",
      overflow: "auto",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });

    panel.appendChild(header);
    panel.appendChild(this.list);
    root.appendChild(panel);
    document.body.appendChild(root);
    this.root = root;
    this.render();
  }

  setStatuses(statuses: QuestStatus[]) {
    this.statuses = new Map(statuses.map((s) => [s.id, s]));
    if (this.isOpen()) this.render();
  }
  /** Compact summary: "3/8 quests · 1 ready" */
  summary(): string {
    let done = 0;
    for (const s of this.statuses.values()) if (s.done) done++;
    return `${done}/${QUESTS.length} quests`;
  }
  isOpen() {
    return this.root.style.display !== "none";
  }
  show() {
    this.render();
    this.root.style.display = "flex";
  }
  hide() {
    this.root.style.display = "none";
  }
  toggle() {
    this.isOpen() ? this.hide() : this.show();
  }
  destroy() {
    this.root.remove();
  }

  private render() {
    this.list.innerHTML = "";
    // Group by map
    const byMap = new Map<MapId, QuestDef[]>();
    for (const q of QUESTS) {
      const arr = byMap.get(q.mapId) ?? [];
      arr.push(q);
      byMap.set(q.mapId, arr);
    }
    for (const [mapId, quests] of byMap) {
      const header = document.createElement("div");
      header.textContent = (MAP_LABELS as Record<string, string>)[mapId] ?? mapId;
      Object.assign(header.style, {
        fontSize: "11px",
        letterSpacing: "3px",
        color: "#94a3b8",
        marginTop: "4px",
        borderBottom: "1px solid rgba(245,158,11,0.25)",
        paddingBottom: "3px",
      });
      this.list.appendChild(header);
      for (const q of quests) {
        this.list.appendChild(this.makeRow(q));
      }
    }
  }

  private makeRow(q: QuestDef): HTMLDivElement {
    const st = this.statuses.get(q.id) ?? {
      id: q.id,
      progress: 0,
      done: false,
    };
    const row = document.createElement("div");
    Object.assign(row.style, {
      padding: "10px 12px",
      background: "rgba(0,0,0,0.45)",
      borderRadius: "6px",
      border: `2px solid ${st.done ? "rgba(132,222,118,0.5)" : "rgba(245,158,11,0.3)"}`,
      opacity: st.done ? "0.7" : "1",
    });
    const title = document.createElement("div");
    title.innerHTML = `${st.done ? "<span style='color:#84df76'>✓</span> " : ""}<b style='color:${st.done ? "#84df76" : "#fde047"}'>${q.title}</b>`;
    Object.assign(title.style, { fontSize: "13px" });
    const desc = document.createElement("div");
    desc.textContent = q.description;
    Object.assign(desc.style, {
      fontSize: "11px",
      color: "#cbd5e1",
      marginTop: "2px",
    });
    // Progress bar
    const barWrap = document.createElement("div");
    Object.assign(barWrap.style, {
      position: "relative",
      width: "100%",
      height: "8px",
      background: "rgba(0,0,0,0.6)",
      borderRadius: "4px",
      border: "1px solid rgba(245,158,11,0.25)",
      marginTop: "6px",
      overflow: "hidden",
    });
    const fill = document.createElement("div");
    const pct = Math.min(100, (st.progress / q.targetCount) * 100);
    Object.assign(fill.style, {
      position: "absolute",
      left: "0",
      top: "0",
      bottom: "0",
      width: `${pct}%`,
      background: st.done
        ? "linear-gradient(90deg,#86efac,#bbf7d0)"
        : "linear-gradient(90deg,#f59e0b,#fbbf24)",
      transition: "width 0.3s",
    });
    barWrap.appendChild(fill);
    const counts = document.createElement("div");
    counts.textContent = `${Math.min(st.progress, q.targetCount)} / ${q.targetCount}  ·  ${q.rewardGold}g  ·  ${q.rewardExp} xp`;
    Object.assign(counts.style, {
      fontSize: "10px",
      color: "#94a3b8",
      marginTop: "3px",
    });
    row.appendChild(title);
    row.appendChild(desc);
    row.appendChild(barWrap);
    row.appendChild(counts);
    return row;
  }
}
