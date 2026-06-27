# CivicPulse — agent notes

Full-stack AI civic-issue platform. Next.js 14 App Router, TypeScript strict, Tailwind,
Firebase (Auth/Firestore/Storage/FCM), Gemini 2.0 Flash (vision + function calling),
Google Maps platform, Cloud NL, Pub/Sub, Cloud Run.

## Commands
- `npm run dev` / `npm run build` / `npm run typecheck` / `npm run seed`
- Build and typecheck are known-passing — keep them green.

## Architecture rules (important)
- **Never import `lib/firebase-admin` (or modules that do) from a client component.**
  It pulls Node `fs` into the browser bundle and breaks the build. Server-only modules:
  `firebase-admin`, `civicScore`, `predictions`, `pubsub`, `fcm`, `natural-language`,
  `auth-server`, `serialize` (admin). Pure/client-safe: `score-utils`, `utils`, `xp`,
  `maps`, `types`, `serialize-client`.
- Timestamps are serialized to epoch millis (`Millis`) at the boundary via
  `lib/serialize.ts` (server) / `lib/serialize-client.ts` (client).
- Realtime UI uses `onSnapshot` hooks in `lib/hooks.ts` — prefer these over fetch.
- External calls (Gemini, NL, FCM, Pub/Sub, Maps) must fail gracefully — never surface
  an error screen during a demo.

## Agent
- `/agent/resolution-agent.ts` — Gemini loop. `/agent/tools.ts` — 9 tools. Self-correction
  lives in `escalate_issue`: it returns `success:false` when `escalationAttempts >= 1` and
  no `alternativeDept`, forcing a retry. Issue 3 is seeded with a prior failed attempt to
  demo this.
- `POST /api/agent/run` streams NDJSON events to the `/agent` page.

## Demo data
`npm run seed` wipes + loads 8 spec issues, a resolved pothole cluster (for predictions),
agentMemory for issue-3, wards, users, and `cityMetrics/current` (Civic Score 74).
