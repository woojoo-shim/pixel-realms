/**
 * Hold-to-attack button anchored to the bottom-right of the screen.
 * The scene polls isDown() each frame and sends an "attack" message
 * at the server's cooldown rate. This makes the button feel like a
 * real Diablo-style action button — hold to keep swinging.
 */

export class AttackButton {
  private el: HTMLButtonElement;
  private down = false;

  constructor(parent: HTMLElement = document.body) {
    this.el = document.createElement("button");
    this.el.type = "button";
    this.el.textContent = "⚔";
    Object.assign(this.el.style, {
      position: "fixed",
      right: "24px",
      bottom: "112px",
      width: "92px",
      height: "92px",
      borderRadius: "50%",
      border: "3px solid rgba(248,113,113,0.95)",
      background:
        "radial-gradient(circle at 32% 28%, rgba(252,165,165,0.4), rgba(127,29,29,0.92) 60%, rgba(60,10,10,0.95))",
      color: "#fff",
      fontSize: "40px",
      fontFamily: "monospace",
      fontWeight: "bold",
      zIndex: "21",
      cursor: "pointer",
      userSelect: "none",
      touchAction: "none",
      boxShadow: "0 4px 14px rgba(0,0,0,0.55), inset 0 -3px 6px rgba(0,0,0,0.4)",
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

  private onUp = (e: PointerEvent) => {
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
