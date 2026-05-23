import { Client, Room } from "colyseus.js";
import { NETWORK } from "@pr/shared";

export interface JoinResult {
  client: Client;
  room: Room;
}

export type JoinMode = "quick" | "solo" | "create" | "join";

export interface JoinOptions {
  username: string;
  password: string;
  mode: JoinMode;
  /** Room id when mode === "join". */
  roomId?: string;
}

function defaultEndpoint(): string {
  const host = window.location.hostname || "localhost";
  return `ws://${host}:${NETWORK.PORT}`;
}

export async function joinWorld(opts: JoinOptions): Promise<JoinResult> {
  const endpoint = import.meta.env.VITE_SERVER_URL ?? defaultEndpoint();
  const client = new Client(endpoint);
  const payload = {
    username: opts.username,
    password: opts.password,
    mode: opts.mode,
  };

  let room: Room;
  switch (opts.mode) {
    case "solo":
      // Private room — closed to matchmaking. Friends can't join.
      room = await client.create("world", { ...payload, private: true });
      break;
    case "create":
      // Public-listed room with a shareable id.
      room = await client.create("world", { ...payload, private: false });
      break;
    case "join":
      if (!opts.roomId) throw new Error("Room ID required");
      room = await client.joinById(opts.roomId, payload);
      break;
    case "quick":
    default:
      room = await client.joinOrCreate("world", payload);
      break;
  }
  return { client, room };
}
