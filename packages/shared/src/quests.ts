/**
 * Quest catalog — kill-N-of-type or slay-the-boss tasks per region.
 *
 * Quests are tracked per-player on the server. When a monster dies and a
 * quest's target criteria match, the killer's progress increments. Hitting
 * the target count completes the quest and grants the reward.
 */

import type { MapId } from "./map.js";
import type { MonsterType } from "./monsters.js";

export interface QuestDef {
  id: string;
  mapId: MapId;
  title: string;
  description: string;
  /** Monster types that count. Empty array = any monster on the map. */
  targetTypes: MonsterType[];
  /** Only count if the monster was a boss. */
  bossOnly?: boolean;
  targetCount: number;
  rewardGold: number;
  rewardExp: number;
}

export const QUESTS: QuestDef[] = [
  {
    id: "q-forest-clear",
    mapId: "forest",
    title: "Forest Pests",
    description: "Cull 18 forest creatures.",
    targetTypes: ["slime", "spider", "wolf"],
    targetCount: 18,
    rewardGold: 90,
    rewardExp: 120,
  },
  {
    id: "q-forest-boss",
    mapId: "forest",
    title: "The Forest Lord",
    description: "Defeat Tor'kal, the Forest Lord.",
    targetTypes: ["wolf"],
    bossOnly: true,
    targetCount: 1,
    rewardGold: 280,
    rewardExp: 320,
  },
  {
    id: "q-desert-clear",
    mapId: "desert",
    title: "Sands of the Damned",
    description: "Purge 16 desert creatures.",
    targetTypes: ["scorpion", "mummy", "sandworm"],
    targetCount: 16,
    rewardGold: 130,
    rewardExp: 180,
  },
  {
    id: "q-desert-boss",
    mapId: "desert",
    title: "The Sand Maw",
    description: "Slay Sahkris, the Sand Maw.",
    targetTypes: ["sandworm"],
    bossOnly: true,
    targetCount: 1,
    rewardGold: 380,
    rewardExp: 440,
  },
  {
    id: "q-mountain-clear",
    mapId: "mountain",
    title: "Stone & Bone",
    description: "Defeat 16 mountain creatures.",
    targetTypes: ["bat", "goblin", "golem"],
    targetCount: 16,
    rewardGold: 160,
    rewardExp: 220,
  },
  {
    id: "q-mountain-boss",
    mapId: "mountain",
    title: "The Stoneborn",
    description: "Shatter Korgaroth the Stoneborn.",
    targetTypes: ["golem"],
    bossOnly: true,
    targetCount: 1,
    rewardGold: 460,
    rewardExp: 540,
  },
  {
    id: "q-lake-clear",
    mapId: "lake",
    title: "Drowned Tides",
    description: "Slay 20 lake denizens.",
    targetTypes: ["fish", "crab", "eel"],
    targetCount: 20,
    rewardGold: 200,
    rewardExp: 280,
  },
  {
    id: "q-lake-boss",
    mapId: "lake",
    title: "The Drowned Queen",
    description: "Vanquish Vashka, the Drowned Queen.",
    targetTypes: ["eel"],
    bossOnly: true,
    targetCount: 1,
    rewardGold: 560,
    rewardExp: 660,
  },
];

export const QUESTS_BY_ID: Record<string, QuestDef> = Object.fromEntries(
  QUESTS.map((q) => [q.id, q])
);

/** Does killing `(type, mapId, boss)` count toward `quest`'s progress? */
export function questMatches(
  quest: QuestDef,
  type: MonsterType,
  mapId: MapId,
  isBoss: boolean
): boolean {
  if (quest.mapId !== mapId) return false;
  if (quest.bossOnly && !isBoss) return false;
  if (quest.targetTypes.length > 0 && !quest.targetTypes.includes(type))
    return false;
  return true;
}

export interface FxQuestCompletePayload {
  sessionId: string;
  questId: string;
  title: string;
  rewardGold: number;
  rewardExp: number;
}
