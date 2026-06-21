/**
 * NPC catalog (data-driven, extensible).
 *
 * Each NPC has a fixed home map and a closed loop of waypoints they
 * patrol between. At each waypoint they loiter for a configurable
 * window (sometimes voicing an "idle" line), then advance to the
 * next. When a player walks within `greetRange` of an NPC, they turn
 * to face the player and emit a "greet" line — gated by an internal
 * cooldown so they don't spam.
 *
 * Adding a new NPC: append an entry here. The server picks them up
 * on room creation; the client renders any synced NpcState.
 *
 * Coordinates are absolute world pixels. The town centre is roughly
 * (1600, 1600) and tile size is 32px, so a +96 offset = 3 tiles east.
 */

import type { MapId } from "./map.js";

export interface NpcWaypoint {
  /** World x in pixels. */
  x: number;
  /** World y in pixels. */
  y: number;
  /** How long to pause at this waypoint before moving on (ms). */
  loiterMs: number;
}

export interface NpcDef {
  id: string;
  /** Display name shown above the sprite. */
  name: string;
  mapId: MapId;
  /** Sprite tint applied to the shared player-other texture. */
  color: number;
  /** Walking speed in px/s. */
  walkSpeed: number;
  /** Pixels — players closer than this trigger a "greet" line. */
  greetRange: number;
  /** Closed loop of waypoints — last → first. */
  waypoints: NpcWaypoint[];
  /** Random spoken lines when idle (40% chance per loiter window). */
  idleLines: string[];
  /** Random spoken lines when a player walks up. */
  greetLines: string[];
  /** Optional one-word role shown after the name ("baker", "guard"…). */
  role?: string;
}

/**
 * Town NPCs. The town centre is at (1600, 1600). All waypoints below
 * sit within the inner walkable area (~ 1480-1730 by 1480-1740) so
 * NPCs never wander into walls.
 */
export const NPCS: NpcDef[] = [
  {
    id: "marcus",
    name: "마커스",
    role: "빵집 주인",
    mapId: "town",
    color: 0xfb923c, // warm orange
    walkSpeed: 26,
    greetRange: 64,
    waypoints: [
      { x: 1700, y: 1568, loiterMs: 4200 }, // outside shop
      { x: 1700, y: 1620, loiterMs: 2400 },
      { x: 1640, y: 1620, loiterMs: 1800 },
      { x: 1640, y: 1568, loiterMs: 2400 },
    ],
    idleLines: [
      "오늘 빵이 정말 잘 구워졌어.",
      "아침에 일찍 일어났더니 졸리네.",
      "밀가루 향기가 좋다…",
    ],
    greetLines: [
      "어서 오세요! 따끈한 빵이 있어요.",
      "여행자신가? 길 조심하시게.",
      "한 입 드시고 가세요!",
    ],
  },
  {
    id: "helena",
    name: "헬레나",
    role: "경비대장",
    mapId: "town",
    color: 0x60a5fa, // steel blue
    walkSpeed: 38,
    greetRange: 72,
    waypoints: [
      { x: 1600, y: 1700, loiterMs: 1600 },
      { x: 1600, y: 1780, loiterMs: 2200 }, // south gate
      { x: 1600, y: 1700, loiterMs: 1600 },
      { x: 1600, y: 1520, loiterMs: 2200 }, // north gate
    ],
    idleLines: [
      "이상 없음.",
      "괴물 소식이 자꾸 들려와…",
      "마을의 평화는 내가 지킨다.",
    ],
    greetLines: [
      "용감하군. 숲을 조심하시오.",
      "다치면 분수 근처 할아버지를 찾게.",
      "무기는 잘 챙기셨소?",
    ],
  },
  {
    id: "ben",
    name: "벤 할아버지",
    role: "촌로",
    mapId: "town",
    color: 0xa78bfa, // soft purple — wise vibe
    walkSpeed: 14,
    greetRange: 60,
    waypoints: [
      { x: 1580, y: 1640, loiterMs: 7000 }, // by the fountain
      { x: 1620, y: 1640, loiterMs: 4500 },
      { x: 1620, y: 1612, loiterMs: 3500 },
      { x: 1580, y: 1612, loiterMs: 4500 },
    ],
    idleLines: [
      "옛날에는 이 마을이 더 컸지…",
      "달이 붉은 밤에는 무기를 들고 다녀라.",
      "허허, 다리가 쑤시는구먼.",
    ],
    greetLines: [
      "젊은이, 어디까지 가나?",
      "용기는 검보다 강하다네.",
      "분수에 동전 하나 던지면 행운이 온다더군.",
    ],
  },
  {
    id: "lily",
    name: "릴리",
    role: "꼬마",
    mapId: "town",
    color: 0xf472b6, // pink
    walkSpeed: 58,
    greetRange: 56,
    waypoints: [
      { x: 1540, y: 1660, loiterMs: 900 },
      { x: 1660, y: 1660, loiterMs: 900 },
      { x: 1660, y: 1700, loiterMs: 900 },
      { x: 1540, y: 1700, loiterMs: 900 },
      { x: 1600, y: 1660, loiterMs: 600 },
    ],
    idleLines: [
      "잡아봐~ 잡아봐~",
      "꺄르륵!",
      "엄마가 늦게 다니지 말랬는데…",
    ],
    greetLines: [
      "와! 진짜 영웅이다!",
      "검 만져봐도 돼요?",
      "괴물이 정말 그렇게 무서워요?",
    ],
  },
];

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(
  NPCS.map((n) => [n.id, n])
);
