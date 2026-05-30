/**
 * Persistent account store. Each account = one character.
 *
 * Two backends, auto-selected by env:
 *   - Supabase (SUPABASE_URL + SUPABASE_SERVICE_KEY set): production
 *   - File on disk (data/accounts.json): local dev / fallback
 *
 * Simple username + password authentication — passwords are salted +
 * SHA-256 hashed (not bcrypt — hobby-grade only).
 */

import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ACCOUNTS_PATH = resolve(process.cwd(), "data/accounts.json");

export interface InventoryItemData {
  id: string;
  itemId: string;
  rarity: string;
}

export interface CharacterData {
  name: string;
  mapId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  exp: number;
  gold: number;
  potions: number;
  statPoints: number;
  statVit: number;
  statMnd: number;
  statStr: number;
  statQck: number;
  discoveredMaps: string;
  questCompleted: string;
  questProgress: Record<string, number>;
  inventory: InventoryItemData[];
  equipment: Record<string, InventoryItemData>;
  /** Skill tree investment (id → level). */
  skillLevels: Record<string, number>;
  /** Unspent skill points. */
  skillPoints: number;
  /** Onboarding step index (0 = first; once finished holds TUTORIAL_DONE). */
  tutorialStep?: number;
  /**
   * In-game character name, set during the character-creation step.
   * Empty string = account exists but the player hasn't chosen a hero yet.
   * Undefined = legacy account from before this field existed (treat as
   * if creation is done; fall back to the account username).
   */
  displayName?: string;
  /** Player sprite hue in degrees (0..360). 170 ≈ default mint. */
  colorHue?: number;
}

interface Account {
  salt: string;
  passwordHash: string;
  character: CharacterData;
  createdAt: number;
  updatedAt: number;
}

export function makeStarterCharacter(name: string): CharacterData {
  return {
    name,
    mapId: "town",
    // Spawn near town fountain — town center is at (1600, 1600) for a
    // 3200×3200 world tileSize 32. Slight south offset feels right.
    x: 1600,
    y: 1640,
    hp: 30,
    maxHp: 30,
    mp: 20,
    maxMp: 20,
    level: 1,
    exp: 0,
    gold: 0,
    potions: 3,
    statPoints: 0,
    statVit: 0,
    statMnd: 0,
    statStr: 0,
    statQck: 0,
    discoveredMaps: "town",
    questCompleted: "",
    questProgress: {},
    inventory: [],
    equipment: {},
    skillLevels: {},
    skillPoints: 0,
    tutorialStep: 0,
    /** Empty displayName signals "no character yet — show creation modal". */
    displayName: "",
    colorHue: 170,
  };
}

export type LoginResult =
  | { ok: true; character: CharacterData; username: string }
  | {
      ok: false;
      reason:
        | "bad_password"
        | "invalid_name"
        | "bad_token"
        | "name_taken"
        | "no_such_account";
    };

/** Auth mode chosen by the player on the menu screen. */
export type AuthMode = "login" | "register" | "auto";

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(`${password}::${salt}`).digest("hex");
}

/** Validate username — 2..16 chars, alphanumeric + underscore/dash. */
function normalizeUsername(username: string): string | null {
  if (!username) return null;
  const u = username.trim();
  if (u.length < 2 || u.length > 16) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(u)) return null;
  return u;
}

interface AccountBackend {
  loginOrRegister(
    usernameRaw: string,
    password: string,
    mode?: AuthMode
  ): Promise<LoginResult>;
  loginWithToken(token: string): Promise<LoginResult>;
  saveCharacter(username: string, character: CharacterData): void;
  flushNow(): Promise<void>;
}

/* ─── File backend (local dev / no env) ─────────────────────────────── */

class FileBackend implements AccountBackend {
  private accounts: Record<string, Account> = {};
  private dirty = false;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (!existsSync(ACCOUNTS_PATH)) return;
    try {
      const data = readFileSync(ACCOUNTS_PATH, "utf-8");
      this.accounts = JSON.parse(data);
      console.log(
        `[accounts:file] loaded ${Object.keys(this.accounts).length} account(s)`
      );
    } catch (e) {
      console.error("[accounts:file] load failed:", e);
    }
  }

  private writeNow() {
    const dir = dirname(ACCOUNTS_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(ACCOUNTS_PATH, JSON.stringify(this.accounts, null, 2));
    this.dirty = false;
  }

  async loginOrRegister(
    usernameRaw: string,
    password: string,
    mode: AuthMode = "login"
  ): Promise<LoginResult> {
    const u = normalizeUsername(usernameRaw);
    if (!u) return { ok: false, reason: "invalid_name" };
    const key = u.toLowerCase();
    const existing = this.accounts[key];
    if (existing) {
      if (mode === "register") return { ok: false, reason: "name_taken" };
      if (hashPassword(password, existing.salt) !== existing.passwordHash)
        return { ok: false, reason: "bad_password" };
      return { ok: true, username: u, character: existing.character };
    }
    if (mode === "login") return { ok: false, reason: "no_such_account" };
    const salt = randomBytes(8).toString("hex");
    const character = makeStarterCharacter(u);
    this.accounts[key] = {
      salt,
      passwordHash: hashPassword(password, salt),
      character,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.writeNow();
    console.log(`[accounts:file] created: ${u}`);
    return { ok: true, username: u, character };
  }

  async loginWithToken(_token: string): Promise<LoginResult> {
    // File backend has no way to verify Supabase JWTs. OAuth is only
    // available when running with Supabase backend configured.
    return { ok: false, reason: "bad_token" };
  }

  saveCharacter(username: string, character: CharacterData) {
    const key = username.toLowerCase();
    const acc = this.accounts[key];
    if (!acc) return;
    acc.character = character;
    acc.updatedAt = Date.now();
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) this.writeNow();
    }, 1500);
  }

  async flushNow() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.dirty) this.writeNow();
  }
}

/* ─── Supabase backend ──────────────────────────────────────────────── */

class SupabaseBackend implements AccountBackend {
  private client: SupabaseClient;
  /** In-memory cache so we don't hit Supabase for every read. Keyed by lowercase username. */
  private cache = new Map<
    string,
    { salt: string; passwordHash: string; character: CharacterData; displayName: string }
  >();
  /** Pending character writes — debounced. Key = lowercase username. */
  private pending = new Map<string, CharacterData>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log(`[accounts:supabase] connected to ${url}`);
  }

  async loginOrRegister(
    usernameRaw: string,
    password: string,
    mode: AuthMode = "login"
  ): Promise<LoginResult> {
    const u = normalizeUsername(usernameRaw);
    if (!u) return { ok: false, reason: "invalid_name" };
    const key = u.toLowerCase();

    // Try cache first
    const cached = this.cache.get(key);
    if (cached) {
      if (mode === "register") return { ok: false, reason: "name_taken" };
      if (hashPassword(password, cached.salt) !== cached.passwordHash)
        return { ok: false, reason: "bad_password" };
      return { ok: true, username: cached.displayName, character: cached.character };
    }

    // Fetch from Supabase
    const { data, error } = await this.client
      .from("accounts")
      .select("display_name, salt, password_hash, character")
      .eq("username", key)
      .maybeSingle();

    if (error) {
      console.error("[accounts:supabase] select failed:", error);
      return { ok: false, reason: "invalid_name" };
    }

    if (data) {
      // "auto" mode logs in on existing accounts; only strict "register" rejects.
      if (mode === "register") return { ok: false, reason: "name_taken" };
      if (hashPassword(password, data.salt) !== data.password_hash)
        return { ok: false, reason: "bad_password" };
      this.cache.set(key, {
        salt: data.salt,
        passwordHash: data.password_hash,
        character: data.character as CharacterData,
        displayName: data.display_name,
      });
      return {
        ok: true,
        username: data.display_name,
        character: data.character as CharacterData,
      };
    }

    // Account doesn't exist → strict login fails; register & auto fall through to create.
    if (mode === "login") return { ok: false, reason: "no_such_account" };

    // Register new
    const salt = randomBytes(8).toString("hex");
    const passwordHash = hashPassword(password, salt);
    const character = makeStarterCharacter(u);
    const { error: insertErr } = await this.client.from("accounts").insert({
      username: key,
      display_name: u,
      salt,
      password_hash: passwordHash,
      character,
    });
    if (insertErr) {
      console.error("[accounts:supabase] insert failed:", insertErr);
      return { ok: false, reason: "invalid_name" };
    }
    this.cache.set(key, { salt, passwordHash, character, displayName: u });
    console.log(`[accounts:supabase] created: ${u}`);
    return { ok: true, username: u, character };
  }

  /**
   * Verify a Supabase OAuth access token, then create/load the account
   * keyed by `oauth:<supabase user id>`. Display name is taken from the
   * Google/GitHub/Discord profile when possible.
   */
  async loginWithToken(token: string): Promise<LoginResult> {
    if (!token) return { ok: false, reason: "bad_token" };
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) {
      console.warn("[accounts:supabase] token verify failed:", error?.message);
      return { ok: false, reason: "bad_token" };
    }
    const user = data.user;
    const key = `oauth:${user.id}`;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const displayName = (
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      (typeof meta.user_name === "string" && meta.user_name) ||
      (typeof meta.preferred_username === "string" && meta.preferred_username) ||
      user.email?.split("@")[0] ||
      "Adventurer"
    )
      .toString()
      .slice(0, 16);

    // Cache hit
    const cached = this.cache.get(key);
    if (cached) {
      return { ok: true, username: cached.displayName, character: cached.character };
    }

    // Lookup
    const { data: row, error: selErr } = await this.client
      .from("accounts")
      .select("display_name, character")
      .eq("username", key)
      .maybeSingle();
    if (selErr) {
      console.error("[accounts:supabase] select failed:", selErr);
      return { ok: false, reason: "bad_token" };
    }
    if (row) {
      this.cache.set(key, {
        salt: "",
        passwordHash: "",
        character: row.character as CharacterData,
        displayName: row.display_name,
      });
      // username = storage key (not display) so saveCharacter can find the row.
      // PlayerState.name comes from character.name (display name).
      return {
        ok: true,
        username: key,
        character: row.character as CharacterData,
      };
    }

    // Register
    const character = makeStarterCharacter(displayName);
    const { error: insErr } = await this.client.from("accounts").insert({
      username: key,
      display_name: displayName,
      salt: "",
      password_hash: "",
      character,
    });
    if (insErr) {
      console.error("[accounts:supabase] insert OAuth failed:", insErr);
      return { ok: false, reason: "bad_token" };
    }
    this.cache.set(key, { salt: "", passwordHash: "", character, displayName });
    console.log(`[accounts:supabase] created OAuth account: ${key} (${displayName})`);
    return { ok: true, username: key, character };
  }

  saveCharacter(username: string, character: CharacterData) {
    const key = username.toLowerCase();
    const cached = this.cache.get(key);
    if (cached) cached.character = character;
    this.pending.set(key, character);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushPending();
    }, 2000);
  }

  private async flushPending() {
    if (this.pending.size === 0) return;
    const batch = Array.from(this.pending.entries());
    this.pending.clear();
    // Update in parallel — one PATCH per account.
    await Promise.all(
      batch.map(([key, character]) =>
        this.client
          .from("accounts")
          .update({ character, updated_at: new Date().toISOString() })
          .eq("username", key)
          .then(({ error }) => {
            if (error) console.error(`[accounts:supabase] update ${key}:`, error);
          })
      )
    );
  }

  async flushNow() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushPending();
  }
}

/* ─── Backend selection ─────────────────────────────────────────────── */

function makeBackend(): AccountBackend {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (url && serviceKey) return new SupabaseBackend(url, serviceKey);
  console.log("[accounts] using file backend (no SUPABASE_URL set)");
  return new FileBackend();
}

const backend = makeBackend();

export const accountStore = {
  loginOrRegister: (u: string, p: string, mode: AuthMode = "login") =>
    backend.loginOrRegister(u, p, mode),
  loginWithToken: (token: string) => backend.loginWithToken(token),
  saveCharacter: (u: string, c: CharacterData) => backend.saveCharacter(u, c),
  flushNow: () => backend.flushNow(),
};

// Flush on process exit
process.on("SIGINT", () => {
  accountStore.flushNow();
  process.exit(0);
});
process.on("SIGTERM", () => {
  accountStore.flushNow();
  process.exit(0);
});
