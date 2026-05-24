import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import { WorldRoom } from "./rooms/WorldRoom.js";
import { NETWORK } from "@pr/shared";

const port = Number(process.env.PORT ?? NETWORK.PORT);

// HTTP server with a /health endpoint so Fly.io / Railway can probe.
const httpServer = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "pixel-realms" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("world", WorldRoom);

httpServer.listen(port, () => {
  console.log(`🎮 Pixel Realms server listening on port ${port}`);
});
