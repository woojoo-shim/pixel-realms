# Pixel Realms

Diablo 2-inspired 2D pixel-art multiplayer hack-and-slash RPG.

- **Client**: Phaser 3 + Vite (TypeScript)
- **Server**: Node.js + Colyseus 0.16 (authoritative game loop, 20Hz tick)
- **Mobile-first** — touch joystick + on-screen action buttons
- Account system with persistent characters (one per account)

## Features

- Linear act progression: Town → Forest → Desert → Mountain → Lake
- 12 monster types with pack spawning, champions, and act bosses
- 7 active skills: melee, Fire Bolt, Frost Nova, Teleport, Meteor, healing
- Inventory + 4-slot equipment with common/magic/rare rarities
- Stat allocation (Vitality / Mind / Strength / Quickness)
- Treasure chests, buff shrines (5 types), waypoint fast travel
- Vendor in town (buy potions, sell loot)
- Quest log with 8 quests across the realm
- Mini-map radar in corner
- D2-style hurt vignette on damage

## Development

```bash
pnpm install
pnpm dev:server   # ws://localhost:2567
pnpm dev:client   # http://localhost:5173 (also exposes LAN)
```

Open the URL, create an account (username + password), and play.

## Controls

| Action | PC | Mobile |
|---|---|---|
| Move | WASD | Joystick (left half) |
| Attack | Left-click / Space | ⚔ button |
| Fire Bolt | Right-click / 2 / E | 🔥 button |
| Frost Nova | Shift+Right-click / 3 / F | ❄ button |
| Teleport | T | ➤ button |
| Meteor | M | ☄ button |
| Heal potion | 1 / Q | 🧪 button |
| Character | C | +N STATS popup |
| Inventory | I | 🎒 button |
| Quests | J | 📜 button |

## Project layout

```
apps/
  client/   Phaser + Vite — static build, deploy to Vercel
  server/   Node + Colyseus — WebSocket server, deploy to Fly.io/Railway
packages/
  shared/   Types, constants, map generator (no build step)
```

## Persistence

Player accounts are stored in `apps/server/data/accounts.json` (gitignored). For production deploy this should be swapped for a real DB (Supabase Postgres or similar).

## License

MIT.
