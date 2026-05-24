# Pixel Realms — Deployment Guide

Hosting stack (all free tier):

| Layer | Service | Why |
|---|---|---|
| Client (Phaser+Vite) | **Vercel** | Static, global CDN |
| Game server (Colyseus WS) | **Fly.io** | Persistent WS, free shared VM |
| Account / character DB | **Supabase** Postgres | Managed, branchable, free 500MB |

---

## 1. Supabase — set up DB

1. Go to https://supabase.com → New project (pick a region close to your players).
2. Wait ~2 min for it to provision.
3. Open **SQL Editor** (left sidebar) → paste the contents of `supabase/schema.sql` → **Run**.
4. Open **Project Settings → API**, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (NOT anon — the server needs full access) → `SUPABASE_SERVICE_KEY`

Keep these two values handy — you'll paste them into Fly.io secrets next.

> ⚠️ The `service_role` key bypasses Row-Level Security. NEVER expose it to the client. Only the game server uses it (server-side only).

---

## 2. Fly.io — deploy game server

```bash
# 1) Install CLI
#    Windows (PowerShell):  iwr https://fly.io/install.ps1 -useb | iex
#    macOS/Linux:           curl -L https://fly.io/install.sh | sh

# 2) Log in
fly auth signup    # or: fly auth login

# 3) From repo root, launch (it'll detect Dockerfile + fly.toml)
fly launch --no-deploy
#   → Pick an app name (or accept the suggested one).
#   → Decline DB/Redis prompts (we use Supabase).
#   → Decline deploy when asked — we need secrets first.

# 4) Set Supabase secrets (server-side only — never in the client!)
fly secrets set \
  SUPABASE_URL="https://YOUR-PROJECT.supabase.co" \
  SUPABASE_SERVICE_KEY="YOUR-SERVICE-ROLE-KEY"

# 5) Deploy
fly deploy
```

When it's done, note the URL — e.g. `https://pixel-realms-server.fly.dev`. The WebSocket endpoint is the same domain with `wss://` (Fly handles TLS automatically).

Test the health endpoint:
```bash
curl https://YOUR-APP.fly.dev/health
# {"ok":true,"service":"pixel-realms"}
```

---

## 3. Vercel — deploy client

### Option A — Dashboard (recommended)

1. Go to https://vercel.com/new → **Import Git Repository** → pick `woojoo-shim/pixel-realms`.
2. **Configure Project**:
   - **Root Directory**: `apps/client`
   - **Framework Preset**: Vite (auto-detected)
   - **Build Command**, **Install Command**, **Output Directory**: leave default — `apps/client/vercel.json` overrides them.
3. **Environment Variables**: add one
   - `VITE_SERVER_URL` = `wss://YOUR-APP.fly.dev` (use the Fly URL from step 2)
4. Click **Deploy**.

### Option B — CLI

```bash
npm i -g vercel
cd apps/client
vercel link            # link to a new project
vercel env add VITE_SERVER_URL production   # paste wss://YOUR-APP.fly.dev
vercel --prod
```

---

## 4. Verify

1. Open the Vercel URL on your phone or another device.
2. Create a character with a username/password.
3. Move around — check that other players appear when joining from a second browser window.
4. Disconnect and rejoin — your level/inventory/gold should persist (proving Supabase is working).

---

## Future updates

```bash
# Server changes:
fly deploy

# Client changes: push to GitHub → Vercel auto-redeploys (if connected via dashboard)
git push
```

---

## Cost expectations (hobby usage)

- **Supabase free**: 500 MB DB, 2 GB egress/mo — fine for hundreds of accounts
- **Fly.io free**: 3 shared-cpu-1x 256MB VMs — one always-on VM uses ~half the allowance
- **Vercel free**: 100 GB bandwidth/mo for the client

Should be $0/mo at modest traffic.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Client connects to wrong server | Check `VITE_SERVER_URL` is set on Vercel and **redeployed** after change |
| `WebSocket connection failed` | Confirm Fly app is reachable: `curl https://YOUR-APP.fly.dev/health` |
| `bad_password` for new name | Username only allows `[a-zA-Z0-9_-]`, 2–16 chars |
| Accounts don't persist | Check Fly logs (`fly logs`) for `[accounts:supabase]` line. If you see `[accounts] using file backend`, secrets weren't set |
| Fly cold start slow | `min_machines_running = 1` in `fly.toml` keeps one VM warm |
