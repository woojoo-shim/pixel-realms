/**
 * Tutorial steps. The server tracks `tutorialStep` per player and
 * advances it when the matching event fires. The client just renders
 * the text for the current step.
 *
 * Trigger ids are interpreted by the server (see WorldRoom).
 */

export type TutorialTrigger =
  | "moved"
  | "entered-forest"
  | "first-attack"
  | "first-heal"
  | "first-cast"
  | "first-skill";

export interface TutorialStep {
  trigger: TutorialTrigger;
  /** Keyboard hint (PC). */
  pc: string;
  /** Touch hint (mobile). */
  mobile: string;
  /** Icon shown in the overlay. */
  icon: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    trigger: "moved",
    pc: "WASD 키로 이동하세요",
    mobile: "왼쪽 화면을 잡고 끌어서 이동",
    icon: "🧭",
  },
  {
    trigger: "entered-forest",
    pc: "북쪽 길을 따라 숲으로 가세요",
    mobile: "북쪽 길을 따라 숲으로 가세요",
    icon: "🌲",
  },
  {
    trigger: "first-attack",
    pc: "Space (또는 좌클릭)으로 적을 공격",
    mobile: "⚔ 버튼 눌러서 가까운 적 공격",
    icon: "⚔",
  },
  {
    trigger: "first-heal",
    pc: "1번 키로 HP 포션 사용",
    mobile: "🧪 버튼으로 HP 포션 사용",
    icon: "🧪",
  },
  {
    trigger: "first-cast",
    pc: "우클릭으로 Fire Bolt 발사 (MP 소모)",
    mobile: "🔥 버튼으로 Fire Bolt 발사",
    icon: "🔥",
  },
  {
    trigger: "first-skill",
    pc: "레벨업 후 K 키로 스킬에 포인트 투자",
    mobile: "레벨업 후 좌측 +SKILLS 버튼으로 스킬 투자",
    icon: "✦",
  },
];

export const TUTORIAL_DONE = TUTORIAL_STEPS.length;
