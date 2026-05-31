import { Client, Room } from "colyseus.js";
import { NETWORK } from "@pr/shared";

export interface JoinResult {
  client: Client;
  room: Room;
}

export type JoinMode = "quick" | "solo" | "create" | "join";

export interface JoinOptions {
  /** Used for password-based auth — ignored if `token` is set. */
  username: string;
  password: string;
  /** Supabase OAuth access token (Google/GitHub/Discord). Takes priority. */
  token?: string;
  /** "auto" lets the server pick (login if name exists, else register). */
  authMode?: "login" | "register" | "auto";
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
  const payload: Record<string, unknown> = {
    mode: opts.mode,
  };
  if (opts.token) {
    payload.token = opts.token;
  } else {
    payload.username = opts.username;
    payload.password = opts.password;
    payload.authMode = opts.authMode ?? "auto";
  }

  // Render free tier sleeps after 15min idle; the first connect after a
  // cold start can fail with a timeout while the container boots. Retry
  // once after a short delay so transient cold-start errors don't surface
  // as "CONNECTION FAILED" to the user.
  const attempt = async (): Promise<Room> => {
    switch (opts.mode) {
      case "solo":
        return client.create("world", { ...payload, private: true });
      case "create":
        return client.create("world", { ...payload, private: false });
      case "join":
        if (!opts.roomId) throw new Error("Room ID required");
        return client.joinById(opts.roomId, payload);
      case "quick":
      default:
        return client.joinOrCreate("world", payload);
    }
  };

  let room: Room;
  try {
    room = await attempt();
  } catch (firstErr) {
    // Some Colyseus / network errors don't have a `.code`; treat any
    // failure as "maybe cold start" and try once more after 4s.
    await new Promise((r) => setTimeout(r, 4000));
    try {
      room = await attempt();
    } catch (_secondErr) {
      throw firstErr;
    }
  }
  return { client, room };
}
