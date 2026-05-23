import type { MapId } from "@pr/shared";
import { MAP_LABELS } from "@pr/shared";

type TravelCb = (to: MapId) => void;

/** Fast-travel modal opened by stepping onto a waypoint stone. */
export class WaypointPanel {
  private root: HTMLDivElement;
  private list: HTMLDivElement;
  private travelCb: TravelCb = () => {};
  private discovered: Set<MapId> = new Set(["town"]);
  private currentMap: MapId = "town";

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
    });
    root.addEventListener("click", (e) => {
      if (e.target === root) this.hide();
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      width: "min(360px, 92vw)",
      background:
        "linear-gradient(180deg, rgba(10,28,45,0.97), rgba(5,15,30,0.97))",
      border: "3px solid #4dd0e1",
      borderRadius: "10px",
      padding: "16px",
      boxShadow:
        "0 0 30px rgba(77,208,225,0.5), 0 20px 50px rgba(0,0,0,0.6)",
    });

    const header = document.createElement("div");
    header.innerHTML =
      "<div style='font-size:18px;letter-spacing:6px;color:#84ffff;text-shadow:0 0 12px #4dd0e1'>WAYPOINT</div>" +
      "<div style='font-size:10px;color:#94a3b8;letter-spacing:2px;margin-top:4px'>SELECT A DESTINATION</div>";
    Object.assign(header.style, {
      textAlign: "center",
      marginBottom: "14px",
    });

    this.list = document.createElement("div");
    Object.assign(this.list.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    const close = document.createElement("button");
    close.textContent = "CLOSE";
    Object.assign(close.style, {
      width: "100%",
      marginTop: "12px",
      padding: "10px",
      background: "rgba(0,0,0,0.45)",
      border: "2px solid rgba(77,208,225,0.4)",
      borderRadius: "6px",
      color: "#cbd5e1",
      fontFamily: "monospace",
      fontWeight: "bold",
      letterSpacing: "2px",
      cursor: "pointer",
    });
    close.onclick = () => this.hide();

    panel.appendChild(header);
    panel.appendChild(this.list);
    panel.appendChild(close);
    root.appendChild(panel);
    document.body.appendChild(root);
    this.root = root;
    this.renderList();
  }

  onTravel(cb: TravelCb) {
    this.travelCb = cb;
  }
  setDiscovered(maps: MapId[]) {
    this.discovered = new Set(maps);
    this.renderList();
  }
  setCurrent(mapId: MapId) {
    this.currentMap = mapId;
    this.renderList();
  }
  isOpen() {
    return this.root.style.display !== "none";
  }
  show() {
    this.renderList();
    this.root.style.display = "flex";
  }
  hide() {
    this.root.style.display = "none";
  }
  destroy() {
    this.root.remove();
  }

  private renderList() {
    this.list.innerHTML = "";
    const ALL_MAPS: MapId[] = ["town", "forest", "desert", "mountain", "lake"];
    for (const id of ALL_MAPS) {
      const known = this.discovered.has(id);
      const isHere = id === this.currentMap;
      const row = document.createElement("button");
      row.disabled = !known || isHere;
      row.innerHTML = known
        ? `<b>${MAP_LABELS[id]}</b>${isHere ? "  <span style='font-size:10px;color:#84ffff'>· you are here</span>" : ""}`
        : `<span style='color:#475569'>??? Undiscovered</span>`;
      Object.assign(row.style, {
        padding: "12px 14px",
        textAlign: "left",
        background: isHere
          ? "rgba(77,208,225,0.15)"
          : known
            ? "rgba(0,0,0,0.45)"
            : "rgba(0,0,0,0.3)",
        border: `2px solid ${
          isHere
            ? "rgba(77,208,225,0.8)"
            : known
              ? "rgba(77,208,225,0.4)"
              : "rgba(50,50,50,0.5)"
        }`,
        borderRadius: "6px",
        color: known ? "#e2e8f0" : "#475569",
        fontFamily: "monospace",
        fontSize: "14px",
        cursor: !known || isHere ? "default" : "pointer",
        opacity: !known || isHere ? "0.7" : "1",
      } as CSSStyleDeclaration);
      if (known && !isHere) {
        row.onclick = () => {
          this.travelCb(id);
          this.hide();
        };
      }
      this.list.appendChild(row);
    }
  }
}
