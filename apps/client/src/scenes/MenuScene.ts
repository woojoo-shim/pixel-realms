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
 * Title screen — Diablo-flavoured, dark background with rising embers
 * and a DOM overlay for the name input + "Enter World" button.
 */
export class MenuScene extends Phaser.Scene {
  private overlay?: HTMLDivElement;
  private emberTimer?: Phaser.Time.TimerEvent;
  /** Cached Supabase session (set after getSession() resolves). */
  private oauthToken: string | null = null;
  private oauthDisplayName: string | null = null;

  constructor() {
    super("menu");
  }

  create() {
    this.cameras.main.setBackgroundColor("#070405");

    /* Layered dark gradient backdrop (top-left torch glow → black corners) */
    const w = this.scale.width;
    const h = this.scale.height;
    const bg = this.add.graphics().setScrollFactor(0).setDepth(0);
    // distant warm glow at top
    bg.fillStyle(0x451a07, 0.6);
    bg.fillEllipse(w * 0.5, h * 0.25, w * 1.2, h * 0.8);
    bg.fillStyle(0x1a0a07, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(0x2a1006, 0.65);
    bg.fillEllipse(w * 0.5, h * 0.6, w * 1.4, h * 0.9);

    /* Sigil ring behind title (decorative circle) */
    const sigil = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(1);
    sigil.lineStyle(2, 0x7f1d1d, 0.5);
    sigil.strokeCircle(w * 0.5, h * 0.32, Math.min(w, h) * 0.22);
    sigil.lineStyle(1, 0xb91c1c, 0.4);
    sigil.strokeCircle(w * 0.5, h * 0.32, Math.min(w, h) * 0.26);
    this.tweens.add({
      targets: sigil,
      alpha: 0.5,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    /* Rising embers — emit one every ~80ms from the bottom */
    this.emberTimer = this.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => this.spawnEmber(w, h),
    });

    this.buildOverlay();

    this.scale.on("resize", this.onResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.remove();
      this.overlay = undefined;
      this.emberTimer?.remove();
      this.scale.off("resize", this.onResize, this);
    });
  }

  private onResize = () => {
    /* For simplicity, the DOM overlay handles its own resize via CSS. */
  };

  private spawnEmber(w: number, h: number) {
    const x = Math.random() * w;
    const y = h + 10;
    const size = 1 + Math.random() * 2;
    const tint =
      Math.random() < 0.4
        ? 0xfdba74
        : Math.random() < 0.6
          ? 0xff7043
          : 0xfde047;
    const e = this.add.circle(x, y, size, tint, 1).setScrollFactor(0).setDepth(2);
    const driftX = (Math.random() - 0.5) * 60;
    this.tweens.add({
      targets: e,
      x: x + driftX,
      y: -10,
      alpha: { from: 0.9, to: 0 },
      duration: 3500 + Math.random() * 2000,
      onComplete: () => e.destroy(),
    });
  }

  private buildOverlay() {
    const div = document.createElement("div");
    Object.assign(div.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "22px",
      zIndex: "30",
      color: "#fff",
      fontFamily: "monospace",
      pointerEvents: "none",
      padding: "20px",
      boxSizing: "border-box",
    } as CSSStyleDeclaration);

    const title = document.createElement("div");
    title.textContent = "PIXEL REALMS";
    Object.assign(title.style, {
      fontSize: "clamp(36px, 9vw, 64px)",
      letterSpacing: "0.5em",
      fontWeight: "900",
      color: "#fde047",
      textShadow:
        "0 0 22px rgba(252,165,165,0.4), 0 0 6px rgba(220,38,38,0.55), 0 4px 10px #000",
      textAlign: "center",
      paddingRight: "0.5em", // visual compensation for letter spacing
    } as CSSStyleDeclaration);

    const subtitle = document.createElement("div");
    subtitle.textContent = "— A pixel-art multiplayer hack-and-slash —";
    Object.assign(subtitle.style, {
      fontSize: "clamp(11px, 2vw, 14px)",
      letterSpacing: "0.2em",
      color: "#a8a29e",
      textShadow: "0 2px 4px #000",
      textAlign: "center",
    } as CSSStyleDeclaration);

    const form = document.createElement("div");
    Object.assign(form.style, {
      marginTop: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      alignItems: "center",
      pointerEvents: "auto",
    } as CSSStyleDeclaration);

    const savedName =
      localStorage.getItem("pr:name") ?? `Hero${Math.floor(Math.random() * 1000)}`;

    const nameInput = document.createElement("input");
    nameInput.value = savedName;
    nameInput.maxLength = 16;
    nameInput.placeholder = "이름 (2~16자)";
    nameInput.autocomplete = "username";
    Object.assign(nameInput.style, {
      padding: "12px 18px",
      width: "min(280px, 80vw)",
      background: "rgba(0,0,0,0.7)",
      color: "#fde047",
      border: "2px solid rgba(252,165,165,0.5)",
      borderRadius: "6px",
      fontFamily: "monospace",
      fontSize: "16px",
      textAlign: "center",
      letterSpacing: "2px",
      outline: "none",
      boxShadow: "inset 0 0 12px rgba(127,29,29,0.45)",
    } as CSSStyleDeclaration);

    const passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.maxLength = 32;
    passwordInput.placeholder = "비밀번호";
    passwordInput.autocomplete = "current-password";
    Object.assign(passwordInput.style, {
      padding: "12px 18px",
      width: "min(280px, 80vw)",
      background: "rgba(0,0,0,0.7)",
      color: "#fde047",
      border: "2px solid rgba(252,165,165,0.5)",
      borderRadius: "6px",
      fontFamily: "monospace",
      fontSize: "16px",
      textAlign: "center",
      letterSpacing: "2px",
      outline: "none",
      boxShadow: "inset 0 0 12px rgba(127,29,29,0.45)",
    } as CSSStyleDeclaration);

    const styleBtn = (
      btn: HTMLButtonElement,
      variant: "primary" | "ghost" = "primary"
    ) => {
      Object.assign(btn.style, {
        padding: "11px 22px",
        fontSize: "clamp(13px, 2.6vw, 16px)",
        fontFamily: "monospace",
        fontWeight: "bold",
        letterSpacing: "0.18em",
        color: variant === "primary" ? "#fff7d6" : "#fde047",
        background:
          variant === "primary"
            ? "linear-gradient(180deg, rgba(127,29,29,0.92), rgba(60,10,10,0.97))"
            : "rgba(0,0,0,0.6)",
        border:
          variant === "primary"
            ? "3px solid rgba(248,113,113,0.95)"
            : "2px solid rgba(252,165,165,0.45)",
        borderRadius: "8px",
        cursor: "pointer",
        boxShadow:
          variant === "primary"
            ? "0 4px 16px rgba(0,0,0,0.55), inset 0 -3px 6px rgba(0,0,0,0.4)"
            : "0 2px 6px rgba(0,0,0,0.4)",
        transition: "transform 0.08s ease",
        touchAction: "manipulation",
        width: "min(280px, 80vw)",
      } as CSSStyleDeclaration);
      btn.addEventListener("pointerdown", () => {
        btn.style.transform = "scale(0.96)";
      });
      btn.addEventListener("pointerup", () => {
        btn.style.transform = "scale(1)";
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.transform = "scale(1)";
      });
    };

    const soloBtn = document.createElement("button");
    soloBtn.type = "button";
    soloBtn.textContent = "▶  시작";
    styleBtn(soloBtn, "primary");
    // Give the main CTA more visual weight than the rest
    Object.assign(soloBtn.style, {
      padding: "16px 22px",
      fontSize: "clamp(15px, 3.4vw, 19px)",
      letterSpacing: "0.3em",
    } as CSSStyleDeclaration);

    const createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.textContent = "✨  새 방 만들기";
    styleBtn(createBtn, "ghost");

    /* Join row: input + button */
    const joinRow = document.createElement("div");
    Object.assign(joinRow.style, {
      display: "flex",
      gap: "6px",
      width: "min(280px, 80vw)",
    } as CSSStyleDeclaration);

    const roomInput = document.createElement("input");
    roomInput.placeholder = "방 코드";
    roomInput.maxLength = 12;
    Object.assign(roomInput.style, {
      flex: "1",
      padding: "10px 12px",
      background: "rgba(0,0,0,0.7)",
      color: "#fff",
      border: "2px solid rgba(96,165,250,0.45)",
      borderRadius: "6px",
      fontFamily: "monospace",
      fontSize: "14px",
      textAlign: "center",
      letterSpacing: "2px",
      outline: "none",
      textTransform: "uppercase",
    } as CSSStyleDeclaration);

    const joinBtn = document.createElement("button");
    joinBtn.type = "button";
    joinBtn.textContent = "입장";
    Object.assign(joinBtn.style, {
      padding: "10px 18px",
      background: "linear-gradient(180deg, rgba(30,58,138,0.92), rgba(8,20,60,0.95))",
      color: "#fff",
      border: "2px solid rgba(96,165,250,0.75)",
      borderRadius: "6px",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "14px",
      letterSpacing: "0.15em",
      cursor: "pointer",
      touchAction: "manipulation",
    } as CSSStyleDeclaration);

    joinRow.appendChild(roomInput);
    joinRow.appendChild(joinBtn);

    const status = document.createElement("div");
    Object.assign(status.style, {
      minHeight: "14px",
      fontSize: "11px",
      color: "#fca5a5",
      textAlign: "center",
      letterSpacing: "1px",
    } as CSSStyleDeclaration);

    const launch = (mode: "solo" | "create" | "join", roomId?: string) => {
      // ── OAuth path ────────────────────────────────────────────────
      if (this.oauthToken) {
        if (mode === "join" && (!roomId || roomId.length < 3)) {
          status.style.color = "#fca5a5";
          status.textContent = "방 코드를 입력하세요";
          return;
        }
        soloBtn.disabled = true;
        createBtn.disabled = true;
        joinBtn.disabled = true;
        status.style.color = "#a8a29e";
        status.textContent = "입장 중…";
        this.scene.start("world", {
          mode,
          roomId,
          token: this.oauthToken,
        });
        return;
      }
      // ── Username/password path ────────────────────────────────────
      const finalName = (
        nameInput.value.trim() || `Hero${Math.floor(Math.random() * 1000)}`
      ).slice(0, 16);
      const finalPw = passwordInput.value;
      if (!/^[a-zA-Z0-9_-]{2,16}$/.test(finalName)) {
        status.style.color = "#fca5a5";
        status.textContent = "이름: 영문/숫자 2~16자만 (한글 X)";
        return;
      }
      if (!finalPw) {
        status.style.color = "#fca5a5";
        status.textContent = "비밀번호를 입력하세요";
        return;
      }
      localStorage.setItem("pr:name", finalName);
      if (mode === "join" && (!roomId || roomId.length < 3)) {
        status.style.color = "#fca5a5";
        status.textContent = "방 코드를 입력하세요";
        return;
      }
      // Lock buttons during transition
      soloBtn.disabled = true;
      createBtn.disabled = true;
      joinBtn.disabled = true;
      status.style.color = "#a8a29e";
      status.textContent =
        mode === "solo"
          ? "입장 중…"
          : mode === "create"
            ? "방 만드는 중…"
            : `${roomId?.toUpperCase()} 방 입장 중…`;
      this.scene.start("world", {
        mode,
        roomId,
        username: finalName,
        password: finalPw,
        authMode,
      });
    };

    soloBtn.addEventListener("click", () => launch("solo"));
    createBtn.addEventListener("click", () => launch("create"));
    joinBtn.addEventListener("click", () =>
      launch("join", roomInput.value.trim().toUpperCase())
    );
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") passwordInput.focus();
    });
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") launch("solo");
    });
    roomInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") launch("join", roomInput.value.trim().toUpperCase());
    });

    const help = document.createElement("div");
    help.innerHTML =
      "<b style='color:#fde047'>PC</b> &nbsp;Move: <b>WASD</b> · Attack: <b>Left-click</b> / Space<br>" +
      "Fire Bolt: <b>Right-click</b> / 2 · Frost Nova: <b>Shift+RC</b> / 3<br>" +
      "Teleport: <b>T</b> · Meteor: <b>M</b> (aim with cursor)<br>" +
      "Potion: <b>1</b> / Q · Character: <b>C</b> · Inventory: <b>I</b> · Quests: <b>J</b> · Skills: <b>K</b><br>" +
      "<b style='color:#fde047'>Mobile</b> &nbsp;Joystick + on-screen ⚔ 🔥 ❄ 🧪";
    Object.assign(help.style, {
      fontSize: "11px",
      lineHeight: "1.7",
      color: "#9ca3af",
      textAlign: "center",
      marginTop: "6px",
      background: "rgba(0,0,0,0.45)",
      padding: "10px 18px",
      borderRadius: "6px",
      border: "1px solid rgba(255,255,255,0.08)",
      letterSpacing: "1px",
    } as CSSStyleDeclaration);

    /* ── OAuth row (Google / GitHub / Discord) ────────────────────── */
    const oauthRow = document.createElement("div");
    Object.assign(oauthRow.style, {
      display: oauthEnabled ? "flex" : "none",
      gap: "10px",
      width: "min(280px, 80vw)",
      justifyContent: "space-between",
    } as CSSStyleDeclaration);

    const makeOauthBtn = (
      provider: OAuthProvider,
      label: string,
      bg: string
    ) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.title = `Sign in with ${provider}`;
      Object.assign(b.style, {
        flex: "1",
        padding: "10px 0",
        fontFamily: "monospace",
        fontSize: "18px",
        background: bg,
        color: "#fff",
        border: "2px solid rgba(255,255,255,0.15)",
        borderRadius: "6px",
        cursor: "pointer",
        touchAction: "manipulation",
      } as CSSStyleDeclaration);
      b.addEventListener("click", async () => {
        status.style.color = "#a8a29e";
        status.textContent = `Redirecting to ${provider}…`;
        try {
          await signInWithProvider(provider);
        } catch (e) {
          status.style.color = "#fca5a5";
          status.textContent = `OAuth failed: ${(e as Error).message}`;
        }
      });
      return b;
    };

    oauthRow.appendChild(makeOauthBtn("google", "G", "#ea4335"));
    oauthRow.appendChild(makeOauthBtn("github", "▮", "#24292e"));
    oauthRow.appendChild(makeOauthBtn("discord", "✦", "#5865f2"));

    const oauthLabel = document.createElement("div");
    oauthLabel.textContent = oauthEnabled
      ? "— Sign in with —"
      : "";
    Object.assign(oauthLabel.style, {
      display: oauthEnabled ? "block" : "none",
      fontSize: "10px",
      color: "#9ca3af",
      letterSpacing: "0.2em",
      marginBottom: "-6px",
    } as CSSStyleDeclaration);

    const separator = document.createElement("div");
    separator.textContent = oauthEnabled ? "— or use a username —" : "";
    Object.assign(separator.style, {
      display: oauthEnabled ? "block" : "none",
      fontSize: "10px",
      color: "#9ca3af",
      letterSpacing: "0.2em",
      marginTop: "-2px",
    } as CSSStyleDeclaration);

    /* ── Signed-in indicator (replaces username/password when OAuth'd) ── */
    const signedInBanner = document.createElement("div");
    Object.assign(signedInBanner.style, {
      display: "none",
      width: "min(280px, 80vw)",
      padding: "10px 14px",
      borderRadius: "6px",
      border: "1px solid rgba(132,225,180,0.55)",
      background: "rgba(20,40,30,0.85)",
      color: "#a7f3d0",
      fontSize: "12px",
      textAlign: "center",
      letterSpacing: "1px",
    } as CSSStyleDeclaration);
    const signOutBtn = document.createElement("button");
    signOutBtn.type = "button";
    signOutBtn.textContent = "Sign out";
    Object.assign(signOutBtn.style, {
      marginLeft: "8px",
      padding: "2px 8px",
      fontSize: "10px",
      background: "transparent",
      color: "#fca5a5",
      border: "1px solid rgba(252,165,165,0.5)",
      borderRadius: "4px",
      cursor: "pointer",
    } as CSSStyleDeclaration);
    signOutBtn.addEventListener("click", async () => {
      await signOut();
      window.location.reload();
    });

    /* ── Check for existing session (returning from OAuth or persisted) ── */
    (async () => {
      cleanOAuthHash();
      const session = await getSession();
      if (session) {
        this.oauthToken = session.access_token;
        const u = session.user;
        this.oauthDisplayName =
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          (u.email as string | undefined) ??
          "Adventurer";
        // Hide username/password, show signed-in state
        nameInput.style.display = "none";
        passwordInput.style.display = "none";
        oauthRow.style.display = "none";
        oauthLabel.style.display = "none";
        separator.style.display = "none";
        signedInBanner.innerHTML = `Signed in as <b>${this.oauthDisplayName}</b>`;
        signedInBanner.appendChild(signOutBtn);
        signedInBanner.style.display = "block";
      }
    })();

    form.appendChild(oauthLabel);
    form.appendChild(oauthRow);
    form.appendChild(separator);
    form.appendChild(signedInBanner);
    // No login/register tabs — server uses "auto" mode (login if name exists,
    // else create a new account). One unified flow, no decision burden.
    const authMode: "auto" = "auto";

    // ── Hint line ─────────────────────────────────────────────────
    const hint = document.createElement("div");
    hint.textContent =
      "처음이면 이름+비밀번호를 정하세요. 다시 들어올 때 같은 걸 입력하면 캐릭터가 그대로 살아납니다.";
    Object.assign(hint.style, {
      fontSize: "11px",
      color: "#9ca3af",
      maxWidth: "min(280px, 80vw)",
      textAlign: "center",
      lineHeight: "1.45",
      margin: "-4px 0 -2px 0",
    } as CSSStyleDeclaration);

    // ── Collapsible friend-mode section ───────────────────────────
    const friendToggle = document.createElement("button");
    friendToggle.type = "button";
    friendToggle.textContent = "▸ 친구랑 플레이";
    Object.assign(friendToggle.style, {
      background: "transparent",
      border: "none",
      color: "#94a3b8",
      fontSize: "12px",
      fontFamily: "monospace",
      cursor: "pointer",
      padding: "4px 8px",
      letterSpacing: "1px",
      touchAction: "manipulation",
    } as CSSStyleDeclaration);

    const friendBox = document.createElement("div");
    Object.assign(friendBox.style, {
      display: "none",
      flexDirection: "column",
      alignItems: "center",
      gap: "10px",
      width: "min(280px, 80vw)",
      padding: "10px",
      border: "1px dashed rgba(252,165,165,0.35)",
      borderRadius: "8px",
      background: "rgba(0,0,0,0.35)",
    } as CSSStyleDeclaration);
    const friendLabel = document.createElement("div");
    friendLabel.textContent = "여러 명이 같이 놀고 싶다면";
    Object.assign(friendLabel.style, {
      fontSize: "10px",
      color: "#94a3b8",
      letterSpacing: "1px",
    } as CSSStyleDeclaration);
    friendBox.append(friendLabel, createBtn, joinRow);

    friendToggle.addEventListener("click", () => {
      const open = friendBox.style.display !== "none";
      friendBox.style.display = open ? "none" : "flex";
      friendToggle.textContent = open ? "▸ 친구랑 플레이" : "▾ 친구랑 플레이";
    });

    form.appendChild(nameInput);
    form.appendChild(passwordInput);
    form.appendChild(soloBtn);
    form.appendChild(hint);
    form.appendChild(friendToggle);
    form.appendChild(friendBox);
    form.appendChild(status);

    div.appendChild(title);
    div.appendChild(subtitle);
    div.appendChild(form);
    div.appendChild(help);
    document.body.appendChild(div);
    this.overlay = div;
  }
}
