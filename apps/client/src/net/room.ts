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
  // cold start can take 30-60s on slow mobile networks. Retry several
  // times with increasing backoff so we span the full boot window.
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

  // Up to 4 attempts: 0s, 4s, 9s, 15s — total ~28s budget.
  const delays = [0, 4000, 5000, 6000];
  let firstErr: unknown = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const room = await attempt();
      return { client, room };
    } catch (err) {
      if (!firstErr) firstErr = err;
    }
  }
  throw firstErr;
}
