/**
 * Skill tree (D2-flavoured). Each level grants 1 skill point; the player
 * spends them on passives that boost combat, magic, or survival.
 *
 * Effects are evaluated server-side (authoritative) and shown in the
 * client UI as text tooltips.
 */

export type SkillBranch = "combat" | "magic" | "survival";

export interface SkillDef {
  id: string;
  branch: SkillBranch;
  name: string;
  icon: string;
  /** Maximum number of points that can be invested. */
  maxLevel: number;
  /** Human-readable description of the per-level bonus. */
  perLevel: string;
}

export const SKILL_TREE: SkillDef[] = [
  // ── Combat ─────────────────────────────────────────────────────────
  {
    id: "powerStrike",
    branch: "combat",
    name: "Power Strike",
    icon: "⚔",
    maxLevel: 10,
    perLevel: "+5% melee damage",
  },
  {
    id: "criticalEye",
    branch: "combat",
    name: "Critical Eye",
    icon: "✦",
    maxLevel: 10,
    perLevel: "+2% crit chance",
  },
  // ── Magic ──────────────────────────────────────────────────────────
  {
    id: "fireMastery",
    branch: "magic",
    name: "Fire Mastery",
    icon: "🔥",
    maxLevel: 10,
    perLevel: "+8% Fire Bolt damage",
  },
  {
    id: "arcaneWisdom",
    branch: "magic",
    name: "Arcane Wisdom",
    icon: "🜬",
    maxLevel: 10,
    perLevel: "+3 max MP, +0.4 MP/sec regen",
  },
  // ── Survival ───────────────────────────────────────────────────────
  {
    id: "ironSkin",
    branch: "survival",
    name: "Iron Skin",
    icon: "🛡",
    maxLevel: 10,
    perLevel: "+3% damage reduction",
  },
  {
    id: "vigorous",
    branch: "survival",
    name: "Vigorous",
    icon: "♥",
    maxLevel: 10,
    perLevel: "+5 max HP",
  },
];

export const SKILL_IDS = SKILL_TREE.map((s) => s.id);

/** Tunable per-level magnitudes (server reads these for effect calculations). */
export const SKILL_EFFECT = {
  powerStrike_dmgPct: 0.05,
  criticalEye_critPct: 0.02,
  fireMastery_dmgPct: 0.08,
  arcaneWisdom_mpPerLevel: 3,
  arcaneWisdom_regenPerSec: 0.4,
  ironSkin_drPct: 0.03,
  vigorous_hpPerLevel: 5,
} as const;

/** Get the def by id (or undefined for unknown ids). */
export function getSkillDef(id: string): SkillDef | undefined {
  return SKILL_TREE.find((s) => s.id === id);
}
