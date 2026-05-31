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
type View = "title" | "login" | "register" | "lobby";

interface LobbyState {
  username: string;
  password: string;
  character: {
    displayName: string;
    level: number;
    gold: number;
    colorHue: number;
    mapId: string;
  } | null;
}

export class MenuScene extends Phaser.Scene {
  private overlay?: HTMLDivElement;
  private oauthToken: string | null = null;
  private oauthDisplayName: string | null = null;
  /** Set after a successful login/register, used by the lobby view. */
  private lobby: LobbyState | null = null;

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

  /* ── Backdrop: gothic night scene (moon, mountains, castle silhouette) ── */
  private drawBackdrop() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor("#08080d");
    const bg = this.add.graphics().setScrollFactor(0).setDepth(0);

    // Sky gradient — deep midnight blue at top → near-black at horizon
    bg.fillStyle(0x0c1326, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(0x16203a, 0.6);
    bg.fillRect(0, 0, w, h * 0.55);
    bg.fillStyle(0x050608, 1);
    bg.fillRect(0, h * 0.78, w, h * 0.22); // foreground ground

    // Stars (deterministic so they don't twinkle wildly on resize)
    bg.fillStyle(0xe6efff, 0.55);
    const starSeed = 13;
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 53 + starSeed) % 997) / 997;
      const sy = ((i * 71 + starSeed * 3) % 401) / 401;
      const x = sx * w;
      const y = sy * h * 0.55;
      bg.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }

    // Moon — upper-right, soft halo
    const moonX = w * 0.84;
    const moonY = h * 0.18;
    const moonR = Math.min(w, h) * 0.045;
    bg.fillStyle(0xfff7d6, 0.18);
    bg.fillCircle(moonX, moonY, moonR * 2.4);
    bg.fillStyle(0xfff7d6, 0.32);
    bg.fillCircle(moonX, moonY, moonR * 1.5);
    bg.fillStyle(0xfff7d6, 1);
    bg.fillCircle(moonX, moonY, moonR);

    // Distant mountain ridge (left side)
    bg.fillStyle(0x06080f, 1);
    bg.beginPath();
    bg.moveTo(0, h * 0.78);
    bg.lineTo(0, h * 0.55);
    bg.lineTo(w * 0.08, h * 0.42);
    bg.lineTo(w * 0.16, h * 0.5);
    bg.lineTo(w * 0.24, h * 0.36);
    bg.lineTo(w * 0.34, h * 0.5);
    bg.lineTo(w * 0.42, h * 0.46);
    bg.lineTo(w * 0.5, h * 0.78);
    bg.closePath();
    bg.fillPath();

    // Castle silhouette (right side) — main keep + two thin towers
    const cx = w * 0.78;
    const cy = h * 0.78;
    bg.fillStyle(0x07090f, 1);
    bg.fillRect(cx - w * 0.05, cy - h * 0.18, w * 0.1, h * 0.18); // keep
    bg.fillRect(cx + w * 0.04, cy - h * 0.24, w * 0.02, h * 0.24); // right spire
    bg.fillRect(cx - w * 0.06, cy - h * 0.22, w * 0.02, h * 0.22); // left spire
    // Crenellations on top of keep
    for (let i = 0; i < 6; i++) {
      bg.fillRect(cx - w * 0.05 + i * (w * 0.02), cy - h * 0.19, w * 0.01, 4);
    }
    // Tiny lit windows
    bg.fillStyle(0xfde047, 0.7);
    bg.fillRect(cx - 2, cy - h * 0.12, 3, 4);
    bg.fillRect(cx + w * 0.05, cy - h * 0.18, 2, 3);

    // Foreground ground edge
    bg.fillStyle(0x0a0c10, 1);
    bg.fillRect(0, h * 0.78, w, 2);
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
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      color: "#fff",
      fontFamily: "monospace",
      zIndex: "20",
      pointerEvents: "none",
    } as CSSStyleDeclaration);

    /* ── Central panel with gold-gilded ornate border ──────────────── */
    const panel = document.createElement("div");
    Object.assign(panel.style, {
      width: "min(360px, 88vw)",
      padding: "20px 22px 22px",
      background:
        "linear-gradient(180deg, rgba(16,20,24,0.96), rgba(8,10,14,0.98))",
      border: "3px solid #6b4f17",
      borderRadius: "4px",
      boxShadow:
        "0 0 0 2px #2a1c08 inset, 0 0 0 4px #c89834 inset, 0 0 0 5px #2a1c08 inset, 0 18px 50px rgba(0,0,0,0.85), 0 0 80px rgba(110,231,183,0.08)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "14px",
      pointerEvents: "auto",
      position: "relative",
    } as CSSStyleDeclaration);

    /* ── Corner ornaments ──────────────────────────────────────────── */
    const cornerColor = "#c89834";
    const cornerSize = 12;
    for (const [t, l, b, r] of [
      ["6px", "6px", "auto", "auto"],
      ["6px", "auto", "auto", "6px"],
      ["auto", "6px", "6px", "auto"],
      ["auto", "auto", "6px", "6px"],
    ] as const) {
      const c = document.createElement("div");
      Object.assign(c.style, {
        position: "absolute",
        top: t,
        left: l,
        bottom: b,
        right: r,
        width: `${cornerSize}px`,
        height: `${cornerSize}px`,
        background: cornerColor,
        transform: "rotate(45deg)",
        opacity: "0.85",
        pointerEvents: "none",
      } as CSSStyleDeclaration);
      panel.appendChild(c);
    }

    /* ── Hero sprite logo (the actual in-game character) ───────────── */
    const heroImg = document.createElement("img");
    heroImg.src = "/hero.png";
    heroImg.alt = "Hero";
    Object.assign(heroImg.style, {
      width: "96px",
      height: "96px",
      imageRendering: "pixelated",
      marginTop: "4px",
      filter:
        "drop-shadow(0 0 18px rgba(110,231,183,0.55)) drop-shadow(0 4px 6px rgba(0,0,0,0.6))",
    } as CSSStyleDeclaration);
    panel.append(heroImg);

    /* ── Title in mint pixel-style with glow ───────────────────────── */
    const title = document.createElement("div");
    title.textContent = "PIXEL REALMS";
    Object.assign(title.style, {
      fontSize: "clamp(24px, 6.4vmin, 38px)",
      letterSpacing: "clamp(3px, 1.3vmin, 8px)",
      color: "#6ee7b7",
      textShadow:
        "0 0 14px rgba(110,231,183,0.7), 0 0 28px rgba(110,231,183,0.3), 0 3px 0 #064e3b",
      fontWeight: "900",
      textAlign: "center",
      lineHeight: "1.05",
      margin: "0",
    } as CSSStyleDeclaration);
    panel.append(title);

    /* ── Decorative divider line with center diamond ───────────────── */
    const divider = document.createElement("div");
    Object.assign(divider.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      width: "85%",
      margin: "2px 0 6px",
    } as CSSStyleDeclaration);
    const dline1 = document.createElement("div");
    const dline2 = document.createElement("div");
    const lineStyle = {
      flex: "1",
      height: "2px",
      background:
        "linear-gradient(90deg, rgba(110,231,183,0) 0%, #6ee7b7 50%, rgba(110,231,183,0) 100%)",
    } as Partial<CSSStyleDeclaration>;
    Object.assign(dline1.style, lineStyle);
    Object.assign(dline2.style, lineStyle);
    const diamond = document.createElement("div");
    Object.assign(diamond.style, {
      width: "8px",
      height: "8px",
      background: "#6ee7b7",
      transform: "rotate(45deg)",
      boxShadow: "0 0 8px rgba(110,231,183,0.8)",
    } as CSSStyleDeclaration);
    divider.append(dline1, diamond, dline2);
    panel.append(divider);

    /* ── View-specific contents ────────────────────────────────────── */
    if (view === "title") this.renderTitle(panel);
    else if (view === "login") this.renderForm(panel, "login");
    else if (view === "register") this.renderForm(panel, "register");
    else if (view === "lobby") this.renderLobby(panel);

    overlay.append(panel);
    document.body.append(overlay);
    this.overlay = overlay;
  }

  /* ── Title view: just two buttons (로그인 / 회원가입) ─────────────── */
  private renderTitle(panel: HTMLDivElement) {
    const stack = document.createElement("div");
    Object.assign(stack.style, {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      width: "100%",
    } as CSSStyleDeclaration);

    const loginBtn = this.bigButton("🗝  로그인");
    loginBtn.onclick = () => this.mount("login");

    const signupBtn = this.bigButton("✨  회원가입");
    signupBtn.style.background =
      "linear-gradient(180deg, rgba(7,89,133,0.95), rgba(2,40,60,0.98))";
    signupBtn.style.borderColor = "rgba(125,211,252,0.95)";
    signupBtn.onclick = () => this.mount("register");

    stack.append(loginBtn, signupBtn);
    panel.append(stack);
  }

  /* ── Form view: login OR register ────────────────────────────────── */
  private renderForm(panel: HTMLDivElement, mode: "login" | "register") {
    const card = document.createElement("div");
    Object.assign(card.style, {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    } as CSSStyleDeclaration);

    const heading = document.createElement("div");
    heading.textContent = mode === "login" ? "로그인" : "회원가입";
    Object.assign(heading.style, {
      fontSize: "16px",
      fontWeight: "bold",
      letterSpacing: "4px",
      color: "#c89834",
      textAlign: "center",
      marginBottom: "4px",
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

    const submit = async () => {
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
      try {
        const result = await this.callAccountLogin(name, pw, mode);
        if (!result.ok) {
          status.style.color = "#fca5a5";
          status.textContent = this.reasonToKo(result.reason);
          submitBtn.disabled = false;
          back.disabled = false;
          idIn.disabled = false;
          pwIn.disabled = false;
          return;
        }
        // Stash credentials + character summary, advance to lobby.
        this.lobby = {
          username: result.username,
          password: pw,
          character: result.character ?? null,
        };
        this.mount("lobby");
      } catch (e) {
        status.style.color = "#fca5a5";
        status.textContent = `서버 연결 실패: ${(e as Error).message}`;
        submitBtn.disabled = false;
        back.disabled = false;
        idIn.disabled = false;
        pwIn.disabled = false;
      }
    };
    submitBtn.onclick = submit;
    [idIn, pwIn].forEach((el) =>
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      })
    );

    card.append(idIn, pwIn, submitBtn, status, back);
    panel.append(card);
    setTimeout(() => idIn.focus(), 50);
  }

  /* ── HTTP: pre-flight login (returns char summary before joining room) ── */
  private async callAccountLogin(
    username: string,
    password: string,
    mode: "login" | "register"
  ): Promise<{
    ok: true;
    username: string;
    character: LobbyState["character"];
  } | { ok: false; reason: string }> {
    const wsUrl =
      (import.meta as { env?: Record<string, string | undefined> }).env
        ?.VITE_SERVER_URL ?? "";
    const httpUrl = wsUrl
      ? wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:")
      : `http://${window.location.hostname}:2567`;
    const res = await fetch(`${httpUrl}/account/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, authMode: mode }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  private reasonToKo(reason: string): string {
    switch (reason) {
      case "no_such_account":
        return "이 아이디로 가입된 계정이 없습니다. 회원가입을 먼저 하세요.";
      case "name_taken":
        return "이미 사용 중인 아이디입니다.";
      case "bad_password":
        return "비밀번호가 틀렸습니다.";
      case "invalid_name":
        return "아이디 형식이 잘못됐습니다.";
      default:
        return `오류: ${reason}`;
    }
  }

  /* ── Lobby view: character slot + play / create ──────────────────── */
  private renderLobby(panel: HTMLDivElement) {
    if (!this.lobby) {
      this.mount("title");
      return;
    }
    const greet = document.createElement("div");
    greet.textContent = `환영합니다, ${this.lobby.username}`;
    Object.assign(greet.style, {
      fontSize: "12px",
      color: "#c89834",
      letterSpacing: "2px",
      textAlign: "center",
    } as CSSStyleDeclaration);
    panel.append(greet);

    const slot = document.createElement("div");
    Object.assign(slot.style, {
      width: "100%",
      padding: "14px 14px",
      borderRadius: "6px",
      border: "2px solid #4a3a18",
      background:
        "linear-gradient(180deg, rgba(20,16,10,0.85), rgba(10,8,6,0.95))",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
    } as CSSStyleDeclaration);

    const char = this.lobby.character;
    if (char) {
      const name = document.createElement("div");
      name.textContent = char.displayName;
      Object.assign(name.style, {
        fontSize: "16px",
        fontWeight: "bold",
        color: "#fde047",
        letterSpacing: "3px",
      } as CSSStyleDeclaration);
      const meta = document.createElement("div");
      meta.textContent = `Lv ${char.level} · ${char.gold}g · ${char.mapId}`;
      Object.assign(meta.style, {
        fontSize: "11px",
        color: "#a8a29e",
        letterSpacing: "1px",
      } as CSSStyleDeclaration);
      slot.append(name, meta);
    } else {
      const empty = document.createElement("div");
      empty.textContent = "캐릭터가 아직 없어요";
      Object.assign(empty.style, {
        fontSize: "13px",
        color: "#a8a29e",
      } as CSSStyleDeclaration);
      const hint = document.createElement("div");
      hint.textContent = "플레이 시작하면 캐릭터 만들기 화면이 떠요";
      Object.assign(hint.style, {
        fontSize: "10px",
        color: "#6b7280",
        textAlign: "center",
      } as CSSStyleDeclaration);
      slot.append(empty, hint);
    }
    panel.append(slot);

    const playBtn = this.bigButton(char ? "⚔  플레이" : "✨  캐릭터 만들기");
    playBtn.onclick = () => {
      this.scene.start("world", {
        mode: "quick",
        username: this.lobby!.username,
        password: this.lobby!.password,
        authMode: "login",
      });
    };
    panel.append(playBtn);

    const out = this.smallButton("← 로그아웃");
    out.style.marginTop = "4px";
    out.onclick = () => {
      this.lobby = null;
      this.mount("title");
    };
    panel.append(out);
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
