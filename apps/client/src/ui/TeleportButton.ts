/**
 * Teleport button — instant short-range blink in the facing direction.
 * Sits above the Frost Nova button on the right action stack.
 */
export class TeleportButton {
  private el: HTMLButtonElement;
  private down = false;
  private pressCb: () => void = () => {};

  constructor(parent: HTMLElement = document.body) {
    this.el = document.createElement("button");
    this.el.type = "button";
    this.el.textContent = "➤";
    this.el.title = "Teleport (T)";
    Object.assign(this.el.style, {
      position: "fixed",
      right: "clamp(20px, 4vmin, 40px)",
      bottom: "290px",
      width: "clamp(48px, 9.5vmin, 82px)",
      height: "clamp(48px, 9.5vmin, 82px)",
      borderRadius: "50%",
      border: "3px solid rgba(196,132,252,0.95)",
      background:
        "radial-gradient(circle at 30% 30%, rgba(192,132,252,0.95), rgba(88,28,135,0.95) 70%, rgba(40,10,80,0.95))",
      color: "#fff",
      fontSize: "22px",
      fontWeight: "bold",
      textShadow: "0 1px 3px #1e1b4b",
      boxShadow:
        "0 0 14px rgba(168,85,247,0.6), 0 4px 12px rgba(0,0,0,0.4)",
      cursor: "pointer",
      zIndex: "21",
      touchAction: "manipulation",
      userSelect: "none",
    });

    const fire = (e: Event) => {
      e.preventDefault();
      this.pressCb();
    };
    this.el.addEventListener("pointerdown", (e) => {
      this.down = true;
      fire(e);
    });
    const release = () => {
      this.down = false;
    };
    this.el.addEventListener("pointerup", release);
    this.el.addEventListener("pointerleave", release);
    this.el.addEventListener("pointercancel", release);

    parent.appendChild(this.el);
  }

  onPress(cb: () => void) {
    this.pressCb = cb;
  }
  isDown() {
    return this.down;
  }
  destroy() {
    this.el.remove();
  }
}
