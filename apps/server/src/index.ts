import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import { WorldRoom } from "./rooms/WorldRoom.js";
import { NETWORK } from "@pr/shared";

const port = Number(process.env.PORT ?? NETWORK.PORT);
const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("world", WorldRoom);

httpServer.listen(port, () => {
  console.log(`🎮 Pixel Realms server listening on ws://localhost:${port}`);
});
