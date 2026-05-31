import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { WorldRoom } from "./rooms/WorldRoom.js";
import { NETWORK } from "@pr/shared";
import { accountStore } from "./accounts.js";

const port = Number(process.env.PORT ?? NETWORK.PORT);

/** CORS — allow the deployed Vercel client + any localhost dev server. */
function applyCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf-8");
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, code: number, payload: unknown) {
  applyCors(res);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

const httpServer = createServer(async (req, res) => {
  try {
    // Preflight
    if (req.method === "OPTIONS") {
      applyCors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/health" || req.url === "/") {
      sendJson(res, 200, { ok: true, service: "pixel-realms" });
      return;
    }

    /**
     * POST /account/login
     * Body: { username, password, authMode: "login"|"register"|"auto" }
     * Response (200): { ok: true, username, character: { displayName, level, gold, hue } | null }
     * Response (200): { ok: false, reason }
     *
     * Lets the client show a "lobby" screen with the player's character
     * summary before joining the actual game room.
     */
    if (req.method === "POST" && req.url === "/account/login") {
      const body = await readBody(req);
      let parsed: { username?: string; password?: string; authMode?: string };
      try {
        parsed = JSON.parse(body);
      } catch {
        sendJson(res, 400, { ok: false, reason: "bad_json" });
        return;
      }
      const mode = (parsed.authMode === "register"
        ? "register"
        : parsed.authMode === "auto"
          ? "auto"
          : "login") as "login" | "register" | "auto";
      const result = await accountStore.loginOrRegister(
        parsed.username ?? "",
        parsed.password ?? "",
        mode
      );
      if (!result.ok) {
        sendJson(res, 200, { ok: false, reason: result.reason });
        return;
      }
      const c = result.character;
      // Treat an explicit empty displayName as "no character yet".
      const hasChar = !(c.displayName === "");
      sendJson(res, 200, {
        ok: true,
        username: result.username,
        character: hasChar
          ? {
              displayName: c.displayName ?? c.name,
              level: c.level,
              gold: c.gold,
              colorHue: c.colorHue ?? 170,
              mapId: c.mapId,
            }
          : null,
      });
      return;
    }

    res.writeHead(404);
    res.end();
  } catch (e) {
    console.error("[http] handler error:", e);
    sendJson(res, 500, { ok: false, reason: "server_error" });
  }
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("world", WorldRoom);

httpServer.listen(port, () => {
  console.log(`🎮 Pixel Realms server listening on port ${port}`);
});
