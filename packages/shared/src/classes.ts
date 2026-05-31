/**
 * Character class catalog (extensible).
 *
 * Adding a new class is data-only: push a new entry to {@link CLASSES} and
 * (optionally) tweak the per-class skill grants in {@link ClassDef.startingSkills}.
 * Server reads these at character creation to apply base stat modifiers and
 * skill unlocks. Client reads the same list to render the class picker.
 */

export type ClassId = "warrior" | "mage" | "ranger";

export interface ClassDef {
  id: ClassId;
  /** Korean display name. */
  name: string;
  /** 1-char emoji used in pickers + HUD. */
  icon: string;
  /** Short description shown on the picker card. */
  description: string;
  /** Primary tint colour (used for sprite hue suggestion + UI accents). */
  primaryColor: number;
  /** Suggested initial colorHue (degrees, 0..360) for the player sprite. */
  suggestedHue: number;
  /** Flat HP added on top of {@link PROGRESSION.BASE_HP} at level 1. */
  baseHpBonus: number;
  /** Flat MP added on top of {@link PROGRESSION.BASE_MP} at level 1. */
  baseMpBonus: number;
  /** Free stat points granted automatically at creation (no need to spend). */
  baseStr: number;
  baseVit: number;
  baseMnd: number;
  baseQck: number;
  /**
   * Skill IDs (from {@link SKILL_TREE}) that start with 1 free level on this
   * class. Extension point — add gating later by branch/profession.
   */
  startingSkills: string[];
  /** Tagline shown on the class picker card (one-liner). */
  tagline: string;
}

export const CLASSES: ClassDef[] = [
  {
    id: "warrior",
    name: "검사",
    icon: "⚔",
    description:
      "두꺼운 갑옷과 강한 일격. 근접에서 빛난다.\n많은 HP, 적은 MP.",
    tagline: "강철의 벽",
    primaryColor: 0xb91c1c,
    suggestedHue: 0,
    baseHpBonus: 15,
    baseMpBonus: -5,
    baseStr: 2,
    baseVit: 2,
    baseMnd: 0,
    baseQck: 0,
    startingSkills: ["powerStrike", "ironSkin"],
  },
  {
    id: "mage",
    name: "마법사",
    icon: "🔮",
    description:
      "원소 마법을 휘두른다. HP는 낮지만\n강력한 광역 공격이 가능.",
    tagline: "원소의 의지",
    primaryColor: 0x6366f1,
    suggestedHue: 260,
    baseHpBonus: -5,
    baseMpBonus: 20,
    baseStr: 0,
    baseVit: 0,
    baseMnd: 4,
    baseQck: 0,
    startingSkills: ["fireMastery", "arcaneWisdom"],
  },
  {
    id: "ranger",
    name: "사냥꾼",
    icon: "🏹",
    description:
      "빠른 발과 정확한 사격. 균형 잡힌 만능형.\n어떤 상황에도 적응.",
    tagline: "그림자의 화살",
    primaryColor: 0x059669,
    suggestedHue: 140,
    baseHpBonus: 5,
    baseMpBonus: 5,
    baseStr: 1,
    baseVit: 0,
    baseMnd: 1,
    baseQck: 3,
    startingSkills: ["criticalEye", "vigorous"],
  },
];

export const DEFAULT_CLASS_ID: ClassId = "warrior";

export function getClass(id: string): ClassDef | undefined {
  return CLASSES.find((c) => c.id === id);
}

/** All known class ids — handy for server validation. */
export const CLASS_IDS = CLASSES.map((c) => c.id);
