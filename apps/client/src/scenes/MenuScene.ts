import Phaser from "phaser";
import {
  cleanOAuthHash,
  getSession,
  oauthEnabled,
  signInWithProvider,
  signOut,
  type OAuthProvider,
} from "../auth/supabase.js";

/**
 * Title screen — a 3-state DOM overlay (title → login → register) sitting
 * on top of a Phaser-rendered dark backdrop. Keeps the flow as plain as
 * possible: pick what you want first (login or register), then fill the
 * form.
 */
type View = "title" | "login" | "register";

export class MenuScene extends Phaser.Scene {
  private overlay?: HTMLDivElement;
  private oauthToken: string | null = null;
  private oauthDisplayName: string | null = null;

  constructor() {
    super("menu");
  }

  create() {
    /* ── Pre-warm Render free-tier server (it sleeps after 15min idle) ── */
    const wsUrl =
      (import.meta as { env?: Record<string, string | undefined> }).env
        ?.VITE_SERVER_URL ?? "";
    if (wsUrl) {
      const httpUrl = wsUrl
        .replace(/^wss:/, "https:")
        .replace(/^ws:/, "http:");
      void fetch(`${httpUrl}/health`, { mode: "cors" }).catch(() => {});
    }

    /* ── Backdrop ─────────────────────────────────────────────────── */
    this.drawBackdrop();
    this.scale.on("resize", () => {
      this.children.removeAll();
      this.drawBackdrop();
    });

    /* ── OAuth handling (read URL hash, populate session) ─────────── */
    cleanOAuthHash();
    void getSession().then((s) => {
      if (s?.access_token) {
        this.oauthToken = s.access_token;
        const meta = (s.user?.user_metadata ?? {}) as Record<string, unknown>;
        const name =
          (typeof meta.full_name === "string" && meta.full_name) ||
          (typeof meta.name === "string" && meta.name) ||
          (typeof meta.user_name === "string" && meta.user_name) ||
          s.user?.email?.split("@")[0] ||
          "Adventurer";
        this.oauthDisplayName = String(name).slice(0, 16);
        // Re-render title with signed-in state.
        this.mount("title");
      }
    });
    // Mount the title immediately so the user sees something while
    // getSession() resolves; it'll re-render once OAuth state arrives.
    this.mount("title");

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  /* ── Backdrop drawing ────────────────────────────────────────────── */
  private drawBackdrop() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor("#070405");
    const bg = this.add.graphics().setScrollFactor(0).setDepth(0);
    bg.fillStyle(0x1a0a07, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(0x451a07, 0.55);
    bg.fillEllipse(w * 0.5, h * 0.18, w * 1.3, h * 0.6);
    bg.fillStyle(0x2a1006, 0.55);
    bg.fillEllipse(w * 0.5, h * 0.72, w * 1.6, h * 0.95);
    // Faint sigil circle behind the title
    const sigil = this.add.graphics().setScrollFactor(0).setDepth(1);
    sigil.lineStyle(2, 0x7f1d1d, 0.35);
    sigil.strokeCircle(w * 0.5, h * 0.32, Math.min(w, h) * 0.18);
    sigil.lineStyle(1, 0xfbbf24, 0.25);
    sigil.strokeCircle(w * 0.5, h * 0.32, Math.min(w, h) * 0.18 + 12);
  }

  /* ── DOM overlay lifecycle ───────────────────────────────────────── */
  private teardown() {
    this.overlay?.remove();
    this.overlay = undefined;
  }

  private mount(view: View) {
    this.teardown();
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      gap: "14px",
      color: "#fff",
      fontFamily: "monospace",
      zIndex: "20",
      pointerEvents: "none",
    } as CSSStyleDeclaration);

    /* Title — always visible at top */
    const title = document.createElement("div");
    title.textContent = "PIXEL REALMS";
    Object.assign(title.style, {
      fontSize: "clamp(28px, 7vmin, 48px)",
      letterSpacing: "clamp(4px, 1.5vmin, 10px)",
      color: "#fde047",
      textShadow: "0 0 18px rgba(252,165,165,0.5), 0 4px 8px #000",
      fontWeight: "bold",
      marginBottom: "8px",
    } as CSSStyleDeclaration);
    overlay.append(title);

    if (view === "title") this.renderTitle(overlay);
    else if (view === "login") this.renderForm(overlay, "login");
    else if (view === "register") this.renderForm(overlay, "register");

    document.body.append(overlay);
    this.overlay = overlay;
  }

  /* ── Title view: two big buttons + optional OAuth row ────────────── */
  private renderTitle(root: HTMLDivElement) {
    const subtitle = document.createElement("div");
    subtitle.textContent = "2D 픽셀 멀티 RPG";
    Object.assign(subtitle.style, {
      fontSize: "12px",
      color: "#9ca3af",
      letterSpacing: "3px",
      marginBottom: "6px",
    } as CSSStyleDeclaration);
    root.append(subtitle);

    /* If already signed in via OAuth, jump straight to "Play as ..." */
    if (this.oauthToken && this.oauthDisplayName) {
      const card = document.createElement("div");
      Object.assign(card.style, {
        ...this.cardStyle(),
        textAlign: "center",
      } as Partial<CSSStyleDeclaration>);
      const hi = document.createElement("div");
      hi.textContent = `로그인됨: ${this.oauthDisplayName}`;
      Object.assign(hi.style, {
        color: "#fde047",
        fontSize: "13px",
        marginBottom: "10px",
      } as CSSStyleDeclaration);
      const playBtn = this.bigButton("⚔  플레이");
      playBtn.onclick = () =>
        this.scene.start("world", {
          mode: "quick",
          token: this.oauthToken!,
        });
      const out = this.smallButton("로그아웃");
      out.style.marginTop = "10px";
      out.onclick = async () => {
        await signOut();
        this.oauthToken = null;
        this.oauthDisplayName = null;
        this.mount("title");
      };
      card.append(hi, playBtn, out);
      root.append(card);
      return;
    }

    const card = document.createElement("div");
    Object.assign(card.style, this.cardStyle() as Partial<CSSStyleDeclaration>);

    const loginBtn = this.bigButton("🗝  로그인");
    loginBtn.onclick = () => this.mount("login");
    const signupBtn = this.bigButton("✨  회원가입");
    signupBtn.style.background =
      "linear-gradient(180deg, rgba(7,89,133,0.95), rgba(2,40,60,0.98))";
    signupBtn.style.borderColor = "rgba(125,211,252,0.95)";
    signupBtn.onclick = () => this.mount("register");
    card.append(loginBtn, signupBtn);

    if (oauthEnabled) {
      const sep = document.createElement("div");
      sep.textContent = "또는";
      Object.assign(sep.style, {
        fontSize: "11px",
        color: "#6b7280",
        textAlign: "center",
        margin: "14px 0 6px",
      } as CSSStyleDeclaration);
      card.append(sep);
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        gap: "8px",
        justifyContent: "center",
      } as CSSStyleDeclaration);
      (["google", "github", "discord"] as OAuthProvider[]).forEach(
        (provider) => {
          const b = this.oauthButton(provider);
          row.append(b);
        }
      );
      card.append(row);
    }

    root.append(card);

    const tip = document.createElement("div");
    tip.textContent = "처음이면 회원가입 → 캐릭터를 만드세요";
    Object.assign(tip.style, {
      fontSize: "11px",
      color: "#9ca3af",
      marginTop: "10px",
      textAlign: "center",
      maxWidth: "320px",
    } as CSSStyleDeclaration);
    root.append(tip);
  }

  /* ── Form view: login OR register ────────────────────────────────── */
  private renderForm(root: HTMLDivElement, mode: "login" | "register") {
    const card = document.createElement("div");
    Object.assign(card.style, this.cardStyle() as Partial<CSSStyleDeclaration>);

    const heading = document.createElement("div");
    heading.textContent = mode === "login" ? "로그인" : "회원가입";
    Object.assign(heading.style, {
      fontSize: "18px",
      fontWeight: "bold",
      letterSpacing: "4px",
      color: "#fde047",
      textAlign: "center",
      marginBottom: "10px",
    } as CSSStyleDeclaration);
    card.append(heading);

    const idIn = document.createElement("input");
    idIn.placeholder = "계정 아이디 (영문/숫자 2~16자)";
    idIn.maxLength = 16;
    idIn.autocomplete = "username";
    Object.assign(idIn.style, this.inputStyle() as Partial<CSSStyleDeclaration>);

    const pwIn = document.createElement("input");
    pwIn.placeholder = "비밀번호";
    pwIn.type = "password";
    pwIn.autocomplete = mode === "login" ? "current-password" : "new-password";
    Object.assign(pwIn.style, this.inputStyle() as Partial<CSSStyleDeclaration>);

    const status = document.createElement("div");
    Object.assign(status.style, {
      minHeight: "16px",
      fontSize: "12px",
      color: "#fca5a5",
      textAlign: "center",
    } as CSSStyleDeclaration);

    const submitBtn = this.bigButton(
      mode === "login" ? "🗝  로그인" : "✨  계정 만들기"
    );
    if (mode === "register") {
      submitBtn.style.background =
        "linear-gradient(180deg, rgba(7,89,133,0.95), rgba(2,40,60,0.98))";
      submitBtn.style.borderColor = "rgba(125,211,252,0.95)";
    }

    const back = this.smallButton("← 메뉴로");
    back.style.marginTop = "8px";
    back.onclick = () => this.mount("title");

    const submit = () => {
      status.style.color = "#fca5a5";
      const name = idIn.value.trim();
      const pw = pwIn.value;
      if (!name) {
        status.textContent = "계정 아이디를 입력하세요";
        return;
      }
      if (!/^[a-zA-Z0-9_-]{2,16}$/.test(name)) {
        status.textContent = "아이디: 영문/숫자/_- 2~16자만 (한글 X)";
        return;
      }
      if (!pw) {
        status.textContent = "비밀번호를 입력하세요";
        return;
      }
      submitBtn.disabled = true;
      back.disabled = true;
      idIn.disabled = true;
      pwIn.disabled = true;
      status.style.color = "#a8a29e";
      status.textContent =
        (mode === "login" ? "로그인 중…" : "계정 만드는 중…") +
        " (서버가 자고 있으면 최대 30초 걸려요)";
      this.scene.start("world", {
        mode: "quick",
        username: name,
        password: pw,
        authMode: mode === "login" ? "login" : "register",
      });
    };
    submitBtn.onclick = submit;
    [idIn, pwIn].forEach((el) =>
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      })
    );

    card.append(idIn, pwIn, submitBtn, status, back);
    root.append(card);
    setTimeout(() => idIn.focus(), 50);
  }

  /* ── Style helpers ───────────────────────────────────────────────── */

  private cardStyle(): Partial<CSSStyleDeclaration> {
    return {
      width: "min(340px, 90vw)",
      padding: "18px 18px 14px",
      borderRadius: "12px",
      background: "linear-gradient(180deg, #1c1018, #0b070d)",
      border: "2px solid rgba(127,29,29,0.75)",
      boxShadow:
        "0 18px 50px rgba(0,0,0,0.7), inset 0 0 28px rgba(220,38,38,0.18)",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      pointerEvents: "auto",
    };
  }

  private inputStyle(): Partial<CSSStyleDeclaration> {
    return {
      padding: "11px 14px",
      background: "rgba(0,0,0,0.7)",
      color: "#fde047",
      border: "2px solid rgba(252,165,165,0.45)",
      borderRadius: "6px",
      fontFamily: "monospace",
      fontSize: "14px",
      letterSpacing: "2px",
      textAlign: "center",
      outline: "none",
      pointerEvents: "auto",
      width: "100%",
      boxSizing: "border-box",
    };
  }

  private bigButton(label: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    Object.assign(b.style, {
      pointerEvents: "auto",
      padding: "14px 18px",
      fontSize: "16px",
      fontFamily: "monospace",
      fontWeight: "bold",
      letterSpacing: "4px",
      color: "#fff7d6",
      background:
        "linear-gradient(180deg, rgba(127,29,29,0.95), rgba(60,10,10,0.98))",
      border: "3px solid rgba(248,113,113,0.95)",
      borderRadius: "8px",
      cursor: "pointer",
      boxShadow:
        "0 4px 14px rgba(0,0,0,0.5), inset 0 -3px 6px rgba(0,0,0,0.4)",
      transition: "transform 0.06s",
    } as CSSStyleDeclaration);
    b.addEventListener("mousedown", () => (b.style.transform = "scale(0.98)"));
    b.addEventListener("mouseup", () => (b.style.transform = "scale(1)"));
    b.addEventListener("mouseleave", () => (b.style.transform = "scale(1)"));
    return b;
  }

  private smallButton(label: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    Object.assign(b.style, {
      pointerEvents: "auto",
      padding: "8px 12px",
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#a8a29e",
      background: "rgba(0,0,0,0.5)",
      border: "1px solid rgba(168,162,158,0.4)",
      borderRadius: "6px",
      cursor: "pointer",
      letterSpacing: "2px",
    } as CSSStyleDeclaration);
    return b;
  }

  private oauthButton(provider: OAuthProvider): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    const label: Record<OAuthProvider, string> = {
      google: "Google",
      github: "GitHub",
      discord: "Discord",
    };
    const colorFg: Record<OAuthProvider, string> = {
      google: "#fbbf24",
      github: "#e5e7eb",
      discord: "#a5b4fc",
    };
    b.textContent = label[provider];
    Object.assign(b.style, {
      pointerEvents: "auto",
      flex: "1",
      padding: "10px 8px",
      fontSize: "12px",
      fontFamily: "monospace",
      letterSpacing: "2px",
      color: colorFg[provider],
      background: "rgba(0,0,0,0.6)",
      border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: "6px",
      cursor: "pointer",
    } as CSSStyleDeclaration);
    b.onclick = async () => {
      b.disabled = true;
      b.textContent = "…";
      try {
        await signInWithProvider(provider);
      } catch (e) {
        b.disabled = false;
        b.textContent = label[provider];
        alert(`${label[provider]} 로그인 실패: ${(e as Error).message}`);
      }
    };
    return b;
  }
}
