/**
 * Opening story slides shown once per device on first character creation.
 *
 * Written deliberately *without* a singular Chosen One so the lore works
 * for any number of co-op players: many champions answer the same call.
 */

export interface StorySlide {
  /** Body paragraph (line breaks honoured). */
  body: string;
  /** Visual hint — what image / colour to lean into for the slide. */
  vibe: "ruins" | "darkLords" | "awakening" | "departure";
}

export const STORY_SLIDES: StorySlide[] = [
  {
    vibe: "ruins",
    body:
      "오래 전, 세계를 지키던 신들이 잠들었다.\n" +
      "왕국은 무너지고, 마을만이 외로이 남았다.",
  },
  {
    vibe: "darkLords",
    body:
      "어둠의 군주 넷이 잠에서 깨어났다.\n" +
      "Tor'kal은 숲을, Sahkris는 사막을,\n" +
      "Korgaroth는 산을, Vashka는 호수를 차지했다.",
  },
  {
    vibe: "awakening",
    body:
      "마을의 부름에 영웅들이 응답한다.\n" +
      "수많은 자들이 같은 운명에 끌려와\n" +
      "함께 일어선다 — 당신을 포함해서.",
  },
  {
    vibe: "departure",
    body:
      "직업을 골라라. 무기를 들어라.\n" +
      "마을 밖에 너의 길이 기다린다.",
  },
];
