# CivicPulse

> Report once. The AI handles the rest.

CivicPulse turns passive complaint filing into active resolution through an
**autonomous AI Resolution Agent** that monitors, reasons, escalates, and
self-corrects — so citizens never chase updates. Fully open stack, **no Google
dependencies**, deployable for free.

---

## ✨ Three things no civic platform has

1. **Predictive hotspot alerts** — the agent detects recurring problem zones from
   90 days of resolved history and flags the department before the next report.
2. **Agent self-correction** — when an escalation fails, the agent retries with a
   higher authority on its own, in the same reasoning cycle.
3. **Live Civic Score** — a single 0–100 city-health metric, recomputed the moment
   an issue resolves.

## 🤖 The Resolution Agent

`agent/resolution-agent.ts` runs a Groq (Llama 3.3 70B) tool-calling loop with
**9 Supabase-backed tools** and persistent memory: `get_open_issues`,
`get_nearby_issues`, `get_agent_memory`, `escalate_issue` (self-correcting),
`merge_issues`, `request_evidence`, `update_status`, `flag_low_confidence`,
`log_decision`. Each decision streams to a live activity feed.

## 🧱 Stack (all free, no billing)

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router), TypeScript strict, Tailwind |
| Database / realtime / auth / storage | **Supabase** (Postgres) |
| AI (agent + vision) | **Groq** — Llama 3.3 70B + Llama 4 Scout |
| Map / geocoding / search | **Leaflet + OpenStreetMap + Nominatim** |
| Deploy | **Vercel** |

## 🚀 Quick start

```bash
npm install
cp .env.example .env.local      # fill in Supabase + Groq keys
```

1. **Supabase** → create a project ([supabase.com](https://supabase.com), no card).
   - SQL editor → run `supabase/schema.sql`.
   - Auth → Providers → enable **Anonymous**.
   - Settings → API → copy the URL, anon key, and service-role key into `.env.local`.
2. **Groq** → free key at [console.groq.com/keys](https://console.groq.com/keys) → `GROQ_API_KEY`.
3. Seed + run:

```bash
npm run seed      # loads demo issues, predictions, self-correction setup
npm run dev       # http://localhost:3000
```

Open `/agent` → **Run Agent Now** to watch the reasoning chain (with
self-correction) stream live.

## ☁️ Deploy to Vercel

```bash
npm i -g vercel
vercel            # link the project
# add the same .env.local vars in the Vercel dashboard (Project → Settings → Env)
vercel --prod
```

No card required for the Vercel hobby tier.

## 📁 Structure

```
/agent        resolution-agent.ts · tools.ts · prompts.ts
/app          pages + /api routes
/components   map (Leaflet) · agent · issue · report · ward · shared · ui
/lib          supabase-admin/client · groq · civicScore · predictions · hooks · maps · xp
/supabase     schema.sql
/scripts      seed.ts
```
