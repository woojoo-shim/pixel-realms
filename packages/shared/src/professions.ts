/**
 * Gathering professions (낚시 · 약초 채집 · 광질).
 *
 * Schema only for now — actual tile interaction + node spawning + drop
 * tables land in a follow-up turn. The data here is shared so server can
 * validate "use profession on tile X" and client can render the right
 * tooltip / cursor.
 *
 * Every character can practice all three (no class lock-in). Skill rank
 * progress will be tracked per profession on PlayerState later.
 */

export type ProfessionId = "fishing" | "herbalism" | "mining";

export interface ProfessionDef {
  id: ProfessionId;
  name: string;
  icon: string;
  description: string;
  /** Tile types where this profession can find nodes. */
  validTiles: string[];
  /** Action verb shown on the interact prompt. */
  actionVerb: string;
}

export const PROFESSIONS: ProfessionDef[] = [
  {
    id: "fishing",
    name: "낚시",
    icon: "🎣",
    description: "물가에서 물고기를 낚는다. 식량과 골드의 안정적인 출처.",
    validTiles: ["water"],
    actionVerb: "낚싯대 던지기",
  },
  {
    id: "herbalism",
    name: "약초 채집",
    icon: "🌿",
    description: "들판과 숲의 약초를 캐서 포션의 재료로 사용.",
    validTiles: ["grass"],
    actionVerb: "약초 캐기",
  },
  {
    id: "mining",
    name: "광질",
    icon: "⛏",
    description: "광맥에서 광물을 캐서 무기와 갑옷 강화의 재료로 사용.",
    validTiles: ["stone"],
    actionVerb: "광맥 채굴",
  },
];

export const PROFESSION_IDS = PROFESSIONS.map((p) => p.id);

export function getProfession(id: string): ProfessionDef | undefined {
  return PROFESSIONS.find((p) => p.id === id);
}
