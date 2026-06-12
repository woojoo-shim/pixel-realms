/**
 * Premium UI polish — applied globally, no per-component changes needed.
 *
 *  - Every `.pr-btn` gets:
 *      • a soft radial spotlight that follows the cursor
 *      • a click ripple that expands from the press point
 *      • a focus-visible gold ring (keyboard a11y)
 *  - Every `.pr-panel` gets:
 *      • a single diagonal "stained-glass shine" sweep when it becomes
 *        visible (subtle, played once per mount)
 *      • an animated gold-shimmer border-glow (slow, ~6s loop)
 *
 * Implementation notes:
 *  - All CSS is injected from one <style> tag; no runtime per-element
 *    layout cost beyond a single mousemove handler per .pr-btn.
 *  - The mouse handler writes CSS variables (--mx, --my) on hover so
 *    the spotlight tracks the cursor purely in CSS.
 *  - The shine sweep is triggered by an IntersectionObserver, so it
 *    fires once when a panel scrolls / fades into view.
 *  - All effects are pointer-events: none and z-index: 0 → never block
 *    clicks or sit on top of content.
 *
 * Call `installPremiumUi()` once at app startup.
 */

let _installed = false;

const CSS = `
  /* ────────────────────────────────────────────────────────────────
     .pr-btn — hover spotlight + ripple + focus ring
     ──────────────────────────────────────────────────────────────── */
  .pr-btn {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    transition: transform 140ms cubic-bezier(0.2,0.9,0.3,1),
                box-shadow 200ms ease,
                border-color 200ms ease;
  }
  .pr-btn::before {
    /* Cursor-following radial spotlight */
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: radial-gradient(
      260px circle at var(--mx, 50%) var(--my, 50%),
      rgba(252, 209, 64, 0.18),
      transparent 55%
    );
    opacity: 0;
    transition: opacity 200ms ease;
    z-index: 0;
  }
  .pr-btn:hover::before { opacity: 1; }
  .pr-btn:active { transform: translateY(1px) scale(0.985); }
  .pr-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px #fde047, 0 0 22px rgba(252,209,64,0.45);
  }
  .pr-btn > * { position: relative; z-index: 1; }

  /* Click ripple — appended JS-side, animated by this keyframe */
  .pr-ripple {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle,
      rgba(252,209,64,0.55) 0%,
      rgba(252,209,64,0.18) 45%,
      transparent 75%);
    transform: translate(-50%, -50%) scale(0);
    pointer-events: none;
    z-index: 0;
    animation: pr-ripple-anim 540ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes pr-ripple-anim {
    to { transform: translate(-50%, -50%) scale(7); opacity: 0; }
  }

  /* ────────────────────────────────────────────────────────────────
     .pr-panel — one-shot shine sweep + animated gold shimmer border
     ──────────────────────────────────────────────────────────────── */
  .pr-panel {
    position: relative;
    isolation: isolate;
  }
  .pr-panel::before {
    /* Diagonal light bar — animated by adding .pr-panel-shine */
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(
      115deg,
      transparent 35%,
      rgba(252,209,64,0.18) 49%,
      rgba(255,255,255,0.35) 50%,
      rgba(252,209,64,0.18) 51%,
      transparent 65%
    );
    transform: translateX(-130%);
    z-index: 5;
    mix-blend-mode: screen;
    opacity: 0;
  }
  .pr-panel.pr-panel-shine::before {
    animation: pr-panel-shine 1500ms cubic-bezier(0.2, 0.9, 0.3, 1) 60ms;
  }
  @keyframes pr-panel-shine {
    0%   { transform: translateX(-130%); opacity: 0; }
    20%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateX(130%); opacity: 0; }
  }

  .pr-panel::after {
    /* Slow gold-shimmer border glow that loops forever */
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    pointer-events: none;
    padding: 1px;
    background: conic-gradient(
      from var(--pr-shimmer-angle, 0deg),
      rgba(252,209,64,0)   0%,
      rgba(252,209,64,0.55) 20%,
      rgba(252,209,64,0)   40%,
      rgba(252,209,64,0)   100%
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
            mask-composite: exclude;
    opacity: 0.6;
    z-index: 4;
    animation: pr-shimmer-rotate 8s linear infinite;
  }
  @property --pr-shimmer-angle {
    syntax: "<angle>";
    inherits: false;
    initial-value: 0deg;
  }
  @keyframes pr-shimmer-rotate {
    to { --pr-shimmer-angle: 360deg; }
  }
  /* Browsers without @property fall back to no animation —
     the static gradient still looks intentional. */
`;

function installCss() {
  const tag = document.createElement("style");
  tag.id = "pr-premium-ui-styles";
  tag.textContent = CSS;
  document.head.appendChild(tag);
}

/**
 * Attach the hover-spotlight tracker to a single button.
 * Idempotent — checks a data flag so re-running on the same element
 * (e.g. after a re-render) doesn't double-bind.
 */
function attachButton(el: HTMLElement) {
  if ((el as HTMLElement & { _prPolished?: boolean })._prPolished) return;
  (el as HTMLElement & { _prPolished?: boolean })._prPolished = true;

  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--mx", `${x}%`);
    el.style.setProperty("--my", `${y}%`);
  });

  el.addEventListener("pointerdown", (e) => {
    const r = el.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "pr-ripple";
    const size = Math.max(r.width, r.height) * 0.7;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - r.left}px`;
    ripple.style.top = `${e.clientY - r.top}px`;
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

/**
 * IntersectionObserver-driven shine: when a .pr-panel becomes visible
 * for the first time after mount we add .pr-panel-shine, which kicks
 * off the CSS animation once. We then remove the class on animation
 * end so re-opening the same panel re-triggers it.
 */
function watchPanels(root: Document | Element = document) {
  const seen = new WeakSet<Element>();
  const fire = (panel: Element) => {
    panel.classList.remove("pr-panel-shine");
    // Force reflow so re-adding the class restarts the animation
    void (panel as HTMLElement).offsetWidth;
    panel.classList.add("pr-panel-shine");
    setTimeout(() => panel.classList.remove("pr-panel-shine"), 1700);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !seen.has(e.target)) {
        seen.add(e.target);
        fire(e.target);
      } else if (!e.isIntersecting) {
        // forget so it fires again the next time the panel comes back
        seen.delete(e.target);
      }
    }
  }, { threshold: 0.4 });
  for (const p of root.querySelectorAll(".pr-panel")) {
    io.observe(p);
  }
  // Also re-scan on DOM additions
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of Array.from(m.addedNodes)) {
        if (!(n instanceof Element)) continue;
        if (n.matches?.(".pr-panel")) io.observe(n);
        for (const inner of n.querySelectorAll?.(".pr-panel") ?? []) {
          io.observe(inner);
        }
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

function watchButtons(root: Document | Element = document) {
  for (const b of root.querySelectorAll<HTMLElement>(".pr-btn")) {
    attachButton(b);
  }
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of Array.from(m.addedNodes)) {
        if (!(n instanceof Element)) continue;
        if (n.matches?.(".pr-btn")) attachButton(n as HTMLElement);
        n.querySelectorAll?.<HTMLElement>(".pr-btn").forEach(attachButton);
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

export function installPremiumUi() {
  if (_installed) return;
  _installed = true;
  installCss();
  // Wait one frame so any inline app styles render first.
  requestAnimationFrame(() => {
    watchButtons();
    watchPanels();
  });
}
