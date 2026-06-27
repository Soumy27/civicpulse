# CivicPulse

> Report once. The AI handles the rest.

CivicPulse turns passive complaint filing into active issue resolution through an
**autonomous AI Resolution Agent** that monitors, reasons, and acts — so citizens never
have to follow up manually. Built on Gemini 2.0 Flash with function calling, Firestore,
and the Google Maps platform.

---

## ✨ Three things no other civic platform does

1. **Predictive Hotspot Alerts** — the agent detects emerging hotspots from 90 days of
   resolved issues and alerts the responsible department *before* the next complaint is
   filed. Predicted issues appear as dashed amber pins on the map.
2. **Agent Self-Correction** — when an escalation fails, the agent autonomously retries
   with a different (higher) authority within the same reasoning cycle. The adaptation is
   visible live in the activity feed.
3. **Civic Score** — a single real-time 0–100 city-health metric on the homepage,
   recomputed on every issue mutation.

---

## 🤖 The Resolution Agent (the product core)

`/agent/resolution-agent.ts` runs a multi-step Gemini function-calling loop with **9
tools** and **Firestore-backed memory** so it never repeats an action:

| Tool | Purpose |
|------|---------|
| `get_open_issues` | Fetch open issues sorted by severity & age |
| `get_nearby_issues` | Proximity scan for duplicates / clusters |
| `get_agent_memory` | Read prior actions + cooldown before acting |
| `escalate_issue` | Escalate to a department (self-corrects on failure) |
| `merge_issues` | Mark duplicates, transfer verifiers |
| `request_evidence` | Push a clarifying question to the reporter |
| `update_status` | Move an issue through its lifecycle |
| `flag_low_confidence` | Route uncertain images to human review |
| `log_decision` | Transparent reasoning log → live feed |

The agent follows 10 strict decision rules (see `/agent/prompts.ts`) and always calls
`get_agent_memory` before acting and `log_decision` after. A cycle streams its reasoning
to the UI over NDJSON.

---

## 🚀 Quick start

```bash
npm install
cp .env.example .env.local        # fill in your keys (see below)
npm run seed                      # load 8 demo issues + history + memory
npm run dev                       # http://localhost:3000
```

### Required environment variables

| Var | Used for |
|-----|----------|
| `GEMINI_API_KEY` | Gemini vision, agent, drafting, prediction |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JS, Geocoding, Places |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Admin SDK (Firestore, Storage, FCM) |
| `NEXT_PUBLIC_FIREBASE_CONFIG` | Web SDK (auth, realtime, storage) |
| `GOOGLE_CLOUD_PROJECT_ID` | Natural Language + Pub/Sub |
| `PUBSUB_TOPIC_NEW_ISSUES` | Event-driven agent trigger |

Every external call degrades gracefully — the app runs (with fallbacks) even if a given
service is unconfigured, so a demo never hits an error screen.

---

## 🎬 3-minute demo script

1. Open the deployed URL.
2. See the **Civic Score (74/100)** in the header and the live map with issue pins.
3. Click a **red pin** → AI analysis, severity, and department routing.
4. Click **Verify** on any issue → a **+5 XP** toast slides in.
5. Go to **/agent**.
6. Click **Run Agent Now** → watch the reasoning chain stream in live.
7. Observe: the agent checks memory → decides an action → **self-corrects** the failed
   Water Supply Board escalation (Issue 3) by retrying with the Municipal Commissioner's
   Office.
8. New **dashed amber pins** appear on the map (AI-predicted hotspots).
9. Click a dashed pin → *"AI predicts a pothole likely here based on 4 historical
   repairs in this zone."*
10. Go to **/report** → upload a photo → AI classifies it in ~3 seconds with a predicted
    resolution window.

---

## 🏗 Architecture

```
                         ┌──────────────────────────────┐
        Citizen ──photo──▶  /report  ──▶  POST /api/classify
                         │                  │ Gemini Vision
                         │                  │ Cloud Natural Language (entities)
                         │                  │ Gemini text (resolution prediction)
                         │                  └─▶ duplicate check (Firestore)
                         │
                         ├──▶ POST /api/issues ──▶ Firestore  ──▶ Cloud Pub/Sub
                         │        Storage upload      │              (new-issues)
                         │        XP + Civic Score     │                  │
                         │                             ▼                  ▼
   ┌──────────────────┐  │                      onSnapshot         Agent trigger
   │  Homepage map    │◀─┘                     (realtime UI)            │
   │  Civic Score     │                                                 │
   │  Activity feed   │◀───────── agentActivity ◀──────────┐            │
   └──────────────────┘                                    │            ▼
                                                  ┌─────────────────────────────┐
        /agent ──Run──▶ POST /api/agent/run ─────▶│  Resolution Agent (Gemini    │
                         (NDJSON stream)           │  2.0 Flash + 9 tools)        │
                                                   │  • memory (Firestore)        │
                                                   │  • self-correction loop      │
                                                   │  • FCM push to officers      │
                                                   │  • end-of-cycle predictions  │
                                                   └─────────────────────────────┘
```

Data model: `issues`, `agentActivity`, `agentMemory`, `users`, `wards`,
`cityMetrics/current` (see `/lib/types.ts`).

---

## 🟦 Google technologies (12)

1. **Gemini 2.0 Flash** — vision classification, agent reasoning, escalation drafting, resolution prediction
2. **Gemini Function Calling** — 9-tool autonomous agent with memory + self-correction
3. **Google Maps JavaScript API** — live realtime issue map
4. **Maps Geocoding API** — GPS → human address (drag-to-set pin)
5. **Google Places API** — address autocomplete in the report wizard
6. **Cloud Natural Language API** — entity extraction from descriptions
7. **Firebase Authentication** — Google OAuth + anonymous
8. **Cloud Firestore** — realtime DB, live feeds, agent memory
9. **Firebase Storage** — issue photo upload + serving
10. **Firebase Cloud Messaging** — push to citizens + officers
11. **Google Cloud Run** — containerized deployment (asia-south1)
12. **Cloud Pub/Sub** — event-driven agent triggering on new issues

---

## ☁️ Deploy to Cloud Run

`next.config.js` sets `output: "standalone"`; the `Dockerfile` is multi-stage.

```bash
gcloud run deploy civicpulse \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --set-env-vars="GEMINI_API_KEY=...,NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...,FIREBASE_PROJECT_ID=...,FIREBASE_CLIENT_EMAIL=...,FIREBASE_PRIVATE_KEY=...,NEXT_PUBLIC_FIREBASE_CONFIG=...,GOOGLE_CLOUD_PROJECT_ID=...,PUBSUB_TOPIC_NEW_ISSUES=new-issues"
```

Deploy Firestore/Storage rules:

```bash
firebase deploy --only firestore:rules,storage
```

---

## 🧱 Tech stack

Next.js 14 (App Router) · TypeScript strict · Tailwind + shadcn-style UI · Firebase
(Auth/Firestore/Storage/FCM) · Gemini 2.0 Flash · Google Maps platform · Cloud Natural
Language · Cloud Pub/Sub · Cloud Run.

```
npm run dev         # local dev
npm run build       # production build (verified passing)
npm run typecheck   # tsc --noEmit (strict, zero any)
npm run seed        # load demo data
```

---

## 📁 Project structure

```
/agent        resolution-agent.ts · tools.ts · prompts.ts
/app          pages + /api routes
/components   map · agent · issue · report · ward · shared · ui
/lib          firebase · gemini · natural-language · civicScore · predictions · xp · maps · hooks
/scripts      seed.ts
```
