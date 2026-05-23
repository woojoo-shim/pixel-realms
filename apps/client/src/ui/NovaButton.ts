/**
 * Frost Nova spell button (secondary spell). Smaller than the fire-bolt
 * button. Held = continuous cast on cooldown.
 */

export class NovaButton {
  private el: HTMLButtonElement;
  private down = false;

  constructor(parent: HTMLElement = document.body) {
    this.el = document.createElement("button");
    this.el.type = "button";
    this.el.textContent = "❄";
    Object.assign(this.el.style, {
      position: "fixed",
      right: "130px",
      bottom: "210px",
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      border: "3px solid rgba(125,211,252,0.95)",
      background:
        "radial-gradient(circle at 32% 28%, rgba(207,250,254,0.45), rgba(14,116,144,0.92) 60%, rgba(8,47,73,0.95))",
      color: "#e0f2fe",
      fontSize: "30px",
      fontFamily: "monospace",
      fontWeight: "bold",
      zIndex: "21",
      cursor: "pointer",
      userSelect: "none",
      touchAction: "none",
      boxShadow:
        "0 4px 12px rgba(0,0,0,0.55), inset 0 -3px 6px rgba(0,0,0,0.4)",
      transition: "transform 0.06s ease",
    } as CSSStyleDeclaration);

    parent.appendChild(this.el);
    this.el.addEventListener("pointerdown", this.onDown);
    this.el.addEventListener("pointerup", this.onUp);
    this.el.addEventListener("pointerleave", this.onUp);
    this.el.addEventListener("pointercancel", this.onUp);
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.down = true;
    this.el.style.transform = "scale(0.9)";
  };

  private onUp = () => {
    if (!this.down) return;
    this.down = false;
    this.el.style.transform = "scale(1)";
  };

  isDown(): boolean {
    return this.down;
  }

  destroy() {
    this.el.remove();
  }
}
