/**
 * Health-potion button. Sits above-left of the attack button.
 * Single tap = use one potion. Shows current count as a badge.
 */

export class PotionButton {
  private el: HTMLButtonElement;
  private badge: HTMLSpanElement;
  private listener: (() => void) | null = null;

  constructor(parent: HTMLElement = document.body) {
    this.el = document.createElement("button");
    this.el.type = "button";
    this.el.textContent = "🧪";
    Object.assign(this.el.style, {
      position: "fixed",
      right: "34px",
      bottom: "218px",
      width: "60px",
      height: "60px",
      borderRadius: "50%",
      border: "3px solid rgba(220,38,38,0.9)",
      background:
        "radial-gradient(circle at 32% 28%, rgba(254,202,202,0.45), rgba(127,29,29,0.92) 60%, rgba(60,10,10,0.95))",
      color: "#fff",
      fontSize: "26px",
      fontFamily: "monospace",
      zIndex: "21",
      cursor: "pointer",
      userSelect: "none",
      touchAction: "manipulation",
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      transition: "transform 0.06s ease",
    } as CSSStyleDeclaration);

    this.badge = document.createElement("span");
    Object.assign(this.badge.style, {
      position: "absolute",
      right: "-4px",
      bottom: "-4px",
      minWidth: "20px",
      height: "20px",
      borderRadius: "10px",
      background: "#fde047",
      color: "#1a0a0a",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 4px",
      border: "2px solid #1a0a0a",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    this.badge.textContent = "0";

    this.el.appendChild(this.badge);
    parent.appendChild(this.el);

    this.el.addEventListener("pointerdown", this.handlePress);
  }

  private handlePress = (e: PointerEvent) => {
    e.preventDefault();
    this.el.style.transform = "scale(0.88)";
    setTimeout(() => (this.el.style.transform = "scale(1)"), 80);
    this.listener?.();
  };

  setCount(n: number) {
    this.badge.textContent = String(n);
    this.el.style.opacity = n > 0 ? "1" : "0.45";
  }

  onPress(fn: () => void) {
    this.listener = fn;
  }

  destroy() {
    this.el.remove();
  }
}
