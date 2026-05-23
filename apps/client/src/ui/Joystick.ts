/**
 * Virtual joystick for touch devices.
 * Anchored on first touchstart, follows finger up to a max radius.
 * Emits a normalized {x, y} vector via getVector().
 */

export interface JoystickVector {
  x: number; // -1 .. 1
  y: number; // -1 .. 1
  active: boolean;
}

export class Joystick {
  private base: HTMLDivElement;
  private stick: HTMLDivElement;
  private container: HTMLDivElement;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private dx = 0;
  private dy = 0;
  private radius = 60;
  private active = false;

  constructor(parent: HTMLElement = document.body) {
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed",
      left: "0",
      bottom: "0",
      width: "50%",
      height: "55%",
      zIndex: "20",
      touchAction: "none",
      userSelect: "none",
      pointerEvents: "auto",
    } as CSSStyleDeclaration);

    this.base = document.createElement("div");
    Object.assign(this.base.style, {
      position: "absolute",
      width: `${this.radius * 2}px`,
      height: `${this.radius * 2}px`,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.08)",
      border: "2px solid rgba(255,255,255,0.25)",
      display: "none",
      pointerEvents: "none",
    } as CSSStyleDeclaration);

    this.stick = document.createElement("div");
    Object.assign(this.stick.style, {
      position: "absolute",
      width: `${this.radius}px`,
      height: `${this.radius}px`,
      borderRadius: "50%",
      background: "rgba(110, 231, 183, 0.65)",
      border: "2px solid rgba(110, 231, 183, 1)",
      display: "none",
      pointerEvents: "none",
    } as CSSStyleDeclaration);

    parent.appendChild(this.base);
    parent.appendChild(this.stick);
    parent.appendChild(this.container);

    this.container.addEventListener("pointerdown", this.onDown);
    this.container.addEventListener("pointermove", this.onMove);
    this.container.addEventListener("pointerup", this.onUp);
    this.container.addEventListener("pointercancel", this.onUp);
    this.container.addEventListener("pointerleave", this.onUp);
  }

  private onDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.container.setPointerCapture(e.pointerId);
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.dx = 0;
    this.dy = 0;
    this.active = true;
    this.renderBase();
    this.renderStick();
    this.base.style.display = "block";
    this.stick.style.display = "block";
  };

  private onMove = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    let dx = e.clientX - this.originX;
    let dy = e.clientY - this.originY;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) {
      dx = (dx / len) * this.radius;
      dy = (dy / len) * this.radius;
    }
    this.dx = dx;
    this.dy = dy;
    this.renderStick();
  };

  private onUp = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    this.dx = 0;
    this.dy = 0;
    this.active = false;
    this.base.style.display = "none";
    this.stick.style.display = "none";
  };

  private renderBase() {
    this.base.style.left = `${this.originX - this.radius}px`;
    this.base.style.top = `${this.originY - this.radius}px`;
  }

  private renderStick() {
    this.stick.style.left = `${this.originX + this.dx - this.radius / 2}px`;
    this.stick.style.top = `${this.originY + this.dy - this.radius / 2}px`;
  }

  getVector(): JoystickVector {
    if (!this.active) return { x: 0, y: 0, active: false };
    return {
      x: this.dx / this.radius,
      y: this.dy / this.radius,
      active: true,
    };
  }

  destroy() {
    this.container.remove();
    this.base.remove();
    this.stick.remove();
  }
}
