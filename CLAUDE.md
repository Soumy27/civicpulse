# CivicPulse — agent notes

Full-stack AI civic-issue platform. Next.js 14 App Router, TypeScript strict, Tailwind.
**No Google dependencies.** Stack:
- **Supabase** — Postgres DB, Realtime, Auth (anonymous + email magic-link), Storage.
- **Groq** — Llama 3.3 70B (agent tool-calling) + Llama 4 Scout (vision classification).
- **Leaflet + OpenStreetMap + Nominatim** — map, geocoding, place search (no key, no billing).
- **Vercel** — deploy target.

## Commands
- `npm run dev` / `npm run build` / `npm run typecheck` / `npm run seed`
- Build and typecheck are known-passing — keep them green.

## Architecture rules (important)
- **Never import `lib/supabase-admin` (service role) from a client component.**
  Server-only: `supabase-admin`, `civicScore`, `predictions`, `auth-server`,
  `groq`, `agent/*`. Client-safe: `supabase-client`, `serialize`(row mappers),
  `score-utils`, `utils`, `xp`, `maps`, `types`, `hooks`, `auth-context`.
- **Leaflet touches `window` at import** → the real map lives in client leaf
  components (`LeafletMap`, `LeafletPicker`, `MiniMapInner`) loaded via
  `next/dynamic({ ssr: false })`. Never import react-leaflet into an SSR path.
- DB columns are snake_case; domain types are camelCase. Convert at the boundary
  with `lib/serialize.ts` (`rowToIssue` etc.). Timestamps → epoch millis.
- Writes go through the service-role key (API routes / agent / seed). The browser
  only reads (RLS grants public SELECT) and subscribes via Supabase Realtime
  (`lib/hooks.ts`, refetch-on-change).
- External calls (Groq, Nominatim) must fail gracefully — never an error screen.

## Agent
- `/agent/resolution-agent.ts` — Groq OpenAI-style tool-calling loop (MAX_TURNS 6,
  batched kickoff to fit rate limits, retry on transient 429/5xx, partial-result
  on failure). `/agent/tools.ts` — 9 Supabase-backed tools. Self-correction lives
  in `escalate_issue`: returns `success:false` when `escalation_attempts >= 1` and
  no `alternativeDept`, forcing a retry. issue-3 is seeded with a prior attempt.
- `POST /api/agent/run` streams NDJSON events to the `/agent` page.

## Setup / demo data
1. Create a Supabase project; run `supabase/schema.sql` in the SQL editor.
2. Enable **Anonymous** sign-ins (Auth → Providers).
3. Fill `.env.local` (see `.env.example`): Supabase URL + anon + service-role keys,
   `GROQ_API_KEY`.
4. `npm run seed` loads 8 spec issues, a resolved pothole cluster (predictions),
   recently-resolved fillers (healthy Civic Score), agent_memory for issue-3,
   wards, profiles, and `city_metrics` (id='current').
