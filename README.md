# BNBPRINT — BNB Chain Runner Radar

Real-time BNB Chain token discovery, with a focus on bonding-curve launchpads
(four.meme, GraFun, and similar). BNBPRINT screens every new token for
honeypots, rug pulls, unlocked liquidity, and low security scores, and flags
likely "runners" before their bonding curve finishes — all wrapped in an
installable, offline-capable PWA.

> ⚠️ **This is a working scaffold, not a finished, keys-in-hand product.**
> The whole app runs today with zero credentials in `DEMO_MODE` (a realistic
> simulated token feed). Going live on real BNB Chain data requires you to
> supply an RPC endpoint, optionally an Ave AI key, and — most importantly —
> **verify the bonding-curve factory contract addresses/ABIs yourself**
> (see [Going live](#going-live-turning-off-demo_mode) below). I don't have
> a way to confirm those from this environment, so treat every contract
> address in this repo as a placeholder until you've checked it on BscScan.

---

## 1. On your two questions (Firebase / database)

**You don't need Firebase, and you don't need Supabase.** BNBPRINT uses:

- **Plain Postgres via Railway's built-in Postgres plugin** for all app data
  (tokens, bookmarks, alerts, push subscriptions). This is exactly what the
  original spec described — it pairs naturally with FastAPI + SQLAlchemy,
  and relational filtering/sorting (bonding %, security score, search) is
  simple SQL instead of fighting a NoSQL model.
- **Standard Web Push (VAPID)** for PWA push notifications — no Firebase
  Cloud Messaging needed. It's a native browser API, works the same on
  Android/desktop, and doesn't add a second cloud vendor or SDK.

Firebase would only earn its place if you later want real user accounts
(Firebase Auth) instead of the current anonymous, per-device identity model.
If that's ever a priority, it can be added later without touching anything
else — the anonymous `user_id` used for bookmarks today would just become
the Firebase UID.

---

## 2. Architecture

```
┌─────────────────────┐        REST + WebSocket        ┌──────────────────────┐
│   Next.js PWA        │ ───────────────────────────▶ │   FastAPI backend      │
│   (Vercel)            │ ◀─────────────────────────── │   (Railway / Render)   │
│                        │                                │                        │
│  App Router + TS       │                                │  web3.py listener      │
│  Tailwind + next-pwa    │                                │  Ave AI client          │
│  React Query + WS ctx    │                                │  On-chain checks         │
└─────────────────────┘                                │  Scoring engine           │
                                                          │  APScheduler-style tasks   │
                                                          └───────────┬────────────┘
                                                                      │
                                                          ┌───────────▼────────────┐
                                                          │  Postgres (Railway)      │
                                                          └────────────────────────┘
```

- **Frontend**: `frontend/` — Next.js 14 (App Router), TypeScript, Tailwind,
  `next-pwa` (custom service worker with Web Push support), React Query,
  a WebSocket context provider for the live feed.
- **Backend**: `backend/` — FastAPI, SQLAlchemy (sync), `web3.py`, a
  background chain listener + refresh/cleanup loops wired through FastAPI's
  `lifespan`.
- **Database**: Postgres (Railway's built-in plugin, or any Postgres URL).

---

## 3. Repo layout

```
bnbprint/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI app, CORS, lifespan-managed background tasks
│   │   ├── config.py             Settings (env vars), incl. DEMO_MODE
│   │   ├── database.py           SQLAlchemy engine/session
│   │   ├── models.py             Token, Bookmark, Alert, PushSubscription
│   │   ├── schemas.py            Pydantic request/response models
│   │   ├── ws_manager.py         WebSocket fan-out for /ws/tokens
│   │   ├── tasks.py              Discovery pipeline, periodic refresh, cleanup
│   │   ├── routers/              tokens, bookmarks, stats, ws, push
│   │   └── services/
│   │       ├── chain_listener.py  PairCreated + bonding-factory log listener (+ demo generator)
│   │       ├── bonding.py          Bonding-curve progress readers (four.meme / GraFun stubs)
│   │       ├── security_checks.py  On-chain honeypot/owner/liquidity-lock checks
│   │       ├── ave_ai.py           Ave AI security API client (cached, best-effort)
│   │       ├── scoring.py          Security score + runner score algorithms
│   │       └── push.py             Web Push (VAPID) sender
│   ├── requirements.txt, Dockerfile, Procfile, .env.example
│
├── frontend/
│   ├── app/                     Dashboard, /token/[address], /bookmarks, /about, /offline
│   ├── components/               TokenCard, SecurityBadge, BondingProgressBar, CopyButton,
│   │                              BookmarkButton, LiveFeed, FilterBar, StatsBar, TickerTape…
│   ├── lib/                      api.ts, ws.tsx, bookmarks.ts, userId.ts, push.ts, utils.ts
│   ├── worker/index.js           Custom service worker source (API caching + Web Push)
│   ├── public/                   manifest.json, icons/, favicon.ico
│   └── package.json, next.config.js, tailwind.config.ts, .env.example
│
└── README.md (this file)
```

---

## 4. Local development

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# DEMO_MODE=true by default — no credentials needed to see it running.
# For local Postgres, either run one in Docker:
#   docker run --name bnbprint-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
# or point DATABASE_URL at any Postgres you already have.
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for interactive API docs, and
`http://localhost:8000/` for a health/status check. With `DEMO_MODE=true`
(the default) it starts emitting a synthetic token every 4–11 seconds
immediately, no keys required.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # defaults already point at localhost:8000
npm run dev
```

Visit `http://localhost:3000`. Note: `next-pwa` is disabled in dev mode by
design (Next.js convention) — the service worker, offline support, and
install prompt only activate in a production build (`npm run build && npm start`).

---

## 5. Deploying (Vercel + GitHub, Railway/Render for the backend)

Since you want GitHub + Vercel: this repo is already a git repository
(initialized locally). To ship it:

1. **Push to GitHub.** Create an empty repo on GitHub, then from the
   `bnbprint/` folder:
   ```bash
   git remote add origin https://github.com/<you>/bnbprint.git
   git branch -M main
   git add -A && git commit -m "Initial BNBPRINT scaffold"
   git push -u origin main
   ```
   (This sandbox doesn't have your GitHub credentials, so this step has to
   happen from your machine or by connecting the repo in GitHub's UI.)

2. **Backend → Railway (or Render). Do this one first** — the frontend's
   two env vars in step 3 depend on the URL this step produces.
   - [railway.app](https://railway.app) → New Project → Deploy from GitHub
     repo → pick `bnbprint`.
   - Railway will try to build the repo root — open the new service's
     **Settings** tab and set **Root Directory** to `backend`, since this
     is a monorepo. It'll then pick up `backend/Dockerfile` automatically.
   - Add a database: in the project, click **+ New → Database → Add
     PostgreSQL**. Then in your backend service's **Variables** tab, add a
     reference variable pointing `DATABASE_URL` at the Postgres plugin's
     connection string (Railway lists it for you to link, rather than you
     typing it by hand).
   - Add the rest of the variables from `backend/.env.example` in the same
     **Variables** tab (at minimum, leave `DEMO_MODE=true` for now).
   - **Get the public URL** — Railway services aren't exposed to the
     internet by default. Go to **Settings → Networking → Generate
     Domain**. That gives you something like
     `bnbprint-backend-production.up.railway.app`. That hostname is what
     you need for step 3.
   - Sanity-check it: open `https://<that-domain>/health` in a browser —
     you should see `{"status": "healthy"}`. If not, check the service's
     **Deployments → Logs** tab for the error before moving on.

3. **Frontend → Vercel.** Now that you have the backend's domain from step
   2, build the two values from it:
   - `NEXT_PUBLIC_API_URL` = `https://` + that domain (no trailing slash),
     e.g. `https://bnbprint-backend-production.up.railway.app`
   - `NEXT_PUBLIC_WS_URL` = `wss://` + that same domain + `/ws/tokens`,
     e.g. `wss://bnbprint-backend-production.up.railway.app/ws/tokens`
     (`wss://` not `https://` — it's a WebSocket, and Railway/Render
     terminate TLS for you so `wss://` just works, no extra setup)

   Then:
   - Import the same GitHub repo into Vercel → set **Root Directory** to
     `frontend`.
   - In **Settings → Environment Variables**, add both values above.
   - Deploy. Vercel auto-detects Next.js and runs `next build`. Note the
     domain Vercel gives you, e.g. `bnbprint.vercel.app`.

4. **Close the loop: update the backend's CORS.** Go back to Railway →
   your backend service → Variables → set `CORS_ORIGINS` to your new
   Vercel domain (e.g. `https://bnbprint.vercel.app`), save, and it'll
   redeploy automatically. Without this step the frontend can load but
   every API call will fail with a CORS error in the browser console.

### 5.1 If Railway keeps showing "Deployment failed"

The build finishing but the deploy still failing almost always means the
container built fine but never became reachable. In order of how often
each one is the actual cause:

1. **Port mismatch (the most common one, and now fixed in this repo).**
   Railway assigns a random `$PORT` at runtime and health-checks whatever
   port your container is *actually* listening on — a Dockerfile that
   hardcodes `--port 8000` will build successfully and then fail every
   health check, because Railway isn't necessarily targeting 8000. The
   `backend/Dockerfile` now reads `${PORT:-8000}` at container start
   (falls back to 8000 only when `$PORT` isn't set, i.e. local
   `docker run`/`docker compose`) — if you pulled this repo before this
   fix, re-copy `backend/Dockerfile`. I also added `backend/railway.json`,
   which explicitly points Railway at the Dockerfile builder and a
   `/health` health-check path, so there's no ambiguity to auto-detect.
2. **Root Directory isn't set to `backend`.** If Railway is building from
   the repo root, it may pick up the wrong thing entirely (or fail to find
   `Dockerfile`/`requirements.txt`). Service → Settings → check **Root
   Directory** reads `backend`, not blank.
3. **Read the actual failure, not just "Failed."** Click into the failed
   deployment → there are separate **Build Logs** and **Deploy Logs** tabs.
   Build Logs show `pip install`/Docker errors; Deploy Logs show the
   container's own stdout/stderr (crashes on startup, missing env vars,
   etc.) — the real error is almost always in one of those two, even when
   the top-level status just says "Failed."

## 6. Going live: turning off `DEMO_MODE`

Flip `DEMO_MODE=false` only after you've done the following — the app is
built to be honest about risk, and shipping fabricated bonding-curve
progress or security data to real users would defeat the entire point:

### 6.1 RPC keys (an API — sign up, get a URL)

Pick one: [QuickNode](https://www.quicknode.com/chains/bnb),
[Alchemy](https://www.alchemy.com/bnb-smart-chain), or
[Ankr](https://www.ankr.com/rpc/bsc/). Free tiers exist on all three.

1. Sign up, create an endpoint for **BNB Smart Chain — Mainnet**.
2. Copy both the **HTTPS** and **WebSocket (WSS)** URLs it gives you.
3. Set `RPC_HTTPS_URL` and `RPC_WSS_URL` in `backend/.env`.

That's the whole step — no ABI involved here, this is purely a connection
to the chain.

### 6.2 Verified factory ABIs (this is an ABI, not an API)

To answer your question directly: an **ABI** (Application Binary Interface)
is a JSON description of a specific contract's functions/events — it's not
a web service you call, it's a schema that belongs to one exact contract
address, and `web3.py` needs it to decode logs or call read functions like
`getCurveProgress()`. There's no "four.meme API" to hit for this — the
source of truth is the verified contract itself.

How to get it, step by step:

1. **Find the real factory/bonding-curve-manager address.** Don't trust
   any address you find secondhand (including the placeholders in this
   repo, and including the ones you pasted earlier — I still haven't been
   able to verify those from this sandbox). The reliable way: find a token
   you *know* launched on four.meme (or GraFun), open its contract on
   [BscScan](https://bscscan.com), go to its creation transaction, and look
   at "Interacted With (To)" — that's the factory/manager contract that
   deployed it.
2. **Open that address on BscScan.** If it's verified, there's a
   **Contract** tab with a **Code** sub-tab showing the ABI as JSON, with a
   copy button right there in the UI.
3. **Or fetch it programmatically via BscScan's API** (free, separate key
   from your RPC key — get one at
   [bscscan.com/myapikey](https://bscscan.com/myapikey)):
   ```
   https://api.bscscan.com/api?module=contract&action=getabi&address=0xTHE_FACTORY&apikey=YOUR_BSCSCAN_KEY
   ```
   The response's `result` field is the ABI JSON, ready to paste in.
4. **Paste it into the code.** Open `backend/app/services/bonding.py` and
   set `FourMemeReader.CURVE_ABI` (or `GraFunReader.CURVE_ABI`) to that
   JSON array, then fill in the commented-out example call in `.read()`
   with the actual function names from the ABI (they won't be exactly
   `raisedBNB`/`targetBNB` — those were illustrative). Put the confirmed
   address in `FOUR_MEME_FACTORY` / `GRAFUN_FACTORY` in `backend/.env`.
5. If the contract **isn't verified** on BscScan, there's no ABI to copy —
   check the platform's official GitHub/docs for their published ABI
   instead. Never reverse-engineer one from raw bytecode as a first resort.

### 6.3 A real honeypot simulator — **done, this one's already wired in**

I implemented this one directly rather than leaving it as a stub:
`backend/app/services/goplus.py` calls the
[GoPlus Security API](https://docs.gopluslabs.io/reference/token-security-api)
— a free, purpose-built third-party API (not an ABI — this one really is a
web service) that runs the buy/sell simulation server-side and returns
honeypot risk, buy/sell tax, LP-lock status, mintability, and holder
concentration as plain JSON. It's now the primary signal for all of that in
`chain_listener.process_token_pipeline`, with Ave AI and our own on-chain
checks as fallbacks whenever GoPlus doesn't have an opinion.

- **No key required** to start — it works out of the box at a public rate
  limit once `DEMO_MODE=false`.
- **Optional, for higher volume:** sign up free at
  [gopluslabs.io](https://gopluslabs.io/) for an App Key + Secret, set
  `GOPLUS_APP_KEY` / `GOPLUS_APP_SECRET` in `backend/.env`.
- I couldn't hit the live GoPlus API from this sandbox to test a real
  response (same network restriction that blocked BscScan/Google
  Fonts here) — the error handling is defensive (falls back to Ave AI /
  on-chain, same pattern as everywhere else in this codebase) and the code
  path was verified to run without crashing, but confirm the first few
  real responses look sane once it's deployed somewhere with normal
  internet access.
- If you want the deeper, fully-custom version instead (simulating the
  exact router/curve contract yourself via a state-override `eth_call`),
  `security_checks.simulate_buy_sell()` is still there as the place to
  build that — GoPlus covers the same need with far less work, so I'd only
  reach for that if GoPlus ever misses a case specific to a launchpad's
  bonding-curve buy/sell path (which uses the curve contract directly
  rather than a standard DEX router, and GoPlus may not model that).

### 6.4 Optional extras

- **Ave AI key** — `AVE_AI_API_KEY` in `backend/.env`. Works without it
  (falls back to GoPlus + on-chain), adds a second independent signal.
- **Web Push** — generate a VAPID keypair (see the comment atop
  `backend/app/services/push.py`) and set `VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY` on the backend, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on
  the frontend.

---

## 7. Known limitations / next steps

- **No historical price/volume charts yet.** The token detail page renders
  a live *session* sparkline (accumulated from WebSocket updates while the
  page is open) rather than true historical OHLC data, since there's no
  candles table yet. Add a `token_snapshots` table + a
  `/api/tokens/{address}/history` endpoint if you want real charts.
- **Holder-growth-rate and bonding-speed inputs to the runner score are
  randomized in DEMO_MODE** and are TODO'd for live mode — computing them
  for real means tracking snapshots over time per token (a natural
  extension of the same snapshots table above).
- **Contract verification status** (`contract_verified`) now comes from
  GoPlus (`is_open_source`) or Ave AI, whichever responds; add a direct
  BscScan `getsourcecode` API call if you want a third independent source.
- No automated test suite yet — `backend` was smoke-tested (DB init,
  scoring pipeline in both DEMO_MODE and live-mode code paths, FastAPI
  boot + endpoints) and `frontend` was type-checked and production-built
  successfully, but there's no CI.

---

## 8. Brand

"BNBPRINT" uses the BNB Chain / Binance color language: `#F0B90B` (BNB
yellow) as the single accent color, `#0B0E11` / `#181A20` / `#1E2329` dark
surfaces, `#0ECB81` green / `#F6465D` red for buy/sell-style signals. See
`frontend/tailwind.config.ts` (`theme.extend.colors.bnb`) — every component
pulls from that token set rather than hardcoded hex values.
