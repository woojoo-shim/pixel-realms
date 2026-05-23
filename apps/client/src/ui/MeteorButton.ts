/**
 * Meteor button — delayed AOE strike at the targeted location.
 * Sits to the left of the Teleport button.
 */
export class MeteorButton {
  private el: HTMLButtonElement;
  private down = false;
  private pressCb: () => void = () => {};

  constructor(parent: HTMLElement = document.body) {
    this.el = document.createElement("button");
    this.el.type = "button";
    this.el.textContent = "☄";
    this.el.title = "Meteor (M)";
    Object.assign(this.el.style, {
      position: "fixed",
      right: "120px",
      bottom: "278px",
      width: "60px",
      height: "60px",
      borderRadius: "50%",
      border: "3px solid rgba(255,87,34,0.95)",
      background:
        "radial-gradient(circle at 30% 30%, rgba(255,167,38,0.95), rgba(127,29,29,0.95) 70%, rgba(40,4,4,0.95))",
      color: "#fff",
      fontSize: "26px",
      fontWeight: "bold",
      textShadow: "0 1px 3px #4a0a0a",
      boxShadow:
        "0 0 14px rgba(244,67,54,0.65), 0 4px 12px rgba(0,0,0,0.4)",
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
