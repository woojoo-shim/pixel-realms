/**
 * Persistent account store. Each account = one character. Stored as JSON
 * on disk (data/accounts.json). Simple username + password authentication —
 * passwords are salted + SHA-256 hashed (not bcrypt — hobby-grade only).
 *
 * On disk: lowercase-username → { salt, passwordHash, character, ... }.
 */

import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

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
  };
}

export type LoginResult =
  | { ok: true; character: CharacterData; username: string }
  | { ok: false; reason: "bad_password" | "invalid_name" };

class AccountStoreImpl {
  private accounts: Record<string, Account> = {};
  /** Pending writes flag — set true on save(), flushed on writeNow(). */
  private dirty = false;

  constructor() {
    this.load();
  }

  private load() {
    if (!existsSync(ACCOUNTS_PATH)) return;
    try {
      const data = readFileSync(ACCOUNTS_PATH, "utf-8");
      this.accounts = JSON.parse(data);
      console.log(
        `[accounts] loaded ${Object.keys(this.accounts).length} account(s)`
      );
    } catch (e) {
      console.error("[accounts] load failed:", e);
    }
  }

  /** Synchronously flush to disk. Called by saveCharacter and on shutdown. */
  private writeNow() {
    const dir = dirname(ACCOUNTS_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(ACCOUNTS_PATH, JSON.stringify(this.accounts, null, 2));
    this.dirty = false;
  }

  private hashPassword(password: string, salt: string): string {
    return createHash("sha256")
      .update(`${password}::${salt}`)
      .digest("hex");
  }

  /** Validate username — 2..16 chars, alphanumeric + underscore/dash. */
  static normalize(username: string): string | null {
    if (!username) return null;
    const u = username.trim();
    if (u.length < 2 || u.length > 16) return null;
    if (!/^[a-zA-Z0-9_-]+$/.test(u)) return null;
    return u;
  }

  loginOrRegister(usernameRaw: string, password: string): LoginResult {
    const u = AccountStoreImpl.normalize(usernameRaw);
    if (!u) return { ok: false, reason: "invalid_name" };
    const key = u.toLowerCase();
    const existing = this.accounts[key];
    if (existing) {
      const hash = this.hashPassword(password, existing.salt);
      if (hash !== existing.passwordHash)
        return { ok: false, reason: "bad_password" };
      return { ok: true, username: u, character: existing.character };
    }
    // Register new account
    const salt = randomBytes(8).toString("hex");
    const passwordHash = this.hashPassword(password, salt);
    const character = makeStarterCharacter(u);
    this.accounts[key] = {
      salt,
      passwordHash,
      character,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.writeNow();
    console.log(`[accounts] created new account: ${u}`);
    return { ok: true, username: u, character };
  }

  saveCharacter(username: string, character: CharacterData) {
    const key = username.toLowerCase();
    const acc = this.accounts[key];
    if (!acc) return;
    acc.character = character;
    acc.updatedAt = Date.now();
    this.dirty = true;
    // Debounced write — accumulate but always have a timer flushing.
    this.scheduleFlush();
  }

  private flushTimer: NodeJS.Timeout | null = null;
  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) this.writeNow();
    }, 1500);
  }

  /** Flush immediately (e.g. on shutdown). */
  flushNow() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.dirty) this.writeNow();
  }
}

export const accountStore = new AccountStoreImpl();

// Flush on process exit
process.on("SIGINT", () => {
  accountStore.flushNow();
  process.exit(0);
});
process.on("SIGTERM", () => {
  accountStore.flushNow();
  process.exit(0);
});
